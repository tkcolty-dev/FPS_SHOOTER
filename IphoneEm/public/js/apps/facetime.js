// FaceTime — real video and audio calls to the other accounts on this iPhone (WebRTC, see core/calls.js).
(function () {
  const { el, esc } = OS.util;
  const A = () => OS.account;
  let S = null;

  OS.addStyle('facetime', `
    .app-facetime .ft-new{display:flex;align-items:center;justify-content:center;gap:8px;height:50px;margin:8px 16px 22px;border-radius:14px;background:var(--green)!important;color:#fff!important;font-size:17px;font-weight:600;cursor:pointer;transition:transform .15s}
    .app-facetime .ft-new:active{transform:scale(.97);opacity:.9}
    .app-facetime .ft-new svg{width:20px;height:20px;fill:#fff}
    .app-facetime .ft-row{display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;position:relative;min-height:62px}
    .app-facetime .ft-row+.ft-row::before{content:'';position:absolute;left:70px;right:0;top:0;height:.5px;background:var(--sep)}
    .app-facetime .ft-row .tx{flex:1;min-width:0}
    .app-facetime .ft-row b{display:block;font-size:17px;font-weight:400;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .app-facetime .ft-row b.missed{color:var(--red)}
    .app-facetime .ft-row small{display:block;font-size:13px;color:var(--label2);display:flex;align-items:center;gap:4px}
    .app-facetime .ft-row .when{font-size:15px;color:var(--label2);flex:none}
    .app-facetime .ft-row .i{width:26px;height:26px;border-radius:50%;background:var(--fill2);display:flex;align-items:center;justify-content:center;color:var(--tint);font-size:14px;font-weight:600;flex:none}
    .app-facetime .ft-empty{text-align:center;padding:70px 40px;color:var(--label2)}
    .app-facetime .ft-empty b{display:block;font-size:20px;color:var(--label);font-weight:700;margin-bottom:6px}
    .app-facetime .ft-hint{margin:0 16px;font-size:13px;color:var(--label2);line-height:18px}
  `);
  const CAM = '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M17 12.5l4.5-3.2v5.4z"/></svg>';
  const PHONE = '<svg viewBox="0 0 24 24"><path d="M6.6 3.5c.7-.3 1.5 0 1.9.7l1.6 2.9c.3.6.2 1.4-.3 1.9L8.5 10.3c1 2 2.6 3.6 4.6 4.6l1.3-1.3c.5-.5 1.3-.6 1.9-.3l2.9 1.6c.7.4 1 1.2.7 1.9l-.9 2.1c-.3.7-1 1.1-1.8 1C9.6 19.1 4.9 14.4 4 6.8c-.1-.8.3-1.5 1-1.8z"/></svg>';

  const when = (t) => {
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return OS.util.timeFull(d);
    if (now - d < 6 * 864e5) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };
  const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? s + ' sec' : Math.floor(s / 60) + ' min ' + (s % 60) + ' sec'; };

  function page() {
    return { title: 'FaceTime', largeTitle: true, background: 'var(--bg)', render(body) { S.body = body; draw(); } };
  }
  function draw() {
    const body = S && S.body; if (!body) return;
    body.querySelectorAll('.dyn').forEach((n) => n.remove());
    const wrap = el('<div class="dyn"></div>');
    const nb = el(`<div class="ft-new">${CAM} New FaceTime</div>`);
    nb.addEventListener('click', picker); wrap.appendChild(nb);

    const log = OS.calls.log();
    if (!log.length) {
      const people = A().signedIn ? A().people() : [];
      wrap.appendChild(el(`<div class="ft-empty"><b>No Recent Calls</b>${people.length ? 'Tap New FaceTime to call someone with an account on this iPhone.' : 'Nobody else has an account here yet. When a friend signs up, you can call them for real.'}</div>`));
    } else {
      wrap.appendChild(el('<div class="ios-list-header">Recent</div>'));
      log.forEach((c) => {
        const r = el(`<div class="ft-row">${A().avatar(c.person, 46)}<div class="tx"><b class="${c.dir === 'missed' ? 'missed' : ''}">${esc(c.person.name)}</b><small>${c.mode === 'video' ? CAM : PHONE} ${c.dir === 'out' ? 'Outgoing' : c.dir === 'missed' ? 'Missed' : 'Incoming'}${c.ms ? ' · ' + dur(c.ms) : ''}</small></div><div class="when">${esc(when(c.t))}</div><div class="i">i</div></div>`);
        r.querySelector('small svg').style.cssText = 'width:13px;height:13px;fill:currentColor';
        r.addEventListener('click', (e) => {
          if (e.target.closest('.i')) return OS.ui.actionSheet({ title: c.person.name, message: '@' + c.person.handle + ' · ' + when(c.t), buttons: [{ label: 'FaceTime Video' }, { label: 'FaceTime Audio' }, { label: 'Send Message' }] })
            .then((i) => { if (i === 0) OS.calls.start(c.person.id, 'video'); else if (i === 1) OS.calls.start(c.person.id, 'audio'); else if (i === 2) OS.openApp('messages', { to: c.person.id }); });
          OS.calls.start(c.person.id, c.mode);
        });
        wrap.appendChild(r);
      });
      const clear = el('<div class="ios-btn-plain" style="text-align:center;padding:18px;color:var(--red)!important">Clear Recents</div>');
      clear.addEventListener('click', () => { OS.calls.clearLog(); draw(); }); wrap.appendChild(clear);
    }
    wrap.appendChild(el('<div class="ft-hint">FaceTime here is a real video call between two people using this iPhone — your camera and microphone, sent straight to them.</div><div style="height:40px"></div>'));
    body.appendChild(wrap);
  }
  function picker(mode) {
    OS.ui.sheet({ title: 'New FaceTime', left: { label: 'Cancel' }, render(body, sh) {
      const drawList = () => {
        body.innerHTML = '';
        const people = A().signedIn ? A().people() : [];
        if (!people.length) return body.appendChild(el('<div class="ft-empty"><b>Nobody here yet</b>Ask a friend to open this iPhone and create an account — then you can FaceTime them.</div>'));
        body.appendChild(el('<div class="ios-list-header">Everyone on this iPhone</div>'));
        const l = el('<div class="ios-list"></div>');
        people.forEach((p) => {
          const r = el(`<div class="ios-row">${A().avatar(p, 40)}<span class="ios-row-label">${esc(p.name)}<span class="ios-row-sub">@${esc(p.handle)}</span></span><span class="v" style="color:var(--green);width:26px;height:26px;cursor:pointer">${CAM}</span><span class="a" style="color:var(--green);width:22px;height:22px;cursor:pointer">${PHONE}</span></div>`);
          r.querySelectorAll('svg').forEach((s) => { s.style.width = '100%'; s.style.height = '100%'; s.style.fill = 'currentColor'; });
          r.querySelector('.v').addEventListener('click', () => { sh.close(); OS.calls.start(p.id, 'video'); });
          r.querySelector('.a').addEventListener('click', () => { sh.close(); OS.calls.start(p.id, 'audio'); });
          l.appendChild(r);
        });
        body.appendChild(l); body.appendChild(el('<div style="height:40px"></div>'));
      };
      drawList(); A().refresh().then(drawList);
    } });
  }

  OS.registerApp({
    id: 'facetime', name: 'FaceTime', system: true, statusBar: 'auto', category: 'Social',
    icon: { bg: 'linear-gradient(180deg,#5BF675,#0CBD2A)', glyph: '<svg viewBox="0 0 60 60"><rect x="10" y="19" width="27" height="22" rx="6" fill="#fff"/><path d="M40 30l11-7.5v15z" fill="#fff"/></svg>' },
    launch(ctx) {
      S = { ctx };
      S.nav = OS.ui.createNav(ctx.root); S.nav.push(page());
      S.onLog = OS.on('calls:log', draw); S.onPpl = OS.on('account:people', draw);
    },
    onResume(ctx, params) {
      A().refresh(); draw();
      if (params && params.to) { const id = typeof params.to === 'string' ? params.to : params.to.id; if (A().person(id)) setTimeout(() => OS.calls.start(id, params.mode || 'video'), 150); }
    },
    onClose() { OS.off('calls:log', S.onLog); OS.off('account:people', S.onPpl); S = null; },
  });
})();
