// Everything a Scratch project can ask CloudPlug to do.
// A request is "name&arg1&arg2…". Handlers return a string/number (→ `plug response`) or an array (→ `plug response list`).

const LIMITS = { value: 5000, chat: 200, list: 2000, board: 500, mail: 50, fetch: 3000, ai: 1200 };
const clamp = (s, n) => String(s ?? '').slice(0, n);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

const HELP = [
  ['ping', '', 'replies "pong" — test the connection'],
  ['echo', 'text', 'sends the text right back'],
  ['time', '', 'server time in milliseconds since 1970 (same for every player — sync timers!)'],
  ['date', '', 'today as YYYY-MM-DD HH:MM (UTC)'],
  ['random', 'min & max', 'a random whole number the server picked (fair for everyone)'],
  ['whoami', '', 'the Scratch username the server saw send the request (verified from Scratch\'s cloud log)'],
  ['online', '', 'how many different players used the server in the last 2 minutes'],
  ['players', '', 'LIST of player names seen in the last 2 minutes'],
  ['save', 'key & value', 'save any text (up to 5000 chars) under a key — for the whole project'],
  ['load', 'key', 'load a saved value ("" if none)'],
  ['delete', 'key', 'delete a saved key'],
  ['has', 'key', '"1" if the key exists, else "0"'],
  ['keys', '', 'LIST of all saved keys'],
  ['add', 'key & amount', 'add to a number (counter): total plays, coins, votes… returns the new total'],
  ['usersave', 'player & key & value', 'save something for one player (their own save slot)'],
  ['userload', 'player & key', 'load one player\'s saved value'],
  ['userkeys', 'player', 'LIST of that player\'s saved keys'],
  ['userdelete', 'player & key', 'delete one of a player\'s keys'],
  ['listadd', 'list & item', 'add an item to a cloud list'],
  ['listget', 'list', 'LIST — the whole cloud list'],
  ['listitem', 'list & index', 'one item (1 = first)'],
  ['listset', 'list & index & item', 'replace an item'],
  ['listdel', 'list & index', 'delete an item'],
  ['listlen', 'list', 'how many items'],
  ['listfind', 'list & item', 'index of item (0 = not there)'],
  ['listclear', 'list', 'empty the list'],
  ['score', 'board & player & score', 'submit a score — keeps each player\'s BEST. Returns their rank'],
  ['scorelow', 'board & player & score', 'same, but lower is better (fastest time)'],
  ['top', 'board & how many', 'LIST of "player: score" best-first'],
  ['rank', 'board & player', 'player\'s rank on the board (0 = no score)'],
  ['best', 'board & player', 'player\'s best score'],
  ['boardclear', 'board', 'wipe a leaderboard'],
  ['cset', 'name & value', 'super cloud variable: any text, any length, unlimited count'],
  ['cget', 'name', 'read a super cloud variable'],
  ['cvars', '', 'LIST of super cloud variable names'],
  ['cadd', 'name & amount', 'add to a super cloud variable (safe when many players do it at once)'],
  ['chat', 'player & text', 'post a chat message (last 200 kept)'],
  ['chatlog', 'how many', 'LIST of the latest "player: text" messages, oldest first'],
  ['chatsince', 'id', 'LIST of messages newer than id (first item = newest id) — poll this'],
  ['mail', 'to & from & text', 'leave a message for a player'],
  ['inbox', 'player', 'LIST of "from: text" waiting for that player (then cleared)'],
  ['fetch', 'url', 'download a web page / API as text (first 3000 chars)'],
  ['json', 'url & path', 'fetch JSON and pick a value, e.g. path "main.temp" or "results.0.name"'],
  ['weather', 'city', 'current temperature (°C) and conditions for a city'],
  ['define', 'word', 'dictionary definition'],
  ['joke', '', 'a random joke'],
  ['ai', 'question', 'ask the AI (Claude) — short answer'],
  ['aichar', 'character & message', 'AI replies in character, e.g. "grumpy wizard"'],
  ['broadcast', 'text', 'push a "cloud plug message" to every running copy of the project'],
];

function makeHandlers({ pushMessage }) {
  const ai = getAI();
  const h = {};
  h.__ai = !!ai;

  // ---- basics ----
  h.ping = () => 'pong';
  h.echo = (c, ...a) => a.join('&');
  h.time = () => String(Date.now());
  h.date = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
  h.random = (c, a, b) => { const lo = Math.ceil(num(a)), hi = Math.floor(num(b, 10)); return String(lo + Math.floor(Math.random() * (hi - lo + 1))); };
  h.whoami = async (c) => { const u = await c.requester(); c.touch(u); return u || 'unknown'; };
  h.online = (c) => String(activePlayers(c).length);
  h.players = (c) => activePlayers(c);
  function activePlayers(c) { const cut = Date.now() - 120000; return Object.entries(c.project.seen).filter(([, t]) => t > cut).map(([u]) => u); }

  // ---- project storage ----
  h.save = (c, key, ...rest) => { c.project.kv[clamp(key, 100)] = clamp(rest.join('&'), LIMITS.value); c.changed(); return 'saved'; };
  h.load = (c, key) => c.project.kv[clamp(key, 100)] ?? '';
  h.delete = (c, key) => { delete c.project.kv[clamp(key, 100)]; c.changed(); return 'deleted'; };
  h.has = (c, key) => (clamp(key, 100) in c.project.kv ? '1' : '0');
  h.keys = (c) => Object.keys(c.project.kv);
  h.add = (c, key, amount) => { key = clamp(key, 100); const v = num(c.project.kv[key]) + num(amount, 1); c.project.kv[key] = String(v); c.changed(); return String(v); };

  // ---- per-player storage ----
  const userBag = (c, user) => { user = clamp(user, 40).trim() || 'unknown'; c.touch(user); return (c.project.users[user] = c.project.users[user] || {}); };
  h.usersave = (c, user, key, ...rest) => { userBag(c, user)[clamp(key, 100)] = clamp(rest.join('&'), LIMITS.value); c.changed(); return 'saved'; };
  h.userload = (c, user, key) => userBag(c, user)[clamp(key, 100)] ?? '';
  h.userkeys = (c, user) => Object.keys(userBag(c, user));
  h.userdelete = (c, user, key) => { delete userBag(c, user)[clamp(key, 100)]; c.changed(); return 'deleted'; };

  // ---- cloud lists ----
  const list = (c, name) => (c.project.lists[clamp(name, 100)] = c.project.lists[clamp(name, 100)] || []);
  h.listadd = (c, name, ...rest) => { const l = list(c, name); l.push(clamp(rest.join('&'), LIMITS.value)); if (l.length > LIMITS.list) l.shift(); c.changed(); return String(l.length); };
  h.listget = (c, name) => list(c, name).slice();
  h.listitem = (c, name, i) => list(c, name)[num(i) - 1] ?? '';
  h.listset = (c, name, i, ...rest) => { const l = list(c, name); const k = num(i) - 1; if (k >= 0 && k < l.length) { l[k] = clamp(rest.join('&'), LIMITS.value); c.changed(); return 'ok'; } return 'no such item'; };
  h.listdel = (c, name, i) => { const l = list(c, name); const k = num(i) - 1; if (k >= 0 && k < l.length) { l.splice(k, 1); c.changed(); return 'ok'; } return 'no such item'; };
  h.listlen = (c, name) => String(list(c, name).length);
  h.listfind = (c, name, ...rest) => String(list(c, name).indexOf(rest.join('&')) + 1);
  h.listclear = (c, name) => { c.project.lists[clamp(name, 100)] = []; c.changed(); return 'cleared'; };

  // ---- leaderboards ----
  const board = (c, name) => (c.project.boards[clamp(name, 100)] = c.project.boards[clamp(name, 100)] || { lowIsBetter: false, scores: {} });
  const sorted = (b) => Object.entries(b.scores).sort((x, y) => (b.lowIsBetter ? x[1] - y[1] : y[1] - x[1]));
  const submit = (c, name, player, score, lowIsBetter) => {
    const b = board(c, name); b.lowIsBetter = lowIsBetter; player = clamp(player, 40).trim() || 'anonymous'; c.touch(player);
    const s = num(score); const old = b.scores[player];
    if (old === undefined || (lowIsBetter ? s < old : s > old)) b.scores[player] = s;
    const rows = sorted(b); if (rows.length > LIMITS.board) for (const [p] of rows.slice(LIMITS.board)) delete b.scores[p];
    c.changed(); return String(sorted(b).findIndex(([p]) => p === player) + 1);
  };
  h.score = (c, name, player, score) => submit(c, name, player, score, false);
  h.scorelow = (c, name, player, score) => submit(c, name, player, score, true);
  h.top = (c, name, n) => sorted(board(c, name)).slice(0, Math.max(1, Math.min(100, num(n, 10)))).map(([p, s]) => `${p}: ${s}`);
  h.rank = (c, name, player) => String(sorted(board(c, name)).findIndex(([p]) => p === clamp(player, 40).trim()) + 1);
  h.best = (c, name, player) => { const s = board(c, name).scores[clamp(player, 40).trim()]; return s === undefined ? '' : String(s); };
  h.boardclear = (c, name) => { delete c.project.boards[clamp(name, 100)]; c.changed(); return 'cleared'; };

  // ---- super cloud variables ----
  const setVar = (c, name, value) => { name = clamp(name, 100); value = clamp(value, LIMITS.value); c.project.vars[name] = { value, updated: Date.now(), source: 'request' }; c.push(name, value); c.changed(); return value; };
  h.cset = (c, name, ...rest) => { setVar(c, name, rest.join('&')); return 'ok'; };
  h.cget = (c, name) => c.project.vars[clamp(name, 100)]?.value ?? '';
  h.cvars = (c) => Object.keys(c.project.vars).filter((n) => !n.startsWith('☁ FROM_HOST_') && n !== '☁ TO_HOST');
  h.cadd = (c, name, amount) => setVar(c, name, String(num(c.project.vars[clamp(name, 100)]?.value) + num(amount, 1)));

  // ---- chat & mail ----
  h.chat = (c, user, ...rest) => {
    const text = clamp(rest.join('&'), 300).trim(); if (!text) return 'empty';
    user = clamp(user, 40).trim() || 'anon'; c.touch(user);
    const id = (c.project.chatId = (c.project.chatId || 0) + 1);
    c.project.chat.push({ id, user, text, t: Date.now() });
    if (c.project.chat.length > LIMITS.chat) c.project.chat.shift();
    c.changed(); return String(id);
  };
  h.chatlog = (c, n) => c.project.chat.slice(-Math.max(1, Math.min(100, num(n, 20)))).map((m) => `${m.user}: ${m.text}`);
  h.chatsince = (c, id) => { const since = num(id); const rows = c.project.chat.filter((m) => m.id > since).slice(-50); return [String(c.project.chatId || 0), ...rows.map((m) => `${m.user}: ${m.text}`)]; };
  h.mail = (c, to, from, ...rest) => { to = clamp(to, 40).trim(); const box = (c.project.mail[to] = c.project.mail[to] || []); box.push(`${clamp(from, 40)}: ${clamp(rest.join('&'), 300)}`); if (box.length > LIMITS.mail) box.shift(); c.changed(); return 'sent'; };
  h.inbox = (c, user) => { user = clamp(user, 40).trim(); const box = c.project.mail[user] || []; delete c.project.mail[user]; c.changed(); return box; };

  // ---- the web ----
  async function getText(url) {
    url = String(url).trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'CloudPlug/1.0 (Scratch project helper)', accept: 'application/json, text/plain, text/html;q=0.8, */*;q=0.5' }, redirect: 'follow' });
      const body = await res.text();
      return { ok: res.ok, status: res.status, body, type: res.headers.get('content-type') || '' };
    } finally { clearTimeout(t); }
  }
  const stripHtml = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  h.fetch = async (c, ...rest) => { const r = await getText(rest.join('&')); const text = /html/i.test(r.type) ? stripHtml(r.body) : r.body; return clamp(text.replace(/\s+/g, ' ').trim(), LIMITS.fetch); };
  h.json = async (c, url, pathStr = '') => {
    const r = await getText(url); let j; try { j = JSON.parse(r.body); } catch { return 'not JSON'; }
    let cur = j;
    for (const part of String(pathStr).split('.').filter(Boolean)) { if (cur === null || cur === undefined) break; cur = cur[part]; }
    if (cur === undefined || cur === null) return '';
    if (Array.isArray(cur)) return cur.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).slice(0, 100);
    return clamp(typeof cur === 'object' ? JSON.stringify(cur) : String(cur), LIMITS.fetch);
  };
  h.weather = async (c, ...rest) => {
    const city = rest.join(' ').trim(); if (!city) return 'which city?';
    const g = await getText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const gj = JSON.parse(g.body); const spot = gj.results && gj.results[0]; if (!spot) return 'city not found';
    const w = await getText(`https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}&current=temperature_2m,weather_code,wind_speed_10m`);
    const cur = JSON.parse(w.body).current;
    const codes = { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'cloudy', 45: 'fog', 48: 'fog', 51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 61: 'rain', 63: 'rain', 65: 'heavy rain', 71: 'snow', 73: 'snow', 75: 'heavy snow', 80: 'showers', 81: 'showers', 82: 'heavy showers', 95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm' };
    return `${spot.name}: ${cur.temperature_2m}C, ${codes[cur.weather_code] || 'weather code ' + cur.weather_code}, wind ${cur.wind_speed_10m} km/h`;
  };
  h.define = async (c, word) => {
    const r = await getText(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(String(word).trim())}`);
    try { const j = JSON.parse(r.body); return clamp(j[0].meanings[0].definitions[0].definition, 300); } catch { return 'no definition found'; }
  };
  h.joke = async () => { const r = await getText('https://official-joke-api.appspot.com/random_joke'); try { const j = JSON.parse(r.body); return `${j.setup} ${j.punchline}`; } catch { return 'no joke today'; } };

  // ---- AI ----
  h.ai = async (c, ...rest) => askAI(ai, 'You are a helpful assistant inside a Scratch game made by a kid. Answer in 1-3 short sentences, plain text, no markdown.', rest.join('&'));
  h.aichar = async (c, character, ...rest) => askAI(ai, `You are a character in a Scratch game: ${clamp(character, 100)}. Stay in character. Reply in 1-2 short sentences, plain text, family friendly.`, rest.join('&'));

  // ---- push to everyone ----
  h.broadcast = (c, ...rest) => { pushMessage(c.projectId, rest.join('&')); return 'sent'; };

  return h;
}

// AI: the Cloud Foundry GenAI service (OpenAI-compatible, same one BlockBuddy uses) or a local ANTHROPIC_API_KEY.
function getAI() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      for (const list of Object.values(vcap)) for (const svc of list || []) {
        const c = svc.credentials || {}; const ep = (c.endpoint && c.endpoint.api_base) ? c.endpoint : c;
        if (ep.api_base && ep.api_key) return { provider: 'genai', apiBase: ep.api_base, apiKey: ep.api_key, model: process.env.MODEL || null };
      }
    } catch {}
  }
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', model: process.env.MODEL || 'claude-opus-5' };
  return null;
}
async function askAI(ai, system, question) {
  if (!ai) return 'AI is not set up on this server';
  question = clamp(question, 1000).trim(); if (!question) return 'ask me something!';
  if (ai.provider === 'anthropic') {
    const Anthropic = require('@anthropic-ai/sdk');
    ai.client = ai.client || new Anthropic();
    const res = await ai.client.messages.create({ model: ai.model, max_tokens: 400, system, messages: [{ role: 'user', content: question }] });
    if (res.stop_reason === 'refusal') return "I can't help with that one.";
    return clamp(res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim(), LIMITS.ai);
  }
  if (!ai.model) {
    try {
      const r = await fetch(`${ai.apiBase}/openai/v1/models`, { headers: { Authorization: `Bearer ${ai.apiKey}` } });
      const names = ((await r.json()).data || []).map((m) => m.id);
      ai.model = names.find((n) => /claude/i.test(n)) || names.find((n) => /gpt-oss-120b/.test(n)) || names[0] || 'openai/gpt-oss-120b';
    } catch { ai.model = 'openai/gpt-oss-120b'; }
  }
  const r = await fetch(`${ai.apiBase}/openai/v1/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: ai.model, max_tokens: 400, messages: [{ role: 'system', content: system }, { role: 'user', content: question }] }),
  });
  const j = await r.json();
  const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  return clamp(String(text || j.error?.message || 'no answer').trim(), LIMITS.ai);
}

module.exports = { makeHandlers, HELP, LIMITS };
