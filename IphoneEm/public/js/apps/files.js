/* Files — Browse / Recents, folders, tags, Recently Deleted, Quick Look text editor.
   Storage: OS.store 'files.tree' (flat node map), 'files.view' (grid/list + sort), 'files.sections', 'files.tab'. */
(function () {
  'use strict';

  const U = OS.util;
  const esc = (s) => U.esc(String(s == null ? '' : s));
  const SPRING = 'cubic-bezier(.32,.72,0,1)';
  const DAY = 864e5;
  const KEEP_DAYS = 30;

  const TAGS = [
    { id: 'red', name: 'Red', color: 'var(--red)' },
    { id: 'orange', name: 'Orange', color: 'var(--orange)' },
    { id: 'yellow', name: 'Yellow', color: 'var(--yellow)' },
    { id: 'green', name: 'Green', color: 'var(--green)' },
    { id: 'blue', name: 'Blue', color: 'var(--tint)' },
    { id: 'purple', name: 'Purple', color: 'var(--purple)' },
    { id: 'gray', name: 'Gray', color: 'var(--gray)' },
  ];
  const TAG = {}; TAGS.forEach((t) => { TAG[t.id] = t; });

  /* ───────── icons (OS css forces svg{fill:currentColor} in bars/menus → inline styles win) ───────── */
  const ST = 'style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"';
  const DOT = 'style="fill:currentColor;stroke:none"';
  const sv = (inner) => `<svg class="fl-ic" viewBox="0 0 24 24" width="22" height="22" ${ST}>${inner}</svg>`;
  const P_FOLDER = '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6a2 2 0 0 1 1.5.7l1 1.1a2 2 0 0 0 1.5.7h5.4A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>';
  const P_DOC = '<path d="M7 3h6.5L19 8.5v10a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5v-13A2.5 2.5 0 0 1 7 3z"/><path d="M13.5 3v3.5a2 2 0 0 0 2 2H19"/>';
  const P_STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
  const IC = {
    more: sv(`<circle cx="12" cy="12" r="9.5"/><circle cx="7.8" cy="12" r="1.15" ${DOT}/><circle cx="12" cy="12" r="1.15" ${DOT}/><circle cx="16.2" cy="12" r="1.15" ${DOT}/>`),
    dots: sv(`<circle cx="5.5" cy="12" r="1.6" ${DOT}/><circle cx="12" cy="12" r="1.6" ${DOT}/><circle cx="18.5" cy="12" r="1.6" ${DOT}/>`),
    info: sv(`<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.1" ${DOT}/>`),
    pencil: sv('<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19z"/>'),
    duplicate: sv('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/><path d="M14 11.5v5M11.5 14h5"/>'),
    tag: sv(`<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l6.5 6.5a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0L4.1 13.6a2 2 0 0 1-.6-1.4z"/><circle cx="8" cy="8" r="1.3" ${DOT}/>`),
    folder: sv(P_FOLDER),
    folderPlus: sv(P_FOLDER + '<path d="M12 11v5M9.5 13.5h5"/>'),
    doc: sv(P_DOC),
    docPlus: sv(P_DOC + '<path d="M11.5 12v5M9 14.5h5"/>'),
    star: sv(P_STAR),
    starSlash: sv(P_STAR + '<path d="M4 4l16 16"/>'),
    share: sv('<path d="M12 15V3.5M8 7l4-4 4 4"/><path d="M8.5 10H7a2.5 2.5 0 0 0-2.5 2.5v6A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17 10h-1.5"/>'),
    trash: sv('<path d="M4 6.5h16M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6M6 6.5l.8 12.2A2.5 2.5 0 0 0 9.3 21h5.4a2.5 2.5 0 0 0 2.5-2.3L18 6.5M10 10.5v6M14 10.5v6"/>'),
    grid: sv('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
    list: sv(`<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.2" ${DOT}/><circle cx="4.6" cy="12" r="1.2" ${DOT}/><circle cx="4.6" cy="17.5" r="1.2" ${DOT}/>`),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    recover: sv('<path d="M8 5L3.5 9.5 8 14"/><path d="M4 9.5h10.5a5 5 0 0 1 0 10H11"/>'),
    cloud: sv('<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.5 1.2A3.9 3.9 0 0 1 17.5 18.5z"/>'),
    iphone: sv('<rect x="6.5" y="2.5" width="11" height="19" rx="3"/><path d="M10.5 5.2h3"/>'),
    storage: sv('<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.3"/>'),
    eye: sv(`<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`),
    photos: sv('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3.5 16l4.8-4.8a1.5 1.5 0 0 1 2.1 0L16 16.8M14 14.5l1.7-1.7a1.5 1.5 0 0 1 2.1 0l2.7 2.7"/>'),
    sortName: sv('<path d="M4 7h10M4 12h7M4 17h4M17.5 5v14M14.5 16l3 3 3-3"/>'),
    calendar: sv('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    size: sv('<path d="M4 20V10M9.3 20V4M14.6 20v-7M20 20V8"/>'),
  };
  const CHEV = `<svg class="fl-chev" viewBox="0 0 8 13" width="8" height="13" ${ST.replace('1.8', '2')}><path d="M1.5 1.5l5 5-5 5"/></svg>`;
  const CHEV_DOWN = `<svg class="fl-secchev" viewBox="0 0 14 9" width="14" height="9" ${ST.replace('1.8', '2.4')}><path d="M1.5 1.5L7 7l5.5-5.5"/></svg>`;
  const TAB_RECENTS = '<svg viewBox="0 0 28 28"><path fill-rule="evenodd" d="M14 3a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm-1.1 4.6a1.1 1.1 0 0 1 2.2 0v5.3h4.3a1.1 1.1 0 0 1 0 2.2H14a1.1 1.1 0 0 1-1.1-1.1z"/></svg>';
  const TAB_BROWSE = '<svg viewBox="0 0 28 28"><path d="M3 8.2A3.2 3.2 0 0 1 6.2 5h4.4c.9 0 1.7.4 2.3 1l1.2 1.4c.3.4.8.6 1.3.6h6.4A3.2 3.2 0 0 1 25 11.2v8.6a3.2 3.2 0 0 1-3.2 3.2H6.2A3.2 3.2 0 0 1 3 19.8z"/></svg>';

  /* ───────── styles ───────── */
  OS.addStyle('files', `
    .app-files { background: var(--bg); color: var(--label); }
    .app-files .fl-pane { position: absolute; inset: 0; visibility: hidden; pointer-events: none; opacity: 0; transition: opacity .2s; }
    .app-files .fl-pane.on { visibility: visible; pointer-events: auto; opacity: 1; }
    .app-files .fl-ic { width: 1em; height: 1em; flex: none; }
    .app-files .fl-chev { flex: none; color: var(--label3); margin-left: 2px; }
    .app-files .fl-anchor { position: absolute; top: calc(var(--safe-top) + 34px); right: 18px; width: 1px; height: 1px; pointer-events: none; }
    .app-files .fl-wrap { min-height: 100%; }

    /* browse */
    .app-files .fl-sec { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px 9px 20px; font-size: 22px; font-weight: 700; letter-spacing: .3px; cursor: pointer; }
    .app-files .fl-sec:first-child { padding-top: 6px; }
    .app-files .fl-secchev { color: var(--tint); transition: transform .35s ${SPRING}; }
    .app-files .fl-sec.shut .fl-secchev { transform: rotate(-90deg); }
    .app-files .fl-sec:active { opacity: .6; }
    .app-files .fl-collapse { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .38s ${SPRING}, opacity .25s; }
    .app-files .fl-collapse.shut { grid-template-rows: 0fr; opacity: 0; }
    .app-files .fl-collapse-in { overflow: hidden; min-height: 0; }
    .app-files .fl-blist .ios-row + .ios-row::before { left: 57px; }
    .app-files .fl-loc-ic { width: 29px; flex: none; display: flex; align-items: center; justify-content: center; color: var(--tint); font-size: 25px; }
    .app-files .fl-tagdot { width: 13px; height: 13px; border-radius: 50%; flex: none; display: inline-block; }
    .app-files .fl-hint { color: var(--label2); font-size: 15px; white-space: normal; line-height: 20px; padding: 4px 0; }

    /* folder glyph (pure css so it can carry a gradient without svg ids) */
    .app-files .fl-folder { position: relative; display: block; width: 1.26em; height: 1em; font-size: 62px; flex: none; filter: drop-shadow(0 1px 1.5px rgba(0,40,90,.18)); }
    .app-files .fl-folder i { position: absolute; display: block; }
    .app-files .fl-folder .t { left: 0; top: 0; width: 42%; height: 40%; border-radius: .1em .12em 0 0; background: #2A93EC; transform-origin: 0 100%; }
    .app-files .fl-folder .t::after { content: ''; position: absolute; right: -.11em; top: 0; width: .22em; height: 100%; background: #2A93EC; transform: skewX(32deg); border-radius: 0 .08em 0 0; }
    .app-files .fl-folder .b { left: 0; right: 0; top: .12em; bottom: 0; border-radius: .1em; background: #2A93EC; }
    .app-files .fl-folder .f { left: 0; right: 0; top: .23em; bottom: 0; border-radius: .07em .07em .1em .1em; background: linear-gradient(180deg, #8AD6FE 0%, #5BBEFA 45%, #3FA9F5 100%); box-shadow: inset 0 .6px 0 rgba(255,255,255,.65); }
    .app-files .fl-folder.s-list { font-size: 34px; }
    .app-files .fl-folder.s-row { font-size: 22px; filter: none; }
    .app-files .fl-folder.s-big { font-size: 92px; }

    /* doc + image thumbs (paper stays white in dark mode, like iOS) */
    .app-files .fl-doc { position: relative; display: block; width: 3.85em; height: 5em; font-size: 14.5px; flex: none; background: #fff; border-radius: .22em; overflow: hidden;
      box-shadow: 0 0 0 .5px rgba(0,0,0,.2), 0 1.5px 4px rgba(0,0,0,.14); text-align: left; }
    .app-files .fl-doc-tx { position: absolute; inset: .42em .38em .3em; font-size: .35em; line-height: 1.32; color: #2c2c2e; white-space: pre-wrap; word-break: break-word; overflow: hidden; font-weight: 500; letter-spacing: 0; }
    .app-files .fl-doc.s-list { font-size: 8.4px; }
    .app-files .fl-doc.s-big { font-size: 22px; }
    .app-files .fl-shot { display: block; height: 72px; width: auto; max-width: 100px; border-radius: 4px; object-fit: cover; box-shadow: 0 0 0 .5px rgba(0,0,0,.2), 0 1.5px 4px rgba(0,0,0,.14); flex: none; -webkit-user-drag: none; }
    .app-files .fl-shot.s-list { height: 42px; max-width: 42px; border-radius: 3px; }
    .app-files .fl-shot.s-big { height: 120px; max-width: 160px; border-radius: 6px; }

    /* grid */
    .app-files .fl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 4px; padding: 8px 10px 0; }
    .app-files .fl-cell { display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; padding: 4px 2px 2px; min-width: 0;
      transition: transform .32s ${SPRING}, opacity .25s; -webkit-user-select: none; user-select: none; }
    .app-files .fl-thumb { height: 80px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 7px; transition: filter .15s, transform .3s ${SPRING}; }
    .app-files .fl-cell:active .fl-thumb { filter: brightness(.78); transform: scale(.96); }
    .app-files .fl-name { font-size: 13px; line-height: 16px; letter-spacing: -.08px; max-width: 112px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
    .app-files .fl-name .fl-tagdot, .app-files .fl-lname .fl-tagdot { width: 8px; height: 8px; margin-right: 3px; vertical-align: 1px; }
    .app-files .fl-name .fl-tagdot + .fl-tagdot, .app-files .fl-lname .fl-tagdot + .fl-tagdot { margin-left: -5px; box-shadow: 0 0 0 1px var(--bg); }
    .app-files .fl-sub { font-size: 11px; line-height: 14px; color: var(--label2); margin-top: 1px; max-width: 112px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-files .fl-gone { transform: scale(.55) !important; opacity: 0 !important; }
    .app-files .fl-new { animation: fl-pop .42s ${SPRING} both; }
    @keyframes fl-pop { 0% { transform: scale(.5); opacity: 0; } 100% { transform: none; opacity: 1; } }

    /* list */
    .app-files .fl-rows { padding-top: 2px; }
    .app-files .fl-lrow { display: flex; align-items: center; gap: 12px; padding-left: 16px; min-height: 62px; cursor: pointer; transition: transform .32s ${SPRING}, opacity .25s, background .15s; -webkit-user-select: none; user-select: none; }
    .app-files .fl-lrow:active { background: var(--fill2); }
    .app-files .fl-lthumb { width: 44px; flex: none; display: flex; align-items: center; justify-content: center; }
    .app-files .fl-lmain { flex: 1; min-width: 0; align-self: stretch; display: flex; align-items: center; gap: 8px; padding-right: 14px; border-bottom: .5px solid var(--sep); }
    .app-files .fl-lrow:last-child .fl-lmain { border-bottom-color: transparent; }
    .app-files .fl-ltext { flex: 1; min-width: 0; }
    .app-files .fl-lname { font-size: 17px; letter-spacing: -.4px; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-files .fl-lsub { font-size: 13px; line-height: 17px; letter-spacing: -.08px; color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-files .fl-more { flex: none; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: var(--tint); font-size: 20px; border-radius: 50%; }
    .app-files .fl-more:active { background: var(--fill); }

    .app-files .fl-foot { text-align: center; font-size: 13px; letter-spacing: -.08px; color: var(--label2); padding: 26px 24px 8px; line-height: 18px; }
    .app-files .fl-empty { min-height: 430px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 44px; }
    .app-files .fl-empty b { font-size: 22px; font-weight: 700; color: var(--label2); letter-spacing: .3px; }
    .app-files .fl-empty span { font-size: 15px; line-height: 20px; color: var(--label2); margin-top: 6px; letter-spacing: -.2px; }

    /* quick look */
    .app-files .fl-edit { display: block; width: 100%; height: calc(874px - var(--safe-top) - 44px - max(var(--kb-h, 0px), 95px) - 30px); border: 0; outline: none; resize: none; background: transparent; color: var(--label);
      font-family: inherit; font-size: 17px; line-height: 24px; letter-spacing: -.4px; padding: 10px 18px 6px; caret-color: var(--tint); scrollbar-width: none; }
    .app-files .fl-edit::-webkit-scrollbar { display: none; }
    .app-files .fl-edit::placeholder { color: var(--label3); }
    .app-files .fl-status { height: 30px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; font-size: 12px; color: var(--label2); border-top: .5px solid var(--sep); }
    .app-files .fl-status i { font-style: normal; transition: opacity .2s; }
    .app-files .fl-ql { height: calc(874px - var(--safe-top) - 44px - 95px - 8px); display: flex; align-items: center; justify-content: center; padding: 12px 20px; }
    .app-files .fl-ql img { max-width: 100%; max-height: 100%; border-radius: 14px; box-shadow: 0 6px 30px rgba(0,0,0,.25), 0 0 0 .5px var(--sep); animation: fl-pop .45s ${SPRING} both; -webkit-user-drag: none; }
  `);

  /* Sheets render outside ctx.root, so their styles are scoped by a class we put on the sheet body instead. */
  OS.addStyle('files-sheet', `
    .fl-sheet { padding-top: 4px; }
    .fl-sheet .fl-ic { width: 1em; height: 1em; flex: none; }
    .fl-sheet .fl-sheet-msg { text-align: center; font-size: 13px; color: var(--label2); padding: 2px 32px 14px; line-height: 18px; }
    .fl-sheet .fl-tagdot { width: 14px; height: 14px; border-radius: 50%; flex: none; display: inline-block; }
    .fl-sheet .fl-tagdot.sm { width: 9px; height: 9px; margin-right: 4px; }
    .fl-sheet .fl-ck { color: var(--tint); font-size: 20px; display: flex; opacity: 0; transform: scale(.4); transition: opacity .2s, transform .3s ${SPRING}; }
    .fl-sheet .on > .fl-ck { opacity: 1; transform: none; }
    .fl-sheet .fl-mv { cursor: pointer; }
    .fl-sheet .fl-mv.off { opacity: .35; pointer-events: none; }
    .fl-sheet .fl-mv .fl-mv-ic { color: var(--tint); font-size: 23px; display: flex; flex: none; }
    .fl-sheet .fl-info-top { display: flex; flex-direction: column; align-items: center; padding: 6px 24px 20px; text-align: center; }
    .fl-sheet .fl-info-top b { font-size: 20px; font-weight: 700; margin-top: 14px; letter-spacing: .2px; word-break: break-word; }
    .fl-sheet .fl-info-top span { font-size: 15px; color: var(--label2); margin-top: 3px; }
    .fl-sheet .fl-info-thumb { height: 124px; display: flex; align-items: flex-end; justify-content: center; }
    .fl-sheet .fl-folder { position: relative; display: block; width: 1.26em; height: 1em; font-size: 92px; flex: none; filter: drop-shadow(0 1px 1.5px rgba(0,40,90,.18)); }
    .fl-sheet .fl-folder i { position: absolute; display: block; }
    .fl-sheet .fl-folder .t { left: 0; top: 0; width: 42%; height: 40%; border-radius: .1em .12em 0 0; background: #2A93EC; }
    .fl-sheet .fl-folder .t::after { content: ''; position: absolute; right: -.11em; top: 0; width: .22em; height: 100%; background: #2A93EC; transform: skewX(32deg); border-radius: 0 .08em 0 0; }
    .fl-sheet .fl-folder .b { left: 0; right: 0; top: .12em; bottom: 0; border-radius: .1em; background: #2A93EC; }
    .fl-sheet .fl-folder .f { left: 0; right: 0; top: .23em; bottom: 0; border-radius: .07em .07em .1em .1em; background: linear-gradient(180deg, #8AD6FE 0%, #5BBEFA 45%, #3FA9F5 100%); box-shadow: inset 0 .6px 0 rgba(255,255,255,.65); }
    .fl-sheet .fl-doc { position: relative; display: block; width: 3.85em; height: 5em; font-size: 22px; background: #fff; border-radius: .22em; overflow: hidden; box-shadow: 0 0 0 .5px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.16); text-align: left; }
    .fl-sheet .fl-doc-tx { position: absolute; inset: .42em .38em .3em; font-size: .35em; line-height: 1.32; color: #2c2c2e; white-space: pre-wrap; word-break: break-word; overflow: hidden; font-weight: 500; }
    .fl-sheet .fl-shot { display: block; height: 120px; width: auto; max-width: 160px; border-radius: 6px; object-fit: cover; box-shadow: 0 0 0 .5px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.16); }
    .fl-sheet .fl-sheet-pad { height: 28px; }
  `);

  /* ───────── state ───────── */
  let S = null;

  function later(fn, ms) {
    if (!S) return 0;
    const token = S;
    const t = setTimeout(() => { token.timers.delete(t); if (S === token) fn(); }, ms);
    S.timers.add(t);
    return t;
  }

  /* ───────── tree model ───────── */
  const nodes = () => S.tree.nodes;
  const getNode = (id) => (S && S.tree.nodes[id]) || null;
  const children = (id) => Object.values(nodes()).filter((n) => n.parent === id);
  function descendants(id) {
    const out = []; const walk = (pid) => children(pid).forEach((c) => { out.push(c); if (c.type === 'folder') walk(c.id); });
    walk(id); return out;
  }
  function inTrash(n) {
    let cur = n, guard = 0;
    while (cur && cur.parent && guard++ < 64) { if (cur.parent === 'trash') return true; cur = getNode(cur.parent); }
    return false;
  }
  function rootOf(id) {
    let cur = getNode(id), guard = 0;
    while (cur && cur.parent && guard++ < 64) cur = getNode(cur.parent);
    return cur ? cur.id : 'icloud';
  }
  function pathOf(id) {
    const parts = []; let cur = getNode(id), guard = 0;
    while (cur && guard++ < 64) { parts.unshift(cur.name); cur = cur.parent ? getNode(cur.parent) : null; }
    return parts.join(' ▸ ');
  }
  function itemCount(n) { return n.virtual === 'screenshots' ? S.shots.length : children(n.id).length; }
  function sizeOf(n) {
    if (n.type === 'shot') return n.bytes || 0;
    if (n.type !== 'folder') return (n.content || '').length;
    if (n.virtual === 'screenshots') return S.shots.reduce((a, s) => a + (s.bytes || 0), 0);
    return descendants(n.id).reduce((a, d) => a + (d.type === 'folder' ? 0 : (d.content || '').length), 0);
  }
  function uniqueName(parent, name, exceptId) {
    const taken = new Set(children(parent).filter((n) => n.id !== exceptId).map((n) => n.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    let i = 2; while (taken.has((name + ' ' + i).toLowerCase())) i++;
    return name + ' ' + i;
  }
  const cleanName = (s, fallback) => (String(s == null ? '' : s).replace(/[\/\\:\n\r]/g, ' ').trim().slice(0, 60)) || fallback;
  function getItem(id) {
    if (typeof id === 'string' && id.indexOf('shot:') === 0) return S.shots.find((s) => s.id === id) || null;
    return getNode(id);
  }
  function persist() { try { OS.store.set('files.tree', S.tree); } catch (e) { /* quota — keep going in memory */ } }
  function commit() { persist(); refreshAll(); }
  function savePrefs() { OS.store.set('files.view', S.prefs); }

  function registerView(body, refresh) { S.views.add({ body, refresh }); }
  function refreshAll() {
    if (!S) return;
    [...S.views].forEach((v) => {
      if (!v.body.isConnected) { S.views.delete(v); return; }
      try { v.refresh(); } catch (e) { /* a stale page must never break the others */ }
    });
  }

  function loadTree() {
    let t = OS.store.get('files.tree', null);
    if (!t || typeof t !== 'object' || !t.nodes || !t.nodes.icloud || !t.nodes.local || !t.nodes.trash) { t = seedTree(); OS.store.set('files.tree', t); return t; }
    // purge Recently Deleted items older than 30 days
    const now = Date.now(); let changed = false;
    Object.values(t.nodes).filter((n) => n.parent === 'trash' && n.deletedAt && now - n.deletedAt > KEEP_DAYS * DAY).forEach((n) => {
      const kill = (id) => { Object.values(t.nodes).filter((c) => c.parent === id).forEach((c) => kill(c.id)); delete t.nodes[id]; };
      kill(n.id); changed = true;
    });
    if (changed) OS.store.set('files.tree', t);
    return t;
  }

  function seedTree() {
    const now = Date.now();
    const t = { v: 1, nodes: {} };
    const add = (parent, name, type, daysAgo, content, extra) => {
      const id = U.uid();
      const when = Math.round(now - daysAgo * DAY);
      t.nodes[id] = Object.assign({ id, name, type, parent, created: when - (type === 'folder' ? 20 : 2) * DAY, modified: when, tags: [] }, type === 'txt' ? { content: content || '' } : {}, extra || {});
      return id;
    };
    t.nodes.icloud = { id: 'icloud', name: 'iCloud Drive', type: 'folder', parent: null, created: now - 400 * DAY, modified: now, tags: [] };
    t.nodes.local = { id: 'local', name: 'On My iPhone', type: 'folder', parent: null, created: now - 400 * DAY, modified: now, tags: [] };
    t.nodes.trash = { id: 'trash', name: 'Recently Deleted', type: 'folder', parent: null, created: now - 400 * DAY, modified: now, tags: [] };

    const dl = add('icloud', 'Downloads', 'folder', 1.2, null, { fav: true });
    const school = add('icloud', 'School', 'folder', 0.9, null, { tags: ['green'] });
    const games = add('icloud', 'Game Projects', 'folder', 0.12, null, { fav: true, tags: ['blue'] });
    const docs = add('icloud', 'Documents', 'folder', 6);

    add('icloud', 'Read Me First', 'txt', 40,
`Hi future me,

This is where all the important stuff lives.

- Game Projects = game ideas + bug lists. DO NOT DELETE.
- School = homework and study notes
- Downloads = random stuff, clean out once a month (lol, sure)

If the iPad says storage is full, it's probably Downloads again.`);

    add(dl, 'Minecraft Seeds', 'txt', 1.2,
`MINECRAFT SEEDS TO TRY (Bedrock)

-1718501946 — village + ruined portal right at spawn
542630838 — mushroom island 300 blocks east
2111844826 — mansion next to spawn, cherry grove behind it
-78688046 — ancient city under spawn, DON'T dig straight down

Jake's realm seed: ask him again, I lost it

Diamond level: Y -58 (bring a water bucket!!)`);
    add(dl, 'Blender Shortcuts', 'txt', 9,
`BLENDER SHORTCUTS I KEEP FORGETTING

G = grab / move
R = rotate
S = scale
Tab = edit mode
E = extrude
Ctrl+R = loop cut
Shift+A = add mesh
X = delete
Numpad 1 / 3 / 7 = front / side / top view
Shift+D = duplicate
Ctrl+Z = undo (most used key)

Low-poly tip: keep everything under 500 triangles, flat shading, one colour palette texture.`);
    add(dl, 'Sprite Pack Credits', 'txt', 16,
`Tiny Dungeon Sprite Pack — 16x16
License: free to use, credit appreciated

Credit line to put on the title screen:
"Tiles by PixelMoth, sounds made with a kazoo and a cardboard box"

Files:
- tiles_floor.png
- tiles_walls.png
- hero_cat_walk (4 frames)
- slime_bounce (6 frames)`);

    add(school, 'Science Fair Plan', 'txt', 0.9,
`SCIENCE FAIR — Which paper airplane flies farthest?

Question: Does wing shape change how far a paper airplane flies?

Hypothesis: The long skinny "dart" will fly farthest because it has less drag.

Materials
- 12 sheets of printer paper (same kind!)
- tape measure
- masking tape for the launch line
- notebook

Steps
1. Fold 3 designs: Dart, Glider, Stunt
2. Throw each one 10 times from the same line
3. Measure every throw in cm
4. Find the average for each design
5. Make a bar graph

Results so far
Dart: 742, 801, 655, 790
Glider: 610, 702, 688
Stunt: 300 (it did a loop and hit the dog)

Due: October 9. Poster board is in the closet.`, { tags: ['red'] });
    add(school, 'Book Report - Hatchet', 'txt', 4,
`Book Report: Hatchet by Gary Paulsen

Main character: Brian Robeson, 13 years old.

Summary: Brian is flying in a small plane to visit his dad when the pilot has a heart attack. Brian crash-lands in a lake in the Canadian wilderness. All he has is the hatchet his mom gave him. He has to figure out fire, food and shelter by himself.

My favorite part: when he figures out that hitting the hatchet on the rock makes sparks. He calls the fire his friend.

Theme: Don't give up, and feeling sorry for yourself doesn't work.

Rating: 9/10. I would not survive. I would last maybe 2 days.`);
    add(school, 'Spelling Words Week 4', 'txt', 2.5,
`Spelling — Week 4 (test Friday)

1. necessary
2. rhythm
3. separate
4. definitely
5. embarrass
6. occurred
7. privilege
8. weird
9. calendar
10. restaurant

Bonus: onomatopoeia

Trick: "neCeSSary" = one Collar, two Sleeves`, { tags: ['yellow'] });
    const math = add(school, 'Math', 'folder', 3);
    add(math, 'Multiplication Tricks', 'txt', 3,
`MULTIPLICATION TRICKS

x9: hold up 10 fingers, put down the finger you're multiplying by. Left side = tens, right side = ones.
x11: for 2-digit numbers add the digits and put it in the middle. 11 x 34 = 3 (3+4) 4 = 374
x5: half the number, then x10. 5 x 18 = 9 x 10 = 90
x4: double it twice
x12: x10 plus x2

Squares to memorize: 11=121, 12=144, 13=169, 14=196, 15=225`);
    add(math, 'Fractions Homework', 'txt', 5,
`Fractions p. 88 — #1-12 evens

2) 3/4 + 1/8 = 6/8 + 1/8 = 7/8
4) 2/3 - 1/6 = 4/6 - 1/6 = 3/6 = 1/2
6) 5/6 + 1/4 = 10/12 + 3/12 = 13/12 = 1 1/12
8) 7/10 - 2/5 = 7/10 - 4/10 = 3/10
10) ask about this one
12) 1/2 + 1/3 + 1/6 = 1 (cool)`);

    add(games, 'Dungeon Cat - Design Doc', 'txt', 0.12,
`DUNGEON CAT — Design Doc v3

Pitch: You are a cat. The dungeon is full of yarn monsters. Get to floor 10 and steal the Golden Tuna.

CONTROLS
- Arrow keys / left stick: move
- Z / A button: scratch attack
- X / B button: dash (0.8s cooldown)
- Hold down on a box: hide in it (enemies lose you)

ENEMIES
1. Yarn Blob — 2 HP, slow, splits into 2 minis
2. Vacuum — charges in a straight line. Dash away so it hits the wall and gets stunned
3. Laser Dot — can't be hurt, just leads you into traps (rude)
4. BOSS floor 5: The Dog. 30 HP. Barks = shockwave, jump over it

ITEMS
- Catnip: 2x speed for 6 seconds, screen goes wobbly
- Cardboard Box: portable hiding spot
- Fish Bone: throwable, 1 dmg
- 9 Lives Charm: revive once per run

TODO
- make floors random (rooms are 12x8 tiles)
- save high score
- ask Mia to draw the boss`, { tags: ['blue', 'red'] });
    add(games, 'Bug List', 'txt', 0.4,
`BUG LIST

[ ] cat can dash through locked doors (kind of fun? keep??)
[ ] score resets to 0 when you pause
[x] vacuum enemy gets stuck in corners — fixed, it turns around now
[ ] music plays twice if you die fast enough
[ ] player 2 controller only works if it's plugged in first
[x] yarn blobs spawning inside walls
[ ] game over screen says "Yuo died"

Found by Mia: if you hide in a box on the stairs you fall out of the world.`, { tags: ['orange'] });
    add(games, 'Level Ideas', 'txt', 2,
`LEVEL IDEAS

Floor 1-2: Basement. Boxes everywhere, teaches hiding.
Floor 3: Laundry room. Conveyor belts, socks that fall on you.
Floor 4: Kitchen. Floor is slippery, fridge door opens and blows cold air that pushes you.
Floor 5: BOSS — The Dog, in the backyard.
Floor 6-7: Attic. Dark, you only see a circle around the cat. Bats.
Floor 8: Bathtub level. Water rises!! Cats hate water so it does damage.
Floor 9: The Vet. Scariest level.
Floor 10: Golden Tuna vault. Laser maze.

Secret level: inside the couch. Coins everywhere.`);
    const art = add(games, 'Pixel Art', 'folder', 7);
    add(art, 'Palette', 'txt', 7,
`DUNGEON CAT PALETTE (8 colours only!)

#1a1c2c  night (outlines)
#5d275d  dungeon purple
#b13e53  yarn red
#ef7d57  cat orange
#ffcd75  tuna gold
#a7f070  slime green
#41a6f6  water
#f4f4f4  white

Rule: sprites are 16x16, 1px outline, light comes from top-left.`);
    const sfx = add(games, 'Sound Effects', 'folder', 11);
    add(sfx, 'SFX To-Do', 'txt', 11,
`SFX TO RECORD

- meow (attack) — record Biscuit when she's hungry
- hiss (hurt)
- purr (health pickup)
- box rustle
- vacuum = actual vacuum, record from far away
- boss bark = pitch MY voice down
- coin = tap a glass with a spoon

Export all as .wav, 44.1k, trim silence.`);

    add(docs, 'Camping Packing List', 'txt', 6,
`CAMPING — Pine Hollow, 2 nights

Clothes
- 3 shirts, 2 pants, hoodie
- rain jacket
- extra socks x4 (socks ALWAYS get wet)

Gear
- sleeping bag + pillow
- flashlight + extra batteries
- pocket knife (Dad carries it)
- water bottle
- bug spray

Fun
- cards
- football
- marshmallow sticks
- NO tablet (Mom's rule)`);
    add(docs, 'Birthday Wish List', 'txt', 13,
`BIRTHDAY WISH LIST

1. Xbox controller (the blue one)
2. Drawing tablet for pixel art
3. LEGO plane set
4. New bike helmet
5. Gift card for game coins
6. A real cat (long shot)

Party idea: laser tag, then pizza, then everybody tests my game.`, { tags: ['purple'] });

    add('local', 'Screenshots', 'folder', 0.5, null, { virtual: 'screenshots' });
    const beat = add('local', 'Beat Maker', 'folder', 8);
    add(beat, 'Song Ideas', 'txt', 8,
`SONG IDEAS

Title theme: 120 bpm, C minor, sneaky bass line — dun dun da-dun
Boss music: same melody but FAST and with drums
Shop music: bossa nova?? cats like jazz
Game over: sad trombone, 2 seconds

Remember: loops have to be exactly 8 or 16 bars or they click.`);
    const bak = add('local', 'Scratch Backups', 'folder', 20);
    add(bak, 'Backup Log', 'txt', 20,
`Backups of my Scratch projects

Aug 31 — Dungeon Cat v0.7 (before I broke the dash)
Aug 24 — Plane Game v12
Aug 10 — Platformer test
Jul 29 — Dungeon Cat v0.5

Do a backup every Sunday.`);

    const old1 = add('trash', 'old level ideas', 'txt', 30,
`floor 1: lava?? (too hard)
floor 2: more lava
floor 3: ok maybe not lava`);
    t.nodes[old1].deletedAt = now - 3 * DAY; t.nodes[old1].deletedFrom = games;
    const old2 = add('trash', 'Untitled 4', 'txt', 45, 'asdfghjkl test test');
    t.nodes[old2].deletedAt = now - 12 * DAY; t.nodes[old2].deletedFrom = dl;
    return t;
  }

  /* ───────── formatting ───────── */
  function fmtTime(d) { const ap = U.ampm(d); return U.time(d) + (ap ? ' ' + ap : ''); }
  function fmtDate(ts) {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return fmtTime(d);
    if (d.toDateString() === new Date(now.getTime() - DAY).toDateString()) return 'Yesterday';
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  }
  function fmtLong(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' at ' + fmtTime(d);
  }
  function fmtSize(b) {
    if (!b) return 'Zero KB';
    if (b < 1000) return b + ' bytes';
    if (b < 1e6) return Math.max(1, Math.round(b / 1000)) + ' KB';
    return (b / 1e6).toFixed(1) + ' MB';
  }
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const kindOf = (it) => (it.type === 'folder' ? 'Folder' : it.type === 'shot' ? 'PNG Image' : 'Plain Text Document');
  function whereOf(it) {
    if (it.type === 'shot') { const f = Object.values(nodes()).find((n) => n.virtual === 'screenshots'); return f ? pathOf(f.id) : 'On My iPhone'; }
    return it.parent ? pathOf(it.parent) : '';
  }
  function shortWhere(it) {
    if (it.type === 'shot') return 'Screenshots';
    const p = getNode(it.parent); return p ? p.name : '';
  }

  /* ───────── screenshots from Photos (virtual, read-only) ───────── */
  function loadShots() {
    if (!S || !OS.photos || typeof OS.photos.all !== 'function') return;
    const token = S;
    let p; try { p = OS.photos.all(); } catch (e) { return; }
    Promise.resolve(p).then((list) => {
      if (S !== token) return;
      const raw = (Array.isArray(list) ? list : []).filter((x) => x && x.kind === 'screenshot' && x.src);
      raw.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      const sig = raw.map((x) => x.id).join(',');
      if (sig === S.shotSig) return;
      S.urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} }); S.urls = [];
      S.shots = raw.map((x, i) => {
        let src = x.src, bytes = 0;
        if (typeof src !== 'string') { bytes = src.size || 0; try { src = URL.createObjectURL(src); S.urls.push(src); } catch (e) { src = ''; } }
        else bytes = Math.round(src.length * 0.75);
        const when = new Date(x.date || Date.now()).getTime() || Date.now();
        return { id: 'shot:' + x.id, photoId: x.id, type: 'shot', virtual: true, name: 'IMG_' + String(1001 + i).padStart(4, '0'), src, bytes, created: when, modified: when, tags: [] };
      }).filter((s) => s.src);
      S.shotSig = sig;
      refreshAll();
    }).catch(() => { /* Photos unavailable — the folder just stays empty */ });
  }

  /* ───────── item rendering ───────── */
  function thumbHTML(it, size) {
    const c = size ? ' s-' + size : '';
    if (it.type === 'folder') return `<span class="fl-folder${c}"><i class="t"></i><i class="b"></i><i class="f"></i></span>`;
    if (it.type === 'shot') return `<img class="fl-shot${c}" src="${esc(it.src)}" alt="" draggable="false">`;
    return `<span class="fl-doc${c}"><span class="fl-doc-tx">${esc((it.content || '').slice(0, 320))}</span></span>`;
  }
  const dotsHTML = (it) => (it.tags || []).filter((t) => TAG[t]).map((t) => `<i class="fl-tagdot" style="background:${TAG[t].color}"></i>`).join('');
  function daysLeft(it) { return Math.max(0, KEEP_DAYS - Math.floor((Date.now() - (it.deletedAt || Date.now())) / DAY)); }

  function sortItems(items, sort) {
    const arr = items.slice();
    if (sort === 'date') arr.sort((a, b) => b.modified - a.modified);
    else if (sort === 'size') arr.sort((a, b) => sizeOf(b) - sizeOf(a) || a.name.localeCompare(b.name));
    else arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return arr;
  }

  /* opts: { nav, mode, where, trash, empty:{title,sub}, footer } */
  function renderItems(wrap, items, opts) {
    if (!items.length) {
      wrap.innerHTML = `<div class="fl-empty"><b>${esc(opts.empty.title)}</b>${opts.empty.sub ? `<span>${esc(opts.empty.sub)}</span>` : ''}</div>`;
      return;
    }
    const mode = opts.mode || S.prefs.mode;
    const flash = S.flashId;
    let html;
    if (mode === 'grid') {
      html = '<div class="fl-grid">' + items.map((it) => {
        let sub, sub2 = '';
        if (opts.trash) { sub = plural(daysLeft(it), 'day'); }
        else if (it.type === 'folder') { sub = plural(itemCount(it), 'item'); }
        else { sub = fmtDate(it.modified); sub2 = opts.where ? shortWhere(it) : fmtSize(sizeOf(it)); }
        return `<div class="fl-cell${it.id === flash ? ' fl-new' : ''}" data-id="${esc(it.id)}"><div class="fl-thumb">${thumbHTML(it, '')}</div>
          <div class="fl-name">${dotsHTML(it)}${esc(it.name)}</div><div class="fl-sub">${esc(sub)}</div>${sub2 ? `<div class="fl-sub">${esc(sub2)}</div>` : ''}</div>`;
      }).join('') + '</div>';
    } else {
      html = '<div class="fl-rows">' + items.map((it) => {
        let sub;
        if (opts.trash) sub = plural(daysLeft(it), 'day') + ' remaining';
        else if (it.type === 'folder') sub = plural(itemCount(it), 'item');
        else sub = fmtDate(it.modified) + ' – ' + fmtSize(sizeOf(it));
        if (opts.where && !opts.trash) sub = (it.type === 'folder' ? '' : fmtDate(it.modified) + ' – ') + whereOf(it);
        return `<div class="fl-lrow${it.id === flash ? ' fl-new' : ''}" data-id="${esc(it.id)}"><div class="fl-lthumb">${thumbHTML(it, 'list')}</div>
          <div class="fl-lmain"><div class="fl-ltext"><div class="fl-lname">${dotsHTML(it)}${esc(it.name)}</div><div class="fl-lsub">${esc(sub)}</div></div>
          <span class="fl-more">${IC.dots}</span>${it.type === 'folder' && !opts.trash ? CHEV : ''}</div></div>`;
      }).join('') + '</div>';
    }
    if (opts.footer) html += `<div class="fl-foot">${esc(opts.footer)}</div>`;
    wrap.innerHTML = html;
    if (flash) later(() => { if (S.flashId === flash) S.flashId = null; }, 600);

    wrap.querySelectorAll('[data-id]').forEach((el) => {
      const id = el.getAttribute('data-id');
      const anchor = () => el.querySelector('.fl-thumb > *, .fl-lthumb > *') || el;
      el.addEventListener('pointerdown', (e) => { el._lp = false; el._sx = e.clientX; el._sy = e.clientY; });
      el.addEventListener('click', (e) => {
        if (el._lp) { el._lp = false; return; }
        if (Math.hypot(e.clientX - el._sx, e.clientY - el._sy) > 10) return;   // it was a scroll-drag, not a tap
        const it = getItem(id); if (!it) return;
        const more = e.target.closest && e.target.closest('.fl-more');
        if (more) { itemMenu(more, it, opts); return; }
        openItem(it, opts);
      });
      U.longPress(el, () => { const it = getItem(id); if (!it) return; el._lp = true; OS.haptic('medium'); itemMenu(anchor(), it, opts); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); const it = getItem(id); if (it) itemMenu(anchor(), it, opts); });
    });
  }

  function openItem(it, opts) {
    if (opts.trash) { trashChoice(it); return; }
    if (it.type === 'folder') pushFolder(opts.nav, it.id);
    else if (it.type === 'shot') pushImage(opts.nav, it);
    else pushEditor(opts.nav, it.id);
  }

  /* ───────── menus & actions ───────── */
  function anchorFor(arg, page) {
    if (arg && arg.nodeType === 1) return arg;
    if (arg && arg.currentTarget && arg.currentTarget.nodeType === 1) return arg.currentTarget;
    const host = (page && page.el) || S.root;
    const btns = host.querySelectorAll('.nv-side.right .nv-btn');
    if (btns.length) return btns[btns.length - 1];
    let a = host.querySelector('.fl-anchor');
    if (!a) { a = U.el('<i class="fl-anchor"></i>'); host.appendChild(a); }
    return a;
  }

  function itemMenu(anchor, it, opts) {
    let items;
    if (opts.trash) {
      items = [
        { label: 'Recover', icon: IC.recover, onTap: () => recoverItem(it.id) },
        { label: 'Get Info', icon: IC.info, onTap: () => infoSheet(it) },
        { label: 'Delete Now', icon: IC.trash, style: 'destructive', onTap: () => deleteNow(it.id, true) },
      ];
    } else if (it.type === 'shot') {
      items = [
        { label: 'Quick Look', icon: IC.eye, onTap: () => pushImage(opts.nav, it) },
        { label: 'Get Info', icon: IC.info, onTap: () => infoSheet(it) },
      ];
      if (OS.isInstalled && OS.isInstalled('photos')) items.push({ label: 'Show in Photos', icon: IC.photos, onTap: () => OS.openApp('photos') });
    } else if (it.virtual) {
      items = [
        { label: 'Get Info', icon: IC.info, onTap: () => infoSheet(it) },
        { label: it.fav ? 'Unfavorite' : 'Favorite', icon: it.fav ? IC.starSlash : IC.star, onTap: () => toggleFav(it.id) },
      ];
    } else {
      items = [
        { label: 'Get Info', icon: IC.info, onTap: () => infoSheet(it) },
        { label: 'Rename', icon: IC.pencil, onTap: () => renameItem(it.id) },
        { label: 'Duplicate', icon: IC.duplicate, onTap: () => duplicateItem(it.id) },
        { label: 'Tags', icon: IC.tag, onTap: () => tagSheet(it.id) },
        { label: 'Move', icon: IC.folder, onTap: () => moveSheet(it.id) },
      ];
      if (it.type === 'folder') items.push({ label: it.fav ? 'Unfavorite' : 'Favorite', icon: it.fav ? IC.starSlash : IC.star, onTap: () => toggleFav(it.id) });
      else items.push({ label: 'Share', icon: IC.share, onTap: () => shareItem(it.id) });
      items.push({ label: 'Delete', icon: IC.trash, style: 'destructive', onTap: () => deleteItem(it.id) });
    }
    OS.ui.contextMenu(anchor, items);
  }

  function viewMenuItems() {
    const p = S.prefs;
    const set = (k, v) => () => { p[k] = v; savePrefs(); OS.haptic('selection'); refreshAll(); };
    return [
      { label: 'Icons', icon: p.mode === 'grid' ? IC.check : IC.grid, onTap: set('mode', 'grid') },
      { label: 'List', icon: p.mode === 'list' ? IC.check : IC.list, onTap: set('mode', 'list') },
    ];
  }
  function sortMenuItems() {
    const p = S.prefs;
    const set = (v) => () => { p.sort = v; savePrefs(); OS.haptic('selection'); refreshAll(); };
    return [
      { label: 'Sort by Name', icon: p.sort === 'name' ? IC.check : IC.sortName, onTap: set('name') },
      { label: 'Sort by Date', icon: p.sort === 'date' ? IC.check : IC.calendar, onTap: set('date') },
      { label: 'Sort by Size', icon: p.sort === 'size' ? IC.check : IC.size, onTap: set('size') },
    ];
  }

  function folderMenu(anchor, id, nav) {
    const node = getNode(id); if (!node) return;
    let items = [];
    if (id === 'trash') {
      if (children('trash').length) {
        items.push({ label: 'Recover All', icon: IC.recover, onTap: recoverAll });
        items.push({ label: 'Delete All', icon: IC.trash, style: 'destructive', onTap: deleteAll });
      }
    } else if (!node.virtual) {
      items.push({ label: 'New Folder', icon: IC.folderPlus, onTap: () => newFolder(id) });
      items.push({ label: 'New Text File', icon: IC.docPlus, onTap: () => newTextFile(id, nav) });
    }
    items = items.concat(viewMenuItems());
    if (id !== 'trash') items = items.concat(sortMenuItems());
    OS.ui.contextMenu(anchor, items);
  }

  async function newFolder(parentId) {
    const name = await OS.ui.prompt({ title: 'New Folder', message: 'Enter a name for this folder.', placeholder: 'untitled folder', value: 'untitled folder', okLabel: 'Save' });
    if (name == null || !S || !getNode(parentId)) return;
    const id = U.uid(), now = Date.now();
    nodes()[id] = { id, name: uniqueName(parentId, cleanName(name, 'untitled folder')), type: 'folder', parent: parentId, created: now, modified: now, tags: [] };
    touch(parentId); S.flashId = id; OS.haptic('light'); commit();
  }
  async function newTextFile(parentId, nav) {
    const name = await OS.ui.prompt({ title: 'New Text File', message: 'Enter a name for this document.', placeholder: 'Untitled', value: 'Untitled', okLabel: 'Create' });
    if (name == null || !S || !getNode(parentId)) return;
    const id = U.uid(), now = Date.now();
    nodes()[id] = { id, name: uniqueName(parentId, cleanName(name, 'Untitled')), type: 'txt', parent: parentId, content: '', created: now, modified: now, tags: [] };
    touch(parentId); S.flashId = id; OS.haptic('light'); commit();
    later(() => pushEditor(nav, id, true), 380);
  }
  function touch(id) { const n = getNode(id); if (n) n.modified = Date.now(); }

  async function renameItem(id, after) {
    const n = getNode(id); if (!n) return;
    const name = await OS.ui.prompt({ title: n.type === 'folder' ? 'Rename Folder' : 'Rename Document', placeholder: 'Name', value: n.name, okLabel: 'Rename' });
    if (name == null || !S || !getNode(id)) return;
    const clean = cleanName(name, n.name);
    if (clean === n.name) return;
    n.name = uniqueName(n.parent, clean, id); n.modified = Date.now();
    commit();
    if (after) after(n.name);
  }
  function duplicateItem(id) {
    const n = getNode(id); if (!n) return;
    const now = Date.now();
    const clone = (src, parent, top) => {
      const nid = U.uid();
      const copy = JSON.parse(JSON.stringify(src));
      Object.assign(copy, { id: nid, parent, created: now, modified: now, fav: false });
      if (top) copy.name = uniqueName(parent, src.name);
      nodes()[nid] = copy;
      if (src.type === 'folder') children(src.id).forEach((c) => clone(c, nid, false));
      return nid;
    };
    S.flashId = clone(n, n.parent, true);
    OS.haptic('light'); commit();
  }
  function toggleFav(id) {
    const n = getNode(id); if (!n) return;
    n.fav = !n.fav; OS.haptic('light'); commit();
    OS.ui.toast(n.fav ? 'Added to Favorites' : 'Removed from Favorites');
  }
  function fadeOut(id) { S.root.querySelectorAll('[data-id]').forEach((el) => { if (el.getAttribute('data-id') === id) el.classList.add('fl-gone'); }); }

  function deleteItem(id) {
    const n = getNode(id); if (!n || n.virtual || !n.parent) return;
    fadeOut(id);
    OS.sound.play('trash'); OS.haptic('medium');
    later(() => {
      const node = getNode(id); if (!node) return;
      node.deletedFrom = node.parent; node.deletedAt = Date.now(); node.parent = 'trash';
      node.name = uniqueName('trash', node.name, id);
      commit();
    }, 230);
  }
  function recoverItem(id, quiet) {
    const n = getNode(id); if (!n || n.parent !== 'trash') return;
    const dest = getNode(n.deletedFrom);
    const ok = dest && dest.id !== 'trash' && dest.type === 'folder' && !dest.virtual && !inTrash(dest);
    n.parent = ok ? dest.id : 'icloud';
    n.name = uniqueName(n.parent, n.name, id);
    delete n.deletedAt; delete n.deletedFrom;
    if (!quiet) { S.flashId = id; OS.haptic('success'); commit(); OS.ui.toast('Recovered to ' + getNode(n.parent).name); }
  }
  function purge(id) { descendants(id).forEach((d) => { delete nodes()[d.id]; }); delete nodes()[id]; }
  async function deleteNow(id, confirm) {
    const n = getNode(id); if (!n) return;
    if (confirm) {
      const i = await OS.ui.alert({ title: `Delete “${n.name}”?`, message: 'This item will be deleted immediately. You can’t undo this action.', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }] });
      if (i !== 1 || !S || !getNode(id)) return;
    }
    fadeOut(id); OS.sound.play('trash'); OS.haptic('medium');
    later(() => { if (getNode(id)) { purge(id); commit(); } }, 230);
  }
  async function trashChoice(it) {
    const i = await OS.ui.actionSheet({ title: it.name, message: `This item will be deleted in ${plural(daysLeft(it), 'day')}. Recover it to open it.`, buttons: [{ label: 'Recover' }, { label: 'Delete Now', style: 'destructive' }], cancel: 'Cancel' });
    if (!S) return;
    if (i === 0) recoverItem(it.id); else if (i === 1) deleteNow(it.id, false);
  }
  function recoverAll() {
    const list = children('trash'); if (!list.length) return;
    list.forEach((n) => recoverItem(n.id, true));
    OS.haptic('success'); commit(); OS.ui.toast(plural(list.length, 'Item') + ' Recovered');
  }
  async function deleteAll() {
    const list = children('trash'); if (!list.length) return;
    const i = await OS.ui.alert({ title: `Delete ${plural(list.length, 'Item')}?`, message: 'These items will be deleted immediately. You can’t undo this action.', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Delete', style: 'destructive' }] });
    if (i !== 1 || !S) return;
    list.forEach((n) => fadeOut(n.id));
    OS.sound.play('trash'); OS.haptic('heavy');
    later(() => { children('trash').forEach((n) => purge(n.id)); commit(); }, 230);
  }

  async function shareItem(id) {
    const n = getNode(id); if (!n) return;
    const has = (app) => { try { return !!(OS.isInstalled && OS.isInstalled(app)); } catch (e) { return false; } };
    const acts = ['copy'], buttons = [{ label: 'Copy' }];
    if (has('notes')) { acts.push('notes'); buttons.push({ label: 'Save to Notes' }); }
    if (has('mail')) { acts.push('mail'); buttons.push({ label: 'Mail' }); }
    if (has('messages')) { acts.push('sms'); buttons.push({ label: 'Messages' }); }
    const i = await OS.ui.actionSheet({ title: n.name, message: kindOf(n) + ' · ' + fmtSize(sizeOf(n)), buttons, cancel: 'Cancel' });
    if (i < 0 || !S) return;
    const text = n.content || '';
    const act = acts[i];
    if (act === 'copy') {
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* clipboard blocked */ }
      OS.haptic('success'); OS.ui.toast('Copied');
    } else if (act === 'notes') { OS.openApp('notes', { newNote: true, text: n.name + '\n' + text }); }
    else if (act === 'mail') { OS.openURL('mailto:?subject=' + encodeURIComponent(n.name) + '&body=' + encodeURIComponent(text.slice(0, 1500))); }
    else if (act === 'sms') { OS.openURL('sms:?body=' + encodeURIComponent(text.slice(0, 600))); }
  }

  /* ───────── sheets ───────── */
  function prepSheet(body) { body.classList.add('ios-scroll', 'fl-sheet'); }

  function tagSheet(id) {
    const n = getNode(id); if (!n) return;
    let sheet;
    sheet = OS.ui.sheet({
      title: 'Tags', height: 'medium',
      right: { label: 'Done', bold: true, onTap() { if (sheet) sheet.close(); } },
      render(body, sh) {
        sheet = sheet || sh; prepSheet(body);
        const draw = () => {
          const node = getNode(id); if (!node) return;
          const cur = new Set(node.tags || []);
          body.innerHTML = `<div class="fl-sheet-msg">Tags for “${esc(node.name)}”</div><div class="ios-list">` +
            TAGS.map((t) => `<div class="ios-row tappable${cur.has(t.id) ? ' on' : ''}" data-tag="${t.id}"><i class="fl-tagdot" style="background:${t.color}"></i><span class="ios-row-label">${t.name}</span><span class="fl-ck">${IC.check}</span></div>`).join('') +
            '</div><div class="fl-sheet-pad"></div>';
          body.querySelectorAll('[data-tag]').forEach((row) => row.addEventListener('click', () => {
            const node2 = getNode(id); if (!node2) return;
            const tg = row.getAttribute('data-tag'); const set = new Set(node2.tags || []);
            if (set.has(tg)) set.delete(tg); else set.add(tg);
            node2.tags = TAGS.map((t) => t.id).filter((t) => set.has(t));
            row.classList.toggle('on', set.has(tg));
            OS.haptic('selection'); commit();
          }));
        };
        draw();
      },
    });
  }

  function moveSheet(id) {
    const n = getNode(id); if (!n) return;
    const banned = new Set([id].concat(descendants(id).map((d) => d.id)));
    let target = n.parent, sheet;
    const doMove = () => {
      const node = getNode(id), dest = getNode(target);
      if (node && dest && target !== node.parent && !banned.has(target)) {
        node.parent = target; node.name = uniqueName(target, node.name, id); node.modified = Date.now(); touch(target);
        S.flashId = id; OS.haptic('success'); commit(); OS.ui.toast('Moved to ' + dest.name);
      }
      if (sheet) sheet.close();
    };
    sheet = OS.ui.sheet({
      title: 'Move', height: 'large',
      left: { label: 'Cancel', onTap() { if (sheet) sheet.close(); } },
      right: { label: 'Move', bold: true, onTap: doMove },
      render(body, sh) {
        sheet = sheet || sh; prepSheet(body);
        const rows = [];
        const walk = (pid, depth) => sortItems(children(pid).filter((c) => c.type === 'folder' && !c.virtual), 'name').forEach((c) => { rows.push({ n: c, depth }); walk(c.id, depth + 1); });
        ['icloud', 'local'].forEach((r) => { rows.push({ n: getNode(r), depth: 0, root: true }); walk(r, 1); });
        body.innerHTML = `<div class="fl-sheet-msg">Choose a new location for “${esc(n.name)}”.</div><div class="ios-list">` +
          rows.map((r) => `<div class="ios-row fl-mv${banned.has(r.n.id) ? ' off' : ''}${r.n.id === target ? ' on' : ''}" data-dest="${esc(r.n.id)}" style="padding-left:${16 + r.depth * 22}px">
            <span class="fl-mv-ic">${r.root ? (r.n.id === 'icloud' ? IC.cloud : IC.iphone) : IC.folder}</span><span class="ios-row-label">${esc(r.n.name)}</span><span class="fl-ck">${IC.check}</span></div>`).join('') +
          '</div><div class="fl-sheet-pad"></div>';
        body.querySelectorAll('[data-dest]').forEach((row) => row.addEventListener('click', () => {
          target = row.getAttribute('data-dest');
          body.querySelectorAll('[data-dest]').forEach((r) => r.classList.toggle('on', r === row));
          OS.haptic('selection');
        }));
      },
    });
  }

  function infoSheet(it) {
    let sheet;
    sheet = OS.ui.sheet({
      title: 'Info', height: 'large',
      right: { label: 'Done', bold: true, onTap() { if (sheet) sheet.close(); } },
      render(body, sh) {
        sheet = sheet || sh; prepSheet(body);
        const tags = (it.tags || []).filter((t) => TAG[t]);
        const size = it.type === 'folder' ? fmtSize(sizeOf(it)) + ' · ' + plural(itemCount(it), 'item') : fmtSize(sizeOf(it));
        const row = (k, v) => `<div class="ios-row"><span class="ios-row-label">${k}</span><span class="ios-row-value">${v}</span></div>`;
        body.innerHTML = `<div class="fl-info-top"><div class="fl-info-thumb">${thumbHTML(it, 'big')}</div><b>${esc(it.name)}</b><span>${esc(kindOf(it))} · ${esc(fmtSize(sizeOf(it)))}</span></div>
          <div class="ios-list-header" style="margin-top:0">Information</div><div class="ios-list">
          ${row('Kind', esc(kindOf(it)))}${row('Size', esc(size))}${row('Created', esc(fmtLong(it.created || it.modified)))}${row('Modified', esc(fmtLong(it.modified)))}
          ${row('Where', esc(it.parent === 'trash' ? 'Recently Deleted' : whereOf(it) || 'Files'))}
          ${it.type === 'txt' ? row('Words', String(((it.content || '').match(/\S+/g) || []).length)) : ''}
          </div>
          <div class="ios-list-header">Tags</div><div class="ios-list"><div class="ios-row"><span class="ios-row-label wrap">${tags.length ? tags.map((t) => `<i class="fl-tagdot sm" style="background:${TAG[t].color}"></i>${TAG[t].name}`).join('&nbsp;&nbsp; ') : '<span style="color:var(--label2)">No Tags</span>'}</span></div></div>
          <div class="fl-sheet-pad"></div>`;
      },
    });
  }

  function storageInfo() {
    const used = ['icloud', 'local'].reduce((a, r) => a + sizeOf(getNode(r)), 0);
    const count = Object.values(nodes()).filter((n) => n.parent && n.type !== 'folder' && !inTrash(n)).length + S.shots.length;
    OS.ui.alert({ title: 'Storage', message: `iCloud Drive: 3.8 GB of 5 GB used\nOn My iPhone: 38.4 GB available\n\nFiles is keeping ${plural(count, 'document')} (${fmtSize(used)}).`, buttons: [{ label: 'OK', style: 'cancel' }] });
  }

  /* ───────── pages ───────── */
  function mountWrap(body) { const w = U.el('<div class="fl-wrap"></div>'); body.appendChild(w); return w; }

  function folderFooter(id, n) {
    const root = rootOf(id), base = plural(n, 'item');
    if (root === 'icloud') return base + ', 1.2 GB available on iCloud';
    if (root === 'local') return base + ', 38.4 GB available';
    return base;
  }

  function pushFolder(nav, id) {
    const node = getNode(id); if (!node) return;
    const isTrash = id === 'trash';
    let query = '', wrap = null, pageRef = null, lastTitle = node.name;
    const refresh = () => {
      if (!wrap || !S) return;
      const cur = getNode(id);
      if (!cur || (!isTrash && inTrash(cur))) { renderItems(wrap, [], { nav, empty: { title: 'Folder Unavailable', sub: 'This folder was moved to Recently Deleted.' } }); return; }
      if (cur.name !== lastTitle && pageRef && pageRef.setTitle) { lastTitle = cur.name; pageRef.setTitle(cur.name); }
      let items;
      if (cur.virtual === 'screenshots') items = S.shots.slice();
      else if (query) items = descendants(id).filter((d) => d.name.toLowerCase().includes(query));
      else items = children(id);
      if (cur.virtual === 'screenshots' && query) items = items.filter((s) => s.name.toLowerCase().includes(query));
      items = isTrash ? items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)) : sortItems(items, S.prefs.sort);
      const empty = query ? { title: 'No Results', sub: `for “${query}”` }
        : isTrash ? { title: 'No Items', sub: 'Files you delete are kept here for 30 days.' }
        : cur.virtual === 'screenshots' ? { title: 'No Screenshots', sub: 'Screenshots you take on this iPhone will show up here.' }
        : { title: 'Folder is Empty', sub: '' };
      const footer = isTrash ? plural(items.length, 'item') + '. Items are permanently deleted after the number of days shown.' : query ? plural(items.length, 'result') : folderFooter(id, items.length);
      renderItems(wrap, items, { nav, trash: isTrash, where: !!query && !isTrash, empty, footer });
    };
    nav.push({
      title: node.name, largeTitle: true, background: 'var(--bg)',
      search: { placeholder: 'Search', onInput(t) { query = String(t || '').trim().toLowerCase(); refresh(); } },
      right: [{ icon: IC.more, onTap(a) { folderMenu(anchorFor(a, pageRef), id, nav); } }],
      render(body, page) { pageRef = page; wrap = mountWrap(body); registerView(body, refresh); refresh(); if (node.virtual) loadShots(); },
      onShow() { refresh(); },
    });
  }

  function pushTag(nav, tagId) {
    const tag = TAG[tagId]; if (!tag) return;
    let wrap = null, pageRef = null;
    const refresh = () => {
      if (!wrap || !S) return;
      const items = sortItems(Object.values(nodes()).filter((n) => n.parent && (n.tags || []).includes(tagId) && !inTrash(n)), S.prefs.sort);
      renderItems(wrap, items, { nav, where: true, empty: { title: 'No Items', sub: `Touch and hold a file or folder, then tap Tags to mark it ${tag.name}.` }, footer: plural(items.length, 'item') });
    };
    nav.push({
      title: tag.name, largeTitle: true, background: 'var(--bg)',
      right: [{ icon: IC.more, onTap(a) { OS.ui.contextMenu(anchorFor(a, pageRef), viewMenuItems().concat(sortMenuItems())); } }],
      render(body, page) { pageRef = page; wrap = mountWrap(body); registerView(body, refresh); refresh(); },
      onShow() { refresh(); },
    });
  }

  function allFiles() { return Object.values(nodes()).filter((n) => n.parent && n.type !== 'folder' && !inTrash(n)).concat(S.shots); }

  function pushRecents(nav) {
    let query = '', wrap = null, pageRef = null;
    const refresh = () => {
      if (!wrap || !S) return;
      let items = allFiles().sort((a, b) => b.modified - a.modified);
      if (query) items = items.filter((n) => n.name.toLowerCase().includes(query));
      items = items.slice(0, 36);
      renderItems(wrap, items, { nav, where: true, empty: query ? { title: 'No Results', sub: `for “${query}”` } : { title: 'No Recents', sub: 'Documents you’ve opened or edited recently will appear here.' }, footer: plural(items.length, 'item') });
    };
    nav.push({
      title: 'Recents', largeTitle: true, background: 'var(--bg)',
      search: { placeholder: 'Search', onInput(t) { query = String(t || '').trim().toLowerCase(); refresh(); } },
      right: [{ icon: IC.more, onTap(a) { OS.ui.contextMenu(anchorFor(a, pageRef), viewMenuItems()); } }],
      render(body, page) { pageRef = page; wrap = mountWrap(body); registerView(body, refresh); refresh(); },
      onShow() { refresh(); },
    });
  }

  function pushBrowse(nav) {
    let query = '', wrap = null, pageRef = null;
    const section = (key, title, inner) => {
      const shut = !!S.sections[key];
      return `<div class="fl-sec${shut ? ' shut' : ''}" data-sec="${key}"><span>${title}</span>${CHEV_DOWN}</div>
        <div class="fl-collapse${shut ? ' shut' : ''}"><div class="fl-collapse-in"><div class="ios-list fl-blist">${inner}</div></div></div>`;
    };
    const renderBrowse = () => {
      const trashN = children('trash').length;
      const loc = [['icloud', IC.cloud, ''], ['local', IC.iphone, ''], ['trash', IC.trash, trashN ? String(trashN) : '']].map(([id, ic, val]) =>
        `<div class="ios-row tappable" data-open="${id}"><span class="fl-loc-ic">${ic}</span><span class="ios-row-label">${esc(getNode(id).name)}</span>${val ? `<span class="ios-row-value">${val}</span>` : ''}${CHEV}</div>`).join('');
      const favs = sortItems(Object.values(nodes()).filter((n) => n.fav && n.type === 'folder' && n.parent && !inTrash(n)), 'name');
      const fav = favs.length ? favs.map((f) => `<div class="ios-row tappable" data-open="${esc(f.id)}" data-fav="1"><span class="fl-loc-ic">${thumbHTML(f, 'row')}</span><span class="ios-row-label">${esc(f.name)}</span>${CHEV}</div>`).join('')
        : '<div class="ios-row"><span class="fl-hint">No favorites yet. Touch and hold a folder, then tap Favorite.</span></div>';
      const tagRows = TAGS.map((t) => {
        const c = Object.values(nodes()).filter((n) => n.parent && (n.tags || []).includes(t.id) && !inTrash(n)).length;
        return `<div class="ios-row tappable" data-tag="${t.id}"><span class="fl-loc-ic"><i class="fl-tagdot" style="background:${t.color}"></i></span><span class="ios-row-label">${t.name}</span>${c ? `<span class="ios-row-value">${c}</span>` : ''}${CHEV}</div>`;
      }).join('');
      wrap.innerHTML = section('loc', 'Locations', loc) + section('fav', 'Favorites', fav) + section('tags', 'Tags', tagRows) + '<div style="height:24px"></div>';

      wrap.querySelectorAll('[data-sec]').forEach((h) => h.addEventListener('click', () => {
        const key = h.getAttribute('data-sec'); const shut = !S.sections[key];
        S.sections[key] = shut; OS.store.set('files.sections', S.sections);
        h.classList.toggle('shut', shut); h.nextElementSibling.classList.toggle('shut', shut); OS.haptic('light');
      }));
      wrap.querySelectorAll('[data-open]').forEach((r) => {
        const id = r.getAttribute('data-open');
        r.addEventListener('click', () => { if (r._lp) { r._lp = false; return; } pushFolder(nav, id); });
        if (r.hasAttribute('data-fav')) {
          r.addEventListener('pointerdown', () => { r._lp = false; });
          const menu = () => OS.ui.contextMenu(r, [{ label: 'Remove from Favorites', icon: IC.starSlash, onTap: () => toggleFav(id) }, { label: 'Get Info', icon: IC.info, onTap: () => { const n = getNode(id); if (n) infoSheet(n); } }]);
          U.longPress(r, () => { r._lp = true; OS.haptic('medium'); menu(); });
          r.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(); });
        }
      });
      wrap.querySelectorAll('[data-tag]').forEach((r) => r.addEventListener('click', () => pushTag(nav, r.getAttribute('data-tag'))));
    };
    const refresh = () => {
      if (!wrap || !S) return;
      if (!query) { renderBrowse(); return; }
      const hits = sortItems(Object.values(nodes()).filter((n) => n.parent && !inTrash(n) && n.name.toLowerCase().includes(query)).concat(S.shots.filter((s) => s.name.toLowerCase().includes(query))), 'name');
      renderItems(wrap, hits, { nav, mode: 'list', where: true, empty: { title: 'No Results', sub: `for “${query}”` }, footer: plural(hits.length, 'result') });
    };
    nav.push({
      title: 'Browse', largeTitle: true, background: 'var(--bg2)',
      search: { placeholder: 'Search', onInput(t) { query = String(t || '').trim().toLowerCase(); refresh(); } },
      right: [{ icon: IC.more, onTap(a) {
        OS.ui.contextMenu(anchorFor(a, pageRef), [
          { label: 'New Folder', icon: IC.folderPlus, onTap: () => { newFolder('icloud').then(() => {}); pushFolderIfRoot(nav, 'icloud'); } },
          { label: 'New Text File', icon: IC.docPlus, onTap: () => { pushFolderIfRoot(nav, 'icloud'); newTextFile('icloud', nav); } },
          { label: 'Storage', icon: IC.storage, onTap: storageInfo },
        ]);
      } }],
      render(body, page) { pageRef = page; wrap = mountWrap(body); registerView(body, refresh); refresh(); },
      onShow() { refresh(); },
    });
  }
  // Creating from the Browse root drops you into iCloud Drive so you can see the new item appear.
  function pushFolderIfRoot(nav, id) { pushFolder(nav, id); }

  /* Quick Look — text editor */
  function pushEditor(nav, id, focus) {
    const node = getNode(id); if (!node) return;
    let ta = null, statusL = null, statusR = null, timer = null, pageRef = null, dirty = false;
    const words = (s) => (s.match(/\S+/g) || []).length;
    const paint = () => {
      if (!ta) return;
      if (statusL) statusL.textContent = 'Plain Text · ' + plural(words(ta.value), 'word') + ' · ' + plural(ta.value.length, 'character');
      if (statusR) statusR.textContent = dirty ? 'Editing…' : 'Saved';
    };
    const flush = () => {
      if (timer) { clearTimeout(timer); if (S) S.timers.delete(timer); timer = null; }
      const n = getNode(id);
      if (ta && n && n.content !== ta.value) { n.content = ta.value; n.modified = Date.now(); touch(n.parent); persist(); }
      dirty = false; paint();
    };
    S.flushers.add(flush);
    const done = () => { if (ta) ta.blur(); flush(); nav.pop(); };
    nav.push({
      title: node.name, largeTitle: false, background: 'var(--bg)',
      left: { label: 'Done', bold: true, onTap: done },
      right: [{ icon: IC.more, onTap(a) {
        if (ta) ta.blur(); flush();
        OS.ui.contextMenu(anchorFor(a, pageRef), [
          { label: 'Get Info', icon: IC.info, onTap: () => { const n = getNode(id); if (n) infoSheet(n); } },
          { label: 'Rename', icon: IC.pencil, onTap: () => renameItem(id, (nm) => { if (pageRef && pageRef.setTitle) pageRef.setTitle(nm); }) },
          { label: 'Share', icon: IC.share, onTap: () => shareItem(id) },
          { label: 'Delete', icon: IC.trash, style: 'destructive', onTap: () => { nav.pop(); deleteItem(id); } },
        ]);
      } }],
      render(body, page) {
        pageRef = page;
        const w = mountWrap(body);
        w.innerHTML = '<textarea class="fl-edit" placeholder="Start typing…" spellcheck="false" autocapitalize="sentences"></textarea><div class="fl-status"><i></i><i></i></div>';
        ta = w.querySelector('textarea'); const st = w.querySelectorAll('.fl-status i'); statusL = st[0]; statusR = st[1];
        ta.value = node.content || '';
        ta.addEventListener('input', () => {
          dirty = true; paint();
          if (timer) { clearTimeout(timer); S.timers.delete(timer); }
          timer = later(flush, 450);
        });
        ta.addEventListener('blur', flush);
        paint();
        if (focus) later(() => { if (ta && ta.isConnected) ta.focus(); }, 480);
      },
      onHide() { flush(); if (S) { S.flushers.delete(flush); refreshAll(); } },
    });
  }

  /* Quick Look — image */
  function pushImage(nav, shot) {
    let pageRef = null;
    nav.push({
      title: shot.name, largeTitle: false, background: 'var(--bg)',
      left: { label: 'Done', bold: true, onTap() { nav.pop(); } },
      right: [{ icon: IC.more, onTap(a) {
        const items = [{ label: 'Get Info', icon: IC.info, onTap: () => infoSheet(shot) }];
        if (OS.isInstalled && OS.isInstalled('photos')) items.push({ label: 'Show in Photos', icon: IC.photos, onTap: () => OS.openApp('photos') });
        OS.ui.contextMenu(anchorFor(a, pageRef), items);
      } }],
      render(body, page) { pageRef = page; mountWrap(body).innerHTML = `<div class="fl-ql"><img src="${esc(shot.src)}" alt="" draggable="false"></div>`; },
    });
  }

  /* ───────── tabs ───────── */
  function selectTab(tab) {
    if (tab !== 'recents' && tab !== 'browse') tab = 'browse';
    if (S.tab === tab && S.tabReady) { const nav = S.navs[tab]; if (nav && nav.popToRoot) nav.popToRoot(); return; }
    S.tab = tab; S.tabReady = true;
    OS.store.set('files.tab', tab);
    S.root.querySelectorAll('.fl-pane').forEach((p) => p.classList.toggle('on', p.getAttribute('data-tab') === tab));
    S.root.querySelectorAll('.ios-tab').forEach((t) => t.classList.toggle('on', t.getAttribute('data-tab') === tab));
    refreshAll();
  }

  /* ───────── app ───────── */
  OS.registerApp({
    id: 'files',
    name: 'Files',
    icon: {
      bg: 'linear-gradient(180deg,#FFFFFF,#F1F3F6)',
      glyph: `<svg viewBox="0 0 60 60">
        <path d="M10.5 19.8a4.3 4.3 0 0 1 4.3-4.3h8.6c1.2 0 2.3.5 3.1 1.3l2.2 2.3c.8.8 1.9 1.3 3.1 1.3h13.4a4.3 4.3 0 0 1 4.3 4.3v16a4.3 4.3 0 0 1-4.3 4.3H14.8a4.3 4.3 0 0 1-4.3-4.3z" fill="#1E8DF1"/>
        <foreignObject x="10.5" y="23.5" width="39" height="21.5"><div xmlns="http://www.w3.org/1999/xhtml" style="width:39px;height:21.5px;border-radius:3.6px 3.6px 4.3px 4.3px;background:linear-gradient(180deg,#8BD7FF 0%,#5CBFFB 48%,#3CA6F5 100%);box-shadow:inset 0 .7px 0 rgba(255,255,255,.7)"></div></foreignObject>
      </svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',

    launch(ctx) {
      S = {
        ctx, root: ctx.root, tree: null, shots: [], shotSig: null, urls: [],
        prefs: Object.assign({ mode: 'grid', sort: 'name' }, OS.store.get('files.view', {}) || {}),
        sections: OS.store.get('files.sections', {}) || {},
        views: new Set(), flushers: new Set(), timers: new Set(), navs: {}, tab: null, tabReady: false, flashId: null,
      };
      S.tree = loadTree();
      ctx.root.innerHTML = `<div class="fl-pane" data-tab="recents"></div><div class="fl-pane" data-tab="browse"></div>
        <div class="ios-tabbar"><div class="ios-tab" data-tab="recents">${TAB_RECENTS}<span>Recents</span></div><div class="ios-tab" data-tab="browse">${TAB_BROWSE}<span>Browse</span></div></div>`;
      const panes = ctx.root.querySelectorAll('.fl-pane');
      S.navs.recents = OS.ui.createNav(panes[0], { tabBarInset: true });
      S.navs.browse = OS.ui.createNav(panes[1], { tabBarInset: true });
      pushRecents(S.navs.recents);
      pushBrowse(S.navs.browse);
      ctx.root.querySelectorAll('.ios-tab').forEach((t) => t.addEventListener('click', () => { OS.haptic('selection'); selectTab(t.getAttribute('data-tab')); }));
      selectTab(OS.store.get('files.tab', 'browse'));
      loadShots();
    },

    onResume(ctx, params) {
      if (!S) return;
      if (params && (params.tab === 'recents' || params.tab === 'browse') && params.tab !== S.tab) selectTab(params.tab);
      loadShots();      // a screenshot may have been taken while we were in the background
      refreshAll();     // also refreshes relative dates ("Yesterday", days remaining)
    },

    onPause() {
      if (!S) return;
      S.flushers.forEach((f) => { try { f(); } catch (e) {} });
    },

    onClose() {
      if (!S) return;
      S.flushers.forEach((f) => { try { f(); } catch (e) {} });
      S.timers.forEach((t) => clearTimeout(t));
      S.urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} });
      S.views.clear(); S.flushers.clear(); S.timers.clear();
      S = null;
    },
  });
})();
