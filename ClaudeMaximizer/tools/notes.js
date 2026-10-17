#!/usr/bin/env node
// Claude's side of the notes.  node tools/notes.js            → open notes for the game (all games if several)
//                               node tools/notes.js done 3 "made bats slower"   → close note 3 with a reply the player sees
//                               node tools/notes.js reply 3 "which bat?"        → reply without closing
//                               node tools/notes.js all | json                  → everything, or raw JSON
//                               node tools/notes.js new "Space Dogs"            → make a new game from the template
// Add --project <id> when more than one game exists.
const fs = require('fs'), path = require('path');
const lib = require('./notes-lib');
const args = process.argv.slice(2); const flag = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v === undefined ? true : v; };
let pidFlag = flag('project', null);
const projects = fs.existsSync(lib.PROJECTS) ? fs.readdirSync(lib.PROJECTS).filter(d => fs.existsSync(path.join(lib.PROJECTS, d, 'game.json'))) : [];
const cmd = args[0] || 'open';

if (cmd === 'new') {
  const name = args[1]; if (!name) die('Give the game a name: node tools/notes.js new "Space Dogs"');
  const id = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const dir = path.join(lib.PROJECTS, id); if (fs.existsSync(dir)) die(`projects/${id} already exists`);
  fs.cpSync(path.join(__dirname, '..', 'templates', 'blank-2d'), dir, { recursive: true });
  const g = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8')); g.name = name; fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(g, null, 2));
  console.log(`Made projects/${id}. Open http://localhost:4990/?p=${id}`); process.exit(0);
}
function pickProject() {
  if (pidFlag) { if (!projects.includes(pidFlag)) die(`No game "${pidFlag}". Games: ${projects.join(', ')}`); return [pidFlag]; }
  if (!projects.length) die('No games yet. Make one: node tools/notes.js new "Name"');
  return projects;
}
function die(msg) { console.error(msg); process.exit(1); }

if (cmd === 'done' || cmd === 'reply') {
  const id = +args[1]; const msg = args.slice(2).join(' '); if (!id) die(`Usage: node tools/notes.js ${cmd} <id> "message"`);
  const pids = pickProject(); const owner = pids.find(p => lib.load(p).notes.some(n => n.id === id)); if (!owner) die(`No note ${id}${pids.length > 1 ? ' in any game' : ''}.`);
  if (pids.length > 1 && !pidFlag) { const dup = pids.filter(p => lib.load(p).notes.some(n => n.id === id)); if (dup.length > 1) die(`Note ${id} exists in ${dup.join(' and ')}. Add --project <id>.`); }
  const n = lib.update(owner, id, cmd === 'done' ? { status: 'done', reply: msg || 'Done.' } : { reply: msg });
  console.log(`${cmd === 'done' ? 'Closed' : 'Replied to'} note ${id} in ${owner}: ${n.reply}`); process.exit(0);
}
const pids = pickProject();
for (const pid of pids) {
  const data = lib.load(pid); const open = data.notes.filter(n => n.status === 'open');
  if (cmd === 'json') { console.log(JSON.stringify({ project: pid, notes: cmd === 'all' ? data.notes : open }, null, 2)); continue; }
  if (cmd === 'all') { console.log(lib.toMarkdown(pid, data)); continue; }
  if (pids.length > 1) console.log(`# ${pid}: ${open.length} open note${open.length === 1 ? '' : 's'}\n`);
  if (!open.length) { console.log(pids.length > 1 ? '' : `No open notes for ${pid}.`); continue; }
  for (const n of open) console.log(lib.noteMd(n) + '\n');
}
