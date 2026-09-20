// OS.ui — navigation stack, alerts, action sheets, sheets, context menus, toasts
(function () {
  const { el, esc } = OS.util;
  const layer = () => document.getElementById('dialogs');
  const ui = OS.ui = OS.ui || {};

  // keep every .ios-slider's filled track in sync
  const paintSlider = (r) => { const min = +r.min || 0, max = +r.max || 100; r.style.setProperty('--v', ((r.value - min) / (max - min || 1)) * 100 + '%'); };
  document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('ios-slider')) paintSlider(e.target); }, true);
  ui.paintSlider = paintSlider;

  // ───────── navigation stack ─────────
  ui.createNav = function (container, opts = {}) {
    const root = el(`<div class="nv${opts.tabBarInset ? ' tab-inset' : ''}"></div>`);
    container.appendChild(root);
    const pages = [];
    const nav = {
      el: root, pages,
      get top() { return pages[pages.length - 1] || null; },
      push(def) {
        const prev = nav.top;
        const page = buildPage(def, prev);
        pages.push(page); root.appendChild(page.el);
        if (prev) {
          page.el.classList.add('nv-enter');
          page.el.getBoundingClientRect();
          requestAnimationFrame(() => { page.el.classList.remove('nv-enter'); prev.el.classList.add('nv-under'); });
          prev.def.onHide && prev.def.onHide(prev);
          setTimeout(() => { if (nav.top !== prev) prev.el.style.visibility = 'hidden'; }, 450);
        }
        def.onShow && def.onShow(page);
        return page;
      },
      pop(animated = true) {
        if (pages.length < 2) return;
        const page = pages.pop(), prev = nav.top;
        prev.el.style.visibility = ''; prev.el.getBoundingClientRect();
        page.def.onHide && page.def.onHide(page);
        document.activeElement && page.el.contains(document.activeElement) && document.activeElement.blur();
        if (animated) { page.el.classList.add('nv-enter'); prev.el.classList.remove('nv-under'); setTimeout(() => page.el.remove(), 430); }
        else { page.el.remove(); prev.el.classList.remove('nv-under'); }
        page.def.onPop && page.def.onPop(page);
        prev.def.onShow && prev.def.onShow(prev);
      },
      popToRoot(animated = true) {
        while (pages.length > 2) { const p = pages.splice(pages.length - 2, 1)[0]; p.el.remove(); p.def.onPop && p.def.onPop(p); }
        nav.pop(animated);
      },
    };

    function buildPage(def, prev) {
      const pe = el(`<div class="nv-page ${def.largeTitle ? 'has-large' : 'no-large at-top'}">
        <div class="nv-body ios-scroll"></div>
        <div class="nv-bar"><div class="nv-side left"></div><div class="nv-title"></div><div class="nv-side right"></div></div>
      </div>`);
      if (def.background) pe.style.background = def.background;
      const body = pe.querySelector('.nv-body'), titleEl = pe.querySelector('.nv-title'), leftEl = pe.querySelector('.nv-side.left'), rightEl = pe.querySelector('.nv-side.right');
      const page = { el: pe, body, def, nav };
      const mkBtn = (b) => {
        const n = el(`<div class="nv-btn${b.bold ? ' bold' : ''}${b.disabled ? ' disabled' : ''}">${b.icon || esc(b.label || '')}</div>`);
        if (b.color) n.style.color = b.color;
        n.addEventListener('click', (e) => { e.stopPropagation(); b.onTap && b.onTap(page, n); });
        return n;
      };
      page.setTitle = (t) => { def.title = t; titleEl.textContent = t || ''; if (large) large.querySelector('h1').textContent = t || ''; };
      page.setRight = (arr) => { rightEl.innerHTML = ''; (Array.isArray(arr) ? arr : arr ? [arr] : []).forEach((b) => rightEl.appendChild(mkBtn(b))); };
      page.setLeft = (b) => {
        leftEl.innerHTML = '';
        if (b) leftEl.appendChild(mkBtn(b));
        else if (prev) {
          const back = el(`<div class="nv-back"><span>${esc(def.back || prev.def.title || 'Back')}</span></div>`);
          back.addEventListener('click', () => nav.pop()); leftEl.appendChild(back);
        }
      };
      let large = null, search = null;
      if (def.largeTitle === true) large = el(`<div class="nv-large"><h1 class="ios-large-title"></h1></div>`);
      if (def.search) {
        search = el(`<div class="nv-search"><div class="ios-search"><input type="text" placeholder="${esc(def.search.placeholder || 'Search')}" enterkeyhint="search" autocomplete="off"></div></div>`);
        search.querySelector('input').addEventListener('input', (e) => def.search.onInput && def.search.onInput(e.target.value, page));
      }
      page.setTitle(def.title); page.setLeft(def.left); page.setRight(def.right);
      try { def.render && def.render(body, page); } catch (e) { console.error('[nav render]', e); }
      // headers live inside the scroller; re-attach them if the app re-renders body.innerHTML
      const attach = () => {
        if (search && search.parentNode !== body) body.prepend(search);
        if (large && large.parentNode !== body) body.prepend(large);
      };
      attach();
      if (large || search) new MutationObserver(attach).observe(body, { childList: true });
      body.addEventListener('scroll', () => {
        const y = body.scrollTop;
        pe.classList.toggle('scrolled', y > (def.largeTitle ? 38 : 4));
        pe.classList.toggle('at-top', y <= 4);
      }, { passive: true });

      // edge-swipe back
      if (prev) OS.util.drag(pe, {
        axis: 'x', filter: (e) => OS.util.screenPoint(e).x < 28 && !def.left,
        onStart() { prev.el.style.visibility = ''; pe.classList.add('nv-drag'); prev.el.classList.add('nv-drag'); },
        onMove(p) { const x = Math.max(0, p.dx); pe.style.transform = `translateX(${x}px)`; prev.el.style.transform = `translateX(${-30 + (x / OS.W) * 30}%)`; },
        onEnd(p) {
          pe.classList.remove('nv-drag'); prev.el.classList.remove('nv-drag'); pe.style.transform = ''; prev.el.style.transform = '';
          if ((p.dx > OS.W * .35 || p.vx > .5) && nav.top === page) nav.pop();
        },
      });
      return page;
    }
    return nav;
  };

  // ───────── modal plumbing ─────────
  function mount(node, backdropClass = 'dlg-backdrop') {
    const bd = el(`<div class="${backdropClass}"></div>`);
    layer().appendChild(bd); layer().appendChild(node);
    node.getBoundingClientRect();
    requestAnimationFrame(() => { bd.classList.add('in'); node.classList.add('in'); });
    return { bd, close(after) { bd.classList.remove('in'); node.classList.remove('in'); setTimeout(() => { bd.remove(); node.remove(); after && after(); }, 380); } };
  }

  ui.alert = function ({ title = '', message = '', buttons } = {}) {
    buttons = buttons && buttons.length ? buttons : [{ label: 'OK', style: 'cancel' }];
    return new Promise((resolve) => {
      const node = el(`<div class="ios-alert"><div class="ios-alert-body"><div class="ios-alert-title">${esc(title)}</div>${message ? `<div class="ios-alert-msg">${esc(message)}</div>` : ''}</div>
        <div class="ios-alert-btns${buttons.length > 2 ? ' stack' : ''}"></div></div>`);
      const m = mount(node);
      buttons.forEach((b, i) => {
        const bn = el(`<button class="${b.style || ''}${b.bold ? ' bold' : ''}">${esc(b.label)}</button>`);
        bn.addEventListener('click', () => { m.close(); b.onTap && b.onTap(); resolve(i); });
        node.querySelector('.ios-alert-btns').appendChild(bn);
      });
      OS.haptic && OS.haptic('light');
    });
  };

  ui.prompt = function ({ title = '', message = '', placeholder = '', value = '', okLabel = 'OK', cancelLabel = 'Cancel', type = 'text' } = {}) {
    return new Promise((resolve) => {
      const node = el(`<div class="ios-alert"><div class="ios-alert-body"><div class="ios-alert-title">${esc(title)}</div>${message ? `<div class="ios-alert-msg">${esc(message)}</div>` : ''}
        <input type="${type === 'password' ? 'password' : 'text'}" placeholder="${esc(placeholder)}" value="${esc(value)}" enterkeyhint="done" autocomplete="off"></div>
        <div class="ios-alert-btns"><button class="cancel">${esc(cancelLabel)}</button><button class="bold">${esc(okLabel)}</button></div></div>`);
      const m = mount(node); const input = node.querySelector('input'); const [c, ok] = node.querySelectorAll('button');
      const done = (v) => { input.blur(); m.close(); resolve(v); };
      c.addEventListener('click', () => done(null)); ok.addEventListener('click', () => done(input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(input.value); } });
      setTimeout(() => { input.focus(); input.select && input.select(); }, 60);
    });
  };

  ui.actionSheet = function ({ title = '', message = '', buttons = [], cancel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const node = el(`<div class="ios-as"><div class="ios-as-group">${title || message ? `<div class="ios-as-head">${title ? `<b>${esc(title)}</b>` : ''}${esc(message)}</div>` : ''}</div>
        ${cancel ? `<div class="ios-as-group ios-as-cancel"><button>${esc(cancel)}</button></div>` : ''}</div>`);
      const m = mount(node); let settled = false;
      const done = (i, b) => { if (settled) return; settled = true; m.close(); b && b.onTap && b.onTap(); resolve(i); };
      buttons.forEach((b, i) => {
        const bn = el(`<button class="${b.style || ''}">${b.icon ? `<span class="mi">${b.icon}</span>` : ''}${esc(b.label)}</button>`);
        bn.addEventListener('click', () => done(i, b)); node.querySelector('.ios-as-group').appendChild(bn);
      });
      const cb = node.querySelector('.ios-as-cancel button'); cb && cb.addEventListener('click', () => done(-1));
      m.bd.addEventListener('click', () => done(-1));
    });
  };

  let toastEl = null, toastTimer = 0;
  ui.toast = function (text, ms = 1600) {
    if (toastEl) toastEl.remove();
    toastEl = el(`<div class="ios-toast">${esc(text)}</div>`); layer().appendChild(toastEl);
    const t = toastEl; t.getBoundingClientRect(); requestAnimationFrame(() => t.classList.add('in'));
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
  };

  ui.sheet = function ({ title = '', height = 'large', left, right, render, onClose, background } = {}) {
    const node = el(`<div class="ios-sheet${height === 'medium' ? ' medium' : ''}"><div class="ios-sheet-bar"><div class="ios-sheet-grab"></div><div class="sl"></div><div class="ios-sheet-title">${esc(title)}</div><div class="sr"></div></div><div class="ios-sheet-body ios-scroll"></div></div>`);
    if (typeof height === 'number') node.style.top = (OS.H - height) + 'px';
    if (background) node.style.background = background;
    const m = mount(node, 'ios-sheet-backdrop'); let closed = false;
    const sheet = {
      el: node, body: node.querySelector('.ios-sheet-body'),
      setTitle(t) { node.querySelector('.ios-sheet-title').textContent = t; },
      close() { if (closed) return; closed = true; const a = document.activeElement; a && node.contains(a) && a.blur(); m.close(); onClose && onClose(); },
      setRight(b) { mk(node.querySelector('.sr'), b); }, setLeft(b) { mk(node.querySelector('.sl'), b); },
    };
    function mk(host, b) {
      host.innerHTML = ''; if (!b) return;
      const n = el(`<div class="ios-btn-plain${b.bold ? ' bold' : ''}${b.disabled ? ' disabled' : ''}" style="${b.disabled ? 'opacity:.35;pointer-events:none' : ''}">${b.icon || esc(b.label || '')}</div>`);
      n.addEventListener('click', () => b.onTap ? b.onTap(sheet) : sheet.close()); host.appendChild(n);
    }
    mk(node.querySelector('.sl'), left); mk(node.querySelector('.sr'), right);
    m.bd.addEventListener('click', () => sheet.close());
    // drag the bar down to dismiss
    OS.util.drag(node.querySelector('.ios-sheet-bar'), {
      axis: 'y', onStart() { node.classList.add('dragging'); }, onMove(p) { node.style.transform = `translateY(${Math.max(0, p.dy)}px)`; },
      onEnd(p) { node.classList.remove('dragging'); node.style.transform = ''; if (p.dy > 140 || p.vy > .6) sheet.close(); },
    });
    try { render && render(sheet.body, sheet); } catch (e) { console.error('[sheet render]', e); }
    return sheet;
  };

  ui.contextMenu = function (anchor, items = []) {
    const old = layer().querySelector('.ios-menu-wrap'); old && old.remove();
    const wrap = el(`<div class="ios-menu-wrap" style="position:absolute;inset:0"><div class="ios-menu"></div></div>`);
    const menu = wrap.firstElementChild;
    const close = () => { menu.classList.remove('in'); setTimeout(() => wrap.remove(), 200); };
    items.filter(Boolean).forEach((it) => {
      const b = el(`<button class="${it.style || ''}"><span>${esc(it.label)}</span>${it.icon ? (String(it.icon).trim().startsWith('<') ? it.icon : `<span class="mi">${esc(it.icon)}</span>`) : ''}</button>`);
      b.addEventListener('click', (e) => { e.stopPropagation(); close(); it.onTap && it.onTap(); }); menu.appendChild(b);
    });
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { close(); e.stopPropagation(); } });
    layer().appendChild(wrap);
    let r = { x: OS.W / 2 - 110, y: OS.H / 2, w: 0, h: 0 };
    if (anchor && anchor.getBoundingClientRect) r = OS.util.rect(anchor); else if (anchor && anchor.x != null) r = { x: anchor.x, y: anchor.y, w: 0, h: 0 };
    const mw = 250, mh = items.length * 44;
    let x = OS.util.clamp(r.x + r.w / 2 - mw / 2, 10, OS.W - mw - 10);
    let below = r.y + r.h + 8 + mh < OS.H - 40;
    let y = below ? r.y + r.h + 8 : Math.max(60, r.y - mh - 8);
    menu.style.left = x + 'px'; menu.style.top = y + 'px'; menu.style.width = mw + 'px';
    menu.style.transformOrigin = `${OS.util.clamp(r.x + r.w / 2 - x, 0, mw)}px ${below ? 0 : mh}px`;
    menu.getBoundingClientRect(); requestAnimationFrame(() => menu.classList.add('in'));
    OS.haptic && OS.haptic('medium');
    return { close };
  };
})();
