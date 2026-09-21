/* Notes — folders → notes list → rich-text editor. Data in OS.store: notes.items / notes.folders / notes.prefs */
(function () {
  'use strict';

  const K_ITEMS = 'notes.items', K_FOLDERS = 'notes.folders', K_PREFS = 'notes.prefs';
  const DAY = 86400000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const EMPTY = '<div><br></div>';
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const BLOCK_TAGS = { DIV: 1, P: 1, H1: 1, H2: 1, H3: 1, PRE: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1 };

  let S = null;   // per-process state, created in launch(), dropped in onClose()

  /* ───────────────────────── icons ───────────────────────── */
  const svg = (inner, extra) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${inner}</svg>`;
  const FOLDER_D = 'M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4c.7 0 1.3.3 1.8.7L12 7h6.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z';
  const PIN_D = 'M9 3.5h6l-.7 5.6 3.2 3.4V14H13v5.6l-1 1.4-1-1.4V14H6.5v-1.5l3.2-3.4z';
  const I = {
    ellipsis: svg('<circle cx="12" cy="12" r="9.3"/><g fill="currentColor" stroke="none"><circle cx="7.8" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="16.2" cy="12" r="1.25"/></g>'),
    share: svg('<path d="M8.5 9.5h-2A1.5 1.5 0 0 0 5 11v8.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V11a1.5 1.5 0 0 0-1.5-1.5h-2"/><path d="M12 14.5V3M8.4 6.4 12 2.8l3.6 3.6"/>'),
    compose: svg('<path d="M11.5 4.5h-5A2.5 2.5 0 0 0 4 7v10.5A2.5 2.5 0 0 0 6.5 20H17a2.5 2.5 0 0 0 2.5-2.5v-5"/><path d="M18.3 3.4a1.55 1.55 0 0 1 2.2 2.2L12 14.2l-3 .8.8-3z"/>'),
    folder: svg(`<path d="${FOLDER_D}"/>`),
    folderPlus: svg(`<path d="${FOLDER_D}"/><path d="M12 10.3v5.4M9.3 13h5.4"/>`),
    trash: svg('<path d="M4 6.5h16M9.3 6.2V4.6c0-.6.5-1.1 1.1-1.1h3.2c.6 0 1.1.5 1.1 1.1v1.6M6 6.5l.9 12.2A1.6 1.6 0 0 0 8.5 20.2h7a1.6 1.6 0 0 0 1.6-1.5L18 6.5M10 10.2v6.3M14 10.2v6.3"/>'),
    checklist: svg('<circle cx="6.3" cy="7" r="3.3"/><path d="M4.9 7.1l1 1 1.8-2"/><path d="M13 7h8"/><circle cx="6.3" cy="17" r="3.3"/><path d="M13 17h8"/>', 'stroke-width="1.6"'),
    bullets: svg('<g fill="currentColor" stroke="none"><circle cx="4.6" cy="6" r="1.5"/><circle cx="4.6" cy="12" r="1.5"/><circle cx="4.6" cy="18" r="1.5"/></g><path d="M9.5 6H21M9.5 12H21M9.5 18H21"/>'),
    numbers: svg('<g fill="currentColor" stroke="none" font-size="7.2" font-weight="700" font-family="system-ui,-apple-system,Helvetica,Arial"><text x="2.4" y="8.4">1</text><text x="2.4" y="14.5">2</text><text x="2.4" y="20.6">3</text></g><path d="M9.5 6H21M9.5 12H21M9.5 18H21"/>'),
    indent: svg('<path d="M3 5h18M11 10h10M11 14.5h10M3 19.5h18M3.5 9.6l3.6 2.7-3.6 2.7z" /><path d="M3.5 9.6l3.6 2.7-3.6 2.7z" fill="currentColor"/>'),
    outdent: svg('<path d="M3 5h18M11 10h10M11 14.5h10M3 19.5h18"/><path d="M7.3 9.6l-3.6 2.7 3.6 2.7z" fill="currentColor"/>'),
    pin: svg(`<path d="${PIN_D}" fill="currentColor" stroke="none"/>`),
    unpin: svg(`<path d="${PIN_D}" fill="currentColor" stroke="none"/><path d="M4 4l16 16" stroke-width="2"/>`),
    check: svg('<path d="M5 12.6l4.4 4.4L19 7.4"/>', 'stroke-width="2.2"'),
    chevR: '<svg viewBox="0 0 8 14" width="8" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.2 1.2 6.8 7l-5.6 5.8"/></svg>',
    chevD: '<svg viewBox="0 0 14 8" width="13" height="8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.2 1.2 7 6.8l5.8-5.6"/></svg>',
    xmark: svg('<path d="M7 7l10 10M17 7 7 17"/>', 'stroke-width="2.4"'),
    minus: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="11" fill="var(--red)"/><path d="M6.5 12h11" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    recover: svg(`<path d="${FOLDER_D}"/><path d="M12 15.6v-5M9.8 12.6 12 10.4l2.2 2.2"/>`),
    move: svg(`<path d="${FOLDER_D}"/>`),
    rename: svg('<path d="M16.8 4.2a1.7 1.7 0 0 1 2.4 2.4L8.5 17.3l-3.5 1 1-3.5z"/><path d="M13 20h7"/>'),
  };

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('notes', `
    .app-notes { --tint:#E0A800; --nt-onfg:#fff; }
    #screen[data-theme="dark"] .app-notes { --tint:#FFD60A; --nt-onfg:#000; }
    .app-notes .nt-navhost { position:absolute; inset:0; }
    .app-notes .nt-wrap { padding-bottom:70px; }

    /* bottom toolbar (folders + list) */
    .app-notes .nt-bar { position:absolute; left:0; right:0; bottom:0; height:49px; padding:0 10px var(--safe-bottom); box-sizing:content-box;
      display:flex; align-items:center; justify-content:space-between; background:var(--bar); -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
      border-top:0.5px solid var(--sep); z-index:6; }
    .app-notes .nt-bar-btn { width:44px; height:44px; display:flex; align-items:center; justify-content:center; color:var(--tint); cursor:pointer; transition:opacity .15s; }
    .app-notes .nt-bar-btn:active { opacity:.4; }
    .app-notes .nt-bar-btn.hidden { visibility:hidden; pointer-events:none; }
    .app-notes .nt-bar-btn svg { width:26px; height:26px; }
    .app-notes .nt-bar-count { flex:1; text-align:center; font-size:12px; color:var(--label); letter-spacing:-.1px; }

    /* section headers + grouped cards */
    .app-notes .nt-gh { display:flex; align-items:baseline; justify-content:space-between; margin:22px 20px 8px; font-size:20px; font-weight:700; letter-spacing:-.4px; color:var(--label); }
    .app-notes .nt-gh:first-child { margin-top:10px; }
    .app-notes .nt-gh small { font-size:15px; font-weight:400; color:var(--label2); letter-spacing:-.2px; }
    .app-notes .nt-gh.tappable { cursor:pointer; }
    .app-notes .nt-gh .nt-gh-chev { color:var(--tint); transition:transform .3s ${EASE}; display:inline-flex; align-self:center; }
    .app-notes .nt-gh.collapsed .nt-gh-chev { transform:rotate(-90deg); }
    .app-notes .nt-group { margin:0 16px; background:var(--cell); border-radius:12px; overflow:hidden; }
    .app-notes .nt-collapsible { overflow:hidden; transition:height .35s ${EASE}, opacity .3s; }
    .app-notes .nt-info { margin:10px 32px 0; font-size:13px; line-height:1.35; color:var(--label2); text-align:center; }
    .app-notes .nt-empty { padding:150px 40px 0; text-align:center; color:var(--label2); }
    .app-notes .nt-empty b { display:block; font-size:22px; font-weight:700; color:var(--label); margin-bottom:6px; letter-spacing:-.4px; }
    .app-notes .nt-empty span { font-size:15px; }

    /* swipe rows */
    .app-notes .nt-sw { position:relative; overflow:hidden; }
    .app-notes .nt-sw-l, .app-notes .nt-sw-r { position:absolute; top:0; bottom:0; width:0; overflow:hidden; }
    .app-notes .nt-sw-l { left:0; background:var(--orange); }
    .app-notes .nt-sw-l.indigo { background:var(--indigo); }
    .app-notes .nt-sw-r { right:0; background:var(--red); }
    .app-notes .nt-act { position:absolute; top:0; bottom:0; width:78px; display:flex; align-items:center; justify-content:center; color:#fff; cursor:pointer; transition:transform .22s ${EASE}; }
    .app-notes .nt-sw-r .nt-act { right:0; }
    .app-notes .nt-sw-l .nt-act { left:0; }
    .app-notes .nt-act svg { width:26px; height:26px; }
    .app-notes .nt-sw-content { position:relative; background:var(--cell); cursor:pointer; will-change:transform; }
    .app-notes .nt-sw-content:active { background-image:linear-gradient(var(--fill2),var(--fill2)); }
    .app-notes .nt-sw + .nt-sw .nt-sw-content::after { content:''; position:absolute; left:16px; right:0; top:0; height:0.5px; background:var(--sep); }
    .app-notes .nt-frow + .nt-frow .nt-sw-content::after { left:56px; }

    /* note row */
    .app-notes .nt-note { padding:10px 16px 11px; }
    .app-notes .nt-note-title { font-size:17px; font-weight:600; letter-spacing:-.4px; color:var(--label); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-notes .nt-note-sub { margin-top:2px; font-size:15px; letter-spacing:-.2px; color:var(--label2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-notes .nt-note-sub em { font-style:normal; color:var(--label); opacity:.78; margin-right:8px; }
    .app-notes .nt-note-folder { margin-top:3px; display:flex; align-items:center; gap:5px; font-size:15px; letter-spacing:-.2px; color:var(--label2); }
    .app-notes .nt-note-folder svg { width:17px; height:17px; opacity:.75; }

    /* folder row */
    .app-notes .nt-folder { display:flex; align-items:center; min-height:46px; padding:0 14px 0 16px; }
    .app-notes .nt-folder-minus { width:0; opacity:0; overflow:hidden; display:flex; align-items:center; transition:width .3s ${EASE}, opacity .25s, margin .3s ${EASE}; }
    .app-notes .nt-folder-ico { width:28px; height:28px; color:var(--tint); display:flex; align-items:center; justify-content:center; margin-right:12px; flex:none; }
    .app-notes .nt-folder-ico svg { width:27px; height:27px; }
    .app-notes .nt-folder-name { flex:1; font-size:17px; letter-spacing:-.4px; color:var(--label); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-notes .nt-folder-count { font-size:17px; color:var(--label2); margin:0 10px 0 8px; letter-spacing:-.4px; }
    .app-notes .nt-folder-chev { color:var(--label3); display:flex; }
    .app-notes .nt-folders.editing .nt-frow.user .nt-folder-minus { width:24px; opacity:1; margin-right:12px; }
    .app-notes .nt-folders.editing .nt-frow:not(.user) { opacity:.35; pointer-events:none; }
    .app-notes .nt-folders.editing .nt-folder-count { display:none; }

    /* editor */
    .app-notes .nt-date { text-align:center; font-size:13px; color:var(--label2); padding:4px 16px 12px; letter-spacing:-.1px; }
    .app-notes .nt-editor { outline:none; padding:0 20px; min-height:560px; font-size:17px; line-height:1.41; letter-spacing:-.4px; color:var(--label);
      caret-color:var(--tint); word-wrap:break-word; overflow-wrap:anywhere; white-space:pre-wrap; -webkit-user-select:text; user-select:text; cursor:text; }
    .app-notes .nt-editor ::selection { background:rgba(255,204,0,.32); }
    .app-notes .nt-editor h1, .app-notes .nt-editor h2, .app-notes .nt-editor h3, .app-notes .nt-editor pre, .app-notes .nt-editor p { margin:0; }
    .app-notes .nt-editor h1 { font-size:28px; font-weight:700; line-height:1.2; letter-spacing:.3px; padding:6px 0 4px; }
    .app-notes .nt-editor h2 { font-size:22px; font-weight:700; line-height:1.25; letter-spacing:-.3px; padding:8px 0 2px; }
    .app-notes .nt-editor h3 { font-size:19px; font-weight:600; line-height:1.3; letter-spacing:-.4px; padding:6px 0 1px; }
    .app-notes .nt-editor pre { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:15px; letter-spacing:0; white-space:pre-wrap; }
    .app-notes .nt-editor ul, .app-notes .nt-editor ol { margin:0; padding-left:30px; }
    .app-notes .nt-editor li { padding-left:2px; }
    .app-notes .nt-editor li::marker { color:var(--label); }
    .app-notes .nt-editor blockquote { margin:0 0 0 28px !important; padding:0 !important; border:none !important; }
    .app-notes .nt-editor > :first-child { font-size:28px; font-weight:700; line-height:1.2; letter-spacing:.3px; padding:0 0 6px; }
    .app-notes .nt-editor .nt-check { position:relative; padding:3px 0 3px 34px; }
    .app-notes .nt-editor .nt-check::before { content:''; position:absolute; left:1px; top:4px; top:calc(3px + (1lh - 22px) / 2); width:22px; height:22px; box-sizing:border-box;
      border:1.6px solid var(--label3); border-radius:50%; cursor:pointer; transition:background-color .18s, border-color .18s, transform .25s ${EASE}; }
    .app-notes .nt-editor .nt-check.on::before { border-color:var(--tint); background:var(--tint) center/22px 22px no-repeat
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M6.2 11.4l3.3 3.3 6.4-7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-origin:border-box; }
    #screen[data-theme="dark"] .app-notes .nt-editor .nt-check.on::before { background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M6.2 11.4l3.3 3.3 6.4-7' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
    .app-notes .nt-editor .nt-check.on { color:var(--label2); }
    .app-notes .nt-editor .nt-check.pop::before { transform:scale(1.18); }
    .app-notes .nt-ed-spacer { height:calc(var(--kb-h, 0px) + 140px); }

    /* editor toolbar — rides on top of the keyboard */
    .app-notes .nt-edbar { position:absolute; left:0; right:0; bottom:var(--kb-h, 0px); height:46px; padding:0 8px var(--safe-bottom); box-sizing:content-box;
      display:flex; align-items:center; gap:2px; background:var(--bar); -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
      border-top:0.5px solid var(--sep); z-index:6; transition:bottom .3s ${EASE}, padding-bottom .3s ${EASE}; }
    .app-notes .nt-editing .nt-edbar { padding-bottom:0; }
    .app-notes .nt-tb { min-width:46px; height:44px; display:flex; align-items:center; justify-content:center; color:var(--tint); cursor:pointer; border-radius:10px; transition:opacity .15s, background-color .15s; }
    .app-notes .nt-tb:active { opacity:.4; }
    .app-notes .nt-tb.on { background:var(--fill2); }
    .app-notes .nt-tb svg { width:25px; height:25px; }
    .app-notes .nt-tb .nt-aa { font-size:19px; font-weight:500; letter-spacing:-.3px; }
    .app-notes .nt-tb.done { font-size:17px; font-weight:600; padding:0 8px; letter-spacing:-.4px; }
    .app-notes .nt-tb-gap { flex:1; }
    .app-notes .nt-host:not(.nt-editing) .nt-only-edit { display:none; }
    .app-notes .nt-editing .nt-only-idle { display:none; }

    /* format popover */
    .app-notes .nt-fmt { position:absolute; left:8px; right:8px; bottom:calc(var(--kb-h, 0px) + 54px); padding:14px 14px 16px; border-radius:18px; z-index:7;
      background:var(--cell); box-shadow:0 8px 40px rgba(0,0,0,.22), 0 0 0 0.5px var(--sep); transform-origin:24px 100%;
      transform:scale(.6) translateY(20px); opacity:0; pointer-events:none; transition:transform .32s ${EASE}, opacity .2s, bottom .3s ${EASE}; }
    #screen[data-theme="dark"] .app-notes .nt-fmt { background:#2C2C2E; }
    .app-notes .nt-host:not(.nt-editing) .nt-fmt { bottom:calc(var(--safe-bottom) + 54px); }
    .app-notes .nt-fmt.show { transform:none; opacity:1; pointer-events:auto; }
    .app-notes .nt-fmt-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .app-notes .nt-fmt-head b { font-size:17px; font-weight:600; letter-spacing:-.4px; color:var(--label); }
    .app-notes .nt-fmt-x { width:28px; height:28px; border-radius:50%; background:var(--fill); color:var(--label2); display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .app-notes .nt-fmt-x svg { width:15px; height:15px; }
    .app-notes .nt-fmt-styles { display:flex; align-items:center; gap:4px; overflow-x:auto; overflow-y:hidden; margin:0 -14px 12px; padding:0 14px; scrollbar-width:none; white-space:nowrap; }
    .app-notes .nt-fmt-styles::-webkit-scrollbar { display:none; }
    .app-notes .nt-chip { flex:none; height:36px; padding:0 12px; border-radius:9px; display:flex; align-items:center; color:var(--label); cursor:pointer; transition:background-color .15s, color .15s; }
    .app-notes .nt-chip.on { background:var(--tint); color:var(--nt-onfg); }
    .app-notes .nt-chip.s-h1 { font-size:22px; font-weight:700; }
    .app-notes .nt-chip.s-h2 { font-size:18px; font-weight:700; }
    .app-notes .nt-chip.s-h3 { font-size:16px; font-weight:600; }
    .app-notes .nt-chip.s-div { font-size:15px; }
    .app-notes .nt-chip.s-pre { font-size:14px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
    .app-notes .nt-fmt-row { display:flex; gap:10px; margin-top:10px; }
    .app-notes .nt-fgrp { flex:1; display:flex; gap:2px; border-radius:10px; overflow:hidden; }
    .app-notes .nt-fgrp.narrow { flex:0 0 38%; }
    .app-notes .nt-fbtn { flex:1; height:42px; display:flex; align-items:center; justify-content:center; background:var(--fill2); color:var(--label); font-size:19px; cursor:pointer;
      font-family:system-ui,-apple-system,'Times New Roman',serif; transition:background-color .15s, color .15s; }
    .app-notes .nt-fbtn:active { background:var(--fill); }
    .app-notes .nt-fbtn.on { background:var(--tint); color:var(--nt-onfg); }
    .app-notes .nt-fbtn svg { width:23px; height:23px; }
  `);

  /* ───────────────────────── helpers ───────────────────────── */
  const esc = (s) => OS.util.esc(String(s == null ? '' : s));
  const el = (html) => OS.util.el(html);
  const haptic = (t) => { try { OS.haptic(t); } catch (e) {} };
  const sound = (id) => { try { OS.sound.play(id); } catch (e) {} };

  function later(fn, ms) {
    if (!S) return 0;
    const st = S;
    const id = setTimeout(() => { st.timers.delete(id); if (S === st) fn(); }, ms);
    st.timers.add(id);
    return id;
  }

  function fmtTime(d) {
    const t = OS.util.time(d);
    if (OS.settings.get('use24h') || /[ap]m/i.test(t)) return t;
    return t + ' ' + OS.util.ampm(d);
  }
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function fullDate(ts) { const d = new Date(ts); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${fmtTime(d)}`; }
  function rowDate(ts) {
    const d = new Date(ts), t0 = startOfDay(Date.now());
    if (ts >= t0) return fmtTime(d);
    if (ts >= t0 - DAY) return 'Yesterday';
    if (ts >= t0 - 6 * DAY) return WEEKDAYS[d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  }
  function groupLabel(ts) {
    const d = new Date(ts), t0 = startOfDay(Date.now());
    if (ts >= t0) return 'Today';
    if (ts >= t0 - DAY) return 'Yesterday';
    if (ts >= t0 - 7 * DAY) return 'Previous 7 Days';
    if (ts >= t0 - 30 * DAY) return 'Previous 30 Days';
    if (d.getFullYear() === new Date().getFullYear()) return MONTHS[d.getMonth()];
    return String(d.getFullYear());
  }
  const countLabel = (n) => (n === 0 ? 'No Notes' : n === 1 ? '1 Note' : n + ' Notes');

  /* plain-text lines of a note's html (title = first non-empty, preview = second) */
  function collectLines(node, out) {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { if (c.nodeValue.trim()) out.push(c.nodeValue); return; }
      if (c.nodeType !== 1) return;
      let hasBlock = false;
      for (const k of c.children) if (BLOCK_TAGS[k.tagName]) { hasBlock = true; break; }
      if (hasBlock) collectLines(c, out); else out.push(c.textContent);
    });
  }
  function analyze(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    const lines = [];
    collectLines(d, lines);
    const clean = lines.map((l) => l.replace(/ /g, ' ').trim()).filter(Boolean);
    return { title: (clean[0] || '').slice(0, 140), preview: (clean[1] || '').slice(0, 160), text: clean.join('\n') };
  }
  function textToHtml(text) {
    const lines = String(text || '').split(/\r?\n/);
    return lines.map((l) => `<div>${l ? esc(l) : '<br>'}</div>`).join('') || EMPTY;
  }

  /* ───────────────────────── data ───────────────────────── */
  function seed() {
    return { folders: [], items: [] };   // a new iPhone has no notes
    const now = Date.now();
    const D = (t) => `<div>${t}</div>`, BR = '<div><br></div>', H = (t) => `<h2>${t}</h2>`;
    const C = (t, on) => `<div class="nt-check${on ? ' on' : ''}">${t}</div>`;
    const UL = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    const OL = (a) => `<ol>${a.map((x) => `<li>${x}</li>`).join('')}</ol>`;
    const folders = [{ id: 'f_school', name: 'School' }, { id: 'f_games', name: 'Game Projects' }];
    const mk = (folder, ago, html, pinned) => {
      const a = analyze(html);
      return { id: OS.util.uid(), folder, html, title: a.title, preview: a.preview, text: a.text, created: now - ago - 2 * DAY, updated: now - ago, pinned: !!pinned, deleted: 0 };
    };
    const items = [
      mk('f_games', 26 * 60000,
        D('Game ideas 🎮') + D('Stuff I want to build when I have time') + BR +
        H('Train game') + UL(['Subway that never stops — you survive car by car', 'Each car is a different biome (jungle car??)', 'Boss fight on the roof while it goes through a tunnel']) +
        H('Cat RPG') + UL(['Catch cats instead of monsters', 'Every cat has a <b>nap meter</b>. If it hits zero they just fall asleep mid-battle', 'Final boss = the vacuum']) +
        H('Tiny ideas') + UL(['Chess but the pieces are football players', 'A weather app for a planet that doesn’t exist']), true),
      mk('notes', 3 * 3600000,
        D('Weekend to-do') + C('Clean room (for real this time)', true) + C('Finish math worksheet', true) + C('Feed the fish', true) +
        C('Record new Scratch tutorial') + C('Ask Dad about the foam glider') + C('Charge controller before Saturday') + C('Return library books')),
      mk('notes', DAY + 5 * 3600000,
        D('Wifi password') + D('Network: <b>Pretty Fly for a WiFi</b>') + D('Password: ask Mom. She changes it every time I forget the dishes.') + BR +
        D('Guest network: NachoWifi') + D('Password: itsnotyours123') + BR + D('<i>Note to self: stop telling people the guest one</i>')),
      mk('f_school', 2 * DAY + 2 * 3600000,
        D('Science — volcano notes') + D('Test is on Friday!!') + BR + H('3 main types') +
        OL(['<b>Shield</b> — wide and flat, runny lava (Hawaii)', '<b>Composite</b> — tall and pointy, explosive (Mt. St. Helens)', '<b>Cinder cone</b> — small, made of loose rock']) +
        H('Words to know') + UL(['Magma = underground, lava = above ground', 'Viscosity = how thick the lava is', 'Ring of Fire = where most of them are']) + BR +
        D('Homework: pages 112–115, questions 1–8')),
      mk('f_games', 5 * DAY,
        D('Minecraft base coords') + `<pre>Home base      214, 71, -388\nVillage        -120, 64, 455\nStronghold     1340, 32, -912\nMushroom isle  -2210, 63, 1876</pre>` + BR +
        D('Seed is written on the sticky note on my monitor') + D('Nether portal at home comes out right over lava. <b>Do not sprint.</b>')),
      mk('notes', 12 * DAY,
        D('Birthday list 🎂') + C('Xbox controller (the blue one)') + C('LEGO Technic plane') + C('New headphones') + C('Book 4 of Wings of Fire', true) + C('Balsa wood + foam board for gliders') + BR +
        D('Party ideas: laser tag or the trampoline place')),
      mk('f_school', 24 * DAY,
        D('Book report: Hatchet') + D('By Gary Paulsen — due the 3rd') + BR + H('Main idea') +
        D('Brian survives alone in the Canadian wilderness after a plane crash with only a hatchet. He learns to stay calm and fix problems one at a time.') + BR +
        H('My opinion') + D('Best part is when he finally makes fire. I would not have lasted two days. 9/10.')),
      mk('notes', 51 * DAY,
        D('Things Dad says') + UL(['“I’m not sleeping, I’m resting my eyes.”', '“Hi Hungry, I’m Dad.”', '“We’re not lost, we’re exploring.”', '“Back in my day phones had cords.”']) + D('Keep adding to this. Use at his birthday.')),
    ];
    OS.store.set(K_FOLDERS, folders);
    OS.store.set(K_ITEMS, items);
    return { folders, items };
  }

  function loadData() {
    let items = OS.store.get(K_ITEMS, null), folders = OS.store.get(K_FOLDERS, null);
    if (!Array.isArray(items) || !Array.isArray(folders)) { const s = seed(); items = s.items; folders = s.folders; }
    const cutoff = Date.now() - 30 * DAY;
    const kept = items.filter((n) => n && n.id && !(n.deleted && n.deleted < cutoff));
    S.items = kept; S.folders = folders;
    S.prefs = Object.assign({ sort: 'edited', collapsed: false }, OS.store.get(K_PREFS, {}) || {});
    if (kept.length !== items.length) saveItems();
  }
  const saveItems = () => OS.store.set(K_ITEMS, S.items);
  const saveFolders = () => OS.store.set(K_FOLDERS, S.folders);
  const savePrefs = () => OS.store.set(K_PREFS, S.prefs);
  const getNote = (id) => S.items.find((n) => n.id === id);

  function folderName(fid) {
    if (fid === 'all') return 'All iCloud';
    if (fid === 'notes') return 'Notes';
    if (fid === 'trash') return 'Recently Deleted';
    const f = S.folders.find((x) => x.id === fid);
    return f ? f.name : 'Notes';
  }
  function notesIn(fid) {
    if (fid === 'trash') return S.items.filter((n) => n.deleted);
    if (fid === 'all') return S.items.filter((n) => !n.deleted);
    return S.items.filter((n) => !n.deleted && n.folder === fid);
  }
  function sortNotes(list) {
    const s = S.prefs.sort;
    return list.slice().sort((a, b) => s === 'title'
      ? (a.title || 'New Note').localeCompare(b.title || 'New Note', undefined, { sensitivity: 'base' })
      : s === 'created' ? b.created - a.created : b.updated - a.updated);
  }
  function createNote(fid, text) {
    const folder = (fid && fid !== 'all' && fid !== 'trash' && (fid === 'notes' || S.folders.some((f) => f.id === fid))) ? fid : 'notes';
    const html = text ? textToHtml(text) : EMPTY;
    const a = analyze(html), now = Date.now();
    const n = { id: OS.util.uid(), folder, html, title: a.title, preview: a.preview, text: a.text, created: now, updated: now, pinned: false, deleted: 0 };
    S.items.unshift(n);
    saveItems();
    return n;
  }
  /* empty notes are thrown away (except the one open in the editor) */
  function purgeEmpty() {
    const keep = S.ed ? S.ed.id() : null;
    const before = S.items.length;
    S.items = S.items.filter((n) => n.id === keep || (n.text && n.text.trim()) || /nt-check/.test(n.html || ''));
    if (S.items.length !== before) saveItems();
  }
  function trashNote(n) { n.deleted = Date.now(); n.pinned = false; saveItems(); sound('trash'); haptic('medium'); }
  function recoverNote(n) {
    n.deleted = 0;
    if (n.folder !== 'notes' && !S.folders.some((f) => f.id === n.folder)) n.folder = 'notes';
    saveItems();
  }
  function destroyNote(n) { S.items = S.items.filter((x) => x.id !== n.id); saveItems(); sound('trash'); haptic('medium'); }

  /* ───────────────────────── menus / dialogs ───────────────────────── */
  function popMenu(e, items, title) {
    const a = e && (e.currentTarget || e.target);
    if (a && a.nodeType === 1 && typeof OS.ui.contextMenu === 'function') { OS.ui.contextMenu(a, items); return; }
    OS.ui.actionSheet({ title, buttons: items.map((i) => ({ label: i.label, style: i.style, icon: i.icon })), cancel: 'Cancel' })
      .then((i) => { if (S && i >= 0 && items[i] && items[i].onTap) items[i].onTap(); });
  }

  async function shareNote(n) {
    const text = n.text || '';
    if (!text.trim()) { OS.ui.toast('Nothing to Share'); return; }
    const opts = [{ label: 'Copy', run: async () => {
      try { await navigator.clipboard.writeText(text); OS.ui.toast('Copied'); } catch (e) { OS.ui.toast('Couldn’t Copy'); }
    } }];
    if (OS.isInstalled('messages')) opts.push({ label: 'Messages', run: () => OS.openURL('sms:?body=' + encodeURIComponent(text)) });
    if (OS.isInstalled('mail')) opts.push({ label: 'Mail', run: () => OS.openURL('mailto:?subject=' + encodeURIComponent(n.title || 'Note') + '&body=' + encodeURIComponent(text)) });
    const i = await OS.ui.actionSheet({ title: n.title || 'New Note', message: 'Share Note', buttons: opts.map((o) => ({ label: o.label })), cancel: 'Cancel' });
    if (S && i >= 0 && opts[i]) opts[i].run();
  }

  async function moveNote(n, done) {
    const targets = [{ id: 'notes', name: 'Notes' }].concat(S.folders).filter((f) => f.id !== n.folder);
    if (!targets.length) { OS.ui.toast('No Other Folders'); return; }
    const i = await OS.ui.actionSheet({ title: 'Select a folder', message: n.title || 'New Note', buttons: targets.map((f) => ({ label: f.name })), cancel: 'Cancel' });
    if (!S || i < 0) return;
    n.folder = targets[i].id; saveItems();
    OS.ui.toast('Moved to ' + targets[i].name);
    if (done) done();
  }

  async function newFolder() {
    const name = await OS.ui.prompt({ title: 'New Folder', message: 'Enter a name for this folder.', placeholder: 'Name', value: '', okLabel: 'Save' });
    if (!S || name == null) return;
    const clean = name.trim() || 'New Folder';
    if (S.folders.some((f) => f.name.toLowerCase() === clean.toLowerCase()) || /^(notes|all icloud|recently deleted)$/i.test(clean)) {
      await OS.ui.alert({ title: 'Name Taken', message: 'Please choose a different name.', buttons: [{ label: 'OK', style: 'cancel' }] });
      return;
    }
    S.folders.push({ id: 'f_' + OS.util.uid(), name: clean });
    S.folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    saveFolders(); haptic('light');
    renderFolders();
  }
  async function renameFolder(f, after) {
    const name = await OS.ui.prompt({ title: 'Rename Folder', message: 'Enter a new name for this folder.', placeholder: 'Name', value: f.name, okLabel: 'Save' });
    if (!S || name == null || !name.trim()) return;
    f.name = name.trim(); saveFolders();
    if (after) after(f.name);
    renderFolders();
  }
  async function deleteFolder(f, after) {
    const count = notesIn(f.id).length;
    const i = await OS.ui.alert({
      title: 'Delete Folder?',
      message: count ? `The folder “${f.name}” will be deleted and its ${count === 1 ? 'note' : count + ' notes'} will be moved to Recently Deleted.` : `The folder “${f.name}” will be deleted.`,
      buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }],
    });
    if (!S || i !== 1) return false;
    const now = Date.now();
    S.items.forEach((n) => { if (n.folder === f.id && !n.deleted) { n.deleted = now; n.pinned = false; n.folder = 'notes'; } });
    S.folders = S.folders.filter((x) => x.id !== f.id);
    saveItems(); saveFolders(); sound('trash'); haptic('medium');
    if (after) after();
    renderFolders();
    return true;
  }

  /* ───────────────────────── swipe rows ───────────────────────── */
  // row = .nt-sw  (children: .nt-sw-l?, .nt-sw-r?, .nt-sw-content).  o = { scroller, onTap, onTrail, onLead }
  function attachSwipe(row, o) {
    const content = row.querySelector('.nt-sw-content');
    const actR = row.querySelector('.nt-sw-r'), actL = row.querySelector('.nt-sw-l');
    const W = 78;
    let x = 0, base = 0, lock = null, st = 0, moved = false, wasFull = false;

    function set(v, anim) {
      x = v;
      const tr = anim ? `transform .36s ${EASE}, width .36s ${EASE}` : 'none';
      content.style.transition = tr;
      content.style.transform = v ? `translateX(${v}px)` : '';
      const full = Math.abs(v) > row.offsetWidth * 0.55;
      if (actR) {
        actR.style.transition = tr; actR.style.width = Math.max(0, -v) + 'px';
        actR.firstElementChild.style.transform = (full && v < 0) ? `translateX(${-(-v - W)}px)` : '';
      }
      if (actL) {
        actL.style.transition = tr; actL.style.width = Math.max(0, v) + 'px';
        actL.firstElementChild.style.transform = (full && v > 0) ? `translateX(${v - W}px)` : '';
      }
      if (full !== wasFull) { wasFull = full; if (!anim) haptic('medium'); }
      if (S) { if (v !== 0) S.openSwipe = row; else if (S.openSwipe === row) S.openSwipe = null; }
    }
    row._close = () => set(0, true);
    row._collapse = (dir, then) => {
      set(dir * (row.offsetWidth + 10), true);
      row.style.height = row.offsetHeight + 'px';
      void row.offsetHeight;
      row.style.transition = `height .3s ${EASE} .08s, opacity .3s`;
      row.style.height = '0px'; row.style.opacity = '0';
      later(then, 380);
    };

    content.addEventListener('click', (e) => {
      if (moved) return;
      if (x !== 0) { set(0, true); return; }
      if (o.onTap) o.onTap(e);
    });
    if (actR) actR.addEventListener('click', () => o.onTrail && o.onTrail(row));
    if (actL) actL.addEventListener('click', () => o.onLead && o.onLead(row));
    if (!actR && !actL) return;

    OS.util.drag(content, {
      onStart() {
        base = x; lock = null; st = o.scroller ? o.scroller.scrollTop : 0;
        if (S && S.openSwipe && S.openSwipe !== row && S.openSwipe._close) S.openSwipe._close();
      },
      onMove(p, e) {
        if (!lock) {
          if (Math.abs(p.dx) > 8 && Math.abs(p.dx) > Math.abs(p.dy) * 1.2) lock = 'h';
          else if (Math.abs(p.dy) > 8) lock = 'v';
        }
        if (lock !== 'h') return;
        moved = true;
        if (o.scroller) o.scroller.scrollTop = st;           // keep the list still while swiping sideways
        if (e && e.cancelable) e.preventDefault();
        let v = base + p.dx;
        if (v > 0 && !actL) v *= 0.12;
        if (v < 0 && !actR) v *= 0.12;
        set(v, false);
      },
      onEnd() {
        if (lock === 'h') {
          const w = row.offsetWidth;
          if (x < -w * 0.55 && o.onTrail) o.onTrail(row);
          else if (x > w * 0.55 && o.onLead) o.onLead(row);
          else if (x < -W * 0.45 && actR) set(-W, true);
          else if (x > W * 0.45 && actL) set(W, true);
          else set(0, true);
        }
        setTimeout(() => { moved = false; }, 60);
      },
    });
  }
  function closeSwipeOnOutsideTap(scope) {
    scope.addEventListener('pointerdown', (e) => {
      if (S && S.openSwipe && !S.openSwipe.contains(e.target) && S.openSwipe._close) S.openSwipe._close();
    }, true);
  }

  /* ───────────────────────── note rows / groups ───────────────────────── */
  function noteRow(n, o) {   // o = { trash, showFolder, scroller, refresh, back }
    const lead = o.trash ? `<div class="nt-sw-l indigo"><div class="nt-act">${I.recover}</div></div>` : `<div class="nt-sw-l"><div class="nt-act">${n.pinned ? I.unpin : I.pin}</div></div>`;
    const row = el(`
      <div class="nt-sw">
        ${lead}
        <div class="nt-sw-r"><div class="nt-act">${I.trash}</div></div>
        <div class="nt-sw-content"><div class="nt-note">
          <div class="nt-note-title">${esc(n.title || 'New Note')}</div>
          <div class="nt-note-sub"><em>${esc(rowDate(o.trash ? n.deleted : (S.prefs.sort === 'created' ? n.created : n.updated)))}</em>${esc(n.preview || 'No additional text')}</div>
          ${o.showFolder ? `<div class="nt-note-folder">${I.folder}<span>${esc(folderName(n.folder))}</span></div>` : ''}
        </div></div>
      </div>`);
    attachSwipe(row, {
      scroller: o.scroller,
      async onTap() {
        if (!o.trash) { pushEditor(n.id, { back: o.back }); return; }
        const i = await OS.ui.actionSheet({
          title: 'Recently Deleted Note', message: 'This note can’t be edited while it’s in Recently Deleted. Recover it to make changes.',
          buttons: [{ label: 'Recover' }, { label: 'Delete Permanently', style: 'destructive' }], cancel: 'Cancel',
        });
        if (!S) return;
        if (i === 0) { recoverNote(n); OS.ui.toast('Recovered'); o.refresh(); }
        else if (i === 1) { destroyNote(n); o.refresh(); }
      },
      onTrail(r) { if (o.trash) destroyNote(n); else trashNote(n); r._collapse(-1, o.refresh); },
      onLead(r) {
        if (o.trash) { recoverNote(n); haptic('light'); r._collapse(1, o.refresh); return; }
        n.pinned = !n.pinned; saveItems(); haptic('light');
        r._close(); later(o.refresh, 300);
      },
    });
    OS.util.longPress(row.querySelector('.nt-sw-content'), () => {
      if (o.trash) return;
      haptic('medium');
      OS.ui.contextMenu(row, [
        { label: n.pinned ? 'Unpin Note' : 'Pin Note', icon: n.pinned ? I.unpin : I.pin, onTap() { n.pinned = !n.pinned; saveItems(); o.refresh(); } },
        { label: 'Share Note', icon: I.share, onTap() { shareNote(n); } },
        { label: 'Move', icon: I.move, onTap() { moveNote(n, o.refresh); } },
        { label: 'Delete', icon: I.trash, style: 'destructive', onTap() { trashNote(n); o.refresh(); } },
      ]);
    });
    return row;
  }

  function renderNotes(wrap, fid, query, o) {   // returns count
    const q = (query || '').trim().toLowerCase();
    const trash = fid === 'trash';
    let notes = sortNotes(notesIn(fid));
    if (q) notes = notes.filter((n) => ((n.title || '') + '\n' + (n.text || '')).toLowerCase().includes(q));
    wrap.innerHTML = '';
    if (trash && !q) wrap.appendChild(el('<div class="nt-info">Notes are available here for 30 days. After that time, notes will be permanently deleted.</div>'));
    if (!notes.length) {
      wrap.appendChild(el(q ? `<div class="nt-empty"><b>No Results</b><span>for “${esc(query.trim())}”</span></div>` : '<div class="nt-empty"><b>No Notes</b></div>'));
      return 0;
    }
    const groups = [];
    if (q) groups.push({ label: 'Notes', side: notes.length + ' Found', list: notes });
    else {
      const pinned = trash ? [] : notes.filter((n) => n.pinned);
      const rest = trash ? notes : notes.filter((n) => !n.pinned);
      if (pinned.length) groups.push({ label: 'Pinned', list: pinned });
      if (S.prefs.sort === 'title' || trash) { if (rest.length) groups.push({ label: pinned.length ? 'Notes' : '', list: rest }); }
      else rest.forEach((n) => {
        const label = groupLabel(S.prefs.sort === 'created' ? n.created : n.updated);
        const g = groups[groups.length - 1];
        if (g && g.label === label && g.dated) g.list.push(n); else groups.push({ label, list: [n], dated: true });
      });
    }
    groups.forEach((g) => {
      if (g.label) wrap.appendChild(el(`<div class="nt-gh"><span>${esc(g.label)}</span>${g.side ? `<small>${esc(g.side)}</small>` : ''}</div>`));
      const card = el('<div class="nt-group"></div>');
      if (!g.label) card.style.marginTop = '10px';
      g.list.forEach((n) => card.appendChild(noteRow(n, { trash, showFolder: fid === 'all' || !!o.showFolder, scroller: o.scroller, refresh: o.refresh, back: o.back })));
      wrap.appendChild(card);
    });
    return notes.length;
  }

  function addBar(page, leftIcon, onLeft, onCompose) {
    const host = page.el || page.body.parentElement;
    const bar = el(`
      <div class="nt-bar">
        <div class="nt-bar-btn nt-bar-left${leftIcon ? '' : ' hidden'}">${leftIcon || ''}</div>
        <div class="nt-bar-count"></div>
        <div class="nt-bar-btn nt-bar-compose${onCompose ? '' : ' hidden'}">${I.compose}</div>
      </div>`);
    if (onLeft) bar.querySelector('.nt-bar-left').addEventListener('click', onLeft);
    if (onCompose) bar.querySelector('.nt-bar-compose').addEventListener('click', onCompose);
    host.appendChild(bar);
    return bar;
  }

  /* ───────────────────────── Folders screen ───────────────────────── */
  function setFoldersEdit(on) {
    S.foldersEdit = on;
    const page = S.foldersPage;
    if (page && page.setRight) page.setRight([{ label: on ? 'Done' : 'Edit', bold: on, onTap() { setFoldersEdit(!S.foldersEdit); } }]);
    renderFolders();
  }

  function renderFolders() {
    if (!S || !S.foldersPage || !S.foldersWrap) return;
    const wrap = S.foldersWrap, body = S.foldersPage.body;
    purgeEmpty();
    const q = (S.foldersQuery || '').trim();
    if (q) { renderNotes(wrap, 'all', q, { scroller: body, refresh: renderFolders, showFolder: true, back: 'Folders' }); return; }

    wrap.innerHTML = '';
    const head = el(`<div class="nt-gh tappable${S.prefs.collapsed ? ' collapsed' : ''}"><span>iCloud</span><span class="nt-gh-chev">${I.chevD}</span></div>`);
    const holder = el('<div class="nt-collapsible"></div>');
    const card = el(`<div class="nt-group nt-folders${S.foldersEdit ? ' editing' : ''}"></div>`);
    const rows = [{ id: 'all', name: 'All iCloud' }, { id: 'notes', name: 'Notes' }]
      .concat(S.folders.map((f) => ({ id: f.id, name: f.name, user: f })));
    const trashCount = notesIn('trash').length;
    if (trashCount) rows.push({ id: 'trash', name: 'Recently Deleted', trash: true });

    rows.forEach((r) => {
      const row = el(`
        <div class="nt-sw nt-frow${r.user ? ' user' : ''}">
          ${r.user ? `<div class="nt-sw-r"><div class="nt-act">${I.trash}</div></div>` : ''}
          <div class="nt-sw-content"><div class="nt-folder">
            <div class="nt-folder-minus">${I.minus}</div>
            <div class="nt-folder-ico">${r.trash ? I.trash : I.folder}</div>
            <div class="nt-folder-name">${esc(r.name)}</div>
            <div class="nt-folder-count">${notesIn(r.id).length}</div>
            <div class="nt-folder-chev">${I.chevR}</div>
          </div></div>
        </div>`);
      attachSwipe(row, {
        scroller: body,
        onTap(e) {
          if (S.foldersEdit) {
            if (!r.user) return;
            if (e.target.closest('.nt-folder-minus')) deleteFolder(r.user); else renameFolder(r.user);
            return;
          }
          pushList(r.id);
        },
        async onTrail(rw) { const ok = await deleteFolder(r.user); if (!ok && rw._close) rw._close(); },
      });
      if (r.user) OS.util.longPress(row.querySelector('.nt-sw-content'), () => {
        if (S.foldersEdit) return;
        haptic('medium');
        OS.ui.contextMenu(row, [
          { label: 'Rename', icon: I.rename, onTap() { renameFolder(r.user); } },
          { label: 'Delete', icon: I.trash, style: 'destructive', onTap() { deleteFolder(r.user); } },
        ]);
      });
      card.appendChild(row);
    });
    holder.appendChild(card);
    wrap.appendChild(head); wrap.appendChild(holder);
    if (S.prefs.collapsed) { holder.style.height = '0px'; holder.style.opacity = '0'; }

    head.addEventListener('click', () => {
      S.prefs.collapsed = !S.prefs.collapsed; savePrefs();
      head.classList.toggle('collapsed', S.prefs.collapsed);
      const h = card.offsetHeight;
      holder.style.height = (S.prefs.collapsed ? h : 0) + 'px';
      void holder.offsetHeight;
      holder.style.height = (S.prefs.collapsed ? 0 : h) + 'px';
      holder.style.opacity = S.prefs.collapsed ? '0' : '1';
      if (!S.prefs.collapsed) later(() => { holder.style.height = ''; }, 380);
    });
  }

  function pushFolders() {
    S.nav.push({
      title: 'Folders', largeTitle: true, background: 'var(--bg2)',
      right: [{ label: 'Edit', onTap() { setFoldersEdit(!S.foldersEdit); } }],
      search: { placeholder: 'Search', onInput(t) { if (!S) return; S.foldersQuery = t || ''; renderFolders(); } },
      render(body, page) {
        S.foldersPage = page;
        S.foldersWrap = el('<div class="nt-wrap"></div>');
        body.appendChild(S.foldersWrap);
        closeSwipeOnOutsideTap(body);
        addBar(page, I.folderPlus, () => newFolder(), () => { const n = createNote('notes'); pushEditor(n.id, { focus: true, fresh: true, back: 'Folders' }); });
        renderFolders();
      },
      onShow() { if (S) renderFolders(); },
    });
  }

  /* ───────────────────────── Notes list screen ───────────────────────── */
  function pushList(fid) {
    let page = null, wrap = null, bar = null, query = '';
    const isUser = () => S.folders.find((f) => f.id === fid);
    const back = () => folderName(fid);

    function refresh() {
      if (!S || !wrap) return;
      purgeEmpty();
      renderNotes(wrap, fid, query, { scroller: page.body, refresh, back: back() });
      if (bar) bar.querySelector('.nt-bar-count').textContent = countLabel(notesIn(fid).length);
    }
    function sortItem(key, label) {
      return { label, icon: S.prefs.sort === key ? I.check : undefined, onTap() { S.prefs.sort = key; savePrefs(); refresh(); } };
    }
    function menu(e) {
      const items = [sortItem('edited', 'Sort by Date Edited'), sortItem('created', 'Sort by Date Created'), sortItem('title', 'Sort by Title')];
      const f = isUser();
      if (f) {
        items.push({ label: 'Rename Folder', icon: I.rename, onTap() { renameFolder(f, (nm) => page.setTitle && page.setTitle(nm)); } });
        items.push({ label: 'Delete Folder', icon: I.trash, style: 'destructive', onTap() { deleteFolder(f, () => S.nav.pop()); } });
      }
      if (fid === 'trash' && notesIn('trash').length) {
        items.push({ label: 'Recover All', icon: I.recover, onTap() { notesIn('trash').forEach(recoverNote); refresh(); OS.ui.toast('Recovered'); } });
        items.push({ label: 'Delete All', icon: I.trash, style: 'destructive', async onTap() {
          const i = await OS.ui.alert({ title: 'Delete All Notes?', message: 'These notes will be deleted permanently. This can’t be undone.', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete All', style: 'destructive' }] });
          if (!S || i !== 1) return;
          S.items = S.items.filter((n) => !n.deleted); saveItems(); sound('trash'); refresh();
        } });
      }
      popMenu(e, items, folderName(fid));
    }

    S.nav.push({
      title: folderName(fid), largeTitle: true, back: 'Folders', background: 'var(--bg2)',
      right: [{ icon: I.ellipsis, onTap(e) { menu(e); } }],
      search: { placeholder: 'Search', onInput(t) { query = t || ''; refresh(); } },
      render(body, pg) {
        page = pg;
        wrap = el('<div class="nt-wrap"></div>');
        body.appendChild(wrap);
        closeSwipeOnOutsideTap(body);
        bar = addBar(pg, null, null, fid === 'trash' ? null : () => { const n = createNote(fid); pushEditor(n.id, { focus: true, fresh: true, back: back() }); });
        refresh();
      },
      onShow() { refresh(); },
    });
  }

  /* ───────────────────────── Editor screen ───────────────────────── */
  function pushEditor(noteId, o) {
    o = o || {};
    if (S.ed) { S.ed.load(noteId, !!o.focus); return; }   // an editor is already on top → swap the note in place

    let cur = noteId, page = null, host = null, body = null, ed = null, dateEl = null, bar = null, fmt = null;
    let saveT = 0, savedRange = null, shown = false;

    const scale = () => { const w = S.ctx.root.getBoundingClientRect().width; return w ? w / (S.ctx.root.offsetWidth || 402) : 1; };
    const inEd = (node) => !!node && (node === ed || ed.contains(node));

    function curBlock() {
      const sel = window.getSelection();
      let n = sel && sel.anchorNode;
      if (!inEd(n)) return null;
      while (n && n !== ed) { if (n.nodeType === 1 && BLOCK_TAGS[n.tagName] && n.tagName !== 'UL' && n.tagName !== 'OL') return n; n = n.parentNode; }
      return null;
    }
    function topBlock(n) { while (n && n.parentNode !== ed) n = n.parentNode; return n && n.nodeType === 1 ? n : null; }

    function focusEnd() {
      ed.focus();
      const last = ed.lastElementChild || ed, r = document.createRange();
      if (!last.textContent) { r.setStart(last, 0); r.collapse(true); } else { r.selectNodeContents(last); r.collapse(false); }
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    function restoreSel() {
      if (document.activeElement !== ed) ed.focus();
      const sel = window.getSelection();
      if (sel.rangeCount && inEd(sel.anchorNode)) return;
      if (savedRange && inEd(savedRange.startContainer)) { sel.removeAllRanges(); sel.addRange(savedRange); } else focusEnd();
    }
    const exec = (cmd, val) => { try { document.execCommand(cmd, false, val); } catch (e) {} };

    /* keep the DOM shaped as top-level blocks so the first line can be styled as the title */
    function normalize() {
      if (!ed.firstChild || (ed.childNodes.length === 1 && ed.firstChild.nodeName === 'BR')) {
        ed.innerHTML = EMPTY;
        const r = document.createRange(); r.setStart(ed.firstChild, 0); r.collapse(true);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        return;
      }
      const sel = window.getSelection(), an = sel.anchorNode, ao = sel.anchorOffset;
      let wrapped = false, n = ed.firstChild;
      while (n) {
        const stray = n.nodeType === 3 || (n.nodeType === 1 && !BLOCK_TAGS[n.tagName]);
        if (!stray) { n = n.nextSibling; continue; }
        const div = document.createElement('div');
        ed.insertBefore(div, n);
        while (n && (n.nodeType === 3 || (n.nodeType === 1 && !BLOCK_TAGS[n.tagName]))) {
          const next = n.nextSibling; const isBr = n.nodeName === 'BR';
          div.appendChild(n); n = next;
          if (isBr) break;
        }
        wrapped = true;
      }
      if (wrapped && an && inEd(an) && an !== ed) { try { sel.collapse(an, ao); } catch (e) {} }
    }

    function setDate(ts) { dateEl.textContent = fullDate(ts); }

    function flush() {
      clearTimeout(saveT); saveT = 0;
      const n = S && getNote(cur);
      if (!n || !ed) return;
      const html = ed.innerHTML;
      if (html === n.html) return;
      const a = analyze(html);
      n.html = html; n.title = a.title; n.preview = a.preview; n.text = a.text; n.updated = Date.now();
      saveItems(); setDate(n.updated);
    }
    function changed() { clearTimeout(saveT); saveT = setTimeout(flush, 450); }

    function reveal() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !inEd(sel.anchorNode)) return;
      let r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r || (!r.height && !r.top)) { const b = curBlock(); if (!b) return; r = b.getBoundingClientRect(); }
      const sc = scale(), br = bar.getBoundingClientRect(), top = body.getBoundingClientRect().top + 112 * sc;
      const over = r.bottom - (br.top - 12 * sc);
      if (over > 0) body.scrollTop += over / sc;
      else if (r.top < top) body.scrollTop -= (top - r.top) / sc;
    }

    /* formatting */
    function leaveList() {
      const b = curBlock();
      if (b && b.tagName === 'LI' && b.parentNode) exec(b.parentNode.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
    }
    function toggleCheck() {
      restoreSel(); normalize(); leaveList();
      let b = curBlock();
      if (b && /^(H[1-3]|PRE)$/.test(b.tagName)) { exec('formatBlock', 'div'); b = curBlock(); }
      const sel = window.getSelection();
      let blocks = [];
      if (sel.rangeCount && !sel.isCollapsed) {
        const r = sel.getRangeAt(0), a = topBlock(r.startContainer), z = topBlock(r.endContainer);
        for (let n = a; n; n = n.nextElementSibling) { if (n.tagName === 'DIV' || n.tagName === 'P') blocks.push(n); if (n === z) break; }
      }
      if (!blocks.length && b && (b.tagName === 'DIV' || b.tagName === 'P')) blocks = [b];
      if (!blocks.length) return;
      const allOn = blocks.every((x) => x.classList.contains('nt-check'));
      blocks.forEach((x) => { if (allOn) { x.classList.remove('nt-check', 'on'); if (!x.className) x.removeAttribute('class'); } else x.classList.add('nt-check'); });
    }
    function toggleList(cmd) {
      restoreSel(); normalize();
      const b = curBlock();
      if (b && b.classList.contains('nt-check')) { b.classList.remove('nt-check', 'on'); b.removeAttribute('class'); }
      if (b && /^(H[1-3]|PRE)$/.test(b.tagName)) exec('formatBlock', 'div');
      exec(cmd);
    }
    function setBlock(tag) {
      restoreSel(); normalize(); leaveList();
      const b = curBlock();
      if (b && b.classList.contains('nt-check')) { b.classList.remove('nt-check', 'on'); b.removeAttribute('class'); }
      exec('formatBlock', tag);
    }
    function updateFmt() {
      if (!fmt || !ed) return;
      const active = document.activeElement === ed;
      ['bold', 'italic', 'underline', 'strikeThrough'].forEach((c) => {
        let on = false; try { on = active && document.queryCommandState(c); } catch (e) {}
        fmt.querySelector(`[data-cmd="${c}"]`).classList.toggle('on', !!on);
      });
      const b = active ? curBlock() : null;
      let tag = b ? b.tagName.toLowerCase() : '';
      if (b && b.tagName === 'LI') tag = 'div';
      if (tag === 'p' || tag === 'blockquote') tag = 'div';
      if (b && b === ed.firstElementChild && tag === 'div') tag = 'h1';
      fmt.querySelectorAll('[data-block]').forEach((c) => c.classList.toggle('on', c.dataset.block === tag));
      const li = b && b.tagName === 'LI' ? b.parentNode.tagName : '';
      fmt.querySelector('[data-cmd="ul"]').classList.toggle('on', li === 'UL');
      fmt.querySelector('[data-cmd="ol"]').classList.toggle('on', li === 'OL');
      fmt.querySelector('[data-cmd="check"]').classList.toggle('on', !!(b && b.classList.contains('nt-check')));
    }
    function showFmt(on) {
      fmt.classList.toggle('show', on);
      bar.querySelector('[data-cmd="fmt"]').classList.toggle('on', on);
      if (on) updateFmt();
    }

    function doCmd(cmd) {
      switch (cmd) {
        case 'fmt': if (!fmt.classList.contains('show')) restoreSel(); showFmt(!fmt.classList.contains('show')); return;
        case 'closefmt': showFmt(false); return;
        case 'done': showFmt(false); ed.blur(); flush(); return;
        case 'compose': {
          const old = getNote(cur);
          const n = createNote(old ? old.folder : 'notes');
          load(n.id, true);
          return;
        }
        case 'check': toggleCheck(); break;
        case 'ul': toggleList('insertUnorderedList'); break;
        case 'ol': toggleList('insertOrderedList'); break;
        case 'indent': case 'outdent': restoreSel(); exec(cmd); break;
        default: restoreSel(); exec(cmd);
      }
      normalize(); changed(); updateFmt(); later(reveal, 0);
    }

    function load(id, focus) {
      flush();
      const n = getNote(id);
      if (!n) return;
      cur = id;
      ed.innerHTML = n.html || EMPTY;
      normalize();
      setDate(n.updated);
      body.scrollTop = 0;
      showFmt(false);
      purgeEmpty();
      if (focus) later(() => { if (S.ed === api) focusEnd(); }, 60); else ed.blur();
    }

    function onSelChange() {
      const sel = window.getSelection();
      if (sel.rangeCount && inEd(sel.anchorNode)) { savedRange = sel.getRangeAt(0).cloneRange(); if (fmt.classList.contains('show')) updateFmt(); }
    }
    function listen(on) {
      if (on === shown) return;
      shown = on;
      if (on) document.addEventListener('selectionchange', onSelChange); else document.removeEventListener('selectionchange', onSelChange);
    }

    function caretAtStart(b) {
      const sel = window.getSelection();
      if (!sel.rangeCount || !sel.isCollapsed) return false;
      const r = document.createRange(); r.selectNodeContents(b);
      try { r.setEnd(sel.anchorNode, sel.anchorOffset); } catch (e) { return false; }
      return r.toString() === '';
    }
    function handleEnter() {      // return on an empty checklist item leaves the checklist
      const b = curBlock();
      if (b && b.classList.contains('nt-check') && !b.textContent.trim()) { b.classList.remove('nt-check', 'on'); b.removeAttribute('class'); changed(); updateFmt(); return true; }
      return false;
    }
    function handleBackspace() {  // delete at the very start of a checklist item removes the checkbox first
      const b = curBlock();
      if (b && b.classList.contains('nt-check') && caretAtStart(b)) { b.classList.remove('nt-check', 'on'); b.removeAttribute('class'); changed(); updateFmt(); return true; }
      return false;
    }
    function checkHit(e) {        // is the pointer over a checklist circle?
      const c = e.target.closest && e.target.closest('.nt-check');
      if (!c || !inEd(c)) return null;
      const r = c.getBoundingClientRect(), sc = r.width / (c.offsetWidth || 1) || 1;
      return (e.clientX - r.left) / sc < 32 ? c : null;
    }

    function noteMenu(e) {
      const n = getNote(cur);
      if (!n) return;
      popMenu(e, [
        { label: n.pinned ? 'Unpin Note' : 'Pin Note', icon: n.pinned ? I.unpin : I.pin, onTap() { flush(); n.pinned = !n.pinned; saveItems(); haptic('light'); OS.ui.toast(n.pinned ? 'Pinned' : 'Unpinned'); } },
        { label: 'Share Note', icon: I.share, onTap() { flush(); shareNote(n); } },
        { label: 'Move Note', icon: I.move, onTap() { flush(); moveNote(n); } },
        { label: 'Delete', icon: I.trash, style: 'destructive', onTap() {
          flush(); ed.blur();
          if ((n.text || '').trim()) trashNote(n); else { S.items = S.items.filter((x) => x.id !== n.id); saveItems(); }
          S.nav.pop();
        } },
      ], n.title || 'New Note');
    }

    const api = { id: () => cur, load, flush, reveal, listen };

    S.nav.push({
      title: '', largeTitle: false, back: o.back, background: 'var(--bg)',
      right: [{ icon: I.share, onTap() { flush(); const n = getNote(cur); if (n) shareNote(n); } }, { icon: I.ellipsis, onTap(e) { noteMenu(e); } }],
      render(b, pg) {
        page = pg; body = b; host = pg.el || b.parentElement;
        host.classList.add('nt-host');
        const n = getNote(cur) || createNote('notes');
        cur = n.id;
        dateEl = el('<div class="nt-date"></div>');
        ed = el('<div class="nt-editor" contenteditable="true" spellcheck="false" autocapitalize="sentences" autocorrect="on"></div>');
        ed.innerHTML = n.html || EMPTY;
        body.appendChild(dateEl); body.appendChild(ed); body.appendChild(el('<div class="nt-ed-spacer"></div>'));
        setDate(n.updated);
        normalize();

        bar = el(`
          <div class="nt-edbar">
            <div class="nt-tb" data-cmd="fmt"><span class="nt-aa">Aa</span></div>
            <div class="nt-tb" data-cmd="check">${I.checklist}</div>
            <div class="nt-tb" data-cmd="ul">${I.bullets}</div>
            <div class="nt-tb nt-only-edit" data-cmd="indent">${I.indent}</div>
            <div class="nt-tb-gap"></div>
            <div class="nt-tb nt-only-idle" data-cmd="compose">${I.compose}</div>
            <div class="nt-tb done nt-only-edit" data-cmd="done">Done</div>
          </div>`);
        fmt = el(`
          <div class="nt-fmt">
            <div class="nt-fmt-head"><b>Format</b><div class="nt-fmt-x" data-cmd="closefmt">${I.xmark}</div></div>
            <div class="nt-fmt-styles ios-scroll">
              <div class="nt-chip s-h1" data-block="h1">Title</div><div class="nt-chip s-h2" data-block="h2">Heading</div>
              <div class="nt-chip s-h3" data-block="h3">Subheading</div><div class="nt-chip s-div" data-block="div">Body</div>
              <div class="nt-chip s-pre" data-block="pre">Monostyled</div>
            </div>
            <div class="nt-fmt-row"><div class="nt-fgrp">
              <div class="nt-fbtn" data-cmd="bold"><b>B</b></div><div class="nt-fbtn" data-cmd="italic"><i>I</i></div>
              <div class="nt-fbtn" data-cmd="underline"><u>U</u></div><div class="nt-fbtn" data-cmd="strikeThrough"><s>S</s></div>
            </div></div>
            <div class="nt-fmt-row">
              <div class="nt-fgrp"><div class="nt-fbtn" data-cmd="ul">${I.bullets}</div><div class="nt-fbtn" data-cmd="ol">${I.numbers}</div><div class="nt-fbtn" data-cmd="check">${I.checklist}</div></div>
              <div class="nt-fgrp narrow"><div class="nt-fbtn" data-cmd="outdent">${I.outdent}</div><div class="nt-fbtn" data-cmd="indent">${I.indent}</div></div>
            </div>
          </div>`);
        host.appendChild(fmt); host.appendChild(bar);

        // toolbar + popover must never take focus away from the text (selection has to survive for execCommand)
        [bar, fmt].forEach((box) => {
          box.addEventListener('mousedown', (e) => e.preventDefault());
          box.addEventListener('click', (e) => {
            const t = e.target.closest('[data-cmd],[data-block]');
            if (!t) return;
            if (t.dataset.block) { setBlock(t.dataset.block); normalize(); changed(); updateFmt(); } else doCmd(t.dataset.cmd);
          });
        });

        try { document.execCommand('defaultParagraphSeparator', false, 'div'); document.execCommand('styleWithCSS', false, false); } catch (e) {}

        ed.addEventListener('focus', () => { host.classList.add('nt-editing'); later(reveal, 340); });
        ed.addEventListener('blur', () => {
          const h = host;
          later(() => { if (document.activeElement !== ed) { h.classList.remove('nt-editing'); showFmt(false); flush(); } }, 30);
        });
        ed.addEventListener('input', (e) => {
          normalize();
          const b = curBlock();
          if (b && b.classList.contains('on') && (e.inputType === 'insertParagraph' || !b.textContent)) b.classList.remove('on');
          changed(); reveal();
        });
        ed.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { if (handleEnter()) e.preventDefault(); }
          else if (e.key === 'Backspace') { if (handleBackspace()) e.preventDefault(); }
        });
        ed.addEventListener('beforeinput', (e) => {
          if (e.inputType === 'insertParagraph') { if (handleEnter()) e.preventDefault(); }
          else if (e.inputType === 'deleteContentBackward') { if (handleBackspace()) e.preventDefault(); }
        });
        ed.addEventListener('paste', (e) => {
          e.preventDefault();
          const t = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
          if (t) exec('insertText', t);
        });
        ed.addEventListener('drop', (e) => e.preventDefault());
        // checklist circles: toggle without moving the caret or raising the keyboard
        ed.addEventListener('mousedown', (e) => { if (checkHit(e)) e.preventDefault(); });
        ed.addEventListener('click', (e) => {
          const c = checkHit(e);
          if (!c) { if (fmt.classList.contains('show')) updateFmt(); return; }
          e.preventDefault();
          c.classList.toggle('on'); c.classList.add('pop');
          later(() => c.classList.remove('pop'), 160);
          haptic('light'); changed();
        });
      },
      onShow() {
        if (!S) return;
        S.ed = api; listen(true);
        if (o.focus) { o.focus = false; later(() => { if (S.ed === api) focusEnd(); }, 420); }
      },
      onHide() {
        listen(false);
        if (ed) ed.blur();
        flush();
        if (S && S.ed === api) S.ed = null;
        if (S) purgeEmpty();
      },
    });
    // in case the nav calls render but defers onShow, make the editor reachable right away
    if (!S.ed) { S.ed = api; listen(true); }
  }

  /* ───────────────────────── app ───────────────────────── */
  OS.registerApp({
    id: 'notes',
    name: 'Notes',
    icon: {
      bg: 'linear-gradient(180deg,#FFDF5A 0%,#FFC61A 29%,#FDFDFD 29.5%,#F1F1F3 100%)',
      glyph: `<svg viewBox="0 0 60 60">
        <rect x="0" y="17.2" width="60" height="0.9" fill="rgba(0,0,0,.12)"/>
        <g fill="#B4B4BA">${Array.from({ length: 14 }, (_, i) => `<circle cx="${4.5 + i * 3.93}" cy="24.4" r="0.85"/>`).join('')}</g>
        <g stroke="#D4D4D9" stroke-width="1.1"><path d="M0 36.4h60M0 48.4h60"/></g>
      </svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg2)',

    launch(ctx) {
      S = { ctx, timers: new Set(), items: [], folders: [], prefs: {}, nav: null, ed: null, openSwipe: null, foldersPage: null, foldersWrap: null, foldersQuery: '', foldersEdit: false, onKb: null };
      loadData();
      const host = el('<div class="nt-navhost"></div>');
      ctx.root.appendChild(host);
      S.nav = OS.ui.createNav(host, { tabBarInset: false });
      S.onKb = () => later(() => { if (S.ed) S.ed.reveal(); }, 340);
      OS.on('keyboard', S.onKb);
      pushFolders();
    },

    onResume(ctx, params) {
      if (!S) return;
      if (params && params.newNote) {
        if (S.ed) S.ed.flush();
        const n = createNote('notes', params.text);
        pushEditor(n.id, { focus: true, back: undefined });
      } else if (params && params.noteId && getNote(params.noteId)) {
        pushEditor(params.noteId, {});
      }
    },

    onPause() {
      if (!S) return;
      if (S.ed) S.ed.flush();
      if (S.openSwipe && S.openSwipe._close) S.openSwipe._close();
    },

    onClose() {
      if (!S) return;
      if (S.ed) { S.ed.flush(); S.ed.listen(false); S.ed = null; }
      purgeEmpty();
      if (S.onKb) OS.off('keyboard', S.onKb);
      S.timers.forEach((id) => clearTimeout(id));
      S.timers.clear();
      S = null;
    },
  });
})();
