// Scholar — frontend (Athenaeum redesign)
const $ = (s) => document.querySelector(s);
const chatEl    = $('#chat');
const composer  = $('#composer');
const inputEl   = $('#input');
const sendBtn   = $('#send');
const sourceListEl = $('#sourceList');
const historyEl = $('#history');
const trustedOnlyEl = $('#trustedOnly');
const sidebarEl = $('#sidebar');
const citePop   = $('#citePop');

const state = {
  chats: load('chats', []),
  activeId: load('activeId', null),
  sources: [],
  trustedOnly: load('trustedOnly', false),
};
trustedOnlyEl.checked = state.trustedOnly;

function load(k, d) { try { const v = localStorage.getItem('scholar:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function save(k, v) { localStorage.setItem('scholar:' + k, JSON.stringify(v)); }

function activeChat() { return state.activeId ? state.chats.find(c => c.id === state.activeId) : null; }

function newChat() {
  const c = { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), title: 'New inquiry', messages: [] };
  state.chats.unshift(c);
  state.activeId = c.id;
  save('chats', state.chats); save('activeId', state.activeId);
  renderHistory(); renderChat();
}
function selectChat(id) {
  state.activeId = id; save('activeId', id);
  renderHistory(); renderChat();
  if (window.innerWidth < 880) sidebarEl.classList.remove('open');
}
function deleteChat(id) {
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeId === id) state.activeId = state.chats[0]?.id || null;
  save('chats', state.chats); save('activeId', state.activeId);
  renderHistory(); renderChat();
}

/* Deterministic warm "book spine" color from chat id */
const SPINE_COLORS = [
  '#7c5a2c', '#9c4a3c', '#6a8a4c', '#5a6c8e', '#8c6a3c',
  '#a36240', '#6c4a6a', '#bc8a3e', '#4c7066', '#9c5a72',
  '#7a8c4c', '#3e5a6c'
];
function spineColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return SPINE_COLORS[Math.abs(h) % SPINE_COLORS.length];
}

function renderHistory() {
  historyEl.innerHTML = '';
  if (state.chats.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-family:var(--f-display);font-style:italic;font-size:12px;color:var(--ink-faint);padding:8px 14px;';
    empty.textContent = 'No inquiries yet.';
    historyEl.appendChild(empty);
    return;
  }
  for (const c of state.chats) {
    const b = document.createElement('button');
    b.className = 'rail-item' + (c.id === state.activeId ? ' active' : '');
    b.style.setProperty('--spine', spineColor(c.id));
    b.textContent = c.title;
    b.title = c.title;
    b.onclick = () => selectChat(c.id);
    b.oncontextmenu = (e) => { e.preventDefault(); if (confirm('Delete this inquiry?')) deleteChat(c.id); };
    historyEl.appendChild(b);
  }
}

const EXAMPLES = [
  'What caused the fall of the Roman Republic?',
  'Explain CRISPR-Cas9 like I am in 10th grade',
  'Compare the causes of WWI and WWII',
  'What does recent research say about ocean acidification?'
];

function renderChat() {
  const c = activeChat();
  chatEl.innerHTML = '';
  if (!c || c.messages.length === 0) {
    const w = document.createElement('div');
    w.className = 'welcome';
    w.innerHTML = `
      <div class="w-pre">a desk for serious questions</div>
      <h1>What shall we <em>look into</em><br/>today?</h1>
      <p class="welcome-sub">Ask anything worth knowing. I'll search the open web, prefer the sources you trust, and cite every claim back to its origin — so your work stands on something real.</p>
      <div class="examples">
        ${EXAMPLES.map((q, i) => `<button class="ex" data-num="${String(i+1).padStart(2,'0')}">${escapeHtml(q)}</button>`).join('')}
      </div>`;
    chatEl.appendChild(w);
    return;
  }
  const thread = document.createElement('div');
  thread.className = 'thread';
  for (const m of c.messages) thread.appendChild(renderMsg(m));
  chatEl.appendChild(thread);
  requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
}

function renderMsg(m) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + m.role;
  const role = document.createElement('div');
  role.className = 'role';
  role.textContent = m.role === 'user' ? 'You' : 'Scholar';
  wrap.appendChild(role);
  const b = document.createElement('div');
  b.className = 'bubble';
  if (m.role === 'user') {
    b.textContent = m.content;
  } else if (m.thinking) {
    b.innerHTML = `
      <div class="thinking">
        <span>Consulting sources</span>
        <span class="thinking-dots"><span></span><span></span><span></span></span>
      </div>`;
  } else {
    b.innerHTML = renderMarkdownWithCites(m.content || '', m.sources || []);
  }
  wrap.appendChild(b);
  if (m.role === 'assistant' && m.sources && m.sources.length) wrap.appendChild(renderSources(m.sources));
  return wrap;
}

function renderSources(sources) {
  const card = document.createElement('details');
  card.className = 'sources-card';
  const trustedCount = sources.filter(s => s.trusted).length;
  const summary = document.createElement('summary');
  summary.className = 'sc-head';
  summary.innerHTML = `
    <span class="label">Citations</span>
    <span class="meta">${sources.length} consulted · ${trustedCount} trusted <span class="sc-chev">▾</span></span>`;
  card.appendChild(summary);
  const ol = document.createElement('ol');
  ol.className = 'sc-list';
  for (const s of sources) {
    const li = document.createElement('li');
    if (s.trusted) li.classList.add('trusted');
    li.innerHTML = `
      <a href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>${s.trusted ? '<span class="trust-tag">trusted</span>' : ''}
      <span class="host">${escapeHtml(s.host || hostFromUrl(s.url))}</span>`;
    ol.appendChild(li);
  }
  card.appendChild(ol);
  return card;
}

function hostFromUrl(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

function renderMarkdownWithCites(text, sources) {
  const sourceById = {};
  sources.forEach(s => sourceById[s.n] = s);

  let html = escapeHtml(text);

  const pillify = (numsStr) => {
    const nums = numsStr.split(/[,\s]+/).filter(Boolean);
    return nums.map(n => {
      const src = sourceById[+n];
      if (!src) return `[${n}]`;
      const cls = src.trusted ? 'cite trusted' : 'cite';
      return `<a class="${cls}" href="${escapeAttr(src.url)}" target="_blank" rel="noopener noreferrer" data-n="${n}" data-title="${escapeAttr(src.title)}" data-host="${escapeAttr(src.host || hostFromUrl(src.url))}" data-trusted="${src.trusted ? '1' : '0'}">${n}</a>`;
    }).join('');
  };

  html = html.replace(/\[((?:\d+\s*,?\s*)+)\]/g, (m, inner) => pillify(inner));
  html = html.replace(/【((?:\d+\s*,?\s*)+)】/g, (m, inner) => pillify(inner));

  html = html
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?;:]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = html.split(/\n/);
  const out = [];
  let inUl = false, inOl = false, buf = [];
  const flushP = () => { if (buf.length) { out.push('<p>' + buf.join(' ') + '</p>'); buf = []; } };
  for (let line of lines) {
    if (/^\s*[-*]\s+/.test(line)) {
      flushP();
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push('<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>');
    } else if (/^\s*\d+\.\s+/.test(line)) {
      flushP();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push('<li>' + line.replace(/^\s*\d+\.\s+/, '') + '</li>');
    } else if (/^<h[1-3]>/.test(line)) {
      flushP();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(line);
    } else if (line.trim() === '') {
      flushP();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      buf.push(line);
    }
  }
  flushP();
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  return out.join('\n');
}

/* ───────── Citation hover preview ───────── */
let popTimer = null;
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('.cite');
  if (!t) return;
  clearTimeout(popTimer);
  const trusted = t.dataset.trusted === '1';
  citePop.classList.toggle('trusted', trusted);
  citePop.innerHTML = `
    <div class="cp-num">${trusted ? '◆ trusted source' : 'source'} · [${escapeHtml(t.dataset.n)}]</div>
    <div class="cp-title">${escapeHtml(t.dataset.title || '')}</div>
    <div class="cp-host">${escapeHtml(t.dataset.host || '')}</div>`;
  const r = t.getBoundingClientRect();
  citePop.classList.add('show');
  // position after the layout passes
  requestAnimationFrame(() => {
    const pw = citePop.offsetWidth, ph = citePop.offsetHeight;
    let x = r.left + r.width / 2 - pw / 2;
    let y = r.bottom + 8;
    if (x + pw > innerWidth - 8) x = innerWidth - pw - 8;
    if (x < 8) x = 8;
    if (y + ph > innerHeight - 8) y = r.top - ph - 8;
    citePop.style.left = x + 'px';
    citePop.style.top = y + 'px';
  });
});
document.addEventListener('mouseout', (e) => {
  const t = e.target.closest('.cite');
  if (!t) return;
  popTimer = setTimeout(() => citePop.classList.remove('show'), 80);
});
document.addEventListener('scroll', () => citePop.classList.remove('show'), true);

/* ───────── Sending ───────── */
async function send(text) {
  if (!text.trim() || sendBtn.disabled) return;
  let c = activeChat();
  if (!c) { newChat(); c = activeChat(); }
  c.messages.push({ role: 'user', content: text });
  if (c.title === 'New inquiry' || c.messages.length === 1) {
    c.title = text.length > 48 ? text.slice(0, 48) + '…' : text;
  }
  const placeholder = { role: 'assistant', content: '', thinking: true };
  c.messages.push(placeholder);
  save('chats', state.chats);
  renderHistory(); renderChat();
  sendBtn.disabled = true;

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: c.messages.filter(m => !m.thinking).map(m => ({ role: m.role, content: m.content })),
        trustedOnly: state.trustedOnly,
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || ('http ' + r.status));
    placeholder.thinking = false;
    placeholder.content = j.answer;
    placeholder.sources = j.sources || [];
    save('chats', state.chats);
    renderChat();
  } catch (e) {
    placeholder.thinking = false;
    placeholder.content = '*The lamp dimmed.* — ' + e.message;
    placeholder.sources = [];
    save('chats', state.chats);
    renderChat();
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

/* ───────── Sources management ───────── */
async function loadSources() {
  try {
    const r = await fetch('/api/sources');
    state.sources = await r.json();
    renderSourceList();
  } catch {}
}
function renderSourceList() {
  sourceListEl.innerHTML = '';
  if (!state.sources.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-family:var(--f-display);font-style:italic;font-size:12px;color:var(--ink-faint);padding:6px 4px;';
    empty.textContent = 'No trusted sources yet.';
    sourceListEl.appendChild(empty);
    return;
  }
  for (const s of state.sources) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="seal" title="${escapeAttr(s.label || s.domain)}"></span>
      <span class="domain" title="${escapeAttr(s.notes || s.label || s.domain)}">${escapeHtml(s.domain)}</span>
      <button class="x" aria-label="Remove">×</button>`;
    li.querySelector('.x').onclick = async () => {
      if (!confirm('Remove ' + s.domain + '?')) return;
      await fetch('/api/sources/' + s.id, { method: 'DELETE' });
      loadSources();
    };
    sourceListEl.appendChild(li);
  }
}

/* ───────── Dialog ───────── */
const dlg = $('#sourceDialog');
$('#addSourceBtn').onclick = () => { dlg.showModal(); setTimeout(() => $('#src-domain').focus(), 50); };
$('#srcCancel').onclick = (e) => { e.preventDefault(); dlg.close(); };
$('#sourceForm').onsubmit = async (e) => {
  e.preventDefault();
  const domain = $('#src-domain').value.trim();
  const label  = $('#src-label').value.trim();
  const notes  = $('#src-notes').value.trim();
  if (!domain) return;
  await fetch('/api/sources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain, label, notes })
  });
  $('#src-domain').value = ''; $('#src-label').value = ''; $('#src-notes').value = '';
  dlg.close();
  loadSources();
};

/* ───────── Wiring ───────── */
$('#newChat').onclick = () => newChat();
$('#hamburger').onclick = () => sidebarEl.classList.toggle('open');
trustedOnlyEl.onchange = () => { state.trustedOnly = trustedOnlyEl.checked; save('trustedOnly', state.trustedOnly); };

composer.onsubmit = (e) => {
  e.preventDefault();
  const t = inputEl.value; inputEl.value = ''; autosize();
  send(t);
};
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); }
});
function autosize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(220, inputEl.scrollHeight) + 'px';
}
inputEl.addEventListener('input', autosize);

/* Welcome example delegation */
chatEl.addEventListener('click', (e) => {
  const ex = e.target.closest('.ex');
  if (ex) {
    inputEl.value = ex.textContent;
    inputEl.focus();
    autosize();
  }
});

/* Close sidebar on outside click (mobile) */
document.addEventListener('click', (e) => {
  if (window.innerWidth >= 880) return;
  if (!sidebarEl.classList.contains('open')) return;
  if (sidebarEl.contains(e.target) || e.target.closest('#hamburger')) return;
  sidebarEl.classList.remove('open');
});

/* Health pill */
fetch('/api/health').then(r => r.json()).then(h => {
  $('#storagePill').textContent = `${h.storage} · ${h.llm}`;
  $('#status').textContent = `storage:${h.storage} · llm:${h.llm}`;
}).catch(() => {});

/* boot */
renderHistory();
renderChat();
loadSources();
