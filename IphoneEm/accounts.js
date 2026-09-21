// Real accounts and real messages, stored in one JSON file next to the server.
// No fake people: your contacts are the other accounts on this phone's server, and texts actually travel between them.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'data', 'store.json');
let db = { users: [], msgs: [], seq: 0 };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch {}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, FILE);
    } catch (e) { console.error('[accounts] save failed', e.message); }
  }, 150);
}

const norm = (h) => String(h || '').trim().toLowerCase().replace(/^@/, '');
const hash = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
const pub = (u) => ({ id: u.id, handle: u.handle, name: u.name, emoji: u.emoji || '', color: u.color || '#8E8E93', created: u.created });
const byToken = (t) => (t ? db.users.find((u) => u.tokens && u.tokens.includes(t)) : null);
const byHandle = (h) => db.users.find((u) => u.handle === norm(h));
const COLORS = ['#FF9500', '#34C759', '#5856D6', '#FF2D55', '#30B0C7', '#AF52DE', '#FF3B30', '#007AFF', '#A2845E', '#00C7BE'];

function signup({ handle, name, pass, emoji }) {
  handle = norm(handle);
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) throw new Error('Pick a username of 3–20 letters, numbers, dots or underscores.');
  if (byHandle(handle)) throw new Error('That username is taken.');
  if (String(pass || '').length < 4) throw new Error('Your passcode needs at least 4 characters.');
  name = String(name || '').trim().slice(0, 30) || handle;
  const salt = crypto.randomBytes(12).toString('hex');
  const u = { id: crypto.randomUUID(), handle, name, emoji: String(emoji || '').slice(0, 4), color: COLORS[db.users.length % COLORS.length], salt, pass: hash(pass, salt), created: Date.now(), tokens: [] };
  db.users.push(u); save();
  return login({ handle, pass });
}
function login({ handle, pass }) {
  const u = byHandle(handle);
  if (!u) throw new Error('No account with that username.');
  if (hash(pass, u.salt) !== u.pass) throw new Error('Wrong passcode.');
  const token = crypto.randomBytes(24).toString('hex');
  u.tokens = (u.tokens || []).slice(-4).concat([token]); save();
  return { token, user: pub(u) };
}
function me(token) { const u = byToken(token); if (!u) throw new Error('Signed out'); return pub(u); }
function updateMe(token, patch) {
  const u = byToken(token); if (!u) throw new Error('Signed out');
  if (patch.name != null) u.name = String(patch.name).trim().slice(0, 30) || u.handle;
  if (patch.emoji != null) u.emoji = String(patch.emoji).slice(0, 4);
  if (patch.color != null && /^#[0-9a-f]{6}$/i.test(patch.color)) u.color = patch.color;
  save(); return pub(u);
}
function directory(token) {
  const u = byToken(token); if (!u) throw new Error('Signed out');
  return db.users.filter((x) => x.id !== u.id).map(pub).sort((a, b) => a.name.localeCompare(b.name));
}
function send(token, { to, text }) {
  const u = byToken(token); if (!u) throw new Error('Signed out');
  const other = db.users.find((x) => x.id === to) || byHandle(to);
  if (!other) throw new Error('No such person.');
  text = String(text || '').slice(0, 4000);
  if (!text.trim()) throw new Error('Empty message.');
  const m = { id: crypto.randomUUID(), n: ++db.seq, from: u.id, to: other.id, text, t: Date.now() };
  db.msgs.push(m);
  if (db.msgs.length > 20000) db.msgs.splice(0, db.msgs.length - 20000);
  save();
  return m;
}
function inbox(token, since) {
  const u = byToken(token); if (!u) throw new Error('Signed out');
  since = Number(since) || 0;
  const mine = db.msgs.filter((m) => (m.from === u.id || m.to === u.id) && m.n > since);
  return { msgs: mine.slice(-500), seq: db.seq, people: directory(token) };
}
function markRead(token, otherId) {
  const u = byToken(token); if (!u) throw new Error('Signed out');
  db.msgs.forEach((m) => { if (m.to === u.id && m.from === otherId) m.read = true; });
  save(); return { ok: true };
}
function logout(token) { const u = byToken(token); if (u) { u.tokens = (u.tokens || []).filter((t) => t !== token); save(); } return { ok: true }; }
function stats() { return { users: db.users.length, msgs: db.msgs.length }; }

module.exports = { signup, login, me, updateMe, directory, send, inbox, markRead, logout, stats };
