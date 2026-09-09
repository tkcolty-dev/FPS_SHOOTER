/* ============================================================
   BlockWorld 3D Studio — editor UI
   ============================================================ */
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Engine, defaultObject, newId } from './engine.js';
import { EXAMPLES, newProjectData, playerScripts } from './examples.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const KIND_ICON = { box:'◼', sphere:'●', cylinder:'⬮', cone:'▲', capsule:'⬭', torus:'◯', plane:'▬', wedge:'◢', model:'🧩' };
const PALETTE = ['#4c97ff','#ff8c1a','#59c059','#ff5a5f','#9966ff','#ffd700','#5cb1d6','#cf63cf','#12b886','#c58b4e'];

/* ---------------- toast ---------------- */
let toastT;
function toast(msg, err=false){ const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), err ? 5000 : 2500); }

/* ---------------- engine ---------------- */
const engine = new Engine({ canvas: $('#view'), hud: $('#hud'), editor: true });
engine.onError = m => toast('Script error — ' + m, true);
engine.onPlayState = on => { $('#btn-play').classList.toggle('active', on); $('#info-bar').classList.toggle('disabled', on); gizmo.visible = !on && !!selected; if (on) gizmo.detach(); else if (selected) gizmo.attach(selected.root); $('#view-hint').textContent = on ? 'Playing — press ■ to stop and reset' : HINT; };
const HINT = $('#view-hint').textContent;
setInterval(() => { $('#fps').textContent = engine.fps + ' fps'; }, 500);

/* ---------------- Blockly ---------------- */
const workspace = Blockly.inject('blockly', {
  toolbox: window.BW_TOOLBOX, theme: window.BW_THEME, renderer: 'zelos', media: 'vendor/blockly/media/',
  zoom: { controls: true, wheel: true, startScale: 0.75, minScale: 0.4, maxScale: 1.5, pinch: true },
  grid: { spacing: 32, length: 3, colour: '#e3e3e3', snap: false }, trashcan: true, move: { scrollbars: true, drag: true, wheel: true }, sounds: false
});
workspace.registerToolboxCategoryCallback('VARIABLE', window.BW_variableFlyout);
workspace.registerButtonCallback('CREATE_VARIABLE', btn => Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace(), null, ''));
window.BW_hooks.objectNames = () => engine.project.objects.map(o => o.name);
window.BW_hooks.animationNames = () => { const o = selected; return o && o.clips ? o.clips.map(c => c.name) : []; };

/* ---------------- state ---------------- */
let selected = null;        // SceneObject being edited (null = Stage)
let editingStage = false;
let loadingWorkspace = false;
let dirty = false;

function ensureVariables(){
  for (const v of engine.project.variables){ const vm = workspace.getVariableMap(); if (!vm.getVariableById(v.id) && !vm.getVariable(v.name, '')) vm.createVariable(v.name, '', v.id); }
}
function saveCurrentWorkspace(){
  if (loadingWorkspace) return;
  const json = Blockly.serialization.workspaces.save(workspace);
  if (editingStage) engine.project.stage.workspace = json; else if (selected) selected.data.workspace = json;
}
function loadWorkspaceFor(target){
  loadingWorkspace = true;
  Blockly.Events.disable();
  try {
    workspace.clear();
    ensureVariables();
    const json = target === 'stage' ? engine.project.stage.workspace : target.data.workspace;
    if (json) { try { Blockly.serialization.workspaces.load(json, workspace); } catch (e) { console.warn(e); } }
  } finally { Blockly.Events.enable(); }
  workspace.scrollCenter();
  setTimeout(() => { loadingWorkspace = false; }, 0);
}
workspace.addChangeListener(e => {
  if (loadingWorkspace || e.isUiEvent) return;
  if (e.type === Blockly.Events.VAR_CREATE){ if (!engine.project.variables.some(v => v.id === e.varId)) engine.project.variables.push({ name: e.varName, id: e.varId }); }
  if (e.type === Blockly.Events.VAR_DELETE){ engine.project.variables = engine.project.variables.filter(v => v.id !== e.varId); }
  if (e.type === Blockly.Events.VAR_RENAME){ const v = engine.project.variables.find(v => v.id === e.varId); if (v) v.name = e.newName; }
  saveCurrentWorkspace(); markDirty();
});

function select(target){
  saveCurrentWorkspace();
  if (target === 'stage'){ editingStage = true; selected = null; gizmo.detach(); }
  else { editingStage = false; selected = target; if (!engine.playing) gizmo.attach(target.root); }
  loadWorkspaceFor(editingStage ? 'stage' : selected);
  $('#editing-name').textContent = editingStage ? 'Stage' : selected.name;
  $('#obj-form').style.display = editingStage ? 'none' : ''; $('#stage-form').style.display = editingStage ? '' : 'none';
  renderTiles(); refreshInfo(); refreshForm();
}

/* ---------------- object tiles ---------------- */
function renderTiles(){
  const list = $('#objects-list'); list.innerHTML = '';
  for (const o of engine.objects.filter(o => !o.isClone)){
    const t = document.createElement('div'); t.className = 'obj-tile' + (o === selected ? ' selected' : '');
    const pic = document.createElement('div'); pic.className = 'pic'; pic.textContent = KIND_ICON[o.kind] || '◼'; pic.style.background = o.data.color || '#888';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = o.name;
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'Delete'; x.onclick = ev => { ev.stopPropagation(); deleteObject(o); };
    t.append(pic, nm, x); t.onclick = () => select(o); t.ondblclick = () => focusOn(o);
    list.appendChild(t);
  }
  $('#stage-tile').classList.toggle('selected', editingStage);
}
$('#stage-tile').onclick = () => select('stage');

/* ---------------- info bar + object form ---------------- */
const fmt = v => Math.round(v * 100) / 100;
function refreshInfo(){
  const o = selected; const bar = $('#info-bar');
  bar.querySelectorAll('input').forEach(i => i.disabled = !o);
  $('#ib-name').textContent = o ? o.name : 'Stage';
  if (!o) return;
  $('#ib-x').value = fmt(o.data.position[0]); $('#ib-y').value = fmt(o.data.position[1]); $('#ib-z').value = fmt(o.data.position[2]);
  $('#ib-ry').value = fmt(o.data.rotation[1]); $('#ib-size').value = fmt(o.data.scale[1]);
  $('#ib-color').value = o.data.color || '#ffffff'; $('#ib-phys').checked = !!o.data.physics.enabled;
}
function refreshForm(){
  if (editingStage){ const s = engine.project.stage; $('#s-sky').value = s.sky; $('#s-gravity').value = s.gravity; $('#s-sun').value = s.sun == null ? 1 : s.sun; $('#s-fog').checked = s.fog !== false; return; }
  const o = selected; if (!o) return; const d = o.data;
  $('#p-name').value = d.name;
  [['#p-x',d.position[0]],['#p-y',d.position[1]],['#p-z',d.position[2]],['#p-rx',d.rotation[0]],['#p-ry',d.rotation[1]],['#p-rz',d.rotation[2]],['#p-sx',d.scale[0]],['#p-sy',d.scale[1]],['#p-sz',d.scale[2]]].forEach(([s,v]) => $(s).value = fmt(v));
  $('#p-color').value = d.color || '#ffffff'; $('#p-material').value = d.material || 'normal'; $('#p-opacity').value = d.opacity || 0; $('#p-visible').checked = d.visible !== false;
  $('#p-phys').checked = !!d.physics.enabled; $('#p-ptype').value = d.physics.type; $('#p-mass').value = d.physics.mass; $('#p-bounce').value = d.physics.bounce; $('#p-friction').value = d.physics.friction; $('#p-upright').checked = !!d.physics.upright;
}
function applyFromInputs(){
  const o = selected; if (!o) return; const d = o.data, n = s => parseFloat($(s).value) || 0;
  d.position = [n('#p-x'), n('#p-y'), n('#p-z')]; d.rotation = [n('#p-rx'), n('#p-ry'), n('#p-rz')];
  d.scale = [Math.max(0.01, n('#p-sx')), Math.max(0.01, n('#p-sy')), Math.max(0.01, n('#p-sz'))];
  d.color = $('#p-color').value; d.material = $('#p-material').value; d.opacity = n('#p-opacity'); d.visible = $('#p-visible').checked;
  d.physics.enabled = $('#p-phys').checked; d.physics.type = $('#p-ptype').value; d.physics.mass = Math.max(0.01, n('#p-mass')); d.physics.bounce = n('#p-bounce'); d.physics.friction = n('#p-friction'); d.physics.upright = $('#p-upright').checked;
  o.applyProps(); refreshInfo(); renderTiles(); markDirty();
}
$$('#obj-form input, #obj-form select').forEach(el => { if (el.id === 'p-name') return; el.addEventListener('input', applyFromInputs); el.addEventListener('change', applyFromInputs); });
$('#p-name').addEventListener('change', () => renameObject(selected, $('#p-name').value));
$$('#stage-form input').forEach(el => el.addEventListener('input', () => { const s = engine.project.stage; s.sky = $('#s-sky').value; s.gravity = parseFloat($('#s-gravity').value) || 0; s.sun = parseFloat($('#s-sun').value); s.fog = $('#s-fog').checked; engine.applyStage(); markDirty(); }));
function infoApply(){
  const o = selected; if (!o) return; const d = o.data, n = s => parseFloat($(s).value) || 0;
  d.position = [n('#ib-x'), n('#ib-y'), n('#ib-z')]; d.rotation[1] = n('#ib-ry');
  const sz = Math.max(0.01, n('#ib-size')), k = sz / (d.scale[1] || 1); d.scale = d.scale.map(v => Math.max(0.01, v * k));
  d.color = $('#ib-color').value; d.physics.enabled = $('#ib-phys').checked;
  o.applyProps(); refreshForm(); renderTiles(); markDirty();
}
$$('#info-bar input').forEach(el => { el.addEventListener('input', infoApply); el.addEventListener('change', infoApply); });
$('#p-dup').onclick = () => selected && duplicateObject(selected);
$('#p-del').onclick = () => selected && deleteObject(selected);

function uniqueName(base){
  base = base.replace(/\d+$/, '') || 'Object'; const names = new Set(engine.project.objects.map(o => o.name));
  if (!names.has(base)) return base; let i = 2; while (names.has(base + i)) i++; return base + i;
}
function renameObject(o, name){
  name = String(name || '').trim().slice(0, 40); if (!o || !name || name === o.name) { refreshForm(); return; }
  const old = o.name; if (engine.project.objects.some(p => p.name === name)) name = uniqueName(name);
  o.name = o.data.name = name;
  // update dropdowns in every workspace that pointed at the old name
  const fix = json => { if (!json) return; const walk = b => { if (!b) return; if (b.fields) for (const k in b.fields) if (b.fields[k] === old) b.fields[k] = name; if (b.inputs) for (const k in b.inputs){ walk(b.inputs[k].block); walk(b.inputs[k].shadow); } walk(b.next && b.next.block); }; (json.blocks && json.blocks.blocks || []).forEach(walk); };
  saveCurrentWorkspace(); engine.project.objects.forEach(p => fix(p.workspace)); fix(engine.project.stage.workspace);
  loadWorkspaceFor(editingStage ? 'stage' : selected);
  $('#editing-name').textContent = name; renderTiles(); refreshInfo(); refreshForm(); markDirty();
}
function deleteObject(o){
  if (!o || engine.playing) return;
  engine.removeObject(o);
  if (selected === o) { selected = null; gizmo.detach(); const next = engine.objects[0]; next ? select(next) : select('stage'); } else renderTiles();
  markDirty();
}
async function duplicateObject(o){
  const data = JSON.parse(JSON.stringify(o.data)); data.id = newId(); data.name = uniqueName(o.name); data.position[0] += 1.5;
  const c = await engine.addObject(data); select(c); markDirty();
}
function focusOn(o){ const p = o.root.position; engine.controls.target.copy(p); const d = Math.max(3, o.root.scale.length() * 2.2); engine.camera.position.copy(p).add(new THREE.Vector3(d * 0.7, d * 0.6, d * 0.9)); }

/* ---------------- add objects ---------------- */
async function addShape(kind){
  const data = defaultObject(kind, uniqueName(kind === 'box' ? 'Cube' : kind === 'sphere' ? 'Ball' : kind === 'plane' ? 'Floor' : kind === 'wedge' ? 'Ramp' : kind[0].toUpperCase() + kind.slice(1)));
  data.color = PALETTE[engine.project.objects.length % PALETTE.length];
  if (kind === 'plane') { data.scale = [8, 0.2, 8]; data.position = [0, 0.1, 0]; }
  const p = engine.controls.target.clone(); data.position = [fmt(p.x + (Math.random() - 0.5) * 2), kind === 'plane' ? 0.1 : (kind === 'capsule' ? 0.6 : 0.5), fmt(p.z + (Math.random() - 0.5) * 2)];
  if (kind === 'wedge') { data.scale = [3, 1.5, 3]; data.position[1] = 0.75; }
  const o = await engine.addObject(data); select(o); markDirty(); return o;
}
async function addModel(url, name, meta={}){
  const data = defaultObject('model', uniqueName(name.replace(/[^\w ]/g, '').trim() || 'Model')); data.modelUrl = url; data.color = '';
  const p = engine.controls.target.clone(); data.position = [fmt(p.x), 0.5, fmt(p.z)];
  if (meta.scale) data.scale = [meta.scale, meta.scale, meta.scale];
  const o = await engine.addObject(data);
  // rest it on the ground
  const box = o.worldBox(); data.position[1] = fmt(data.position[1] - box.min.y); o.applyProps();
  select(o); markDirty(); toast('Added ' + data.name + (o.clips.length ? ' — it has ' + o.clips.length + ' animation(s)! See Looks → play animation' : ''));
  return o;
}
$('#btn-add').onclick = e => { e.stopPropagation(); $('#add-menu').classList.toggle('hidden'); };
$$('#add-menu [data-kind]').forEach(b => b.onclick = () => { $('#add-menu').classList.add('hidden'); addShape(b.dataset.kind); });
$$('#add-menu [data-act]').forEach(b => b.onclick = () => { $('#add-menu').classList.add('hidden'); b.dataset.act === 'workshop' ? openWorkshop() : $('#file-model').click(); });
$('#file-model').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  toast('Uploading ' + f.name + '…');
  try {
    const r = await fetch('/api/workshop/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.json());
    if (!r.ok) throw new Error(r.error || 'upload failed');
    await addModel(r.local, f.name.replace(/\.\w+$/, ''));
  } catch (err) { toast('Upload failed: ' + err.message, true); }
};

/* ---------------- workshop ---------------- */
function openWorkshop(){ $('#workshop-modal').classList.remove('hidden'); $('#ws-q').focus(); if (!$('#ws-grid').children.length) wsSearch(''); }
$('#btn-workshop').onclick = openWorkshop;
$('#ws-go').onclick = () => wsSearch($('#ws-q').value);
$('#ws-q').onkeydown = e => { if (e.key === 'Enter') wsSearch($('#ws-q').value); };
async function wsSearch(q){
  $('#ws-status').textContent = 'Searching…'; const grid = $('#ws-grid'); grid.innerHTML = '';
  try {
    const r = await fetch('/api/workshop/search?q=' + encodeURIComponent(q)).then(r => r.json());
    $('#ws-status').textContent = r.results.length + ' models';
    $('#ws-note').textContent = r.polyEnabled ? 'Sources: Khronos sample models + poly.pizza (CC0).' : 'Showing the built-in Khronos sample library. To search thousands of free low-poly models, get a free API key at poly.pizza and start the server with POLY_PIZZA_KEY=… ';
    for (const m of r.results){
      const c = document.createElement('div'); c.className = 'ws-card';
      const th = document.createElement('div'); th.className = 'thumb'; if (m.thumb) th.style.backgroundImage = 'url(/api/workshop/thumb?url=' + encodeURIComponent(m.thumb) + ')'; else th.textContent = '🧩';
      const meta = document.createElement('div'); meta.className = 'meta'; meta.innerHTML = '<span class="t"></span><span class="c"></span>';
      meta.querySelector('.t').textContent = m.title; meta.querySelector('.c').textContent = m.creator + ' · ' + m.license;
      if (m.animated) meta.querySelector('.t').insertAdjacentHTML('beforeend', '<span class="badge">animated</span>');
      const btn = document.createElement('button'); btn.textContent = 'Add to game';
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Downloading…';
        try {
          const f = await fetch('/api/workshop/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: m.url }) }).then(r => r.json());
          if (!f.ok) throw new Error(f.error);
          btn.textContent = 'Loading…';
          await addModel(f.local, m.title, { scale: /sponza/i.test(m.title) ? 30 : 1 });
          btn.textContent = 'Added ✓'; setTimeout(() => { btn.disabled = false; btn.textContent = 'Add to game'; }, 1500);
          $('#workshop-modal').classList.add('hidden');
        } catch (err) { toast('Could not add model: ' + err.message, true); btn.disabled = false; btn.textContent = 'Add to game'; }
      };
      c.append(th, meta, btn); grid.appendChild(c);
    }
  } catch (err) { $('#ws-status').textContent = 'Search failed'; }
}

/* ---------------- viewport: gizmo + picking ---------------- */
const gizmo = new TransformControls(engine.camera, engine.canvas);
gizmo.setSize(0.9); engine.scene.add(gizmo.getHelper ? gizmo.getHelper() : gizmo);
gizmo.addEventListener('dragging-changed', e => { engine.controls.enabled = !e.value; if (!e.value && selected) { syncFromGizmo(); } });
gizmo.addEventListener('objectChange', () => { if (selected) syncFromGizmo(false); });
function syncFromGizmo(final=true){
  const o = selected, r = o.root; o.data.position = r.position.toArray().map(fmt); o.data.rotation = [r.rotation.x, r.rotation.y, r.rotation.z].map(v => fmt(v * 180 / Math.PI));
  o.data.scale = r.scale.toArray().map(v => Math.max(0.01, fmt(v))); refreshInfo(); if (final) { refreshForm(); markDirty(); }
}
let snap = false;
function setGizmoMode(m){ gizmo.setMode(m); $$('.gz[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m)); }
$$('.gz[data-mode]').forEach(b => b.onclick = () => setGizmoMode(b.dataset.mode));
$('#gz-snap').onclick = () => { snap = !snap; $('#gz-snap').classList.toggle('on', snap); gizmo.setTranslationSnap(snap ? 0.5 : null); gizmo.setRotationSnap(snap ? THREE.MathUtils.degToRad(15) : null); gizmo.setScaleSnap(snap ? 0.25 : null); };
$('#gz-focus').onclick = () => selected && focusOn(selected);
let downPos = null;
engine.canvas.addEventListener('pointerdown', e => { downPos = [e.clientX, e.clientY, e.button]; });
engine.canvas.addEventListener('pointerup', e => {
  if (!downPos || engine.playing || gizmo.dragging) { downPos = null; return; }
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 4; const btn = downPos[2]; downPos = null;
  if (moved || btn !== 0) return;
  const o = engine.pick(e.clientX, e.clientY);
  if (o) select(o.original.isClone ? o : o.original); 
});
window.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveProject(); return; }
  if (engine.playing) return;
  const overViewport = $('#viewport-wrap').matches(':hover') || document.activeElement === document.body && !document.querySelector('.blocklySelected');
  if (!overViewport && !['Escape'].includes(e.key)) return;
  if (e.key === 'w' || e.key === 'W') setGizmoMode('translate'); else if (e.key === 'e' || e.key === 'E') setGizmoMode('rotate'); else if (e.key === 'r' || e.key === 'R') setGizmoMode('scale');
  else if (e.key === 'f' || e.key === 'F') selected && focusOn(selected);
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && $('#viewport-wrap').matches(':hover')) { e.preventDefault(); deleteObject(selected); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selected) { e.preventDefault(); duplicateObject(selected); }
});

/* ---------------- play / stop ---------------- */
function compileAll(){
  saveCurrentWorkspace();
  const out = {}; const errors = [];
  const GenFn = Object.getPrototypeOf(function*(){}).constructor;
  const compile = (json, label) => {
    if (!json) return [];
    const ws = new Blockly.Workspace();
    try {
      for (const v of engine.project.variables) ws.getVariableMap().createVariable(v.name, '', v.id);
      Blockly.serialization.workspaces.load(json, ws);
      const scripts = window.BW_compileWorkspace(ws);
      scripts.forEach((s, i) => { s.id = i; try { s.fn = new GenFn('self', 'R', 'V', '_thread', s.code); } catch (e) { errors.push(label + ': ' + e.message); s.fn = function*(){}; } });
      return scripts;
    } catch (e) { errors.push(label + ': ' + e.message); return []; }
    finally { ws.dispose(); }
  };
  out.stage = compile(engine.project.stage.workspace, 'Stage');
  for (const o of engine.objects) if (!o.isClone) out[o.id] = compile(o.data.workspace, o.name);
  if (errors.length) toast('Problem in scripts: ' + errors[0], true);
  return out;
}
function play(){ if (engine.playing) engine.stop(); engine.play(compileAll()); engine.canvas.focus(); }
$('#btn-play').onclick = play;
$('#btn-stop').onclick = () => { engine.stop(); refreshInfo(); refreshForm(); if (selected) gizmo.attach(selected.root); };
$('#btn-big').onclick = () => { $('.layout').classList.toggle('big'); setTimeout(() => Blockly.svgResize(workspace), 50); };

/* ---------------- tabs / menus ---------------- */
$$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('active', x === t)); $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === (t.dataset.tab === 'code' ? 'blockly' : 'object-panel'))); if (t.dataset.tab === 'code') Blockly.svgResize(workspace); else refreshForm(); });
$('#btn-file').onclick = e => { e.stopPropagation(); $('#file-menu').classList.toggle('hidden'); $('#examples-menu').classList.add('hidden'); };
$('#btn-examples').onclick = e => { e.stopPropagation(); $('#examples-menu').classList.toggle('hidden'); $('#file-menu').classList.add('hidden'); };
document.addEventListener('click', () => { $$('.dropdown, .add-menu').forEach(d => d.classList.add('hidden')); });
$$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hidden'));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));
$('#btn-help').onclick = () => $('#help-modal').classList.remove('hidden');
for (const ex of EXAMPLES){ const b = document.createElement('button'); b.textContent = ex.name; b.onclick = async () => { if (dirty && !confirm('Load the example? Unsaved changes will be lost.')) return; await loadProject(ex.build()); }; $('#examples-menu').appendChild(b); }
$$('#file-menu [data-act]').forEach(b => b.onclick = () => ({ new: newProject, open: openDialog, save: saveProject, saveas: saveAs, download: downloadProject, upload: () => $('#file-project').click(), export: exportGame })[b.dataset.act]());

/* ---------------- project files ---------------- */
function markDirty(){ dirty = true; $('#save-status').textContent = 'unsaved changes'; scheduleAutosave(); }
let autosaveT; function scheduleAutosave(){ clearTimeout(autosaveT); autosaveT = setTimeout(() => { try { localStorage.setItem('bw3d_draft', JSON.stringify(serialize())); } catch(e){} }, 1500); }
function serialize(){ saveCurrentWorkspace(); engine.project.name = $('#project-name').value.trim() || 'My Game'; engine.project.camera = { position: engine.camera.position.toArray(), target: engine.controls.target.toArray() }; return engine.project; }
async function loadProject(p){
  engine.stop(); selected = null; editingStage = false; gizmo.detach();
  await engine.loadProject(p);
  $('#project-name').value = engine.project.name || 'My Game';
  const first = engine.objects.find(o => o.name === 'Player') || engine.objects.find(o => o.kind !== 'plane') || engine.objects[0];
  first ? select(first) : select('stage');
  dirty = false; $('#save-status').textContent = '';
}
async function newProject(){ if (dirty && !confirm('Start a new project? Unsaved changes will be lost.')) return; await loadProject(newProjectData()); }
async function saveProject(){
  const p = serialize();
  try { const r = await fetch('/api/projects/' + encodeURIComponent(p.name), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(r => r.json());
    dirty = false; $('#save-status').textContent = 'saved ✓'; toast('Saved "' + r.name + '"'); } catch (e) { toast('Save failed: ' + e.message, true); }
}
function saveAs(){ const n = prompt('Save project as:', $('#project-name').value); if (n) { $('#project-name').value = n; saveProject(); } }
async function openDialog(){
  const list = await fetch('/api/projects').then(r => r.json()); const box = $('#open-list'); box.innerHTML = list.length ? '' : '<p style="padding:10px;color:#888">No saved projects yet.</p>';
  for (const p of list){ const b = document.createElement('button'); b.innerHTML = '<span></span><span class="d"></span>'; b.firstChild.textContent = p.name; b.lastChild.textContent = new Date(p.modified).toLocaleString();
    b.onclick = async () => { $('#open-modal').classList.add('hidden'); const data = await fetch('/api/projects/' + encodeURIComponent(p.name)).then(r => r.json()); await loadProject(data); }; box.appendChild(b); }
  $('#open-modal').classList.remove('hidden');
}
function downloadProject(){ const p = serialize(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(p)], { type: 'application/json' })); a.download = p.name + '.bw3d'; a.click(); }
$('#file-project').onchange = async e => { const f = e.target.files[0]; if (!f) return; e.target.value = ''; try { await loadProject(JSON.parse(await f.text())); } catch (err) { toast('Could not read that file', true); } };
async function exportGame(){
  const p = serialize(); const scripts = {}; const compiled = compileAll();
  for (const k in compiled) scripts[k] = compiled[k].map(s => { const { fn, ...rest } = s; return rest; });
  toast('Building your game…');
  try {
    const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: p, scripts }) });
    if (!r.ok) throw new Error((await r.json()).error || 'export failed');
    const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = p.name.replace(/\s+/g, '_') + '.html'; a.click();
    toast('Exported! Open the .html file anywhere — it plays offline.');
  } catch (e) { toast('Export failed: ' + e.message, true); }
}
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- boot ---------------- */
(async () => {
  let draft = null; try { draft = JSON.parse(localStorage.getItem('bw3d_draft') || 'null'); } catch(e){}
  await loadProject(draft && draft.objects && draft.objects.length ? draft : newProjectData());
  if (draft) $('#save-status').textContent = 'restored draft';
  new ResizeObserver(() => Blockly.svgResize(workspace)).observe($('#blockly'));
  window.BW = { engine, workspace, select, addShape, addModel, play, loadProject, compileAll, serialize };
})();
