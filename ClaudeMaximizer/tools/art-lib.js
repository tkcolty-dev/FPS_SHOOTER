// Writes art back into game code: a sprite/model definition is replaced in place (or appended), and the
// text rows of a level are swapped where they sit in the scene file.
const fs = require('fs'), path = require('path');
const PROJECTS = path.join(__dirname, '..', 'projects');

// index just past the matching ')' of the call that opens at `open` (index of '('), honoring strings and comments
function matchCall(src, open) {
  let depth = 0, i = open, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; if (i < 1) return -1; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
function spriteCode(d) {
  const frames = (d.frames || []).map(f => f.map(r => '      ' + q(r)).join(',\n'));
  const pal = d.palette && Object.keys(d.palette).length ? `  palette: { ${Object.entries(d.palette).map(([k, v]) => `${q(k)}: ${q(v)}`).join(', ')} },\n` : '';
  if (frames.length === 1 && !pal && !(d.fps && d.fps !== 8)) return `CM.sprite(${q(d.name)}, [\n${frames[0].replace(/^      /gm, '  ')}\n]);`;
  return `CM.sprite(${q(d.name)}, {\n  fps: ${d.fps || 8},\n${pal}  frames: [\n${frames.map(f => '    [\n' + f + '\n    ]').join(',\n')}\n  ]\n});`;
}
function modelCode(d) {
  const layers = (d.voxels || []).map(l => '    [' + l.map(q).join(', ') + ']');
  const pal = d.palette && Object.keys(d.palette).length ? `  palette: { ${Object.entries(d.palette).map(([k, v]) => `${q(k)}: ${q(v)}`).join(', ')} },\n` : '';
  return `CM.model(${q(d.name)}, {\n  size: ${d.size || 0.2},\n${pal}  voxels: [\n${layers.join(',\n')}\n  ]\n});`;
}
// replace CM.sprite('name', …) / CM.model('name', …) wherever it is in the game's scripts, or append it
function saveArt(pid, d) {
  const dir = path.join(PROJECTS, pid); const game = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
  const fn = d.kind === 'model' ? 'model' : 'sprite'; const code = fn === 'model' ? modelCode(d) : spriteCode(d);
  const re = new RegExp(`CM\\.${fn}\\(\\s*(['"])${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*,`);
  for (const rel of game.scripts || []) {
    const file = path.join(dir, rel); if (!fs.existsSync(file)) continue; const src = fs.readFileSync(file, 'utf8');
    const m = re.exec(src); if (!m) continue;
    const open = src.indexOf('(', m.index); const end = matchCall(src, open); if (end < 0) continue;
    let tail = end; if (src[tail] === ';') tail++;
    const out = src.slice(0, m.index) + code + src.slice(tail);
    fs.writeFileSync(file, out); return { file: rel, line: src.slice(0, m.index).split('\n').length, replaced: true };
  }
  // new: put it in the first script that already has art, else the first script
  const scripts = game.scripts || []; const rel = scripts.find(s => fs.existsSync(path.join(dir, s)) && fs.readFileSync(path.join(dir, s), 'utf8').includes(`CM.${fn}(`)) || scripts[0];
  if (!rel) return { error: 'The game has no scripts to put it in.' };
  const file = path.join(dir, rel); const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, src.replace(/\s*$/, '') + '\n\n' + code + '\n'); return { file: rel, line: src.split('\n').length + 2, replaced: false };
}
// swap the quoted level rows in a scene file. `original` is what the game loaded; `rows` is the edited map.
function saveTiles(pid, { file, original, rows }) {
  const dir = path.join(PROJECTS, pid); const full = path.normalize(path.join(dir, file)); if (!full.startsWith(dir)) return { error: 'Bad file.' };
  if (!fs.existsSync(full)) return { error: 'That file is gone.' };
  const src = fs.readFileSync(full, 'utf8');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(original.map((r, i) => `(['"\`])${esc(r)}\\1` + (i < original.length - 1 ? '\\s*,\\s*' : '')).join(''));
  const m = re.exec(src); if (!m) return { error: 'The level text in the file no longer matches what the game loaded. Reload the page and paint again.' };
  const quote = m[1] || "'"; const indent = (src.slice(0, m.index).match(/\n([ \t]*)[^\n]*$/) || [, '  '])[1];
  const body = rows.map(r => quote + r.replace(new RegExp(quote, 'g'), '\\' + quote) + quote).join(',\n' + indent);
  fs.writeFileSync(full, src.slice(0, m.index) + body + src.slice(m.index + m[0].length)); return { ok: true, file };
}
// which CM.sfx names a game uses, so the Sounds tool can list them
function usedSounds(pid) {
  const dir = path.join(PROJECTS, pid); let game; try { game = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8')); } catch { return []; }
  const names = new Set();
  for (const rel of game.scripts || []) { try { const src = fs.readFileSync(path.join(dir, rel), 'utf8'); for (const m of src.matchAll(/CM\.sfx\(\s*['"]([\w-]+)['"]/g)) names.add(m[1]); } catch {} }
  return [...names];
}
module.exports = { saveArt, saveTiles, usedSounds, spriteCode, modelCode, matchCall, PROJECTS };
