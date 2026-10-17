// Boot: pick the project, load the right engine (2D or 3D), run its scripts, start the editor layer,
// and hot-reload the scripts whenever Claude changes a file.
(async function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const App = (window.App = {});
  const params = new URLSearchParams(location.search);
  const projects = (await (await fetch('/api/projects')).json()).projects || [];
  const sel = $('#project'); sel.innerHTML = projects.map(p => `<option value="${p.id}">${p.name || p.id} (${p.mode || '2d'})</option>`).join('');
  if (!projects.length) { $('#stage-wrap').innerHTML = '<div class="empty big">No games yet. Click “New game” to make one.</div>'; return; }
  let pid = params.get('p') || projects[0].id; if (!projects.some(p => p.id === pid)) pid = projects[0].id; sel.value = pid;
  const project = await (await fetch(`/p/${pid}/game.json?t=${Date.now()}`)).json(); project.id = pid; App.project = project;
  document.title = `${project.name || pid} · Claude Maximizer`;

  const mode = project.mode === '3d' ? '3d' : '2d';
  if (mode === '3d') { window.THREE = await import('/vendor/three.module.js'); await loadScript('/common.js'); await loadScript('/engine3d.js'); } else { await loadScript('/common.js'); await loadScript('/engine.js'); }
  const CM = window.CM; App.CM = CM;
  CM.setup($('#game'), { width: project.width || (mode === '3d' ? 960 : 320), height: project.height || (mode === '3d' ? 540 : 180) });
  CM.startScene = project.start || null; CM.projectId = pid;
  async function loadSounds() { try { const r = await fetch(`/p/${pid}/sounds.json?t=${Date.now()}`); CM.loadSounds(r.ok ? await r.json() : {}); } catch { CM.loadSounds({}); } }
  await loadSounds(); App.loadSounds = loadSounds;

  const scripts = (project.scripts || []).map(s => `/p/${pid}/${s}`);
  let loaded = [];
  async function runScripts() {
    for (const el of loaded) el.remove(); loaded = [];
    CM.reset();
    for (const s of scripts) { try { loaded.push(await loadGameScript(`${s}?t=${Date.now()}`)); } catch (e) { CM.reportError('loading ' + s.replace(`/p/${pid}/`, ''), e); } }
  }
  await runScripts();
  CM.start(project.start);
  window.Editor.init({ project, cm: CM });

  App.reload = async function (files) {
    const sceneName = CM.adapter.sceneName();
    await runScripts();
    CM.start(CM.defs.scenes[sceneName] ? sceneName : project.start);
    window.Editor.toast(files && files.length ? `Reloaded ${files.join(', ')}` : 'Reloaded scripts');
  };

  // live link to the server: file changes → reload scripts; note changes (Claude replied) → refresh the list
  function connect() {
    const es = new EventSource(`/api/events?project=${encodeURIComponent(pid)}`);
    es.onopen = () => window.Editor.setWatch('live', true);
    es.onerror = () => window.Editor.setWatch('reconnecting', false);
    es.addEventListener('files', e => { const d = JSON.parse(e.data); if (d.files.some(f => f === 'game.json')) return location.reload(); const code = d.files.filter(f => f !== 'sounds.json'); if (d.files.includes('sounds.json')) loadSounds().then(() => window.Editor.toast('Sounds updated')); if (code.length) App.reload(code); });
    es.addEventListener('notes', () => window.Editor.loadNotes());
    es.addEventListener('claude', e => { if (window.Editor.onClaude) window.Editor.onClaude(JSON.parse(e.data)); });
  }
  connect();

  function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = () => res(el); el.onerror = () => rej(new Error('could not load ' + src)); document.body.appendChild(el); }); }
  // game scripts run inside their own function so they can be re-run on hot reload (top-level const/let would
  // otherwise clash). sourceURL keeps real file names and line numbers in stack traces, which notes rely on.
  async function loadGameScript(src) {
    const r = await fetch(src); if (!r.ok) throw new Error('could not load ' + src.replace(/\?.*$/, ''));
    const code = await r.text(); const el = document.createElement('script');
    el.textContent = `(function(){${code}\n})();\n//# sourceURL=${location.origin}${src.replace(/\?.*$/, '')}`;
    document.body.appendChild(el); return el;
  }
})();
