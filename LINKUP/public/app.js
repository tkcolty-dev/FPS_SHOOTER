// LinkUp front end
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  term: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/></svg>',
  git: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-10 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" style="fill:currentColor"><path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

const KIND = { server: 'Web app', static: 'Web page', roblox: 'Roblox', scratch: 'Scratch', files: 'Files', empty: 'Empty folder', link: 'Website', artifact: 'Artifact' };
const STATUS = { active: 'Active', paused: 'Paused', done: 'Finished', idea: 'Idea', archived: 'Archived' };
const COLORS = ['#ff6b3d', '#e11d48', '#db2777', '#9333ea', '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#65a30d', '#ca8a04', '#78716c'];

const state = {
  projects: [],
  filter: load('filter', 'all'),
  sort: load('sort', 'edited'),
  view: load('view', 'grid'),
  q: '',
  openId: null,
  live: {},
};
function load(k, d) { try { return localStorage.getItem('linkup.' + k) || d; } catch { return d; } }
function store(k, v) { try { localStorage.setItem('linkup.' + k, v); } catch {} }

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401 && state.cloud) { location.href = '/login'; return new Promise(() => {}); }
  if (!res.ok) throw new Error(out.error || 'Request failed');
  return out;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
const colorOf = (p) => p.color || COLORS[hash(p.id) % COLORS.length];
const initials = (name) => (name.match(/[A-Za-z0-9]+/g) || ['?']).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function ago(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  const units = [[60, 'min'], [3600, 'hr'], [86400, 'day'], [604800, 'wk'], [2629800, 'mo'], [31557600, 'yr']];
  let u = units[0];
  for (const x of units) if (s >= x[0]) u = x;
  const n = Math.floor(s / u[0]);
  return `${n} ${u[1]}${n > 1 ? 's' : ''} ago`;
}

const isRunning = (p) => p.running === 'running' || p.running === 'running-elsewhere';
const liveOf = (p) => state.live[p.liveUrl] || p.live;
const canRun = (p) => !state.cloud && !!(p.startCmd && p.folder);

function bestUrl(p) {
  if (isRunning(p) && p.localUrl) return p.localUrl;
  const live = liveOf(p);
  if (p.liveUrl && (!live || live.ok)) return p.liveUrl;
  if (p.staticUrl) return p.staticUrl;
  if (p.url) return p.url;
  return p.liveUrl || null;
}

// ---------- filters ----------
const FILTERS = [
  ['all', 'All', (p) => !p.hidden && p.status !== 'archived' && p.kind !== 'empty'],
  ['pinned', 'Pinned', (p) => p.pinned && !p.hidden],
  ['running', 'Running', (p) => isRunning(p)],
  ['online', 'Online', (p) => !p.hidden && liveOf(p) && liveOf(p).ok],
  ['server', 'Web apps', (p) => !p.hidden && p.kind === 'server'],
  ['static', 'Pages and games', (p) => !p.hidden && p.kind === 'static'],
  ['roblox', 'Roblox', (p) => !p.hidden && p.kind === 'roblox'],
  ['scratch', 'Scratch', (p) => !p.hidden && p.kind === 'scratch'],
  ['added', 'Added by you', (p) => !p.hidden && p.source === 'custom'],
  ['active', 'Active', (p) => !p.hidden && p.status === 'active' && p.kind !== 'empty'],
  ['paused', 'Paused', (p) => !p.hidden && p.status === 'paused'],
  ['done', 'Finished', (p) => !p.hidden && p.status === 'done'],
  ['empty', 'Empty folders', (p) => !p.hidden && p.kind === 'empty'],
  ['archived', 'Archived', (p) => !p.hidden && p.status === 'archived'],
  ['hidden', 'Hidden', (p) => p.hidden],
];

function tagFilters() {
  const counts = {};
  for (const p of state.projects) if (!p.hidden) for (const t of p.tags || []) counts[t] = (counts[t] || 0) + 1;
  return Object.keys(counts).sort().map((t) => ['tag:' + t, '#' + t, (p) => !p.hidden && (p.tags || []).includes(t)]);
}

function renderChips() {
  const all = FILTERS.concat(tagFilters());
  if (!all.find((f) => f[0] === state.filter)) state.filter = 'all';
  $('#chips').innerHTML = all.map(([key, label, fn]) => {
    const n = state.projects.filter(fn).length;
    if (!n && !['all', state.filter].includes(key)) return '';
    return `<button class="chip ${state.filter === key ? 'on' : ''}" data-f="${esc(key)}">${esc(label)} <span class="n">${n}</span></button>`;
  }).join('');
}

function matches(p, q) {
  if (!q) return true;
  const hay = [p.name, p.description, p.folder, p.notes, (p.tags || []).join(' '), KIND[p.kind], p.liveUrl].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function sorted(list) {
  const by = {
    edited: (a, b) => (b.edited || 0) - (a.edited || 0),
    opened: (a, b) => (b.lastOpened || 0) - (a.lastOpened || 0) || (b.edited || 0) - (a.edited || 0),
    created: (a, b) => (b.created || 0) - (a.created || 0),
    name: (a, b) => a.name.localeCompare(b.name),
    size: (a, b) => (b.fileCount || 0) - (a.fileCount || 0),
  }[state.sort];
  return list.slice().sort(by);
}

// ---------- cards ----------
function cardHTML(p) {
  const live = liveOf(p);
  const run = p.running;
  const badges = [];
  badges.push(`<span class="badge">${esc(KIND[p.kind] || p.kind)}</span>`);
  if (run === 'running' || run === 'running-elsewhere') badges.push(`<span class="badge run"><span class="dot"></span>Running</span>`);
  else if (run === 'starting') badges.push(`<span class="badge run"><span class="dot"></span>Starting</span>`);
  if (live && live.ok) badges.push(`<span class="badge live"><span class="dot"></span>Online</span>`);
  else if (live && p.liveUrl) badges.push(`<span class="badge down"><span class="dot"></span>Site down</span>`);
  if (p.pinned) badges.push(`<span class="badge pin" title="Pinned">${ICON.pin}</span>`);

  const actions = [];
  const url = bestUrl(p);
  if (canRun(p)) {
    actions.push(isRunning(p) || run === 'starting'
      ? `<button class="hbtn stop" data-act="stop">${ICON.stop}Stop</button>`
      : `<button class="hbtn go" data-act="start">${ICON.play}Start</button>`);
  }
  if (url) actions.push(`<button class="hbtn" data-act="open">${ICON.open}Open</button>`);

  const thumb = p.previewUrl
    ? `<img src="${esc(p.previewUrl)}" alt="" loading="lazy" onerror="this.remove()">`
    : `<div class="cover"><div class="pattern"></div><div class="initials">${esc(initials(p.name))}</div></div>`;

  return `<article class="card ${p.status === 'archived' || p.hidden ? 'dim' : ''}" data-id="${esc(p.id)}" style="--c:${colorOf(p)}" tabindex="0">
    <div class="thumb">
      ${p.previewUrl ? `<div class="cover"><div class="pattern"></div><div class="initials">${esc(initials(p.name))}</div></div>` : ''}
      ${thumb}
      <div class="badges">${badges.join('')}</div>
      <div class="hover-actions">${actions.join('')}</div>
    </div>
    <div class="body">
      <div class="name">${esc(p.name)}</div>
      <div class="desc">${esc(p.description || (p.folder ? p.folder + '/' : ''))}</div>
      <div class="meta">
        <span class="status s-${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span>
        <span class="tags">${(p.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
        <span class="ago" title="Last edited">${esc(ago(p.edited))}</span>
      </div>
    </div>
  </article>`;
}

function render() {
  document.body.classList.toggle('list', state.view === 'list');
  renderChips();
  const fn = (FILTERS.concat(tagFilters()).find((f) => f[0] === state.filter) || FILTERS[0])[2];
  const list = sorted(state.projects.filter((p) => fn(p) && matches(p, state.q)));
  const showPinned = state.filter === 'all' && !state.q;
  const pinned = showPinned ? list.filter((p) => p.pinned) : [];
  const rest = showPinned ? list.filter((p) => !p.pinned) : list;
  $('#pinnedWrap').hidden = !pinned.length;
  $('#pinned').innerHTML = pinned.map(cardHTML).join('');
  $('#grid').innerHTML = rest.map(cardHTML).join('');
  $('#empty').hidden = list.length > 0;
  const label = (FILTERS.concat(tagFilters()).find((f) => f[0] === state.filter) || [0, 'All'])[1];
  $('#allTitle').textContent = state.q ? `Results for "${state.q}"` : state.filter === 'all' ? (pinned.length ? 'Everything else' : 'All projects') : label;
  renderStats();
}

function renderStats() {
  const visible = state.projects.filter((p) => !p.hidden && p.kind !== 'empty');
  const online = state.projects.filter((p) => liveOf(p) && liveOf(p).ok).length;
  const running = state.projects.filter(isRunning).length;
  $('#stats').innerHTML = `<b>${visible.length}</b> projects &middot; <b>${online}</b> online &middot; <b>${running}</b> running`;
}

// ---------- data ----------
async function refresh() {
  const out = await api('/projects');
  state.projects = out.projects;
  state.cloud = !!out.cloud;
  state.cloudUrl = out.cloudUrl;
  document.body.classList.toggle('cloud', state.cloud);
  $('#btnPublish').hidden = state.cloud || !state.cloudUrl;
  $('#btnCloud').hidden = state.cloud || !state.cloudUrl;
  if (state.cloudUrl) $('#btnCloud').href = state.cloudUrl;
  render();
  if (state.openId) fillDrawer(false);
}
function replaceProject(p) {
  const i = state.projects.findIndex((x) => x.id === p.id);
  if (i >= 0) state.projects[i] = p; else state.projects.push(p);
}
const proj = (id) => state.projects.find((p) => p.id === id);

async function patch(id, body) {
  const p = await api('/projects/' + encodeURIComponent(id), { method: 'PATCH', body });
  replaceProject(p);
  render();
  return p;
}

async function checkLive() {
  try {
    state.live = await api('/live', { method: 'POST' });
    render();
    if (state.openId) renderQuick(proj(state.openId));
  } catch {}
}

let lastRun = '';
async function pollStatus() {
  try {
    const s = await api('/status');
    let changed = false;
    for (const p of state.projects) if (s.running[p.id] && s.running[p.id] !== p.running) { p.running = s.running[p.id]; changed = true; }
    if (changed) { render(); if (state.openId) { renderQuick(proj(state.openId)); maybeReloadLocal(); } }
    renderSnap(s.snap);
  } catch {}
  if (state.openId) loadLogs();
}

let snapWasBusy = false;
function renderSnap(s) {
  const busy = s && s.total && s.done < s.total;
  $('#snapLabel').textContent = busy ? `Capturing ${s.done}/${s.total}` : 'Previews';
  $('#btnSnap').classList.toggle('spin', !!busy);
  if (snapWasBusy && !busy) { refresh(); toast('Previews updated'); }
  snapWasBusy = !!busy;
}

// ---------- actions ----------
async function doAction(p, act) {
  try {
    if (act === 'open') {
      const url = bestUrl(p);
      if (!url) return toast('No link yet. Start it or add a live URL.');
      window.open(url, '_blank', 'noopener');
      api(`/projects/${encodeURIComponent(p.id)}/opened`, { method: 'POST' }).catch(() => {});
    } else if (act === 'start') {
      await api(`/projects/${encodeURIComponent(p.id)}/start`, { method: 'POST' });
      p.running = 'starting';
      toast(`Starting ${p.name}${p.needsInstall ? ' (installing packages first)' : ''}`);
      render();
      if (state.openId === p.id) { renderQuick(p); setTimeout(() => showTab('local'), 50); }
    } else if (act === 'stop') {
      await api(`/projects/${encodeURIComponent(p.id)}/stop`, { method: 'POST' });
      toast(`Stopping ${p.name}`);
      setTimeout(pollStatus, 800);
    } else if (act === 'reveal') {
      await api(`/projects/${encodeURIComponent(p.id)}/reveal`, { method: 'POST' });
    } else if (act === 'terminal') {
      await api(`/projects/${encodeURIComponent(p.id)}/terminal`, { method: 'POST' });
    } else if (act === 'snap') {
      toast('Taking a screenshot...');
      const r = await api(`/projects/${encodeURIComponent(p.id)}/snap`, { method: 'POST' });
      if (!r.ok) return toast(r.error || 'Could not capture');
      await refresh();
      toast('Preview updated');
      if (state.openId === p.id) showTab('shot');
    } else if (act === 'copy') {
      await navigator.clipboard.writeText(bestUrl(p).startsWith('/') ? location.origin + bestUrl(p) : bestUrl(p));
      toast('Link copied');
    }
  } catch (e) { toast(e.message); }
}

function onGridClick(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  const p = proj(card.dataset.id);
  const btn = e.target.closest('[data-act]');
  if (btn) { e.stopPropagation(); return doAction(p, btn.dataset.act); }
  openDrawer(p.id);
}

// ---------- drawer ----------
let currentTab = null;

function openDrawer(id) {
  state.openId = id;
  currentTab = null;
  history.replaceState(null, '', '#' + encodeURIComponent(id));
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').hidden = false;
  fillDrawer(true);
  loadLogs();
}
function closeDrawer() {
  state.openId = null;
  history.replaceState(null, '', location.pathname);
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').hidden = true;
  setTimeout(() => { if (!state.openId) $('#dFrame').innerHTML = ''; }, 300);
}

function tabsFor(p) {
  const t = [];
  if (p.localUrl) t.push(['local', 'Local']);
  if (p.staticUrl) t.push(['page', 'Page']);
  if (p.liveUrl) t.push(['live', 'Live site']);
  else if (p.url) t.push(['live', 'Link']);
  if (p.previewUrl) t.push(['shot', 'Screenshot']);
  return t;
}
function defaultTab(p) {
  if (p.localUrl && isRunning(p)) return 'local';
  if (p.staticUrl) return 'page';
  if (p.previewUrl) return 'shot';
  if (p.liveUrl || p.url) return 'live';
  if (p.localUrl) return 'local';
  return null;
}

function showTab(tab) {
  const p = proj(state.openId);
  if (!p) return;
  currentTab = tab;
  const tabs = tabsFor(p);
  let url = '';
  let inner = '';
  const ph = (msg, btn = '') => `<div class="placeholder"><div>${msg}${btn}</div></div>`;
  if (tab === 'local') {
    url = p.localUrl;
    inner = isRunning(p) ? `<iframe src="${esc(url)}" allow="autoplay; fullscreen; clipboard-write; microphone; camera"></iframe>`
      : p.running === 'starting' ? ph('Starting up. It will appear here when it is ready.')
      : ph(`Not running on port ${esc(p.port)}.`, canRun(p) ? `<button class="btn go" data-act="start">${ICON.play}Start it</button>` : '');
  } else if (tab === 'page') {
    url = p.staticUrl;
    inner = `<iframe src="${esc(url)}" allow="autoplay; fullscreen; clipboard-write"></iframe>`;
  } else if (tab === 'live') {
    url = p.liveUrl || p.url;
    inner = /^https?:/.test(url) ? `<iframe src="${esc(url)}" allow="autoplay; fullscreen; clipboard-write"></iframe>` : ph('That link cannot be shown here. Use Open.');
  } else if (tab === 'shot') {
    url = '';
    inner = `<img src="${esc(p.previewUrl)}" alt="Preview">`;
  } else {
    inner = ph('Nothing to preview yet. Add a link, start it, or upload a picture.');
  }
  $('#dTabs').innerHTML = tabs.map(([k, l]) => `<button class="vtab ${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')
    + (url ? `<span class="url" title="${esc(url)}">${esc(url.startsWith('/') ? location.origin + url : url)}</span>` : '');
  $('#dFrame').innerHTML = inner;
}
function maybeReloadLocal() {
  const p = proj(state.openId);
  if (p && currentTab === 'local') showTab('local');
}

function renderQuick(p) {
  if (!p) return;
  const q = [];
  const url = bestUrl(p);
  if (canRun(p)) {
    q.push(isRunning(p) || p.running === 'starting'
      ? `<button class="btn stop" data-act="stop">${ICON.stop}Stop server</button>`
      : `<button class="btn go" data-act="start">${ICON.play}Start${p.needsInstall ? ' (installs first)' : ''}</button>`);
  }
  if (url) q.push(`<button class="btn primary" data-act="open">${ICON.open}Open</button>`);
  if (url) q.push(`<button class="btn ghost" data-act="copy">${ICON.copy}Copy link</button>`);
  if (p.liveUrl) {
    const live = liveOf(p);
    const label = !live ? 'Checking...' : live.ok ? 'Online' : `Down${live.status ? ' (' + live.status + ')' : ''}`;
    q.push(`<a class="btn ghost" href="${esc(p.liveUrl)}" target="_blank" rel="noopener">${ICON.globe}${label}</a>`);
  }
  if (p.github) q.push(`<a class="btn ghost" href="${esc(p.github)}" target="_blank" rel="noopener">${ICON.git}GitHub</a>`);
  if (!state.cloud) {
    if (p.folder || p.file) q.push(`<button class="btn ghost" data-act="reveal">${ICON.folder}Show in Finder</button>`);
    if (p.folder) q.push(`<button class="btn ghost" data-act="terminal">${ICON.term}Terminal</button>`);
    q.push(`<button class="btn ghost" data-act="snap">${ICON.cam}New screenshot</button>`);
  }
  $('#dQuick').innerHTML = q.join('');
}

function fillDrawer(first) {
  const p = proj(state.openId);
  if (!p) return closeDrawer();
  const d = $('#drawer');
  d.style.setProperty('--c', colorOf(p));
  if (first || document.activeElement !== $('#dName')) $('#dName').value = p.name;
  $('#dPin').classList.toggle('on', !!p.pinned);
  renderQuick(p);
  if (first || !currentTab) showTab(defaultTab(p));

  const setVal = (sel, v) => { const el = $(sel); if (first || document.activeElement !== el) el.value = v ?? ''; };
  setVal('#dDesc', p.description);
  setVal('#dStatus', p.status);
  setVal('#dNotes', p.notes);
  setVal('#dLive', p.liveUrl || p.url);
  setVal('#dGit', p.github);
  setVal('#dPort', p.port);
  setVal('#dCmd', p.startCmd);
  $('#dLocalRow').hidden = !p.folder || state.cloud;
  $('#dColors').innerHTML = COLORS.map((c) => `<button style="--sw:${c}" data-color="${c}" class="${colorOf(p) === c ? 'on' : ''}" title="${c}"></button>`).join('');
  renderTags(p);
  if (first || !$('#dLinks').contains(document.activeElement)) renderLinks(p);

  const facts = [];
  if (p.folder) facts.push(['Folder', `<code>~/claude/${esc(p.folder)}${p.appSub ? '/' + esc(p.appSub) : ''}</code>`]);
  if (p.file) facts.push(['File', `<code>~/claude/${esc(p.file)}</code>`]);
  facts.push(['Type', esc(KIND[p.kind] || p.kind)]);
  if (p.fileCount) facts.push(['Files', p.fileCount.toLocaleString()]);
  if (p.edited) facts.push(['Last edited', `${new Date(p.edited).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${ago(p.edited)})`]);
  if (p.created) facts.push(['Created', new Date(p.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })]);
  if (p.hasManifest) facts.push(['Cloud Foundry', 'Has a manifest.yml']);
  $('#dFacts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  $('#dMemoryWrap').hidden = !p.memory;
  $('#dMemory').textContent = (p.memory || '').replace(/^---[\s\S]*?---\s*/, '');
  $('#dHide').textContent = p.hidden ? 'Show in hub again' : 'Hide from hub';
  $('#dDelete').hidden = p.source !== 'custom';
}

function renderTags(p) {
  const box = $('#dTagsBox');
  box.querySelectorAll('.tag').forEach((t) => t.remove());
  const input = $('#dTagInput');
  for (const t of p.tags || []) {
    const el = document.createElement('span');
    el.className = 'tag';
    el.innerHTML = `${esc(t)}<button data-rm="${esc(t)}" title="Remove">&times;</button>`;
    box.insertBefore(el, input);
  }
}

function renderLinks(p) {
  const links = p.links || [];
  $('#dLinks').innerHTML = links.map((l, i) => `<div class="link-row" data-i="${i}">
    <input data-k="label" value="${esc(l.label)}" placeholder="Label">
    <input data-k="url" value="${esc(l.url)}" placeholder="https://...">
    <button data-go="${i}" title="Open">${ICON.open}</button>
    <button data-rml="${i}" title="Remove">${ICON.x}</button>
  </div>`).join('');
}

async function loadLogs() {
  const p = proj(state.openId);
  if (!p || !canRun(p)) { $('#dLogsWrap').hidden = true; return; }
  try {
    const r = await api(`/projects/${encodeURIComponent(p.id)}/logs`);
    $('#dLogsWrap').hidden = !r.logs.length;
    const el = $('#dLogs');
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    el.textContent = r.logs.join('\n');
    if (atBottom) el.scrollTop = el.scrollHeight;
  } catch {}
}

function save(field, value) {
  const id = state.openId;
  clearTimeout(save.t[field]);
  save.t[field] = setTimeout(async () => {
    try {
      const p = await patch(id, { [field]: value });
      if (state.openId === id) fillDrawer(false);
      if (field === 'liveUrl' || field === 'port') { showTab(currentTab || defaultTab(p)); checkLive(); }
    } catch (e) { toast(e.message); }
  }, 400);
}
save.t = {};

function wireDrawer() {
  $('#dClose').onclick = closeDrawer;
  $('#scrim').onclick = closeDrawer;
  $('#dName').addEventListener('input', (e) => e.target.value.trim() && save('name', e.target.value.trim()));
  $('#dDesc').addEventListener('input', (e) => save('description', e.target.value));
  $('#dNotes').addEventListener('input', (e) => save('notes', e.target.value));
  $('#dStatus').addEventListener('change', (e) => save('status', e.target.value));
  $('#dLive').addEventListener('change', (e) => save(proj(state.openId).source === 'custom' ? 'url' : 'liveUrl', e.target.value.trim()));
  $('#dGit').addEventListener('change', (e) => save('github', e.target.value.trim()));
  $('#dPort').addEventListener('change', (e) => save('port', e.target.value.trim()));
  $('#dCmd').addEventListener('change', (e) => save('startCmd', e.target.value.trim()));
  $('#dPin').onclick = () => { const p = proj(state.openId); patch(p.id, { pinned: !p.pinned }).then(() => fillDrawer(false)); };
  $('#dColors').addEventListener('click', (e) => { const c = e.target.dataset.color; if (c) save('color', c); });
  $('#dTabs').addEventListener('click', (e) => { const t = e.target.dataset.tab; if (t) showTab(t); });
  $('#dQuick').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) doAction(proj(state.openId), b.dataset.act); });
  $('#dFrame').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) doAction(proj(state.openId), b.dataset.act); });

  // tags
  $('#dTagsBox').addEventListener('click', (e) => {
    const rm = e.target.dataset.rm;
    if (rm) { const p = proj(state.openId); save('tags', (p.tags || []).filter((t) => t !== rm)); }
    else $('#dTagInput').focus();
  });
  $('#dTagInput').addEventListener('keydown', (e) => {
    const v = e.target.value.trim().replace(/^#/, '').toLowerCase();
    if ((e.key === 'Enter' || e.key === ',') && v) {
      e.preventDefault();
      const p = proj(state.openId);
      if (!(p.tags || []).includes(v)) { p.tags = (p.tags || []).concat(v); renderTags(p); save('tags', p.tags); }
      e.target.value = '';
    } else if (e.key === 'Backspace' && !e.target.value) {
      const p = proj(state.openId);
      if (p.tags && p.tags.length) { p.tags = p.tags.slice(0, -1); renderTags(p); save('tags', p.tags); }
    }
  });

  // extra links
  $('#dAddLink').onclick = () => { const p = proj(state.openId); p.links = (p.links || []).concat({ label: '', url: '' }); renderLinks(p); $('#dLinks .link-row:last-child input').focus(); };
  $('#dLinks').addEventListener('input', (e) => {
    const row = e.target.closest('.link-row');
    const p = proj(state.openId);
    p.links[row.dataset.i][e.target.dataset.k] = e.target.value;
    save('links', p.links.filter((l) => l.label || l.url));
  });
  $('#dLinks').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = proj(state.openId);
    if (b.dataset.go !== undefined) { const u = p.links[b.dataset.go].url; if (u) window.open(u, '_blank', 'noopener'); }
    if (b.dataset.rml !== undefined) { p.links.splice(Number(b.dataset.rml), 1); renderLinks(p); save('links', p.links); }
  });

  // preview image
  $('#dUpload').onclick = () => $('#dFile').click();
  $('#dFile').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        await api(`/projects/${encodeURIComponent(state.openId)}/preview`, { method: 'POST', body: { dataUrl: r.result } });
        await refresh(); toast('Preview saved');
      } catch (err) { toast(err.message); }
    };
    r.readAsDataURL(f);
    e.target.value = '';
  };
  $('#dClearPrev').onclick = async () => {
    await api(`/projects/${encodeURIComponent(state.openId)}/preview`, { method: 'DELETE' });
    await patch(state.openId, { preview: null });
    await refresh(); toast('Preview removed');
  };
  $('#dHide').onclick = async () => {
    const p = proj(state.openId);
    await patch(p.id, { hidden: !p.hidden });
    toast(p.hidden ? `${p.name} is back` : `${p.name} hidden. Find it under Hidden.`);
    if (!p.hidden) closeDrawer(); else fillDrawer(false);
  };
  $('#dDelete').onclick = async () => {
    const p = proj(state.openId);
    if (!confirm(`Delete "${p.name}" from the hub?`)) return;
    await api('/projects/' + encodeURIComponent(p.id), { method: 'DELETE' });
    closeDrawer(); await refresh(); toast('Deleted');
  };
}

// ---------- boot ----------
function wire() {
  $('#main').addEventListener('click', onGridClick);
  $('#main').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('card')) openDrawer(e.target.dataset.id); });
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.filter = b.dataset.f; store('filter', state.filter); render();
  });
  $('#sort').value = state.sort;
  $('#sort').onchange = (e) => { state.sort = e.target.value; store('sort', state.sort); render(); };
  $('#view').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.view = b.dataset.v; store('view', state.view);
    $('#view').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
  $('#view').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === state.view));
  $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim(); render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && state.openId && !$('#addDlg').open) closeDrawer();
  });
  $('#btnRescan').onclick = async () => {
    $('#btnRescan').classList.add('spin');
    try { const r = await api('/rescan', { method: 'POST' }); state.projects = r.projects; render(); toast('Folders rescanned'); }
    finally { $('#btnRescan').classList.remove('spin'); }
  };
  $('#btnSnap').onclick = async (e) => {
    const r = await api('/snap-all', { method: 'POST', body: { all: e.shiftKey } });
    toast(r.queued ? `Capturing ${r.queued} preview${r.queued > 1 ? 's' : ''}` : 'Every project that can be captured already has a preview. Shift-click to redo all.');
    pollStatus();
  };
  $('#btnPublish').onclick = async () => {
    const b = $('#btnPublish');
    b.disabled = true; b.classList.add('spin');
    toast('Publishing to the cloud copy...');
    try {
      const r = await api('/publish', { method: 'POST' });
      await refresh();
      toast(`Published ${r.projects} projects${r.previews ? ` and ${r.previews} new previews` : ''}`);
    } catch (e) { toast(e.message); }
    finally { b.disabled = false; b.classList.remove('spin'); }
  };
  $('#btnAdd').onclick = () => { $('#addForm').reset(); $('#addDlg').showModal(); };
  $('#addDlg').addEventListener('close', async () => {
    if ($('#addDlg').returnValue !== 'ok') return;
    const f = Object.fromEntries(new FormData($('#addForm')));
    try {
      const c = await api('/projects', { method: 'POST', body: f });
      await refresh();
      openDrawer(c.id);
      checkLive();
    } catch (e) { toast(e.message); }
  });
  wireDrawer();
}

wire();
refresh().then(() => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && proj(id)) openDrawer(id);
  checkLive(); pollStatus();
});
setInterval(pollStatus, 3000);
setInterval(checkLive, 5 * 60e3);
