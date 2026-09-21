// Messages — real texts between real accounts on this iPhone's server. No scripted people, no AI.
(function () {
  const { el, esc } = OS.util;
  const A = () => OS.account;
  let S = null;

  OS.addStyle('messages', `
    .app-messages .mg-list{padding:0 0 30px}
    .app-messages .mg-row{position:relative;display:flex;align-items:center;gap:12px;padding:10px 16px 10px 14px;cursor:pointer;min-height:76px}
    .app-messages .mg-row+.mg-row::before{content:'';position:absolute;left:78px;right:0;top:0;height:.5px;background:var(--sep)}
    .app-messages .mg-row .dot{width:10px;height:10px;border-radius:50%;background:var(--tint);flex:none;margin-left:-6px;opacity:0}
    .app-messages .mg-row.unread .dot{opacity:1}
    .app-messages .mg-tx{flex:1;min-width:0}
    .app-messages .mg-tx b{display:block;font-size:17px;font-weight:600;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .app-messages .mg-tx span{display:block;font-size:15px;line-height:20px;color:var(--label2);letter-spacing:-.24px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .app-messages .mg-when{font-size:15px;color:var(--label2);flex:none;align-self:flex-start;margin-top:4px;display:flex;align-items:center;gap:4px}
    .app-messages .mg-when::after{content:'';width:7px;height:12px;background:var(--label3);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 13'%3E%3Cpath d='M1.5 1.5l5 5-5 5' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}
    .app-messages .mg-empty{text-align:center;padding:90px 40px;color:var(--label2)}
    .app-messages .mg-empty b{display:block;font-size:20px;font-weight:700;color:var(--label);margin-bottom:6px}
    .app-messages .mg-conv{position:absolute;inset:0;background:var(--bg);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .42s var(--ease);z-index:6}
    .app-messages .mg-conv.in{transform:none} .app-messages .mg-conv.drag{transition:none}
    .app-messages .mg-top{flex:none;padding-top:var(--safe-top);height:calc(var(--safe-top) + 70px);display:flex;align-items:center;gap:6px;padding-inline:8px;background:var(--bar);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:0 .5px 0 var(--sep);position:relative}
    .app-messages .mg-top .who{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
    .app-messages .mg-top .who b{font-size:12px;font-weight:500;letter-spacing:-.1px}
    .app-messages .mg-scroll{flex:1;min-height:0;padding:10px 10px calc(var(--kb-h) + 76px);display:flex;flex-direction:column;gap:2px}
    .app-messages .mg-b{max-width:74%;padding:8px 14px;border-radius:19px;font-size:17px;line-height:22px;letter-spacing:-.4px;position:relative;word-wrap:break-word;white-space:pre-wrap;animation:mgin .3s var(--ease)}
    @keyframes mgin{from{transform:scale(.85) translateY(8px);opacity:0}}
    .app-messages .mg-b.me{align-self:flex-end;background:linear-gradient(180deg,#2A9BFF,#007AFF);color:#fff}
    .app-messages .mg-b.them{align-self:flex-start;background:#E9E9EB;color:#000}
    #screen[data-theme="dark"] .app-messages .mg-b.them{background:#26252A;color:#fff}
    .app-messages .mg-b.tail::after{content:'';position:absolute;bottom:0;width:20px;height:20px;background:inherit;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M0 0c0 12 6 18 20 20C8 20 4 12 4 0z'/%3E%3C/svg%3E") no-repeat}
    .app-messages .mg-b.me.tail::after{right:-6px} .app-messages .mg-b.them.tail::after{left:-6px;transform:scaleX(-1)}
    .app-messages .mg-b.big{background:none!important;font-size:46px;line-height:52px;padding:2px 6px}
    .app-messages .mg-time{align-self:center;font-size:12px;color:var(--label2);margin:14px 0 6px;font-weight:500}
    .app-messages .mg-status{align-self:flex-end;font-size:11px;color:var(--label2);margin:1px 6px 4px}
    .app-messages .mg-bar{position:absolute;left:0;right:0;bottom:var(--kb-h,0px);padding:8px 10px calc(8px + (1 - min(var(--kb-h,0px),1px)) * 26px);display:flex;gap:8px;align-items:flex-end;background:var(--bar);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:0 -.5px 0 var(--sep);transition:bottom .3s var(--ease)}
    .app-messages .mg-field{flex:1;min-width:0;display:flex;align-items:flex-end;border:1px solid var(--sep);border-radius:19px;padding:6px 6px 6px 14px;background:var(--bg)}
    .app-messages .mg-field textarea{flex:1;min-width:0;border:0;background:none;resize:none;font-size:17px;line-height:22px;max-height:110px;outline:none;padding:0}
    .app-messages .mg-send{width:30px;height:30px;border-radius:50%;background:var(--tint);color:#fff;display:flex;align-items:center;justify-content:center;flex:none;transform:scale(.4);opacity:0;transition:transform .2s var(--ease),opacity .2s}
    .app-messages .mg-send.on{transform:none;opacity:1} .app-messages .mg-send svg{width:20px;height:20px;fill:#fff}
    .app-messages .mg-pick{padding:0 0 30px}
    .app-messages .mg-you{display:flex;align-items:center;gap:12px;padding:14px 16px;margin:0 16px 16px;border-radius:16px;background:var(--cell)}
    .app-messages .mg-you b{display:block;font-size:17px}.app-messages .mg-you small{color:var(--label2);font-size:14px}
  `);
  const SEND = '<svg viewBox="0 0 24 24"><path d="M12 3.5 5 10.5l1.8 1.8L11 8.1V20h2V8.1l4.2 4.2 1.8-1.8z"/></svg>';
  const NEW = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19.5 8.5 15.5 4.5 4 16zM21 7l-4-4 1.4-1.4a1.5 1.5 0 0 1 2.1 0l1.9 1.9a1.5 1.5 0 0 1 0 2.1z"/></svg>';
  const FT = '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M17 12.5l4.5-3.2v5.4z"/></svg>';

  const when = (t) => {
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return OS.util.timeFull(d);
    if (now - d < 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };
  const isBig = (t) => { const s = t.trim(); return s.length <= 6 && /^[\p{Extended_Pictographic}‍️]+$/u.test(s); };

  // ───────── conversation ─────────
  function openConv(personId) {
    const p = A().person(personId); if (!p) return;
    if (S.conv) S.conv.close(true);
    const node = el(`<div class="mg-conv">
      <div class="mg-top"><div class="nv-back"><span>Messages</span></div><div class="who">${A().avatar(p, 34)}<b>${esc(p.name)}</b></div><div style="flex:1"></div><div class="nv-btn ft">${FT}</div></div>
      <div class="mg-scroll ios-scroll"></div>
      <div class="mg-bar"><div class="mg-field"><textarea rows="1" placeholder="iMessage" enterkeyhint="send"></textarea></div><button class="mg-send">${SEND}</button></div></div>`);
    S.root.appendChild(node); node.getBoundingClientRect(); requestAnimationFrame(() => node.classList.add('in'));
    const scroll = node.querySelector('.mg-scroll'), ta = node.querySelector('textarea'), send = node.querySelector('.mg-send');
    const conv = S.conv = { id: personId, node, close(instant) { S.conv = null; ta.blur(); if (instant) return node.remove(); node.classList.remove('in'); setTimeout(() => node.remove(), 440); }, draw };

    function draw(keepScroll) {
      const at = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
      const list = A().msgsWith(personId); scroll.innerHTML = '';
      let lastT = 0;
      list.forEach((m, i) => {
        if (m.t - lastT > 45 * 60000) { scroll.appendChild(el(`<div class="mg-time">${esc(new Date(m.t).toDateString() === new Date().toDateString() ? 'Today ' + OS.util.timeFull(m.t) : new Date(m.t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + OS.util.timeFull(m.t))}</div>`)); lastT = m.t; }
        const mine = m.from === A().me.id, next = list[i + 1];
        const tail = !next || (next.from === m.from) === false || next.t - m.t > 45 * 60000;
        const b = el(`<div class="mg-b ${mine ? 'me' : 'them'} ${tail ? 'tail' : ''} ${isBig(m.text) ? 'big' : ''}">${esc(m.text)}</div>`);
        b.style.marginTop = i && list[i - 1].from === m.from ? '2px' : '8px';
        OS.util.longPress(b, () => OS.ui.contextMenu(b, [
          { label: 'Copy', onTap: () => { try { navigator.clipboard.writeText(m.text); } catch {} OS.ui.toast('Copied'); } },
          { label: 'Say it again', onTap: () => { ta.value = m.text; ta.dispatchEvent(new Event('input')); ta.focus(); } },
        ]));
        scroll.appendChild(b);
        if (mine && i === list.length - 1) scroll.appendChild(el('<div class="mg-status">Delivered</div>'));
      });
      if (!list.length) scroll.appendChild(el(`<div class="mg-empty" style="margin:auto">${A().avatar(p, 70)}<b style="margin-top:14px">${esc(p.name)}</b>@${esc(p.handle)}<br><br>Say hi — this really sends.</div>`));
      if (keepScroll && at > 60) scroll.scrollTop = scroll.scrollHeight - scroll.clientHeight - at; else scroll.scrollTop = scroll.scrollHeight;
    }
    draw(); A().markRead(personId);
    node.querySelector('.nv-back').addEventListener('click', () => conv.close());
    node.querySelector('.ft').addEventListener('click', () => OS.openApp('facetime', { to: personId }));
    OS.util.drag(node, { axis: 'x', filter: (e) => OS.util.screenPoint(e).x < 28,
      onStart() { node.classList.add('drag'); }, onMove(p2) { node.style.transform = `translateX(${Math.max(0, p2.dx)}px)`; },
      onEnd(p2) { node.classList.remove('drag'); node.style.transform = ''; if (p2.dx > 120 || p2.vx > .5) conv.close(); } });

    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; send.classList.toggle('on', !!ta.value.trim()); };
    ta.addEventListener('input', grow);
    const doSend = async () => {
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; grow();
      try { await A().send(personId, text); OS.sound.play('sent'); OS.haptic('light'); draw(); }
      catch (e) { OS.ui.alert({ title: 'Not Delivered', message: e.message }); ta.value = text; grow(); }
    };
    send.addEventListener('click', doSend);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
    setTimeout(() => ta.focus(), 450);
  }

  // ───────── list + new message ─────────
  function listPage() {
    return { title: 'Messages', largeTitle: true, background: 'var(--bg)',
      right: [{ icon: NEW, onTap: newMessage }],
      render(body) { S.body = body; drawList(); } };
  }
  function drawList() {
    const body = S.body; if (!body) return;
    body.querySelectorAll('.mg-list, .mg-empty, .mg-you').forEach((n) => n.remove());
    const me = A().me; if (!me) return;
    body.appendChild(el(`<div class="mg-you">${A().avatar(me, 44)}<div style="flex:1"><b>${esc(me.name)}</b><small>@${esc(me.handle)} · your account</small></div></div>`));
    const th = A().threads();
    if (!th.length) {
      const e = el(`<div class="mg-empty"><b>No Messages</b>Tap ✎ to text someone with an account on this iPhone.${A().people().length ? '' : '<br><br>Nobody else has signed up yet.'}</div>`);
      return body.appendChild(e);
    }
    const list = el('<div class="mg-list"></div>');
    th.forEach((t) => {
      const p = A().person(t.id); if (!p) return;
      const last = t.msgs[t.msgs.length - 1];
      const r = el(`<div class="mg-row ${t.unread ? 'unread' : ''}"><div class="dot"></div>${A().avatar(p, 52)}<div class="mg-tx"><b>${esc(p.name)}</b><span>${last.from === A().me.id ? 'You: ' : ''}${esc(last.text)}</span></div><div class="mg-when">${esc(when(last.t))}</div></div>`);
      r.addEventListener('click', () => openConv(t.id));
      list.appendChild(r);
    });
    body.appendChild(list);
  }
  function newMessage() {
    OS.ui.sheet({ title: 'New Message', left: { label: 'Cancel' }, render(body, sh) {
      const draw = () => {
        body.innerHTML = '';
        const people = A().people();
        if (!people.length) { body.appendChild(el('<div class="mg-empty"><b>Nobody here yet</b>Other people need to open this iPhone and create an account. Then they show up here.</div>')); return; }
        body.appendChild(el('<div class="ios-list-header">Everyone on this iPhone</div>'));
        const l = el('<div class="ios-list"></div>');
        people.forEach((p) => { const r = el(`<div class="ios-row tappable">${A().avatar(p, 40)}<span class="ios-row-label">${esc(p.name)}<span class="ios-row-sub">@${esc(p.handle)}</span></span><span class="ios-chevron"></span></div>`); r.addEventListener('click', () => { sh.close(); openConv(p.id); }); l.appendChild(r); });
        body.appendChild(l); body.appendChild(el('<div style="height:40px"></div>'));
      };
      draw(); A().refresh().then(draw);
    } });
  }

  OS.registerApp({
    id: 'messages', name: 'Messages', system: true, statusBar: 'auto', category: 'Social',
    icon: { bg: 'linear-gradient(180deg,#5BF675,#0CBD2A)', glyph: '<svg viewBox="0 0 60 60"><path d="M30 12c-10.5 0-19 6.6-19 14.8 0 4.7 2.8 8.9 7.2 11.6-.5 2.4-1.9 4.9-4.2 7.1 3.9-.4 7.6-2 10.5-4.3 1.8.4 3.6.6 5.5.6 10.5 0 19-6.6 19-14.8S40.5 12 30 12z" fill="#fff"/></svg>' },
    launch(ctx) {
      S = { ctx, root: ctx.root, conv: null };
      S.nav = OS.ui.createNav(ctx.root); S.nav.push(listPage());
      S.onMsg = OS.on('account:messages', () => { drawList(); if (S.conv) { S.conv.draw(true); A().markRead(S.conv.id); } });
      S.onPpl = OS.on('account:people', drawList);
    },
    onResume(ctx, params) {
      A().refresh();
      drawList();
      if (params && params.to) setTimeout(() => openConv(params.to), 120);
    },
    onClose() { OS.off('account:messages', S.onMsg); OS.off('account:people', S.onPpl); S = null; },
  });
  OS.messages = { viewing: () => (S && S.conv ? S.conv.id : null), open: (id) => OS.openApp('messages', { to: id }) };
})();
