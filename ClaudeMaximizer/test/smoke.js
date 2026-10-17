// Smoke test: starts the server on a spare port against a temp copy of the projects and checks the API,
// note storage, NOTES.md and the templates.   node test/smoke.js
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗', msg, extra || ''); } };

(async () => {
  console.log('Claude Maximizer smoke tests');
  // the notes library on a scratch project
  const lib = require('../tools/notes-lib');
  const pid = 'zz-smoke-' + Date.now(); const dir = path.join(lib.PROJECTS, pid); fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ name: 'Smoke', mode: '2d', start: 'main', scripts: ['scripts/game.js'] }));
  fs.copyFileSync(path.join(ROOT, 'templates/blank-2d/scripts/game.js'), path.join(dir, 'scripts/game.js'));
  try {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const n1 = lib.add(pid, { kind: 'entity', text: 'Too fast', target: { id: 'bat#1', type: 'bat', src: 'scripts/game.js:3', x: 1, y: 2, props: { speed: 60 } }, allOfType: true, scene: 'main', time: 1.5, image: png, context: { player: { id: 'hero#1', type: 'hero', x: 0, y: 0, props: {} }, counts: { bat: 2 } } });
    ok(n1.id === 1 && n1.status === 'open' && n1.image === 'notes/1.png' && fs.existsSync(path.join(dir, 'notes/1.png')), 'add a note with a picture');
    const n2 = lib.add(pid, { kind: 'tweak', text: '', target: { id: 'bat#1', type: 'bat', props: {} }, tweaks: [{ key: 'speed', from: 60, to: 30, all: true }] });
    const md = fs.readFileSync(path.join(dir, 'NOTES.md'), 'utf8');
    ok(md.includes('## Note 1 — bat#1 — applies to EVERY bat') && md.includes('scripts/game.js:3') && md.includes('speed 60') && md.includes('Picture: notes/1.png'), 'NOTES.md explains an entity note', md.slice(0, 300));
    ok(md.includes('**speed** 60 → 30 for every bat'), 'NOTES.md lists tweaks');
    lib.update(pid, 1, { status: 'done', reply: 'Slowed bats' });
    const md2 = fs.readFileSync(path.join(dir, 'NOTES.md'), 'utf8');
    ok(md2.includes('1 open') && md2.includes('Done (1)') && md2.includes('Slowed bats'), 'closing a note moves it to Done with the reply');
    lib.remove(pid, 2); ok(lib.load(pid).notes.length === 1 && !fs.existsSync(path.join(dir, 'notes/2.png')), 'remove a note');

    // the server
    const port = 4990 + 100 + Math.floor(Math.random() * 100);
    const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: port }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise(r => { srv.stdout.on('data', d => { if (String(d).includes('Claude Maximizer on')) r(); }); setTimeout(r, 3000); });
    const base = `http://localhost:${port}`;
    const call = async (p, body, method) => { const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})), text: null }; };
    try {
      const ps = (await call('/api/projects')).j.projects; ok(ps.some(p => p.id === pid) && ps.some(p => p.id === 'cave-runner'), 'lists games', JSON.stringify(ps));
      const r = await fetch(base + '/'); ok(r.status === 200 && (await r.text()).includes('editor.js'), 'serves the editor page');
      for (const f of ['/common.js', '/engine.js', '/engine3d.js', '/editor.js', '/app.js', '/style.css', '/vendor/three.module.js', `/p/${pid}/game.json`, `/p/${pid}/scripts/game.js`]) { const x = await fetch(base + f); ok(x.status === 200, 'serves ' + f); }
      ok((await fetch(base + '/p/../server.js')).status !== 200 && (await fetch(base + `/p/${pid}/../../server.js`)).status !== 200, 'no path escape');
      const add = await call('/api/notes', { project: pid, note: { kind: 'spot', text: 'Hole here', spot: { x: 10, y: 20, space: 'world', tile: { tx: 1, ty: 2, ch: '#', src: 'scripts/game.js:20' } } } });
      ok(add.status === 200 && add.j.note.id > 1 && add.j.note.kind === 'spot', 'POST a note', JSON.stringify(add.j));
      const nid = add.j.note.id;
      const list = await call(`/api/notes?project=${pid}`); ok(list.j.notes.length === 2, 'GET notes');
      const upd = await call('/api/notes/' + nid, { project: pid, status: 'done', reply: 'Filled it' }, 'PATCH'); ok(upd.j.note.status === 'done' && upd.j.note.reply === 'Filled it', 'PATCH a note');
      const del = await call(`/api/notes/${nid}?project=${pid}`, null, 'DELETE'); ok(del.status === 200 && (await call(`/api/notes?project=${pid}`)).j.notes.length === 1, 'DELETE a note');
      ok(fs.readFileSync(path.join(dir, 'NOTES.md'), 'utf8').includes('tile column 1, row 2') === false, 'deleted note is gone from NOTES.md');
      const mk = await call('/api/projects', { name: 'Smoke 3D ' + Date.now(), mode: '3d' }); ok(mk.status === 200 && fs.existsSync(path.join(lib.PROJECTS, mk.j.id, 'scripts/game.js')) && JSON.parse(fs.readFileSync(path.join(lib.PROJECTS, mk.j.id, 'game.json'))).mode === '3d', 'New game from the 3D template', JSON.stringify(mk.j));
      fs.rmSync(path.join(lib.PROJECTS, mk.j.id), { recursive: true, force: true });
      ok((await call('/api/projects', { name: 'cave-runner' })).status === 409, 'duplicate game name is refused');
      // SSE: a script save pushes a files event
      const ctrl = new AbortController(); const es = await fetch(base + `/api/events?project=${pid}`, { signal: ctrl.signal }); const reader = es.body.getReader();
      setTimeout(() => fs.appendFileSync(path.join(dir, 'scripts/game.js'), '\n// touched\n'), 300);
      let got = ''; const t0 = Date.now(); while (!got.includes('event: files') && Date.now() - t0 < 3000) { const { value, done } = await reader.read(); if (done) break; got += new TextDecoder().decode(value); }
      ok(got.includes('event: files') && got.includes('scripts/game.js'), 'file watcher pushes script changes', got.slice(0, 120)); ctrl.abort();
    } finally { srv.kill(); }

    // engines parse and the CLI runs
    for (const f of ['public/common.js', 'public/engine.js', 'public/engine3d.js', 'public/editor.js', 'public/app.js']) { try { new Function(fs.readFileSync(path.join(ROOT, f), 'utf8')); ok(true, f + ' parses'); } catch (e) { ok(false, f + ' parses', e.message); } }
    const { execSync } = require('child_process');
    const out = execSync(`node tools/notes.js --project ${pid}`, { cwd: ROOT }).toString(); ok(out.includes('No open notes') || out.includes('## Note'), 'CLI lists notes', out.slice(0, 100));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
