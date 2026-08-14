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
function initialsFor(name) {
  const d = byName[name] ? byName[name].d : name;
  return d.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}
// icon as HTML: real texture img, or a "missing texture" initials tile
function iconHTML(name, px) {
  if (TEX[name]) return `<img loading="lazy" src="${TEX[name]}"${px ? ` style="width:${px}px;height:${px}px;vertical-align:-6px"` : ''} alt="">`;
  const style = px ? ` style="width:${px}px;height:${px}px;font-size:${Math.max(8, Math.floor(px * 0.3))}px;vertical-align:-6px"` : '';
  return `<span class="noicon"${style}>${initialsFor(name)}</span>`;
}
function slotEl(name, title, onclick) {
  const d = document.createElement('div');
  d.className = 'slot';
  d.title = title || (byName[name] ? byName[name].d : name);
  d.innerHTML = iconHTML(name);
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
const S = window.innerWidth < 760 ? 2 : 3; // GUI pixel scale (smaller on phones)
const searchBox = document.getElementById('recipe-search');
const gridEl = document.getElementById('recipe-grid');
const viewEl = document.getElementById('recipe-view');

const craftable = RECIPES.map(r => r.r).filter(id => ITEMS[id]).sort((a, b) => dispById(a).localeCompare(dispById(b)));
const allIds = Object.keys(ITEMS).map(Number).filter(id => ITEMS[id].n !== 'air').sort((a, b) => dispById(a).localeCompare(dispById(b)));

// reverse index: ingredient id -> result ids ("used to craft")
const usedIn = {};
for (const r of RECIPES) {
  const ings = r.s ? r.s.flat() : (r.i || []);
  for (const id of new Set(ings.filter(x => x != null))) {
    (usedIn[id] = usedIn[id] || []).push(r.r);
  }
}

// item categories (heuristic by name + block/food flags from game data)
function catOf(it) {
  const n = it.n;
  if (/(_pickaxe|_axe|_shovel|_hoe)$/.test(n) || ['shears', 'flint_and_steel', 'fishing_rod', 'brush', 'spyglass', 'compass', 'clock', 'bucket', 'lead', 'name_tag'].includes(n)) return 'tools';
  if (/(sword$|^bow$|crossbow|^arrow$|trident|^mace$|tipped_arrow|spectral_arrow)/.test(n) || n === 'shield') return 'weapons';
  if (/(_helmet$|_chestplate$|_leggings$|_boots$|horse_armor|wolf_armor)/.test(n) || n === 'elytra' || n === 'turtle_helmet') return 'armor';
  if (it.f || /(^cooked_|bread|cake|cookie|pie$|stew$|soup$|golden_apple|berries|melon_slice)/.test(n)) return 'food';
  if (/(redstone|piston|repeater|comparator|observer|hopper|dropper|dispenser|rail$|minecart|lever|button$|pressure_plate|tnt|daylight|sculk_sensor|^target$|copper_bulb|crafter|tripwire)/.test(n)) return 'redstone';
  if (/(_ore$|^raw_|ingot$|nugget$|netherite_scrap|^diamond$|^emerald$|^coal$|^charcoal$|^quartz$|amethyst_shard|lapis_lazuli|ancient_debris)/.test(n)) return 'ores';
  if (/(_log$|_wood$|_planks$|_sapling$|^stripped_|_leaves$)/.test(n)) return 'wood';
  if (it.b) return 'blocks';
  return 'other';
}
const CATS = [
  ['all', '✳ All'], ['tools', '⛏ Tools'], ['weapons', '⚔ Weapons'], ['armor', '🛡 Armor'],
  ['food', '🍖 Food'], ['redstone', '🟥 Redstone'], ['ores', '💎 Ores'], ['wood', '🪵 Wood'],
  ['blocks', '🧱 Blocks'], ['other', '✨ Other'],
];
let currentCat = 'all';

function renderGrid(filter) {
  gridEl.innerHTML = '';
  const q = (filter || '').toLowerCase();
  let ids = q ? allIds.filter(id => dispById(id).toLowerCase().includes(q)) : allIds;
  if (currentCat !== 'all') ids = ids.filter(id => catOf(ITEMS[id]) === currentCat);
  document.getElementById('recipe-count').textContent = ids.length + ' items';
  for (const id of ids) {
    const it = ITEMS[id];
    const known = recipeByResult[id] || window.howToGet(it.n);
    const d = slotEl(it.n, it.d + (known ? '' : ' (ask the AI about this one)'), () => showRecipe(id));
    if (!known) d.style.opacity = 0.55;
    gridEl.appendChild(d);
  }
}

// "used to craft" section for the recipe panel
function usesSection(id) {
  const uses = (usedIn[id] || []).filter(r => ITEMS[r]);
  if (!uses.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'ing-legend';
  wrap.innerHTML = `<b>Used to craft (${uses.length}):</b>`;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;margin-top:5px';
  for (const rid of uses.slice(0, 16)) {
    const s = slotEl(ITEMS[rid].n, dispById(rid), () => showRecipe(rid));
    s.style.width = s.style.height = '40px';
    row.appendChild(s);
  }
  if (uses.length > 16) {
    const more = document.createElement('span');
    more.textContent = `+${uses.length - 16} more`;
    more.style.cssText = 'align-self:center;font-size:13px;color:#555;margin-left:6px';
    row.appendChild(more);
  }
  wrap.appendChild(row);
  return wrap;
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
    const how = window.howToGet(it.n);
    if (how && how.type === 'smelt') {
      // real furnace GUI with input -> output
      panel.innerHTML = `<h2>${iconHTML(it.n, 32)} ${it.d} <span class="badge">smelting</span></h2>`;
      const gui = document.createElement('div');
      gui.className = 'craft-gui';
      gui.style.backgroundImage = "url('tex/gui/furnace.png')";
      gui.style.width = 176 * S + 'px';
      gui.style.height = 88 * S + 'px';
      gui.style.backgroundSize = 256 * S + 'px ' + 256 * S + 'px';
      const addSlot = (name, x, y, click) => {
        const el = document.createElement(TEX[name] ? 'img' : 'div');
        el.className = TEX[name] ? 'slot-item' : 'slot-item noicon';
        if (TEX[name]) el.src = TEX[name]; else el.textContent = initialsFor(name);
        el.title = byName[name] ? byName[name].d : name;
        el.style.cssText = `position:absolute;left:${x * S}px;top:${y * S}px;width:${16 * S}px;height:${16 * S}px;font-size:${5 * S}px${click ? ';cursor:pointer' : ''}`;
        if (click) el.onclick = click;
        gui.appendChild(el);
      };
      const input = byName[how.input];
      addSlot(how.input, 57, 18, input ? () => showRecipe(input.id) : null);
      addSlot('coal', 57, 54, byName['coal'] ? () => showRecipe(byName['coal'].id) : null);
      addSlot(it.n, 117, 36);
      panel.appendChild(gui);
      const legend = document.createElement('div');
      legend.className = 'ing-legend';
      legend.innerHTML = `<b>Smelt in a furnace:</b><div style="cursor:pointer">${iconHTML(how.input, 24)} 1 × ${input ? input.d : how.input} → ${iconHTML(it.n, 24)} 1 × ${it.d}</div>
        <div style="opacity:.8">Any fuel works: coal, charcoal, wood, lava bucket...</div>`;
      if (input) legend.children[0].onclick = () => showRecipe(input.id);
      panel.appendChild(legend);
    } else if (how && how.type === 'info') {
      panel.innerHTML = `<h2>${iconHTML(it.n, 32)} ${it.d} <span class="badge">how to get it</span></h2>
        <p style="margin:10px 0;color:#3f3f3f;font-size:15px;line-height:1.6;max-width:520px">${how.text}</p>`;
      if (how.icons && how.icons.length) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 12px';
        for (const n of how.icons) row.appendChild(slotEl(n, null, byName[n] ? () => showRecipe(byName[n].id) : null));
        panel.appendChild(row);
      }
    } else {
      panel.innerHTML = `<h2>${iconHTML(it.n, 32)} ${it.d}</h2>
        <p style="margin:8px 0;color:#3f3f3f">This item has no crafting recipe — you find it, smelt it, trade for it, or get it from mobs.</p>`;
    }
    const usesN = usesSection(id);
    if (usesN) panel.appendChild(usesN);
    const b = document.createElement('button');
    b.textContent = '🤖 Ask AI more about it';
    b.style.cssText = 'font-family:inherit;font-size:15px;padding:8px 14px;margin-top:10px;cursor:pointer;background:#4c7f36;color:#fff;border:3px solid;border-color:#71b755 #2c4c1e #2c4c1e #71b755';
    b.onclick = () => { showTab('chat'); askAI(`How do I get ${it.d} in Minecraft Bedrock edition?`); };
    panel.appendChild(b);
    viewEl.appendChild(panel);
    viewEl.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const shapeless = !rec.s;
  panel.innerHTML = `<h2>${iconHTML(it.n, 32)} ${it.d}
    ${shapeless ? '<span class="badge">shapeless</span>' : ''}${rec.c > 1 ? `<span class="badge">makes ${rec.c}</span>` : ''}</h2>`;

  // The real crafting table GUI, scaled up
  const gui = document.createElement('div');
  gui.className = 'craft-gui';
  gui.style.width = 176 * S + 'px';
  gui.style.height = 80 * S + 'px'; // crop to the crafting area (skip the empty inventory half)
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
    const cname = ITEMS[cell.id] ? ITEMS[cell.id].n : '?';
    const img = document.createElement(TEX[cname] ? 'img' : 'div');
    img.className = TEX[cname] ? 'slot-item' : 'slot-item noicon';
    if (TEX[cname]) img.src = TEX[cname]; else img.textContent = initialsFor(cname);
    img.title = dispById(cell.id);
    img.style.cssText = `position:absolute;left:${(31 + cell.col * 18) * S}px;top:${(18 + cell.row * 18) * S}px;width:${16 * S}px;height:${16 * S}px;cursor:pointer;font-size:${5 * S}px`;
    img.onclick = () => showRecipe(cell.id);
    gui.appendChild(img);
  }
  const out = document.createElement(TEX[it.n] ? 'img' : 'div');
  out.className = TEX[it.n] ? 'slot-item' : 'slot-item noicon';
  if (TEX[it.n]) out.src = TEX[it.n]; else out.textContent = initialsFor(it.n);
  out.title = it.d;
  out.style.cssText = `position:absolute;left:${124 * S}px;top:${35 * S}px;width:${16 * S}px;height:${16 * S}px;font-size:${5 * S}px`;
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
    row.innerHTML = `${iconHTML(ITEMS[iid] ? ITEMS[iid].n : '?', 24)} ${n} × ${dispById(iid)}`;
    row.style.cursor = 'pointer';
    row.onclick = () => showRecipe(Number(iid));
    legend.appendChild(row);
  }
  panel.appendChild(legend);
  const usesN = usesSection(id);
  if (usesN) panel.appendChild(usesN);
  viewEl.appendChild(panel);
  viewEl.scrollIntoView({ behavior: 'smooth' });
}

searchBox.oninput = () => renderGrid(searchBox.value);
const catsEl = document.getElementById('recipe-cats');
for (const [key, label] of CATS) {
  const b = document.createElement('button');
  b.textContent = label;
  if (key === 'all') b.classList.add('active');
  b.onclick = () => {
    currentCat = key;
    catsEl.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    renderGrid(searchBox.value);
  };
  catsEl.appendChild(b);
}
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
      if (st.cmd) {
        for (const c of (Array.isArray(st.cmd) ? st.cmd : [st.cmd])) {
          const line = document.createElement('div');
          line.className = 'cmdline';
          line.innerHTML = `<code></code>`;
          line.querySelector('code').textContent = c;
          line.appendChild(makeCopyBtn(c));
          body.appendChild(line);
        }
      }
      if (st.ed) { const e = document.createElement('span'); e.className = 'ednote'; e.textContent = '◆ ' + st.ed; body.appendChild(e); }
      if (st.tip) { const t = document.createElement('span'); t.className = 'tipnote'; t.textContent = '★ Tip: ' + st.tip; body.appendChild(t); }
      row.appendChild(num); row.appendChild(body);
      s.appendChild(row);
    });
    el.appendChild(s);
  });
}
function makeCopyBtn(text) {
  const b = document.createElement('button');
  b.className = 'copybtn';
  b.textContent = '📋 Copy';
  b.onclick = (e) => {
    e.stopPropagation();
    const done = () => { b.textContent = '✓ Copied!'; setTimeout(() => b.textContent = '📋 Copy', 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    }
  };
  return b;
}

renderGuide('tab-survival', window.SURVIVAL_GUIDE);
renderGuide('tab-redstone', window.REDSTONE_GUIDE);
renderGuide('tab-commands', window.COMMANDS_GUIDE);

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
  t = t.replace(/(^|\s)\*([^*\n]+)\*/g, '$1<i>$2</i>');
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
let chatAbort = null;
function setChatBusy(b) {
  chatBusy = b;
  const btn = document.getElementById('chat-send');
  btn.textContent = b ? 'Stop' : 'Send';
  btn.style.background = b ? '#8f3a2e' : '#4c7f36';
}
async function askAI(question) {
  if (!question.trim()) return;
  if (chatBusy) { pendingQuestions.push(question); return; }
  setChatBusy(true);
  chatAbort = new AbortController();
  addMsg('user', mdLite(question));
  history.push({ role: 'user', content: question });
  const bubble = addMsg('ai', '<span class="thinking">⛏ mining an answer<span class="dots"></span></span>');
  let full = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: chatAbort.signal,
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
    enhanceBubble(bubble);
  } catch (e) {
    if (e.name === 'AbortError') {
      bubble.innerHTML = mdLite((full || '') + '\n*(stopped)*');
      history.push({ role: 'assistant', content: full || '(stopped)' });
    } else {
      bubble.innerHTML = mdLite('Could not reach the AI: ' + e.message);
    }
  }
  setChatBusy(false);
  if (pendingQuestions.length) askAI(pendingQuestions.shift());
}
window.askAI = askAI;

// add copy buttons to command/code blocks in AI answers
function enhanceBubble(bubble) {
  bubble.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copybtn')) return;
    pre.appendChild(makeCopyBtn(pre.textContent.trim()));
  });
  bubble.querySelectorAll('code').forEach(c => {
    const t = c.textContent.trim();
    if (!t.startsWith('/') || c.closest('pre')) return;
    c.style.cursor = 'pointer';
    c.title = 'Click to copy';
    c.onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(t);
      const old = c.style.background;
      c.style.background = '#2f6b2f';
      setTimeout(() => c.style.background = old, 600);
    };
  });
}

chatForm.onsubmit = (e) => {
  e.preventDefault();
  const q = chatInput.value;
  if (chatBusy && !q.trim()) { chatAbort && chatAbort.abort(); return; }
  chatInput.value = '';
  askAI(q);
};
document.getElementById('chat-send').addEventListener('click', (e) => {
  if (chatBusy) { e.preventDefault(); chatAbort && chatAbort.abort(); }
});

const sugEl = document.getElementById('chat-suggestions');
for (const s of window.CHAT_SUGGESTIONS) {
  const b = document.createElement('button');
  b.textContent = s;
  b.onclick = () => askAI(s);
  sugEl.appendChild(b);
}
addMsg('ai', mdLite("Hi! I'm your **Minecraft Help AI**. Ask me anything — recipes, builds, redstone, bosses, seeds, whatever! I know you play Bedrock, so my answers work for your game. ⛏"));
