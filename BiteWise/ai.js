// AI coach backend. Priority:
//   1. OpenAI-compatible endpoint — the Tanzu GenAI "ai-models" binding in VCAP_SERVICES (open models on Cloud Foundry),
//      or OPENAI_API_BASE + OPENAI_API_KEY for local testing against the same endpoint
//   2. Local Claude Code CLI (`claude`) — dev machines only
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

function detectOpenAI() {
  if (process.env.OPENAI_API_BASE && process.env.OPENAI_API_KEY) return { base: process.env.OPENAI_API_BASE.replace(/\/$/, ''), key: process.env.OPENAI_API_KEY, configUrl: process.env.OPENAI_CONFIG_URL || null, name: 'custom' };
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      for (const svc of Object.values(vcap).flat()) {
        const tags = (svc.tags || []).join(',');
        const ep = svc.credentials?.endpoint || svc.credentials;
        if ((/genai|ai-models|llm/i.test(tags) || /genai|ai-models/i.test(svc.label || '')) && ep && (ep.openai_api_base || ep.api_base) && ep.api_key) {
          return { base: (ep.openai_api_base || ep.api_base + '/openai').replace(/\/$/, ''), key: ep.api_key, configUrl: ep.config_url || null, name: ep.name || svc.name };
        }
      }
    } catch (e) { console.error('VCAP_SERVICES parse error (ai):', e.message); }
  }
  return null;
}

const { search, imageFor } = require('./search');
const OPENAI = detectOpenAI();
const CLAUDE_BIN = [os.homedir() + '/.local/bin/claude'].find(p => fs.existsSync(p)) || (spawnSync('which', ['claude']).stdout?.toString().trim() || null);
const BACKEND = OPENAI ? 'openai' : CLAUDE_BIN ? 'cli' : 'none';

// gpt-oss-120b benchmarked best on this platform for structured JSON (see WorkBook notes); fall back down the list.
const TEXT_PREF = ['openai/gpt-oss-120b', 'deepseek-ai/DeepSeek-V4-Flash', 'poolside/Laguna', 'google/gemma-4'];
let MODEL = process.env.AI_MODEL || null, ready = null;
async function modelReady() {
  if (BACKEND !== 'openai' || MODEL) return;
  ready ||= (async () => {
    let ids = [];
    try {
      if (OPENAI.configUrl) { const cfg = await fetch(OPENAI.configUrl, { headers: { Authorization: 'Bearer ' + OPENAI.key } }).then(r => r.json()); ids = (cfg.advertisedModels || []).filter(m => (m.capabilities || []).includes('CHAT')).map(m => m.name); }
      if (!ids.length) { const r = await fetch(OPENAI.base + '/v1/models', { headers: { Authorization: 'Bearer ' + OPENAI.key } }).then(r => r.json()); ids = (r.data || []).map(m => m.id); }
    } catch (e) { console.error('model discovery failed:', e.message); }
    ids = ids.filter(id => !/embed/i.test(id));
    MODEL = TEXT_PREF.map(p => ids.find(id => id.startsWith(p))).find(Boolean) || ids[0] || 'openai/gpt-oss-120b';
    console.log('AI model:', MODEL);
  })();
  return ready;
}
modelReady();

async function chat({ system, messages, maxTokens = 1400 }) {
  if (BACKEND === 'openai') {
    await modelReady();
    const r = await fetch(OPENAI.base + '/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(+process.env.AI_TIMEOUT_MS || 25000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OPENAI.key },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: 'system', content: system }, ...messages] }),
    });
    if (!r.ok) throw new Error('AI service error ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return j.choices?.[0]?.message?.content || '';
  }
  if (BACKEND === 'cli') {
    const convo = messages.map(m => (m.role === 'user' ? 'USER: ' : 'COACH: ') + m.content).join('\n\n');
    return new Promise((resolve, reject) => {
      const p = spawn(CLAUDE_BIN, ['-p', '--model', 'haiku', '--tools', '', '--system-prompt', system], { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '', err = '';
      const t = setTimeout(() => { p.kill(); reject(new Error('AI timed out')); }, 90000);
      p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
      p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error('claude CLI failed: ' + err.slice(0, 200))); });
      p.stdin.end(convo + '\n\nReply as COACH, JSON only.');
    });
  }
  throw new Error('The AI coach is not set up on this server yet. Bind an ai-models service to turn it on.');
}

function parseJSON(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) t = fence[1].trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no JSON in AI reply');
  return JSON.parse(t.slice(a, b + 1));
}

const SAFETY = `Safety rules you must always follow:
- Never recommend eating below 1200 kcal/day (women) or 1500 kcal/day (men), fasting for days, purging, diet pills, or losing more than about 1% of body weight per week.
- If the user mentions guilt, skipping meals to "make up" for food, bingeing, or feeling out of control around food, respond with kindness, never shame, and mention they can talk to a trusted adult or doctor (in the US, the ANAD helpline is 1-888-375-7767).
- No "good" or "bad" foods. Everything can fit.
- The user's allergies are in user.allergies. Never suggest a food containing them. If they log one, add a short, calm heads-up.`;

// Bitey's skills: how to handle each kind of request, and the quality bar for the answer.
const SKILLS = `SKILLS (pick the one that fits, follow it exactly):
1. MEAL IDEAS ("what should I eat", "snack ideas", "dinner under 600"): give 2 or 3 "meal" cards. Each must fit today.remaining (and the meal time), list every ingredient with an amount and its calories, have calories that add up, a realistic "minutes", and 3 to 5 short steps. Respect user.allergies. The reply is one short sentence introducing them.
2. RECIPE ("how do I make", "recipe for"): one detailed "meal" card with full ingredients, calories and steps.
3. CALORIE QUESTION ("how many calories in X"): answer in the reply with a number and the portion (for example "A medium banana is about 105 calories."). If it's a specific brand or restaurant item, you may search first. Local shops often don't publish calories: then ALWAYS give a typical estimate for that kind of item and say it's an estimate (for example "Holtman's doesn't post calories, but a glazed donut is usually about 250 to 300."). Never just say you couldn't find it.
4. PLACES, BRANDS, RESTAURANTS ("what is Holtman's Donuts", "best order at Chick-fil-A"): you MUST set "search" first; never answer these from memory. Then give a "place" card for a real place (name, address, hours if known, one-sentence about) or a "fact" card for a brand or food, plus one smarter-order tip with calories.
5. CHECK-IN ("how am I doing", "this week"): use last7days and weight. Two sentences: one specific win with numbers, one specific next step. No cards.
6. SWAPS ("healthier version of X"): 2 or 3 swaps in the reply, one per line, like "Fries (365) → side salad (120)".
7. GROCERY LIST: one "list" card with items grouped simply.
QUALITY BAR: be specific with real numbers, never vague. No filler like "consult a professional" for normal food questions. Never use markdown symbols (no **, no #). When you send cards, keep the reply to 1 or 2 sentences. The cards hold the details.`;

const CARD_SPEC = `Card formats (use only these):
{"type":"meal","title":"Turkey & Avocado Wrap","calories":390,"minutes":5,"image":"wrap","ingredients":[{"item":"1 whole-wheat tortilla","calories":120}],"steps":["Warm the tortilla.","Layer turkey, avocado and greens.","Roll it up."]}
{"type":"place","name":"<place name>","address":"<address from the lookup results>","hours":"<hours from the lookup results, or empty>","about":"<one sentence>"}
{"type":"fact","title":"Quinoa","text":"Two short sentences.","image":"quinoa"}
{"type":"list","title":"Grocery list","items":["Greek yogurt","Berries"]}
"image" is a simple 1 or 2 word dish name for a photo, like "parfait", "wrap", "quesadilla".`;

function coachSystem(context, results) {
  return `You are Bitey, the friendly AI coach inside BiteWise, a calorie-counting app. You're upbeat, short and practical, like a supportive friend who knows nutrition. Use plain language a teenager understands.

Greetings, thanks and small talk ("hi", "hello", "thanks", "how are you") are welcome: reply warmly in one short sentence and offer help, like "Hey! Want a snack idea, or should I log something?" Never refuse a greeting.

Stay on topic: food, nutrition, cooking, restaurants, calories, exercise, steps, sleep, water, weight goals, and how to use BiteWise. If the user asks for something else (games like chess, homework, coding, general trivia, other apps), don't help. Reply in one friendly sentence that you're their food and fitness coach, then offer one related thing (for example: "I'm your food and fitness coach, so I'll skip chess, but want a brain-boosting snack idea?"). Only use that line for off-topic requests; otherwise answer directly without introducing yourself. Never write web links yourself. The app shows sources.

${SKILLS}

You can take actions in the app. Only add actions for things the user actually told you they did or asked you to change. Never add actions for your own suggestions.
- They ate or drank something: a "log" action per item, with realistic calories (typical US portions). If it was yesterday, add "day":"yesterday".
- Water: {"type":"water","glasses":2}
- Weight: {"type":"weight","value":172.4}
- Steps: {"type":"steps","value":6000,"mode":"set"} for a total, or "mode":"add" for extra.
- Daily calorie goal: {"type":"goal","calories":1800}, or {"type":"goal","calories":null} for automatic. The app keeps its safety minimum.
- Remove a food logged today: {"type":"remove","name":"chips"}.

${SAFETY}

Current app data for this user (use it; don't ask for things already here):
${JSON.stringify(context, null, 1)}
${results ? `
LOOKUP RESULTS (from Wikipedia, DuckDuckGo and OpenStreetMap). Use them for facts about places, brands and foods. If they don't answer the question, say you couldn't find it. Don't guess an address or hours:
${results}` : ''}

${CARD_SPEC}

Respond with ONLY a JSON object, no other text:
{"reply": "what you say", "cards": [], "actions": [], "chips": ["up to 3 short follow-ups the user might tap"]${results ? '' : ', "search": ""'}}
${results ? '' : 'Set "search" to a short lookup query ONLY when you need facts you don\'t reliably know (a specific local place, restaurant, brand or product). Otherwise leave it "". When you set "search", the reply can be empty. You will get the results and answer then.'}
meal is one of breakfast, lunch, dinner, snack. cards, actions and chips may be empty arrays.`;
}

const clean = t => String(t || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/\*(\S.*?)\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();

async function finishCards(cards, results) {
  const out = [];
  for (const c of (Array.isArray(cards) ? cards : []).slice(0, 4)) {
    if (!c || typeof c !== 'object') continue;
    if (c.type === 'meal' && c.title) {
      const ings = (Array.isArray(c.ingredients) ? c.ingredients : []).slice(0, 15).map(i => ({ item: String(i.item || i.name || '').slice(0, 80), calories: Math.max(0, Math.round(+i.calories || 0)) })).filter(i => i.item);
      const sum = ings.reduce((a, i) => a + i.calories, 0);
      let cal = Math.round(+c.calories || 0);
      if (sum && (!cal || Math.abs(cal - sum) / sum > 0.1)) cal = sum; // quality guard: the total must match the ingredients
      out.push({ type: 'meal', title: String(c.title).slice(0, 60), calories: cal, minutes: Math.round(+c.minutes || 0) || null, ingredients: ings, steps: (Array.isArray(c.steps) ? c.steps : []).slice(0, 8).map(x => clean(x).slice(0, 200)), imageQ: String(c.image || c.title).slice(0, 40) });
    } else if (c.type === 'place' && c.name) {
      const r = (results || []).find(x => x.kind === 'place' && x.title.toLowerCase().replace(/[’']/g, '') .includes(String(c.name).toLowerCase().replace(/[’']/g, '').slice(0, 8)));
      out.push({ type: 'place', name: String(c.name).slice(0, 60), address: String(c.address || r?.address || '').slice(0, 120), hours: String(c.hours || r?.hours || '').slice(0, 80), about: clean(c.about).slice(0, 200), website: r?.website || null, phone: r?.phone || null, lat: r?.lat ?? null, lon: r?.lon ?? null });
    } else if (c.type === 'fact' && c.title) {
      out.push({ type: 'fact', title: String(c.title).slice(0, 60), text: clean(c.text).slice(0, 400), imageQ: String(c.image || c.title).slice(0, 40) });
    } else if (c.type === 'list' && Array.isArray(c.items)) {
      out.push({ type: 'list', title: String(c.title || 'List').slice(0, 60), items: c.items.slice(0, 30).map(x => clean(x).slice(0, 80)) });
    }
  }
  // pictures, fetched in parallel, never slower than ~4 seconds
  await Promise.all(out.map(async c => { if (c.imageQ) { c.image = await Promise.race([imageFor(c.imageQ), new Promise(r => setTimeout(() => r(null), 4500))]).catch(() => null); delete c.imageQ; } }));
  return out;
}

async function coach({ messages, context }) {
  const convo = messages.slice(-12);
  // if the model ever sends broken JSON, still show its words instead of an error
  const ask = async system => { const raw = await chat({ system, messages: convo, maxTokens: 1800 }); try { return parseJSON(raw); } catch { return { reply: String(raw).replace(/```[\s\S]*?```/g, '').replace(/^\s*\{[\s\S]*\}\s*$/, '').trim() || 'Sorry, I lost my train of thought. Try again?' }; } };
  const first = await ask(coachSystem(context, null));
  let j = first, searched = null, sources = [], results = null;
  // grounding: a place card must come from a real lookup, so if the model skipped the search, do it now
  let q = String(first.search || '').trim();
  const placeCard = (first.cards || []).find(c => c && c.type === 'place' && c.name);
  if (!q && placeCard) q = placeCard.name;
  if (!q && /\b(what is|what's|whats|where is|who makes|hours|open|near me|restaurant|cafe|diner|shop|bakery|donuts?|menu at)\b/i.test(convo[convo.length - 1]?.content || '') && (first.cards || []).some(c => c?.type === 'fact')) q = (first.cards.find(c => c.type === 'fact').title);
  if (q) {
    const r = await search(q);
    if (r.refused) return { reply: "That's not something I can look up. I'm here for food, fitness and feeling good. Want a meal idea instead?", actions: [], chips: [], cards: [], searched: null, sources: [] };
    results = r.results; searched = q;
    const block = results.length ? results.map((x, i) => `${i + 1}. [${x.kind}] ${x.title}: ${x.text}${x.hours ? ' · hours: ' + x.hours : ''}${x.website ? ' · website: ' + x.website : ''}`).join('\n') : '(no results found)';
    try { j = await ask(coachSystem(context, block)); }
    catch (e) { console.error('coach step 2:', e.message); j = { ...first, reply: first.reply || 'I looked it up but ran out of time putting it together. Ask me again?' }; }
    sources = results.filter(x => x.url).slice(0, 3).map(x => ({ title: x.title, url: x.url, kind: x.kind }));
  }
  return {
    reply: clean(j.reply).slice(0, 1500) || (j.cards?.length ? 'Here you go:' : 'Hmm, try asking that another way?'),
    actions: Array.isArray(j.actions) ? j.actions.slice(0, 12) : [],
    chips: Array.isArray(j.chips) ? j.chips.slice(0, 3).map(x => clean(x).slice(0, 80)) : [],
    cards: await finishCards(j.cards, results), searched, sources,
  };
}

async function estimate(text) {
  const system = `You estimate calories for foods. Given what someone ate, split it into items and give realistic calories for a typical US portion (or the portion they said). Respond with ONLY JSON: {"items":[{"name":"short name","calories":123}]}. Round to the nearest 5.`;
  const raw = await chat({ system, messages: [{ role: 'user', content: String(text).slice(0, 500) }], maxTokens: 600 });
  const j = parseJSON(raw);
  return (j.items || []).filter(i => i && i.name && Number.isFinite(+i.calories)).slice(0, 12).map(i => ({ name: String(i.name).slice(0, 60), calories: Math.max(0, Math.round(+i.calories)) }));
}

module.exports = { coach, estimate, BACKEND, get model() { return BACKEND === 'openai' ? (MODEL || 'loading…') : BACKEND === 'cli' ? 'claude (local CLI)' : 'none'; } };
