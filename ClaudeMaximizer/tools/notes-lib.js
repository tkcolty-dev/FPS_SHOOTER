// Notes storage shared by the server and the CLI: projects/<id>/notes.json is the truth,
// projects/<id>/NOTES.md is the readable copy Claude works from, notes/<n>.png are the crops.
const fs = require('fs'), path = require('path');
const PROJECTS = path.join(__dirname, '..', 'projects');
const file = pid => path.join(PROJECTS, pid, 'notes.json');

function load(pid) { try { return JSON.parse(fs.readFileSync(file(pid), 'utf8')); } catch { return { notes: [] }; } }
function save(pid, data) { fs.writeFileSync(file(pid), JSON.stringify(data, null, 2)); fs.writeFileSync(path.join(PROJECTS, pid, 'NOTES.md'), toMarkdown(pid, data)); }
function gameName(pid) { try { return JSON.parse(fs.readFileSync(path.join(PROJECTS, pid, 'game.json'), 'utf8')).name || pid; } catch { return pid; } }

function add(pid, note) {
  const data = load(pid); const id = data.notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const n = { id, created: Date.now(), status: 'open', kind: note.kind || 'entity', text: String(note.text || '').slice(0, 2000), scene: note.scene || null, time: note.time || 0,
    target: note.target || null, allOfType: !!note.allOfType, spot: note.spot || null, rect: note.rect || null, items: note.items || null, tweaks: note.tweaks || null, error: note.error || null, context: note.context || null, reply: null, doneAt: null };
  if (note.image && /^data:image\/png;base64,/.test(note.image)) {
    const dir = path.join(PROJECTS, pid, 'notes'); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + '.png'), Buffer.from(note.image.split(',')[1], 'base64')); n.image = `notes/${id}.png`;
  }
  data.notes.push(n); save(pid, data); return n;
}
function update(pid, id, changes) {
  const data = load(pid); const n = data.notes.find(x => x.id === id); if (!n) return null;
  if (changes.status) { n.status = changes.status === 'done' ? 'done' : 'open'; n.doneAt = n.status === 'done' ? Date.now() : null; }
  if (changes.reply != null) n.reply = String(changes.reply).slice(0, 2000);
  if (changes.text != null) n.text = String(changes.text).slice(0, 2000);
  save(pid, data); return n;
}
function remove(pid, id) { const data = load(pid); data.notes = data.notes.filter(n => n.id !== id); try { fs.unlinkSync(path.join(PROJECTS, pid, 'notes', id + '.png')); } catch {} save(pid, data); }

const fmt = v => typeof v === 'number' ? Math.round(v * 10) / 10 : v == null ? '–' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const propsLine = p => Object.entries(p || {}).map(([k, v]) => `${k} ${fmt(v)}`).join(', ') || 'none';
function thingLine(t) { if (!t) return ''; return `${t.id}${t.name ? ' "' + t.name + '"' : ''} at x ${fmt(t.x)}, y ${fmt(t.y)}${t.z != null ? ', z ' + fmt(t.z) : ''}` + (t.vx != null ? ` moving vx ${fmt(t.vx)}, vy ${fmt(t.vy)}${t.vz != null ? ', vz ' + fmt(t.vz) : ''}` : '') + (t.w != null ? ` · size ${fmt(t.w)}×${fmt(t.h)}${t.d != null ? '×' + fmt(t.d) : ''}` : '') + (t.grounded != null ? (t.grounded ? ' · on the ground' : ' · in the air') : '') + ` · props: ${propsLine(t.props)}` + (t.error ? ` · ERROR: ${t.error}` : ''); }

function noteMd(n) {
  const lines = [];
  const head = n.kind === 'global' ? 'The whole game' : n.kind === 'bug' ? 'A crash' : n.target ? `${n.target.id}${n.target.name ? ' "' + n.target.name + '"' : ''}${n.allOfType ? ` — applies to EVERY ${n.target.type}` : ` (one ${n.target.type})`}` : n.rect ? `An area with ${(n.items || []).length} thing${(n.items || []).length === 1 ? '' : 's'} in it` : n.spot ? `A spot` : n.kind;
  lines.push(`## Note ${n.id} — ${head}${n.status === 'done' ? ' — DONE' : ''}`);
  if (n.text) lines.push(`> ${n.text.replace(/\n/g, '\n> ')}`);
  if (n.tweaks && n.tweaks.length) { lines.push(`- Tweaked live in the game (make these permanent in the code): ${n.tweaks.map(t => `**${t.key}** ${fmt(t.from)} → ${fmt(t.to)}${t.all ? ' for every ' + (t.type || n.target.type) : ''}`).join('; ')}`); }
  if (n.target) { lines.push(`- Code: ${n.target.src || '(unknown file)'} — type \`${n.target.type}\`${n.target.sprite ? `, sprite \`${n.target.sprite}\`` : ''}${n.target.model ? `, model \`${n.target.model}\`` : ''}${n.target.tags && n.target.tags.length ? `, tags ${n.target.tags.join(', ')}` : ''}`); lines.push(`- That thing when noted: ${thingLine(n.target)}`); }
  if (n.spot) lines.push(`- Spot: ${n.spot.space === 'screen' ? 'screen' : 'world'} ${fmt(n.spot.x)}, ${fmt(n.spot.y)}${n.spot.z != null ? ', ' + fmt(n.spot.z) : ''}${n.spot.tile ? ` · tile column ${n.spot.tile.tx}, row ${n.spot.tile.ty}${n.spot.tile.ch ? ` is "${n.spot.tile.ch}"` : ' (empty)'}${n.spot.tile.src ? ' in ' + n.spot.tile.src : ''}` : ''}`);
  if (n.rect) lines.push(`- Area: top-left corner at ${n.rect.z != null ? 'ground point ' : ''}${fmt(n.rect.x)}, ${fmt(n.rect.y)}${n.rect.z != null ? ', ' + fmt(n.rect.z) : ''}, ${fmt(n.rect.w)}×${fmt(n.rect.h)} ${n.rect.z != null ? 'screen pixels' : 'px'}${n.items && n.items.length ? ` · inside: ${n.items.map(t => t.id).join(', ')}` : ' · nothing inside'}`);
  if (n.items && n.items.length) for (const t of n.items.slice(0, 8)) lines.push(`  - ${thingLine(t)} (${t.src || ''})`);
  if (n.error) { lines.push(`- Error: ${n.error.text}${n.error.entity ? ` (entity ${n.error.entity})` : ''}`); if (n.error.stack) lines.push('  ```\n  ' + String(n.error.stack).split('\n').slice(0, 6).join('\n  ') + '\n  ```'); }
  const c = n.context || {};
  lines.push(`- When: scene \`${n.scene || c.scene || '?'}\`${c.sceneSrc ? ' (' + c.sceneSrc + ')' : ''} at ${fmt(n.time)} s${c.paused ? ', paused' : ''}${c.speed && c.speed !== 1 ? ', slow motion' : ''}${c.fps ? `, ${c.fps} fps` : ''}${c.counts ? ` · on screen: ${Object.entries(c.counts).map(([k, v]) => `${v} ${k}`).join(', ')}` : ''}`);
  if (c.player && !(n.target && n.target.id === c.player.id)) lines.push(`- Player then: ${thingLine(c.player)}`);
  if (c.data && Object.keys(c.data).length) lines.push(`- Scene data: ${propsLine(c.data)}`);
  if (c.recentLog && c.recentLog.length) lines.push(`- Recent log: ${c.recentLog.slice(-5).join(' | ')}`);
  if (n.image) lines.push(`- Picture: ${n.image}`);
  if (n.reply) lines.push(`- Claude replied: ${n.reply}`);
  return lines.join('\n');
}
function toMarkdown(pid, data) {
  const open = data.notes.filter(n => n.status === 'open'), done = data.notes.filter(n => n.status !== 'open');
  const out = [`# Playtest notes — ${gameName(pid)}`, '', `${open.length} open. Colton leaves these while playing; each one points at the exact thing and code line. After fixing one, run:`, '', '```', `node tools/notes.js done <id> "what you changed" --project ${pid}`, '```', ''];
  if (!open.length) out.push('_No open notes right now._', '');
  for (const n of open) out.push(noteMd(n), '');
  if (done.length) { out.push('---', '', `### Done (${done.length})`, ''); for (const n of done.slice(-15).reverse()) out.push(`- Note ${n.id}: ${n.text || '(tweaks)'}${n.reply ? ' — ' + n.reply : ''}`); out.push(''); }
  return out.join('\n');
}
module.exports = { load, save, add, update, remove, toMarkdown, noteMd, PROJECTS };
