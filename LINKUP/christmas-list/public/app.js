// Christmas Numbers front end: sign in, gifts by person, people, the Find page and the reveal.
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
let tab = ['gifts', 'find', 'people'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'gifts';
let inReveal = false;

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') {
    S = null;
    renderGate();
    throw new Error('Sign in first.');
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
const SHOW_PASSWORD = `<label class="check small"><input type="checkbox" data-show> Show password</label>`;

function renderGate() {
  document.querySelector('.overlay')?.remove();
  inReveal = false;
  app.innerHTML = `<div class="gate"><div class="glass gate-card fx">
      <h1>Christmas Numbers</h1>
      <div class="tabs" role="group" aria-label="Sign in or create account">
        <button type="button" data-tab="in" aria-pressed="true">Sign in</button>
        <button type="button" data-tab="new" aria-pressed="false">Create account</button>
      </div>
      <form id="f-in" class="stack">
        <div><label class="lbl" for="in-name">Your name</label><input class="field" id="in-name" name="username" autocomplete="username" autocapitalize="words" required></div>
        <div><label class="lbl" for="in-pass">Password</label><input class="field" id="in-pass" type="password" autocomplete="current-password" required></div>
        ${SHOW_PASSWORD}
        <p class="err" role="alert"></p>
        <button class="btn wide">Sign in</button>
      </form>
      <form id="f-new" class="stack" hidden>
        <p class="sub">You only do this once. Your code stops working after this.</p>
        <div><label class="lbl" for="new-code">One-time code</label><input class="field" id="new-code" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" required></div>
        <div><label class="lbl" for="new-name">Your name</label><input class="field" id="new-name" name="username" maxlength="30" autocomplete="username" autocapitalize="words" required></div>
        <div><label class="lbl" for="new-pass">Choose a password</label><input class="field" id="new-pass" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div>
        ${SHOW_PASSWORD}
        <p class="err" role="alert"></p>
        <button class="btn wide">Create account</button>
      </form>
    </div></div>`;
  const forms = { in: $('#f-in'), new: $('#f-new') };
  app.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => {
      app.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      forms.in.hidden = b.dataset.tab !== 'in';
      forms.new.hidden = b.dataset.tab !== 'new';
      $('input', forms[b.dataset.tab]).focus();
    };
  });
  app.querySelectorAll('[data-show]').forEach((c) => {
    c.onchange = () => (c.closest('form').querySelector('[autocomplete$="password"]').type = c.checked ? 'text' : 'password');
  });
  const submit = (form, send) =>
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('.btn', form);
      const err = $('.err', form);
      btn.disabled = true;
      err.textContent = '';
      try {
        await send();
        await start();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    });
  submit(forms.in, () => api('POST', '/api/login', { name: $('#in-name').value, password: $('#in-pass').value }));
  submit(forms.new, () => api('POST', '/api/register', { code: $('#new-code').value, name: $('#new-name').value, password: $('#new-pass').value }));
  $('#in-name').focus();
}

async function start() {
  S = await api('GET', '/api/state');
  if (revealLocked()) {
    if (S.reveal) return renderReveal();
    revealLocked(false);
  }
  await view(renderMain);
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

// ---------- main screen ----------
function otherName() {
  return S.users[S.me === 'a' ? 'b' : 'a'].name || 'the other person';
}

function header() {
  const tabs = [['gifts', 'Gifts'], ['find', 'Find'], ['people', 'People']];
  return `<header class="top">
    <h1>Christmas Numbers</h1>
    <nav class="tabs" aria-label="Pages">${tabs.map(([id, label]) => `<button data-go="${id}" ${tab === id ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</nav>
  </header>`;
}

function renderMain() {
  document.title = 'Christmas Numbers';
  app.innerHTML = `<div class="page">${header()}${{ gifts: giftsPage, find: findPage, people: peoplePage }[tab]()}</div>`;
  app.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => {
      if (tab === b.dataset.go) return;
      tab = b.dataset.go;
      history.replaceState(null, '', `#${tab}`);
      view(renderMain);
    };
  });
  app.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => actions[b.dataset.a]()));
  app.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => itemModal(S.items.find((i) => i.id === b.dataset.id))));
  app.querySelectorAll('[data-add-for]').forEach((b) => (b.onclick = () => itemModal(null, b.dataset.addFor)));
  app.querySelectorAll('[data-person]').forEach((b) => (b.onclick = () => personModal(S.people.find((p) => p.id === b.dataset.person))));
  if (tab === 'find') wireFind();
}

// Everyone on the People page, then anyone else who has a gift.
function giftGroups() {
  const groups = S.people.map((p) => ({ name: p.name, items: [] }));
  for (const it of S.items) {
    let g = groups.find((x) => x.name.toLowerCase() === it.person.toLowerCase());
    if (!g) groups.push((g = { name: it.person, items: [] }));
    g.items.push(it);
  }
  return groups;
}

function giftsPage() {
  const groups = giftGroups();
  if (!groups.length) {
    return `<div class="column"><div class="empty glass fx"><h2>Add your people first</h2><p>Type everyone's names once. Then add gifts under each person.</p><button class="btn" data-a="addPerson">Add names</button></div></div>`;
  }
  return `<div class="summary fx">
      <span>${S.items.length} ${S.items.length === 1 ? 'gift' : 'gifts'} for ${groups.length} ${groups.length === 1 ? 'person' : 'people'}</span>
      ${S.items.length ? `<button class="textbtn" data-a="labels">Print labels</button>` : ''}
    </div>
    <div class="cards">${groups.map(personCard).join('')}
      <button class="new-person fx" data-a="addPerson">+ Add a person</button>
    </div>`;
}

function personCard(g) {
  return `<section class="card glass fx">
    <div class="card-head"><h2>${esc(g.name)}</h2>${g.items.length ? `<span class="badge">${g.items.length}</span>` : ''}</div>
    ${g.items.length ? `<ul class="rows">${g.items.map(giftRow).join('')}</ul>` : ''}
    <button class="card-add" data-add-for="${esc(g.name)}" aria-label="Add a gift for ${esc(g.name)}">+ Add gift</button>
  </section>`;
}

function giftRow(it) {
  const hidden = it.hidden && !it.opened;
  return `<li><button class="gift" data-id="${esc(it.id)}" aria-label="Edit gift ${it.number}, ${esc(it.name)}">
    <span class="num">${it.number}</span>
    <span class="what">${esc(it.name)}</span>
    ${it.opened ? `<span class="state done" title="Opened">${CHECK}</span>` : hidden ? `<span class="state" title="Hidden from ${esc(otherName())}">${LOCK}</span>` : ''}
    ${it.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="" loading="lazy">` : ''}
  </button></li>`;
}

function peoplePage() {
  const opened = S.items.some((i) => i.opened);
  return `<div class="column"><section class="list glass fx">
    <div class="page-head">
      <div><h2>People</h2><p>You both share this list of names.</p></div>
      <button class="btn small" data-a="addPerson">Add names</button>
    </div>
    ${S.people.length ? `<ul class="rows">${S.people.map((p) => {
      const count = S.items.filter((i) => i.person.toLowerCase() === p.name.toLowerCase()).length;
      return `<li><button class="person" data-person="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">
        <span class="what">${esc(p.name)}</span><span class="count">${count} ${count === 1 ? 'gift' : 'gifts'}</span>
      </button></li>`;
    }).join('')}</ul>` : `<p class="none">Nobody yet.</p>`}
  </section>
  <div class="links fx">
    <button class="textbtn" data-a="name">Change name</button>
    <button class="textbtn" data-a="password">Change password</button>
    ${opened ? `<button class="textbtn" data-a="reset">Close all gifts</button>` : ''}
    <button class="textbtn" data-a="out">Sign out</button>
  </div></div>`;
}

const actions = {
  addPerson: () => personModal(null),
  name: () => nameModal(),
  password: () => passwordModal(),
  labels: () => printLabels(),
  reveal: () => {
    modal(`<h2>Start the reveal?</h2>
      <p class="plain-text">Do this together when you're ready. Typing a number now opens that gift, even hidden ones, and this device stays on this screen. Leaving it takes one of your passwords.</p>
      <form><label class="lbl" for="oc">${esc(otherName())}'s password</label>
      <input class="field" id="oc" type="password" autocomplete="off" required>
      <p class="err" role="alert"></p>
      <div class="foot"><button type="button" class="btn plain" data-close>Cancel</button><button class="btn pine">Start the reveal</button></div></form>`, (m, close) => {
      $('form', m).addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          S = await api('POST', '/api/reveal/start', { password: $('#oc', m).value });
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
    renderMain();
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
  (ov.querySelector('[data-autofocus]') || ov.querySelector('input:not([type=file]), textarea'))?.focus();
}

function personModal(p) {
  if (!p) {
    modal(`<h2>Add names</h2>
      <form class="stack">
        <div><label class="lbl" for="p-names">One name per line</label><textarea class="field" id="p-names" rows="6" placeholder="Mom&#10;Dad&#10;Grandma"></textarea></div>
        <p class="err" role="alert"></p>
        <div class="foot"><button type="button" class="btn plain" data-close>Cancel</button><button class="btn">Add names</button></div>
      </form>`, (m, close) => {
      $('form', m).addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          S = await api('POST', '/api/people', { names: $('#p-names', m).value.split(/[\n,]+/) });
          close();
          renderMain();
        } catch (err) {
          $('.err', m).textContent = err.message;
        }
      });
    });
    return;
  }
  modal(`<h2>${esc(p.name)}</h2>
    <form class="stack">
      <div><label class="lbl" for="p-name">Name</label><input class="field" id="p-name" maxlength="40" autocomplete="off" value="${esc(p.name)}" required></div>
      <p class="err" role="alert"></p>
      <div class="foot">
        <button type="button" class="textbtn danger" data-del>Remove</button>
        <button type="button" class="btn plain" data-close>Cancel</button>
        <button class="btn">Save</button>
      </div>
    </form>`, (m, close) => {
    $('[data-del]', m).addEventListener('click', async () => {
      if (!confirm(`Remove ${p.name}? Their gifts stay on the list.`)) return;
      try {
        S = await api('DELETE', `/api/people/${p.id}`);
        close();
        renderMain();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        S = await api('PATCH', `/api/people/${p.id}`, { name: $('#p-name', m).value });
        close();
        renderMain();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
  });
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
        renderMain();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
  });
}

function passwordModal() {
  modal(`<h2>Change my password</h2>
    <form class="stack">
      <div><label class="lbl" for="pw-now">Current password</label><input class="field" id="pw-now" type="password" autocomplete="current-password" required></div>
      <div><label class="lbl" for="pw-next">New password</label><input class="field" id="pw-next" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div>
      <p class="err" role="alert"></p>
      <div class="foot"><button type="button" class="btn plain" data-close>Cancel</button><button class="btn">Save password</button></div>
    </form>`, (m, close) => {
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('POST', '/api/me/password', { password: $('#pw-now', m).value, next: $('#pw-next', m).value });
        close();
        toast('Password saved');
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
  });
}

function itemModal(it, forPerson = '') {
  const people = S.people.map((p) => p.name);
  const adder = it && S.users[it.addedBy]?.name;
  const person = it ? it.person : forPerson;
  modal(`<button type="button" class="x" data-close aria-label="Close">×</button>
    <h2>${it ? `Gift ${it.number}` : `Gift for ${esc(forPerson)}`}</h2>
    <form class="stack">
      <div class="who" ${it ? '' : 'hidden'}><label class="lbl" for="g-for">Who is it for?</label>
        ${people.length ? `<div class="who-chips">${people.map((p) => `<button type="button" data-who="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
        <input class="field" id="g-for" maxlength="40" autocomplete="off" placeholder="${people.length ? 'Or type a new name' : 'Type a name'}" value="${esc(person)}" required></div>
      <div>${it ? `<label class="lbl" for="g-name">What's the gift?</label>` : ''}
        <input class="field" id="g-name" maxlength="120" ${it ? '' : 'data-autofocus aria-label="What\'s the gift?"'} autocomplete="off" placeholder="What's the gift?" value="${esc(it?.name)}" required>
        <p class="find-msg" role="status" hidden></p>
        <div class="picks" hidden></div></div>
      <div class="gift-tools" ${it ? '' : 'hidden'}>
        <button type="button" class="btn plain small" data-find>Find on Amazon</button>
        <label class="btn plain small photo-btn"><span>${it?.photo ? 'Change picture' : 'Add a picture'}</span><input type="file" accept="image/*" style="position:absolute;opacity:0;width:1px"></label>
      </div>
      <div class="photo-row" ${it?.photo ? '' : 'hidden'}>
        ${it?.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="">` : ''}
        ${it?.photo ? `<button type="button" class="textbtn" data-delphoto>Remove picture</button>` : ''}
      </div>
      ${!it || it.addedBy === S.me ? `<label class="check"><input type="checkbox" id="g-hide" ${it?.hidden ? 'checked' : ''}> Hide this from ${esc(otherName())}</label>` : ''}
      <details class="more" ${it ? '' : 'hidden'} ${it?.note ? 'open' : ''}><summary>Add a note</summary>
        <input class="field" id="g-note" maxlength="200" aria-label="Note" placeholder="Size, color, where it's hidden" value="${esc(it?.note)}"></details>
      ${it?.url ? `<p class="amazon-link"><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">View on Amazon</a></p>` : ''}
      ${adder ? `<p class="added-by">Added by ${esc(adder)}</p>` : ''}
      <p class="err" role="alert"></p>
      ${it ? `<div class="foot">
        <button type="button" class="textbtn danger" data-del>Remove gift</button>
        <button class="btn">Save</button>
      </div>` : `<button class="btn wide">Add gift</button>`}
    </form>`, (m, close) => {
    let file = null;
    let chosen = null;
    const whoBox = $('#g-for', m);
    const nameBox = $('#g-name', m);
    const markWho = () => m.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.who.toLowerCase() === whoBox.value.trim().toLowerCase()));
    m.querySelectorAll('[data-who]').forEach((b) => {
      b.onclick = () => {
        whoBox.value = b.dataset.who;
        markWho();
      };
    });
    whoBox.addEventListener('input', markWho);
    markWho();
    const fileInput = $('input[type=file]', m);
    const showPicture = (src) => {
      const row = $('.photo-row', m);
      let img = $('img', row);
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        row.prepend(img);
      }
      img.src = src;
      row.hidden = false;
      $('.photo-btn span', m).textContent = 'Change picture';
    };
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
      nameBox.value = shortName(x.title);
      if (x.image) showPicture(x.image);
      picks.hidden = true;
      say(`Filled in from Amazon${x.price ? ` at ${x.price}` : ''}.`);
    };
    const find = async (text) => {
      text = text.trim();
      if (!text) {
        say('Type what you want first, then tap Find on Amazon.');
        nameBox.focus();
        return;
      }
      say('Looking on Amazon…');
      picks.hidden = true;
      try {
        const isLink = /https?:\/\//i.test(text);
        const { results } = isLink ? await api('POST', '/api/amazon/link', { url: text }) : await api('GET', `/api/amazon/search?q=${encodeURIComponent(text)}`);
        if (!results.length) return say('Nothing came up. Try other words.');
        if (isLink) return choose(results[0]);
        say('Tap the one you want.');
        picks.innerHTML = results.map((x, i) => `<button type="button" class="pick" data-i="${i}">
            <span class="pimg">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy">` : ''}</span>
            <span class="ptitle">${esc(x.title || 'Amazon item')}</span>
            <b>${esc(x.price || '')}</b></button>`).join('');
        picks.hidden = false;
        picks.querySelectorAll('.pick').forEach((b) => (b.onclick = () => choose(results[b.dataset.i])));
      } catch (err) {
        say(`${err.message} You can still type the gift yourself.`);
      }
    };
    $('[data-find]', m).onclick = () => find(nameBox.value);
    nameBox.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text');
      if (/https?:\/\//i.test(text)) {
        e.preventDefault();
        nameBox.value = '';
        find(text);
      }
    });
    fileInput.onchange = () => {
      file = fileInput.files[0] || null;
      if (file) showPicture(URL.createObjectURL(file));
    };
    $('[data-del]', m)?.addEventListener('click', async () => {
      if (!confirm(`Remove gift ${it.number}, "${it.name}"?`)) return;
      try {
        S = await api('DELETE', `/api/items/${it.id}`);
        close();
        renderMain();
        toast(`Removed gift ${it.number}`);
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
    $('[data-delphoto]', m)?.addEventListener('click', async () => {
      try {
        S = await api('DELETE', `/api/items/${it.id}/photo`);
        close();
        renderMain();
      } catch (err) {
        $('.err', m).textContent = err.message;
      }
    });
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      // A link typed by hand gets looked up instead of being saved as the gift's name.
      if (/https?:\/\//i.test(nameBox.value)) {
        const link = nameBox.value;
        nameBox.value = '';
        return find(link);
      }
      const save = $('form > .btn, .foot .btn:last-child', m);
      save.disabled = true;
      const body = { name: nameBox.value, person: whoBox.value, note: $('#g-note', m).value };
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
        renderMain();
        if (it) toast(pictureFailed ? "Saved, but the picture didn't load." : 'Saved');
        else numberModal(S.items.find((i) => i.id === id), pictureFailed);
      } catch (err) {
        $('.err', m).textContent = err.message;
        save.disabled = false;
      }
    });
  });
}

// Shows the new gift's number, the one thing to do next.
function numberModal(it, pictureFailed) {
  modal(`<div class="new-number">
      <p>Write this on the present</p>
      <div class="big">${it.number}</div>
      <p class="for-line">${esc(it.name)} for ${esc(it.person)}</p>
      ${pictureFailed ? `<p class="err">The picture didn't load. Open the gift to add one.</p>` : ''}
    </div>
    <div class="foot even"><button class="btn plain" data-close>Done</button><button class="btn" data-more>Add another</button></div>`, (m, close) => {
    $('[data-more]', m).onclick = () => {
      close();
      itemModal(null, it.person);
    };
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

// ---------- find page and reveal ----------
// The same typing box does both. Before the reveal it just looks gifts up; during it, gifts open.
function findPanel() {
  return `<section class="finder-page">
    <form class="find-card glass fx" id="find-form">
      <label for="find-num">Type the number on the present</label>
      <div class="find-box">
        <input id="find-num" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" enterkeyhint="go" placeholder="000" aria-label="Gift number">
        <button class="btn">Show</button>
      </div>
    </form>
    <div id="result" aria-live="polite"></div>
    ${inReveal ? '' : `<div class="reveal-note fx"><p>Hidden gifts only show who they're for until you start the reveal together.</p><button class="btn plain small" data-a="reveal">Start the reveal</button></div>`}
  </section>`;
}
const findPage = findPanel;

function renderReveal() {
  inReveal = true;
  keepAwake();
  tab = 'find';
  view(() => {
    const info = S.reveal || { opened: [], total: 0 };
    app.innerHTML = `<div class="page reveal-page">
      <div class="rv-top"><span class="progress glass fx" id="progress">${info.opened.length} of ${info.total} opened</span><button class="btn plain glass fx" id="rv-exit">Leave</button></div>
      ${findPanel()}
    </div>`;
    $('#rv-exit').onclick = leaveModal;
    wireFind();
  });
}

let busy = false;
function wireFind() {
  const box = $('#find-num');
  busy = false;
  box.addEventListener('input', () => (box.value = box.value.replace(/\D/g, '')));
  $('#find-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (box.value && !busy) lookup(box.value);
  });
  if (!matchMedia('(pointer: coarse)').matches) box.focus();
}

function giftCard(it) {
  return `<article class="shown glass result-in">
    <div class="gnum">Gift ${it.number}</div>
    <div class="gfor">For <b>${esc(it.person)}</b></div>
    ${it.photo ? `<img src="/photo/${esc(it.photo)}.jpg" alt="">` : ''}
    <div class="gname">${esc(it.name)}</div>
    ${it.note ? `<div class="gnote">${esc(it.note)}</div>` : ''}
  </article>`;
}

async function lookup(number) {
  const result = $('#result');
  const box = $('#find-num');
  busy = true;
  // A phone keyboard would cover the answer; on a computer, be ready for the next number.
  if (matchMedia('(pointer: coarse)').matches) box.blur();
  else box.select();
  try {
    const res = await api('POST', '/api/find', { number: Number(number) });
    if (res.reveal) {
      S.reveal = res.reveal;
      const p = $('#progress');
      if (p) p.textContent = `${res.reveal.opened.length} of ${res.reveal.total} opened`;
    }
    if (res.hiddenFor) {
      result.innerHTML = `<article class="shown glass result-in">
        <div class="gnum">Gift ${res.number}</div>
        <div class="gfor">For <b>${esc(res.hiddenFor)}</b></div>
        <div class="gnote">What it is stays hidden until the reveal.</div>
      </article>`;
    } else if (res.first) {
      result.innerHTML = `<div class="opening"><svg class="box shake" viewBox="0 0 300 300" aria-hidden="true">
          <rect x="45" y="125" width="210" height="160" rx="10" fill="#b3213f"/><rect x="132" y="125" width="36" height="160" fill="#ffc857"/>
          <g class="lid"><rect x="30" y="85" width="240" height="50" rx="10" fill="#7a122b"/><rect x="132" y="85" width="36" height="50" fill="#ffc857"/>
          <path d="M150 85C110 30 70 45 88 72 98 86 130 86 150 85ZM150 85C190 30 230 45 212 72 202 86 170 86 150 85Z" fill="#ffc857"/></g>
        </svg></div>`;
      tick();
      await wait(calm ? 300 : 1700);
      const giftBox = $('.box');
      if (!giftBox) return;
      giftBox.classList.remove('shake');
      giftBox.classList.add('open');
      chime();
      await wait(calm ? 100 : 420);
      if (!$('#result')) return;
      confetti();
      result.innerHTML = giftCard(res.item);
    } else {
      result.innerHTML = giftCard(res.item);
    }
  } catch (err) {
    result.innerHTML = `<p class="miss glass result-in" role="alert">${esc(err.message)}</p>`;
  }
  busy = false;
  result.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
}

function leaveModal() {
  modal(`<h2>Leave the reveal?</h2>
    <form><label class="lbl" for="lv">Enter a password to go back to the list.</label>
    <input class="field" id="lv" type="password" autocomplete="off" required>
    <p class="err" role="alert"></p>
    <div class="foot"><button type="button" class="btn plain" data-close>Stay here</button><button class="btn">Leave the reveal</button></div></form>`, (m, close) => {
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        S = await api('POST', '/api/reveal/stop', { password: $('#lv', m).value });
        close();
        inReveal = false;
        revealLocked(false);
        view(renderMain);
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
  if (!S || inReveal || tab === 'find' || document.hidden || $('.overlay')) return;
  try {
    const next = await api('GET', '/api/state');
    if (JSON.stringify(next) !== JSON.stringify(S)) {
      S = next;
      renderMain();
    }
  } catch {}
}, 5000);

snow();
start().catch(() => { if (!S) renderGate(); });
