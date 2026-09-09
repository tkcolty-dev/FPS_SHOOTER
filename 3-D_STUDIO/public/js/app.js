/* ============================================================
   BlockWorld 3D Studio — editor UI (v2)
   ============================================================ */
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Engine, defaultObject, newId } from './engine.js';
import { EXAMPLES, SMART, newProjectData } from './examples.js';
import { TEXTURE_NAMES, textureThumb } from './textures.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const PALETTE = ['#4c97ff','#ff8c1a','#59c059','#ff5a5f','#9966ff','#ffd700','#5cb1d6','#cf63cf','#12b886','#c58b4e'];
const fmt = v => Math.round(v * 100) / 100;

/* ---------------- toast / prompt ---------------- */
let toastT;
function toast(msg, err=false){ const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), err ? 5000 : 2500); }
function ask(title, value=''){
  return new Promise(res => {
    const m = $('#prompt-modal'), inp = $('#prompt-input'); $('#prompt-title').textContent = title; inp.value = value; m.classList.remove('hidden'); inp.focus(); inp.select();
    const done = ok => { m.classList.add('hidden'); m.onkeydown = null; $('#prompt-ok').onclick = null; $('#prompt-cancel').onclick = null; res(ok ? inp.value.trim() : null); };
    $('#prompt-ok').onclick = () => done(true); $('#prompt-cancel').onclick = () => done(false);
    m.onkeydown = e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  });
}

/* ---------------- engine ---------------- */
const engine = new Engine({ canvas: $('#view'), hud: $('#hud'), editor: true });
engine.onError = m => toast('Script error — ' + m, true);
engine.onPlayState = on => {
  $('#btn-play').classList.toggle('active', on); $('#info-bar').classList.toggle('disabled', on); $('#viewport-wrap').classList.toggle('playing', on);
  if (on) gizmo.detach(); else { if (selected) gizmo.attach(selected.root); engine.controls.enabled = true; scheduleThumbs(); refreshInfo(); refreshForm(); }
};
setInterval(() => { $('#fps').textContent = engine.fps + ' fps'; $('#fps').title = engine.stats.objects + ' objects · ' + engine.stats.bodies + ' physics bodies · ' + engine.stats.threads + ' running scripts'; }, 500);

/* ---------------- Blockly ---------------- */
const workspace = Blockly.inject('blockly', {
  toolbox: window.BW_TOOLBOX, theme: window.BW_THEME, renderer: 'zelos', media: 'vendor/blockly/media/',
  zoom: { controls: true, wheel: true, startScale: 0.8, minScale: 0.4, maxScale: 1.6, pinch: true },
  grid: { spacing: 36, length: 3, colour: '#2b3042', snap: false }, trashcan: true, move: { scrollbars: true, drag: true, wheel: true }, sounds: false
});
workspace.registerToolboxCategoryCallback('VARIABLE', window.BW_variableFlyout);
workspace.registerButtonCallback('CREATE_VARIABLE', btn => Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace(), null, ''));
workspace.registerButtonCallback('CREATE_LIST', async () => { const name = await ask('New list name:', 'my list'); if (!name) return; if (engine.project.lists.some(l => l.name === name)) return toast('A list called "' + name + '" already exists', true); engine.project.lists.push({ name, id: name }); markDirty(); workspace.getToolbox().refreshSelection(); });
workspace.registerButtonCallback('ADD_SOUND', () => $('#file-sound').click());
window.BW_hooks.objectNames = () => engine.project.objects.map(o => o.name);
window.BW_hooks.animationNames = () => { const o = selected; return o && o.clips ? o.clips.map(c => c.name) : []; };
window.BW_hooks.listNames = () => engine.project.lists.map(l => l.name);
window.BW_hooks.soundNames = () => engine.project.sounds.map(s => s.name);
window.BW_hooks.textureNames = () => TEXTURE_NAMES;
window.BW_hooks.uiNames = () => (engine.project.ui || []).map(u => u.name);
window.BW_hooks.procNames = () => workspace.getBlocksByType('custom_define', false).map(b => String(b.getFieldValue('NAME')).trim()).filter(Boolean);

/* ---------------- state ---------------- */
let selected = null, editingStage = false, loadingWorkspace = false, dirty = false;

function ensureVariables(){
  const vm = workspace.getVariableMap();
  for (const v of engine.project.variables){ if (!vm.getVariableById(v.id) && !vm.getVariable(v.name, '')) vm.createVariable(v.name, '', v.id); }
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
    workspace.clear(); ensureVariables();
    const json = target === 'stage' ? engine.project.stage.workspace : target.data.workspace;
    if (json) { try { Blockly.serialization.workspaces.load(json, workspace); } catch (e) { console.warn(e); } }
  } finally { Blockly.Events.enable(); }
  { const m = workspace.getMetrics(); workspace.scroll(40 - m.contentLeft, 40 - m.contentTop); }
  setTimeout(() => { loadingWorkspace = false; updateEmptyHint(); }, 0);
}
workspace.addChangeListener(e => {
  if (loadingWorkspace || e.isUiEvent) return;
  if (e.type === Blockly.Events.VAR_CREATE){ if (!engine.project.variables.some(v => v.id === e.varId)) engine.project.variables.push({ name: e.varName, id: e.varId }); }
  if (e.type === Blockly.Events.VAR_DELETE){ engine.project.variables = engine.project.variables.filter(v => v.id !== e.varId); }
  if (e.type === Blockly.Events.VAR_RENAME){ const v = engine.project.variables.find(v => v.id === e.varId); if (v) v.name = e.newName; }
  saveCurrentWorkspace(); markDirty(false); updateEmptyHint();
});
function updateEmptyHint(){ const empty = workspace.getTopBlocks(false).length === 0; $('#ws-empty').classList.toggle('hidden', !empty); $('#ws-empty-name').textContent = editingStage ? 'the Stage' : (selected ? selected.name : ''); }

function select(target){
  saveCurrentWorkspace();
  if (target === 'stage' || target == null){ editingStage = true; selected = null; gizmo.detach(); engine.select(null); }
  else { editingStage = false; selected = target; engine.select(target); if (!engine.playing) gizmo.attach(target.root); }
  loadWorkspaceFor(editingStage ? 'stage' : selected);
  $('#editing-name').textContent = editingStage ? 'Stage' : selected.name;
  $('#editing-thumb').src = editingStage ? '' : (thumbs.get(selected.id) || '');
  $('#obj-form').style.display = editingStage ? 'none' : ''; $('#stage-form').style.display = editingStage ? '' : 'none';
  renderTiles(); refreshInfo(); refreshForm();
  if (typeof sculptMode !== 'undefined' && sculptMode && (!selected || selected.kind !== 'terrain')) setGizmoMode('translate');
  $('#gz-sculpt').classList.toggle('avail', !!selected && selected.kind === 'terrain');
}

/* ---------------- history (undo / redo) ---------------- */
const history = { undo: [], redo: [] };
function commitTerrains(){ for (const o of engine.objects) if (o.kind === 'terrain' && o.commitTerrain) o.commitTerrain(); }
function snapshot(){ saveCurrentWorkspace(); commitTerrains(); return JSON.stringify({ objects: engine.project.objects, stage: engine.project.stage, variables: engine.project.variables, lists: engine.project.lists, sounds: engine.project.sounds, ui: engine.project.ui || [] }); }
let histPending = false, histT;
function pushHistory(){
  if (engine.playing) return;
  history.undo.push(snapshot()); if (history.undo.length > 60) history.undo.shift(); history.redo.length = 0; updateHistoryButtons();
}
function pushHistoryDebounced(){ if (!histPending){ pushHistory(); histPending = true; } clearTimeout(histT); histT = setTimeout(() => { histPending = false; }, 800); }
async function restoreSnapshot(json){
  const snap = JSON.parse(json); const selId = selected ? selected.id : null;
  const currentWs = new Map(engine.project.objects.map(o => [o.id, o.workspace]));
  engine.stop(); engine.clear();
  for (const o of snap.objects) if (currentWs.has(o.id)) o.workspace = currentWs.get(o.id);
  engine.project.objects = snap.objects; Object.assign(engine.project.stage, snap.stage, { workspace: engine.project.stage.workspace }); engine.project.variables = snap.variables; engine.project.lists = snap.lists; engine.project.sounds = snap.sounds; engine.project.ui = snap.ui || []; engine.renderUI(false); uiSelected = null; renderUIList(); refreshUIForm();
  engine.applyStage();
  await Promise.all(engine.project.objects.map(d => engine.addObject(d, false)));
  thumbs.clear(); const o = engine.byId.get(selId); o ? select(o) : select('stage'); markDirty(false); scheduleThumbs();
}
async function undo(){ if (!history.undo.length) return; history.redo.push(snapshot()); await restoreSnapshot(history.undo.pop()); updateHistoryButtons(); toast('Undo'); }
async function redo(){ if (!history.redo.length) return; history.undo.push(snapshot()); await restoreSnapshot(history.redo.pop()); updateHistoryButtons(); toast('Redo'); }
function updateHistoryButtons(){ $('#btn-undo').disabled = !history.undo.length; $('#btn-redo').disabled = !history.redo.length; }
$('#btn-undo').onclick = undo; $('#btn-redo').onclick = redo;

/* ---------------- object tiles ---------------- */
const thumbs = new Map();
let thumbT;
function scheduleThumbs(){ clearTimeout(thumbT); thumbT = setTimeout(refreshThumbs, 250); }
function refreshThumbs(){
  if (engine.playing) return;
  for (const o of engine.objects){ if (o.isClone || !o.ready) continue; try { thumbs.set(o.id, engine.thumbnail(o)); } catch (e) { console.warn('thumb', e); } }
  try { $('#stage-thumb').src = engine.sceneThumbnail(); } catch (e) {}
  $$('.obj-tile').forEach(t => { const src = thumbs.get(t.dataset.id); if (src) t.querySelector('.thumb').src = src; });
  if (selected) $('#editing-thumb').src = thumbs.get(selected.id) || '';
}
function renderTiles(){
  const list = $('#objects-list'); list.innerHTML = '';
  for (const o of engine.objects.filter(o => !o.isClone)){
    const t = document.createElement('div'); t.className = 'obj-tile' + (o === selected ? ' selected' : '') + (o.data.visible === false ? ' hiddenobj' : ''); t.dataset.id = o.id; t.title = o.name; t.draggable = true;
    const pic = document.createElement('img'); pic.className = 'thumb'; pic.alt = ''; pic.src = thumbs.get(o.id) || '';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = o.name;
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'Delete ' + o.name; x.onclick = ev => { ev.stopPropagation(); deleteObject(o); };
    t.append(pic, nm, x); t.onclick = () => select(o); t.ondblclick = () => focusOn(o);
    t.oncontextmenu = ev => { ev.preventDefault(); select(o); showContextMenu(ev.clientX, ev.clientY, o); };
    list.appendChild(t);
  }
  $('#stage-tile').classList.toggle('selected', editingStage);
  if (engine.objects.some(o => !o.isClone && !thumbs.has(o.id))) scheduleThumbs();
}
$('#stage-tile').onclick = () => select('stage');

/* ---------------- info panel + object form ---------------- */
function refreshInfo(){
  const o = selected; const bar = $('#info-bar');
  bar.querySelectorAll('input, button').forEach(i => i.disabled = !o);
  $('#ib-name').value = o ? o.name : 'Stage';
  if (!o) return;
  $('#ib-x').value = fmt(o.data.position[0]); $('#ib-y').value = fmt(o.data.position[1]); $('#ib-z').value = fmt(o.data.position[2]);
  $('#ib-ry').value = fmt(o.data.rotation[1]); $('#ib-size').value = fmt(o.data.scale[1]);
  $('#ib-color').value = o.data.color || '#ffffff';
  const vis = o.data.visible !== false; $('#ib-show').classList.toggle('on', vis); $('#ib-show').querySelector('use').setAttribute('href', vis ? '#i-eye' : '#i-eyeoff'); $('#ib-show').querySelector('span').textContent = vis ? 'Shown' : 'Hidden';
  $('#ib-phys').classList.toggle('on', !!o.data.physics.enabled); $('#ib-phys').disabled = o.isLight;
}
function refreshForm(){
  if (editingStage){ const s = engine.project.stage; $('#s-style').value = s.style || 'auto'; $('#s-time').value = s.time == null ? 12 : s.time; $('#s-time-label').textContent = timeLabel(s.time == null ? 12 : s.time); $('#s-sky').value = s.sky || '#8fd3ff'; $('#s-gravity').value = s.gravity; $('#s-sun').value = s.sun == null ? 1 : s.sun; $('#s-ambient').value = s.ambient == null ? 1 : s.ambient; $('#s-fog').checked = s.fog !== false; $('#s-sky-row').style.display = s.style === 'custom' ? '' : 'none'; $('#s-time-row').style.display = s.style === 'auto' || !s.style ? '' : 'none'; return; }
  const o = selected; if (!o) return; const d = o.data;
  $('#p-name').value = d.name; $('#p-kind').textContent = { box:'Cube', sphere:'Ball', cylinder:'Cylinder', cone:'Cone', capsule:'Capsule', torus:'Ring', plane:'Floor', wedge:'Ramp', model:'Model', light:'Point light', spot:'Spotlight', text:'Text', terrain:'Terrain' }[d.kind] || d.kind;
  [['#p-x',d.position[0]],['#p-y',d.position[1]],['#p-z',d.position[2]],['#p-rx',d.rotation[0]],['#p-ry',d.rotation[1]],['#p-rz',d.rotation[2]],['#p-sx',d.scale[0]],['#p-sy',d.scale[1]],['#p-sz',d.scale[2]]].forEach(([s,v]) => $(s).value = fmt(v));
  $('#p-color').value = d.color || '#ffffff'; $('#p-material').value = d.material || 'normal'; $('#p-opacity').value = d.opacity || 0; $('#p-visible').checked = d.visible !== false;
  $$('#p-texture .sw').forEach(b => b.classList.toggle('on', (b.dataset.t || '') === (d.kind === 'terrain' ? (d.terrain && d.terrain.texture) || '' : d.texture || '')));
  $('#p-phys').checked = !!d.physics.enabled; $('#p-ptype').value = d.physics.type; $('#p-mass').value = d.physics.mass; $('#p-bounce').value = d.physics.bounce; $('#p-friction').value = d.physics.friction; $('#p-upright').checked = !!d.physics.upright; $('#p-collide').checked = d.collide !== false;
  $('#sec-physics').style.display = o.isLight || d.kind === 'text' ? 'none' : ''; $('#sec-look').style.display = o.isLight ? 'none' : '';
  $('#sec-light').style.display = o.isLight ? '' : 'none'; $('#sec-text').style.display = d.kind === 'text' ? '' : 'none'; $('#sec-terrain').style.display = d.kind === 'terrain' ? '' : 'none';
  if (o.isLight){ const L = d.light; $('#p-lcolor').value = L.color; $('#p-lint').value = L.intensity; $('#p-ldist').value = L.distance; $('#p-langle').value = L.angle; $('#p-lshadow').checked = !!L.shadow; $('#p-langle').parentElement.style.display = d.kind === 'spot' ? '' : 'none'; }
  if (d.kind === 'text'){ const T = d.text; $('#p-tcontent').value = T.content; $('#p-tsize').value = T.size; $('#p-tcolor').value = T.color; $('#p-tbg').value = T.bg || '#00000000'; }
  if (d.kind === 'terrain'){ const T = d.terrain; $('#p-trsize').value = T.size; $('#p-trheight').value = T.height; $('#p-trseed').value = T.seed; $('#p-trdetail').value = T.detail; }
}
const timeLabel = t => { t = Number(t); const h = Math.floor(t) % 24, m = Math.round((t % 1) * 60); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
async function applyFromInputs(ev){
  const o = selected; if (!o) return; const d = o.data, n = s => parseFloat($(s).value) || 0;
  pushHistoryDebounced();
  d.position = [n('#p-x'), n('#p-y'), n('#p-z')]; d.rotation = [n('#p-rx'), n('#p-ry'), n('#p-rz')];
  d.scale = [Math.max(0.01, n('#p-sx')), Math.max(0.01, n('#p-sy')), Math.max(0.01, n('#p-sz'))];
  d.color = $('#p-color').value; d.material = $('#p-material').value; d.opacity = n('#p-opacity'); d.visible = $('#p-visible').checked;
  d.physics.enabled = $('#p-phys').checked; d.physics.type = $('#p-ptype').value; d.physics.mass = Math.max(0.01, n('#p-mass')); d.physics.bounce = n('#p-bounce'); d.physics.friction = n('#p-friction'); d.physics.upright = $('#p-upright').checked; d.collide = $('#p-collide').checked;
  if (o.isLight){ Object.assign(d.light, { color: $('#p-lcolor').value, intensity: n('#p-lint'), distance: n('#p-ldist'), angle: n('#p-langle'), shadow: $('#p-lshadow').checked }); }
  if (d.kind === 'text'){ const bg = $('#p-tbg').value; Object.assign(d.text, { content: $('#p-tcontent').value, size: n('#p-tsize'), color: $('#p-tcolor').value, bg: bg === '#000000' && !d.text.bg ? '' : bg }); }
  if (d.kind === 'terrain'){ const T = d.terrain; const changed = T.size !== n('#p-trsize') || T.height !== n('#p-trheight') || T.seed !== n('#p-trseed') || T.detail !== n('#p-trdetail'); Object.assign(T, { size: n('#p-trsize'), height: n('#p-trheight'), seed: n('#p-trseed'), detail: n('#p-trdetail') }); if (changed && ev && ev.type === 'change') { if (T.size !== o.terrainInfo.size || T.detail !== o.terrainInfo.n) o.resetTerrain(); else { o.resetTerrain(); } await o.build(); } }
  o.applyProps(); refreshInfo(); renderTiles(); markDirty();
}
$$('#obj-form input, #obj-form select').forEach(el => { if (el.id === 'p-name') return; el.addEventListener('input', applyFromInputs); el.addEventListener('change', applyFromInputs); });
$('#p-name').addEventListener('change', () => renameObject(selected, $('#p-name').value));
// texture swatches
{ const box = $('#p-texture'); const none = document.createElement('button'); none.className = 'sw on'; none.dataset.t = ''; none.title = 'No texture'; none.textContent = '∅'; box.appendChild(none);
  for (const t of TEXTURE_NAMES){ const b = document.createElement('button'); b.className = 'sw'; b.dataset.t = t; b.title = t; b.style.backgroundImage = 'url(' + textureThumb(t) + ')'; box.appendChild(b); }
  box.addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b || !selected) return; pushHistory(); const t = b.dataset.t; if (selected.kind === 'terrain') selected.data.terrain.texture = t || 'grass'; else { selected.data.texture = t; if (t && selected.data.color && selected.data.color !== '#ffffff') selected.data.color = '#ffffff'; } selected.applyLook(); refreshForm(); refreshInfo(); markDirty(); }); }
$$('#stage-form input, #stage-form select').forEach(el => el.addEventListener('input', () => { pushHistoryDebounced(); const s = engine.project.stage; s.style = $('#s-style').value; s.time = parseFloat($('#s-time').value); s.sky = $('#s-sky').value; s.gravity = parseFloat($('#s-gravity').value) || 0; s.sun = parseFloat($('#s-sun').value); s.ambient = parseFloat($('#s-ambient').value); s.fog = $('#s-fog').checked; engine.applyStage(); refreshForm(); markDirty(); }));
function infoApply(){
  const o = selected; if (!o) return; const d = o.data, n = s => parseFloat($(s).value) || 0;
  pushHistoryDebounced();
  d.position = [n('#ib-x'), n('#ib-y'), n('#ib-z')]; d.rotation[1] = n('#ib-ry');
  const sz = Math.max(0.01, n('#ib-size')), k = sz / (d.scale[1] || 1); d.scale = d.scale.map(v => Math.max(0.01, v * k));
  if (!o.isLight) d.color = $('#ib-color').value; else d.light.color = $('#ib-color').value;
  o.applyProps(); refreshForm(); refreshInfo(); markDirty();
}
$$('#info-bar input[type=number], #info-bar input[type=color]').forEach(el => { el.addEventListener('input', infoApply); el.addEventListener('change', infoApply); });
$('#ib-name').addEventListener('change', () => renameObject(selected, $('#ib-name').value));
$('#ib-name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#ib-show').onclick = () => { if (!selected) return; pushHistory(); selected.data.visible = selected.data.visible === false; selected.applyProps(); refreshInfo(); refreshForm(); renderTiles(); markDirty(); };
$('#ib-phys').onclick = () => { if (!selected) return; pushHistory(); selected.data.physics.enabled = !selected.data.physics.enabled; refreshInfo(); refreshForm(); markDirty(); };
$('#p-dup').onclick = () => selected && duplicateObject(selected);
$('#p-del').onclick = () => selected && deleteObject(selected);
$('#p-drop').onclick = () => { if (!selected) return; pushHistory(); engine.dropToGround(selected); refreshInfo(); refreshForm(); markDirty(); };

function uniqueName(base){
  base = base.replace(/\d+$/, '') || 'Object'; const names = new Set(engine.project.objects.map(o => o.name));
  if (!names.has(base)) return base; let i = 2; while (names.has(base + i)) i++; return base + i;
}
function renameObject(o, name){
  name = String(name || '').trim().slice(0, 40); if (!o || !name || name === o.name) { refreshForm(); refreshInfo(); return; }
  pushHistory();
  const old = o.name; if (engine.project.objects.some(p => p.name === name)) name = uniqueName(name);
  o.name = o.data.name = name; thumbs.delete(o.id);
  const fix = json => { if (!json) return; const walk = b => { if (!b) return; if (b.fields) for (const k in b.fields) if (b.fields[k] === old) b.fields[k] = name; if (b.inputs) for (const k in b.inputs){ walk(b.inputs[k].block); walk(b.inputs[k].shadow); } walk(b.next && b.next.block); }; (json.blocks && json.blocks.blocks || []).forEach(walk); };
  saveCurrentWorkspace(); engine.project.objects.forEach(p => fix(p.workspace)); fix(engine.project.stage.workspace);
  loadWorkspaceFor(editingStage ? 'stage' : selected);
  $('#editing-name').textContent = name; renderTiles(); refreshInfo(); refreshForm(); markDirty();
}
function deleteObject(o){
  if (!o || engine.playing) return;
  pushHistory();
  engine.removeObject(o);
  if (selected === o) { selected = null; gizmo.detach(); const next = engine.objects.find(x => !x.isClone && x.kind !== 'plane' && x.kind !== 'terrain') || engine.objects[0]; next ? select(next) : select('stage'); } else renderTiles();
  markDirty(); toast('Deleted ' + o.name);
}
async function duplicateObject(o){
  pushHistory();
  const data = JSON.parse(JSON.stringify(o.data)); data.id = newId(); data.name = uniqueName(o.name); data.position[0] += 1.5;
  const c = await engine.addObject(data); select(c); markDirty();
}
function focusOn(o){ const box = o.worldBox(); const c = new THREE.Vector3(); box.getCenter(c); const sz = new THREE.Vector3(); box.getSize(sz); engine.controls.target.copy(c); const d = Math.max(3, sz.length() * 1.4); engine.camera.position.copy(c).add(new THREE.Vector3(d * 0.7, d * 0.6, d * 0.9)); }

/* ---------------- add objects ---------------- */
function spawnPos(){ const p = engine.controls.target.clone(); return [fmt(p.x + (Math.random() - 0.5) * 2), 0.5, fmt(p.z + (Math.random() - 0.5) * 2)]; }
async function addData(data){ pushHistory(); const o = await engine.addObject(data); if (o.kind !== 'plane' && o.kind !== 'terrain' && !o.isLight && o.kind !== 'text') engine.dropToGround(o); select(o); markDirty(); return o; }
async function addShape(kind){
  const names = { box:'Cube', sphere:'Ball', cylinder:'Cylinder', cone:'Cone', capsule:'Capsule', torus:'Ring', wedge:'Ramp', plane:'Floor', light:'Light', spot:'Spotlight', text:'Text', terrain:'Terrain' };
  const data = defaultObject(kind, uniqueName(names[kind] || kind));
  if (!data.color && !['model','light','spot','text'].includes(kind)) data.color = '#4c97ff';
  if (data.color) data.color = PALETTE[engine.project.objects.length % PALETTE.length];
  data.position = spawnPos();
  if (kind === 'plane') { data.scale = [8, 0.2, 8]; data.position[1] = 0.1; data.color = '#ffffff'; data.texture = 'tiles'; }
  if (kind === 'wedge') { data.scale = [3, 1.5, 3]; data.position[1] = 0.75; }
  if (kind === 'capsule') data.position[1] = 0.6;
  if (kind === 'light' || kind === 'spot') data.position[1] = 3;
  if (kind === 'text') data.position[1] = 2;
  if (kind === 'terrain') { data.position = [0, -0.5, 0]; data.color = '#ffffff'; data.terrain.size = 120; data.terrain.detail = 96; }
  const o = await addData(data); toast('Added ' + data.name + (kind === 'terrain' ? ' — Sculpt mode is on: drag on the ground to shape it' : '')); if (kind === 'terrain') setGizmoMode('sculpt'); return o;
}
async function addSmart(key){
  const s = SMART.find(x => x.key === key); if (!s) return;
  const p = spawnPos(); const data = s.build(p); data.id = newId(); data.name = uniqueName(data.name);
  for (const v of (s.variables || [])) if (!engine.project.variables.some(x => x.name === v)) engine.project.variables.push({ name: v, id: v });
  const o = await addData(data); toast(s.label + ' added — ' + s.hint);
  return o;
}
async function addModel(url, name, meta={}){
  const data = defaultObject('model', uniqueName(name.replace(/[^\w ]/g, '').trim() || 'Model')); data.modelUrl = url; data.color = '';
  const p = engine.controls.target.clone(); data.position = [fmt(p.x), 0.5, fmt(p.z)];
  if (meta.scale) data.scale = [meta.scale, meta.scale, meta.scale];
  const o = await addData(data);
  toast('Added ' + data.name + (o.clips.length ? ' — it has ' + o.clips.length + ' animation(s): Looks → play animation' : ''));
  return o;
}
$('#btn-add').onclick = e => { e.stopPropagation(); $('#add-menu').classList.toggle('hidden'); };
{ const grid = $('#smart-grid'); for (const s of SMART){ const b = document.createElement('button'); b.dataset.smart = s.key; b.innerHTML = '<span class="ico"></span><span></span>'; b.firstChild.textContent = s.icon; b.lastChild.textContent = s.label; b.title = s.hint; grid.appendChild(b); } }
$('#add-menu').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; $('#add-menu').classList.add('hidden');
  if (b.dataset.kind) addShape(b.dataset.kind); else if (b.dataset.smart) addSmart(b.dataset.smart); else if (b.dataset.act === 'workshop') openWorkshop(); else if (b.dataset.act === 'upload') $('#file-model').click();
});
$('#file-model').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  toast('Uploading ' + f.name + '…');
  try {
    const r = await fetch('/api/workshop/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.json());
    if (!r.ok) throw new Error(r.error || 'upload failed');
    await addModel(r.local, f.name.replace(/\.\w+$/, ''));
  } catch (err) { toast('Upload failed: ' + err.message, true); }
};
$('#file-sound').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const r = await fetch('/api/workshop/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.json());
    if (!r.ok) throw new Error(r.error || 'upload failed');
    const name = uniqueSoundName(f.name.replace(/\.\w+$/, '')); engine.project.sounds.push({ name, url: r.local }); markDirty(); workspace.getToolbox().refreshSelection(); toast('Sound "' + name + '" added — find it in play sound ▾');
  } catch (err) { toast('Upload failed: ' + err.message, true); }
};
function uniqueSoundName(base){ const names = new Set(engine.project.sounds.map(s => s.name)); if (!names.has(base)) return base; let i = 2; while (names.has(base + i)) i++; return base + i; }

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
    $('#ws-note').textContent = r.polyEnabled ? 'Sources: Khronos sample models + poly.pizza (CC0).' : 'Showing the built-in Khronos sample library. For thousands of free low-poly models, get a free API key at poly.pizza and start the server with POLY_PIZZA_KEY=…';
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
  } catch (err) { $('#ws-status').textContent = 'Search failed — is the server running?'; }
}

/* ---------------- viewport: gizmo, direct drag, look, context menu ---------------- */
const gizmo = new TransformControls(engine.camera, engine.canvas);
gizmo.setSize(0.85); const gizmoHelper = gizmo.getHelper ? gizmo.getHelper() : gizmo; engine.scene.add(gizmoHelper); engine._gizmoHelper = gizmoHelper;
// drop the plane/center handles of the move tool: objects are dragged directly, arrows are for exact axis moves
try { const g = gizmo._gizmo; for (const grp of [g.gizmo.translate, g.picker.translate, g.helper.translate]) for (const ch of grp.children.slice()) if (['XY','YZ','XZ','XYZ'].includes(ch.name)) grp.remove(ch); } catch (e) { console.warn('gizmo trim', e); }
gizmo.addEventListener('dragging-changed', e => { engine.controls.enabled = !e.value; if (e.value) pushHistory(); else if (selected) syncFromGizmo(true); });
gizmo.addEventListener('objectChange', () => { if (selected) syncFromGizmo(false); });
function syncFromGizmo(final=true){
  const o = selected, r = o.root; o.data.position = r.position.toArray().map(fmt); o.data.rotation = [r.rotation.x, r.rotation.y, r.rotation.z].map(v => fmt(v * 180 / Math.PI));
  o.data.scale = r.scale.toArray().map(v => Math.max(0.01, fmt(v))); if (o.data.texture || o.kind === 'terrain') o.applyLook(); refreshInfo(); if (final) { refreshForm(); markDirty(); }
}
let snap = false;
let sculptMode = false;
const terrainTool = { tool: 'raise', size: 5, strength: 4, color: '#6fb04a' };
function setGizmoMode(m){
  sculptMode = m === 'sculpt';
  if (sculptMode){ if (!selected || selected.kind !== 'terrain'){ const t = engine.objects.find(o => o.kind === 'terrain' && !o.isClone); if (t) select(t); else { toast('Add a Terrain first (+ → World → Terrain)', true); return setGizmoMode('translate'); } } gizmo.detach(); }
  else { gizmo.setMode(m); if (selected && !engine.playing) gizmo.attach(selected.root); }
  $$('.gz[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('#terrain-tools').classList.toggle('hidden', !sculptMode); $('#viewport-wrap').classList.toggle('sculpting', sculptMode);
  engine.brush.visible = false; engine.controls.enabled = true;
}
$$('#terrain-tools [data-tool]').forEach(b => b.onclick = () => { terrainTool.tool = b.dataset.tool; $$('#terrain-tools [data-tool]').forEach(x => x.classList.toggle('on', x === b)); $('#tt-paint-row').style.display = ''; });
$('#tt-size').oninput = e => terrainTool.size = parseFloat(e.target.value); $('#tt-strength').oninput = e => terrainTool.strength = parseFloat(e.target.value);
$$('#terrain-tools [data-color]').forEach(b => b.onclick = () => { terrainTool.color = b.dataset.color; $$('#terrain-tools [data-color]').forEach(x => x.classList.toggle('on', x === b)); terrainTool.tool = 'paint'; $$('#terrain-tools [data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'paint')); });
$('#tt-color').oninput = e => { terrainTool.color = e.target.value; terrainTool.tool = 'paint'; $$('#terrain-tools [data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'paint')); $$('#terrain-tools [data-color]').forEach(x => x.classList.remove('on')); };
$('#tt-random').onclick = async () => { const o = selected; if (!o || o.kind !== 'terrain') return; pushHistory(); o.resetTerrain(); o.data.terrain.seed = Math.floor(Math.random() * 9999); await o.build(); refreshForm(); markDirty(); };
$('#tt-flat').onclick = async () => { const o = selected; if (!o || o.kind !== 'terrain') return; pushHistory(); o.resetTerrain(); const keep = o.data.terrain.height; o.data.terrain.height = 0; await o.build(); o.data.terrain.height = keep; o.terrainDirty = true; o.commitTerrain(); refreshForm(); markDirty(); };
let sculpting = null;   // { flattenTo }
function sculptAt(e){
  const o = selected; if (!o || o.kind !== 'terrain') return false;
  const p = engine.pickTerrain(o, e.clientX, e.clientY);
  engine.brush.visible = !!p; if (!p) return false;
  engine.brush.position.copy(p).add(new THREE.Vector3(0, 0.08, 0)); engine.brush.scale.setScalar(terrainTool.size);
  if (!sculpting) return true;
  let tool = terrainTool.tool; if (e.shiftKey && tool === 'raise') tool = 'lower';
  if (tool === 'flatten' && sculpting.flattenTo == null) sculpting.flattenTo = (p.y - o.root.position.y) / (o.root.scale.y || 1);
  o.sculpt(p, terrainTool.size, terrainTool.strength, tool, terrainTool.color, sculpting.flattenTo);
  return true;
}
$$('.gz[data-mode]').forEach(b => b.onclick = () => setGizmoMode(b.dataset.mode));
function setSnap(on){ snap = on; $('#gz-snap').classList.toggle('on', snap); gizmo.setTranslationSnap(snap ? 0.5 : null); gizmo.setRotationSnap(snap ? THREE.MathUtils.degToRad(15) : null); gizmo.setScaleSnap(snap ? 0.25 : null); }
$('#gz-snap').onclick = () => setSnap(!snap);
$('#gz-focus').onclick = () => selected && focusOn(selected);
$('#gz-drop').onclick = () => $('#p-drop').click();

const canvas = engine.canvas;
let drag = null;   // { obj, plane, offset, moved, start:[x,y], vertical }
let look = null;   // right-drag look-around { x, y, moved }
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointermove', e => {
  if (engine.playing) return;
  if (sculptMode && !look){ sculptAt(e); if (sculpting) return; }
  if (look){ const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 0) look.moved = true; engine.lookAround(dx, dy); return; }
  if (drag){
    if (!drag.moved){ if (Math.hypot(e.clientX - drag.start[0], e.clientY - drag.start[1]) < 4) return; drag.moved = true; engine.controls.enabled = false; pushHistory(); }
    const vertical = e.shiftKey;
    if (vertical !== drag.vertical){ drag.vertical = vertical; drag.plane = dragPlane(drag.obj, vertical); const hit = rayPlane(e, drag.plane); if (hit) drag.offset = hit.sub(drag.obj.root.position); }
    const hit = rayPlane(e, drag.plane); if (!hit) return;
    const p = hit.sub(drag.offset); const o = drag.obj;
    if (vertical) o.data.position[1] = snap ? Math.round(p.y * 2) / 2 : fmt(p.y); else { o.data.position[0] = snap ? Math.round(p.x * 2) / 2 : fmt(p.x); o.data.position[2] = snap ? Math.round(p.z * 2) / 2 : fmt(p.z); }
    o.applyProps(); refreshInfo(); canvas.style.cursor = vertical ? 'ns-resize' : 'move';
    return;
  }
  if (gizmo.dragging) return;
  engine.controls.enabled = !gizmo.axis;
  const h = gizmo.axis ? null : engine.pick(e.clientX, e.clientY);
  engine.hovered = h && h !== selected ? h : null; canvas.style.cursor = gizmo.axis ? 'grab' : h ? 'pointer' : '';
});
function dragPlane(o, vertical){ const n = vertical ? engine.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate() : new THREE.Vector3(0, 1, 0); return new THREE.Plane().setFromNormalAndCoplanarPoint(n, o.root.position); }
function rayPlane(e, plane){ engine.raycaster.setFromCamera(engine.ndc(e.clientX, e.clientY), engine.camera); const p = new THREE.Vector3(); return engine.raycaster.ray.intersectPlane(plane, p) ? p : null; }
canvas.addEventListener('pointerdown', e => {
  canvas.focus({ preventScroll: true }); $$('.dropdown, .add-menu, .ctx-menu').forEach(d => d.classList.add('hidden'));
  if (engine.playing) return;
  if (e.button === 2){ look = { x: e.clientX, y: e.clientY, moved: false }; engine.controls.enabled = false; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0 || gizmo.axis) return;
  if (sculptMode){ const t = selected && selected.kind === 'terrain' && engine.pickTerrain(selected, e.clientX, e.clientY); if (t){ pushHistory(); sculpting = { flattenTo: null }; engine.controls.enabled = false; canvas.setPointerCapture(e.pointerId); sculptAt(e); } return; }
  const o = engine.pick(e.clientX, e.clientY);
  if (o){ const plane = dragPlane(o, e.shiftKey); const hit = rayPlane(e, plane); drag = { obj: o, plane, offset: hit ? hit.sub(o.root.position) : new THREE.Vector3(), moved: false, start: [e.clientX, e.clientY], vertical: e.shiftKey }; }
  else drag = { obj: null, start: [e.clientX, e.clientY], moved: false };
});
canvas.addEventListener('pointerup', e => {
  if (sculpting){ sculpting = null; engine.controls.enabled = true; try { canvas.releasePointerCapture(e.pointerId); } catch (x) {} if (selected && selected.commitTerrain) selected.commitTerrain(); markDirty(); return; }
  if (look){ const moved = look.moved; look = null; engine.controls.enabled = true; engine.fly.keys.clear(); try { canvas.releasePointerCapture(e.pointerId); } catch (x) {}
    if (!moved){ const o = engine.pick(e.clientX, e.clientY); if (o) { select(o); showContextMenu(e.clientX, e.clientY, o); } } return; }
  if (!drag) return;
  const d = drag; drag = null; canvas.style.cursor = ''; engine.controls.enabled = !gizmo.axis;
  if (d.obj && d.moved){ syncFromGizmo(true); return; }
  if (Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) > 4) return;      // orbited, not a click
  if (d.obj) select(d.obj.original.isClone ? d.obj : d.obj.original); else select('stage');
});
window.addEventListener('pointerup', () => { setTimeout(() => { if (!gizmo.dragging && !drag && !look && !engine.playing) engine.controls.enabled = true; }, 0); });
canvas.addEventListener('dblclick', e => { if (sculptMode) return; const o = engine.pick(e.clientX, e.clientY); if (o) focusOn(o); });
canvas.addEventListener('pointerleave', () => { engine.brush.visible = false; });
// scroll-zoom stays with OrbitControls; keys:
window.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) || ''; const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); saveProject(); return; }
  if (typing || engine.playing) return;
  const inViewport = $('#viewport-wrap').matches(':hover') || document.activeElement === canvas;
  if (look){ const k = e.key.toLowerCase(); if ('wasdqe'.includes(k) || k === 'shift'){ engine.fly.keys.add(k); e.preventDefault(); } return; }
  if (!inViewport) return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.metaKey || e.ctrlKey) && k === 'd' && selected){ e.preventDefault(); duplicateObject(selected); return; }
  if (k === 'w') setGizmoMode('translate'); else if (k === 'e') setGizmoMode('rotate'); else if (k === 'r') setGizmoMode('scale'); else if (k === 't') setGizmoMode('sculpt');
  else if (k === 'f' && selected) focusOn(selected); else if (k === 'g') setSnap(!snap);
  else if (k === 'escape') select('stage');
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected){ e.preventDefault(); deleteObject(selected); }
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); engine.fly.keys.delete(k); });
// context menu
function showContextMenu(x, y, o){
  const m = $('#ctx-menu'); m.classList.remove('hidden'); m.style.left = Math.min(x, innerWidth - 200) + 'px'; m.style.top = Math.min(y, innerHeight - 260) + 'px';
  m.querySelector('.ctx-title').textContent = o.name;
  m.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; m.classList.add('hidden');
    switch (b.dataset.act){
      case 'dup': duplicateObject(o); break; case 'del': deleteObject(o); break; case 'focus': focusOn(o); break;
      case 'drop': pushHistory(); engine.dropToGround(o); refreshInfo(); refreshForm(); markDirty(); break;
      case 'reset': pushHistory(); o.data.rotation = [0,0,0]; o.applyProps(); refreshInfo(); refreshForm(); markDirty(); break;
      case 'hide': pushHistory(); o.data.visible = o.data.visible === false; o.applyProps(); refreshInfo(); refreshForm(); renderTiles(); markDirty(); break;
      case 'rename': ask('Rename object:', o.name).then(n => n && renameObject(o, n)); break;
      case 'code': select(o); $$('.tab')[0].click(); break; case 'settings': select(o); $$('.tab')[1].click(); break;
    } };
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#ctx-menu')) $('#ctx-menu').classList.add('hidden'); });

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
      scripts.forEach((s, i) => { s.id = i; try { s.fn = new GenFn('self', 'R', 'V', '_thread', '_arg', 'L', s.code); } catch (e) { errors.push(label + ': ' + e.message); s.fn = function*(){}; } });
      return scripts;
    } catch (e) { errors.push(label + ': ' + e.message); return []; }
    finally { ws.dispose(); }
  };
  out.stage = compile(engine.project.stage.workspace, 'Stage');
  for (const o of engine.objects) if (!o.isClone) out[o.id] = compile(o.data.workspace, o.name);
  if (errors.length) toast('Problem in scripts: ' + errors[0], true);
  return out;
}
function play(){ if (engine.playing) engine.stop(); $('#ctx-menu').classList.add('hidden'); engine.play(compileAll()); canvas.focus(); }
$('#btn-play').onclick = play;
$('#btn-stop').onclick = () => { engine.stop(); };
$('#btn-big').onclick = () => { $('.layout').classList.toggle('big'); setTimeout(() => Blockly.svgResize(workspace), 50); };

/* ---------------- splitter ---------------- */
{ const sp = $('#splitter'), stage = $('.stage-pane'); let w = parseInt(localStorage.getItem('bw3d_stagew') || '0'); if (w) stage.style.flexBasis = w + 'px';
  let dragging = false; sp.addEventListener('pointerdown', e => { dragging = true; sp.setPointerCapture(e.pointerId); });
  sp.addEventListener('pointermove', e => { if (!dragging) return; const nw = Math.max(380, Math.min(innerWidth * 0.7, innerWidth - e.clientX - 10)); stage.style.flexBasis = nw + 'px'; Blockly.svgResize(workspace); });
  sp.addEventListener('pointerup', () => { dragging = false; localStorage.setItem('bw3d_stagew', parseInt(stage.style.flexBasis) || 0); }); }

/* ---------------- tabs / menus ---------------- */
$$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x => x.classList.toggle('active', x === t)); const id = { code: 'code-area', object: 'object-panel', ui: 'ui-panel' }[t.dataset.tab]; $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id)); setUIEdit(t.dataset.tab === 'ui'); if (t.dataset.tab === 'code') Blockly.svgResize(workspace); else if (t.dataset.tab === 'object') refreshForm(); else { renderUIList(); refreshUIForm(); } });
$('#btn-file').onclick = e => { e.stopPropagation(); $('#file-menu').classList.toggle('hidden'); $('#examples-menu').classList.add('hidden'); };
$('#btn-examples').onclick = e => { e.stopPropagation(); $('#examples-menu').classList.toggle('hidden'); $('#file-menu').classList.add('hidden'); };
document.addEventListener('click', e => { if (!e.target.closest('.menu-item, .add-wrap')) $$('.dropdown, .add-menu').forEach(d => d.classList.add('hidden')); });
$$('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hidden'));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'prompt-modal') m.classList.add('hidden'); }));
$('#btn-help').onclick = () => $('#help-modal').classList.remove('hidden');
for (const ex of EXAMPLES){ const b = document.createElement('button'); b.textContent = ex.name; b.onclick = async () => { await loadProject(ex.build()); toast('Loaded example "' + ex.name + '" — press ▶'); }; $('#examples-menu').appendChild(b); }
$$('#file-menu [data-act]').forEach(b => b.onclick = () => ({ new: newProject, open: openDialog, save: saveProject, saveas: saveAs, download: downloadProject, upload: () => $('#file-project').click(), export: exportGame })[b.dataset.act]());

/* ---------------- project files ---------------- */
function markDirty(thumb=true){ dirty = true; $('#save-status').textContent = 'Unsaved changes'; scheduleAutosave(); if (thumb) scheduleThumbs(); }
let autosaveT; function scheduleAutosave(){ clearTimeout(autosaveT); autosaveT = setTimeout(() => { try { localStorage.setItem('bw3d_draft', JSON.stringify(serialize())); } catch(e){} }, 1500); }
function serialize(){ saveCurrentWorkspace(); commitTerrains(); engine.project.name = $('#project-name').value.trim() || 'My Game'; engine.project.camera = { position: engine.camera.position.toArray(), target: engine.controls.target.toArray() }; return engine.project; }
async function loadProject(p){
  engine.stop(); selected = null; editingStage = false; gizmo.detach(); history.undo.length = 0; history.redo.length = 0; updateHistoryButtons();
  await engine.loadProject(p);
  $('#project-name').value = engine.project.name || 'My Game';
  const first = engine.objects.find(o => o.name === 'Player') || engine.objects.find(o => o.kind !== 'plane' && o.kind !== 'terrain') || engine.objects[0];
  first ? select(first) : select('stage');
  if (!engine.project.ui) engine.project.ui = []; uiSelected = null; if (typeof renderUIList === 'function'){ renderUIList(); refreshUIForm(); }
  dirty = false; $('#save-status').textContent = ''; thumbs.clear(); scheduleThumbs();
}
async function newProject(){ if (dirty && !confirm('Start a new project? Your current one stays in File → Open if you saved it.')) return; await loadProject(newProjectData()); }
const LOCAL_KEY = 'bw3d_projects';
function localProjects(){ try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; } }
function saveLocal(p){ const all = localProjects(); all[p.name] = { data: p, modified: Date.now() }; try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
async function saveProject(){
  const p = serialize();
  const local = saveLocal(p);
  let server = false;
  try { const r = await fetch('/api/projects/' + encodeURIComponent(p.name), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }); server = r.ok; } catch (e) {}
  if (!local && !server) return toast('Could not save — the project is too big for this browser and the server is offline', true);
  dirty = false; $('#save-status').textContent = 'Saved'; toast('Saved "' + p.name + '"' + (server ? '' : ' in this browser'));
}
async function saveAs(){ const n = await ask('Save project as:', $('#project-name').value); if (n) { $('#project-name').value = n; saveProject(); } }
async function openDialog(){
  const local = localProjects(); const items = Object.keys(local).map(n => ({ name: n, modified: local[n].modified, src: 'browser', data: local[n].data }));
  try { const list = await fetch('/api/projects').then(r => r.json()); for (const p of list) if (!items.some(i => i.name === p.name && i.modified >= p.modified)) items.push({ name: p.name, modified: p.modified, src: 'server' }); } catch (e) {}
  items.sort((a, b) => b.modified - a.modified);
  const box = $('#open-list'); box.innerHTML = items.length ? '' : '<p>No saved projects yet. Use File → Save to keep one.</p>';
  for (const p of items){
    const b = document.createElement('button'); b.innerHTML = '<span></span><span class="d"></span>';
    b.firstChild.textContent = p.name; b.firstChild.insertAdjacentHTML('beforeend', '<span class="src"></span>'); b.querySelector('.src').textContent = p.src; b.lastChild.textContent = new Date(p.modified).toLocaleString();
    b.onclick = async () => { $('#open-modal').classList.add('hidden'); const data = p.data || await fetch('/api/projects/' + encodeURIComponent(p.name)).then(r => r.json()); await loadProject(data); };
    box.appendChild(b);
  }
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
window.addEventListener('pagehide', () => { try { localStorage.setItem('bw3d_draft', JSON.stringify(serialize())); } catch (e) {} });

/* ---------------- UI maker ---------------- */
let uiSelected = null, uiEdit = false;
const UI_DEFAULTS = {
  label:  { text: 'Score: 0', x: 3, y: 3, w: 30, h: 8, size: 5, color: '#ffffff', bg: '' },
  button: { text: 'Go!', x: 40, y: 85, w: 20, h: 10, size: 5, color: '#ffffff', bg: '#7c5ce6' },
  bar:    { text: 'health', x: 3, y: 12, w: 30, h: 5, size: 3, color: '#4cbf56', bg: 'rgba(0,0,0,.45)', value: 100 },
  panel:  { text: 'Level 1', x: 65, y: 3, w: 32, h: 20, size: 4, color: '#ffffff', bg: 'rgba(0,0,0,.45)' },
  image:  { text: '', x: 80, y: 78, w: 16, h: 18, size: 4, color: '#ffffff', bg: '', url: '' }
};
function uiUniqueName(base){ const names = new Set(engine.project.ui.map(u => u.name)); if (!names.has(base)) return base; let i = 2; while (names.has(base + i)) i++; return base + i; }
function addUI(type){
  pushHistory();
  const el = Object.assign({ id: newId(), name: uiUniqueName(type), type, visible: true, radius: type === 'button' ? 14 : 10 }, UI_DEFAULTS[type]);
  engine.project.ui.push(el); engine.renderUI(false); setUIEdit(true); selectUI(el); markDirty(false);
  if (type === 'image') $('#file-image').click();
}
function selectUI(el){ uiSelected = el; renderUIList(); refreshUIForm(); if (engine._uiEls) for (const [id, d] of engine._uiEls) d.classList.toggle('sel', !!el && id === el.id); }
function setUIEdit(on){ uiEdit = on; const box = $('#hud .bw-ui'); if (box) box.classList.toggle('editing', on && !engine.playing); if (!on) selectUI(null); }
function renderUIList(){
  const list = $('#ui-list'); list.innerHTML = '';
  for (const u of engine.project.ui || []){
    const d = document.createElement('div'); d.className = 'ui-item' + (u === uiSelected ? ' selected' : ''); d.innerHTML = '<span class="t"></span><span class="nm"></span><span class="eye"></span>';
    d.querySelector('.t').textContent = u.type; d.querySelector('.nm').textContent = u.name; d.querySelector('.eye').textContent = u.visible === false ? '🚫' : '';
    d.onclick = () => selectUI(u); list.appendChild(d);
  }
  if (!engine.project.ui.length) list.innerHTML = '<p class="ui-help">Nothing yet — add a label or button above.</p>';
}
function refreshUIForm(){
  const f = $('#ui-form'), u = uiSelected; f.style.visibility = u ? '' : 'hidden'; if (!u) return;
  $('#u-kind').textContent = u.type; $('#u-name').value = u.name; $('#u-text').value = u.text || ''; $('#u-text-row').style.display = u.type === 'image' ? 'none' : '';
  $('#u-x').value = u.x; $('#u-y').value = u.y; $('#u-w').value = u.w; $('#u-h').value = u.h; $('#u-size').value = u.size; $('#u-radius').value = u.radius == null ? 10 : u.radius;
  $('#u-color').value = /^#[0-9a-f]{6}$/i.test(u.color || '') ? u.color : '#ffffff'; const bgHex = /^#[0-9a-f]{6}$/i.test(u.bg || '') ? u.bg : '#222633'; $('#u-bg').value = bgHex; $('#u-bgon').checked = !!u.bg;
  $('#u-value-row').style.display = u.type === 'bar' ? '' : 'none'; $('#u-value').value = u.value == null ? 100 : u.value; $('#u-visible').checked = u.visible !== false; $('#u-image-row').style.display = u.type === 'image' ? '' : 'none';
}
function applyUIForm(){
  const u = uiSelected; if (!u) return; pushHistoryDebounced(); const n = s => parseFloat($(s).value) || 0;
  u.text = $('#u-text').value; u.x = n('#u-x'); u.y = n('#u-y'); u.w = Math.max(1, n('#u-w')); u.h = Math.max(1, n('#u-h')); u.size = Math.max(1, n('#u-size')); u.radius = n('#u-radius');
  u.color = $('#u-color').value; u.bg = $('#u-bgon').checked ? $('#u-bg').value : ''; u.value = n('#u-value'); u.visible = $('#u-visible').checked;
  engine.updateUI(u); renderUIList(); markDirty(false);
}
$$('#ui-form input').forEach(el => { if (el.id === 'u-name') return; el.addEventListener('input', applyUIForm); el.addEventListener('change', applyUIForm); });
$('#u-name').addEventListener('change', () => { const u = uiSelected; if (!u) return; const name = $('#u-name').value.trim().slice(0, 30); if (!name || name === u.name) return refreshUIForm(); pushHistory(); const old = u.name; u.name = engine.project.ui.some(x => x !== u && x.name === name) ? uiUniqueName(name) : name;
  const fix = json => { if (!json) return; const walk = b => { if (!b) return; if (b.fields) for (const k in b.fields) if (k === 'NAME' && b.fields[k] === old && /^ui_/.test(b.type || '')) b.fields[k] = u.name; if (b.inputs) for (const k in b.inputs){ walk(b.inputs[k].block); walk(b.inputs[k].shadow); } walk(b.next && b.next.block); }; (json.blocks && json.blocks.blocks || []).forEach(walk); };
  saveCurrentWorkspace(); engine.project.objects.forEach(p => fix(p.workspace)); fix(engine.project.stage.workspace); loadWorkspaceFor(editingStage ? 'stage' : selected); engine.renderUI(false); setUIEdit(true); selectUI(u); markDirty(false); });
$$('#ui-panel [data-ui]').forEach(b => b.onclick = () => addUI(b.dataset.ui));
$('#u-del').onclick = () => { const u = uiSelected; if (!u) return; pushHistory(); engine.project.ui = engine.project.ui.filter(x => x !== u); engine.renderUI(false); setUIEdit(true); selectUI(null); markDirty(false); };
$('#u-dup').onclick = () => { const u = uiSelected; if (!u) return; pushHistory(); const c = Object.assign({}, u, { id: newId(), name: uiUniqueName(u.name), y: Math.min(90, u.y + u.h + 2) }); engine.project.ui.push(c); engine.renderUI(false); setUIEdit(true); selectUI(c); markDirty(false); };
$('#u-image').onclick = () => $('#file-image').click();
$('#file-image').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = ''; const u = uiSelected; if (!u || u.type !== 'image') return;
  try { const r = await fetch('/api/workshop/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.json()); if (!r.ok) throw new Error(r.error || 'upload failed'); u.url = r.local; engine.updateUI(u); markDirty(false); toast('Image added'); }
  catch (err) { toast('Upload failed: ' + err.message, true); }
};
// drag / resize UI elements on the viewport
{ let ud = null;
  $('#hud').addEventListener('pointerdown', e => {
    if (!uiEdit || engine.playing) return; const d = e.target.closest('.bw-el'); if (!d) return;
    const u = engine.project.ui.find(x => x.id === d.dataset.id); if (!u) return; e.preventDefault(); e.stopPropagation();
    selectUI(u); pushHistory();
    const r = $('#hud').getBoundingClientRect();
    ud = { u, r, resize: e.target.classList.contains('bw-rs'), sx: e.clientX, sy: e.clientY, x: u.x, y: u.y, w: u.w, h: u.h };
    $('#hud').setPointerCapture(e.pointerId);
  });
  $('#hud').addEventListener('pointermove', e => {
    if (!ud) return; const dx = (e.clientX - ud.sx) / ud.r.width * 100, dy = (e.clientY - ud.sy) / ud.r.height * 100;
    if (ud.resize){ ud.u.w = Math.max(2, Math.round(ud.w + dx)); ud.u.h = Math.max(2, Math.round(ud.h + dy)); }
    else { ud.u.x = Math.max(0, Math.min(100 - ud.u.w, Math.round(ud.x + dx))); ud.u.y = Math.max(0, Math.min(100 - ud.u.h, Math.round(ud.y + dy))); }
    engine.updateUI(ud.u); refreshUIForm();
  });
  const end = e => { if (!ud) return; ud = null; try { $('#hud').releasePointerCapture(e.pointerId); } catch (x) {} markDirty(false); };
  $('#hud').addEventListener('pointerup', end); $('#hud').addEventListener('pointercancel', end);
}
engine.onPlayState = (orig => on => { orig(on); const box = $('#hud .bw-ui'); if (box) box.classList.toggle('editing', uiEdit && !on); if (!on && uiEdit) selectUI(uiSelected && engine.project.ui.find(x => x.id === uiSelected.id) || null); })(engine.onPlayState);

/* ---------------- boot ---------------- */
(async () => {
  let draft = null; try { draft = JSON.parse(localStorage.getItem('bw3d_draft') || 'null'); } catch(e){}
  await loadProject(draft && draft.objects && draft.objects.length ? draft : newProjectData());
  if (draft) $('#save-status').textContent = 'Restored your last session';
  renderUIList(); refreshUIForm();
  new ResizeObserver(() => Blockly.svgResize(workspace)).observe($('#blockly'));
  updateHistoryButtons();
  window.BW = { engine, workspace, select, addShape, addSmart, addModel, play, loadProject, compileAll, serialize, undo, redo, gizmo, state: () => ({ sculptMode, sculpting: !!sculpting, look: !!look, drag: !!drag, axis: gizmo.axis }) };
})();
