// Christmas List — two people add gifts with numbers, then reveal them by typing the number.
// Everything except the login screen needs one of the two codes. Codes come from CODE_A / CODE_B;
// locally they're generated into data/codes.json. In production the app won't start without them.
// Storage: Postgres when VCAP_SERVICES (Cloud Foundry) or DATABASE_URL is present, else data/*.json files.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4975;
const PROD = process.env.NODE_ENV === 'production';
const DATA = path.join(__dirname, 'data');
const WORDS = ['tinsel', 'reindeer', 'mitten', 'cocoa', 'sleigh', 'holly', 'snowman', 'garland', 'candy', 'cookie', 'jingle', 'evergreen', 'ribbon', 'lantern', 'chimney', 'nutmeg', 'pinecone', 'stocking', 'gingerbread', 'wreath'];

function newCode() {
  const w = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${w()}-${w()}-${crypto.randomInt(10000, 100000)}`;
}

function loadSecrets() {
  if (PROD) {
    const { CODE_A, CODE_B, SESSION_SECRET } = process.env;
    if (!CODE_A || !CODE_B || !SESSION_SECRET) {
      console.error('CODE_A, CODE_B and SESSION_SECRET must be set. Refusing to start.');
      process.exit(1);
    }
    return { a: CODE_A, b: CODE_B, secret: SESSION_SECRET };
  }
  const file = path.join(DATA, 'codes.json');
  fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ a: newCode(), b: newCode(), secret: crypto.randomBytes(32).toString('hex') }, null, 1), { mode: 0o600 });
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
const secrets = loadSecrets();

// The platform's Postgres refuses unencrypted connections and doesn't hand out a CA to verify against.
const PG_TLS = { rejectUnauthorized: false };

function pgConfig() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      for (const list of Object.values(vcap)) {
        for (const svc of list) {
          const c = svc.credentials || {};
          if (c.uri || c.url) return { connectionString: (c.uri || c.url).replace(/^jdbc:/, ''), ssl: PG_TLS };
          if (c.hostname || c.host || c.hosts)
            return { host: c.hostname || c.host || c.hosts[0], port: c.port || 5432, database: c.db || c.name || c.dbname || c.database || 'postgres', user: c.user || c.username, password: c.password, ssl: PG_TLS };
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
  const file = path.join(DATA, 'list.json');
  const photos = path.join(DATA, 'photos');
  fs.mkdirSync(photos, { recursive: true });
  return {
    async init() {},
    async load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(state) {
      fs.writeFileSync(file + '.tmp', JSON.stringify(state, null, 1));
      fs.renameSync(file + '.tmp', file);
    },
    async putPhoto(id, buf) {
      fs.writeFileSync(path.join(photos, id + '.jpg'), buf);
    },
    async getPhoto(id) {
      try {
        return fs.readFileSync(path.join(photos, id + '.jpg'));
      } catch {
        return null;
      }
    },
    async delPhoto(id) {
      fs.rmSync(path.join(photos, id + '.jpg'), { force: true });
    },
  };
}

function pgStore(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool({ ...cfg, max: 4 });
  return {
    async init() {
      await pool.query('CREATE TABLE IF NOT EXISTS cl_state (id INT PRIMARY KEY, data JSONB NOT NULL)');
      await pool.query('CREATE TABLE IF NOT EXISTS cl_photos (id TEXT PRIMARY KEY, data BYTEA NOT NULL)');
    },
    async load() {
      const r = await pool.query('SELECT data FROM cl_state WHERE id = 1');
      return r.rows[0]?.data || null;
    },
    async save(state) {
      await pool.query('INSERT INTO cl_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [state]);
    },
    async putPhoto(id, buf) {
      await pool.query('INSERT INTO cl_photos (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2', [id, buf]);
    },
    async getPhoto(id) {
      const r = await pool.query('SELECT data FROM cl_photos WHERE id = $1', [id]);
      return r.rows[0]?.data || null;
    },
    async delPhoto(id) {
      await pool.query('DELETE FROM cl_photos WHERE id = $1', [id]);
    },
  };
}

const cfg = pgConfig();
const store = cfg ? pgStore(cfg) : fileStore();

// ---------- sign-in ----------
const COOKIE = 'cl_session';
const SESSION_MS = 90 * 86400000;
const hmac = (s) => crypto.createHmac('sha256', secrets.secret).update(s).digest('base64url');
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const sameCode = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

function makeToken(uid) {
  const body = `${uid}.${Date.now() + SESSION_MS}`;
  return `${body}.${hmac(body)}`;
}

function readToken(req) {
  const m = (req.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [uid, exp, sig] = m[1].split('.');
  if (!uid || !exp || !sig) return null;
  const good = Buffer.from(hmac(`${uid}.${exp}`));
  const got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  if (Number(exp) < Date.now() || !['a', 'b'].includes(uid)) return null;
  return uid;
}

// Wrong codes lock that address out for a while, so a code can't be guessed by trying lots of them.
const fails = new Map();
const FAIL_LIMIT = 10;
const FAIL_WINDOW = 15 * 60000;
function clientIp(req) {
  return (req.get('x-forwarded-for') || '').split(',').pop().trim() || req.socket.remoteAddress || '?';
}
function lockedOut(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() > f.until) {
    fails.delete(ip);
    return false;
  }
  return f.n >= FAIL_LIMIT;
}
function noteFail(ip) {
  const f = fails.get(ip);
  if (f && Date.now() <= f.until) f.n++;
  else fails.set(ip, { n: 1, until: Date.now() + FAIL_WINDOW });
}

// ---------- list ----------
const rid = (n) => crypto.randomBytes(n).toString('base64url');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numberOf = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
};

let state = { users: { a: { name: '' }, b: { name: '' } }, items: [] };
const nextNumber = () => {
  const used = new Set(state.items.map((i) => i.number));
  let n = 1;
  while (used.has(n)) n++;
  return n;
};
// A hidden gift is only sent to the person who added it, until it's been opened in the reveal.
const canSee = (it, uid) => !it.hidden || it.addedBy === uid || it.opened;
const revealOn = () => (state.revealUntil || 0) > Date.now();
const revealInfo = () => ({ opened: state.items.filter((i) => i.opened).map((i) => i.number).sort((a, b) => a - b), total: state.items.length });
const publicState = (uid) => ({
  me: uid,
  users: state.users,
  items: state.items.filter((i) => canSee(i, uid)).sort((x, y) => x.number - y.number),
  next: nextNumber(),
  reveal: revealOn() ? revealInfo() : null,
});

// One change at a time, so the two of you can't overwrite each other.
let queue = Promise.resolve();
const locked = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};
const wrap = (fn) => (req, res) =>
  Promise.resolve()
    .then(() => (req.method === 'GET' ? fn(req, res) : locked(() => fn(req, res))))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "That didn't save. Try again." });
    });

const app = express();
app.set('trust proxy', false);
app.use(express.json({ limit: '3mb' }));
app.use((req, res, next) => {
  res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  next();
});

const sendPage = (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'public', 'index.html'));
app.get(['/', '/index.html'], sendPage);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '5m' : 0 }));

app.post('/api/login', (req, res) => {
  const ip = clientIp(req);
  if (lockedOut(ip)) return res.status(429).json({ error: 'Too many wrong codes. Wait 15 minutes and try again.' });
  const code = str(req.body?.code, 100).toLowerCase();
  const uid = sameCode(code, secrets.a.toLowerCase()) ? 'a' : sameCode(code, secrets.b.toLowerCase()) ? 'b' : null;
  if (!uid) {
    noteFail(ip);
    return res.status(401).json({ error: "That code doesn't match. Check it and try again." });
  }
  fails.delete(ip);
  res.cookie(COOKIE, makeToken(uid), { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: SESSION_MS, path: '/' });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Everything below this line needs a code.
const requireCode = (req, res, next) => {
  req.uid = readToken(req);
  if (!req.uid) return res.status(401).json({ error: 'Enter your code first.' });
  res.set('Cache-Control', 'no-store');
  next();
};
app.use('/api', requireCode);
app.use('/photo', requireCode);

const findItem = (req, res) => {
  const it = state.items.find((i) => i.id === req.params.id && canSee(i, req.uid));
  if (!it) res.status(404).json({ error: 'That gift is gone. It may have just been removed.' });
  return it;
};

function checkCode(req, res, uids) {
  const ip = clientIp(req);
  if (lockedOut(ip)) {
    res.status(429).json({ error: 'Too many wrong codes. Wait 15 minutes and try again.' });
    return false;
  }
  const code = str(req.body?.code, 100).toLowerCase();
  if (!uids.some((u) => sameCode(code, secrets[u].toLowerCase()))) {
    noteFail(ip);
    res.status(403).json({ error: "That code doesn't match. Check it and try again." });
    return false;
  }
  return true;
}

// Starting the reveal takes the other person's code, so nobody can type numbers to peek at hidden gifts.
const REVEAL_MS = 12 * 3600000;
app.post('/api/reveal/start', wrap(async (req, res) => {
  if (!checkCode(req, res, [req.uid === 'a' ? 'b' : 'a'])) return;
  state.revealUntil = Date.now() + REVEAL_MS;
  await store.save(state);
  res.json(publicState(req.uid));
}));

// Leaving the reveal takes either code, and turns the reveal back off.
app.post('/api/reveal/stop', wrap(async (req, res) => {
  if (!checkCode(req, res, ['a', 'b'])) return;
  state.revealUntil = 0;
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.get('/api/state', wrap(async (req, res) => res.json(publicState(req.uid))));

app.patch('/api/me', wrap(async (req, res) => {
  const name = str(req.body.name, 30);
  if (!name) return res.status(400).json({ error: 'Add your name.' });
  state.users[req.uid].name = name;
  await store.save(state);
  res.json(publicState(req.uid));
}));

function readItem(body, uid, it) {
  const name = str(body.name, 120);
  if (!name) return { error: 'Add what the gift is.' };
  const person = str(body.person, 40);
  if (!person) return { error: 'Add who the gift is for.' };
  const number = numberOf(body.number);
  if (number === null) return { error: 'Gift numbers go from 1 to 9999.' };
  const clash = state.items.find((i) => i.number === number && i !== it);
  if (clash) return { error: canSee(clash, uid) ? `Number ${number} is already on "${clash.name}". Pick another number.` : `Number ${number} is already taken. Pick another number.` };
  return { name, person, number, note: str(body.note, 200) };
}

app.post('/api/items', wrap(async (req, res) => {
  if (state.items.length >= 500) return res.status(400).json({ error: 'The list is full at 500 gifts.' });
  const fields = readItem(req.body, req.uid);
  if (fields.error) return res.status(400).json(fields);
  const item = { id: rid(6), ...fields, hidden: req.body.hidden !== false, photo: null, opened: false, addedBy: req.uid, addedAt: Date.now() };
  state.items.push(item);
  await store.save(state);
  res.json({ ...publicState(req.uid), id: item.id });
}));

app.patch('/api/items/:id', wrap(async (req, res) => {
  const it = findItem(req, res);
  if (!it) return;
  const fields = readItem(req.body, req.uid, it);
  if (fields.error) return res.status(400).json(fields);
  Object.assign(it, fields);
  if (it.addedBy === req.uid && 'hidden' in req.body) it.hidden = !!req.body.hidden;
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.delete('/api/items/:id', wrap(async (req, res) => {
  const it = findItem(req, res);
  if (!it) return;
  state.items = state.items.filter((i) => i !== it);
  await store.save(state);
  if (it.photo) await store.delPhoto(it.photo);
  res.json(publicState(req.uid));
}));

app.post('/api/items/:id/photo', wrap(async (req, res) => {
  const it = findItem(req, res);
  if (!it) return;
  const m = String(req.body.data || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  const buf = m && Buffer.from(m[1], 'base64');
  if (!buf || buf.length < 100 || buf.length > 1_500_000 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: "That picture can't be used. Try a different one." });
  const old = it.photo;
  it.photo = rid(9);
  await store.putPhoto(it.photo, buf);
  await store.save(state);
  if (old) await store.delPhoto(old);
  res.json(publicState(req.uid));
}));

app.delete('/api/items/:id/photo', wrap(async (req, res) => {
  const it = findItem(req, res);
  if (!it) return;
  const old = it.photo;
  it.photo = null;
  await store.save(state);
  if (old) await store.delPhoto(old);
  res.json(publicState(req.uid));
}));

// Type a number on the reveal screen: returns that one gift and marks it opened.
app.post('/api/reveal', wrap(async (req, res) => {
  if (!revealOn()) return res.status(403).json({ error: 'Start the reveal first.' });
  const number = numberOf(req.body.number);
  const it = number && state.items.find((i) => i.number === number);
  if (!it) return res.status(404).json({ error: `There's no gift number ${req.body.number}.` });
  if (!it.opened) {
    it.opened = true;
    await store.save(state);
  }
  res.json({ item: it, ...revealInfo() });
}));

app.post('/api/reveal/reset', wrap(async (req, res) => {
  state.items.forEach((i) => (i.opened = false));
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.get('/photo/:pid.jpg', wrap(async (req, res) => {
  const owner = state.items.find((i) => i.photo === req.params.pid);
  const buf = owner && canSee(owner, req.uid) && (await store.getPhoto(req.params.pid));
  if (!buf) return res.status(404).end();
  res.set('Cache-Control', 'private, no-cache').type('jpeg').send(buf);
}));

store
  .init()
  .then(() => store.load())
  .then((saved) => {
    if (saved) state = saved;
    app.listen(PORT, () => {
      console.log(`Christmas List on http://localhost:${PORT} (${cfg ? 'postgres' : 'file'} storage)`);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
