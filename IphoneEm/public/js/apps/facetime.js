/* FaceTime — landing (recents + links), New FaceTime sheet, full call UI with the real webcam as a draggable self-view. */
(function () {
  'use strict';

  const U = OS.util;
  const esc = (s) => U.esc(s == null ? '' : String(s));
  const safe = (fn) => { try { return fn(); } catch (e) { return undefined; } };
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const ISLAND_ID = 'facetime-call';
  const K_RECENTS = 'facetime.recents';
  const K_LINKS = 'facetime.links';

  /* ------------------------------------------------------------------ glyphs */
  const svg = (inner, vb) => `<svg viewBox="${vb || '0 0 24 24'}" fill="currentColor" aria-hidden="true">${inner}</svg>`;
  const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  const G = {
    video: svg('<rect x="1.8" y="6" width="14.4" height="12" rx="3.3"/><path d="M17.6 10.3l3.5-2.5c.6-.45 1.4 0 1.4.75v6.9c0 .75-.8 1.2-1.4.75l-3.5-2.5z"/>'),
    videoOff: svg('<rect x="1.8" y="6" width="14.4" height="12" rx="3.3" opacity=".55"/><path d="M17.6 10.3l3.5-2.5c.6-.45 1.4 0 1.4.75v6.9c0 .75-.8 1.2-1.4.75l-3.5-2.5z" opacity=".55"/><path d="M3.5 3.5l17 17" ' + STROKE + ' stroke-width="2.1"/>'),
    mic: svg('<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.6 11.6a6.4 6.4 0 0012.8 0M12 18v3.3M8.6 21.3h6.8" ' + STROKE + '/>'),
    micOff: svg('<rect x="9" y="2.5" width="6" height="12" rx="3" opacity=".55"/><path d="M5.6 11.6a6.4 6.4 0 0012.8 0M12 18v3.3M8.6 21.3h6.8" ' + STROKE + ' opacity=".55"/><path d="M3.5 3.5l17 17" ' + STROKE + ' stroke-width="2.1"/>'),
    speaker: svg('<path d="M2.8 9.4v5.2c0 .5.4.9.9.9h2.9l4.5 3.8c.6.5 1.4.1 1.4-.7V5.4c0-.8-.8-1.2-1.4-.7L6.6 8.5H3.7c-.5 0-.9.4-.9.9z"/><path d="M15.6 8.8a4.6 4.6 0 010 6.4M18.3 6a8.6 8.6 0 010 12" ' + STROKE + '/>'),
    share: svg('<rect x="2.4" y="4.4" width="19.2" height="13.2" rx="2.8" ' + STROKE + '/><circle cx="12" cy="9.2" r="2.1"/><path d="M7.9 15.2c.5-2.2 2.1-3.3 4.1-3.3s3.6 1.1 4.1 3.3z"/><path d="M8.2 20.6h7.6" ' + STROKE + '/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18" ' + STROKE + ' stroke-width="2.4"/>'),
    phone: svg('<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>'),
    message: svg('<path d="M12 3.4c-5.3 0-9.6 3.5-9.6 7.9 0 2.5 1.4 4.7 3.6 6.2-.2 1.2-.8 2.3-1.7 3.2 1.9-.1 3.6-.8 4.9-1.9.9.2 1.8.3 2.8.3 5.3 0 9.6-3.5 9.6-7.8s-4.3-7.9-9.6-7.9z"/>'),
    link: svg('<path d="M10 14.2a4 4 0 005.7 0l3.1-3.1a4 4 0 00-5.7-5.7l-1.1 1.1M14 9.8a4 4 0 00-5.7 0l-3.1 3.1a4 4 0 005.7 5.7l1.1-1.1" ' + STROKE + ' stroke-width="2.1"/>'),
    info: svg('<circle cx="12" cy="12" r="9.4" ' + STROKE + ' stroke-width="1.6"/><circle cx="12" cy="7.7" r="1.15"/><path d="M12 11v6" ' + STROKE + ' stroke-width="2"/>'),
    flip: svg('<path d="M4.2 11.5a8 8 0 0113.6-5l2 2M20 4v4.6h-4.6M19.8 12.5a8 8 0 01-13.6 5l-2-2M4 20v-4.6h4.6" ' + STROKE + '/>'),
    person: svg('<circle cx="12" cy="8.4" r="4.2"/><path d="M3.6 20.4c.9-4.3 4.3-6.4 8.4-6.4s7.5 2.1 8.4 6.4z"/>'),
    minus: svg('<path d="M7 12h10" ' + STROKE + ' stroke-width="2.6"/>'),
  };

  /* ------------------------------------------------------------------ styles */
  OS.addStyle('facetime', `
    .app-facetime { background:#000; color:#fff; -webkit-user-select:none; user-select:none; }
    .app-facetime button { font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
    .app-facetime svg { display:block; }

    /* ---------- landing ---------- */
    .app-facetime .ft-home { position:absolute; inset:0; background:#000; color:#fff; transition:transform .4s ${EASE}, opacity .4s ${EASE}; }
    .app-facetime.in-call .ft-home { transform:scale(.94); opacity:.0; pointer-events:none; }
    .app-facetime .ft-top { position:absolute; top:0; left:0; right:0; height:calc(var(--safe-top) + 44px); padding:var(--safe-top) 16px 0; box-sizing:border-box;
      display:flex; align-items:center; justify-content:space-between; z-index:5; border-bottom:.5px solid transparent; transition:background .25s, border-color .25s; }
    .app-facetime .ft-top.scrolled { background:rgba(22,22,24,.8); -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur); border-bottom-color:rgba(84,84,88,.65); }
    .app-facetime .ft-top-title { position:absolute; left:0; right:0; bottom:0; height:44px; line-height:44px; text-align:center; font-size:17px; font-weight:600; letter-spacing:-.4px;
      opacity:0; transition:opacity .2s; pointer-events:none; }
    .app-facetime .ft-top.scrolled .ft-top-title { opacity:1; }
    .app-facetime .ft-top button { position:relative; z-index:1; background:none; border:0; padding:8px 0; color:#30D158; font-size:17px; letter-spacing:-.4px; }
    .app-facetime .ft-top button.bold { font-weight:600; }
    .app-facetime .ft-top button:disabled { opacity:.35; }
    .app-facetime .ft-top button:active { opacity:.5; }
    .app-facetime .ft-scroll { position:absolute; inset:0; overflow-y:auto; box-sizing:border-box; padding:calc(var(--safe-top) + 44px) 0 calc(var(--safe-bottom) + 24px); }
    .app-facetime .ft-title { font-size:34px; font-weight:700; letter-spacing:.35px; padding:4px 16px 0; }
    .app-facetime .ft-actions { display:flex; gap:10px; padding:14px 16px 8px; }
    .app-facetime .ft-act { flex:1; height:50px; border:0; border-radius:13px; display:flex; align-items:center; justify-content:center; gap:7px; font-size:16px; font-weight:600;
      letter-spacing:-.3px; color:#fff; background:rgba(118,118,128,.28); transition:transform .25s ${EASE}, filter .2s; }
    .app-facetime .ft-act svg { width:22px; height:22px; }
    .app-facetime .ft-act.green { background:#30D158; }
    .app-facetime .ft-act:active { transform:scale(.96); filter:brightness(.8); }
    .app-facetime .ft-sec { font-size:20px; font-weight:700; letter-spacing:.2px; padding:22px 16px 6px; }
    .app-facetime .ft-row { position:relative; display:flex; align-items:center; padding:0 12px 0 16px; min-height:64px; box-sizing:border-box; overflow:hidden;
      transition:height .3s ${EASE}, min-height .3s ${EASE}, opacity .25s; }
    .app-facetime .ft-row.gone { height:0 !important; min-height:0; opacity:0; }
    .app-facetime .ft-row::after { content:''; position:absolute; left:74px; right:0; bottom:0; height:.5px; background:rgba(84,84,88,.65); }
    .app-facetime .ft-row:last-child::after { display:none; }
    .app-facetime .ft-del { flex:none; width:0; height:24px; padding:0; border:0; background:none; overflow:hidden; opacity:0; transition:width .3s ${EASE}, opacity .3s, margin .3s ${EASE}; }
    .app-facetime .ft-del i { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#FF453A; color:#fff; }
    .app-facetime .ft-del svg { width:16px; height:16px; }
    .app-facetime .ft-home.editing .ft-del { width:22px; opacity:1; margin-right:12px; }
    .app-facetime .ft-home.editing .ft-row::after { left:108px; }
    .app-facetime .ft-row-main { flex:1; min-width:0; display:flex; align-items:center; gap:12px; padding:9px 0; }
    .app-facetime .ft-av { flex:none; width:46px; height:46px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .app-facetime .ft-av.linkav { background:rgba(118,118,128,.3); color:#30D158; }
    .app-facetime .ft-av.linkav svg { width:24px; height:24px; }
    .app-facetime .ft-row-text { min-width:0; flex:1; }
    .app-facetime .ft-row-name { font-size:17px; font-weight:600; letter-spacing:-.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-facetime .ft-row-name.missed { color:#FF453A; }
    .app-facetime .ft-row-sub { display:flex; align-items:center; gap:5px; margin-top:2px; font-size:14px; color:rgba(235,235,245,.6); letter-spacing:-.2px; white-space:nowrap; }
    .app-facetime .ft-row-sub svg { width:15px; height:15px; flex:none; }
    .app-facetime .ft-row-date { flex:none; font-size:15px; color:rgba(235,235,245,.6); margin:0 6px 0 8px; letter-spacing:-.2px; }
    .app-facetime .ft-info { flex:none; width:34px; height:44px; padding:0; border:0; background:none; color:#30D158; display:flex; align-items:center; justify-content:center; }
    .app-facetime .ft-info svg { width:23px; height:23px; }
    .app-facetime .ft-info:active { opacity:.4; }
    .app-facetime .ft-empty { padding:120px 40px 0; text-align:center; color:rgba(235,235,245,.6); }
    .app-facetime .ft-empty b { display:block; font-size:22px; font-weight:700; color:#fff; margin-bottom:6px; }
    .app-facetime .ft-empty span { font-size:15px; line-height:20px; }

    /* ---------- call ---------- */
    .app-facetime .ft-call { --c:#5E5CE6; position:absolute; inset:0; z-index:20; overflow:hidden; background:#0b0b0f; color:#fff; opacity:0; transform:scale(1.06);
      transition:opacity .38s ${EASE}, transform .38s ${EASE}; }
    .app-facetime .ft-call.in { opacity:1; transform:none; }
    .app-facetime .ft-remote { position:absolute; inset:0; background:#101016; background:radial-gradient(130% 85% at 50% 32%, color-mix(in srgb, var(--c) 40%, #0b0b0f) 0%, #0b0b0f 72%); }
    .app-facetime .ft-blob { position:absolute; width:340px; height:340px; border-radius:50%; background:var(--c); filter:blur(72px); opacity:.3; left:-90px; top:60px;
      animation:ft-drift 11s ease-in-out infinite alternate; transition:opacity 1.2s; pointer-events:none; }
    .app-facetime .ft-blob.b { left:auto; right:-120px; top:380px; filter:blur(80px) hue-rotate(48deg); animation-duration:14s; animation-direction:alternate-reverse; }
    .app-facetime .ft-call[data-state="connected"] .ft-blob { opacity:.46; }
    .app-facetime .ft-call[data-state="unavailable"] .ft-blob { opacity:.12; }
    .app-facetime .ft-vignette { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,.55) 100%); pointer-events:none; }
    @keyframes ft-drift { 0% { transform:translate(0,0) scale(1); } 50% { transform:translate(60px,40px) scale(1.15); } 100% { transform:translate(120px,-30px) scale(.95); } }

    .app-facetime .ft-center { position:absolute; left:0; right:0; top:196px; display:flex; flex-direction:column; align-items:center; pointer-events:none;
      transition:transform .5s ${EASE}; }
    .app-facetime .ft-call.audio .ft-center { top:170px; }
    .app-facetime .ft-call[data-state="connected"].bare .ft-center { transform:translateY(60px); }
    .app-facetime .ft-avwrap { position:relative; width:148px; height:148px; transition:transform .5s cubic-bezier(.3,1.4,.5,1); }
    .app-facetime .ft-call[data-state="connected"] .ft-avwrap { transform:scale(1.1); }
    .app-facetime .ft-call[data-state="unavailable"] .ft-avwrap { transform:scale(.86); }
    .app-facetime .ft-ring { position:absolute; inset:0; border-radius:50%; background:var(--c); opacity:0; animation:ft-pulse 2.7s cubic-bezier(.2,.6,.3,1) infinite; }
    .app-facetime .ft-ring.r2 { animation-delay:.9s; } .app-facetime .ft-ring.r3 { animation-delay:1.8s; }
    .app-facetime .ft-call:not([data-state="ringing"]) .ft-ring { animation:none; opacity:0; }
    @keyframes ft-pulse { 0% { transform:scale(1); opacity:.42; } 100% { transform:scale(2.15); opacity:0; } }
    .app-facetime .ft-level { position:absolute; inset:-12px; border-radius:50%; background:var(--c); opacity:0; transition:transform .24s ease-out, opacity .5s; }
    .app-facetime .ft-level.l2 { inset:-26px; transition:transform .42s ease-out, opacity .5s; }
    .app-facetime .ft-call[data-state="connected"] .ft-level { opacity:.3; }
    .app-facetime .ft-call[data-state="connected"] .ft-level.l2 { opacity:.14; }
    .app-facetime .ft-bigav { position:absolute; inset:0; border-radius:50%; background-color:var(--c); background-image:linear-gradient(180deg, rgba(255,255,255,.3), rgba(0,0,0,.14));
      display:flex; align-items:center; justify-content:center; font-size:60px; font-weight:600; letter-spacing:-1px; color:#fff; box-shadow:0 14px 40px rgba(0,0,0,.35);
      animation:ft-breath 4.2s ease-in-out infinite; }
    .app-facetime .ft-bigav svg { width:78px; height:78px; opacity:.95; }
    .app-facetime .ft-bigav.emoji { font-size:76px; }
    @keyframes ft-breath { 0%,100% { transform:scale(1); } 50% { transform:scale(1.045); } }
    .app-facetime .ft-name { margin-top:30px; max-width:340px; font-size:30px; font-weight:600; letter-spacing:.1px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      text-shadow:0 1px 10px rgba(0,0,0,.3); }
    .app-facetime .ft-status { margin-top:6px; font-size:18px; color:rgba(255,255,255,.66); letter-spacing:-.3px; font-variant-numeric:tabular-nums; min-height:24px; }
    .app-facetime .ft-dots i { font-style:normal; animation:ft-dot 1.3s infinite; opacity:.2; }
    .app-facetime .ft-dots i:nth-child(2) { animation-delay:.2s; } .app-facetime .ft-dots i:nth-child(3) { animation-delay:.4s; }
    @keyframes ft-dot { 0%,60%,100% { opacity:.2; } 30% { opacity:1; } }
    .app-facetime .ft-badges { display:flex; gap:8px; margin-top:12px; min-height:26px; }
    .app-facetime .ft-badge { display:flex; align-items:center; gap:5px; height:26px; padding:0 10px; border-radius:13px; background:rgba(0,0,0,.35); font-size:13px; font-weight:500; color:rgba(255,255,255,.85);
      animation:ft-pop .35s ${EASE}; }
    .app-facetime .ft-badge svg { width:14px; height:14px; }
    @keyframes ft-pop { from { transform:scale(.7); opacity:0; } to { transform:none; opacity:1; } }

    .app-facetime .ft-sharebar { position:absolute; z-index:5; top:calc(var(--safe-top) + 6px); left:50%; display:flex; align-items:center; gap:8px; height:36px; padding:0 6px 0 14px; border-radius:18px;
      background:#6E5CF6; color:#fff; font-size:14px; font-weight:600; letter-spacing:-.2px; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,.35);
      transform:translate(-50%,-90px); opacity:0; transition:transform .4s ${EASE}, opacity .3s; }
    .app-facetime .ft-call.sharing .ft-sharebar { transform:translate(-50%,0); opacity:1; }
    .app-facetime .ft-sharebar em { width:8px; height:8px; border-radius:50%; background:#fff; animation:ft-dot 1.6s infinite; }
    .app-facetime .ft-sharebar button { height:26px; padding:0 11px; border:0; border-radius:13px; background:rgba(255,255,255,.24); color:#fff; font-size:13px; font-weight:600; }
    .app-facetime .ft-sharebar button:active { opacity:.6; }

    .app-facetime .ft-pip { position:absolute; left:0; top:0; z-index:3; width:110px; height:160px; border-radius:16px; overflow:hidden; background:#1c1c1e; touch-action:none; cursor:grab;
      box-shadow:0 10px 30px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.16); will-change:transform;
      transition:transform .46s cubic-bezier(.3,1.32,.5,1), width .36s ${EASE}, height .36s ${EASE}, opacity .3s; }
    .app-facetime .ft-pip.dragging { transition:width .36s ${EASE}, height .36s ${EASE}; cursor:grabbing; box-shadow:0 18px 44px rgba(0,0,0,.6), 0 0 0 .5px rgba(255,255,255,.2); }
    .app-facetime .ft-pip.big { width:156px; height:226px; border-radius:20px; }
    .app-facetime .ft-pip.noanim { transition:none; }
    .app-facetime .ft-call.audio .ft-pip { opacity:0; pointer-events:none; }
    .app-facetime .ft-pip video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); opacity:0; transition:opacity .35s; background:#000; pointer-events:none; }
    .app-facetime .ft-pip.unmirror video { transform:none; }
    .app-facetime .ft-pip[data-state="live"] video { opacity:1; }
    .app-facetime .ft-pip.flipping video { opacity:0; }
    .app-facetime .ft-pip-tile { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:8px; text-align:center;
      background:linear-gradient(180deg,#2c2c2e,#1c1c1e); color:rgba(255,255,255,.62); font-size:11px; font-weight:500; line-height:13px; transition:opacity .3s; pointer-events:none; }
    .app-facetime .ft-pip[data-state="live"] .ft-pip-tile { opacity:0; }
    .app-facetime .ft-pip-tile svg { width:26px; height:26px; }
    .app-facetime .ft-pip[data-state="loading"] .ft-pip-tile svg { animation:ft-dot 1.3s infinite; }
    .app-facetime .ft-flip { position:absolute; right:8px; bottom:8px; width:34px; height:34px; padding:0; border:0; border-radius:50%; background:rgba(40,40,44,.72); color:#fff;
      -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(.6); pointer-events:none;
      transition:opacity .25s, transform .3s ${EASE}; }
    .app-facetime .ft-flip svg { width:19px; height:19px; }
    .app-facetime .ft-pip.big[data-state="live"] .ft-flip { opacity:1; transform:none; pointer-events:auto; }

    .app-facetime .ft-panel { position:absolute; z-index:4; left:10px; right:10px; bottom:calc(var(--safe-bottom) + 8px); padding:14px 16px 16px; border-radius:30px; box-sizing:border-box;
      background:rgba(44,44,48,.7); -webkit-backdrop-filter:blur(34px) saturate(180%); backdrop-filter:blur(34px) saturate(180%); box-shadow:0 0 0 .5px rgba(255,255,255,.1) inset, 0 12px 40px rgba(0,0,0,.35);
      transition:transform .42s ${EASE}, opacity .3s; }
    .app-facetime .ft-call.bare .ft-panel, .app-facetime .ft-call[data-state="unavailable"] .ft-panel { transform:translateY(calc(100% + 60px)); opacity:0; pointer-events:none; }
    .app-facetime .ft-panel-head { display:flex; align-items:center; gap:10px; padding:0 4px 14px; }
    .app-facetime .ft-panel-head .t { flex:1; min-width:0; }
    .app-facetime .ft-panel-name { font-size:17px; font-weight:600; letter-spacing:-.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .app-facetime .ft-panel-sub { display:flex; align-items:center; gap:4px; margin-top:1px; font-size:13px; color:rgba(255,255,255,.6); }
    .app-facetime .ft-panel-sub svg { width:14px; height:14px; }
    .app-facetime .ft-panel-timer { flex:none; font-size:15px; font-weight:500; color:#30D158; font-variant-numeric:tabular-nums; }
    .app-facetime .ft-btns { display:flex; justify-content:space-between; }
    .app-facetime .ft-cbtn { width:58px; height:58px; padding:0; border:0; border-radius:50%; background:rgba(255,255,255,.17); color:#fff; display:flex; align-items:center; justify-content:center;
      transition:background .25s, color .25s, transform .25s ${EASE}; }
    .app-facetime .ft-cbtn svg { width:28px; height:28px; }
    .app-facetime .ft-cbtn.on { background:#fff; color:#000; }
    .app-facetime .ft-cbtn.end { background:#FF3B30; }
    .app-facetime .ft-cbtn.end svg { width:26px; height:26px; }
    .app-facetime .ft-cbtn:active { transform:scale(.9); }

    .app-facetime .ft-unavail { position:absolute; z-index:4; left:0; right:0; bottom:calc(var(--safe-bottom) + 46px); display:flex; justify-content:center; gap:34px;
      transform:translateY(40px); opacity:0; pointer-events:none; transition:transform .42s ${EASE}, opacity .3s; }
    .app-facetime .ft-call[data-state="unavailable"] .ft-unavail { transform:none; opacity:1; pointer-events:auto; }
    .app-facetime .ft-ubtn { display:flex; flex-direction:column; align-items:center; gap:8px; width:84px; padding:0; border:0; background:none; color:#fff; font-size:13px; letter-spacing:-.1px; }
    .app-facetime .ft-ubtn i { width:66px; height:66px; border-radius:50%; background:rgba(255,255,255,.17); display:flex; align-items:center; justify-content:center; transition:transform .25s ${EASE}; }
    .app-facetime .ft-ubtn i svg { width:30px; height:30px; }
    .app-facetime .ft-ubtn.green i { background:#30D158; }
    .app-facetime .ft-ubtn:active i { transform:scale(.9); }

    /* ---------- New FaceTime sheet (rendered by OS.ui.sheet, outside the app root) ---------- */
    .app-facetime-sheet { padding-bottom:40px; color:var(--label); }
    .app-facetime-sheet svg { display:block; }
    .app-facetime-sheet .fts-to { display:flex; align-items:center; gap:8px; min-height:44px; margin:4px 16px 0; padding:0 0 0 2px; border-bottom:.5px solid var(--sep); }
    .app-facetime-sheet .fts-to > span { color:var(--label2); font-size:17px; letter-spacing:-.4px; }
    .app-facetime-sheet .fts-to input { flex:1; min-width:0; height:44px; border:0; outline:0; background:none; color:var(--label); font:inherit; font-size:17px; letter-spacing:-.4px; padding:0; }
    .app-facetime-sheet .fts-chip { display:none; align-items:center; gap:6px; height:30px; padding:0 6px 0 11px; border-radius:15px; background:var(--fill2); color:var(--green); font-size:16px; font-weight:500; }
    .app-facetime-sheet .fts-chip button { width:20px; height:20px; padding:0; border:0; border-radius:50%; background:var(--fill); color:var(--label2); display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .app-facetime-sheet .fts-chip button svg { width:12px; height:12px; }
    .app-facetime-sheet .fts-actions { display:flex; gap:10px; padding:16px 16px 6px; transition:opacity .25s; }
    .app-facetime-sheet .fts-actions.off { opacity:.38; }
    .app-facetime-sheet .fts-actions button { height:50px; border:0; border-radius:14px; display:flex; align-items:center; justify-content:center; gap:7px; font:inherit; font-size:17px; font-weight:600;
      letter-spacing:-.4px; cursor:pointer; transition:transform .25s ${EASE}, filter .2s; }
    .app-facetime-sheet .fts-actions button:active { transform:scale(.96); filter:brightness(.85); }
    .app-facetime-sheet .fts-actions svg { width:23px; height:23px; }
    .app-facetime-sheet .fts-audio { flex:none; width:64px; background:var(--fill); color:var(--green); }
    .app-facetime-sheet .fts-video { flex:1; background:var(--green); color:#fff; }
    .app-facetime-sheet .fts-av { flex:none; width:40px; height:40px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .app-facetime-sheet .ios-row { min-height:58px; cursor:pointer; }
    .app-facetime-sheet .fts-none { padding:30px 32px; text-align:center; color:var(--label2); font-size:15px; line-height:20px; }
  `);

  /* ------------------------------------------------------------------ helpers */
  function digitsOf(s) { return String(s || '').replace(/\D/g, ''); }
  function formatPhone(s) {
    const str = String(s || '').trim();
    if (/@/.test(str)) return str;
    const d = digitsOf(str);
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return str;
  }
  function looksCallable(s) {
    const str = String(s || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return true;
    return /^[\d\s()+\-.]+$/.test(str) && digitsOf(str).length >= 3;
  }
  function contactName(c) {
    const n = safe(() => OS.contacts.name(c));
    return (n && String(n).trim()) || [c.first, c.last].filter(Boolean).join(' ') || formatPhone(c.phone) || c.email || 'Unknown';
  }
  function allContacts() { const a = safe(() => OS.contacts.all()); return Array.isArray(a) ? a.slice() : []; }
  function findContact(idOrPhone) { if (idOrPhone == null || idOrPhone === '') return null; return safe(() => OS.contacts.find(idOrPhone)) || null; }
  function initialsOf(c) {
    if (!c) return '';
    const a = (c.first || '').trim(), b = (c.last || '').trim();
    return ((a[0] || '') + (b[0] || '')).toUpperCase();
  }
  function monoHTML(contact, size) {
    const color = (contact && contact.color) || '#8E8E93';
    const txt = contact ? (contact.emoji || initialsOf(contact)) : '';
    const inner = txt ? esc(txt) : `<span style="display:block;width:${Math.round(size * 0.56)}px;height:${Math.round(size * 0.56)}px">${G.person}</span>`;
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;` +
      `font-weight:600;font-size:${Math.round(size * (contact && contact.emoji ? 0.5 : 0.4))}px;letter-spacing:-.3px;background-color:${esc(color)};` +
      `background-image:linear-gradient(180deg,rgba(255,255,255,.28),rgba(0,0,0,.12))">${inner}</div>`;
  }
  function avatarHTML(contact, size) {
    if (contact && contact.id != null) { const h = safe(() => OS.contacts.avatar(contact, size)); if (h) return h; }
    return monoHTML(contact, size);
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }
  function durWords(sec) {
    if (!sec) return '';
    if (sec < 60) return sec + ' sec';
    const m = Math.round(sec / 60);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' hr ' + (m % 60) + ' min';
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function whenText(ts) {
    const d = new Date(ts), now = new Date();
    if (sameDay(d, now)) {
      const t = safe(() => U.time(d)) || (d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'));
      if (/[ap]m/i.test(t) || safe(() => OS.settings.get('use24h'))) return t;
      const ap = safe(() => U.ampm(d));
      return ap ? t + ' ' + ap : t;
    }
    return safe(() => U.relDate(d)) || d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' });
  }
  function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* ignore */ }
    safe(() => OS.ui.toast('Copied'));
  }
  function play(id, opts) { return safe(() => OS.sound.play(id, Object.assign({ category: 'media' }, opts || {}))) || null; }

  /* ------------------------------------------------------------------ state */
  let ctx = null, root = null, homeEl = null, topEl = null, scrollEl = null, listEl = null, editBtn = null, clearBtn = null;
  let editing = false, paused = true, lastParams = null;
  let call = null, callEl = null, els = null;
  let stream = null, camToken = 0;
  let ringSnd = null, tickTimer = 0, answerTimer = 0, levelTimer = 0, hideTimer = 0, islandOn = false;
  const pip = { x: 0, y: 0, corner: 'tr', big: false };
  const pendingTimeouts = new Set();
  function later(fn, ms) { const t = setTimeout(() => { pendingTimeouts.delete(t); fn(); }, ms); pendingTimeouts.add(t); return t; }

  /* ------------------------------------------------------------------ storage */
  function getRecents() { const r = OS.store.get(K_RECENTS, null); return Array.isArray(r) ? r : []; }
  function saveRecents(list) { OS.store.set(K_RECENTS, list.slice(0, 100)); }
  function getLinks() { const r = OS.store.get(K_LINKS, []); return Array.isArray(r) ? r : []; }
  function saveLinks(list) { OS.store.set(K_LINKS, list); }

  function seedRecents() {
    if (Array.isArray(OS.store.get(K_RECENTS, null))) return;
    const cs = allContacts().filter((c) => c && (c.phone || c.email));
    if (!cs.length) return;                       // try again next launch once contacts exist
    const favs = cs.filter((c) => c.favorite), rest = cs.filter((c) => !c.favorite);
    const pool = favs.concat(rest);
    const pick = (i) => pool[i % pool.length];
    const H = 3600e3, D = 24 * H, now = Date.now();
    const plan = [
      { i: 0, kind: 'video', dir: 'outgoing', ago: 2 * H + 14 * 60e3, duration: 754 },
      { i: 1, kind: 'video', dir: 'missed', ago: D + 3 * H, duration: 0 },
      { i: 2, kind: 'audio', dir: 'incoming', ago: 2 * D + 5 * H, duration: 318 },
      { i: 0, kind: 'video', dir: 'incoming', ago: 4 * D + 1 * H, duration: 1462 },
      { i: 3, kind: 'video', dir: 'outgoing', ago: 9 * D + 6 * H, duration: 95 },
    ];
    saveRecents(plan.map((p) => {
      const c = pick(p.i);
      return { id: U.uid(), contactId: c.id, number: c.phone || c.email || '', name: contactName(c), kind: p.kind, dir: p.dir, date: now - p.ago, duration: p.duration };
    }));
  }

  function entityFor(rec) {
    const contact = (rec.contactId != null && findContact(rec.contactId)) || findContact(rec.number);
    return { contact, number: (contact && (contact.phone || contact.email)) || rec.number || '', name: contact ? contactName(contact) : (rec.name || formatPhone(rec.number) || 'Unknown') };
  }
  function resolveTarget(to) {
    if (to && typeof to === 'object') {
      if (to.contact || to.number || to.name) return { contact: to.contact || null, number: to.number || '', name: to.name || (to.contact ? contactName(to.contact) : formatPhone(to.number)) };
      if (to.id != null) { const c0 = findContact(to.id) || to; return { contact: c0, number: c0.phone || c0.email || '', name: contactName(c0) }; }
    }
    const str = String(to == null ? '' : to).trim();
    const c = findContact(str) || (digitsOf(str) ? findContact(digitsOf(str)) : null);
    if (c) return { contact: c, number: c.phone || c.email || '', name: contactName(c) };
    return { contact: null, number: str, name: formatPhone(str) || 'Unknown' };
  }

  /* ------------------------------------------------------------------ landing */
  function buildHome() {
    homeEl = U.el(`
      <div class="ft-home">
        <div class="ft-top">
          <button class="ft-edit" type="button">Edit</button>
          <div class="ft-top-title">FaceTime</div>
          <button class="ft-clear" type="button" style="display:none">Clear</button>
        </div>
        <div class="ft-scroll ios-scroll">
          <div class="ft-title">FaceTime</div>
          <div class="ft-actions">
            <button class="ft-act" data-act="link" type="button">${G.link}<span>Create Link</span></button>
            <button class="ft-act green" data-act="new" type="button">${G.video}<span>New FaceTime</span></button>
          </div>
          <div class="ft-list"></div>
        </div>
      </div>`);
    root.appendChild(homeEl);
    topEl = homeEl.querySelector('.ft-top');
    scrollEl = homeEl.querySelector('.ft-scroll');
    listEl = homeEl.querySelector('.ft-list');
    editBtn = homeEl.querySelector('.ft-edit');
    clearBtn = homeEl.querySelector('.ft-clear');

    scrollEl.addEventListener('scroll', () => topEl.classList.toggle('scrolled', scrollEl.scrollTop > 40));
    editBtn.addEventListener('click', () => setEditing(!editing));
    clearBtn.addEventListener('click', async () => {
      const i = await OS.ui.alert({ title: 'Clear All Recents?', message: 'This removes every call from your FaceTime history.', buttons: [{ label: 'Cancel', style: 'cancel' }, { label: 'Clear All', style: 'destructive' }] });
      if (i === 1) { saveRecents([]); setEditing(false); renderHome(); safe(() => OS.badge('facetime', 0)); }
    });
    homeEl.querySelector('.ft-actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (editing) setEditing(false);
      if (b.dataset.act === 'new') openNewSheet(); else createLink();
    });
    listEl.addEventListener('click', onListClick);
  }

  function setEditing(on) {
    editing = !!on;
    if (!homeEl) return;
    homeEl.classList.toggle('editing', editing);
    editBtn.textContent = editing ? 'Done' : 'Edit';
    editBtn.classList.toggle('bold', editing);
    clearBtn.style.display = editing && getRecents().length ? '' : 'none';
  }

  function rowHTML(rec) {
    const ent = entityFor(rec);
    const missed = rec.dir === 'missed';
    const label = rec.kind === 'audio' ? 'FaceTime Audio' : 'FaceTime Video';
    return `
      <div class="ft-row" data-id="${esc(rec.id)}" data-type="rec">
        <button class="ft-del" data-act="del" type="button" aria-label="Delete"><i>${G.minus}</i></button>
        <div class="ft-row-main pressable" data-act="call">
          <div class="ft-av">${avatarHTML(ent.contact, 46)}</div>
          <div class="ft-row-text">
            <div class="ft-row-name${missed ? ' missed' : ''}">${esc(ent.name)}</div>
            <div class="ft-row-sub">${rec.kind === 'audio' ? G.phone : G.video}<span>${label}${rec.dir === 'outgoing' ? '' : missed ? ' · Missed' : ''}</span></div>
          </div>
        </div>
        <div class="ft-row-date">${esc(whenText(rec.date))}</div>
        <button class="ft-info" data-act="info" type="button" aria-label="Info">${G.info}</button>
      </div>`;
  }
  function linkRowHTML(l) {
    return `
      <div class="ft-row" data-id="${esc(l.id)}" data-type="link">
        <button class="ft-del" data-act="del" type="button" aria-label="Delete"><i>${G.minus}</i></button>
        <div class="ft-row-main pressable" data-act="info">
          <div class="ft-av linkav">${G.link}</div>
          <div class="ft-row-text">
            <div class="ft-row-name">FaceTime Link</div>
            <div class="ft-row-sub">${G.video}<span>FaceTime Video</span></div>
          </div>
        </div>
        <div class="ft-row-date">${esc(whenText(l.date))}</div>
        <button class="ft-info" data-act="info" type="button" aria-label="Info">${G.info}</button>
      </div>`;
  }

  function renderHome() {
    if (!listEl) return;
    const recents = getRecents().slice().sort((a, b) => b.date - a.date);
    const links = getLinks();
    const now = new Date(), weekAgo = Date.now() - 7 * 24 * 3600e3;
    const groups = [['Today', []], ['This Week', []], ['Earlier', []]];
    recents.forEach((r) => {
      const d = new Date(r.date);
      (sameDay(d, now) ? groups[0] : r.date >= weekAgo ? groups[1] : groups[2])[1].push(r);
    });
    let html = '';
    if (links.length) html += `<div class="ft-sec">Upcoming</div><div class="ft-group">${links.map(linkRowHTML).join('')}</div>`;
    groups.forEach(([title, items]) => {
      if (items.length) html += `<div class="ft-sec">${title}</div><div class="ft-group">${items.map(rowHTML).join('')}</div>`;
    });
    if (!html) html = `<div class="ft-empty"><b>No Recent Calls</b><span>FaceTime calls you make and receive will appear here.</span></div>`;
    listEl.innerHTML = html;
    editBtn.disabled = !recents.length && !links.length && !editing;
    if (editing) clearBtn.style.display = recents.length ? '' : 'none';
  }

  function removeRow(rowEl, type, id) {
    if (rowEl) { rowEl.style.height = rowEl.offsetHeight + 'px'; void rowEl.offsetHeight; rowEl.classList.add('gone'); }
    safe(() => OS.sound.play('trash'));
    if (type === 'link') saveLinks(getLinks().filter((l) => l.id !== id));
    else saveRecents(getRecents().filter((r) => r.id !== id));
    later(() => { renderHome(); if (editing && !getRecents().length && !getLinks().length) setEditing(false); }, 310);
  }

  function onListClick(e) {
    const actEl = e.target.closest('[data-act]'); if (!actEl) return;
    const rowEl = actEl.closest('.ft-row'); if (!rowEl) return;
    const id = rowEl.dataset.id, type = rowEl.dataset.type, act = actEl.dataset.act;
    if (act === 'del') return removeRow(rowEl, type, id);
    if (type === 'link') { const l = getLinks().find((x) => x.id === id); if (l) linkSheet(l, rowEl); return; }
    const rec = getRecents().find((x) => x.id === id); if (!rec) return;
    if (act === 'info') return recentSheet(rec, rowEl);
    if (editing) return;
    startCall(entityFor(rec), rec.kind === 'audio' ? 'audio' : 'video');
  }

  async function recentSheet(rec, rowEl) {
    const ent = entityFor(rec);
    const kindLabel = rec.kind === 'audio' ? 'FaceTime Audio' : 'FaceTime Video';
    const dirLabel = rec.dir === 'missed' ? 'Missed' : rec.dir === 'incoming' ? 'Incoming' : 'Outgoing';
    const dur = durWords(rec.duration);
    const buttons = [{ label: 'FaceTime Video' }, { label: 'FaceTime Audio' }, { label: 'Message' }];
    const hasPhone = !!digitsOf(ent.number) && !/@/.test(ent.number);
    if (hasPhone) buttons.push({ label: 'Call ' + formatPhone(ent.number) });
    buttons.push({ label: 'Delete', style: 'destructive' });
    const i = await OS.ui.actionSheet({ title: ent.name, message: `${dirLabel} ${kindLabel} · ${whenText(rec.date)}${dur ? ' · ' + dur : ''}`, buttons, cancel: 'Cancel' });
    const chosen = buttons[i] && buttons[i].label;
    if (!chosen) return;
    if (chosen === 'FaceTime Video') startCall(ent, 'video');
    else if (chosen === 'FaceTime Audio') startCall(ent, 'audio');
    else if (chosen === 'Message') OS.openApp('messages', { to: ent.contact ? ent.contact.id : ent.number });
    else if (chosen === 'Delete') removeRow(rowEl && rowEl.isConnected ? rowEl : null, 'rec', rec.id);
    else OS.openURL('tel:' + digitsOf(ent.number));
  }

  function newLinkURL() {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    const part = (n) => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
    return `https://facetime.example/join#v=1&p=${part(4)}-${part(4)}-${part(4)}`;
  }
  function createLink() {
    const link = { id: U.uid(), url: newLinkURL(), date: Date.now() };
    const links = getLinks(); links.unshift(link); saveLinks(links);
    renderHome();
    safe(() => OS.haptic('success'));
    if (scrollEl) scrollEl.scrollTop = 0;
    linkSheet(link, null);
  }
  async function linkSheet(link, rowEl) {
    const i = await OS.ui.actionSheet({
      title: 'FaceTime Link', message: link.url,
      buttons: [{ label: 'Copy Link' }, { label: 'Share via Messages' }, { label: 'Join' }, { label: 'Delete Link', style: 'destructive' }], cancel: 'Cancel',
    });
    if (i === 0) copyText(link.url);
    else if (i === 1) OS.openApp('messages', { body: link.url });
    else if (i === 2) startCall({ contact: null, number: '', name: 'FaceTime Link' }, 'video', { link: link.url });
    else if (i === 3) removeRow(rowEl && rowEl.isConnected ? rowEl : (listEl && listEl.querySelector(`.ft-row[data-type="link"][data-id="${link.id}"]`)), 'link', link.id);
  }

  /* ------------------------------------------------------------------ New FaceTime sheet */
  function openNewSheet() {
    let sheet = null, closed = false, picked = null, inputEl = null;
    const close = () => { if (closed) return; closed = true; safe(() => inputEl && inputEl.blur()); safe(() => sheet && sheet.close()); };

    const made = OS.ui.sheet({
      title: 'New FaceTime', height: 'large',
      left: { label: 'Cancel', onTap: close },
      render(body, sh) {
        if (sh && !sheet) sheet = sh;
        body.innerHTML = `
          <div class="app-facetime-sheet">
            <div class="fts-to"><span>To:</span><div class="fts-chip"><b style="font-weight:500"></b><button type="button" aria-label="Remove">${G.x}</button></div>
              <input type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Name, number or email"></div>
            <div class="fts-actions off">
              <button class="fts-audio" type="button" aria-label="FaceTime Audio">${G.phone}</button>
              <button class="fts-video" type="button">${G.video}<span>FaceTime</span></button>
            </div>
            <div class="ios-list-header">Suggested</div>
            <div class="fts-results"></div>
          </div>`;
        const wrap = body.querySelector('.app-facetime-sheet');
        const chip = wrap.querySelector('.fts-chip'), chipName = chip.querySelector('b');
        const actions = wrap.querySelector('.fts-actions'), results = wrap.querySelector('.fts-results');
        inputEl = wrap.querySelector('input');

        const currentTarget = () => picked || (looksCallable(inputEl.value) ? resolveTarget(inputEl.value) : null);
        const refreshActions = () => actions.classList.toggle('off', !currentTarget());
        const setPicked = (ent) => {
          picked = ent;
          chip.style.display = ent ? 'flex' : 'none';
          inputEl.style.display = ent ? 'none' : '';
          if (ent) { chipName.textContent = ent.name; inputEl.value = ''; safe(() => inputEl.blur()); } else { safe(() => inputEl.focus()); }
          renderResults(); refreshActions();
        };
        const renderResults = () => {
          const q = inputEl.value.trim().toLowerCase(), qd = digitsOf(q);
          let cs = allContacts().sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || contactName(a).localeCompare(contactName(b)));
          if (q) cs = cs.filter((c) => contactName(c).toLowerCase().includes(q) || (qd && digitsOf(c.phone).includes(qd)) || String(c.email || '').toLowerCase().includes(q));
          let html = '';
          if (cs.length) {
            html = '<div class="ios-list">' + cs.map((c) => `
              <div class="ios-row tappable" data-cid="${esc(c.id)}">
                <div class="fts-av">${avatarHTML(c, 40)}</div>
                <div style="flex:1;min-width:0"><div class="ios-row-label">${esc(contactName(c))}</div><div class="ios-row-sub">${esc(formatPhone(c.phone) || c.email || '')}</div></div>
              </div>`).join('') + '</div>';
          } else if (q && looksCallable(q)) {
            html = `<div class="ios-list"><div class="ios-row tappable" data-raw="1"><div class="fts-av">${monoHTML(null, 40)}</div><div class="ios-row-label">${esc(formatPhone(inputEl.value))}</div></div></div>`;
          } else {
            html = `<div class="fts-none">${q ? 'No matching contacts. Enter a full phone number or email address.' : 'No contacts yet. Enter a phone number or email address to start a FaceTime call.'}</div>`;
          }
          results.innerHTML = html;
        };
        const go = (kind) => {
          const t = currentTarget();
          if (!t) { safe(() => OS.haptic('error')); safe(() => inputEl.focus()); return; }
          close();
          startCall(t, kind);
        };

        inputEl.addEventListener('input', () => { renderResults(); refreshActions(); });
        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && looksCallable(inputEl.value)) setPicked(resolveTarget(inputEl.value)); });
        chip.querySelector('button').addEventListener('click', () => setPicked(null));
        results.addEventListener('click', (e) => {
          const row = e.target.closest('.ios-row'); if (!row) return;
          if (row.dataset.raw) return setPicked(resolveTarget(inputEl.value));
          const c = findContact(row.dataset.cid) || allContacts().find((x) => String(x.id) === row.dataset.cid);
          if (c) setPicked({ contact: c, number: c.phone || c.email || '', name: contactName(c) });
        });
        wrap.querySelector('.fts-audio').addEventListener('click', () => go('audio'));
        wrap.querySelector('.fts-video').addEventListener('click', () => go('video'));
        renderResults();
        setTimeout(() => { if (!closed && !picked) safe(() => inputEl.focus()); }, 420);
      },
    });
    if (made) sheet = made;
  }

  /* ------------------------------------------------------------------ call: lifecycle */
  function startCall(target, kind, opts) {
    opts = opts || {};
    if (!root) return;
    if (call) { if (call.state === 'unavailable') endCall({ silent: true, instant: true }); else return; }
    if (editing) setEditing(false);
    const ent = resolveTarget(target);
    call = {
      id: U.uid(), contact: ent.contact, number: ent.number, name: ent.name, kind: kind === 'audio' ? 'audio' : 'video',
      link: opts.link || null, state: 'ringing', startedAt: Date.now(), connectedAt: 0,
      muted: false, speaker: true, camOn: kind !== 'audio', mirrored: true, sharing: false, controls: true, logged: false,
      willAnswer: !opts.link && (opts.retry ? true : (ent.contact ? Math.random() > 0.2 : false)),
    };
    buildCallUI();
    safe(() => ctx.setStatusBar('light'));
    if (!call.link) {
      ringSnd = play('facetime_ring', { loop: true });
      const delay = call.willAnswer ? 4000 + Math.random() * 3000 : 9500 + Math.random() * 2500;
      answerTimer = setTimeout(() => { answerTimer = 0; if (!call) return; call.willAnswer ? goConnected() : goUnavailable(); }, delay);
    }
    tickTimer = setInterval(tick, 1000);
    if (call.kind === 'video' && !paused) acquireCamera();
    if (paused) islandStart();
  }

  function stopRing() { if (ringSnd) { safe(() => ringSnd.stop()); ringSnd = null; } }

  function goConnected() {
    if (!call) return;
    stopRing();
    call.state = 'connected'; call.connectedAt = Date.now();
    play('facetime_join');
    safe(() => OS.haptic('success'));
    startLevels();
    updateCallUI();
    armAutoHide();
    islandUpdate();
  }

  function goUnavailable() {
    if (!call) return;
    stopRing();
    call.state = 'unavailable';
    logCall(call);
    safe(() => OS.haptic('warning'));
    if (paused) {
      const name = call.name, ent = { contact: call.contact, number: call.number, name: call.name }, kind = call.kind;
      endCall({ silent: true, instant: true });
      safe(() => OS.notify({ appId: 'facetime', title: name, body: 'FaceTime Unavailable. Tap to try again.', sound: false, onTap() { OS.openApp('facetime', { to: ent.contact ? ent.contact.id : ent.number, audio: kind === 'audio' }); } }));
      return;
    }
    call.controls = true;
    clearTimeout(hideTimer); hideTimer = 0;
    updateCallUI();
    placePip(true);
  }

  function logCall(c) {
    if (!c || c.logged || c.link) return;
    c.logged = true;
    const duration = c.connectedAt ? Math.max(1, Math.round((Date.now() - c.connectedAt) / 1000)) : 0;
    const list = getRecents();
    list.unshift({ id: U.uid(), contactId: c.contact ? c.contact.id : null, number: c.number || '', name: c.name, kind: c.kind, dir: 'outgoing', date: c.startedAt, duration });
    saveRecents(list);
  }

  function endCall(o) {
    o = o || {};
    if (!call) return;
    const c = call, el = callEl;
    call = null; callEl = null; els = null;
    clearTimeout(answerTimer); answerTimer = 0;
    clearInterval(tickTimer); tickTimer = 0;
    clearTimeout(hideTimer); hideTimer = 0;
    stopLevels(); stopRing(); releaseCamera(); islandEnd();
    logCall(c);
    if (!o.silent) { play('facetime_leave'); safe(() => OS.haptic('medium')); }
    if (root) root.classList.remove('in-call');
    if (el) {
      if (o.instant) el.remove();
      else { el.classList.remove('in'); el.style.pointerEvents = 'none'; later(() => el.remove(), 400); }
    }
    renderHome();
  }

  function tick() {
    if (!call) return;
    updateTimerText();
    islandUpdate();
  }

  /* ------------------------------------------------------------------ call: UI */
  function buildCallUI() {
    if (callEl) callEl.remove();
    const c = call;
    const bigInner = c.link ? G.link : c.contact ? esc(c.contact.emoji || initialsOf(c.contact) || '') : '';
    callEl = U.el(`
      <div class="ft-call${c.kind === 'audio' ? ' audio' : ''}" data-state="ringing">
        <div class="ft-remote"><div class="ft-blob"></div><div class="ft-blob b"></div><div class="ft-vignette"></div>
          <div class="ft-center">
            <div class="ft-avwrap">
              <div class="ft-ring"></div><div class="ft-ring r2"></div><div class="ft-ring r3"></div>
              <div class="ft-level l2"></div><div class="ft-level"></div>
              <div class="ft-bigav${c.contact && c.contact.emoji ? ' emoji' : ''}">${bigInner || G.person}</div>
            </div>
            <div class="ft-name"></div>
            <div class="ft-status"></div>
            <div class="ft-badges"></div>
          </div>
        </div>
        <div class="ft-sharebar"><em></em><span>Sharing Your Screen</span><button type="button">Stop</button></div>
        <div class="ft-pip noanim" data-state="loading">
          <video autoplay playsinline muted></video>
          <div class="ft-pip-tile"><div class="ft-pip-ic">${G.video}</div><span></span></div>
          <button class="ft-flip" type="button" aria-label="Flip camera">${G.flip}</button>
        </div>
        <div class="ft-panel">
          <div class="ft-panel-head">
            <div class="ft-panel-av">${c.link ? `<div class="ft-av linkav" style="width:40px;height:40px">${G.link}</div>` : avatarHTML(c.contact, 40)}</div>
            <div class="t"><div class="ft-panel-name"></div><div class="ft-panel-sub"></div></div>
            <div class="ft-panel-timer"></div>
          </div>
          <div class="ft-btns">
            <button class="ft-cbtn" data-b="speaker" type="button" aria-label="Speaker">${G.speaker}</button>
            <button class="ft-cbtn" data-b="camera" type="button" aria-label="Camera"></button>
            <button class="ft-cbtn" data-b="mute" type="button" aria-label="Mute"></button>
            <button class="ft-cbtn" data-b="share" type="button" aria-label="Share">${G.share}</button>
            <button class="ft-cbtn end" data-b="end" type="button" aria-label="End">${G.x}</button>
          </div>
        </div>
        <div class="ft-unavail">
          <button class="ft-ubtn" data-u="cancel" type="button"><i>${G.x}</i><span>Cancel</span></button>
          <button class="ft-ubtn" data-u="message" type="button"><i>${G.message}</i><span>Message</span></button>
          <button class="ft-ubtn green" data-u="again" type="button"><i>${G.video}</i><span>Call Again</span></button>
        </div>
      </div>`);
    callEl.style.setProperty('--c', (c.contact && c.contact.color) || (c.link ? '#30B0C7' : '#5E5CE6'));
    root.appendChild(callEl);
    els = {
      remote: callEl.querySelector('.ft-remote'), name: callEl.querySelector('.ft-name'), status: callEl.querySelector('.ft-status'), badges: callEl.querySelector('.ft-badges'),
      pip: callEl.querySelector('.ft-pip'), video: callEl.querySelector('video'), tileIc: callEl.querySelector('.ft-pip-ic'), tileTxt: callEl.querySelector('.ft-pip-tile span'),
      panel: callEl.querySelector('.ft-panel'), pName: callEl.querySelector('.ft-panel-name'), pSub: callEl.querySelector('.ft-panel-sub'), pTimer: callEl.querySelector('.ft-panel-timer'),
      lv1: callEl.querySelector('.ft-level:not(.l2)'), lv2: callEl.querySelector('.ft-level.l2'), againIcon: callEl.querySelector('[data-u="again"] i'),
      btn: {},
    };
    callEl.querySelectorAll('.ft-cbtn').forEach((b) => { els.btn[b.dataset.b] = b; });

    els.remote.addEventListener('click', toggleControls);
    els.panel.addEventListener('click', onPanelClick);
    callEl.querySelector('.ft-unavail').addEventListener('click', onUnavailClick);
    callEl.querySelector('.ft-sharebar').addEventListener('click', () => setSharing(false));
    setupPipDrag();

    pip.corner = 'tr'; pip.big = false;
    updateCallUI();
    placePip(false);
    root.classList.add('in-call');
    const el = callEl;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('in'); if (els && els.pip) els.pip.classList.remove('noanim'); }));
  }

  function updateTimerText() {
    if (!call || !els) return;
    const c = call;
    const t = c.connectedAt ? fmtDur((Date.now() - c.connectedAt) / 1000) : '';
    els.pTimer.textContent = c.state === 'connected' ? t : '';
    if (c.state === 'connected') els.status.textContent = t;
  }

  function updateCallUI() {
    if (!call || !callEl || !els) return;
    const c = call;
    callEl.dataset.state = c.state;
    callEl.classList.toggle('audio', c.kind === 'audio');
    callEl.classList.toggle('bare', !c.controls && c.state === 'connected');
    callEl.classList.toggle('sharing', !!c.sharing);
    els.name.textContent = c.name;
    els.pName.textContent = c.name;
    els.pSub.innerHTML = (c.kind === 'audio' ? G.phone : G.video) + `<span>${c.kind === 'audio' ? 'FaceTime Audio' : 'FaceTime Video'}</span>`;
    if (c.state === 'ringing') els.status.innerHTML = c.link ? 'Waiting for others to join<span class="ft-dots"><i>.</i><i>.</i><i>.</i></span>' : 'Calling<span class="ft-dots"><i>.</i><i>.</i><i>.</i></span>';
    else if (c.state === 'unavailable') els.status.textContent = 'FaceTime Unavailable';
    updateTimerText();

    const badges = [];
    if (c.state === 'connected' || c.state === 'ringing') {
      if (c.muted) badges.push(`<div class="ft-badge">${G.micOff}<span>Muted</span></div>`);
      if (!c.speaker && c.state === 'connected') badges.push(`<div class="ft-badge">${G.phone}<span>iPhone</span></div>`);
    }
    const bh = badges.join('');
    if (els.badges.dataset.h !== bh) { els.badges.dataset.h = bh; els.badges.innerHTML = bh; }

    const b = els.btn;
    b.speaker.classList.toggle('on', c.speaker);
    b.camera.classList.toggle('on', c.camOn);
    b.camera.innerHTML = c.camOn ? G.video : G.videoOff;
    b.mute.classList.toggle('on', c.muted);
    b.mute.innerHTML = c.muted ? G.micOff : G.mic;
    b.share.classList.toggle('on', !!c.sharing);
    els.againIcon.innerHTML = c.kind === 'audio' ? G.phone : G.video;
    els.pip.classList.toggle('unmirror', !c.mirrored);
  }

  function armAutoHide() {
    clearTimeout(hideTimer); hideTimer = 0;
    if (!call || call.state !== 'connected' || call.kind !== 'video' || !call.controls || paused) return;
    hideTimer = setTimeout(() => { hideTimer = 0; if (call && call.state === 'connected' && call.kind === 'video' && !paused) { call.controls = false; updateCallUI(); placePip(true); } }, 7000);
  }
  function toggleControls() {
    if (!call || call.state !== 'connected') return;
    call.controls = !call.controls;
    updateCallUI(); placePip(true); armAutoHide();
  }

  function onPanelClick(e) {
    const btn = e.target.closest('.ft-cbtn');
    if (!call) return;
    armAutoHide();
    if (!btn) return;
    const c = call;
    switch (btn.dataset.b) {
      case 'speaker': c.speaker = !c.speaker; safe(() => OS.haptic('light')); break;
      case 'mute': c.muted = !c.muted; safe(() => OS.haptic('light')); break;
      case 'camera':
        safe(() => OS.haptic('light'));
        if (c.camOn) { c.camOn = false; releaseCamera(); setPipState('off'); }
        else { c.camOn = true; if (c.kind === 'audio') { c.kind = 'video'; } acquireCamera(); }
        break;
      case 'share': shareSheet(); return;
      case 'end': endCall(); return;
    }
    updateCallUI();
    placePip(true);
  }

  async function shareSheet() {
    if (!call) return;
    const c = call, first = c.contact ? (c.contact.first || c.name) : c.name;
    const buttons = [{ label: c.sharing ? 'Stop Sharing My Screen' : 'Share My Screen' }, { label: 'Copy Link' }];
    if (!c.link) buttons.push({ label: 'Message ' + first });
    clearTimeout(hideTimer); hideTimer = 0;
    const i = await OS.ui.actionSheet({ title: 'Share', message: c.sharing ? 'Everyone on the call can see your screen.' : 'Share your screen or invite others with a link.', buttons, cancel: 'Cancel' });
    if (call !== c) return;
    if (i === 0) setSharing(!c.sharing);
    else if (i === 1) { if (!c.link) c.link2 = c.link2 || newLinkURL(); copyText(c.link || c.link2); }
    else if (i === 2) OS.openApp('messages', { to: c.contact ? c.contact.id : c.number });
    armAutoHide();
  }
  function setSharing(on) {
    if (!call) return;
    call.sharing = !!on;
    safe(() => OS.haptic(on ? 'success' : 'light'));
    updateCallUI(); placePip(true);
  }

  function onUnavailClick(e) {
    const b = e.target.closest('.ft-ubtn'); if (!b || !call) return;
    const ent = { contact: call.contact, number: call.number, name: call.name }, kind = call.kind;
    if (b.dataset.u === 'cancel') endCall({ silent: true });
    else if (b.dataset.u === 'message') { endCall({ silent: true }); OS.openApp('messages', { to: ent.contact ? ent.contact.id : ent.number }); }
    else { endCall({ silent: true, instant: true }); startCall(ent, kind, { retry: true }); }
  }

  /* ------------------------------------------------------------------ remote "audio level" life */
  function startLevels() {
    stopLevels();
    if (!call || call.state !== 'connected' || paused) return;
    let talking = true, until = 0;
    levelTimer = setInterval(() => {
      if (!els) return;
      const now = Date.now();
      if (now > until) { talking = Math.random() > 0.35; until = now + 900 + Math.random() * 2600; }
      const v = talking ? 0.25 + Math.random() * 0.75 : Math.random() * 0.08;
      els.lv1.style.transform = `scale(${(1 + v * 0.13).toFixed(3)})`;
      els.lv2.style.transform = `scale(${(1 + v * 0.2).toFixed(3)})`;
    }, 210);
  }
  function stopLevels() { if (levelTimer) { clearInterval(levelTimer); levelTimer = 0; } }

  /* ------------------------------------------------------------------ self view (PiP) */
  function pipSize() { return pip.big ? [156, 226] : [110, 160]; }
  function screenSize() { return [(root && root.offsetWidth) || 402, (root && root.offsetHeight) || 874]; }
  function pipBounds() {
    const [w, h] = pipSize(), [W, H] = screenSize();
    const top = 62 + 8 + (call && call.sharing ? 44 : 0);
    let bottomInset = 34 + 16;
    if (call && call.state === 'unavailable') bottomInset = 34 + 46 + 100 + 14;
    else if (call && (call.controls || call.state !== 'connected') && els && els.panel) bottomInset = 34 + 8 + (els.panel.offsetHeight || 150) + 12;
    return { left: 12, right: W - 12 - w, top, bottom: Math.max(top, H - bottomInset - h) };
  }
  function placePip(animated) {
    if (!els || !els.pip) return;
    const b = pipBounds();
    pip.x = pip.corner[1] === 'l' ? b.left : b.right;
    pip.y = pip.corner[0] === 't' ? b.top : b.bottom;
    if (!animated) { els.pip.classList.add('noanim'); void els.pip.offsetWidth; }
    els.pip.style.transform = `translate3d(${pip.x}px,${pip.y}px,0)`;
    if (!animated) { void els.pip.offsetWidth; els.pip.classList.remove('noanim'); }
  }
  function setupPipDrag() {
    const el = els.pip;
    let start = null, origin = null, moved = false, lastDragEnd = 0;
    // Taps arrive as ordinary clicks (the OS only reports a drag once the pointer has really moved).
    el.addEventListener('click', (e) => {
      if (!call || moved || Date.now() - lastDragEnd < 120) return;
      if (e.target.closest && e.target.closest('.ft-flip')) { flipCamera(); armAutoHide(); return; }
      pip.big = !pip.big; el.classList.toggle('big', pip.big);
      safe(() => OS.haptic('light'));
      placePip(true); armAutoHide();
    });
    U.drag(el, {
      onStart(p) {
        if (!call) return;
        start = p ? { x: p.x - (p.dx || 0), y: p.y - (p.dy || 0) } : null; origin = { x: pip.x, y: pip.y }; moved = false;
      },
      onMove(p) {
        if (!call || !origin || !p) return;
        if (!start) start = { x: p.x - (p.dx || 0), y: p.y - (p.dy || 0) };
        const dx = p.x - start.x, dy = p.y - start.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        if (!moved) { moved = true; el.classList.add('dragging'); clearTimeout(hideTimer); hideTimer = 0; }
        const [w, h] = pipSize(), [W, H] = screenSize();
        pip.x = U.clamp(origin.x + dx, -w * 0.3, W - w * 0.7);
        pip.y = U.clamp(origin.y + dy, 20, H - h * 0.7);
        el.style.transform = `translate3d(${pip.x}px,${pip.y}px,0)`;
      },
      onEnd() {
        el.classList.remove('dragging');
        const wasMoved = moved;
        origin = null; start = null; moved = false;
        if (!call || !wasMoved) return;
        lastDragEnd = Date.now();
        const [w, h] = pipSize(), [W, H] = screenSize();
        const cx = pip.x + w / 2, cy = pip.y + h / 2;
        pip.corner = (cy < H / 2 ? 't' : 'b') + (cx < W / 2 ? 'l' : 'r');
        safe(() => OS.haptic('selection'));
        placePip(true);
        armAutoHide();
      },
    });
  }
  function flipCamera() {
    if (!call || !els) return;
    const p = els.pip;
    p.classList.add('flipping');
    safe(() => OS.haptic('light'));
    later(() => { if (!call || !els || els.pip !== p) return; call.mirrored = !call.mirrored; p.classList.toggle('unmirror', !call.mirrored); p.classList.remove('flipping'); }, 260);
  }

  function setPipState(st) {
    if (!els || !els.pip) return;
    els.pip.dataset.state = st;
    if (st === 'off') { els.tileIc.innerHTML = G.videoOff; els.tileTxt.textContent = 'Camera Off'; }
    else if (st === 'unavailable') { els.tileIc.innerHTML = G.videoOff; els.tileTxt.textContent = 'Camera Unavailable'; }
    else if (st === 'loading') { els.tileIc.innerHTML = G.video; els.tileTxt.textContent = ''; }
  }

  async function acquireCamera() {
    if (!call || !els || !call.camOn) return;
    const token = ++camToken;
    if (stream) { attachStream(stream); return; }
    setPipState('loading');
    const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!md || !md.getUserMedia) { setPipState('unavailable'); return; }
    let s = null;
    try { s = await md.getUserMedia({ video: { facingMode: 'user' }, audio: false }); }
    catch (err) { if (token === camToken && call) setPipState('unavailable'); return; }
    if (token !== camToken || !call || !call.camOn || paused || !els) { stopTracks(s); return; }
    stream = s;
    s.getVideoTracks().forEach((t) => { t.onended = () => { if (stream === s) { stream = null; if (call && call.camOn) setPipState('unavailable'); } }; });
    attachStream(s);
  }
  function attachStream(s) {
    if (!els || !els.video) return;
    const v = els.video;
    try { v.srcObject = s; } catch (e) { setPipState('unavailable'); return; }
    const p = safe(() => v.play());
    if (p && p.catch) p.catch(() => {});
    setPipState('live');
  }
  function stopTracks(s) { safe(() => s.getTracks().forEach((t) => { t.onended = null; t.stop(); })); }
  function releaseCamera() {
    camToken++;
    if (stream) { stopTracks(stream); stream = null; }
    if (els && els.video) safe(() => { els.video.pause(); els.video.srcObject = null; });
  }

  /* ------------------------------------------------------------------ Dynamic Island */
  function islandParts() {
    const c = call;
    const glyph = c.kind === 'audio' ? G.phone : G.video;
    const t = c.connectedAt ? fmtDur((Date.now() - c.connectedAt) / 1000) : 'Calling';
    const leading = `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;color:#30D158"><span style="display:block;width:20px;height:20px">${glyph}</span></span>`;
    const trailing = `<span style="color:#30D158;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.2px">${esc(t)}</span>`;
    const expanded = `<div style="display:flex;align-items:center;gap:12px;padding:6px 4px;color:#fff">${c.link ? monoHTML(null, 44) : avatarHTML(c.contact, 44)}` +
      `<div style="flex:1;min-width:0"><div style="font-size:13px;color:rgba(255,255,255,.6)">${c.kind === 'audio' ? 'FaceTime Audio' : 'FaceTime Video'}</div>` +
      `<div style="font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div></div>` +
      `<div style="color:#30D158;font-size:20px;font-weight:600;font-variant-numeric:tabular-nums">${esc(t)}</div></div>`;
    return { leading, trailing, expanded };
  }
  function islandStart() {
    if (!call || islandOn || call.state === 'unavailable') return;
    islandOn = true;
    const p = islandParts();
    safe(() => OS.island.start({ id: ISLAND_ID, appId: 'facetime', leading: p.leading, trailing: p.trailing, expanded: p.expanded, onTap() { OS.openApp('facetime'); } }));
  }
  function islandUpdate() { if (islandOn && call) { const p = islandParts(); safe(() => OS.island.update(ISLAND_ID, p)); } }
  function islandEnd() { if (islandOn) { islandOn = false; safe(() => OS.island.end(ISLAND_ID)); } }

  /* ------------------------------------------------------------------ params */
  function handleParams(params) {
    if (!params || params === lastParams) return;
    lastParams = params;
    let to = params.to, audio = !!params.audio;
    if (to == null && typeof params.url === 'string') {
      const m = params.url.match(/^facetime(-audio)?:(?:\/\/)?(.+)$/i);
      if (m) { to = decodeURIComponent(m[2]); if (m[1]) audio = true; }
    }
    if (to == null || to === '') return;
    if (call && call.state !== 'unavailable') return;          // already on a call: just bring it forward
    startCall(to, audio ? 'audio' : 'video');
  }

  /* ------------------------------------------------------------------ app */
  OS.registerApp({
    id: 'facetime',
    name: 'FaceTime',
    icon: {
      bg: 'linear-gradient(180deg,#62F57B 0%,#0BBD2B 100%)',
      glyph: `<svg viewBox="0 0 60 60"><rect x="10" y="19" width="28.5" height="22" rx="6.2" fill="#fff"/><path d="M41.5 27.2l7.3-5.4c1.1-.8 2.7 0 2.7 1.4v13.6c0 1.4-1.6 2.2-2.7 1.4l-7.3-5.4z" fill="#fff"/></svg>`,
    },
    system: true,
    statusBar: 'light',
    background: '#000',

    launch(c) {
      ctx = c; root = c.root;
      editing = false; lastParams = null; call = null; callEl = null; els = null;
      seedRecents();
      buildHome();
      renderHome();
    },

    onResume(c, params) {
      ctx = c; paused = false;
      safe(() => c.setStatusBar('light'));
      safe(() => OS.badge('facetime', 0));
      islandEnd();
      if (call) {
        if (call.kind === 'video' && call.camOn && !stream) acquireCamera();
        if (call.state === 'connected') { startLevels(); call.controls = true; }
        updateCallUI(); placePip(false); armAutoHide();
      } else if (!editing) {
        renderHome();
      }
      handleParams(params);
    },

    onPause() {
      paused = true;
      clearTimeout(hideTimer); hideTimer = 0;
      stopLevels();
      releaseCamera();                                     // never hold the camera in the background
      if (call && call.camOn && call.kind === 'video') setPipState('loading');
      if (call && call.state === 'unavailable') endCall({ silent: true, instant: true });
      else if (call) islandStart();
    },

    onClose() {
      if (call) endCall({ silent: true, instant: true });
      stopRing(); stopLevels(); releaseCamera(); islandEnd();
      clearTimeout(answerTimer); clearInterval(tickTimer); clearTimeout(hideTimer);
      answerTimer = tickTimer = hideTimer = 0;
      pendingTimeouts.forEach((t) => clearTimeout(t)); pendingTimeouts.clear();
      paused = true; editing = false; lastParams = null;
      ctx = root = homeEl = topEl = scrollEl = listEl = editBtn = clearBtn = null;
    },
  });
})();
