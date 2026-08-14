// ---------- item helpers ----------
const ITEMS = window.MC_ITEMS;           // id -> {n: name, d: displayName}
const TEX = window.MC_TEX;               // name -> texture url
const RECIPES = window.MC_RECIPES;       // [{r: resultId, c: count, s: shape | i: ingredients}]
const byName = {};
for (const [id, it] of Object.entries(ITEMS)) byName[it.n] = { id: Number(id), ...it };
const recipeByResult = {};
for (const r of RECIPES) recipeByResult[r.r] = r;

function iconUrl(name) { return TEX[name] || 'tex/item/barrier.png'; }
function iconById(id) { return ITEMS[id] ? iconUrl(ITEMS[id].n) : 'tex/item/barrier.png'; }
function dispById(id) { return ITEMS[id] ? ITEMS[id].d : '?'; }
function slotEl(name, title, onclick) {
  const d = document.createElement('div');
  d.className = 'slot';
  d.title = title || (byName[name] ? byName[name].d : name);
  d.innerHTML = `<img src="${iconUrl(name)}" alt="">`;
  if (onclick) d.onclick = onclick;
  return d;
}

// ---------- tabs ----------
document.querySelectorAll('nav button').forEach(btn => {
  btn.onclick = () => showTab(btn.dataset.tab);
});
function showTab(name) {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  if (name === 'tutorials' && window.tutResize) window.tutResize();
  if (name === 'chat') setTimeout(() => document.getElementById('chat-input').focus(), 50);
}
window.showTab = showTab;

// ---------- recipes tab ----------
const S = 3; // GUI pixel scale
const searchBox = document.getElementById('recipe-search');
const gridEl = document.getElementById('recipe-grid');
const viewEl = document.getElementById('recipe-view');

const hasTexId = (id) => ITEMS[id] && TEX[ITEMS[id].n];
const craftable = RECIPES.map(r => r.r).filter(hasTexId).sort((a, b) => dispById(a).localeCompare(dispById(b)));
const allIds = Object.keys(ITEMS).map(Number).filter(hasTexId).sort((a, b) => dispById(a).localeCompare(dispById(b)));

function renderGrid(filter) {
  gridEl.innerHTML = '';
  const q = (filter || '').toLowerCase();
  const ids = q ? allIds.filter(id => dispById(id).toLowerCase().includes(q)) : craftable;
  for (const id of ids.slice(0, 400)) {
    const it = ITEMS[id];
    const d = slotEl(it.n, it.d + (recipeByResult[id] ? '' : ' (no crafting recipe)'), () => showRecipe(id));
    if (!recipeByResult[id]) d.style.opacity = 0.45;
    gridEl.appendChild(d);
  }
}

let recipeHistory = [];
let currentRecipeId = null;
function showRecipe(id, push = true) {
  if (push && currentRecipeId != null && currentRecipeId !== id) recipeHistory.push(currentRecipeId);
  currentRecipeId = id;
  const it = ITEMS[id];
  const rec = recipeByResult[id];
  viewEl.innerHTML = '';
  if (recipeHistory.length) {
    const back = document.createElement('button');
    back.textContent = '⬅ Back to ' + dispById(recipeHistory[recipeHistory.length - 1]);
    back.style.cssText = 'font-family:inherit;font-size:14px;padding:8px 12px;margin-bottom:8px;cursor:pointer;background:#6f6f6f;color:#fff;border:3px solid;border-color:#9a9a9a #2e2e2e #2e2e2e #9a9a9a;text-shadow:2px 2px 0 #383838;display:block';
    back.onclick = () => { const prev = recipeHistory.pop(); showRecipe(prev, false); };
    viewEl.appendChild(back);
  }
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.display = 'inline-block';

  if (!rec) {
    panel.innerHTML = `<h2><img src="${iconUrl(it.n)}" style="width:32px;height:32px;vertical-align:-6px"> ${it.d}</h2>
      <p style="margin:8px 0;color:#3f3f3f">This item has no crafting recipe — you find it, smelt it, trade for it, or get it from mobs.</p>`;
    const b = document.createElement('button');
    b.textContent = '🤖 Ask AI how to get it';
    b.style.cssText = 'font-family:inherit;font-size:15px;padding:8px 14px;cursor:pointer;background:#4c7f36;color:#fff;border:3px solid;border-color:#71b755 #2c4c1e #2c4c1e #71b755';
    b.onclick = () => { showTab('chat'); askAI(`How do I get ${it.d} in Minecraft Bedrock edition?`); };
    panel.appendChild(b);
    viewEl.appendChild(panel);
    viewEl.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const shapeless = !rec.s;
  panel.innerHTML = `<h2><img src="${iconUrl(it.n)}" style="width:32px;height:32px;vertical-align:-6px"> ${it.d}
    ${shapeless ? '<span class="badge">shapeless</span>' : ''}${rec.c > 1 ? `<span class="badge">makes ${rec.c}</span>` : ''}</h2>`;

  // The real crafting table GUI, scaled up
  const gui = document.createElement('div');
  gui.className = 'craft-gui';
  gui.style.width = 176 * S + 'px';
  gui.style.height = 166 * S + 'px';
  gui.style.backgroundSize = 256 * S + 'px ' + 256 * S + 'px';

  // 3x3 grid cells: interior starts at (31,18), pitch 18px. Result interior at (124,35).
  let cells = [];
  if (rec.s) {
    const rows = rec.s.length, cols = Math.max(...rec.s.map(r => r.length));
    // center the shape in the 3x3
    const r0 = Math.floor((3 - rows) / 2), c0 = Math.floor((3 - cols) / 2);
    for (let r = 0; r < rows; r++) for (let c = 0; c < (rec.s[r] || []).length; c++) {
      const v = rec.s[r][c];
      if (v != null) cells.push({ row: r0 + r, col: c0 + c, id: v });
    }
  } else {
    (rec.i || []).forEach((v, k) => { if (v != null) cells.push({ row: Math.floor(k / 3), col: k % 3, id: v }); });
  }
  const counts = {};
  for (const cell of cells) {
    counts[cell.id] = (counts[cell.id] || 0) + 1;
    const img = document.createElement('img');
    img.className = 'slot-item';
    img.src = iconById(cell.id);
    img.title = dispById(cell.id);
    img.style.cssText = `left:${(31 + cell.col * 18) * S}px;top:${(18 + cell.row * 18) * S}px;width:${16 * S}px;height:${16 * S}px;cursor:pointer`;
    img.onclick = () => showRecipe(cell.id);
    gui.appendChild(img);
  }
  const out = document.createElement('img');
  out.className = 'slot-item';
  out.src = iconById(id);
  out.title = it.d;
  out.style.cssText = `left:${124 * S}px;top:${35 * S}px;width:${16 * S}px;height:${16 * S}px`;
  gui.appendChild(out);
  if (rec.c > 1) {
    const cnt = document.createElement('div');
    cnt.textContent = rec.c;
    cnt.style.cssText = `position:absolute;left:${(124 + 10) * S}px;top:${(35 + 9) * S}px;font-size:${7 * S}px;color:#fff;text-shadow:2px 2px 0 #3f3f3f;z-index:2`;
    gui.appendChild(cnt);
  }
  panel.appendChild(gui);

  // ingredient legend
  const legend = document.createElement('div');
  legend.className = 'ing-legend';
  legend.innerHTML = '<b>You need:</b>';
  for (const [iid, n] of Object.entries(counts)) {
    const row = document.createElement('div');
    row.innerHTML = `<img src="${iconById(iid)}"> ${n} × ${dispById(iid)}`;
    row.style.cursor = 'pointer';
    row.onclick = () => showRecipe(Number(iid));
    legend.appendChild(row);
  }
  panel.appendChild(legend);
  viewEl.appendChild(panel);
  viewEl.scrollIntoView({ behavior: 'smooth' });
}

searchBox.oninput = () => renderGrid(searchBox.value);
renderGrid('');
showRecipe(byName['crafting_table'].id);

// ---------- guide rendering ----------
function renderGuide(containerId, sections) {
  const el = document.getElementById(containerId);
  // sticky jump-to-section chips
  const chips = document.createElement('div');
  chips.className = 'chipbar';
  sections.forEach((sec, i) => {
    const c = document.createElement('button');
    c.innerHTML = `<img src="${iconUrl(sec.icon)}"> ${sec.title}`;
    c.onclick = () => document.getElementById(containerId + '-sec-' + i).scrollIntoView({ behavior: 'smooth', block: 'start' });
    chips.appendChild(c);
  });
  el.appendChild(chips);
  sections.forEach((sec, si) => {
    const s = document.createElement('div');
    s.id = containerId + '-sec-' + si;
    s.className = 'panel guide-section';
    const h = document.createElement('h2');
    h.innerHTML = `<img src="${iconUrl(sec.icon)}"> ${sec.title}`;
    s.appendChild(h);
    sec.steps.forEach((st, i) => {
      const row = document.createElement('div');
      row.className = 'step';
      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = i + 1;
      const body = document.createElement('div');
      const p = document.createElement('p');
      p.innerHTML = st.text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      body.appendChild(p);
      if (st.icons && st.icons.length) {
        const icons = document.createElement('div');
        icons.className = 'icons';
        for (const name of st.icons) icons.appendChild(slotEl(name, null, () => {
          const item = byName[name];
          if (item) { showTab('recipes'); showRecipe(item.id); }
        }));
        body.appendChild(icons);
      }
      if (st.ed) { const e = document.createElement('span'); e.className = 'ednote'; e.textContent = '◆ ' + st.ed; body.appendChild(e); }
      if (st.tip) { const t = document.createElement('span'); t.className = 'tipnote'; t.textContent = '★ Tip: ' + st.tip; body.appendChild(t); }
      row.appendChild(num); row.appendChild(body);
      s.appendChild(row);
    });
    el.appendChild(s);
  });
}
renderGuide('tab-survival', window.SURVIVAL_GUIDE);
renderGuide('tab-redstone', window.REDSTONE_GUIDE);

// ---------- chat ----------
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const history = [];
let chatBusy = false;

function mdLite(text) {
  let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  t = t.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.trim()}</pre>`);
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  t = t.replace(/^#{1,4} (.*)$/gm, '<b style="color:#5b3a1e">$1</b>');
  // lists
  const lines = t.split('\n');
  let out = [], inList = false, listTag = 'ul';
  for (const line of lines) {
    const ul = line.match(/^\s*[-*•] (.*)/);
    const ol = line.match(/^\s*(\d+)[.)] (.*)/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (!inList || listTag !== tag) { if (inList) out.push(`</${listTag}>`); out.push(`<${tag}>`); inList = true; listTag = tag; }
      out.push(`<li>${ul ? ul[1] : ol[2]}</li>`);
    } else {
      if (inList) { out.push(`</${listTag}>`); inList = false; }
      out.push(line.trim() === '' ? '' : `<p>${line}</p>`);
    }
  }
  if (inList) out.push(`</${listTag}>`);
  return out.join('');
}

function addMsg(role, html) {
  const m = document.createElement('div');
  m.className = 'msg ' + role;
  const avatar = role === 'user'
    ? `<img class="avatar" src="tex/block/grass_block_side.png">`
    : `<img class="avatar" src="tex/item/ender_eye.png" style="background:#2b2b2b">`;
  m.innerHTML = `${avatar}<div class="bubble"></div>`;
  m.querySelector('.bubble').innerHTML = html;
  chatLog.appendChild(m);
  chatLog.scrollTop = chatLog.scrollHeight;
  return m.querySelector('.bubble');
}

const pendingQuestions = [];
async function askAI(question) {
  if (!question.trim()) return;
  if (chatBusy) { pendingQuestions.push(question); return; }
  chatBusy = true;
  addMsg('user', mdLite(question));
  history.push({ role: 'user', content: question });
  const bubble = addMsg('ai', '<i>thinking...</i>');
  let full = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const obj = JSON.parse(part.slice(6));
        if (obj.t) { full += obj.t; bubble.innerHTML = mdLite(full); chatLog.scrollTop = chatLog.scrollHeight; }
        if (obj.error) { full += '\n' + obj.error; bubble.innerHTML = mdLite(full); }
      }
    }
    history.push({ role: 'assistant', content: full || '...' });
  } catch (e) {
    bubble.innerHTML = mdLite('Could not reach the AI: ' + e.message);
  }
  chatBusy = false;
  if (pendingQuestions.length) askAI(pendingQuestions.shift());
}
window.askAI = askAI;

chatForm.onsubmit = (e) => {
  e.preventDefault();
  const q = chatInput.value;
  chatInput.value = '';
  askAI(q);
};

const sugEl = document.getElementById('chat-suggestions');
for (const s of window.CHAT_SUGGESTIONS) {
  const b = document.createElement('button');
  b.textContent = s;
  b.onclick = () => askAI(s);
  sugEl.appendChild(b);
}
addMsg('ai', mdLite("Hi! I'm your **Minecraft Help AI**. Ask me anything — recipes, builds, redstone, bosses, seeds, whatever! I know you play Bedrock, so my answers work for your game. ⛏"));
