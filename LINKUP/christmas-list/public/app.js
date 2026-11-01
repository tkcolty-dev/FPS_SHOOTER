// Christmas Numbers front end: sign in, gift list, reveal screen.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

// Fade the current panels out, swap the screen, fade the new ones in.
function view(fn) {
  if (calm || !app.firstElementChild) {
    fn();
    return Promise.resolve();
  }
  app.classList.remove('entering');
  app.classList.add('leaving');
  return new Promise((done) => {
    setTimeout(() => {
      app.classList.remove('leaving');
      fn();
      app.classList.add('entering');
      clearTimeout(view.t);
      view.t = setTimeout(() => app.classList.remove('entering'), 420);
      done();
    }, 150);
  });
}

let S = null;
let filter = null;
let inReveal = false;

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') {
    S = null;
    renderGate();
    throw new Error('Enter your code first.');
  }
  if (!r.ok) throw new Error(data.error || "That didn't work. Try again.");
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- sign in ----------
function renderGate() {
  document.querySelector('.overlay')?.remove();
  inReveal = false;
  app.innerHTML = `<div class="gate"><form class="glass gate-card fx" id="gate">
      <h1>Christmas Numbers</h1>
      <p class="sub">Enter your code to open the list.</p>
      <label class="lbl" for="code">Your code</label>
      <input class="field" id="code" autocomplete="current-password" autocapitalize="none" spellcheck="false" required>
      <p class="err" id="gate-err" role="alert"></p>
      <button class="btn">Open the list</button>
    </form></div>`;
  const f = $('#gate');
  $('#code').focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('.btn', f);
    btn.disabled = true;
    try {
      await api('POST', '/api/login', { code: $('#code').value });
      await start();
    } catch (err) {
      $('#gate-err').textContent = err.message;
      btn.disabled = false;
    }
  });
}

async function start() {
  S = await api('GET', '/api/state');
  if (revealLocked()) {
    if (S.reveal) return renderReveal();
    revealLocked(false);
  }
  await view(renderList);
  if (!S.users[S.me].name) nameModal();
}

// While the reveal is running this device stays on it, even after a reload.
function revealLocked(on) {
  try {
    if (on === undefined) return localStorage.getItem('cl:reveal') === '1';
    if (on) localStorage.setItem('cl:reveal', '1');
    else localStorage.removeItem('cl:reveal');
  } catch {
    return false;
  }
}

// ---------- list ----------
function renderList() {
  document.title = 'Christmas Numbers';
  const people = [...new Set(S.items.map((i) => i.person))].sort((a, b) => a.localeCompare(b));
  if (filter && !people.includes(filter)) filter = null;
  const items = filter ? S.items.filter((i) => i.person === filter) : S.items;
  const opened = S.items.filter((i) => i.opened).length;
  const noPic = S.items.filter((i) => !i.photo).length;
  app.innerHTML = `<div class="page">
    <header class="top glass fx">
      <h1>Christmas Numbers</h1>
      <div class="actions">
        <button class="btn pine" data-a="reveal">Reveal gifts</button>
        <button class="btn" data-a="add">Add a gift</button>
      </div>
    </header>
    ${S.items.length ? `<div class="bar fx">
      <span class="count">${S.items.length} ${S.items.length === 1 ? 'gift' : 'gifts'}${opened ? `, ${opened} opened` : ''}${noPic ? `, ${noPic} without a picture` : ''}</span>
      ${people.length > 1 ? `<div class="chips"><button class="chip" aria-pressed="${!filter}" data-f="">Everyone</button>${people.map((p) => `<button class="chip" aria-pressed="${p === filter}" data-f="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
    </div>` : ''}
    ${S.items.length
      ? `<section class="tags">${items.map(giftTag).join('')}</section>`
      : `<div class="empty glass fx"><h2>No gifts yet</h2><p>Add the first gift, then write its number on the present.</p><button class="btn" data-a="add">Add a gift</button></div>`}
    <div class="links glass fx">
      ${S.items.length ? `<button class="textbtn" data-a="labels">Print labels</button>` : ''}
      <button class="textbtn" data-a="name">Change my name</button>
      ${opened ? `<button class="textbtn" data-a="reset">Close all gifts again</button>` : ''}
      <button class="textbtn" data-a="out">Sign out</button>
    </div>
  </div>`;
  app.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => actions[b.dataset.a]()));
  app.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f || null; renderList(); }));
  app.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => itemModal(S.items.find((i) => i.id === b.dataset.id))));
}

function otherName() {
  return S.users[S.me === 'a' ? 'b' : 'a'].name || 'the other person';
}

function giftTag(it) {
  const hidden = it.hidden && !it.opened;
  return `<button class="glass gift fx" data-id="${esc(it.id)}" aria-label="Edit gift ${it.number}, ${esc(it.name)}">
    <span class="row"><span class="num">${it.number}</span>
      ${it.opened ? `<span class="state done">${CHECK}Opened</span>` : hidden ? `<span class="state" title="Hidden from ${esc(otherName())}">${LOCK}Hidden</span>` : ''}</span>
    ${it.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="" loading="lazy">` : `<span class="nopic">Add a picture</span>`}
    <span class="what">${esc(it.name)}</span>
    <span class="row"><span class="for">For <b>${esc(it.person)}</b></span>${it.price ? `<span class="price">${esc(it.price)}</span>` : ''}</span>
  </button>`;
}

const actions = {
  add: () => itemModal(null),
  name: () => nameModal(),
  labels: () => printLabels(),
  reveal: () => {
    modal(`<h2>Start the reveal?</h2>
      <p class="plain-text">Do this together when you're ready. Hidden gifts can be opened from now on, and this device stays on the reveal screen. Leaving it takes one of your codes.</p>
      <form><label class="lbl" for="oc">${esc(otherName())}'s code</label>
      <input class="field" id="oc" autocomplete="off" autocapitalize="none" spellcheck="false" required>
      <p class="err" role="alert"></p>
      <div class="foot"><button type="button" class="btn plain" data-close>Cancel</button><button class="btn pine">Start the reveal</button></div></form>`, (m, close) => {
      $('form', m).addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          S = await api('POST', '/api/reveal/start', { code: $('#oc', m).value });
          close();
          revealLocked(true);
          renderReveal();
        } catch (err) {
          $('.err', m).textContent = err.message;
        }
      });
    });
  },
  async out() {
    await api('POST', '/api/logout');
    S = null;
    view(renderGate);
  },
  async reset() {
    if (!confirm('Close all gifts so they can be revealed again?')) return;
    S = await api('POST', '/api/reveal/reset');
    renderList();
    toast('All gifts closed');
  },
};

// ---------- windows ----------
function modal(html, ready) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal glass" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    if (ov.classList.contains('closing')) return;
    ov.classList.add('closing');
    setTimeout(() => ov.remove(), calm ? 0 : 170);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => e.target === ov && close());
  ov.addEventListener('click', (e) => e.target.closest('[data-close]') && close());
  document.body.appendChild(ov);
  ready($('.modal', ov), close);
  ov.querySelector('input:not([type=file]), textarea')?.focus();
}

function nameModal() {
  modal(`<h2>What's your name?</h2>
    <form><label class="lbl" for="nm">Your name</label>
    <input class="field" id="nm" maxlength="30" value="${esc(S.users[S.me].name)}" required>
    <p class="err" role="alert"></p>
    <div class="foot"><button class="btn">Save name</button></div></form>`, (m, close) => {
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        S = await api('PATCH', '/api/me', { name: $('#nm', m).value });
        close();
        renderList();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
  });
}

function itemModal(it) {
  const people = [...new Set(S.items.map((i) => i.person))];
  const adder = it && S.users[it.addedBy]?.name;
  modal(`<h2>${it ? `Gift ${it.number}` : 'Add a gift'}</h2>
    <form class="stack">
      <div class="finder">
        <label class="lbl" for="g-find">Find it on Amazon</label>
        <div class="find-row"><input class="field" id="g-find" autocomplete="off" enterkeyhint="search" placeholder="Paste a link or type a name"><button type="button" class="btn pine" data-find>Find</button></div>
        <p class="find-msg" role="status" hidden></p>
        <div class="picks" hidden></div>
      </div>
      <div><label class="lbl" for="g-name">What is it?</label>
        <input class="field" id="g-name" maxlength="120" value="${esc(it?.name)}" required></div>
      <div class="two">
        <div><label class="lbl" for="g-num">Number</label>
          <input class="field" id="g-num" type="number" inputmode="numeric" min="1" max="9999" value="${it ? it.number : S.next}" required></div>
        <div><label class="lbl" for="g-for">Who is it for?</label>
          <input class="field" id="g-for" maxlength="40" list="people" autocomplete="off" value="${esc(it?.person)}" required>
          <datalist id="people">${people.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
      </div>
      <div><label class="lbl" for="g-note">Note for the reveal (optional)</label>
        <input class="field" id="g-note" maxlength="200" value="${esc(it?.note)}"></div>
      ${!it || it.addedBy === S.me ? `<label class="check"><input type="checkbox" id="g-hide" ${!it || it.hidden ? 'checked' : ''}> Hide from ${esc(otherName())} until it's revealed</label>` : ''}
      <div class="photo-row">
        ${it?.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="">` : ''}
        <label class="btn plain photo-btn"><span>${it?.photo ? 'Change picture' : 'Add a picture'}</span><input type="file" accept="image/*" style="position:absolute;opacity:0;width:1px"></label>
        ${it?.photo ? `<button type="button" class="textbtn" data-delphoto>Remove picture</button>` : ''}
      </div>
      <p class="amazon-link" ${it?.url ? '' : 'hidden'}>${it?.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">View on Amazon</a>` : ''}</p>
      ${adder ? `<p class="added-by">Added by ${esc(adder)}</p>` : ''}
      <p class="err" role="alert"></p>
      <div class="foot">
        ${it ? `<button type="button" class="textbtn danger" data-del>Remove gift</button>` : ''}
        <button type="button" class="btn plain" data-close>Cancel</button>
        <button class="btn">${it ? 'Save gift' : 'Add gift'}</button>
      </div>
    </form>`, (m, close) => {
    let file = null;
    let chosen = null;
    const showPicture = (src) => {
      let img = $('.photo-row img', m);
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        $('.photo-row', m).prepend(img);
      }
      img.src = src;
      $('.photo-btn span', m).textContent = 'Change picture';
    };
    const findBox = $('#g-find', m);
    const findMsg = $('.find-msg', m);
    const picks = $('.picks', m);
    const say = (msg) => {
      findMsg.textContent = msg;
      findMsg.hidden = !msg;
    };
    const choose = (x) => {
      chosen = x;
      file = null;
      fileInput.value = '';
      $('#g-name', m).value = shortName(x.title);
      if (x.image) showPicture(x.image);
      picks.hidden = true;
      findBox.value = '';
      say(`Filled in from Amazon${x.price ? ` at ${x.price}` : ''}. Check the name, then add who it's for.`);
      $('#g-for', m).focus();
    };
    const find = async (text) => {
      text = text.trim();
      if (!text) return;
      say('Looking on Amazon…');
      picks.hidden = true;
      try {
        const isLink = /https?:\/\//i.test(text);
        const { results } = isLink ? await api('POST', '/api/amazon/link', { url: text }) : await api('GET', `/api/amazon/search?q=${encodeURIComponent(text)}`);
        if (!results.length) return say('Nothing came up. Try other words, or fill the gift in below.');
        if (isLink) return choose(results[0]);
        say('Tap the one you want.');
        picks.innerHTML = results.map((x, i) => `<button type="button" class="pick" data-i="${i}">
            <span class="pimg">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy">` : ''}</span>
            <span class="ptitle">${esc(x.title || 'Amazon item')}</span>
            <b>${esc(x.price || '')}</b></button>`).join('');
        picks.hidden = false;
        picks.querySelectorAll('.pick').forEach((b) => (b.onclick = () => choose(results[b.dataset.i])));
      } catch (err) {
        say(`${err.message} You can still fill the gift in below.`);
      }
    };
    $('[data-find]', m).onclick = () => find(findBox.value);
    findBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        find(findBox.value);
      }
    });
    findBox.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text');
      if (/https?:\/\//i.test(text)) {
        e.preventDefault();
        findBox.value = text;
        find(text);
      }
    });
    const fileInput = $('input[type=file]', m);
    fileInput.onchange = () => {
      file = fileInput.files[0] || null;
      if (!file) return;
      showPicture(URL.createObjectURL(file));
    };
    $('[data-del]', m)?.addEventListener('click', async () => {
      if (!confirm(`Remove gift ${it.number}, "${it.name}"?`)) return;
      try {
        S = await api('DELETE', `/api/items/${it.id}`);
        close();
        renderList();
        toast(`Removed gift ${it.number}`);
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
    $('[data-delphoto]', m)?.addEventListener('click', async () => {
      try {
        S = await api('DELETE', `/api/items/${it.id}/photo`);
        close();
        renderList();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      const save = $('.foot .btn:last-child', m);
      save.disabled = true;
      const body = { name: $('#g-name', m).value, number: $('#g-num', m).value, person: $('#g-for', m).value, note: $('#g-note', m).value };
      const hide = $('#g-hide', m);
      if (hide) body.hidden = hide.checked;
      if (chosen) {
        body.url = chosen.url;
        body.price = chosen.price;
      }
      try {
        const res = it ? await api('PATCH', `/api/items/${it.id}`, body) : await api('POST', '/api/items', body);
        S = res;
        const id = it ? it.id : res.id;
        // The gift is saved by now, so a picture problem shouldn't send anyone back to add it twice.
        let pictureFailed = false;
        try {
          if (file) S = await api('POST', `/api/items/${id}/photo`, { data: await shrinkPhoto(file) });
          else if (chosen?.image) S = await api('POST', `/api/items/${id}/amazon-image`, { image: chosen.image });
        } catch {
          pictureFailed = true;
        }
        close();
        renderList();
        toast(pictureFailed ? `Saved gift ${body.number}, but its picture didn't load. Open the gift to add one.` : it ? `Saved gift ${body.number}` : `Added gift ${body.number}. Write ${body.number} on the present.`);
      } catch (err) {
        $('.err', m).textContent = err.message;
        save.disabled = false;
      }
    });
  });
}

// Amazon titles run long; keep the part before the first sales pitch.
function shortName(title) {
  const t = String(title || '').trim();
  const first = t.split(/\s[-–—|]\s|,\s|:\s/)[0].trim();
  const pick = first.length >= 12 ? first : t;
  return pick.length > 80 ? `${pick.slice(0, 80).replace(/\s+\S*$/, '')}…` : pick;
}

function shrinkPhoto(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = () => reject(new Error("That picture can't be opened. Try a different one."));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- reveal screen ----------
let typed = '';
let busy = false;
let revealKeys = null;

function renderReveal() {
  inReveal = true;
  keepAwake();
  typed = '';
  busy = false;
  showPad();
  if (revealKeys) document.removeEventListener('keydown', revealKeys);
  revealKeys = (e) => {
    if (!inReveal || busy || $('.overlay')) return;
    if ($('.shown')) {
      if (e.key === 'Enter') showPad();
      return;
    }
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') press('go');
  };
  document.addEventListener('keydown', revealKeys);
}

function revealFrame(body) {
  const info = S.reveal || { opened: [], total: 0 };
  app.innerHTML = `<div class="reveal">
    <div class="rv-top"><span class="progress glass fx">${info.opened.length} of ${info.total} opened</span><button class="btn plain glass fx" id="rv-exit">Leave</button></div>
    <div class="rv-body">${body}</div>
  </div>`;
  $('#rv-exit').onclick = leaveModal;
}

function leaveModal() {
  modal(`<h2>Leave the reveal?</h2>
    <form><label class="lbl" for="lv">Enter your code to go back to the list.</label>
    <input class="field" id="lv" autocomplete="off" autocapitalize="none" spellcheck="false" required>
    <p class="err" role="alert"></p>
    <div class="foot"><button type="button" class="btn plain" data-close>Stay here</button><button class="btn">Leave the reveal</button></div></form>`, (m, close) => {
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        S = await api('POST', '/api/reveal/stop', { code: $('#lv', m).value });
        close();
        inReveal = false;
        revealLocked(false);
        view(renderList);
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
  });
}

// Stops the screen going to sleep between gifts.
let awake = null;
async function keepAwake() {
  try {
    if (inReveal && !awake && navigator.wakeLock) {
      awake = await navigator.wakeLock.request('screen');
      awake.addEventListener('release', () => (awake = null));
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && keepAwake());

// Numbers only, so a label can't give the gift away.
function printLabels() {
  const sheet = document.createElement('div');
  sheet.id = 'labels';
  sheet.innerHTML = S.items.map((i) => `<div class="label">${i.number}</div>`).join('');
  document.body.appendChild(sheet);
  addEventListener('afterprint', () => sheet.remove(), { once: true });
  window.print();
}

function showPad() {
  typed = '';
  const opened = S.reveal?.opened || [];
  view(() => {
    revealFrame(`<div class="rv-panel glass fx">
      <h2>Which gift is next?</h2>
      <div class="display" id="disp" aria-live="polite"><span class="ph">?</span></div>
      <div class="pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
        <button class="clear" data-k="back" aria-label="Delete last digit">Delete</button><button data-k="0">0</button><button class="go" data-k="go">Open</button>
      </div>
      <p class="rv-err" role="alert"></p>
    </div>
    ${opened.length ? `<div class="opened-row fx">${opened.map((n) => `<button class="chip" data-again="${n}" aria-label="Show gift ${n} again">${n}</button>`).join('')}</div>` : ''}`);
    app.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => press(b.dataset.k)));
    app.querySelectorAll('[data-again]').forEach((b) => (b.onclick = () => open(b.dataset.again, true)));
  });
}

function press(k) {
  if (busy) return;
  if (k === 'back') typed = typed.slice(0, -1);
  else if (k === 'go') {
    if (typed) open(typed);
    return;
  } else if (typed.length < 4) typed += k;
  const d = $('#disp');
  if (d) d.innerHTML = typed ? esc(typed) : `<span class="ph">?</span>`;
  const err = $('.rv-err');
  if (err) err.textContent = '';
}

async function open(number, again = false) {
  busy = true;
  let res;
  try {
    res = await api('POST', '/api/reveal', { number: Number(number) });
  } catch (err) {
    busy = false;
    if (inReveal && S) {
      typed = '';
      const d = $('#disp');
      const e = $('.rv-err');
      if (d) d.innerHTML = `<span class="ph">?</span>`;
      if (e) e.textContent = err.message;
    }
    return;
  }
  S.reveal = { opened: res.opened, total: res.total };
  if (!again) {
    await view(() => revealFrame(`<svg class="box shake fx" viewBox="0 0 300 300" aria-hidden="true">
        <rect x="45" y="125" width="210" height="160" rx="10" fill="#b3213f"/><rect x="132" y="125" width="36" height="160" fill="#ffc857"/>
        <g class="lid"><rect x="30" y="85" width="240" height="50" rx="10" fill="#7a122b"/><rect x="132" y="85" width="36" height="50" fill="#ffc857"/>
        <path d="M150 85C110 30 70 45 88 72 98 86 130 86 150 85ZM150 85C190 30 230 45 212 72 202 86 170 86 150 85Z" fill="#ffc857"/></g>
      </svg><p class="suspense glass fx">Gift ${res.item.number}…</p>`));
    tick();
    await wait(calm ? 300 : 1700);
    const box = $('.box');
    if (!box) return;
    box.classList.remove('shake');
    box.classList.add('open');
    chime();
    await wait(calm ? 100 : 420);
    if (!$('.box')) return;
    confetti();
  }
  const it = res.item;
  await view(() => {
    revealFrame(`<div class="shown glass fx">
      <div class="gnum">Gift ${it.number}</div>
      <div class="gname">${esc(it.name)}</div>
      ${it.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="">` : ''}
      <div class="gfor">For <b>${esc(it.person)}</b></div>
      ${it.note ? `<div class="gnote">${esc(it.note)}</div>` : ''}
    </div>
    <button class="btn pine rv-next fx" id="rv-next">Next gift</button>`);
    $('#rv-next').onclick = () => showPad();
    $('#rv-next').focus();
  });
  busy = false;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- sound ----------
let audio;
function note(freq, at, len, vol = 0.14, type = 'triangle') {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = audio.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + len);
}
function tick() {
  try {
    for (let i = 0; i < 8; i++) note(1800 + (i % 2) * 300, i * 0.2, 0.09, 0.05, 'sine');
  } catch {}
}
function chime() {
  try {
    [659, 784, 988, 1319].forEach((f, i) => note(f, i * 0.1, 0.8));
  } catch {}
}

// ---------- confetti and snow ----------
function confetti() {
  if (calm) return;
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#c92a4b', '#ffd479', '#237557', '#ffffff'];
  const bits = Array.from({ length: 170 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 140, y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 15 - 4,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 7 + Math.random() * 7, h: 4 + Math.random() * 5,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.color; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    if (++frames < 190) requestAnimationFrame(draw);
    else c.width = 0; // wipes everything, even if the screen was rotated mid-burst
  })();
}

function snow() {
  if (calm) return;
  const c = $('#snow');
  const ctx = c.getContext('2d');
  let flakes = [];
  const size = () => {
    c.width = innerWidth;
    c.height = innerHeight;
    flakes = Array.from({ length: Math.min(45, Math.round(innerWidth / 30)) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: 1 + Math.random() * 1.6, s: 0.12 + Math.random() * 0.3, p: Math.random() * 6 }));
  };
  addEventListener('resize', size);
  size();
  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (const f of flakes) {
      f.y += f.s; f.p += 0.008; f.x += Math.sin(f.p) * 0.2;
      if (f.y > c.height + 4) { f.y = -4; f.x = Math.random() * c.width; }
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
}

// The other person's changes appear on their own.
setInterval(async () => {
  if (!S || inReveal || document.hidden || $('.overlay')) return;
  try {
    const next = await api('GET', '/api/state');
    if (JSON.stringify(next) !== JSON.stringify(S)) {
      S = next;
      renderList();
    }
  } catch {}
}, 5000);

snow();
start().catch(() => { if (!S) renderGate(); });
