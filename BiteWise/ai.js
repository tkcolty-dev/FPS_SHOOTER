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
      method: 'POST', signal: AbortSignal.timeout(90000),
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

async function coach({ messages, context }) {
  const system = `You are Bitey, the friendly AI coach inside BiteWise, a calorie-counting app. You are upbeat, short and practical, like a supportive friend who knows nutrition. Keep replies under 90 words unless the user asks for a plan or list. Use plain language a teenager understands. No markdown headers; short lists are fine.

Stay on topic: food, nutrition, cooking, calories, exercise, steps, sleep, water, weight goals, and how to use BiteWise. If the user asks for something else (games like chess, homework, coding, general trivia, other apps or websites), don't help with it and don't give links. Reply in one friendly sentence that you're their food and fitness coach, then offer one related thing you can help with (for example: "I'm your food and fitness coach, so I'll skip chess, but want a brain-boosting snack idea?"). Only use that line for off-topic requests. For normal food and fitness questions, just answer directly without introducing yourself. Never share links to websites.

You can take actions in the app. When the user says they ate or drank something, estimate realistic calories (typical US portions) and add a "log" action for each item. When they mention water, add a "water" action. When they tell you their weight, add a "weight" action. Only add actions for things the user actually said they had — never for suggestions.

${SAFETY}

Current app data for this user (use it; don't ask for things already here):
${JSON.stringify(context, null, 1)}

Respond with ONLY a JSON object, no other text:
{"reply": "what you say to the user", "actions": [{"type":"log","name":"Big Mac","calories":590,"meal":"lunch"}, {"type":"water","glasses":1}, {"type":"weight","value":172.4}], "chips": ["up to 3 short follow-up questions the user might tap next"]}
meal is one of breakfast, lunch, dinner, snack (pick from the time of day if unclear). actions and chips may be empty arrays.`;
  const raw = await chat({ system, messages: messages.slice(-12) });
  try {
    const j = parseJSON(raw);
    return { reply: String(j.reply || '').slice(0, 2000), actions: Array.isArray(j.actions) ? j.actions.slice(0, 12) : [], chips: Array.isArray(j.chips) ? j.chips.slice(0, 3).map(String) : [] };
  } catch {
    return { reply: String(raw).replace(/```[\s\S]*?```/g, '').trim().slice(0, 2000) || 'Sorry, I lost my train of thought. Try again?', actions: [], chips: [] };
  }
}

async function estimate(text) {
  const system = `You estimate calories for foods. Given what someone ate, split it into items and give realistic calories for a typical US portion (or the portion they said). Respond with ONLY JSON: {"items":[{"name":"short name","calories":123}]}. Round to the nearest 5.`;
  const raw = await chat({ system, messages: [{ role: 'user', content: String(text).slice(0, 500) }], maxTokens: 600 });
  const j = parseJSON(raw);
  return (j.items || []).filter(i => i && i.name && Number.isFinite(+i.calories)).slice(0, 12).map(i => ({ name: String(i.name).slice(0, 60), calories: Math.max(0, Math.round(+i.calories)) }));
}

module.exports = { coach, estimate, BACKEND, get model() { return BACKEND === 'openai' ? (MODEL || 'loading…') : BACKEND === 'cli' ? 'claude (local CLI)' : 'none'; } };
