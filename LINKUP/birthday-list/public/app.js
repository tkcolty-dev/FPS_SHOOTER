// Birthday List front end. Owners keep their edit key in localStorage; everyone else sees the shared view.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EMOJIS = ['🎂', '🎁', '🎈', '🎉', '🦄', '🦖', '⚽', '🎮', '🌈', '🐱', '🚀', '⭐'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function ls(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    return null;
  }
}
const myLists = () => ls('bl:lists') || {};
function saveMine(list, key) {
  const all = myLists();
  all[list.id] = { key: key || all[list.id]?.key, name: list.name, emoji: list.emoji };
  ls('bl:lists', all);
}
const claims = () => ls('bl:claims') || {};

async function api(method, url, body, headers = {}) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

const possessive = (n) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
function titleOf(list) {
  return list.name === 'My' ? 'My Birthday List' : `${possessive(list.name)} Birthday List`;
}

function daysUntil(mmdd) {
  if (!mmdd) return null;
  const [m, d] = mmdd.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next - today) / 86400000);
}
function countdown(mmdd) {
  const n = daysUntil(mmdd);
  if (n === null) return '';
  const [m, d] = mmdd.split('-').map(Number);
  const when = `${MONTHS[m - 1]} ${d}`;
  if (n === 0) return `<span class="chip">🎉 It's today!</span>`;
  if (n === 1) return `<span class="chip">🎈 Tomorrow — ${when}</span>`;
  return `<span class="chip">🎂 ${n} days to go</span><span>${when}</span>`;
}

function birthdayFields(mmdd) {
  const [m, d] = (mmdd || '').split('-').map(Number);
  return `<div class="row">
    <select class="field" name="month"><option value="">Month</option>${MONTHS.map((x, i) => `<option value="${i + 1}" ${m === i + 1 ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <select class="field" name="day" style="max-width:110px"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option ${d === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
  </div>`;
}
function readBirthday(form) {
  const m = form.month.value, d = form.day.value;
  return m && d ? `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}
function emojiPicker(current) {
  return `<div class="emojis">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === current ? 'on' : ''}">${e}</button>`).join('')}</div>`;
}
function wireEmojiPicker(root, onPick) {
  root.querySelectorAll('[data-emoji]').forEach((b) =>
    b.addEventListener('click', () => {
      root.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b));
      onPick(b.dataset.emoji);
    })
  );
}

// ---------------- home ----------------
function renderHome() {
  document.title = 'Birthday List';
  const mine = Object.entries(myLists());
  let emoji = '🎂';
  app.innerHTML = `<div class="home">
    <div class="big-emoji">🎁</div>
    <h1>Birthday List</h1>
    <p class="lead">Paste a link from Amazon and it adds the picture, name and price for you. Then send your list to family.</p>
    <form class="panel stack" id="create">
      <div><label>Your name</label><input class="field" name="name" maxlength="60" placeholder="Colton" autocomplete="given-name" required></div>
      <div><label>Your birthday</label>${birthdayFields()}</div>
      <div><label>Pick an icon</label>${emojiPicker(emoji)}</div>
      <button class="btn wide">Make my list</button>
    </form>
    ${mine.length ? `<div class="mylists"><h3>Your lists</h3>${mine.map(([id, l]) => `<a href="/l/${id}"><span>${esc(l.emoji || '🎂')}</span><span>${esc(titleOf(l))}</span><span>Open →</span></a>`).join('')}</div>` : ''}
  </div>`;
  const form = $('#create');
  wireEmojiPicker(form, (e) => (emoji = e));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn');
    btn.disabled = true;
    try {
      const list = await api('POST', '/api/lists', { name: form.elements.name.value, birthday: readBirthday(form), emoji });
      saveMine(list, list.key);
      history.pushState(null, '', `/l/${list.id}`);
      route();
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}

// ---------------- list ----------------
let state = { list: null, key: null, adding: 0, error: '' };
const queue = [];
let queueTotal = 0;

async function renderListPage(id) {
  // An edit link (#key=...) lets the owner open their list on another device.
  const m = location.hash.match(/key=([\w-]+)/);
  if (m) {
    const all = myLists();
    all[id] = { ...(all[id] || {}), key: m[1] };
    ls('bl:lists', all);
    history.replaceState(null, '', location.pathname);
  }
  state = { list: null, key: myLists()[id]?.key || null, adding: 0, error: '' };
  app.innerHTML = `<div class="empty"><div class="e">🎈</div>Loading…</div>`;
  try {
    state.list = await api('GET', `/api/lists/${id}`, null, state.key ? { 'x-key': state.key } : {});
  } catch (err) {
    app.innerHTML = `<div class="empty"><div class="e">🤷</div><b>Can't find that list</b>${esc(err.message)}<p><a class="btn" href="/">Make a new list</a></p></div>`;
    return;
  }
  if (state.list.owner) saveMine(state.list);
  else state.key = null;
  renderList();
}

const ownerHeaders = () => ({ 'x-key': state.key });

function renderList() {
  const { list } = state;
  document.title = `${titleOf(list)} ${list.emoji}`;
  const owner = list.owner;
  app.innerHTML = `
    <header class="top">
      <div class="title">
        <h1>${esc(list.emoji)} ${esc(titleOf(list))}</h1>
        <div class="sub">${countdown(list.birthday)}${list.items.length ? `<span>${list.items.length} ${list.items.length === 1 ? 'wish' : 'wishes'}</span>` : ''}</div>
      </div>
      <div class="actions">
        ${owner ? `<button class="btn" data-act="share">Share list</button>
        <button class="icon-btn icon-only" data-act="share" title="Share">📤</button>
        <button class="icon-btn" data-act="settings" title="Settings">⚙️</button>` : ''}
      </div>
    </header>
    ${owner ? `<form class="add" id="add">
        <input name="url" placeholder="Paste an Amazon link or type what you want…" autocomplete="off" enterkeyhint="go">
        ${queueTotal > 1 ? `<span class="progress">${queueTotal - queue.length} of ${queueTotal}</span>` : ''}
        <button class="btn">Add</button>
      </form>
      <p class="hint">${state.error ? `<span class="err">${esc(state.error)}</span>` : 'Paste a link (on Amazon tap Share → Copy Link), or just type a name like <i>LEGO Technic set</i> and it finds it on Amazon.'}
        <button class="linkish" data-act="bulk">Add a whole list at once</button></p>`
      : `<p class="hint">🤫 ${esc(list.name === 'My' ? 'They' : list.name)} can't see who's getting what — tap <b>I'll get this</b> so nobody buys the same thing.</p>`}
    <section class="grid" id="grid">
      ${Array.from({ length: state.adding }, () => `<article class="item loading"><div class="pic"></div><div class="body"><div class="bar"></div><div class="bar" style="width:60%"></div></div></article>`).join('')}
      ${list.items.map((it) => itemCard(it, owner)).join('')}
    </section>
    ${!list.items.length && !state.adding
      ? owner
        ? `<div class="empty"><div class="e">🛍️</div><b>Your list is empty</b>Find something you want on Amazon, copy the link, and paste it above.</div>`
        : `<div class="empty"><div class="e">🛍️</div><b>Nothing here yet</b>Check back soon!</div>`
      : ''}
    <p class="small" style="text-align:center;margin-top:40px"><a href="/">${owner ? '← All my lists' : 'Make your own birthday list →'}</a></p>`;
  wireList();
}

function itemCard(it, owner) {
  const mine = claims()[it.id];
  const taken = !owner && it.claimedBy && !mine;
  const hearts = [1, 2, 3].map((n) => `<button data-want="${n}" class="${it.want >= n ? 'on' : ''}" ${owner ? '' : 'tabindex="-1"'} title="${['Would be nice', 'Really want', 'Want SO much'][n - 1]}">❤️</button>`).join('');
  return `<article class="item ${taken ? 'taken' : ''}" data-id="${it.id}">
    <div class="pic">
      ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="noimg">🎁</div>`}
      ${it.want === 3 ? `<span class="ribbon">Top wish</span>` : ''}
    </div>
    ${owner ? `<div class="tools">${it.search || it.store === 'Amazon search' ? `<button data-act="swap" title="Show a different one">🔄</button>` : ''}<button data-act="edit" title="Edit">✏️</button><button data-act="del" title="Remove">🗑️</button></div>` : ''}
    <div class="body">
      <a class="name" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>
      ${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}
      <div class="meta">
        ${it.price ? `<span class="price">${esc(it.price)}</span>` : `<span class="price none">No price</span>`}
        <span class="store">${esc(it.store || '')}</span>
        <span class="want ${owner ? '' : 'readonly'}">${hearts}</span>
      </div>
      ${owner ? '' : `<div class="claim">${
        mine ? `<div class="mine-tag">🎁 You're getting this <button data-act="unclaim">undo</button></div>`
        : taken ? `<div class="taken-tag">✓ ${esc(it.claimedBy)} is getting this</div>`
        : `<button class="btn ghost" data-act="claim">I'll get this 🎁</button>`}</div>`}
    </div>
  </article>`;
}

function wireList() {
  const { list } = state;
  app.querySelectorAll('[data-act="share"]').forEach((b) => b.addEventListener('click', shareModal));
  $('[data-act="settings"]')?.addEventListener('click', settingsModal);

  const form = $('#add');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = form.url.value.trim();
      if (url) addMany(url);
      form.url.value = '';
    });
    // Pasting a link (or several lines) adds it straight away — no need to press Add.
    form.url.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text');
      if (/https?:\/\//.test(text) || text.trim().includes('\n')) {
        e.preventDefault();
        addMany(text);
      }
    });
    $('[data-act="bulk"]').addEventListener('click', bulkModal);
  }

  $('#grid').addEventListener('click', async (e) => {
    const card = e.target.closest('.item');
    if (!card || card.classList.contains('loading')) return;
    const it = list.items.find((i) => i.id === card.dataset.id);
    const want = e.target.closest('[data-want]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    try {
      if (want && list.owner) {
        const n = Number(want.dataset.want);
        await ownerSave('PATCH', `/items/${it.id}`, { want: it.want === n && n > 1 ? n - 1 : n });
      } else if (act === 'del') {
        if (!confirm(`Remove "${it.title.slice(0, 60)}"?`)) return;
        await ownerSave('DELETE', `/items/${it.id}`);
        toast('Removed');
      } else if (act === 'swap') {
        card.classList.add('loading');
        await ownerSave('POST', `/items/${it.id}/swap`);
        toast('Found a different one');
      } else if (act === 'edit') {
        editModal(it);
      } else if (act === 'claim') {
        claimModal(it);
      } else if (act === 'unclaim') {
        const token = claims()[it.id];
        state.list = await api('DELETE', `/api/lists/${list.id}/items/${it.id}/claim`, null, { 'x-claim': token });
        const c = claims();
        delete c[it.id];
        ls('bl:claims', c);
        renderList();
      }
    } catch (err) {
      toast(err.message);
    }
  });
}

async function ownerSave(method, sub, body) {
  state.list = await api(method, `/api/lists/${state.list.id}${sub}`, body, ownerHeaders());
  renderList();
}

// One line of a pasted list → { name or url, note }. Understands the Maker Gift Checklist's
// "Copy my list" lines: "#12 Indoor micro RC plane (E-flite UMX) ($100–$200)".
function parseLine(line) {
  line = line.trim().replace(/^[-*•]\s*/, '').replace(/^#\d+\s+/, '');
  if (!line || /^my gift list:?$/i.test(line)) return null;
  const url = line.match(/https?:\/\/\S+/);
  if (url) return { url: url[0] };
  const price = line.match(/\s*\(([^()]*\$[^()]*)\)\s*$/);
  if (price) line = line.slice(0, price.index);
  // "3D printer (Bambu Lab A1 mini)" — the brand in brackets is what to search for.
  return { name: line.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() };
}

function addMany(text) {
  const jobs = text.split(/\n+/).map(parseLine).filter(Boolean);
  if (!jobs.length) return;
  if (!queue.length && !state.adding) queueTotal = 0;
  queue.push(...jobs);
  queueTotal += jobs.length;
  if (!state.adding) runQueue();
  else renderList();
}

// One at a time, so Amazon doesn't get flooded by a big list.
async function runQueue() {
  state.error = '';
  const failed = [];
  while (queue.length) {
    const job = queue.shift();
    state.adding = 1;
    renderList();
    try {
      state.list = await api('POST', `/api/lists/${state.list.id}/items`, job, ownerHeaders());
    } catch (err) {
      failed.push(err.message);
    }
  }
  state.adding = 0;
  if (failed.length) state.error = failed.length === 1 ? failed[0] : `${failed.length} couldn't be added: ${failed[0]}`;
  renderList();
  const added = queueTotal - failed.length;
  if (added > 0) {
    confetti();
    toast(added === 1 ? 'Added to your list! 🎉' : `Added ${added} things! 🎉`);
  }
  queueTotal = 0;
  $('#add input')?.focus();
}

// ---------------- modals ----------------
function modal(html, onReady) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">${html}</div>`;
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', esc);
    }
  });
  document.body.appendChild(ov);
  onReady?.(ov.firstElementChild, close);
  ov.querySelector('input, textarea')?.focus();
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied!');
  } catch {
    toast('Select the link and copy it');
  }
}

function bulkModal() {
  modal(`<h2>Add a whole list</h2>
    <p class="small">Put one thing per line — links or names. From the Maker Gift Checklist, tap <b>Copy my list</b> and paste it here.</p>
    <form class="stack">
      <textarea class="field" name="text" rows="9" placeholder="LEGO Technic set&#10;Arduino starter kit&#10;https://a.co/d/…"></textarea>
      <div class="foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Add them all</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      close();
      addMany(f.text.value);
    });
  });
}

function shareModal() {
  const url = `${location.origin}/l/${state.list.id}`;
  modal(`<h2>Share your list 📤</h2>
    <p class="small">Send this link to family and friends. They can see your wishes and mark what they're buying — you won't see who's getting what.</p>
    <div class="copyrow"><input class="field" readonly value="${esc(url)}"><button class="btn" data-copy>Copy</button></div>
    ${navigator.share ? `<button class="btn ghost wide" style="margin-top:10px" data-native>Send with Messages, email…</button>` : ''}
    <div class="foot"><button class="btn ghost" data-close>Done</button></div>`, (m) => {
    m.querySelector('[data-copy]').onclick = () => copy(url);
    m.querySelector('input').onclick = (e) => e.target.select();
    const n = m.querySelector('[data-native]');
    if (n) n.onclick = () => navigator.share({ title: titleOf(state.list), text: `Here's my birthday list ${state.list.emoji}`, url }).catch(() => {});
  });
}

function settingsModal() {
  const { list } = state;
  const editUrl = `${location.origin}/l/${list.id}#key=${state.key}`;
  let emoji = list.emoji;
  modal(`<h2>List settings</h2>
    <form class="stack" id="settings">
      <div><label class="small">Name</label><input class="field" name="name" value="${esc(list.name === 'My' ? '' : list.name)}" maxlength="60"></div>
      <div><label class="small">Birthday</label>${birthdayFields(list.birthday)}</div>
      <div><label class="small">Icon</label>${emojiPicker(emoji)}</div>
      <div><label class="small">Your edit link — open it on your phone or another computer to add things there. Keep it private!</label>
        <div class="copyrow"><input class="field" readonly value="${esc(editUrl)}"><button type="button" class="btn ghost" data-copy>Copy</button></div></div>
      <div class="foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('form');
    wireEmojiPicker(f, (e) => (emoji = e));
    m.querySelector('[data-copy]').onclick = () => copy(editUrl);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await ownerSave('PATCH', '', { name: f.elements.name.value || 'My', birthday: readBirthday(f), emoji });
        saveMine(state.list);
        close();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function editModal(it) {
  modal(`<h2>Edit wish</h2>
    <form class="stack">
      <div><label class="small">Name</label><textarea class="field" name="title" rows="3" maxlength="200">${esc(it.title)}</textarea></div>
      <div><label class="small">Price</label><input class="field" name="price" value="${esc(it.price || '')}" maxlength="20" placeholder="$0.00"></div>
      <div><label class="small">Note (size, color, which one…)</label><textarea class="field" name="note" rows="2" maxlength="300" placeholder="Size medium, the blue one">${esc(it.note || '')}</textarea></div>
      <div class="foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await ownerSave('PATCH', `/items/${it.id}`, { title: f.elements.title.value, price: f.price.value, note: f.note.value });
        close();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function claimModal(it) {
  modal(`<h2>You're getting this? 🎁</h2>
    <p class="small">${esc(it.title.slice(0, 120))}</p>
    <form class="stack">
      <div><label class="small">Your name (so others know it's taken)</label><input class="field" name="by" maxlength="40" value="${esc(ls('bl:me') || '')}" placeholder="Grandma" required></div>
      <div class="foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Yes, I'll get it</button></div>
    </form>`, (m, close) => {
    const f = m.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const by = f.by.value.trim();
        ls('bl:me', by);
        const res = await api('POST', `/api/lists/${state.list.id}/items/${it.id}/claim`, { by });
        ls('bl:claims', { ...claims(), [it.id]: res.token });
        state.list = res;
        close();
        renderList();
        confetti();
      } catch (err) {
        toast(err.message);
        close();
        renderListPage(state.list.id);
      }
    });
  });
}

// ---------------- confetti ----------------
function confetti() {
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#ff5a4e', '#ffb627', '#1f9d6b', '#4f8cff', '#c66bff'];
  const bits = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.35;
      b.vx *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (++frames < 150) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

// ---------------- router ----------------
function route() {
  const m = location.pathname.match(/^\/l\/([\w-]+)/);
  if (m) renderListPage(m[1]);
  else renderHome();
}
addEventListener('popstate', route);
route();
