/* Camera — real viewfinder (getUserMedia) with a simulated-scene fallback.
   Modes: CINEMATIC · VIDEO · PHOTO · PORTRAIT · PANO. Saves through OS.photos. */
(function () {
  'use strict';

  const YELLOW = '#FFD60A';
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const W = 402;
  const MODES = [
    { id: 'cinematic', label: 'CINEMATIC' },
    { id: 'video', label: 'VIDEO' },
    { id: 'photo', label: 'PHOTO' },
    { id: 'portrait', label: 'PORTRAIT' },
    { id: 'pano', label: 'PANO' },
  ];
  const FILTERS = {
    original: ['Original', ''],
    vivid: ['Vivid', 'saturate(1.45) contrast(1.08)'],
    warm: ['Warm', 'sepia(.28) saturate(1.3) hue-rotate(-8deg)'],
    cool: ['Cool', 'saturate(1.1) hue-rotate(14deg) brightness(1.02)'],
    mono: ['Mono', 'grayscale(1)'],
    noir: ['Noir', 'grayscale(1) contrast(1.4) brightness(.9)'],
  };
  const DEPTHS = [['ƒ1.4', 14], ['ƒ2.8', 9], ['ƒ4.5', 5]];

  /* ---------- icons ---------- */
  const sv = (body, extra) => `<svg viewBox="0 0 24 24" ${extra || 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
  const BOLT = '<path d="M13.3 2.6 5.7 13.1c-.4.5-.1 1.1.5 1.1h4.5l-1.2 7c-.1.8.7 1.1 1.2.5l7.6-10.5c.4-.5.1-1.1-.5-1.1h-4.5l1.2-7c.1-.8-.7-1.1-1.2-.5z" fill="currentColor" stroke="none"/>';
  const I = {
    flashOn: sv(BOLT),
    flashOff: sv(BOLT + '<path d="M4.2 3.4 19.8 20.6" stroke="#000" stroke-width="4"/><path d="M4.2 3.4 19.8 20.6" stroke="currentColor" stroke-width="1.7"/>'),
    flashAuto: sv('<g transform="translate(-3 0)">' + BOLT + '</g><path d="M16.6 12.5 19 6l2.4 6.5M17.4 10.4h3.2" stroke-width="1.5"/>'),
    chev: sv('<path d="M6 14.6 12 8.9l6 5.7" stroke-width="2.4"/>'),
    live: sv('<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="9.4" stroke-dasharray="1.1 2.18"/>'),
    liveOff: sv('<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="9.4" stroke-dasharray="1.1 2.18"/><path d="M4 3.6 20 20.4" stroke="#000" stroke-width="4"/><path d="M4 3.6 20 20.4"/>'),
    flip: sv('<path d="M19.6 12a7.6 7.6 0 0 1-13.3 5M4.4 12a7.6 7.6 0 0 1 13.3-5"/><path d="M18.1 3.4v3.9h-3.9M5.9 20.6v-3.9h3.9"/>'),
    timer: sv('<circle cx="12" cy="13.2" r="7.8"/><path d="M12 13.2 15 9.6M9.8 2.8h4.4M12 2.8v2.6"/>'),
    exposure: sv('<circle cx="12" cy="12" r="9.2"/><path d="M6.8 9.6h4M8.8 7.6v4M13.4 15.2h3.8M16.6 6 7.4 18" stroke-width="1.5"/>'),
    filter: sv('<circle cx="12" cy="8.6" r="5.2"/><circle cx="8.4" cy="14.8" r="5.2"/><circle cx="15.6" cy="14.8" r="5.2"/>'),
    grid: sv('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke-width="1.3"/>'),
    aspect: sv('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M6.5 11V9h2.2M17.5 13v2h-2.2" stroke-width="1.5"/>'),
    sun: sv('<circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none"/><path d="M12 3.4v2.4M12 18.2v2.4M3.4 12h2.4M18.2 12h2.4M5.9 5.9l1.7 1.7M16.4 16.4l1.7 1.7M5.9 18.1l1.7-1.7M16.4 7.6l1.7-1.7" stroke-width="1.6"/>'),
    expand: sv('<path d="M9.5 14.5 4.5 19.5M4.5 15.2v4.3h4.3M14.5 9.5l5-5M19.5 8.8V4.5h-4.3" stroke-width="1.9"/>'),
    arrow: sv('<path d="M4 12h13M12 6.5l6 5.5-6 5.5" stroke-width="2.4"/>'),
  };

  /* ---------- styles ---------- */
  OS.addStyle('camera', `
    .app-camera { background:#000; color:#fff; user-select:none; -webkit-user-select:none; }
    .app-camera button { border:0; background:none; color:inherit; padding:0; margin:0; font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
    .app-camera svg { display:block; width:100%; height:100%; }
    .app-camera .cam-box { position:absolute; left:0; width:402px; top:118px; height:536px; overflow:hidden; background:#060606;
      transition: top .42s ${EASE}, height .42s ${EASE}; }
    .app-camera .cam-stage { position:absolute; inset:0; transition: transform .38s ${EASE}, filter .2s linear; will-change: transform; }
    .app-camera .cam-stage video, .app-camera .cam-stage canvas { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
    .app-camera .cam-depth { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .35s;
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      -webkit-mask-image: radial-gradient(ellipse 44% 40% at 50% 45%, transparent 52%, #000 100%);
      mask-image: radial-gradient(ellipse 44% 40% at 50% 45%, transparent 52%, #000 100%);
      background: radial-gradient(ellipse 80% 75% at 50% 45%, transparent 55%, rgba(0,0,0,.28) 100%); }
    .app-camera[data-mode="portrait"] .cam-depth, .app-camera[data-mode="cinematic"] .cam-depth { opacity:1; }
    .app-camera .cam-veil { position:absolute; inset:0; pointer-events:none; opacity:0; background:rgba(0,0,0,.3);
      -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); transition: opacity .22s; }
    .app-camera .cam-veil.on { opacity:1; transition-duration:.08s; }
    .app-camera .cam-grid { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .25s; }
    .app-camera .cam-grid.on { opacity:1; }
    .app-camera .cam-grid i { position:absolute; background:rgba(255,255,255,.42); box-shadow:0 0 1px rgba(0,0,0,.35); }
    .app-camera .cam-grid i:nth-child(1), .app-camera .cam-grid i:nth-child(2) { top:0; bottom:0; width:1px; }
    .app-camera .cam-grid i:nth-child(1) { left:33.333%; } .app-camera .cam-grid i:nth-child(2) { left:66.666%; }
    .app-camera .cam-grid i:nth-child(3), .app-camera .cam-grid i:nth-child(4) { left:0; right:0; height:1px; }
    .app-camera .cam-grid i:nth-child(3) { top:33.333%; } .app-camera .cam-grid i:nth-child(4) { top:66.666%; }

    .app-camera .cam-focus { position:absolute; width:76px; height:76px; margin:-38px 0 0 -38px; border:1.2px solid ${YELLOW}; opacity:0; pointer-events:none;
      box-shadow:0 0 2px rgba(0,0,0,.4); transition: opacity .4s; }
    .app-camera .cam-focus::before, .app-camera .cam-focus::after { content:''; position:absolute; }
    .app-camera .cam-focus::before { left:50%; top:0; bottom:0; width:1.2px; margin-left:-.6px; background:linear-gradient(${YELLOW} 0 6px, transparent 6px calc(100% - 6px), ${YELLOW} calc(100% - 6px)); }
    .app-camera .cam-focus::after { top:50%; left:0; right:0; height:1.2px; margin-top:-.6px; background:linear-gradient(90deg, ${YELLOW} 0 6px, transparent 6px calc(100% - 6px), ${YELLOW} calc(100% - 6px)); }
    .app-camera .cam-focus.show { opacity:1; animation: cam-focus-in .32s ${EASE}, cam-focus-pulse .42s .4s 2; }
    .app-camera .cam-focus.dim { opacity:.55; }
    .app-camera .cam-sunwrap { position:absolute; left:88px; top:-27px; width:22px; height:130px; color:${YELLOW}; }
    .app-camera .cam-focus.flipside .cam-sunwrap { left:-34px; }
    .app-camera .cam-sunline { position:absolute; left:10.4px; top:0; bottom:0; width:1.2px; background:${YELLOW}; opacity:0; transition:opacity .2s; }
    .app-camera .cam-focus.adjusting .cam-sunline { opacity:1; }
    .app-camera .cam-sun { position:absolute; left:0; top:54px; width:22px; height:22px; background:transparent; filter:drop-shadow(0 0 1px rgba(0,0,0,.5)); }
    .app-camera .cam-focus.adjusting .cam-sun { background:radial-gradient(circle, rgba(0,0,0,.0) 0 0); }
    @keyframes cam-focus-in { from { transform:scale(1.6); opacity:0; } to { transform:scale(1); opacity:1; } }
    @keyframes cam-focus-pulse { 50% { opacity:.45; } }

    .app-camera .cam-count { position:absolute; left:0; right:0; top:50%; margin-top:-80px; height:160px; line-height:160px; text-align:center; font-size:150px; font-weight:200;
      color:#fff; text-shadow:0 2px 24px rgba(0,0,0,.45); pointer-events:none; opacity:0; font-variant-numeric:tabular-nums; }
    .app-camera .cam-count.tick { animation: cam-count 1s ${EASE}; }
    @keyframes cam-count { 0% { opacity:0; transform:scale(1.5); } 18% { opacity:1; transform:scale(1); } 75% { opacity:1; } 100% { opacity:0; transform:scale(.9); } }

    .app-camera .cam-badge { position:absolute; left:50%; top:14px; transform:translate(-50%,-6px); padding:3px 7px; border-radius:5px; font-size:12px; font-weight:600; letter-spacing:.3px;
      background:${YELLOW}; color:#000; opacity:0; pointer-events:none; transition:opacity .25s, transform .25s ${EASE}; white-space:nowrap; }
    .app-camera .cam-badge.gray { background:rgba(60,60,60,.85); color:#fff; }
    .app-camera .cam-badge.on { opacity:1; transform:translate(-50%,0); }
    .app-camera[data-aspect="16:9"] .cam-badge { top:64px; }
    .app-camera .cam-light { position:absolute; left:50%; bottom:74px; transform:translateX(-50%); padding:3px 8px; border-radius:5px; background:${YELLOW}; color:#000; font-size:11.5px; font-weight:600;
      letter-spacing:.5px; opacity:0; transition:opacity .3s; pointer-events:none; }
    .app-camera[data-mode="portrait"] .cam-light { opacity:1; }

    .app-camera .cam-hint { position:absolute; left:50%; top:14px; transform:translateX(-50%); display:none; align-items:center; gap:6px; padding:6px 12px 6px 9px; border-radius:16px;
      background:rgba(30,30,32,.72); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); font-size:12.5px; font-weight:500; color:#fff; white-space:nowrap; }
    .app-camera .cam-hint.on { display:flex; animation: cam-fade .4s; }
    .app-camera .cam-hint b { width:7px; height:7px; border-radius:50%; background:#FF9F0A; display:block; }
    .app-camera .cam-hint span { color:${YELLOW}; font-weight:600; margin-left:2px; }
    .app-camera[data-aspect="16:9"] .cam-hint { top:60px; }
    @keyframes cam-fade { from { opacity:0; } to { opacity:1; } }
    .app-camera .cam-blink { position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; }
    .app-camera .cam-blink.go { animation: cam-blink .28s ease-out; }
    @keyframes cam-blink { 0% { opacity:.9; } 100% { opacity:0; } }

    .app-camera .cam-pano { position:absolute; left:14px; right:14px; top:50%; height:92px; margin-top:-46px; display:none; pointer-events:none; }
    .app-camera[data-mode="pano"] .cam-pano { display:block; animation: cam-fade .35s; }
    .app-camera .cam-pano-strip { position:absolute; inset:0; background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.35); overflow:hidden; }
    .app-camera .cam-pano-strip canvas { position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; }
    .app-camera .cam-pano-line { position:absolute; left:0; right:0; top:50%; height:1.5px; margin-top:-.75px; background:${YELLOW}; opacity:.9; }
    .app-camera .cam-pano-arrow { position:absolute; top:50%; left:0; width:34px; height:34px; margin:-17px 0 0 2px; color:#fff; filter:drop-shadow(0 0 2px rgba(0,0,0,.6)); transition:left .1s linear; }
    .app-camera .cam-pano-tip { position:absolute; left:0; right:0; top:104px; text-align:center; font-size:13.5px; font-weight:500; text-shadow:0 1px 3px rgba(0,0,0,.7); }

    .app-camera .cam-scrim { position:absolute; left:0; right:0; bottom:0; height:250px; pointer-events:none; opacity:0; transition:opacity .4s;
      background:linear-gradient(transparent, rgba(0,0,0,.55) 70%); }
    .app-camera .cam-scrim.top { top:0; bottom:auto; height:150px; background:linear-gradient(rgba(0,0,0,.5), transparent); }
    .app-camera[data-aspect="16:9"] .cam-scrim { opacity:1; }

    .app-camera .cam-top { position:absolute; left:0; right:0; top:64px; height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 22px; }
    .app-camera .cam-tbtn { width:34px; height:34px; padding:6px !important; border-radius:50%; transition: background .2s, color .2s, transform .2s ${EASE}; }
    .app-camera .cam-tbtn:active { transform:scale(.88); }
    .app-camera .cam-tbtn.yellow { color:${YELLOW}; }
    .app-camera .cam-tbtn.fill { background:${YELLOW}; color:#000; }
    .app-camera .cam-center { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; align-items:center; justify-content:center; }
    .app-camera .cam-chev { width:30px; height:30px; padding:5px !important; border-radius:50%; background:rgba(255,255,255,.14); transition: transform .35s ${EASE}, background .2s; }
    .app-camera .cam-chev.open { transform:rotate(180deg); background:rgba(255,255,255,.26); }
    .app-camera .cam-time { display:none; padding:3px 8px; border-radius:6px; font-size:16px; font-weight:400; letter-spacing:.2px; font-variant-numeric:tabular-nums; transition: background .25s; }
    .app-camera .cam-time.rec { background:#FF3B30; }
    .app-camera .cam-right { display:flex; align-items:center; justify-content:flex-end; min-width:70px; }
    .app-camera .cam-res { display:none; align-items:center; gap:5px; font-size:13px; font-weight:500; letter-spacing:.2px; }
    .app-camera .cam-res button { padding:6px 2px; }
    .app-camera .cam-res button:active { opacity:.5; }
    .app-camera .cam-res i { font-style:normal; opacity:.6; }
    .app-camera .cam-fnum { display:none; width:34px; height:34px; border-radius:50%; font-size:17px; font-style:italic; font-family:Georgia,'Times New Roman',serif; }
    .app-camera .cam-fnum:active { opacity:.5; }
    .app-camera[data-kind="video"] .cam-chev, .app-camera[data-kind="video"] .cam-live { display:none; }
    .app-camera[data-kind="video"] .cam-time, .app-camera[data-kind="video"] .cam-res { display:flex; }
    .app-camera[data-mode="portrait"] .cam-live, .app-camera[data-mode="pano"] .cam-live { display:none; }
    .app-camera[data-mode="portrait"] .cam-fnum { display:block; }
    .app-camera[data-mode="pano"] .cam-flash { visibility:hidden; }

    .app-camera .cam-zoom { position:absolute; left:50%; top:603px; transform:translateX(-50%); display:flex; align-items:center; gap:3px; padding:3px; border-radius:22px; background:rgba(0,0,0,.32);
      -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); transition: opacity .25s; }
    .app-camera .cam-zoom button { width:30px; height:30px; border-radius:50%; background:rgba(0,0,0,.38); font-size:11px; font-weight:600; letter-spacing:-.2px; color:#fff;
      transition: width .3s ${EASE}, height .3s ${EASE}, font-size .3s ${EASE}, color .2s; font-variant-numeric:tabular-nums; }
    .app-camera .cam-zoom button.on { width:38px; height:38px; font-size:12.5px; color:${YELLOW}; }
    .app-camera .cam-zoom button.wide { width:36px; height:36px; padding:9px; }
    .app-camera[data-mode="pano"] .cam-zoom { opacity:0; pointer-events:none; }

    .app-camera .cam-modes { position:absolute; left:0; right:0; top:656px; height:40px; overflow:hidden; transition:opacity .25s;
      -webkit-mask-image:linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent); mask-image:linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent); }
    .app-camera .cam-track { position:absolute; left:0; top:0; height:40px; display:flex; align-items:center; gap:4px; white-space:nowrap; transition: transform .38s ${EASE}; }
    .app-camera .cam-track button { padding:8px 10px; font-size:13px; font-weight:600; letter-spacing:.5px; color:#fff; text-shadow:0 0 3px rgba(0,0,0,.55); transition:color .25s; }
    .app-camera .cam-track button.on { color:${YELLOW}; }
    .app-camera .cam-opts { position:absolute; left:0; right:0; top:652px; height:48px; display:none; align-items:center; justify-content:center; gap:6px; padding:0 14px; }
    .app-camera.opts-open .cam-opts { display:flex; animation: cam-opts-in .3s ${EASE}; }
    .app-camera.opts-open .cam-modes { opacity:0; pointer-events:none; }
    @keyframes cam-opts-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .app-camera .cam-opt { width:44px; height:44px; padding:10px !important; border-radius:50%; flex:none; transition: transform .2s ${EASE}, color .2s; }
    .app-camera .cam-opt:active { transform:scale(.86); }
    .app-camera .cam-opt.set { color:${YELLOW}; }
    .app-camera .cam-opt.back { background:rgba(255,255,255,.16); color:${YELLOW}; margin-right:4px; }
    .app-camera .cam-val { padding:7px 11px; border-radius:16px; font-size:13.5px; font-weight:500; color:#fff; white-space:nowrap; transition: background .2s, color .2s; }
    .app-camera .cam-val.on { background:rgba(255,255,255,.18); color:${YELLOW}; font-weight:600; }
    .app-camera .cam-vals { display:flex; align-items:center; gap:2px; overflow-x:auto; scrollbar-width:none; }
    .app-camera .cam-vals::-webkit-scrollbar { display:none; }
    .app-camera .cam-ev { position:relative; width:250px; height:44px; cursor:ew-resize; }
    .app-camera .cam-ev-ruler { position:absolute; left:0; right:0; bottom:6px; height:12px;
      background-image:repeating-linear-gradient(90deg, rgba(255,255,255,.75) 0 1px, transparent 1px 10px); background-position:125px 0;
      -webkit-mask-image:linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent); mask-image:linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent); }
    .app-camera .cam-ev-mark { position:absolute; left:50%; bottom:4px; width:2px; height:18px; margin-left:-1px; border-radius:1px; background:${YELLOW}; }
    .app-camera .cam-ev-val { position:absolute; left:0; right:0; top:1px; text-align:center; font-size:13px; font-weight:600; color:${YELLOW}; font-variant-numeric:tabular-nums; }

    .app-camera .cam-bottom { position:absolute; left:0; right:0; top:716px; height:88px; }
    .app-camera .cam-thumb { position:absolute; left:30px; top:20px; width:48px; height:48px; border-radius:9px; background:#1c1c1e center/cover no-repeat; overflow:hidden;
      box-shadow:0 0 0 1px rgba(255,255,255,.14) inset; transition: transform .25s ${EASE}, opacity .25s; }
    .app-camera .cam-thumb:active { transform:scale(.9); }
    .app-camera .cam-thumb.pop { animation: cam-pop .4s ${EASE}; }
    @keyframes cam-pop { 0% { transform:scale(.7); } 60% { transform:scale(1.06); } 100% { transform:scale(1); } }
    .app-camera .cam-shutter { position:absolute; left:50%; top:8px; width:72px; height:72px; margin-left:-36px; border-radius:50%; box-shadow:0 0 0 4px #fff inset; }
    .app-camera .cam-shutter i { position:absolute; left:50%; top:50%; width:60px; height:60px; margin:-30px 0 0 -30px; border-radius:30px; background:#fff; display:block;
      transition: width .3s ${EASE}, height .3s ${EASE}, margin .3s ${EASE}, border-radius .3s ${EASE}, background .25s, transform .18s ${EASE}; }
    .app-camera .cam-shutter:active i { transform:scale(.88); }
    .app-camera[data-kind="video"] .cam-shutter i { background:#FF3B30; }
    .app-camera .cam-shutter.stop i { width:28px; height:28px; margin:-14px 0 0 -14px; border-radius:7px; }
    .app-camera .cam-round { position:absolute; right:30px; top:20px; width:48px; height:48px; padding:11px !important; border-radius:50%; background:rgba(255,255,255,.16);
      -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); transition: transform .25s ${EASE}, opacity .25s; }
    .app-camera .cam-round:active { transform:scale(.88); }
    .app-camera .cam-flip svg { transition: transform .5s ${EASE}; }
    .app-camera .cam-still { display:none; background:none; box-shadow:0 0 0 2.5px #fff inset; padding:0 !important; }
    .app-camera .cam-still::after { content:''; position:absolute; inset:6px; border-radius:50%; background:#fff; transition: transform .15s; }
    .app-camera .cam-still:active::after { transform:scale(.85); }
    .app-camera.recording .cam-modes, .app-camera.recording .cam-thumb, .app-camera.recording .cam-res { opacity:0; pointer-events:none; }
    .app-camera.recording .cam-flip { display:none; }
    .app-camera.recording .cam-still { display:block; }
    .app-camera.busy-pano .cam-modes, .app-camera.busy-pano .cam-thumb, .app-camera.busy-pano .cam-flip { opacity:0; pointer-events:none; }

    .app-camera .cam-flashscreen { position:absolute; inset:0; background:#fffdf5; opacity:0; pointer-events:none; transition:opacity .35s; z-index:20; }
    .app-camera .cam-flashscreen.on { opacity:1; transition-duration:.06s; }
    .app-camera .cam-fly { position:absolute; object-fit:cover; pointer-events:none; z-index:10; border-radius:0;
      transition: left .42s ${EASE}, top .42s ${EASE}, width .42s ${EASE}, height .42s ${EASE}, border-radius .42s ${EASE}, opacity .2s .3s; }
  `);

  /* ---------- simulated scene (used when the webcam is unavailable) ---------- */
  function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function ridgeY(x, seed) {
    return 0.5 + 0.28 * Math.sin(x * 1.0 + seed) + 0.16 * Math.sin(x * 2.3 + seed * 1.7) + 0.08 * Math.sin(x * 5.1 + seed * 2.9) + 0.04 * Math.sin(x * 11.3 + seed);
  }
  function drawBack(g, w, h, t) {
    const u = h / 960, hz = h * 0.62;
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#141845'); gr.addColorStop(.34, '#54388a'); gr.addColorStop(.63, '#dd5f80'); gr.addColorStop(.87, '#ffa460'); gr.addColorStop(1, '#ffd892');
    g.fillStyle = gr; g.fillRect(0, 0, w, hz + 1);
    for (let i = 0; i < 46; i++) {
      const y = rnd(i + 90) * hz * .42, a = (.25 + .75 * Math.abs(Math.sin(t * 1.3 + i * 2.1))) * (1 - y / (hz * .42));
      g.fillStyle = `rgba(255,255,255,${(a * .85).toFixed(3)})`;
      g.fillRect(rnd(i) * w, y, 1.7 * u, 1.7 * u);
    }
    const sx = w * .6, sy = hz - 46 * u + Math.sin(t * .13) * 6 * u;
    gr = g.createRadialGradient(sx, sy, 0, sx, sy, 300 * u);
    gr.addColorStop(0, 'rgba(255,246,214,.95)'); gr.addColorStop(.16, 'rgba(255,210,140,.6)'); gr.addColorStop(.5, 'rgba(255,140,100,.18)'); gr.addColorStop(1, 'rgba(255,120,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, hz);
    g.fillStyle = '#fff5d6'; g.beginPath(); g.arc(sx, sy, 44 * u, 0, 6.2832); g.fill();
    // clouds
    for (let i = 0; i < 6; i++) {
      const span = w + 520 * u, cx = ((rnd(i + 7) * span + t * (6 + i * 2.2) * u) % span) - 260 * u, cy = hz * (.16 + rnd(i + 31) * .5), s = (.7 + rnd(i + 3) * .9) * u;
      for (let k = 0; k < 5; k++) {
        const px = cx + (k - 2) * 46 * s, py = cy + Math.sin(k * 1.9 + i) * 9 * s, r = (52 - Math.abs(k - 2) * 11) * s;
        const cg = g.createRadialGradient(px, py, 0, px, py, r * 1.5);
        cg.addColorStop(0, `rgba(255,${190 + i * 8},${190 + i * 6},.34)`); cg.addColorStop(1, 'rgba(255,190,190,0)');
        g.fillStyle = cg; g.beginPath(); g.ellipse(px, py, r * 1.7, r * .62, 0, 0, 6.2832); g.fill();
      }
    }
    // ridges (far → near) with slow parallax drift
    const ridges = [[.2, 150, '#8a5a96', 3, 1.3, 330], [.5, 120, '#56357a', 7, 4.1, 250], [1, 84, '#2a1b47', 14, 7.7, 170]];
    for (const [, amp, col, speed, seed, scale] of ridges) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 1);
      for (let x = 0; x <= w + 8 * u; x += 8 * u) g.lineTo(x, hz - amp * u * ridgeY((x / u + t * speed) / scale, seed));
      g.lineTo(w, hz + 1); g.closePath(); g.fill();
    }
    // water
    gr = g.createLinearGradient(0, hz, 0, h);
    gr.addColorStop(0, '#f09a6e'); gr.addColorStop(.12, '#b9617f'); gr.addColorStop(.5, '#4a3274'); gr.addColorStop(1, '#14173d');
    g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    gr = g.createLinearGradient(0, hz, 0, hz + 70 * u);
    gr.addColorStop(0, 'rgba(30,18,60,.55)'); gr.addColorStop(1, 'rgba(30,18,60,0)');
    g.fillStyle = gr; g.fillRect(0, hz, w, 70 * u);
    for (let k = 0; k < 34; k++) {
      const p = k / 34, y = hz + 4 * u + Math.pow(p, 1.55) * (h - hz - 10 * u);
      const wid = (26 + k * 9) * u * (.55 + .45 * Math.sin(t * 2.1 + k * 1.7)), a = (.8 - p * .62) * (.6 + .4 * Math.sin(t * 3 + k * 2.3));
      g.fillStyle = `rgba(255,226,172,${Math.max(0, a).toFixed(3)})`;
      g.fillRect(sx - wid / 2 + Math.sin(t * 1.2 + k) * 7 * u, y, wid, (1.6 + p * 3.2) * u);
    }
    for (let k = 0; k < 40; k++) {
      const y = hz + 12 * u + rnd(k + 200) * (h - hz - 20 * u), x = ((rnd(k + 260) * w + t * (8 + k % 5) * u) % (w + 80 * u)) - 40 * u;
      g.fillStyle = `rgba(255,255,255,${(.05 + .07 * Math.sin(t * 2 + k)).toFixed(3)})`;
      g.fillRect(x, y, (30 + rnd(k) * 50) * u, 1.4 * u);
    }
    // sailboat
    const bx = ((t * 9 * u) % (w + 200 * u)) - 100 * u, by = hz + 58 * u + Math.sin(t * 1.4) * 2.5 * u, tilt = Math.sin(t * 1.1) * .04;
    g.save(); g.translate(bx, by); g.rotate(tilt);
    g.fillStyle = '#1d1233'; g.beginPath(); g.moveTo(-30 * u, 0); g.lineTo(30 * u, 0); g.lineTo(21 * u, 10 * u); g.lineTo(-23 * u, 10 * u); g.closePath(); g.fill();
    g.fillStyle = '#fbe6cf'; g.beginPath(); g.moveTo(2 * u, -4 * u); g.lineTo(2 * u, -66 * u); g.lineTo(30 * u, -4 * u); g.closePath(); g.fill();
    g.fillStyle = '#f0c8b0'; g.beginPath(); g.moveTo(-3 * u, -4 * u); g.lineTo(-3 * u, -52 * u); g.lineTo(-24 * u, -4 * u); g.closePath(); g.fill();
    g.restore();
    // birds
    g.strokeStyle = 'rgba(25,14,48,.85)'; g.lineWidth = 2 * u; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = ((t * (24 + i * 5) * u + rnd(i + 50) * w * 1.4) % (w + 120 * u)) - 60 * u, y = hz * (.22 + rnd(i + 60) * .3) + Math.sin(t * 1.5 + i) * 10 * u;
      const f = Math.sin(t * 7 + i * 2) * 5 * u, s = (9 + i * 1.5) * u;
      g.beginPath(); g.moveTo(x - s, y - f); g.quadraticCurveTo(x - s * .4, y - s * .45 - f * .3, x, y); g.quadraticCurveTo(x + s * .4, y - s * .45 - f * .3, x + s, y - f); g.stroke();
    }
  }
  function drawFront(g, w, h, t) {
    const u = h / 960;
    let gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2a2140'); gr.addColorStop(.55, '#6a4560'); gr.addColorStop(1, '#c47a62');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const x = rnd(i + 5) * w + Math.sin(t * .2 + i) * 22 * u, y = rnd(i + 25) * h * .8 + Math.cos(t * .17 + i * 2) * 16 * u, r = (34 + rnd(i + 45) * 70) * u;
      const bg = g.createRadialGradient(x, y, 0, x, y, r), c = ['255,190,120', '255,130,150', '140,170,255', '255,225,170'][i % 4];
      bg.addColorStop(0, `rgba(${c},.2)`); bg.addColorStop(.75, `rgba(${c},.14)`); bg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const cx = w / 2 + Math.sin(t * .7) * 9 * u, cy = h * .47 + Math.sin(t * 1.1) * 5 * u;
    gr = g.createLinearGradient(0, cy + 150 * u, 0, h);
    gr.addColorStop(0, '#3a97a6'); gr.addColorStop(1, '#1f5d6b');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, h + 60 * u, 330 * u, 330 * u, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#dda283'; g.beginPath(); g.moveTo(cx - 52 * u, cy + 90 * u); g.lineTo(cx + 52 * u, cy + 90 * u); g.lineTo(cx + 66 * u, cy + 225 * u);
    g.quadraticCurveTo(cx, cy + 270 * u, cx - 66 * u, cy + 225 * u); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,60,40,.25)'; g.beginPath(); g.ellipse(cx, cy + 142 * u, 60 * u, 22 * u, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#efb896'; g.beginPath(); g.ellipse(cx - 128 * u, cy + 8 * u, 18 * u, 30 * u, 0, 0, 6.2832); g.ellipse(cx + 128 * u, cy + 8 * u, 18 * u, 30 * u, 0, 0, 6.2832); g.fill();
    gr = g.createRadialGradient(cx - 30 * u, cy - 50 * u, 10 * u, cx, cy, 170 * u);
    gr.addColorStop(0, '#f9c9a8'); gr.addColorStop(1, '#eab08d');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 124 * u, 150 * u, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#35201a'; g.beginPath(); g.moveTo(cx - 130 * u, cy - 10 * u);
    g.bezierCurveTo(cx - 150 * u, cy - 150 * u, cx - 60 * u, cy - 196 * u, cx + 10 * u, cy - 186 * u);
    g.bezierCurveTo(cx + 110 * u, cy - 190 * u, cx + 152 * u, cy - 110 * u, cx + 130 * u, cy - 6 * u);
    g.bezierCurveTo(cx + 118 * u, cy - 70 * u, cx + 80 * u, cy - 104 * u, cx + 20 * u, cy - 102 * u);
    g.bezierCurveTo(cx - 40 * u, cy - 96 * u, cx - 104 * u, cy - 84 * u, cx - 130 * u, cy - 10 * u); g.fill();
    const blink = (t % 3.7) < .13;
    g.fillStyle = '#2a1a14'; g.strokeStyle = '#2a1a14'; g.lineWidth = 5 * u; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = cx + s * 46 * u, ey = cy - 12 * u;
      if (blink) { g.beginPath(); g.moveTo(ex - 12 * u, ey); g.lineTo(ex + 12 * u, ey); g.stroke(); }
      else { g.beginPath(); g.ellipse(ex, ey, 10 * u, 12 * u, 0, 0, 6.2832); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 3 * u, ey - 4 * u, 3 * u, 0, 6.2832); g.fill(); g.fillStyle = '#2a1a14'; }
      g.beginPath(); g.moveTo(ex - 20 * u, ey - 32 * u); g.quadraticCurveTo(ex, ey - 42 * u, ex + 20 * u, ey - 32 * u); g.stroke();
      g.fillStyle = 'rgba(240,110,110,.22)'; g.beginPath(); g.ellipse(cx + s * 74 * u, cy + 42 * u, 26 * u, 16 * u, 0, 0, 6.2832); g.fill(); g.fillStyle = '#2a1a14';
    }
    g.strokeStyle = 'rgba(170,100,80,.7)'; g.lineWidth = 4 * u; g.beginPath(); g.moveTo(cx - 4 * u, cy + 8 * u); g.quadraticCurveTo(cx - 12 * u, cy + 40 * u, cx + 6 * u, cy + 42 * u); g.stroke();
    g.strokeStyle = '#7a2f2a'; g.lineWidth = 6 * u; g.beginPath(); g.moveTo(cx - 40 * u, cy + 78 * u); g.quadraticCurveTo(cx, cy + (108 + Math.sin(t * .9) * 6) * u, cx + 40 * u, cy + 78 * u); g.stroke();
    gr = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.38)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function drawScene(g, w, h, t, facing) {
    g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (facing === 'front') drawFront(g, w, h, t); else drawBack(g, w, h, t);
    g.restore();
  }

  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function snd(id) { try { return OS.sound.play(id); } catch (e) { return null; } }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- one instance per process ---------- */
  function create(ctx) {
    const root = ctx.root;
    const S = Object.assign({ flash: 'off', live: true, timer: 0, ev: 0, aspect: '4:3', filter: 'original', grid: false, res: 'HD', fps: 30, depth: 1 },
      OS.store.get('camera.settings', {}) || {});
    S.ev = 0;
    let mode = 'photo', facing = 'back', zoom = 1, frontWide = false;
    let foreground = false, closed = false;
    let stream = null, streamToken = 0, acquiring = false, usingSim = false, pendingSimTimer = 0;
    let rafId = 0, lastSim = 0;
    let busy = false, optsOpen = false, optSel = null;
    let countdownTimer = 0, countdownLeft = 0;
    let rec = null;            // { recorder, canvas, g, chunks, start, mic, tick, poster, mime, stopping }
    let pano = null;           // { i, n, timer, canvas, g, wide }
    let focusTimer = 0, badgeTimer = 0, lastDrag = 0, thumbUrl = null;
    const timers = new Set();
    const depthTmp = { small: null, full: null };

    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const wait = ms => new Promise(r => later(r, ms));
    const save = () => { const o = Object.assign({}, S); delete o.ev; OS.store.set('camera.settings', o); };
    const isVideoMode = () => mode === 'video' || mode === 'cinematic';
    const simTime = () => performance.now() / 1000;

    root.innerHTML = `
      <div class="cam-box">
        <div class="cam-stage"><video playsinline muted autoplay></video><canvas class="cam-sim" width="720" height="960" style="display:none"></canvas></div>
        <div class="cam-depth"></div>
        <div class="cam-scrim top"></div><div class="cam-scrim"></div>
        <div class="cam-grid"><i></i><i></i><i></i><i></i></div>
        <div class="cam-focus"><div class="cam-sunwrap"><div class="cam-sunline"></div><div class="cam-sun">${I.sun}</div></div></div>
        <div class="cam-pano"><div class="cam-pano-strip"><canvas width="2400" height="800"></canvas><div class="cam-pano-line"></div></div>
          <div class="cam-pano-arrow">${I.arrow}</div><div class="cam-pano-tip">Move iPhone continuously when taking a Panorama.</div></div>
        <div class="cam-light">NATURAL LIGHT</div>
        <div class="cam-count"></div>
        <div class="cam-veil"></div>
        <div class="cam-blink"></div>
        <div class="cam-badge"></div>
        <button class="cam-hint"><b></b>Camera access needed<span>Retry</span></button>
      </div>
      <div class="cam-top">
        <button class="cam-tbtn cam-flash" aria-label="Flash"></button>
        <div class="cam-center"><button class="cam-chev" aria-label="Controls">${I.chev}</button><div class="cam-time">00:00:00</div></div>
        <div class="cam-right">
          <button class="cam-tbtn cam-live" aria-label="Live Photo"></button>
          <button class="cam-fnum" aria-label="Depth">ƒ</button>
          <div class="cam-res"><button data-r="res">HD</button><i>·</i><button data-r="fps">30</button></div>
        </div>
      </div>
      <div class="cam-zoom"></div>
      <div class="cam-modes"><div class="cam-track">${MODES.map(m => `<button data-mode="${m.id}">${m.label}</button>`).join('')}</div></div>
      <div class="cam-opts"></div>
      <div class="cam-bottom">
        <button class="cam-thumb" aria-label="Photos"></button>
        <button class="cam-shutter" aria-label="Shutter"><i></i></button>
        <button class="cam-round cam-flip" aria-label="Flip camera">${I.flip}</button>
        <button class="cam-round cam-still" aria-label="Take photo"></button>
      </div>
      <div class="cam-flashscreen"></div>`;

    const $ = s => root.querySelector(s);
    const box = $('.cam-box'), stage = $('.cam-stage'), video = $('video'), simCanvas = $('.cam-sim'), simG = simCanvas.getContext('2d');
    const focusEl = $('.cam-focus'), sunEl = $('.cam-sun'), countEl = $('.cam-count'), badgeEl = $('.cam-badge'), hintEl = $('.cam-hint');
    const veil = $('.cam-veil'), blinkEl = $('.cam-blink'), flashScreen = $('.cam-flashscreen');
    const flashBtn = $('.cam-flash'), chevBtn = $('.cam-chev'), liveBtn = $('.cam-live'), fnumBtn = $('.cam-fnum'), timeEl = $('.cam-time'), resEl = $('.cam-res');
    const zoomEl = $('.cam-zoom'), modesEl = $('.cam-modes'), track = $('.cam-track'), optsEl = $('.cam-opts');
    const thumbEl = $('.cam-thumb'), shutterEl = $('.cam-shutter'), flipBtn = $('.cam-flip'), stillBtn = $('.cam-still');
    const panoCanvas = $('.cam-pano-strip canvas'), panoArrow = $('.cam-pano-arrow'), panoTip = $('.cam-pano-tip');

    /* ----- geometry / look ----- */
    function aspectKey() { return isVideoMode() ? '16:9' : (mode === 'photo' ? S.aspect : '4:3'); }
    function boxGeom() { const a = aspectKey(); return a === '16:9' ? { top: 72, h: 715 } : a === '1:1' ? { top: 185, h: 402 } : { top: 118, h: 536 }; }
    function outSize() {
      const a = aspectKey();
      return a === '16:9' ? [1080, 1920] : a === '1:1' ? [1200, 1200] : [1200, 1600];
    }
    function scaleFor() { return facing === 'front' ? (frontWide ? 1 : 1.22) : Math.pow(zoom / 0.5, 0.5); }
    function cssFilter() {
      const parts = [];
      if (FILTERS[S.filter] && FILTERS[S.filter][1]) parts.push(FILTERS[S.filter][1]);
      if (S.ev) parts.push(`brightness(${Math.pow(2, S.ev * .5).toFixed(3)})`);
      return parts.join(' ');
    }
    function applyLook() {
      stage.style.transform = `scale(${scaleFor().toFixed(4)}) scaleX(${facing === 'front' ? -1 : 1})`;
      stage.style.filter = cssFilter() || 'none';
      $('.cam-grid').classList.toggle('on', !!S.grid);
      const blur = mode === 'cinematic' ? 8 : DEPTHS[S.depth][1];
      const d = $('.cam-depth'); d.style.backdropFilter = `blur(${blur}px)`; d.style.webkitBackdropFilter = `blur(${blur}px)`;
    }
    function applyLayout() {
      const g = boxGeom();
      box.style.top = g.top + 'px'; box.style.height = g.h + 'px';
      root.dataset.aspect = aspectKey();
      root.dataset.mode = mode;
      root.dataset.kind = isVideoMode() ? 'video' : 'photo';
    }
    function fmtZoom(z) { if (z < 1) return '.' + Math.round(z * 10); const r = Math.round(z * 10) / 10; return String(r % 1 === 0 ? r.toFixed(0) : r); }
    function pillsFor() { return (mode === 'portrait' || mode === 'cinematic') ? [1, 2] : [0.5, 1, 2]; }
    function renderZoom() {
      if (facing === 'front') { zoomEl.innerHTML = `<button class="wide" data-wide="1" aria-label="Field of view">${I.expand}</button>`; return; }
      const pills = pillsFor(); let active = pills[0];
      for (const p of pills) if (zoom >= p - 0.001) active = p;
      zoomEl.innerHTML = pills.map(p => `<button data-z="${p}" class="${p === active ? 'on' : ''}">${p === active ? fmtZoom(zoom) + 'x' : fmtZoom(p)}</button>`).join('');
    }
    function setZoom(z, quiet) {
      const min = pillsFor()[0];
      zoom = OS.util.clamp(z, min, 5);
      renderZoom(); applyLook();
      if (!quiet) OS.haptic('selection');
    }
    function renderTop() {
      flashBtn.innerHTML = S.flash === 'on' ? I.flashOn : S.flash === 'auto' ? I.flashAuto : I.flashOff;
      flashBtn.classList.toggle('fill', S.flash === 'on');
      flashBtn.classList.toggle('yellow', S.flash === 'auto');
      liveBtn.innerHTML = S.live ? I.live : I.liveOff;
      liveBtn.classList.toggle('yellow', !!S.live);
      chevBtn.classList.toggle('open', optsOpen);
      resEl.querySelector('[data-r="res"]').textContent = S.res;
      resEl.querySelector('[data-r="fps"]').textContent = S.fps;
    }
    function showBadge(text, yellow, ms) {
      badgeEl.textContent = text; badgeEl.classList.toggle('gray', !yellow); badgeEl.classList.add('on');
      clearTimeout(badgeTimer); timers.delete(badgeTimer);
      badgeTimer = later(() => badgeEl.classList.remove('on'), ms || 1300);
    }
    function blurSwitch() { veil.classList.add('on'); later(() => veil.classList.remove('on'), 300); }

    /* ----- modes ----- */
    function centerModes(animate) {
      const idx = MODES.findIndex(m => m.id === mode), lab = track.children[idx];
      if (!lab || !lab.offsetWidth) return;
      track.style.transition = animate === false ? 'none' : '';
      track.style.transform = `translateX(${W / 2 - (lab.offsetLeft + lab.offsetWidth / 2)}px)`;
      Array.from(track.children).forEach((b, i) => b.classList.toggle('on', i === idx));
    }
    function trackX() { const m = /translateX\((-?[\d.]+)px\)/.exec(track.style.transform || ''); return m ? parseFloat(m[1]) : 0; }
    function setMode(id, force) {
      if (rec || pano) { centerModes(); return; }
      if (id === mode && !force) { centerModes(); return; }
      cancelCountdown();
      mode = id;
      if (optsOpen) toggleOpts(false);
      if (facing === 'back' && zoom < pillsFor()[0]) zoom = pillsFor()[0];
      blurSwitch(); applyLayout(); renderZoom(); applyLook(); renderTop(); centerModes();
      hideFocus(); resetPanoUI();
      timeEl.textContent = '00:00:00';
      OS.haptic('selection');
    }
    function stepMode(d) { const i = MODES.findIndex(m => m.id === mode), n = OS.util.clamp(i + d, 0, MODES.length - 1); if (n !== i) setMode(MODES[n].id); }

    /* ----- options drawer ----- */
    const OPTS = [
      { id: 'flash', icon: () => S.flash === 'off' ? I.flashOff : S.flash === 'auto' ? I.flashAuto : I.flashOn, vals: [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], isSet: () => S.flash !== 'off' },
      { id: 'live', icon: () => S.live ? I.live : I.liveOff, vals: [[true, 'Live On'], [false, 'Live Off']], isSet: () => !!S.live },
      { id: 'timer', icon: () => I.timer, vals: [[0, 'Off'], [3, '3s'], [10, '10s']], isSet: () => S.timer > 0 },
      { id: 'ev', icon: () => I.exposure, slider: true, isSet: () => Math.abs(S.ev) > 0.04 },
      { id: 'aspect', icon: () => I.aspect, vals: [['4:3', '4:3'], ['1:1', 'Square'], ['16:9', '16:9']], isSet: () => S.aspect !== '4:3' },
      { id: 'filter', icon: () => I.filter, vals: Object.keys(FILTERS).map(k => [k, FILTERS[k][0]]), isSet: () => S.filter !== 'original' },
      { id: 'grid', icon: () => I.grid, vals: [[false, 'Grid Off'], [true, 'Grid On']], isSet: () => !!S.grid },
    ];
    function evLabel() { const v = Math.round(S.ev * 10) / 10; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1); }
    function updateEvUI() {
      const r = optsEl.querySelector('.cam-ev-ruler'), v = optsEl.querySelector('.cam-ev-val');
      if (r) r.style.backgroundPosition = `${125 - S.ev * 50}px 0`;
      if (v) v.textContent = evLabel();
      sunEl.style.transform = `translateY(${(-S.ev * 26).toFixed(1)}px)`;
    }
    function renderOpts() {
      if (!optSel) {
        optsEl.innerHTML = OPTS.map(o => `<button class="cam-opt ${o.isSet() ? 'set' : ''}" data-opt="${o.id}">${o.icon()}</button>`).join('');
        return;
      }
      const o = OPTS.find(x => x.id === optSel);
      let html = `<button class="cam-opt back" data-opt="">${o.icon()}</button>`;
      if (o.slider) html += `<div class="cam-ev"><div class="cam-ev-val"></div><div class="cam-ev-ruler"></div><div class="cam-ev-mark"></div></div>`;
      else html += `<div class="cam-vals">${o.vals.map((v, i) => `<button class="cam-val ${String(S[o.id]) === String(v[0]) ? 'on' : ''}" data-val="${i}">${v[1]}</button>`).join('')}</div>`;
      optsEl.innerHTML = html;
      if (o.slider) {
        updateEvUI();
        let start = 0;
        OS.util.drag(optsEl.querySelector('.cam-ev'), {
          onStart() { start = S.ev; },
          onMove(p) { S.ev = OS.util.clamp(start - p.dx / 50, -2, 2); if (Math.abs(S.ev) < .05) S.ev = 0; updateEvUI(); applyLook(); },
          onEnd() {},
        });
      }
    }
    function toggleOpts(open) {
      optsOpen = open == null ? !optsOpen : open; optSel = null;
      root.classList.toggle('opts-open', optsOpen);
      if (optsOpen) renderOpts();
      renderTop();
    }
    optsEl.addEventListener('click', e => {
      const ob = e.target.closest('[data-opt]'), vb = e.target.closest('[data-val]');
      if (ob) { optSel = ob.dataset.opt || null; renderOpts(); return; }
      if (vb && optSel) {
        const o = OPTS.find(x => x.id === optSel), v = o.vals[+vb.dataset.val][0];
        S[o.id] = v; save();
        if (o.id === 'aspect') { blurSwitch(); applyLayout(); }
        if (o.id === 'live') showBadge(v ? 'LIVE' : 'LIVE OFF', !!v);
        if (o.id === 'timer' && v) showBadge(`TIMER ${v}S`, true);
        applyLook(); renderTop(); renderOpts();
      }
    });

    /* ----- stream ----- */
    function setSim(on, hint) {
      usingSim = on;
      simCanvas.style.display = on ? 'block' : 'none';
      video.style.display = on ? 'none' : 'block';
      hintEl.classList.toggle('on', !!(on && hint));
      if (on) { drawScene(simG, 720, 960, simTime(), facing); ensureLoop(); }
    }
    async function acquire() {
      if (stream || acquiring || closed) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setSim(true, true); return; }
      acquiring = true;
      const token = ++streamToken;
      clearTimeout(pendingSimTimer);
      pendingSimTimer = setTimeout(() => { if (token === streamToken && !stream && foreground) setSim(true, false); }, 1200);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }, audio: false });
        if (token !== streamToken || !foreground || closed) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        s.getVideoTracks().forEach(t => { t.onended = () => { if (stream === s) { release(); if (foreground) setSim(true, true); } }; });
        video.srcObject = s;
        try { await video.play(); } catch (e) { /* autoplay race — the element has autoplay too */ }
        if (stream === s) setSim(false);
      } catch (e) {
        if (token === streamToken && foreground) setSim(true, true);
      } finally {
        clearTimeout(pendingSimTimer);
        if (token === streamToken) acquiring = false;
      }
    }
    function release() {
      streamToken++; acquiring = false; clearTimeout(pendingSimTimer);
      if (stream) { stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); stream = null; }
      try { video.pause(); } catch (e) {}
      video.srcObject = null;
    }
    function ensureLoop() { if (!rafId && foreground) rafId = requestAnimationFrame(tick); }
    function tick(now) {
      rafId = 0;
      if (!foreground) return;
      let need = false;
      if (usingSim) { need = true; if (now - lastSim > 30) { drawScene(simG, 720, 960, now / 1000, facing); lastSim = now; } }
      if (rec && rec.g) { need = true; drawRecFrame(); }
      if (need) rafId = requestAnimationFrame(tick);
    }

    /* ----- frame grabbing ----- */
    function frameSource(hi) {
      if (!usingSim && stream && video.videoWidth) return { el: video, w: video.videoWidth, h: video.videoHeight };
      if (hi) { const c = mk(1440, 1920); drawScene(c.getContext('2d'), 1440, 1920, simTime(), facing); return { el: c, w: 1440, h: 1920 }; }
      return { el: simCanvas, w: 720, h: 960 };
    }
    function drawCropped(g, src, outW, outH, noZoom) {
      const a = outW / outH; let cw = src.h * a, ch = src.h;
      if (cw > src.w) { cw = src.w; ch = src.w / a; }
      const s = noZoom ? 1 : scaleFor(); cw /= s; ch /= s;
      const f = cssFilter(), canF = 'filter' in g;
      g.save();
      if (facing === 'front') { g.translate(outW, 0); g.scale(-1, 1); }
      if (f && canF) g.filter = f;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(src.el, (src.w - cw) / 2, (src.h - ch) / 2, cw, ch, 0, 0, outW, outH);
      g.restore();
      if (!canF && S.ev) { g.fillStyle = S.ev > 0 ? `rgba(255,255,255,${(S.ev * .18).toFixed(3)})` : `rgba(0,0,0,${(-S.ev * .24).toFixed(3)})`; g.fillRect(0, 0, outW, outH); }
    }
    function maskEdges(tg, w, h) {       // keep only the outer region of whatever is on tg
      tg.save(); tg.globalCompositeOperation = 'destination-in';
      tg.translate(w / 2, h * .45); tg.scale(1, (h / w) * .92);
      const r = w * .5, gr = tg.createRadialGradient(0, 0, r * .42, 0, 0, r * 1.02);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      tg.fillStyle = gr; tg.fillRect(-w, -h * 2, w * 2, h * 4);
      tg.restore();
    }
    function vignette(g, w, h, a) {
      const gr = g.createRadialGradient(w / 2, h * .46, Math.min(w, h) * .38, w / 2, h * .46, Math.max(w, h) * .78);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    function applyDepth(g, c, w, h, px) {   // high quality, for stills
      const t = mk(w, h), tg = t.getContext('2d');
      if ('filter' in tg) {
        const m = px * 2; tg.filter = `blur(${px}px)`; tg.drawImage(c, -m, -m, w + m * 2, h + m * 2); tg.filter = 'none';
      } else {
        const k = Math.max(4, px * .8), s1 = mk(w / (k / 2), h / (k / 2)), s2 = mk(w / k, h / k);
        const g1 = s1.getContext('2d'), g2 = s2.getContext('2d');
        g1.imageSmoothingQuality = g2.imageSmoothingQuality = tg.imageSmoothingQuality = 'high';
        g1.drawImage(c, 0, 0, s1.width, s1.height); g2.drawImage(s1, 0, 0, s2.width, s2.height);
        g1.drawImage(s2, 0, 0, s1.width, s1.height); tg.drawImage(s1, 0, 0, w, h);
      }
      maskEdges(tg, w, h);
      g.drawImage(t, 0, 0);
      vignette(g, w, h, .34);
    }
    function softDepth(g, c) {            // cheap, for video frames
      const w = c.width, h = c.height;
      if (!depthTmp.small || depthTmp.full.width !== w) { depthTmp.small = mk(w / 10, h / 10); depthTmp.full = mk(w, h); }
      const sg = depthTmp.small.getContext('2d'), fg = depthTmp.full.getContext('2d');
      sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, depthTmp.small.width, depthTmp.small.height);
      fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, w, h); fg.imageSmoothingQuality = 'high';
      fg.drawImage(depthTmp.small, 0, 0, w, h);
      maskEdges(fg, w, h);
      g.drawImage(depthTmp.full, 0, 0);
      vignette(g, w, h, .3);
    }
    function sceneIsDark() {
      try {
        const c = mk(16, 16), g = c.getContext('2d'), src = frameSource(false);
        g.drawImage(src.el, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
        return sum / 256 < 60;
      } catch (e) { return false; }
    }
    function makeThumb(c, size) {
      const t = mk(size, size), g = t.getContext('2d'), s = Math.min(c.width, c.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(c, (c.width - s) / 2, (c.height - s) / 2, s, s, 0, 0, size, size);
      return t.toDataURL('image/jpeg', .8);
    }

    /* ----- library ----- */
    async function saveToLibrary(record, meta, thumb) {
      let r;
      try { r = await OS.photos.add(record); }
      catch (e) { OS.ui.toast('Unable to save to Photos'); return null; }
      let id = (r && typeof r === 'object') ? r.id : r;
      if (id == null) {
        try { const all = await OS.photos.all(); const n = newest(all); if (n) id = n.id; } catch (e) {}
      }
      if (id != null) {
        const clean = {}; Object.keys(meta || {}).forEach(k => { if (meta[k]) clean[k] = meta[k]; });
        if (Object.keys(clean).length) { const m = OS.store.get('photos.meta', {}) || {}; m[id] = Object.assign({}, m[id], clean); OS.store.set('photos.meta', m); }
        if (thumb) OS.store.set('camera.last', { id, thumb });
      }
      return id;
    }
    function newest(all) {
      let best = null, bd = -Infinity;
      (all || []).forEach((p, i) => { const d = +new Date(p.date) || i; if (d >= bd) { bd = d; best = p; } });
      return best;
    }
    function setThumb(url) { thumbEl.style.backgroundImage = url ? `url("${url}")` : 'none'; }
    async function refreshThumb() {
      let all = [];
      try { all = await OS.photos.all(); } catch (e) {}
      if (closed) return;
      const n = newest(all), last = OS.store.get('camera.last', null);
      if (thumbUrl) { URL.revokeObjectURL(thumbUrl); thumbUrl = null; }
      if (!n) return setThumb(null);
      if (last && last.id === n.id && last.thumb) return setThumb(last.thumb);
      if (n.kind === 'video') return setThumb(typeof n.poster === 'string' ? n.poster : null);
      if (typeof n.src === 'string') return setThumb(n.src);
      if (n.src instanceof Blob) { thumbUrl = URL.createObjectURL(n.src); return setThumb(thumbUrl); }
      setThumb(null);
    }
    function flyToThumb(c, thumb) {
      const g = boxGeom(), img = document.createElement('img');
      img.className = 'cam-fly'; img.src = c.width > 600 ? makeThumbRect(c) : c.toDataURL('image/jpeg', .8);
      Object.assign(img.style, { left: '0px', top: g.top + 'px', width: W + 'px', height: g.h + 'px' });
      root.appendChild(img);
      void img.offsetWidth;
      Object.assign(img.style, { left: '30px', top: '736px', width: '48px', height: '48px', borderRadius: '9px' });
      later(() => { setThumb(thumb); thumbEl.classList.remove('pop'); void thumbEl.offsetWidth; thumbEl.classList.add('pop'); img.style.opacity = '0'; }, 400);
      later(() => img.remove(), 640);
    }
    function makeThumbRect(c) {
      const k = 402 / c.width, t = mk(402, c.height * k), g = t.getContext('2d');
      g.drawImage(c, 0, 0, t.width, t.height);
      return t.toDataURL('image/jpeg', .7);
    }

    /* ----- photo ----- */
    function blink() { blinkEl.classList.remove('go'); void blinkEl.offsetWidth; blinkEl.classList.add('go'); }
    async function takePhoto() {
      if (busy || closed) return;
      busy = true;
      try {
        const portrait = mode === 'portrait';
        const useFlash = S.flash === 'on' || (S.flash === 'auto' && sceneIsDark());
        if (useFlash) { flashScreen.classList.add('on'); await wait(230); }
        snd('shutter');
        const [w, h] = outSize(), c = mk(w, h), g = c.getContext('2d');
        drawCropped(g, frameSource(true), w, h);
        if (portrait) applyDepth(g, c, w, h, Math.round(DEPTHS[S.depth][1] * w / 402 * .55));
        if (useFlash) later(() => flashScreen.classList.remove('on'), 140); else blink();
        if (S.live && mode === 'photo' && !rec) showBadge('LIVE', true, 1100);
        const thumb = makeThumb(c, 96);
        if (!rec) flyToThumb(c, thumb);
        const src = c.toDataURL('image/jpeg', .92);
        await saveToLibrary({ src, kind: 'photo', selfie: facing === 'front', portrait, w, h }, { selfie: facing === 'front', portrait }, thumb);
        if (rec) setThumb(thumb);
      } finally { busy = false; }
    }
    function startCountdown(n, fn) {
      countdownLeft = n; shutterEl.classList.add('stop');
      const step = () => {
        if (countdownLeft <= 0) { cancelCountdown(); fn(); return; }
        countEl.textContent = countdownLeft; countEl.classList.remove('tick'); void countEl.offsetWidth; countEl.classList.add('tick');
        OS.haptic(countdownLeft <= 3 ? 'medium' : 'light');
        if (countdownLeft <= 3 && S.flash !== 'off') blink();
        countdownLeft--;
        countdownTimer = later(step, 1000);
      };
      step();
    }
    function cancelCountdown() {
      if (!countdownTimer && !countdownLeft) return;
      clearTimeout(countdownTimer); timers.delete(countdownTimer); countdownTimer = 0; countdownLeft = 0;
      countEl.classList.remove('tick'); shutterEl.classList.remove('stop');
    }

    /* ----- video ----- */
    function pickMime() {
      const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'];
      for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
      return '';
    }
    function drawRecFrame() {
      drawCropped(rec.g, frameSource(false), rec.canvas.width, rec.canvas.height);
      if (mode === 'cinematic') softDepth(rec.g, rec.canvas);
    }
    function fmtClock(sec) { sec = Math.floor(sec); return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor(sec / 60) % 60) + ':' + pad2(sec % 60); }
    async function startRecording() {
      if (rec || busy) return;
      if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) { OS.ui.toast('Video recording isn’t supported in this browser'); return; }
      const [w, h] = S.res === '4K' ? [1080, 1920] : [720, 1280];
      const canvas = mk(w, h);
      const r = rec = { canvas, g: canvas.getContext('2d'), chunks: [], start: 0, mic: null, tick: 0, poster: null, recorder: null, mime: '', selfie: facing === 'front', cinematic: mode === 'cinematic' };
      root.classList.add('recording'); shutterEl.classList.add('stop'); timeEl.classList.add('rec'); timeEl.textContent = '00:00:00';
      hideFocus();
      const began = performance.now();
      snd('begin_record');
      drawRecFrame(); ensureLoop();
      try { r.mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { r.mic = null; }
      if (rec !== r || r.stopping) { if (r.mic) r.mic.getTracks().forEach(t => t.stop()); return; }
      const lag = 420 - (performance.now() - began);
      if (lag > 0) await wait(lag);
      if (rec !== r || r.stopping) { if (r.mic) r.mic.getTracks().forEach(t => t.stop()); return; }
      try {
        const out = canvas.captureStream(S.fps);
        if (r.mic) r.mic.getAudioTracks().forEach(t => out.addTrack(t));
        r.mime = pickMime();
        r.recorder = new MediaRecorder(out, Object.assign({ videoBitsPerSecond: S.res === '4K' ? 10e6 : 6e6 }, r.mime ? { mimeType: r.mime } : {}));
        r.recorder.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); };
        r.recorder.onstop = () => finalizeRecording(r, out);
        r.recorder.start(500);
      } catch (e) {
        abortRecordingUI(r); OS.ui.toast('Unable to start recording'); return;
      }
      r.start = performance.now();
      r.poster = makeThumb(canvas, 96);
      r.posterLarge = (() => { const t = mk(360, 640); t.getContext('2d').drawImage(canvas, 0, 0, 360, 640); return t.toDataURL('image/jpeg', .7); })();
      r.tick = setInterval(() => { timeEl.textContent = fmtClock((performance.now() - r.start) / 1000); }, 250);
    }
    function abortRecordingUI(r) {
      if (r.tick) clearInterval(r.tick);
      if (r.mic) r.mic.getTracks().forEach(t => t.stop());
      if (rec === r) rec = null;
      root.classList.remove('recording'); shutterEl.classList.remove('stop'); timeEl.classList.remove('rec');
    }
    function stopRecording(silent) {
      const r = rec; if (!r || r.stopping) return;
      r.stopping = true; r.duration = r.start ? (performance.now() - r.start) / 1000 : 0;
      if (!silent) snd('end_record');
      if (r.recorder && r.recorder.state !== 'inactive') { try { r.recorder.stop(); } catch (e) { abortRecordingUI(r); } }
      else abortRecordingUI(r);
      if (r.tick) clearInterval(r.tick);
      root.classList.remove('recording'); shutterEl.classList.remove('stop'); timeEl.classList.remove('rec');
    }
    async function finalizeRecording(r, out) {
      try { out.getTracks().forEach(t => t.stop()); } catch (e) {}
      if (r.mic) r.mic.getTracks().forEach(t => t.stop());
      if (rec === r) rec = null;
      r.g = null;
      if (!r.chunks.length || r.duration < 0.3) return;
      const blob = new Blob(r.chunks, { type: (r.mime || 'video/webm').split(';')[0] });
      r.chunks = [];
      if (!closed) { setThumb(r.poster); thumbEl.classList.remove('pop'); void thumbEl.offsetWidth; thumbEl.classList.add('pop'); }
      await saveToLibrary({ src: blob, kind: 'video', duration: r.duration, poster: r.posterLarge, selfie: r.selfie, w: r.canvas.width, h: r.canvas.height },
        { selfie: r.selfie, duration: Math.round(r.duration * 10) / 10, cinematic: r.cinematic }, r.poster);
      if (!closed) timeEl.textContent = '00:00:00';
    }

    /* ----- pano ----- */
    function resetPanoUI() {
      panoCanvas.getContext('2d').clearRect(0, 0, 2400, 800);
      panoArrow.style.left = '0px';
      panoTip.textContent = 'Move iPhone continuously when taking a Panorama.';
    }
    function startPano() {
      if (pano || busy) return;
      resetPanoUI();
      const n = 48, g = panoCanvas.getContext('2d');
      pano = { i: 0, n, g, wide: null, timer: 0 };
      root.classList.add('busy-pano'); shutterEl.classList.add('stop');
      panoTip.textContent = 'Keep the arrow on the centre line.';
      snd('begin_record');
      pano.timer = setInterval(() => {
        const p = pano; if (!p) return;
        const sw = 2400 / n, x = p.i * sw;
        const f = cssFilter();
        g.save(); if (f && 'filter' in g) g.filter = f;
        if (!usingSim && stream && video.videoWidth) {
          const vw = video.videoWidth, vh = video.videoHeight; let ch = vw / 3, cw = vw;
          if (ch > vh) { ch = vh; cw = vh * 3; }
          const ox = (vw - cw) / 2, oy = (vh - ch) / 2, part = cw / n, idx = facing === 'front' ? (n - 1 - p.i) : p.i;
          if (facing === 'front') { g.translate(x + sw, 0); g.scale(-1, 1); g.drawImage(video, ox + idx * part, oy, part, ch, 0, 0, sw, 800); }
          else g.drawImage(video, ox + idx * part, oy, part, ch, x, 0, sw, 800);
        } else {
          if (!p.wide) p.wide = mk(2400, 800);
          drawScene(p.wide.getContext('2d'), 2400, 800, simTime(), 'back');
          g.drawImage(p.wide, x, 0, sw, 800, x, 0, sw, 800);
        }
        g.restore();
        p.i++;
        panoArrow.style.left = (p.i / n * (374 - 38)) + 'px';
        if (p.i >= n) finishPano(true);
      }, 95);
    }
    async function finishPano(keep) {
      const p = pano; if (!p) return;
      clearInterval(p.timer); pano = null;
      root.classList.remove('busy-pano'); shutterEl.classList.remove('stop');
      if (!keep || p.i < 6) { resetPanoUI(); return; }
      snd('end_record');
      const w = Math.round(p.i * 2400 / p.n), c = mk(w, 800);
      c.getContext('2d').drawImage(panoCanvas, 0, 0, w, 800, 0, 0, w, 800);
      const thumb = makeThumb(c, 96);
      flyToThumb(c, thumb);
      later(resetPanoUI, 450);
      await saveToLibrary({ src: c.toDataURL('image/jpeg', .9), kind: 'photo', pano: true, w, h: 800 }, { pano: true }, thumb);
    }

    /* ----- focus / exposure ----- */
    function hideFocus() { clearTimeout(focusTimer); timers.delete(focusTimer); focusEl.classList.remove('show', 'dim', 'adjusting'); }
    function armFocusHide() {
      clearTimeout(focusTimer); timers.delete(focusTimer);
      focusEl.classList.remove('dim');
      focusTimer = later(() => { focusEl.classList.add('dim'); focusTimer = later(() => focusEl.classList.remove('show', 'dim'), 2600); }, 1400);
    }
    function focusAt(x, y) {
      const g = boxGeom();
      x = OS.util.clamp(x, 40, W - 40); y = OS.util.clamp(y, 40, g.h - 40);
      S.ev = 0; applyLook(); updateEvUI();
      focusEl.style.left = x + 'px'; focusEl.style.top = y + 'px';
      focusEl.classList.toggle('flipside', x > W - 120);
      focusEl.classList.remove('show', 'dim', 'adjusting'); void focusEl.offsetWidth; focusEl.classList.add('show');
      OS.haptic('light');
      armFocusHide();
    }
    function rootPoint(p, e) {
      const s = e && (e.clientX != null ? e : (e.changedTouches && e.changedTouches[0]));
      if (s && s.clientX != null) { const r = root.getBoundingClientRect(), k = (r.width / W) || 1; return { x: (s.clientX - r.left) / k, y: (s.clientY - r.top) / k }; }
      return { x: p.x, y: p.y };
    }
    let vfIntent = null, vfEv = 0;
    OS.util.drag(box, {
      onStart() { vfIntent = null; vfEv = S.ev; },
      onMove(p) {
        if (!vfIntent && (Math.abs(p.dx) > 8 || Math.abs(p.dy) > 8)) {
          vfIntent = Math.abs(p.dx) > Math.abs(p.dy) ? 'swipe' : (focusEl.classList.contains('show') ? 'ev' : 'none');
          if (vfIntent === 'ev') focusEl.classList.add('adjusting');
        }
        if (vfIntent === 'ev') {
          S.ev = OS.util.clamp(vfEv - p.dy / 90, -2, 2); if (Math.abs(S.ev) < .05) S.ev = 0;
          applyLook(); updateEvUI(); armFocusHide();
        }
      },
      onEnd(p, e) {
        if (e && e.target && e.target.closest && e.target.closest('.cam-hint')) return;
        if (vfIntent === 'swipe') { if (Math.abs(p.dx) > 46 && !rec && !pano) stepMode(p.dx < 0 ? 1 : -1); }
        else if (vfIntent === 'ev') { focusEl.classList.remove('adjusting'); if (optsOpen && optSel === 'ev') updateEvUI(); else if (optsOpen && !optSel) renderOpts(); }
        else if (!vfIntent && mode !== 'pano') { const pt = rootPoint(p, e); focusAt(pt.x, pt.y - boxGeom().top); }
        vfIntent = null;
      },
    });

    /* ----- wiring ----- */
    let modeBase = 0, modeMoved = false;
    OS.util.drag(modesEl, {
      onStart() { modeBase = trackX(); modeMoved = false; },
      onMove(p) {
        if (rec || pano) return;
        if (!modeMoved && Math.abs(p.dx) < 6) return;
        modeMoved = true; track.style.transition = 'none';
        track.style.transform = `translateX(${modeBase + p.dx}px)`;
      },
      onEnd(p, e) {
        if (rec || pano) return;
        if (!modeMoved) { const b = e && e.target && e.target.closest && e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); return; }
        lastDrag = Date.now();
        const x = trackX() + (p.vx || 0) * (Math.abs(p.vx || 0) > 20 ? .08 : 60); let best = 0, bd = 1e9;
        Array.from(track.children).forEach((b, i) => { const d = Math.abs(x + b.offsetLeft + b.offsetWidth / 2 - W / 2); if (d < bd) { bd = d; best = i; } });
        track.style.transition = '';
        setMode(MODES[best].id, true);
      },
    });
    track.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b && Date.now() - lastDrag > 350) setMode(b.dataset.mode); });

    let zoomBase = 1, zoomMoved = false;
    OS.util.drag(zoomEl, {
      onStart() { zoomBase = zoom; zoomMoved = false; },
      onMove(p) {
        if (facing === 'front') return;
        if (!zoomMoved && Math.abs(p.dx) < 8) return;
        zoomMoved = true; stage.style.transition = 'filter .2s linear';
        setZoom(zoomBase * Math.pow(2, -p.dx / 70), true);
      },
      onEnd(p, e) {
        stage.style.transition = '';
        if (zoomMoved) { lastDrag = Date.now(); if (Math.abs(zoom - Math.round(zoom)) < .06 && zoom >= 1) setZoom(Math.round(zoom), true); return; }
        const b = e && e.target && e.target.closest && e.target.closest('button'); if (b) zoomTap(b);
      },
    });
    function zoomTap(b) {
      if (b.dataset.wide) { frontWide = !frontWide; applyLook(); OS.haptic('selection'); return; }
      if (b.dataset.z) { const z = parseFloat(b.dataset.z); if (Math.abs(z - zoom) > .001) setZoom(z); }
    }
    zoomEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b && Date.now() - lastDrag > 350) zoomTap(b); });

    flashBtn.addEventListener('click', () => { S.flash = S.flash === 'off' ? 'on' : 'off'; save(); renderTop(); if (optsOpen) renderOpts(); showBadge(S.flash === 'on' ? 'FLASH ON' : 'FLASH OFF', S.flash === 'on', 900); });
    liveBtn.addEventListener('click', () => { S.live = !S.live; save(); renderTop(); if (optsOpen) renderOpts(); showBadge(S.live ? 'LIVE' : 'LIVE OFF', S.live); });
    chevBtn.addEventListener('click', () => toggleOpts());
    fnumBtn.addEventListener('click', () => { S.depth = (S.depth + 1) % DEPTHS.length; save(); applyLook(); showBadge('DEPTH ' + DEPTHS[S.depth][0], true, 1000); });
    resEl.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b || rec) return;
      if (b.dataset.r === 'res') S.res = S.res === 'HD' ? '4K' : 'HD'; else S.fps = S.fps === 30 ? 60 : S.fps === 60 ? 24 : 30;
      save(); renderTop(); OS.haptic('selection');
    });
    hintEl.addEventListener('click', e => { e.stopPropagation(); release(); hintEl.classList.remove('on'); acquire(); });
    thumbEl.addEventListener('click', () => { if (!rec && !pano) OS.openApp('photos', { open: 'latest' }); });
    stillBtn.addEventListener('click', () => takePhoto());
    flipBtn.addEventListener('click', () => {
      if (rec || pano || flipBtn.dataset.lock) return;
      flipBtn.dataset.lock = '1';
      const icon = flipBtn.querySelector('svg'); icon.style.transform = `rotate(${facing === 'back' ? 180 : 0}deg)`;
      veil.classList.add('on'); hideFocus();
      const a = box.animate ? box.animate([{ transform: 'perspective(1000px) rotateY(0deg) scale(1)' }, { transform: 'perspective(1000px) rotateY(90deg) scale(.92)' }], { duration: 190, easing: 'ease-in' }) : null;
      const swap = () => {
        facing = facing === 'back' ? 'front' : 'back';
        if (facing === 'back' && zoom < pillsFor()[0]) zoom = pillsFor()[0];
        stage.style.transition = 'none'; applyLook(); renderZoom(); void stage.offsetWidth; stage.style.transition = '';
        if (usingSim) drawScene(simG, 720, 960, simTime(), facing);
        if (box.animate) box.animate([{ transform: 'perspective(1000px) rotateY(-90deg) scale(.92)' }, { transform: 'perspective(1000px) rotateY(0deg) scale(1)' }], { duration: 260, easing: EASE });
        later(() => { veil.classList.remove('on'); delete flipBtn.dataset.lock; }, 220);
      };
      if (a) a.onfinish = swap; else swap();
      OS.haptic('light');
    });
    shutterEl.addEventListener('click', () => shutterPressed());
    function shutterPressed() {
      if (closed) return;
      if (countdownLeft || countdownTimer) { cancelCountdown(); return; }
      if (isVideoMode()) return rec ? stopRecording() : startRecording();
      if (mode === 'pano') return pano ? finishPano(true) : startPano();
      if (S.timer) startCountdown(S.timer, takePhoto); else takePhoto();
    }

    /* ----- init ----- */
    applyLayout(); renderZoom(); renderTop(); applyLook(); updateEvUI(); centerModes(false);

    return {
      resume(params) {
        const wasActive = foreground;
        foreground = true;
        acquire();
        if (usingSim) ensureLoop();
        if (!wasActive) { refreshThumb(); requestAnimationFrame(() => { centerModes(false); requestAnimationFrame(() => { track.style.transition = ''; }); }); }
        if (params && params.capture && wasActive) {
          if (isVideoMode() || mode === 'pano') shutterPressed(); else takePhoto();
        }
      },
      pause() {
        foreground = false;
        cancelCountdown();
        if (rec) stopRecording();
        if (pano) finishPano(false);
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        flashScreen.classList.remove('on');
        hideFocus();
        release();
      },
      close() {
        closed = true; foreground = false;
        cancelCountdown();
        if (rec) stopRecording(true);
        if (pano) finishPano(false);
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        timers.forEach(id => clearTimeout(id)); timers.clear();
        release();
        if (thumbUrl) { URL.revokeObjectURL(thumbUrl); thumbUrl = null; }
      },
    };
  }

  let inst = null;
  OS.registerApp({
    id: 'camera',
    name: 'Camera',
    icon: {
      bg: 'linear-gradient(180deg,#F1F1F3 0%,#BDBEC3 100%)',
      glyph: `<svg viewBox="0 0 60 60"><path d="M22.5 17.5l2.2-3.6a3 3 0 0 1 2.6-1.4h5.4a3 3 0 0 1 2.6 1.4l2.2 3.6h6a5 5 0 0 1 5 5v19a5 5 0 0 1-5 5h-27a5 5 0 0 1-5-5v-19a5 5 0 0 1 5-5z" fill="#2C2C2E"/><circle cx="30" cy="31.8" r="9.6" fill="#1A1A1C" stroke="#C9CACF" stroke-width="2"/><circle cx="30" cy="31.8" r="5.4" fill="#3C3C40"/><circle cx="27.8" cy="29.6" r="1.7" fill="#8E8E93" opacity=".7"/><rect x="40.4" y="21.4" width="4.6" height="3" rx="1.5" fill="#FFD60A"/></svg>`,
    },
    system: true,
    statusBar: 'light',
    background: '#000',
    launch(ctx) { if (inst) { try { inst.close(); } catch (e) {} } inst = create(ctx); },
    onResume(ctx, params) { if (inst) inst.resume(params); },
    onPause() { if (inst) inst.pause(); },
    onClose() { if (inst) { inst.close(); inst = null; } },
  });
})();
