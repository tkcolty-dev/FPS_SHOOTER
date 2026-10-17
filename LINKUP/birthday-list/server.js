// Birthday List — paste a product link, it fills in the picture, name and price.
// Storage: Postgres when VCAP_SERVICES (Cloud Foundry) or DATABASE_URL is present, else data/lists.json.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { scrape, findByName } = require('./scrape');

const PORT = process.env.PORT || 4970;

function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      for (const list of Object.values(vcap)) {
        for (const svc of list) {
          const c = svc.credentials || {};
          if (c.uri || c.url) return { connectionString: (c.uri || c.url).replace(/^jdbc:/, ''), ssl: false };
          if (c.hostname || c.host || c.hosts)
            return { host: c.hostname || c.host || c.hosts[0], port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: false };
        }
      }
    } catch (e) {
      console.error('VCAP_SERVICES parse error', e.message);
    }
  }
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ssl: false };
  return null;
}

function fileStore() {
  const file = path.join(__dirname, 'data', 'lists.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let all = {};
  try {
    all = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return {
    async init() {},
    async get(id) {
      return all[id] ? structuredClone(all[id]) : null;
    },
    async put(list) {
      all[list.id] = structuredClone(list);
      fs.writeFileSync(file, JSON.stringify(all, null, 1));
    },
  };
}

function pgStore(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool({ ...cfg, max: 4 });
  return {
    async init() {
      await pool.query('CREATE TABLE IF NOT EXISTS bl_lists (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())');
    },
    async get(id) {
      const r = await pool.query('SELECT data FROM bl_lists WHERE id = $1', [id]);
      return r.rows[0]?.data || null;
    },
    async put(list) {
      await pool.query(
        'INSERT INTO bl_lists (id, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()',
        [list.id, list]
      );
    },
  };
}

const cfg = pgConfig();
const store = cfg ? pgStore(cfg) : fileStore();

const rid = (n) => crypto.randomBytes(n).toString('base64url');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Owners never see who's buying what — that would spoil the surprise.
function view(list, owner) {
  const items = list.items.map((it) => {
    const { claim, ...rest } = it;
    return owner ? rest : { ...rest, claimedBy: claim ? claim.by : null };
  });
  return { id: list.id, name: list.name, birthday: list.birthday, emoji: list.emoji, owner, items };
}

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '5m' : 0 }));

async function load(req, res) {
  const list = await store.get(req.params.id);
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return null;
  }
  return list;
}

function isOwner(req, list) {
  const key = req.get('x-key') || '';
  return key.length > 0 && key.length === list.key.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(list.key));
}

async function loadOwned(req, res) {
  const list = await load(req, res);
  if (!list) return null;
  if (!isOwner(req, list)) {
    res.status(403).json({ error: "Only the list's owner can change that" });
    return null;
  }
  return list;
}

// One change at a time per list, so two quick pastes can't overwrite each other.
const locks = new Map();
function locked(id, fn) {
  const run = (locks.get(id) || Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  tail.then(() => locks.get(id) === tail && locks.delete(id));
  return run;
}

const wrap = (fn) => (req, res) =>
  (req.method === 'GET' || !req.params.id ? fn(req, res) : locked(req.params.id, () => fn(req, res))).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  });

app.post('/api/lists', wrap(async (req, res) => {
  const list = {
    id: rid(6),
    key: rid(18),
    name: str(req.body.name, 60) || 'My',
    birthday: /^\d{2}-\d{2}$/.test(req.body.birthday) ? req.body.birthday : null,
    emoji: str(req.body.emoji, 8) || '🎂',
    createdAt: Date.now(),
    items: [],
  };
  await store.put(list);
  res.json({ ...view(list, true), key: list.key });
}));

app.get('/api/lists/:id', wrap(async (req, res) => {
  const list = await load(req, res);
  if (list) res.json(view(list, isOwner(req, list)));
}));

app.patch('/api/lists/:id', wrap(async (req, res) => {
  const list = await loadOwned(req, res);
  if (!list) return;
  if ('name' in req.body) list.name = str(req.body.name, 60) || list.name;
  if ('birthday' in req.body) list.birthday = /^\d{2}-\d{2}$/.test(req.body.birthday) ? req.body.birthday : null;
  if ('emoji' in req.body) list.emoji = str(req.body.emoji, 8) || list.emoji;
  if (Array.isArray(req.body.order)) {
    const byId = new Map(list.items.map((i) => [i.id, i]));
    const ordered = req.body.order.map((id) => byId.get(id)).filter(Boolean);
    list.items = [...ordered, ...list.items.filter((i) => !ordered.includes(i))];
  }
  await store.put(list);
  res.json(view(list, true));
}));

// Add by link, or by name (searches Amazon). A name Amazon can't find still goes on the list, just without a picture.
app.post('/api/lists/:id/items', wrap(async (req, res) => {
  const list = await loadOwned(req, res);
  if (!list) return;
  if (list.items.length >= 300) return res.status(400).json({ error: 'That list is full (300 items)' });
  const text = str(req.body.url || req.body.name, 2000);
  let info;
  try {
    info = /https?:\/\//i.test(text) ? await scrape(text) : await findByName(text);
  } catch (e) {
    if (/https?:\/\//i.test(text) || !text) return res.status(400).json({ error: e.message });
    info = { url: 'https://www.amazon.com/s?k=' + encodeURIComponent(text), title: text, image: null, price: null, store: 'Amazon search' };
  }
  const item = { id: rid(6), ...info, note: str(req.body.note, 300), want: 2, addedAt: Date.now(), claim: null };
  list.items.unshift(item);
  await store.put(list);
  res.json(view(list, true));
}));

// "Not that one" — swap a searched item for the next Amazon result, keeping its note and hearts.
app.post('/api/lists/:id/items/:item/swap', wrap(async (req, res) => {
  const list = await loadOwned(req, res);
  if (!list) return;
  const it = list.items.find((i) => i.id === req.params.item);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  const q = it.search?.q || it.title;
  let info;
  try {
    info = await findByName(q, it.search ? it.search.i + 1 : 0);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  Object.assign(it, info);
  await store.put(list);
  res.json(view(list, true));
}));

app.patch('/api/lists/:id/items/:item', wrap(async (req, res) => {
  const list = await loadOwned(req, res);
  if (!list) return;
  const it = list.items.find((i) => i.id === req.params.item);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  if ('title' in req.body) it.title = str(req.body.title, 200) || it.title;
  if ('price' in req.body) it.price = str(req.body.price, 20) || null;
  if ('note' in req.body) it.note = str(req.body.note, 300);
  if ('want' in req.body) it.want = Math.min(3, Math.max(1, Number(req.body.want) || 2));
  await store.put(list);
  res.json(view(list, true));
}));

app.delete('/api/lists/:id/items/:item', wrap(async (req, res) => {
  const list = await loadOwned(req, res);
  if (!list) return;
  list.items = list.items.filter((i) => i.id !== req.params.item);
  await store.put(list);
  res.json(view(list, true));
}));

// Family/friends: "I'm getting this". The token lets the same person undo it later.
app.post('/api/lists/:id/items/:item/claim', wrap(async (req, res) => {
  const list = await load(req, res);
  if (!list) return;
  const it = list.items.find((i) => i.id === req.params.item);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  if (it.claim) return res.status(409).json({ error: `${it.claim.by} is already getting this` });
  const by = str(req.body.by, 40);
  if (!by) return res.status(400).json({ error: 'Add your name first' });
  it.claim = { by, token: rid(12), at: Date.now() };
  await store.put(list);
  res.json({ ...view(list, false), token: it.claim.token });
}));

app.delete('/api/lists/:id/items/:item/claim', wrap(async (req, res) => {
  const list = await load(req, res);
  if (!list) return;
  const it = list.items.find((i) => i.id === req.params.item);
  if (!it || !it.claim) return res.json(view(list, false));
  if (it.claim.token !== req.get('x-claim')) return res.status(403).json({ error: `Only ${it.claim.by} can undo that` });
  it.claim = null;
  await store.put(list);
  res.json(view(list, false));
}));

app.get('/l/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init().then(() => {
  app.listen(PORT, () => console.log(`Birthday List on http://localhost:${PORT} (${cfg ? 'postgres' : 'file'} storage)`));
});
