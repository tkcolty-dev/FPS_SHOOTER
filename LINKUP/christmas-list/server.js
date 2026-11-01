// Christmas List — two people add gifts with numbers, then reveal them by typing the number.
// Each person creates their account once with a one-time code, then signs in with name and password.
// Everything except the sign-in screen needs an account. Codes come from CODE_A / CODE_B; locally
// they're generated into data/codes.json. In production the app won't start without them.
// Forgot a password? Set a new CODE_A or CODE_B and restart: the new code can set a new password.
// Storage: Postgres when VCAP_SERVICES (Cloud Foundry) or DATABASE_URL is present, else data/*.json files.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { scrape, searchResults } = require('./scrape');

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
// Spaces, capitals and stray punctuation in a typed code don't matter.
const cleanCode = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sameCode = (a, b) => crypto.timingSafeEqual(sha(cleanCode(a)), sha(cleanCode(b)));
const codeId = (code) => sha(cleanCode(code)).toString('hex');

const scrypt = (password, salt) =>
  new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => (e ? reject(e) : resolve(key))));
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scrypt(password, salt)).toString('hex') };
}
async function passwordMatches(user, password) {
  // Someone with no account yet still costs the same time, so a guess can't tell if a name exists.
  const pass = user?.pass || { salt: 'none', hash: '0'.repeat(128) };
  const key = await scrypt(String(password || '').slice(0, 200), pass.salt);
  return crypto.timingSafeEqual(key, Buffer.from(pass.hash, 'hex')) && !!user?.pass;
}

function makeToken(uid) {
  const body = `${uid}.${state.users[uid].gen || 0}.${Date.now() + SESSION_MS}`;
  return `${body}.${hmac(body)}`;
}

function readToken(req) {
  const m = (req.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [uid, gen, exp, sig] = m[1].split('.');
  if (!uid || !gen || !exp || !sig) return null;
  const good = Buffer.from(hmac(`${uid}.${gen}.${exp}`));
  const got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return null;
  if (Number(exp) < Date.now() || !['a', 'b'].includes(uid)) return null;
  // A new password signs out every older session.
  if (!state.users[uid].pass || Number(gen) !== (state.users[uid].gen || 0)) return null;
  return uid;
}

// Wrong codes and passwords lock that address out for a while, so they can't be guessed by trying lots.
const fails = new Map();
const FAIL_LIMIT = 20;
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

let state = { users: { a: { name: '' }, b: { name: '' } }, items: [], people: [], numbersUsed: [] };
const samePerson = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const MIN_NUMBER = 100;
const MAX_NUMBER = 999;
// A random three-digit number that has never been given out, even to a gift that's since been removed.
function randomNumber() {
  const used = new Set([...state.numbersUsed, ...state.items.map((i) => i.number)]);
  const free = [];
  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) if (!used.has(n)) free.push(n);
  return free.length ? free[crypto.randomInt(free.length)] : null;
}
function addPerson(name) {
  const found = state.people.find((p) => samePerson(p.name, name));
  if (found) return found;
  const person = { id: rid(6), name };
  state.people.push(person);
  state.people.sort((x, y) => x.name.localeCompare(y.name));
  return person;
}
// A hidden gift is only sent to the person who added it, until it's been opened in the reveal.
const canSee = (it, uid) => !it.hidden || it.addedBy === uid || it.opened;
const revealOn = () => (state.revealUntil || 0) > Date.now();
const revealInfo = () => ({ opened: state.items.filter((i) => i.opened).map((i) => i.number).sort((a, b) => a - b), total: state.items.length });
const publicState = (uid) => ({
  me: uid,
  users: { a: { name: state.users.a.name }, b: { name: state.users.b.name } },
  items: state.items.filter((i) => canSee(i, uid)).sort((x, y) => x.number - y.number),
  people: state.people,
  reveal: revealOn() ? revealInfo() : null,
});

function useSaved(saved) {
  if (saved) state = { numbersUsed: [], ...saved, people: (saved.people || []).map(({ id, name }) => ({ id, name })) };
  state.items.forEach((i) => {
    addPerson(i.person);
    if (!state.numbersUsed.includes(i.number)) state.numbersUsed.push(i.number);
  });
}

// One change at a time, so the two of you can't overwrite each other. Each change starts from the
// saved list, because during a deploy the old and new copies of the app run side by side.
let queue = Promise.resolve();
const locked = (fn) => {
  const step = async () => {
    useSaved(await store.load());
    return fn();
  };
  const run = queue.then(step, step);
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

const lockMessage = 'Too many wrong tries. Wait 15 minutes and try again.';
const setSession = (res, uid) => res.cookie(COOKIE, makeToken(uid), { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: SESSION_MS, path: '/' });
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 200;

// First time only: the one-time code creates the account, then stops working.
app.post('/api/register', wrap(async (req, res) => {
  const ip = clientIp(req);
  if (lockedOut(ip)) return res.status(429).json({ error: lockMessage });
  const code = str(req.body?.code, 100);
  const uid = sameCode(code, secrets.a) ? 'a' : sameCode(code, secrets.b) ? 'b' : null;
  if (!uid) {
    noteFail(ip);
    return res.status(403).json({ error: "That code doesn't match. Check it and try again." });
  }
  const user = state.users[uid];
  if (user.codeUsed === codeId(code)) return res.status(403).json({ error: 'That code has already been used. Sign in with your name and password.' });
  const name = str(req.body.name, 30);
  if (!name) return res.status(400).json({ error: 'Add your name.' });
  const other = state.users[uid === 'a' ? 'b' : 'a'];
  if (other.name && other.name.toLowerCase() === name.toLowerCase()) return res.status(400).json({ error: 'That name is taken. Try a different one.' });
  if (!validPassword(req.body.password)) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  user.name = name;
  user.pass = await hashPassword(req.body.password);
  user.codeUsed = codeId(code);
  user.gen = (user.gen || 0) + 1;
  await store.save(state);
  fails.delete(ip);
  setSession(res, uid);
  res.json({ ok: true });
}));

app.post('/api/login', wrap(async (req, res) => {
  const ip = clientIp(req);
  if (lockedOut(ip)) return res.status(429).json({ error: lockMessage });
  const name = str(req.body?.name, 30).toLowerCase();
  const uid = ['a', 'b'].find((u) => state.users[u].name && state.users[u].name.toLowerCase() === name);
  if (!(await passwordMatches(uid && state.users[uid], req.body?.password))) {
    noteFail(ip);
    return res.status(401).json({ error: "That name and password don't match. Check them and try again." });
  }
  fails.delete(ip);
  setSession(res, uid);
  res.json({ ok: true });
}));

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Everything below this line needs an account.
const requireCode = (req, res, next) => {
  req.uid = readToken(req);
  if (!req.uid) return res.status(401).json({ error: 'Sign in first.' });
  res.set('Cache-Control', 'no-store');
  next();
};
app.use('/api', requireCode);
app.use('/photo', requireCode);

// Amazon lookups can take a few seconds, so they run outside the one-change-at-a-time queue.
app.get('/api/amazon/search', async (req, res) => {
  const q = str(req.query.q, 150);
  if (!q) return res.json({ results: [] });
  try {
    res.json({ results: await searchResults(q) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/amazon/link', async (req, res) => {
  const link = (str(req.body.url, 2000).match(/https?:\/\/\S+/i) || [])[0] || '';
  let host = '';
  try {
    host = new URL(link).hostname;
  } catch {}
  if (!AMAZON_HOST.test(host) && !/^(a\.co|amzn\.to|amzn\.com|amzn\.eu)$/i.test(host)) return res.status(400).json({ error: 'That link is not from Amazon. Paste an Amazon link or type a name.' });
  try {
    const out = await scrape(link);
    if (out.store !== 'Amazon') return res.status(400).json({ error: 'That link is not from Amazon. Paste an Amazon link or type a name.' });
    res.json({ results: [out] });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Keep our own copy of the Amazon picture, behind the same codes as every other picture.
async function fetchAmazonImage(v) {
  const image = str(v, 300);
  if (!/^https:\/\/m\.media-amazon\.com\/images\/I\/[\w.,%+-]+\.jpg$/.test(image)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(image, { signal: ctrl.signal, redirect: 'error' });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 100 && buf.length <= 5_000_000 && buf[0] === 0xff && buf[1] === 0xd8 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const findItem = (req, res) => {
  const it = state.items.find((i) => i.id === req.params.id && canSee(i, req.uid));
  if (!it) res.status(404).json({ error: 'That gift is gone. It may have just been removed.' });
  return it;
};

async function checkPassword(req, res, uids) {
  const ip = clientIp(req);
  if (lockedOut(ip)) {
    res.status(429).json({ error: lockMessage });
    return false;
  }
  for (const u of uids) if (await passwordMatches(state.users[u], req.body?.password)) return true;
  noteFail(ip);
  res.status(403).json({ error: "That password doesn't match. Check it and try again." });
  return false;
}

// Starting the reveal takes the other person's password, so nobody can type numbers to peek at hidden gifts.
const REVEAL_MS = 12 * 3600000;
app.post('/api/reveal/start', wrap(async (req, res) => {
  const other = req.uid === 'a' ? 'b' : 'a';
  if (!state.users[other].pass) return res.status(400).json({ error: 'The other person needs to create their account first.' });
  if (!(await checkPassword(req, res, [other]))) return;
  state.revealUntil = Date.now() + REVEAL_MS;
  await store.save(state);
  res.json(publicState(req.uid));
}));

// Leaving the reveal takes either password, and turns the reveal back off.
app.post('/api/reveal/stop', wrap(async (req, res) => {
  if (!(await checkPassword(req, res, ['a', 'b']))) return;
  state.revealUntil = 0;
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.post('/api/me/password', wrap(async (req, res) => {
  if (!(await checkPassword(req, res, [req.uid]))) return;
  if (!validPassword(req.body.next)) return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
  const user = state.users[req.uid];
  user.pass = await hashPassword(req.body.next);
  user.gen = (user.gen || 0) + 1;
  await store.save(state);
  setSession(res, req.uid);
  res.json({ ok: true });
}));

app.get('/api/state', wrap(async (req, res) => res.json(publicState(req.uid))));

app.patch('/api/me', wrap(async (req, res) => {
  const name = str(req.body.name, 30);
  if (!name) return res.status(400).json({ error: 'Add your name.' });
  const other = state.users[req.uid === 'a' ? 'b' : 'a'];
  if (other.name && other.name.toLowerCase() === name.toLowerCase()) return res.status(400).json({ error: 'That name is taken. Try a different one.' });
  state.users[req.uid].name = name;
  await store.save(state);
  res.json(publicState(req.uid));
}));

const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;
function amazonUrl(v) {
  try {
    const u = new URL(str(v, 500));
    return u.protocol === 'https:' && AMAZON_HOST.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

function readItem(body, uid, it) {
  const name = str(body.name, 120);
  if (!name) return { error: 'Add what the gift is.' };
  const person = str(body.person, 40);
  if (!person) return { error: 'Add who the gift is for.' };
  const fields = { name, person, note: str(body.note, 200) };
  if ('url' in body) {
    fields.url = amazonUrl(body.url);
    fields.price = fields.url ? str(body.price, 20) || null : null;
  }
  return fields;
}

app.post('/api/items', wrap(async (req, res) => {
  if (state.items.length >= 500) return res.status(400).json({ error: 'The list is full at 500 gifts.' });
  const fields = readItem(req.body, req.uid);
  if (fields.error) return res.status(400).json(fields);
  const number = randomNumber();
  if (number === null) return res.status(400).json({ error: 'Every three-digit number has been used.' });
  fields.person = addPerson(fields.person).name;
  state.numbersUsed.push(number);
  const item = { id: rid(6), ...fields, number, hidden: req.body.hidden === true, photo: null, opened: false, addedBy: req.uid, addedAt: Date.now() };
  state.items.push(item);
  await store.save(state);
  res.json({ ...publicState(req.uid), id: item.id });
}));

app.patch('/api/items/:id', wrap(async (req, res) => {
  const it = findItem(req, res);
  if (!it) return;
  const fields = readItem(req.body, req.uid, it);
  if (fields.error) return res.status(400).json(fields);
  fields.person = addPerson(fields.person).name;
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

app.post('/api/items/:id/amazon-image', async (req, res) => {
  try {
    const buf = await fetchAmazonImage(req.body.image);
    if (!buf) return res.status(502).json({ error: "Amazon's picture didn't load." });
    await locked(async () => {
      const it = findItem(req, res);
      if (!it) return;
      const old = it.photo;
      it.photo = rid(9);
      await store.putPhoto(it.photo, buf);
      await store.save(state);
      if (old) await store.delPhoto(old);
      res.json(publicState(req.uid));
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "That didn't save. Try again." });
  }
});

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
// The Find page. Before the reveal a hidden gift only says who it's for, not what it is.
app.post('/api/find', wrap(async (req, res) => {
  const number = numberOf(req.body.number);
  if (number === null) return res.status(400).json({ error: 'Type the number written on the present.' });
  const it = state.items.find((i) => i.number === number);
  if (!it) return res.status(404).json({ error: `There's no gift number ${number}.` });
  if (revealOn()) {
    const first = !it.opened;
    if (first) {
      it.opened = true;
      await store.save(state);
    }
    return res.json({ item: it, first, reveal: revealInfo() });
  }
  if (!canSee(it, req.uid)) return res.json({ hiddenFor: it.person, number });
  res.json({ item: it });
}));

// The people gifts can be for. Adding several names at once is the normal way to start.
app.post('/api/people', wrap(async (req, res) => {
  const names = (Array.isArray(req.body.names) ? req.body.names : []).map((n) => str(n, 40)).filter(Boolean);
  if (!names.length) return res.status(400).json({ error: 'Add at least one name.' });
  if (state.people.length + names.length > 200) return res.status(400).json({ error: 'The list is full at 200 people.' });
  names.forEach(addPerson);
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.patch('/api/people/:id', wrap(async (req, res) => {
  const p = state.people.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'That person is gone. They may have just been removed.' });
  const name = str(req.body.name, 40);
  if (!name) return res.status(400).json({ error: 'Add a name.' });
  if (state.people.some((x) => x !== p && samePerson(x.name, name))) return res.status(400).json({ error: `${name} is already on the list.` });
  // Gifts follow a new name, including hidden ones.
  state.items.forEach((i) => {
    if (samePerson(i.person, p.name)) i.person = name;
  });
  p.name = name;
  state.people.sort((x, y) => x.name.localeCompare(y.name));
  await store.save(state);
  res.json(publicState(req.uid));
}));

app.delete('/api/people/:id', wrap(async (req, res) => {
  const p = state.people.find((x) => x.id === req.params.id);
  // Counts hidden gifts too: removing the name would strand them, and it would only come back anyway.
  if (p && state.items.some((i) => samePerson(i.person, p.name))) return res.status(400).json({ error: `${p.name} still has gifts. Move or remove them first.` });
  state.people = state.people.filter((x) => x !== p);
  await store.save(state);
  res.json(publicState(req.uid));
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
    useSaved(saved);
    app.listen(PORT, () => {
      console.log(`Christmas List on http://localhost:${PORT} (${cfg ? 'postgres' : 'file'} storage)`);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
