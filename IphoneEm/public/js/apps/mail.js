// Mail — mailboxes → message list → message view, compose / reply / drafts, swipe actions, new-mail delivery.
(function () {
  'use strict';
  const U = OS.util, el = U.el, esc = U.esc;
  const KEY = 'mail.messages', VIPKEY = 'mail.vips';
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const SIG = '\n\nSent from my iPhone';

  /* ------------------------------------------------------------------ icons */
  const sv = (body, vb) => `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${body}</svg>`;
  const st = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"';
  const I = {
    tray: sv(`<path d="M3.5 13.5l2.6-7.3C6.4 5.5 7 5 7.8 5h8.4c.8 0 1.4.5 1.7 1.2l2.6 7.3v4A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z" ${st}/><path d="M3.5 13.5H8.5c.3 1.7 1.7 3 3.5 3s3.2-1.3 3.5-3h5" ${st}/>`),
    star: sv(`<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8L8 13.6l-4.3-4 5.8-.7z" ${st}/>`),
    starFill: sv(`<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8l-5.3 2.9 1.1-6-4.4-4.2 6-.8z" fill="currentColor"/>`),
    flag: sv(`<path d="M5.5 21V4M5.5 4.8c4.6-2.3 8.4 2.3 13 0v8.8c-4.6 2.3-8.4-2.3-13 0" ${st}/>`),
    flagFill: sv(`<path d="M5.5 21V4" ${st}/><path d="M5.5 4.8c4.6-2.3 8.4 2.3 13 0v8.8c-4.6 2.3-8.4-2.3-13 0z" fill="currentColor"/>`),
    doc: sv(`<path d="M6.5 3h7l5 5v10.5A2.5 2.5 0 0 1 16 21H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z" ${st} transform="translate(.5 0)"/><path d="M14 3.2V8h4.8" ${st}/>`),
    plane: sv(`<path d="M20.5 3.5L3.5 10.3c-.6.2-.6 1 0 1.3l6 2.4 2.4 6c.2.6 1.1.6 1.3 0z" ${st}/><path d="M9.7 13.9l4.8-4.8" ${st}/>`),
    trash: sv(`<path d="M4 6.8h16M9.3 6.8V4.9c0-.5.4-.9.9-.9h3.6c.5 0 .9.4.9.9v1.9M6 6.8l.8 12.3c.1 1.1.9 1.9 2 1.9h6.4c1.1 0 1.9-.8 2-1.9L18 6.8M10 10.8v6.4M14 10.8v6.4" ${st}/>`),
    archive: sv(`<rect x="3" y="4" width="18" height="5" rx="1.5" ${st}/><path d="M4.5 9v8.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V9M9.5 13h5" ${st}/>`),
    folder: sv(`<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.5 0 1 .2 1.4.6L12 7h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" ${st}/>`),
    reply: sv(`<path d="M10 8.2V4.5L3 11l7 6.5v-3.8c5.2 0 8.6 1.5 11 5.3-.6-6.4-4.3-10.5-11-10.8z" ${st}/>`),
    compose: sv(`<path d="M19.2 13.2v5.3a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 18.5V7.3a2.5 2.5 0 0 1 2.5-2.5h5.3" ${st}/><path d="M9.6 14.4l.7-3.2 8.5-8.5a1.6 1.6 0 0 1 2.2 0l.3.3a1.6 1.6 0 0 1 0 2.2l-8.5 8.5z" ${st}/>`),
    filter: sv(`<circle cx="12" cy="12" r="9" ${st}/><path d="M7.5 9.5h9M9.3 12.5h5.4M11 15.5h2" ${st}/>`),
    filterOn: sv(`<circle cx="12" cy="12" r="9.8" fill="currentColor"/><path d="M7.5 9.5h9M9.3 12.5h5.4M11 15.5h2" style="fill:none;stroke:var(--bg);stroke-width:1.7;stroke-linecap:round"/>`),
    up: sv(`<path d="M5 15l7-7 7 7" ${st} stroke-width="2.2"/>`),
    down: sv(`<path d="M5 9l7 7 7-7" ${st} stroke-width="2.2"/>`),
    arrowUp: sv(`<path d="M12 19V6.2M6.4 11.6L12 6l5.6 5.6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>`),
    envOpen: sv(`<path d="M3.5 10.2l7.3-5.3c.7-.5 1.7-.5 2.4 0l7.3 5.3v7.3A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z" ${st}/><path d="M4 10.8l8 5 8-5" ${st}/>`),
    env: sv(`<rect x="3" y="5" width="18" height="14" rx="2.5" ${st}/><path d="M3.8 7.5l8.2 6 8.2-6" ${st}/>`),
    check: sv(`<path d="M2 7.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`, '0 0 16 14'),
    plus: sv(`<path d="M12 5.5v13M5.5 12h13" ${st} stroke-width="2"/>`),
  };

  /* ------------------------------------------------------------------ styles */
  OS.addStyle('mail', `
    .app-mail .ml-boxrow .ic { flex: none; width: 28px; height: 28px; color: var(--tint); display: flex; align-items: center; justify-content: center; }
    .app-mail .ml-boxrow .ic svg { width: 25px; height: 25px; }
    .app-mail .ml-boxrow { min-height: 46px; }
    .app-mail .ios-row:has(> .ic) + .ios-row::before { left: 56px; }
    .app-mail .ml-spacer { height: 64px; }

    .app-mail .ml-tb { position: absolute; left: 0; right: 0; bottom: 0; z-index: 25; height: calc(49px + var(--safe-bottom)); padding: 0 16px var(--safe-bottom); display: flex; align-items: center; justify-content: space-between;
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 -.5px 0 var(--sep); }
    .app-mail .ml-tb button { min-width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--tint); font-size: 17px; transition: opacity .15s; }
    .app-mail .ml-tb button:active { opacity: .4; } .app-mail .ml-tb button:disabled { opacity: .3; pointer-events: none; }
    .app-mail .ml-tb button svg { width: 26px; height: 26px; }
    .app-mail .ml-tb .c { flex: 1; min-width: 0; text-align: center; font-size: 11px; letter-spacing: .06px; line-height: 14px; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-mail .ml-tb .c small { display: block; font-size: 11px; color: var(--label2); } .app-mail .ml-tb .c b { color: var(--tint); font-weight: 400; }

    .app-mail .ml-rw { position: relative; overflow: hidden; background: var(--bg); transition: height .32s ${EASE}, opacity .25s; }
    .app-mail .ml-acts { position: absolute; top: 0; bottom: 0; width: 0; display: flex; overflow: hidden; } .app-mail .ml-acts.r { right: 0; } .app-mail .ml-acts.l { left: 0; }
    .app-mail .ml-acts button { flex: 1; min-width: 0; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 13px; letter-spacing: -.08px; white-space: nowrap; overflow: hidden; }
    .app-mail .ml-acts svg { width: 24px; height: 24px; flex: none; }
    .app-mail .ml-acts .arch { background: var(--purple); } .app-mail .ml-acts .flag { background: var(--orange); } .app-mail .ml-acts .trash { background: var(--red); } .app-mail .ml-acts .read { background: var(--tint); }
    .app-mail .ml-r { position: relative; display: flex; padding-left: 30px; background: var(--bg); cursor: pointer; transition: padding .3s ${EASE}; }
    .app-mail .ml-r.pressed { background: var(--gray5, var(--cell2)); }
    .app-mail .ml-ind { position: absolute; left: 0; top: 13px; width: 30px; display: flex; flex-direction: column; align-items: center; gap: 7px; color: var(--tint); transition: left .3s ${EASE}; }
    .app-mail .ml-ind .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--tint); }
    .app-mail .ml-ind svg { width: 14px; height: 14px; } .app-mail .ml-ind .fl { color: var(--orange); display: flex; } .app-mail .ml-ind .rp { color: var(--label3); display: flex; }
    .app-mail .ml-sel { position: absolute; left: 12px; top: 50%; width: 22px; height: 22px; margin-top: -11px; border-radius: 50%; border: 1.5px solid var(--label3); opacity: 0; transform: scale(.6); transition: opacity .25s, transform .3s ${EASE}; display: flex; align-items: center; justify-content: center; color: #fff; }
    .app-mail .ml-sel svg { width: 12px; height: 11px; opacity: 0; }
    .app-mail .ml-list.editing .ml-r { padding-left: 66px; } .app-mail .ml-list.editing .ml-sel { opacity: 1; transform: none; } .app-mail .ml-list.editing .ml-ind { left: 36px; }
    .app-mail .ml-r.picked .ml-sel { background: var(--tint); border-color: var(--tint); } .app-mail .ml-r.picked .ml-sel svg { opacity: 1; }
    .app-mail .ml-r-main { flex: 1; min-width: 0; padding: 9px 16px 10px 0; box-shadow: 0 .5px 0 var(--sep); }
    .app-mail .ml-r-top { display: flex; align-items: center; gap: 6px; }
    .app-mail .ml-r-top b { flex: 1; min-width: 0; font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-mail .ml-r-top b .vip { display: inline-flex; width: 14px; height: 14px; margin-right: 4px; color: var(--tint); vertical-align: -1px; } .app-mail .ml-r-top b .vip svg { width: 14px; height: 14px; }
    .app-mail .ml-r-top .t { flex: none; font-size: 15px; color: var(--label2); letter-spacing: -.2px; }
    .app-mail .ml-r-sub { font-size: 15px; line-height: 20px; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 14px; }
    .app-mail .ml-r-prev { font-size: 15px; line-height: 20px; letter-spacing: -.2px; color: var(--label2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 14px; word-break: break-word; }
    .app-mail .ml-empty { padding: 150px 40px 0; text-align: center; color: var(--label2); font-size: 22px; font-weight: 600; } .app-mail .ml-empty small { display: block; margin-top: 6px; font-size: 15px; font-weight: 400; }

    .app-mail .ml-msg { padding-top: 6px; }
    .app-mail .ml-hd { display: flex; gap: 11px; padding: 6px 16px 12px; align-items: center; }
    .app-mail .ml-hd-main { flex: 1; min-width: 0; }
    .app-mail .ml-from { display: flex; align-items: baseline; gap: 8px; } .app-mail .ml-from b { flex: 0 1 auto; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    .app-mail .ml-from .vip { flex: none; display: inline-flex; width: 14px; height: 14px; color: var(--tint); align-self: center; } .app-mail .ml-from .vip svg { width: 14px; height: 14px; }
    .app-mail .ml-from .t { flex: none; margin-left: auto; font-size: 13px; color: var(--label2); letter-spacing: -.08px; }
    .app-mail .ml-to { font-size: 14px; color: var(--label2); letter-spacing: -.15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .app-mail .ml-to span { color: var(--tint); cursor: pointer; }
    .app-mail .ml-more { display: none; font-size: 13px; color: var(--label2); padding: 0 16px 10px 67px; line-height: 18px; letter-spacing: -.08px; } .app-mail .ml-msg.details .ml-more { display: block; }
    .app-mail .ml-subj { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 12px 16px 12px; font-size: 22px; line-height: 27px; font-weight: 700; letter-spacing: .3px; box-shadow: 0 -.5px 0 var(--sep); }
    .app-mail .ml-subj span { flex: 1; min-width: 0; word-break: break-word; } .app-mail .ml-subj i { flex: none; width: 18px; height: 18px; margin-top: 5px; color: var(--orange); display: none; } .app-mail .ml-subj i svg { width: 18px; height: 18px; }
    .app-mail .ml-msg.flagged .ml-subj i { display: block; }
    .app-mail .ml-body { padding: 2px 16px 30px; font-size: 17px; line-height: 1.4; letter-spacing: -.4px; word-break: break-word; user-select: text; -webkit-user-select: text; }
    .app-mail .ml-body p { margin: 0 0 14px; } .app-mail .ml-body h2 { font-size: 20px; line-height: 1.25; margin: 20px 0 8px; letter-spacing: .2px; } .app-mail .ml-body h3 { font-size: 17px; margin: 16px 0 6px; }
    .app-mail .ml-body ul, .app-mail .ml-body ol { margin: 0 0 14px; padding-left: 24px; } .app-mail .ml-body li { margin-bottom: 6px; }
    .app-mail .ml-banner { border-radius: 16px; padding: 24px 18px 20px; margin: 4px 0 18px; color: #fff; font-size: 23px; font-weight: 700; line-height: 1.18; letter-spacing: .2px; }
    .app-mail .ml-banner small { display: block; margin-top: 7px; font-size: 13px; font-weight: 500; opacity: .88; letter-spacing: -.08px; }
    .app-mail .ml-banner em { display: block; font-style: normal; font-size: 34px; margin-bottom: 8px; }
    .app-mail .ml-cta { display: inline-block; margin: 2px 8px 16px 0; padding: 11px 20px; border-radius: 12px; background: var(--tint); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; user-select: none; -webkit-user-select: none; } .app-mail .ml-cta:active { opacity: .6; }
    .app-mail .ml-cta.gray { background: var(--fill2); color: var(--tint); }
    .app-mail .ml-link { color: var(--tint); cursor: pointer; }
    .app-mail .ml-card { display: flex; gap: 12px; align-items: center; border-radius: 12px; background: var(--cell2); padding: 11px 13px; margin: 0 0 10px; font-size: 15px; line-height: 1.3; }
    #screen[data-theme="dark"] .app-mail .ml-card { background: var(--cell); }
    .app-mail .ml-card .e { flex: none; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; }
    .app-mail .ml-card b { display: block; font-size: 16px; } .app-mail .ml-card span { color: var(--label2); }
    .app-mail .ml-body table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 15px; }
    .app-mail .ml-body td { padding: 10px 0; border-bottom: .5px solid var(--sep); vertical-align: top; } .app-mail .ml-body td:last-child { text-align: right; white-space: nowrap; padding-left: 12px; }
    .app-mail .ml-body td small { display: block; color: var(--label2); font-size: 13px; } .app-mail .ml-body tr.total td { border: 0; font-weight: 700; font-size: 17px; }
    .app-mail .ml-fine { font-size: 12px; line-height: 1.4; color: var(--label2); letter-spacing: 0; }
    .app-mail .ml-body blockquote { margin: 0 0 14px; padding: 0 0 0 12px; border-left: 2px solid var(--tint); color: var(--label2); }

    /* compose sheet lives outside the app root */
    .ml-sendbtn { display: flex; width: 30px; height: 30px; border-radius: 50%; background: var(--tint); color: #fff; align-items: center; justify-content: center; transition: background .2s; }
    .ml-sendbtn svg { width: 19px; height: 19px; } .ml-sendbtn.off { background: var(--gray3, var(--fill)); }
    .ios-sheet:has(.ml-sheet) { background: var(--bg); }
    #screen[data-theme="dark"] .ios-sheet:has(.ml-sheet) { background: #1C1C1E; }
    .ml-sheet { min-height: 100%; display: flex; flex-direction: column; color: var(--label); }
    .ml-sheet h1 { margin: 0; padding: 2px 16px 10px; font-size: 32px; font-weight: 700; letter-spacing: .35px; line-height: 38px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ml-sheet .ml-f { display: flex; align-items: center; gap: 6px; min-height: 44px; margin-left: 16px; padding-right: 16px; box-shadow: 0 .5px 0 var(--sep); font-size: 17px; }
    .ml-sheet .ml-f > span { flex: none; color: var(--label2); } .ml-sheet .ml-f input { flex: 1; min-width: 0; height: 43px; border: 0; background: none; padding: 0; }
    .ml-sheet .ml-f .fromv { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ml-sheet .ml-f .add { flex: none; width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--tint); color: var(--tint); display: none; align-items: center; justify-content: center; } .ml-sheet .ml-f .add svg { width: 15px; height: 15px; }
    .ml-sheet .ml-f:focus-within .add { display: flex; }
    .ml-sheet .ml-sugg { margin-left: 16px; } .ml-sheet .ml-sg { display: flex; align-items: center; gap: 10px; padding: 7px 16px 7px 0; box-shadow: 0 .5px 0 var(--sep); cursor: pointer; } .ml-sheet .ml-sg:active { opacity: .5; }
    .ml-sheet .ml-sg b { display: block; font-weight: 600; font-size: 16px; } .ml-sheet .ml-sg small { font-size: 14px; color: var(--label2); }
    .ml-sheet textarea { flex: 1; display: block; width: 100%; min-height: 260px; border: 0; background: none; resize: none; padding: 12px 16px 40px; font-size: 17px; line-height: 23px; letter-spacing: -.4px; color: var(--label); overflow: hidden; }
    .ml-sheet.hidecc .ml-cc2 { display: none; } .ml-sheet:not(.hidecc) .ml-cc1 { display: none; }
  `);

  /* ------------------------------------------------------------------ data */
  let mails = null;
  let M = null;   // per-process UI state
  const owner = () => (OS.settings && OS.settings.get('ownerName')) || 'Colton';
  const me = () => ({ name: owner(), email: (owner().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'me') + '@mail.example' });
  const BOXES = [
    { id: 'inbox', name: 'Inbox', icon: I.tray }, { id: 'vip', name: 'VIP', icon: I.star }, { id: 'flagged', name: 'Flagged', icon: I.flag },
    { id: 'drafts', name: 'Drafts', icon: I.doc }, { id: 'sent', name: 'Sent', icon: I.plane }, { id: 'trash', name: 'Trash', icon: I.trash }, { id: 'archive', name: 'Archive', icon: I.archive },
  ];
  const boxName = (id) => (BOXES.find((b) => b.id === id) || {}).name || 'Mailbox';

  function load() {
    if (mails) return mails;
    const saved = OS.store.get(KEY, null);
    if (Array.isArray(saved)) mails = saved; else { mails = []; OS.store.set(VIPKEY, ['mom@family.example', 'rose@family.example']); save(); }
    return mails;
  }
  const save = () => { if (mails) OS.store.set(KEY, mails.slice(0, 300)); };
  const vips = () => OS.store.get(VIPKEY, []) || [];
  const isVip = (email) => vips().includes(String(email || '').toLowerCase());
  function toggleVip(email) { email = String(email).toLowerCase(); const v = vips(); OS.store.set(VIPKEY, v.includes(email) ? v.filter((x) => x !== email) : v.concat(email)); }
  function inBox(id) {
    const all = load(); let list;
    if (id === 'vip') list = all.filter((m) => m.box === 'inbox' && isVip(m.from.email));
    else if (id === 'flagged') list = all.filter((m) => m.flagged && m.box !== 'trash');
    else list = all.filter((m) => m.box === id);
    return list.sort((a, b) => b.date - a.date);
  }
  const unreadCount = () => load().filter((m) => m.box === 'inbox' && m.unread).length;
  function updateBadge() { try { OS.badge && OS.badge('mail', unreadCount()); } catch (e) { /* core not ready */ } }
  const getMail = (id) => load().find((m) => m.id === id);

  function htmlToText(html) {
    const s = String(html || '').replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/b>\s*<span>/gi, ' — ').replace(/<small[^>]*>/gi, '\n').replace(/<\/(p|div|h\d|li|tr|blockquote|table|ul|ol|em|small)>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<\/td>\s*<td[^>]*>/gi, '  ').replace(/<[^>]+>/g, '');
    const t = document.createElement('textarea'); t.innerHTML = s;
    return t.value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function textToHtml(text) {
    const out = []; let quote = [];
    const flush = () => { if (quote.length) { out.push('<blockquote>' + quote.join('<br>') + '</blockquote>'); quote = []; } };
    String(text || '').split('\n').forEach((line) => { const q = /^>\s?(.*)$/.exec(line); if (q) quote.push(esc(q[1])); else { flush(); out.push(esc(line) + '<br>'); } });
    flush(); return '<div>' + out.join('') + '</div>';
  }
  const previewOf = (m) => (m.preview || htmlToText(m.html)).replace(/\s+/g, ' ').trim().slice(0, 160);
  const fullDate = (d) => { d = new Date(d); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' at ' + U.time(d) + (U.ampm(d) ? ' ' + U.ampm(d) : ''); };
  function avatarFor(p, size) {
    const c = OS.contacts.all().find((x) => x.email && x.email.toLowerCase() === String(p.email || '').toLowerCase());
    if (c) return OS.contacts.avatar(c, size);
    const parts = String(p.name || p.email || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
    return OS.contacts.avatar({ first: parts[0] || '', last: parts[1] || '', color: p.color || '#8E8E93', emoji: p.emoji || '' }, size);
  }
  const parseRecipients = (s) => String(s || '').split(/[,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^(.*)<([^>]+)>$/.exec(x); const email = (m ? m[2] : x).trim(); const c = OS.contacts.all().find((k) => k.email && k.email.toLowerCase() === email.toLowerCase());
    return { name: m && m[1].trim() ? m[1].trim() : (c ? OS.contacts.name(c) : email), email };
  });
  const toLine = (m) => (m.to || []).map((p) => p.name || p.email).join(', ') || 'No Recipients';

  /* ------------------------------------------------------------------ seed mail */
  const P = (...ps) => ps.map((p) => `<p>${p}</p>`).join('');
  function seed() {
    const now = Date.now(), you = me(), n = owner();
    const S = {
      school: { name: 'Maple Ridge Middle School', email: 'news@mapleridgems.example', color: '#34C759' },
      forge: { name: 'Pixel Forge Studio', email: 'hello@pixelforge.example', color: '#5856D6' },
      store: { name: 'App Store', email: 'no_reply@appstore.example', color: '#007AFF' },
      hive: { name: 'BlockHive', email: 'digest@blockhive.example', color: '#FF9500', emoji: '🐝' },
      grandma: { name: 'Grandma Rose', email: 'rose@family.example' }, mom: { name: 'Mom', email: 'mom@family.example' }, dad: { name: 'Dad', email: 'dad@family.example' },
      coach: { name: 'Coach Daniels', email: 'coach.daniels@school.example' }, hoffman: { name: 'Mr. Hoffman', email: 'hoffman@school.example' },
      library: { name: 'Riverbend Public Library', email: 'circulation@riverbendlibrary.example', color: '#A2845E', emoji: '📚' },
      sprout: { name: 'CodeSprout Academy', email: 'streaks@codesprout.example', color: '#30B0C7', emoji: '🌱' },
      pizza: { name: 'Pizza Planet', email: 'orders@pizzaplanet.example', color: '#FF3B30', emoji: '🍕' },
      alex: { name: 'Alex Rivera', email: 'alex.rivera@mail.example' },
    };
    const out = [];
    const add = (from, subject, html, minsAgo, o) => out.push(Object.assign({ id: U.uid(), box: 'inbox', from, to: [you], subject, html, date: now - minsAgo * 60000, unread: false, flagged: false }, o || {}));

    add(S.forge, 'You’re invited: Pixel Forge Summer Game Jam 🎮',
      `<div class="ml-banner" style="background:linear-gradient(135deg,#5E5CE6,#BF5AF2 60%,#FF375F)"><em>🎮</em>Summer Game Jam<small>48 hours · Theme revealed Friday 5 PM · All ages welcome</small></div>` +
      P(`Hi ${esc(n)},`, 'Because you’ve been such a great Skybound Islands playtester, we’re inviting you to our very first <b>Pixel Forge Summer Game Jam</b>! Make a tiny game in one weekend — solo or with a friend — using any tool you like (block coding totally counts).') +
      '<h3>How it works</h3><ul><li>The secret theme drops <b>Friday at 5:00 PM</b>.</li><li>Build anything playable by <b>Sunday at 5:00 PM</b>.</li><li>Our team plays every entry live on Monday and gives feedback.</li></ul>' +
      P('Every finisher gets a digital badge and their name in the Skybound Islands credits. Ask a parent before signing up!') +
      `<span class="ml-cta" data-reply="Count me in for the game jam! I’ll be entering ">I’m in — RSVP</span><span class="ml-cta gray" data-reply="I have a question about the jam: ">Ask a question</span>` +
      `<p class="ml-fine">Pixel Forge Studio · 42 Lantern Way · You’re getting this because you joined our playtest list.</p>`, 26, { unread: true, flagged: true });

    add(S.mom, 'Fwd: Camping trip packing list',
      P(`Hi sweetie — forwarding the list from Aunt Carol. Can you check off <b>your</b> stuff by Thursday so we’re not packing at midnight again? 😅`) +
      '<ul><li>Sleeping bag + pillow</li><li>Flashlight (with batteries that actually work)</li><li>Rain jacket</li><li>2 pairs of shoes</li><li>Bug spray</li><li>A book or sketch pad — no signal up there!</li></ul>' +
      P('Dad is in charge of marshmallows, so we should double-check that too.', 'Love you,<br>Mom'), 74, { unread: true });

    add(S.hive, 'BlockHive Weekly: Top projects this week 🐝',
      `<div class="ml-banner" style="background:linear-gradient(135deg,#FF9F0A,#FF6B00)">This week on BlockHive<small>The community’s most-loved block-coded projects</small></div>` +
      `<div class="ml-card"><div class="e" style="background:#5856D6">🚀</div><div><b>Orbit Hopper</b><span>by starfox_lee · 4,210 ♥ · Platformer with real gravity wells</span></div></div>` +
      `<div class="ml-card"><div class="e" style="background:#34C759">🐸</div><div><b>Frog Chef Deluxe</b><span>by lilypad22 · 3,877 ♥ · Cook bugs. Serve frogs. Don’t burn the pond.</span></div></div>` +
      `<div class="ml-card"><div class="e" style="background:#FF2D55">🎹</div><div><b>Pocket Synth 3</b><span>by beep_boop · 2,950 ♥ · A full music maker in 600 blocks</span></div></div>` +
      '<h3>Tip of the week</h3>' + P('Use <b>clones</b> instead of copying sprites — your project loads faster and one script controls them all.') +
      '<h3>Your stats</h3>' + P('Your projects got <b>38 new plays</b> and <b>6 new ♥</b> this week. Nice!') +
      `<span class="ml-cta gray" data-reply="Hi BlockHive team, ">Reply to the team</span><p class="ml-fine">BlockHive is a friendly coding community. Be kind, give credit, remix with respect.</p>`, 190, { unread: true });

    add(S.store, 'Your receipt from App Store',
      P('<b>Receipt</b>', `Billed to: ${esc(you.email)}<br>Order ID: MX7K2Q9RTL<br>Date: ${esc(new Date(now - 300 * 60000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}`) +
      '<table><tr><td>Doodle Dash+<small>Game · Family Sharing</small></td><td>$0.99</td></tr><tr><td>Block Builder Pro<small>Education · In-App Purchase: Texture Pack</small></td><td>$1.99</td></tr><tr><td>Tiny Planets<small>Game</small></td><td>Free</td></tr><tr><td>Tax</td><td>$0.21</td></tr><tr class="total"><td>Total</td><td>$3.19</td></tr></table>' +
      P('Purchases were approved with <b>Ask to Buy</b> by a family organizer.') +
      `<p class="ml-fine">If you didn’t make this purchase, ask a parent to review the family’s purchase history. This is an automated message; replies are not monitored.</p>`, 300);

    add(S.coach, 'Practice schedule for next week',
      P('Team,', 'Great effort on Saturday. Here’s next week:') +
      '<table><tr><td>Monday<small>Field 2 · passing + first touch</small></td><td>4:30 PM</td></tr><tr><td>Wednesday<small>Field 2 · scrimmage</small></td><td>4:30 PM</td></tr><tr><td>Saturday<small>Away vs. Lakeside Comets</small></td><td>10:00 AM</td></tr></table>' +
      P('Bring shin guards, water, and a positive attitude. If you can’t make a practice, reply to this email so I can plan the drills.', '— Coach Daniels') +
      `<span class="ml-cta" data-app="calendar">Open Calendar</span><span class="ml-cta gray" data-reply="Hi Coach, I can’t make practice on ">Can’t make it</span>`, 420, { flagged: true });

    add(S.grandma, 'Cookies and a question',
      P(`Dear ${esc(n)},`, 'I baked two dozen oatmeal cookies this morning and your grandfather has already eaten five. I am hiding the rest for you in the blue tin.',
        'Now, my question: your mother says you are making a computer game for the science fair. Is it one I could play? I am getting rather good at the solitaire on my tablet.',
        'Come visit this weekend if you can. Bring your sister.', 'All my love,<br>Grandma Rose 🌷'), 1260);

    add(S.library, 'Reminder: 2 items due in 3 days',
      P(`Hello ${esc(n)},`, 'This is a friendly reminder that the following items are due soon:') +
      '<table><tr><td>Game Design for Young Coders<small>Non-fiction · 794.8</small></td><td>Due Fri</td></tr><tr><td>The Wild Robot Escapes<small>Fiction</small></td><td>Due Fri</td></tr></table>' +
      P('You can renew each item once if nobody is waiting for it. Reply to this email with the word RENEW and we’ll take care of it.') +
      `<span class="ml-cta" data-reply="RENEW">Renew my items</span><p class="ml-fine">Riverbend Public Library · Open Mon–Sat 9–8 · Library cards are free for all residents.</p>`, 1500);

    add(S.school, 'Maple Ridge Weekly: Spirit Week + Science Fair sign-ups',
      `<div class="ml-banner" style="background:linear-gradient(135deg,#30B0C7,#34C759)">Maple Ridge Weekly<small>News for students and families</small></div>` +
      '<h3>Spirit Week is coming!</h3><ul><li><b>Mon</b> — Pajama Day</li><li><b>Tue</b> — Twin Day</li><li><b>Wed</b> — Wacky Hair</li><li><b>Thu</b> — Favorite Book Character</li><li><b>Fri</b> — School Colors</li></ul>' +
      '<h3>Science Fair</h3>' + P('Sign-ups close next Friday. Projects can be experiments, inventions, or <b>computer programs</b>. See Mr. Hoffman in Room 114 for a proposal form.') +
      '<h3>Lunch menu highlights</h3>' + P('Taco Tuesday returns. Thursday is build-your-own pasta.') +
      '<p class="ml-fine">You’re receiving this because you’re a Maple Ridge student or family member.</p>', 1720);

    add(S.hoffman, 'Science fair project proposal — feedback',
      P(`Hi ${esc(n)},`, 'I read your proposal for a game that teaches the water cycle. I think it’s a terrific idea, and a program absolutely counts as a project.',
        'Two suggestions:') + '<ol><li>Add a way to <b>measure</b> something — for example, quiz players before and after they play.</li><li>Keep a build journal with dates. Judges love seeing how your idea changed.</li></ol>' +
      P('Proposal approved! Let me know if you need lab time on the classroom computers.', 'Mr. Hoffman<br>Science, Room 114'), 2890, { replied: true });

    add(S.sprout, 'Your coding streak: 12 days 🔥',
      `<div class="ml-banner" style="background:linear-gradient(135deg,#00C7BE,#007AFF)"><em>🔥</em>12-day streak!<small>You’re in the top 8% of learners this month</small></div>` +
      P('You finished <b>Loops & Lists</b> and started <b>Functions</b>. Next up: write a function that draws any polygon.') +
      `<div class="ml-card"><div class="e" style="background:#FF9500">🏅</div><div><b>New badge: Bug Squasher</b><span>Fixed 10 broken programs</span></div></div>` +
      `<p class="ml-fine">CodeSprout Academy · Learning to code, one sprout at a time.</p>`, 3100);

    add(S.pizza, 'Your order is confirmed — Friday Family Deal',
      P('Thanks for ordering from Pizza Planet! 🍕') +
      '<table><tr><td>Friday Family Deal<small>2 large pizzas · cheesy bread · 2-liter lemonade</small></td><td>$24.99</td></tr><tr><td>Extra: pineapple (half)<small>Yes, really</small></td><td>$1.50</td></tr><tr class="total"><td>Total</td><td>$26.49</td></tr></table>' +
      P('Pickup time: <b>6:15 PM</b>. Show this email at the counter.') + `<span class="ml-cta" data-url="tel:5550107492">Call the shop</span>`, 4300);

    add(S.alex, 'server stuff',
      P('ok so my cousin says we can use his old laptop as a server for our world', 'we just need to pick a name. i vote for CAVE CLUB', 'also bring your controller saturday'), 7300);

    out.push({ id: U.uid(), box: 'sent', from: you, to: [S.hoffman], subject: 'Re: Science fair project proposal — feedback', html: textToHtml(`Hi Mr. Hoffman,\n\nThank you! I’ll add a quiz at the start and end so I can measure what players learned. Can I use the lab on Thursday at lunch?\n\n${n}${SIG}`), date: now - 2800 * 60000, unread: false, flagged: false });
    out.push({ id: U.uid(), box: 'sent', from: you, to: [S.grandma], subject: 'Re: Cookies and a question', html: textToHtml(`Hi Grandma!\n\nYes you can totally play it, I’ll make an easy mode just for you. Save me the big cookies!!\n\nLove,\n${n}${SIG}`), date: now - 1200 * 60000, unread: false, flagged: false });
    out.push({ id: U.uid(), box: 'drafts', from: you, to: [S.forge], subject: 'Game jam team question', html: textToHtml(`Hi Pixel Forge,\n\nCan my friend Alex and I enter as a team of two? Also is it ok if we use `), date: now - 95 * 60000, unread: false, flagged: false, draft: { to: S.forge.email, cc: '', bcc: '', body: 'Hi Pixel Forge,\n\nCan my friend Alex and I enter as a team of two? Also is it ok if we use ' } });
    return out;
  }

  function incoming() {
    load(); const n = owner();
    const m = { id: U.uid(), box: 'inbox', from: { name: 'BlockHive', email: 'digest@blockhive.example', color: '#FF9500', emoji: '🐝' }, to: [me()], subject: '⭐ Your project was featured!', unread: true, flagged: false, date: Date.now(),
      html: `<div class="ml-banner" style="background:linear-gradient(135deg,#FFCC00,#FF9500)"><em>⭐</em>You’ve been featured!<small>Hand-picked by the BlockHive curators</small></div>` +
        P(`Congratulations, ${esc(n)}!`, 'Your project <b>Sky Aces</b> was chosen for this week’s <b>Featured</b> row on the BlockHive front page. The curators loved the smooth controls and the way enemy planes fly in formation.', 'Featured projects usually get a lot of visitors — a great moment to reply to comments and thank people who remix your work.') +
        `<span class="ml-cta" data-reply="Thank you so much for featuring my project! ">Say thanks</span><p class="ml-fine">Keep creating! — The BlockHive Team</p>` };
    mails.unshift(m); save(); updateBadge();
    try { OS.sound.play('new_mail'); } catch (e) { /* no audio */ }
    try { OS.notify({ appId: 'mail', title: m.from.name, body: m.subject + ' — ' + previewOf(m).slice(0, 80), sound: false, onTap() { OS.openApp('mail', { open: m.id }); } }); } catch (e) { /* core not ready */ }
    refresh();
  }

  /* ------------------------------------------------------------------ actions */
  function trashMail(list) {
    list.forEach((m) => { if (m.box === 'trash') mails = load().filter((x) => x !== m); else { m.prevBox = m.box; m.box = 'trash'; } });
    OS.sound.play('trash'); save(); updateBadge();
  }
  function moveMail(list, box) { list.forEach((m) => { m.box = box; }); save(); updateBadge(); }
  function chooseBox(list, then) {
    const opts = BOXES.filter((b) => ['inbox', 'archive', 'trash'].includes(b.id));
    OS.ui.actionSheet({ title: list.length > 1 ? `Move ${list.length} Messages` : 'Move Message', message: 'Choose a mailbox.', buttons: opts.map((b) => ({ label: b.name })) }).then((i) => {
      if (i < 0) return; if (opts[i].id === 'trash') trashMail(list); else moveMail(list, opts[i].id); then && then();
    });
  }

  /* ------------------------------------------------------------------ shared UI bits */
  function later(fn, ms) { if (!M) return 0; const t = setTimeout(() => { if (M) { M.timers.delete(t); fn(); } }, ms); M.timers.add(t); return t; }
  function refresh() { if (!M) return; drawBoxes(); if (M.box) drawList(M.box); if (M.view) M.view.sync(); }
  function toolbar(host) { const tb = el('<div class="ml-tb"></div>'); host.appendChild(tb); return tb; }
  function statusHTML(extra) { const n = unreadCount(); return `<div class="c">${extra || 'Updated Just Now'}${n ? `<small>${n} Unread</small>` : ''}</div>`; }

  function swipeRow(row, L, R, o) {
    let state = 0, base = 0, cur = 0, skip = false;   // state: -1 right actions open, 1 left action open
    const set = (x, anim) => {
      cur = x; const tr = anim ? `.34s ${EASE}` : '0s';
      row.style.transition = `transform ${tr}, padding .3s ${EASE}`; L.style.transition = R.style.transition = `width ${tr}`;
      row.style.transform = x ? `translateX(${x}px)` : ''; R.style.width = Math.max(0, -x) + 'px'; L.style.width = Math.max(0, x) + 'px';
    };
    const api = { get open() { return state !== 0; }, close() { state = 0; set(0, true); if (M && M.swipe === api) M.swipe = null; } };
    U.drag(row, {
      axis: 'x',
      onStart(p) {
        skip = !M || o.disabled() || (p.x - p.dx) < 28; if (skip) return false;
        if (M.swipe && M.swipe !== api) M.swipe.close();
        base = state === -1 ? -o.rw : state === 1 ? o.lw : 0; row.classList.remove('pressed');
      },
      onMove(p) { if (skip) return; let x = base + p.dx; if (x > o.lw + 90) x = o.lw + 90 + (x - o.lw - 90) * .2; set(x, false); },
      onEnd(p) {
        if (skip) return;
        if (cur < -250) { set(-OS.W, true); o.fullLeft(); return; }
        if (cur > o.lw + 50) { api.close(); o.fullRight(); return; }
        state = (p.vx < -.35 || (cur < -o.rw / 2 && p.vx < .35)) ? -1 : (cur > o.lw / 2 && p.vx > -.35 && base >= 0 && cur > 0) ? 1 : 0;
        set(state === -1 ? -o.rw : state === 1 ? o.lw : 0, true); M.swipe = state ? api : (M.swipe === api ? null : M.swipe);
      },
    });
    return api;
  }

  /* ------------------------------------------------------------------ mailboxes page */
  function drawBoxes() {
    if (!M || !M.boxWrap) return;
    const count = (b) => {
      if (b.id === 'inbox' || b.id === 'vip') return inBox(b.id).filter((m) => m.unread).length;
      if (b.id === 'flagged' || b.id === 'drafts') return inBox(b.id).length; return 0;
    };
    const row = (b) => { const n = count(b); return `<div class="ios-row tappable ml-boxrow" data-box="${b.id}"><span class="ic">${b.icon}</span><div class="ios-row-label">${b.name}</div>${n ? `<div class="ios-row-value">${n}</div>` : ''}<i class="ios-chevron"></i></div>`; };
    M.boxWrap.innerHTML = `<div class="ios-list" style="margin-top:6px">${BOXES.slice(0, 3).map(row).join('')}</div><div class="ios-list-header">iCloud</div><div class="ios-list">${BOXES.slice(3).map(row).join('')}</div><div class="ml-spacer"></div>`;
    if (M.boxTb) M.boxTb.querySelector('.c').outerHTML = statusHTML();
  }
  function pushBoxes() {
    return M.nav.push({
      title: 'Mailboxes', largeTitle: true, background: 'var(--bg2)',
      render(body, page) {
        M.boxWrap = el('<div></div>'); body.appendChild(M.boxWrap);
        M.boxWrap.addEventListener('click', (e) => { const r = e.target.closest('[data-box]'); if (r) pushList(r.dataset.box); });
        M.boxTb = toolbar(page && page.el ? page.el : body.parentNode);
        M.boxTb.innerHTML = `<button style="visibility:hidden">${I.filter}</button>${statusHTML()}<button aria-label="Compose">${I.compose}</button>`;
        M.boxTb.lastElementChild.addEventListener('click', () => openCompose({}));
        drawBoxes();
      },
      onShow() { if (M) { M.box = null; drawBoxes(); } },
    });
  }

  /* ------------------------------------------------------------------ message list page */
  function listItems(L) {
    const q = L.query.trim().toLowerCase(); let list = inBox(L.boxId);
    if (L.unreadOnly) list = list.filter((m) => m.unread);
    if (q) list = list.filter((m) => [m.from.name, m.from.email, m.subject, toLine(m), previewOf(m)].join(' ').toLowerCase().includes(q));
    return list;
  }
  function drawToolbar(L) {
    const tb = L.tb; if (!tb) return;
    if (L.editing) {
      const n = L.picked.size;
      tb.innerHTML = `<button data-a="mark">${n ? 'Mark' : 'Mark All'}</button><button data-a="move" ${n ? '' : 'disabled'}>Move</button><button data-a="trash" ${n ? '' : 'disabled'}>${L.boxId === 'trash' ? 'Delete' : 'Trash'}</button>`;
    } else {
      tb.innerHTML = `<button data-a="filter" aria-label="Filter">${L.unreadOnly ? I.filterOn : I.filter}</button>${statusHTML(L.unreadOnly ? 'Filtered by: <b>Unread</b>' : '')}<button data-a="compose" aria-label="Compose">${I.compose}</button>`;
    }
  }
  function setEditing(L, on) {
    L.editing = on; L.picked.clear(); if (M.swipe) M.swipe.close();
    L.page.setRight([{ label: on ? 'Cancel' : 'Edit', bold: on, onTap: () => setEditing(L, !L.editing) }]);
    drawList(L);
  }
  function drawList(L) {
    if (!M || !L.wrap) return;
    const wrap = L.wrap, list = listItems(L), sentLike = L.boxId === 'sent' || L.boxId === 'drafts';
    M.swipe = null; wrap.innerHTML = ''; wrap.classList.toggle('editing', L.editing);
    drawToolbar(L);
    if (!list.length) {
      wrap.innerHTML = L.query.trim() ? `<div class="ml-empty">No Results<small>for “${esc(L.query.trim())}”</small></div>` : L.unreadOnly ? '<div class="ml-empty">No Unread Mail</div>' : '<div class="ml-empty">No Mail</div>';
      return;
    }
    list.forEach((m) => {
      const who = sentLike ? toLine(m) : m.from.name;
      const rw = el(`<div class="ml-rw"><div class="ml-acts l"><button class="read">${m.unread ? I.envOpen : I.env}<span>${m.unread ? 'Read' : 'Unread'}</span></button></div>
        <div class="ml-acts r"><button class="arch">${I.archive}<span>${m.box === 'archive' ? 'Inbox' : 'Archive'}</span></button><button class="flag">${I.flagFill}<span>${m.flagged ? 'Unflag' : 'Flag'}</span></button><button class="trash">${I.trash}<span>${m.box === 'trash' ? 'Delete' : 'Trash'}</span></button></div>
        <div class="ml-r${L.picked.has(m.id) ? ' picked' : ''}"><i class="ml-sel">${I.check}</i><div class="ml-ind">${m.unread ? '<i class="dot"></i>' : ''}${m.flagged ? `<i class="fl">${I.flagFill}</i>` : ''}${m.replied ? `<i class="rp">${I.reply}</i>` : ''}</div>
          <div class="ml-r-main"><div class="ml-r-top"><b>${!sentLike && isVip(m.from.email) ? `<span class="vip">${I.starFill}</span>` : ''}${esc(who)}</b><span class="t">${esc(U.relDate(m.date))}</span><i class="ios-chevron"></i></div>
          <div class="ml-r-sub">${esc(m.subject || '(No Subject)')}</div><div class="ml-r-prev">${esc(previewOf(m)) || '<span style="color:var(--label3)">This message has no content.</span>'}</div></div></div></div>`);
      const row = rw.querySelector('.ml-r');
      const collapse = (then) => { rw.style.height = rw.offsetHeight + 'px'; rw.getBoundingClientRect(); rw.style.height = '0px'; rw.style.opacity = '0'; later(then, 300); };
      const doTrash = () => { trashMail([m]); collapse(() => refresh()); };
      const toggleRead = () => { m.unread = !m.unread; save(); updateBadge(); later(refresh, 320); };
      const sw = swipeRow(row, rw.querySelector('.ml-acts.l'), rw.querySelector('.ml-acts.r'), { lw: 84, rw: 228, disabled: () => L.editing, fullLeft: doTrash, fullRight: toggleRead });
      row.addEventListener('pointerdown', () => { if (!sw.open) row.classList.add('pressed'); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => row.addEventListener(n, () => row.classList.remove('pressed')));
      row.addEventListener('click', () => {
        if (sw.open) return sw.close();
        if (M.swipe) return M.swipe.close();
        if (L.editing) { L.picked.has(m.id) ? L.picked.delete(m.id) : L.picked.add(m.id); row.classList.toggle('picked'); drawToolbar(L); return; }
        if (m.box === 'drafts') return openCompose(Object.assign({ draftId: m.id, subject: m.subject }, m.draft || { to: (m.to || []).map((p) => p.email).join(', '), body: htmlToText(m.html) }));
        pushMessage(m.id, L);
      });
      rw.querySelector('.read').addEventListener('click', () => { sw.close(); toggleRead(); });
      rw.querySelector('.flag').addEventListener('click', () => { m.flagged = !m.flagged; save(); sw.close(); later(refresh, 340); });
      rw.querySelector('.arch').addEventListener('click', () => { moveMail([m], m.box === 'archive' ? 'inbox' : 'archive'); collapse(() => refresh()); });
      rw.querySelector('.trash').addEventListener('click', doTrash);
      wrap.appendChild(rw);
    });
  }
  function pushList(boxId, quiet) {
    const L = { boxId, query: '', unreadOnly: false, editing: false, picked: new Set(), wrap: null, tb: null, page: null };
    L.page = M.nav.push({
      title: boxName(boxId), largeTitle: true, back: 'Mailboxes',
      right: [{ label: 'Edit', onTap: () => setEditing(L, !L.editing) }],
      search: { placeholder: 'Search', onInput(t) { L.query = t || ''; drawList(L); } },
      render(body, page) {
        L.page = page; L.wrap = el('<div class="ml-list"></div>'); body.appendChild(L.wrap); body.appendChild(el('<div class="ml-spacer"></div>'));
        L.tb = toolbar(page && page.el ? page.el : body.parentNode);
        L.tb.addEventListener('click', (e) => {
          const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
          const chosen = () => load().filter((m) => L.picked.has(m.id));
          if (a === 'compose') openCompose({});
          else if (a === 'filter') { L.unreadOnly = !L.unreadOnly; OS.haptic && OS.haptic('selection'); drawList(L); }
          else if (a === 'trash') { trashMail(chosen()); setEditing(L, false); refresh(); }
          else if (a === 'move') chooseBox(chosen(), () => { setEditing(L, false); refresh(); });
          else if (a === 'mark') {
            const list = L.picked.size ? chosen() : listItems(L); if (!list.length) return;
            const anyUnread = list.some((m) => m.unread), allFlag = list.every((m) => m.flagged);
            OS.ui.actionSheet({ buttons: [{ label: allFlag ? 'Unflag' : 'Flag' }, { label: anyUnread ? 'Mark as Read' : 'Mark as Unread' }] }).then((i) => {
              if (i < 0) return; if (i === 0) list.forEach((m) => { m.flagged = !allFlag; }); else list.forEach((m) => { m.unread = !anyUnread; });
              save(); updateBadge(); setEditing(L, false); refresh();
            });
          }
        });
        drawList(L);
      },
      onShow() { if (M) { M.box = L; M.view = null; drawList(L); } },
    });
    if (quiet && L.page && L.page.el) {   // first launch: land on the Inbox without a visible slide
      const a = L.page.el, b = M.rootPage && M.rootPage.el; [a, b].forEach((x) => { if (x) x.style.transition = 'none'; });
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => [a, b].forEach((x) => { if (x) x.style.transition = ''; }), 30)));
    }
    return L;
  }

  /* ------------------------------------------------------------------ message view */
  function pushMessage(id, L) {
    let cur = id; const ids = L ? listItems(L).map((m) => m.id) : [id];
    const V = { wrap: null, tb: null, page: null, sync() { if (!getMail(cur) && M) { M.view = null; M.nav.pop(); } else draw(); } };
    const go = (d) => { const i = ids.indexOf(cur) + d; if (i < 0 || i >= ids.length || !getMail(ids[i])) return; cur = ids[i]; draw(); V.page.body.scrollTop = 0; };
    const arrows = () => { const i = ids.indexOf(cur); V.page.setRight([{ icon: I.up, disabled: i <= 0, onTap: () => go(-1) }, { icon: I.down, disabled: i < 0 || i >= ids.length - 1, onTap: () => go(1) }]); };
    function draw() {
      const m = getMail(cur); if (!m || !V.wrap) return;
      if (m.unread) { m.unread = false; save(); updateBadge(); }
      const mine = m.box === 'sent' || m.box === 'drafts';
      V.wrap.className = 'ml-msg' + (m.flagged ? ' flagged' : '');
      V.wrap.innerHTML = `<div class="ml-hd">${avatarFor(m.from, 40)}<div class="ml-hd-main"><div class="ml-from">${!mine && isVip(m.from.email) ? `<span class="vip">${I.starFill}</span>` : ''}<b>${esc(m.from.name)}</b><span class="t">${esc(U.relDate(m.date))}</span></div>
        <div class="ml-to">To: <span>${esc(toLine(m))}</span></div></div></div>
        <div class="ml-more">From: ${esc(m.from.email)}<br>To: ${esc((m.to || []).map((p) => p.email).join(', '))}${m.cc ? '<br>Cc: ' + esc(m.cc) : ''}<br>${esc(fullDate(m.date))}</div>
        <h1 class="ml-subj"><span>${esc(m.subject || '(No Subject)')}</span><i>${I.flagFill}</i></h1><div class="ml-body">${m.html}</div><div class="ml-spacer"></div>`;
      arrows();
    }
    V.page = M.nav.push({
      title: '', back: L ? boxName(L.boxId) : 'Inbox', background: 'var(--bg)',
      render(body, page) {
        V.page = page; V.wrap = el('<div class="ml-msg"></div>'); body.appendChild(V.wrap);
        V.wrap.addEventListener('click', (e) => {
          const m = getMail(cur); if (!m) return;
          const t = e.target.closest('[data-reply],[data-app],[data-url]');
          if (t) {
            if (t.dataset.reply != null) return replyTo(m, 'reply', t.dataset.reply);
            if (t.dataset.app) { if (OS.isInstalled && !OS.isInstalled(t.dataset.app)) return OS.ui.toast('App not installed'); return void OS.openApp(t.dataset.app); }
            return void OS.openURL(t.dataset.url);
          }
          if (e.target.closest('.ml-to')) return V.wrap.classList.toggle('details');
          const fromEl = e.target.closest('.ml-from b');
          if (fromEl) {
            const v = isVip(m.from.email);
            OS.ui.contextMenu(fromEl, [
              { label: v ? 'Remove from VIP' : 'Add to VIP', icon: v ? I.star : I.starFill, onTap: () => { toggleVip(m.from.email); draw(); } },
              { label: 'New Message', icon: I.compose, onTap: () => openCompose({ to: m.from.email }) },
              { label: 'Copy Address', icon: I.doc, onTap: () => { try { navigator.clipboard && navigator.clipboard.writeText(m.from.email).catch(() => {}); } catch (e2) { /* no clipboard */ } OS.ui.toast('Copied'); } },
            ]);
          }
        });
        V.tb = toolbar(page && page.el ? page.el : body.parentNode);
        V.tb.innerHTML = `<button data-a="trash" aria-label="Trash">${I.trash}</button><button data-a="move" aria-label="Move">${I.folder}</button><button data-a="reply" aria-label="Reply">${I.reply}</button><button data-a="compose" aria-label="Compose">${I.compose}</button>`;
        V.tb.addEventListener('click', (e) => {
          const b = e.target.closest('[data-a]'), m = getMail(cur); if (!b || !m) return; const a = b.dataset.a;
          const leave = () => { const i = ids.indexOf(cur); ids.splice(i, 1); if (ids.length && getMail(ids[Math.min(i, ids.length - 1)])) { cur = ids[Math.min(i, ids.length - 1)]; draw(); V.page.body.scrollTop = 0; } else { M.view = null; M.nav.pop(); } };
          if (a === 'trash') { trashMail([m]); leave(); }
          else if (a === 'move') chooseBox([m], leave);
          else if (a === 'compose') openCompose({});
          else if (a === 'reply') {
            OS.ui.actionSheet({ buttons: [{ label: 'Reply' }, { label: 'Forward' }, { label: m.flagged ? 'Unflag' : 'Flag' }, { label: 'Mark as Unread' }] }).then((i) => {
              if (i === 0) replyTo(m, 'reply'); else if (i === 1) replyTo(m, 'forward');
              else if (i === 2) { m.flagged = !m.flagged; save(); draw(); }
              else if (i === 3) { m.unread = true; save(); updateBadge(); M.view = null; M.nav.pop(); }
            });
          }
        });
        draw();
      },
      onShow() { if (M) M.view = V; },
    });
    return V;
  }

  function replyTo(m, mode, lead) {
    const text = htmlToText(m.html), mineSent = m.box === 'sent';
    if (mode === 'forward') {
      return openCompose({ title: 'Fwd: ' + m.subject, subject: /^fwd?:/i.test(m.subject) ? m.subject : 'Fwd: ' + m.subject,
        body: `${SIG}\n\nBegin forwarded message:\n\nFrom: ${m.from.name} <${m.from.email}>\nSubject: ${m.subject}\nDate: ${fullDate(m.date)}\nTo: ${(m.to || []).map((p) => p.email).join(', ')}\n\n${text}`, cursorStart: true });
    }
    const quoted = text.split('\n').map((l) => '> ' + l).join('\n');
    openCompose({ replyId: m.id, title: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, to: mineSent ? (m.to || []).map((p) => p.email).join(', ') : m.from.email,
      subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject,
      body: `${lead || ''}${SIG}\n\nOn ${fullDate(m.date)}, ${m.from.name} <${m.from.email}> wrote:\n\n${quoted}`, cursorAt: (lead || '').length });
  }

  /* ------------------------------------------------------------------ compose */
  function openCompose(init) {
    load();
    init = Object.assign({ to: '', cc: '', bcc: '', subject: '', body: SIG, draftId: null, replyId: null, title: '' }, init || {});
    let ref = null, settled = false, box = null, fields = null, snapshot = '';
    const close = () => { try { ref && ref.close(); } catch (e) { /* closed */ } };
    const vals = () => ({ to: fields.to.value.trim(), cc: fields.cc.value.trim(), bcc: fields.bcc.value.trim(), subject: fields.subject.value.trim(), body: fields.body.value });
    const sig = (v) => [v.to, v.cc, v.bcc, v.subject, v.body].join('\u0001');
    const dirty = () => !!fields && (sig(vals()) !== snapshot || (!!init.replyId && !init.draftId));
    const valid = () => parseRecipients(fields.to.value).some((p) => /^\S+@\S+\.\S+$/.test(p.email));
    const sendEl = () => (box && box.closest('.ios-sheet') ? box.closest('.ios-sheet').querySelector('.ml-sendbtn') : null);
    const syncSend = () => { const b = sendEl(); if (b) b.classList.toggle('off', !valid()); };
    const dropDraft = () => { if (init.draftId) { mails = load().filter((m) => m.id !== init.draftId); } };
    function saveDraft() {
      const v = vals(); dropDraft();
      mails.unshift({ id: U.uid(), box: 'drafts', from: me(), to: parseRecipients(v.to), cc: v.cc, subject: v.subject, html: textToHtml(v.body), date: Date.now(), unread: false, flagged: false, draft: { to: v.to, cc: v.cc, bcc: v.bcc, body: v.body, replyId: init.replyId } });
      save(); refresh();
    }
    function cancel() {
      if (!dirty()) { settled = true; return close(); }
      Array.from(box.querySelectorAll('input,textarea')).forEach((x) => x.blur());
      OS.ui.actionSheet({ buttons: [{ label: 'Delete Draft', style: 'destructive' }, { label: 'Save Draft' }], cancel: 'Cancel' }).then((i) => {
        if (i < 0) return; settled = true;
        if (i === 0) { dropDraft(); save(); refresh(); } else saveDraft();
        close();
      });
    }
    function send() {
      const v = vals(), to = parseRecipients(v.to);
      if (!valid()) { OS.haptic && OS.haptic('error'); OS.ui.alert({ title: to.length ? 'Invalid Address' : 'No Recipient', message: to.length ? `“${to[0].email}” does not appear to be a valid email address.` : 'Add an email address in the To field to send this message.' }); return; }
      const finish = () => {
        settled = true; dropDraft();
        mails.unshift({ id: U.uid(), box: 'sent', from: me(), to, cc: [v.cc, v.bcc].filter(Boolean).join(', '), subject: v.subject || '(No Subject)', html: textToHtml(v.body), date: Date.now(), unread: false, flagged: false });
        const orig = init.replyId && getMail(init.replyId); if (orig) orig.replied = true;
        save(); OS.sound.play('mail_sent'); close(); refresh();
      };
      if (!v.subject) OS.ui.alert({ title: 'Empty Subject', message: 'This message has no subject. Do you want to send it anyway?', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Send' }] }).then((i) => { if (i === 1) finish(); });
      else finish();
    }
    const sheet = OS.ui.sheet({
      title: '',
      left: { label: 'Cancel', onTap: cancel },
      right: { icon: `<span class="ml-sendbtn off" role="button" aria-label="Send">${I.arrowUp}</span>`, label: 'Send', bold: true, onTap: send },
      onClose() { if (!settled && fields && dirty()) { settled = true; saveDraft(); OS.ui.toast('Saved to Drafts'); } },
      render(body, s) {
        ref = ref || s || null;
        box = el(`<div class="ml-sheet hidecc"><h1>${esc(init.title || init.subject || 'New Message')}</h1>
          <div class="ml-f"><span>To:</span><input data-f="to" type="text" inputmode="email" autocomplete="off" autocapitalize="off" enterkeyhint="next"><button class="add" aria-label="Add Contact">${I.plus}</button></div><div class="ml-sugg"></div>
          <div class="ml-f ml-cc1"><span>Cc/Bcc, From:</span><div class="fromv" style="color:var(--label2)">${esc(me().email)}</div></div>
          <div class="ml-f ml-cc2"><span>Cc:</span><input data-f="cc" type="text" inputmode="email" autocomplete="off" autocapitalize="off" enterkeyhint="next"></div>
          <div class="ml-f ml-cc2"><span>Bcc:</span><input data-f="bcc" type="text" inputmode="email" autocomplete="off" autocapitalize="off" enterkeyhint="next"></div>
          <div class="ml-f ml-cc2"><span>From:</span><div class="fromv">${esc(me().email)}</div></div>
          <div class="ml-f"><span>Subject:</span><input data-f="subject" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="next"></div>
          <textarea data-f="body" autocapitalize="sentences" aria-label="Message"></textarea></div>`);
        body.appendChild(box);
        fields = {}; box.querySelectorAll('[data-f]').forEach((x) => { fields[x.dataset.f] = x; });
        fields.to.value = init.to || ''; fields.cc.value = init.cc || ''; fields.bcc.value = init.bcc || ''; fields.subject.value = init.subject || ''; fields.body.value = init.body == null ? SIG : init.body;
        if (init.cc || init.bcc) box.classList.remove('hidecc');
        snapshot = init.draftId || init.replyId ? sig(vals()) : sig({ to: '', cc: '', bcc: '', subject: '', body: SIG });
        const title = box.querySelector('h1'), sugg = box.querySelector('.ml-sugg');
        const grow = () => { const ta = fields.body; ta.style.height = 'auto'; ta.style.height = Math.max(260, ta.scrollHeight + 4) + 'px'; };
        const lastToken = () => fields.to.value.split(/[,;]/).pop().trim().toLowerCase();
        let showAll = false;
        const drawSugg = () => {
          const q = lastToken(); sugg.innerHTML = ''; if (!q && !showAll) return;
          const have = fields.to.value.toLowerCase();
          OS.contacts.all().filter((c) => c.email && !have.includes(c.email.toLowerCase()) && (!q || OS.contacts.name(c).toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || c.email.toLowerCase().startsWith(q))).slice(0, showAll && !q ? 40 : 4).forEach((c) => {
            const r = el(`<div class="ml-sg">${OS.contacts.avatar(c, 34)}<div><b>${esc(OS.contacts.name(c))}</b><small>${esc(c.email)}</small></div></div>`);
            ['pointerdown', 'mousedown'].forEach((n) => r.addEventListener(n, (e) => e.preventDefault()));
            r.addEventListener('click', () => { const parts = fields.to.value.split(/[,;]/); parts.pop(); parts.push(' ' + c.email); fields.to.value = parts.map((x) => x.trim()).filter(Boolean).join(', ') + ', '; showAll = false; drawSugg(); syncSend(); });
            sugg.appendChild(r);
          });
        };
        fields.to.addEventListener('input', () => { showAll = false; drawSugg(); syncSend(); });
        fields.to.addEventListener('blur', () => { fields.to.value = fields.to.value.replace(/[,;\s]+$/, ''); setTimeout(() => { if (document.activeElement !== fields.to) { showAll = false; sugg.innerHTML = ''; } }, 120); syncSend(); });
        const addBtn = box.querySelector('.add');
        ['pointerdown', 'mousedown'].forEach((n) => addBtn.addEventListener(n, (e) => e.preventDefault()));
        addBtn.addEventListener('click', () => { showAll = !showAll; drawSugg(); });
        box.querySelector('.ml-cc1').addEventListener('click', () => { box.classList.remove('hidecc'); fields.cc.focus(); });
        fields.subject.addEventListener('input', () => { title.textContent = fields.subject.value.trim() || 'New Message'; });
        const order = ['to', 'cc', 'bcc', 'subject', 'body'];
        order.slice(0, 4).forEach((k, i) => fields[k].addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return; e.preventDefault();
          let nx = order[i + 1]; if (box.classList.contains('hidecc') && (nx === 'cc' || nx === 'bcc')) nx = 'subject';
          setTimeout(() => fields[nx].focus(), 0);
        }));
        fields.body.addEventListener('input', grow);
        setTimeout(() => {
          grow(); syncSend();
          try {
            const focusEl = !fields.to.value ? fields.to : !fields.subject.value ? fields.subject : fields.body; focusEl.focus();
            if (focusEl === fields.body) { const at = init.cursorAt != null ? init.cursorAt : 0; fields.body.setSelectionRange(at, at); body.scrollTop = 0; }
          } catch (e) { /* sheet already closed */ }
        }, 430);
      },
    });
    if (sheet) ref = sheet;
  }

  /* ------------------------------------------------------------------ app */
  OS.registerApp({
    id: 'mail',
    name: 'Mail',
    icon: {
      bg: 'linear-gradient(180deg,#1E9BF9,#1A6CF2)',
      glyph: `<svg viewBox="0 0 60 60"><rect x="8" y="15.5" width="44" height="29" rx="5" fill="#fff"/><path d="M10 41.8l13.4-11.6M50 41.8L36.6 30.2" fill="none" stroke="#1B78F3" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round"/><path d="M9.8 18.6l17 13.7a5.1 5.1 0 0 0 6.4 0l17-13.7" fill="none" stroke="#1B78F3" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',

    launch(ctx) {
      load();
      M = { ctx, nav: null, rootPage: null, boxWrap: null, boxTb: null, box: null, view: null, swipe: null, timers: new Set(), onMinute: null };
      const host = el('<div style="position:absolute;inset:0"></div>'); ctx.root.appendChild(host);
      M.nav = OS.ui.createNav(host, { tabBarInset: false });
      M.rootPage = pushBoxes();
      pushList('inbox', true);
      M.onMinute = () => { if (M && M.box && !M.swipe && !M.box.editing && M.nav.top === M.box.page) drawList(M.box); };
      OS.on('minute', M.onMinute);
      updateBadge();
    },

    onResume(ctx, params) {
      if (!M) return;
      if (params && params.open && getMail(params.open)) {
        if (M.view) { M.view = null; M.nav.pop(false); }
        if (!M.box || M.box.boxId !== 'inbox') { if (M.box) M.nav.pop(false); pushList('inbox', true); }
        pushMessage(params.open, M.box);
      } else if (params && (params.to || params.subject || params.body || params.compose)) {
        openCompose({ to: params.to || '', subject: params.subject || '', body: (params.body || '') + SIG, title: params.subject || '' });
      }
      refresh();
    },

    onPause() { if (M && M.swipe) M.swipe.close(); },

    onClose() {
      if (!M) return;
      if (M.onMinute) OS.off('minute', M.onMinute);
      M.timers.forEach((t) => clearTimeout(t)); M.timers.clear();
      M = null;
    },
  });

  /* ------------------------------------------------------------------ page-level: badge + one new email per page load */
  setTimeout(() => { try { load(); updateBadge(); } catch (e) { console.warn('[mail] init', e); } }, 0);
  setTimeout(() => { try { incoming(); } catch (e) { console.warn('[mail] incoming', e); } }, 175000 + Math.random() * 20000);
})();
