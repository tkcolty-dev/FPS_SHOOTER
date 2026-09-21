/* Photos — Library / Albums / Search, full-screen viewer (zoom-from-thumbnail, swipe, pinch-less double-tap zoom,
   swipe-down dismiss), share sheet, favourites, info, delete, select mode, video playback.
   Storage: OS.photos (IndexedDB). 'photos.seeded' flag, 'photos.albums' (user albums), 'photos.meta' (written by Camera). */
(function () {
  'use strict';
  const U = OS.util, esc = U.esc;
  const W = 402, H = 874, GAP = 20;
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  let S = null;   // per-process state

  /* ───────────────────────── icons ───────────────────────── */
  const st = (b, w = 1.8) => `<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${b}</g></svg>`;
  const fl = (b) => `<svg viewBox="0 0 24 24"><g fill="currentColor" stroke="none">${b}</g></svg>`;
  const HEART = 'M12 20.3s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.6c0 5.500-7.6 10.1-7.6 10.1z';
  const IC = {
    back: st('<path d="M14.5 4.500 7 12l7.5 7.5"/>', 2.4),
    more: st('<circle cx="12" cy="12" r="9.2"/><g fill="currentColor" stroke="none"><circle cx="7.800" cy="12" r="1.25"/><circle cx="12" cy="12" r="1.25"/><circle cx="16.2" cy="12" r="1.25"/></g>', 1.6),
    dots: fl('<circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>'),
    share: st('<path d="M12 14.500V3.2M8.200 6.800 12 3l3.8 3.8M8 10H6.500A1.500 1.500 0 0 0 5 11.500v8A1.500 1.500 0 0 0 6.500 21h11a1.500 1.500 0 0 0 1.500-1.500v-8a1.500 1.500 0 0 0-1.500-1.500H16"/>'),
    heart: st(`<path d="${HEART}"/>`),
    heartFill: fl(`<path d="${HEART}"/>`),
    info: st('<circle cx="12" cy="12" r="9.2"/><path d="M12 11v6"/><circle cx="12" cy="7.600" r=".6" fill="currentColor"/>'),
    trash: st('<path d="M4.500 6.500h15M9.500 6.500V4.600c0-.6.500-1.100 1.100-1.100h2.800c.6 0 1.100.500 1.100 1.100v1.900M6.300 6.500l.9 12.600c.1 1 .9 1.700 1.800 1.700h6c1 0 1.800-.7 1.800-1.700l.9-12.600M10 10.500v6.500M14 10.500v6.500"/>'),
    play: fl('<path d="M7.500 4.600v14.800c0 .8.9 1.300 1.600.9l11.700-7.400c.6-.4.6-1.300 0-1.700L9.100 3.800c-.7-.5-1.600 0-1.600.8z"/>'),
    pause: fl('<rect x="6" y="4.500" width="4.200" height="15" rx="1.200"/><rect x="13.800" y="4.500" width="4.200" height="15" rx="1.200"/>'),
    plus: st('<path d="M12 5v14M5 12h14"/>', 2.2),
    check: st('<path d="M6.500 12.500l3.700 3.700 7.300-8"/>', 2.4),
    copy: st('<rect x="8.500" y="8.500" width="11.500" height="11.500" rx="2.500"/><path d="M15.500 8.500V6.500A2.500 2.500 0 0 0 13 4H6.500A2.500 2.500 0 0 0 4 6.500V13a2.500 2.500 0 0 0 2.500 2.500h2"/>'),
    folder: st('<path d="M3.500 7.500A2 2 0 0 1 5.500 5.500h3.800l2 2.200h7.200a2 2 0 0 1 2 2v7.800a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    phone: st('<rect x="7" y="2.800" width="10" height="18.400" rx="2.600"/><path d="M10.500 5.300h3"/>'),
    dup: st('<rect x="8.500" y="8.500" width="11.500" height="11.500" rx="2.500"/><path d="M15.500 8.500V6.500A2.500 2.500 0 0 0 13 4H6.500A2.500 2.500 0 0 0 4 6.500V13a2.500 2.500 0 0 0 2.500 2.500h2M14.250 11.500v5.500M11.500 14.250H17"/>'),
    album: st('<rect x="3.500" y="7.500" width="17" height="12.500" rx="2.500"/><path d="M6 4.800h12"/>'),
    video: st('<rect x="3" y="6.500" width="12.500" height="11" rx="2.500"/><path d="M15.500 10.500l5-2.800v8.600l-5-2.800"/>'),
    selfie: st('<circle cx="12" cy="8.500" r="3.700"/><path d="M4.800 20c.7-3.700 3.600-5.800 7.200-5.800s6.500 2.100 7.200 5.800"/>'),
    portrait: st('<circle cx="12" cy="12" r="9.2"/><path d="M12 7.500v0M12 2.800v2M12 19.200v2M2.800 12h2M19.200 12h2"/><circle cx="12" cy="12" r="3.200"/>'),
    pano: st('<path d="M3 7.200c5.800 1.900 12.200 1.900 18 0v9.600c-5.800-1.900-12.200-1.900-18 0z"/>'),
    shot: st('<path d="M4 8.500V6.500A2.500 2.500 0 0 1 6.500 4h2M15.500 4h2A2.500 2.500 0 0 1 20 6.500v2M20 15.500v2a2.500 2.500 0 0 1-2.500 2.500h-2M8.500 20h-2A2.500 2.500 0 0 1 4 17.500v-2"/><circle cx="12" cy="12" r="2.800"/>'),
    tabLib: '<svg viewBox="0 0 26 26"><g fill="currentColor"><rect x="3" y="7" width="20" height="15.500" rx="3"/><rect x="6" y="3.500" width="14" height="1.900" rx=".95"/></g><g fill="none" style="stroke:var(--bar-solid,#fff)" stroke-width="1.500" stroke-linejoin="round" stroke-linecap="round" opacity=".95"><path d="M5.500 19l4.800-5 3.400 3.400 2.300-2.200 4.500 4.300"/></g></svg>',
    tabAlb: '<svg viewBox="0 0 26 26"><g fill="currentColor"><rect x="3" y="9.500" width="20" height="13" rx="3"/><rect x="5" y="6.200" width="16" height="1.900" rx=".95"/><rect x="7.200" y="3" width="11.600" height="1.900" rx=".95"/></g></svg>',
    tabSearch: '<svg viewBox="0 0 26 26"><g fill="none" stroke="currentColor" stroke-width="2.500" stroke-linecap="round"><circle cx="11.500" cy="11.500" r="6.800"/><path d="M16.600 16.600l5.200 5.200"/></g></svg>',
  };

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('photos', `
    .app-photos { background: var(--bg); --bar-solid: #f9f9f9; }
    #screen[data-theme="dark"] .app-photos { --bar-solid: #161618; }
    .app-photos .ph-pane { position: absolute; inset: 0; display: none; }
    .app-photos .ph-pane.on { display: block; }
    .app-photos .ios-tabbar { z-index: 30; }

    /* grid */
    .app-photos .ph-grid { display: grid; grid-template-columns: repeat(var(--cols, 3), 1fr); gap: 2px; }
    .app-photos .ph-cell { position: relative; aspect-ratio: 1; overflow: hidden; background: var(--cell2); cursor: pointer; }
    .app-photos .ph-cell img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity .25s; }
    .app-photos .ph-cell img.ok { opacity: 1; }
    .app-photos .ph-cell:active img { filter: brightness(.82); }
    .app-photos .ph-cell .ph-dur { position: absolute; right: 5px; bottom: 4px; font-size: 12px; font-weight: 600; color: #fff; letter-spacing: 0; text-shadow: 0 0 4px rgba(0,0,0,.6); }
    .app-photos .ph-cell .ph-fav { position: absolute; left: 5px; bottom: 5px; width: 14px; height: 14px; color: #fff; filter: drop-shadow(0 0 2px rgba(0,0,0,.5)); display: none; }
    .app-photos .ph-cell .ph-fav svg { width: 100%; height: 100%; display: block; }
    .app-photos .ph-cell.fav .ph-fav { display: block; }
    .app-photos .ph-cell .ph-ck { position: absolute; right: 5px; bottom: 5px; width: 22px; height: 22px; border-radius: 50%; border: 1.500px solid rgba(255,255,255,.9); background: rgba(0,0,0,.12); display: none; color: #fff; box-shadow: 0 0 3px rgba(0,0,0,.3); }
    .app-photos .ph-cell .ph-ck svg { width: 100%; height: 100%; display: none; }
    .app-photos .selecting .ph-cell .ph-ck { display: block; }
    .app-photos .selecting .ph-cell .ph-dur { right: auto; left: 5px; }
    .app-photos .selecting .ph-cell.fav .ph-fav { display: none; }
    .app-photos .ph-cell.sel .ph-ck { background: var(--tint); border-color: #fff; }
    .app-photos .ph-cell.sel .ph-ck svg { display: block; }
    .app-photos .ph-cell.sel img { filter: brightness(1.05) saturate(.9); opacity: .68; }
    .app-photos .ph-cols-1 .ph-cell { aspect-ratio: 3/4; }
    .app-photos .ph-cols-5 .ph-dur, .app-photos .ph-cols-5 .ph-fav { display: none !important; }

    /* library */
    .app-photos .ph-lib-scroll { position: absolute; inset: 0; }
    .app-photos .ph-lib-body { padding: 108px 0 150px; min-height: 100%; }
    .app-photos .ph-lib-head { position: absolute; left: 0; right: 0; top: 0; height: 150px; padding: calc(var(--safe-top) + 2px) 14px 0 16px; display: flex; align-items: flex-start; justify-content: space-between;
      background: linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,.34) 45%, transparent); pointer-events: none; color: #fff; z-index: 5; transition: opacity .25s; }
    .app-photos .ph-lib-head > * { pointer-events: auto; }
    .app-photos .ph-lib-title b { display: block; font-size: 28px; line-height: 34px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px; text-shadow: 0 1px 8px rgba(0,0,0,.25); }
    .app-photos .ph-lib-title span { display: block; font-size: 15px; font-weight: 600; opacity: .85; letter-spacing: -.2px; }
    .app-photos .ph-lib-btns { display: flex; gap: 8px; padding-top: 3px; }
    .app-photos .ph-chip { height: 30px; padding: 0 13px; border-radius: 15px; font-size: 15px; font-weight: 600; letter-spacing: -.2px; color: #fff !important; background: rgba(70,70,74,.62) !important;
      backdrop-filter: blur(16px) saturate(1.6); -webkit-backdrop-filter: blur(16px) saturate(1.6); display: flex; align-items: center; justify-content: center; transition: opacity .15s, transform .2s ${EASE}; }
    .app-photos .ph-chip:active { opacity: .6; transform: scale(.95); }
    .app-photos .ph-chip.round { width: 30px; padding: 0; } .app-photos .ph-chip svg { width: 20px; height: 20px; }
    .app-photos .ph-lib-seg { position: absolute; left: 50%; bottom: 95px; transform: translateX(-50%); display: flex; padding: 3px; border-radius: 20px; z-index: 6;
      background: rgba(70,70,74,.62); backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6); transition: opacity .25s, transform .35s ${EASE}; }
    .app-photos .ph-lib-seg button { height: 30px; padding: 0 15px; border-radius: 15px; font-size: 14px; font-weight: 600; letter-spacing: -.15px; color: rgba(255,255,255,.92); white-space: nowrap; transition: background .25s; }
    .app-photos .ph-lib-seg button.on { background: rgba(255,255,255,.3); color: #fff; }
    .app-photos .ph-lib.selecting-mode .ph-lib-seg, .app-photos .ph-lib.is-empty .ph-lib-seg, .app-photos .ph-lib.is-empty .ph-lib-head { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(20px); }
    .app-photos .ph-lib.is-empty .ph-lib-head { transform: none; }
    .app-photos .ph-cards { padding: 0 16px; display: flex; flex-direction: column; gap: 14px; }
    .app-photos .ph-card { position: relative; height: 260px; border-radius: 16px; overflow: hidden; background: var(--cell2); cursor: pointer; transition: transform .25s ${EASE}; }
    .app-photos .ph-card:active { transform: scale(.975); }
    .app-photos .ph-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .app-photos .ph-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.45), transparent 42%); }
    .app-photos .ph-card-t { position: absolute; left: 16px; top: 13px; z-index: 1; color: #fff; }
    .app-photos .ph-card-t b { display: block; font-size: 24px; font-weight: 700; letter-spacing: .2px; line-height: 28px; }
    .app-photos .ph-card-t span { font-size: 14px; font-weight: 600; opacity: .85; }
    .app-photos .ph-empty { position: absolute; left: 40px; right: 40px; top: 50%; transform: translateY(-60%); text-align: center; display: none; }
    .app-photos .is-empty .ph-empty { display: block; }
    .app-photos .ph-empty b { display: block; font-size: 22px; font-weight: 700; letter-spacing: .1px; margin-bottom: 6px; }
    .app-photos .ph-empty span { font-size: 16px; color: var(--label2); line-height: 21px; display: block; }
    .app-photos .ph-count { text-align: center; padding: 22px 0 4px; font-size: 15px; font-weight: 600; letter-spacing: -.2px; }
    .app-photos .ph-count span { display: block; font-size: 13px; font-weight: 400; color: var(--label2); margin-top: 2px; }

    /* select toolbar */
    .app-photos .ph-selbar { position: absolute; left: 0; right: 0; bottom: 0; height: 83px; padding: 0 18px 34px; z-index: 40; display: flex; align-items: center; justify-content: space-between;
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 -.5px 0 var(--sep); transform: translateY(100%); transition: transform .38s ${EASE}; }
    .app-photos .ph-selbar.in { transform: none; }
    .app-photos .ph-selbar b { font-size: 16px; font-weight: 600; letter-spacing: -.3px; }
    .app-photos .ph-selbar button { width: 40px; height: 40px; color: var(--tint); display: flex; align-items: center; justify-content: center; }
    .app-photos .ph-selbar button svg { width: 26px; height: 26px; }
    .app-photos .ph-selbar button.off { opacity: .3; pointer-events: none; }

    /* albums */
    .app-photos .ph-sec { display: flex; align-items: baseline; justify-content: space-between; padding: 14px 16px 10px; margin-top: 6px; border-top: .5px solid var(--sep); margin-left: 16px; padding-left: 0; }
    .app-photos .ph-sec:first-child { border-top: 0; margin-top: 0; }
    .app-photos .ph-sec b { font-size: 22px; font-weight: 700; letter-spacing: .2px; }
    .app-photos .ph-sec span { font-size: 17px; color: var(--tint); cursor: pointer; }
    .app-photos .ph-albums { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 14px; padding: 0 16px 14px; }
    .app-photos .ph-alb { cursor: pointer; min-width: 0; }
    .app-photos .ph-alb-cover { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: var(--cell2); transition: transform .25s ${EASE}, filter .2s; display: flex; align-items: center; justify-content: center; color: var(--label3); }
    .app-photos .ph-alb:active .ph-alb-cover { transform: scale(.96); filter: brightness(.9); }
    .app-photos .ph-alb-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .app-photos .ph-alb-cover > svg { width: 46px; height: 46px; }
    .app-photos .ph-alb-cover i { position: absolute; left: 7px; bottom: 7px; width: 17px; height: 17px; color: #fff; filter: drop-shadow(0 0 2px rgba(0,0,0,.5)); }
    .app-photos .ph-alb-cover i svg { width: 100%; height: 100%; display: block; }
    .app-photos .ph-alb b { display: block; font-size: 15px; font-weight: 400; letter-spacing: -.2px; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-photos .ph-alb span { display: block; font-size: 15px; color: var(--label2); letter-spacing: -.2px; }
    .app-photos .ph-types { padding: 0 0 0 16px; }
    .app-photos .ph-type { display: flex; align-items: center; gap: 12px; height: 46px; cursor: pointer; position: relative; padding-right: 16px; }
    .app-photos .ph-type + .ph-type::before { content: ''; position: absolute; left: 38px; right: 0; top: 0; height: .5px; background: var(--sep); }
    .app-photos .ph-type:active { opacity: .5; }
    .app-photos .ph-type > svg { width: 25px; height: 25px; color: var(--tint); flex: none; }
    .app-photos .ph-type b { flex: 1; font-size: 20px; font-weight: 400; color: var(--tint); letter-spacing: .2px; }
    .app-photos .ph-type span { color: var(--label2); font-size: 17px; }
    .app-photos .ph-none { text-align: center; padding: 150px 40px 0; }
    .app-photos .ph-none b { display: block; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .app-photos .ph-none span { color: var(--label2); font-size: 16px; line-height: 21px; }

    /* search */
    .app-photos .ph-tags { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 16px 12px; }
    .app-photos .ph-tag { height: 34px; padding: 0 14px; border-radius: 17px; background: var(--fill2) !important; font-size: 15px; font-weight: 500; letter-spacing: -.2px; display: flex; align-items: center; gap: 6px; }
    .app-photos .ph-tag:active { opacity: .55; } .app-photos .ph-tag svg { width: 17px; height: 17px; color: var(--tint); }
    .app-photos .ph-res-h { padding: 6px 16px 10px; font-size: 20px; font-weight: 700; letter-spacing: .2px; }
    .app-photos .ph-res-h span { font-size: 15px; font-weight: 400; color: var(--label2); margin-left: 6px; letter-spacing: -.2px; }

    /* viewer */
    .app-photos .ph-viewer { position: absolute; inset: 0; z-index: 50; overflow: hidden; color: var(--label); }
    .app-photos .ph-v-bg { position: absolute; inset: 0; background: var(--bg); opacity: 0; transition: opacity .3s, background .25s; }
    .app-photos .ph-viewer.in .ph-v-bg { opacity: 1; }
    .app-photos .ph-viewer.nochrome .ph-v-bg { background: #000; }
    .app-photos .ph-v-track { position: absolute; inset: 0; touch-action: none; }
    .app-photos .ph-slide { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    .app-photos .ph-box { position: absolute; overflow: hidden; transform-origin: 50% 50%; will-change: transform; }
    .app-photos .ph-box img, .app-photos .ph-box video { width: 100%; height: 100%; object-fit: cover; display: block; background: #000; }
    .app-photos .ph-box img { background: none; }
    .app-photos .ph-playbig { position: absolute; left: 50%; top: 50%; width: 72px; height: 72px; margin: -36px 0 0 -36px; border-radius: 50%; color: #fff !important; display: flex; align-items: center; justify-content: center;
      background: rgba(40,40,44,.55) !important; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); transition: opacity .2s, transform .25s ${EASE}; }
    .app-photos .ph-playbig svg { width: 34px; height: 34px; margin-left: 4px; }
    .app-photos .ph-playbig:active { transform: scale(.9); }
    .app-photos .ph-playbig.hide { opacity: 0; pointer-events: none; transform: scale(1.25); }
    .app-photos .ph-v-top, .app-photos .ph-v-bar, .app-photos .ph-v-scrub { position: absolute; left: 0; right: 0; opacity: 0; transition: opacity .25s; }
    .app-photos .ph-viewer.in .ph-v-top, .app-photos .ph-viewer.in .ph-v-bar, .app-photos .ph-viewer.in .ph-v-scrub { opacity: 1; }
    .app-photos .ph-viewer.nochrome .ph-v-top, .app-photos .ph-viewer.nochrome .ph-v-bar, .app-photos .ph-viewer.nochrome .ph-v-scrub,
    .app-photos .ph-viewer.dragging .ph-v-top, .app-photos .ph-viewer.dragging .ph-v-bar, .app-photos .ph-viewer.dragging .ph-v-scrub { opacity: 0 !important; pointer-events: none; }
    .app-photos .ph-v-top { top: 0; height: calc(var(--safe-top) + 46px); padding: var(--safe-top) 8px 0; display: flex; align-items: center; justify-content: space-between;
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 .5px 0 var(--sep); }
    .app-photos .ph-v-top button { width: 44px; height: 44px; color: var(--tint); display: flex; align-items: center; justify-content: center; }
    .app-photos .ph-v-top button svg { width: 26px; height: 26px; }
    .app-photos .ph-v-title { text-align: center; line-height: 1.15; }
    .app-photos .ph-v-title b { display: block; font-size: 16px; font-weight: 600; letter-spacing: -.3px; }
    .app-photos .ph-v-title span { font-size: 12px; color: var(--label2); letter-spacing: 0; }
    .app-photos .ph-v-bar { bottom: 0; height: 83px; padding: 0 22px 34px; display: flex; align-items: center; justify-content: space-between;
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 -.5px 0 var(--sep); }
    .app-photos .ph-v-bar button { width: 44px; height: 44px; color: var(--tint); display: flex; align-items: center; justify-content: center; transition: transform .3s ${EASE}; }
    .app-photos .ph-v-bar button svg { width: 27px; height: 27px; }
    .app-photos .ph-v-bar button:active { opacity: .4; }
    .app-photos .ph-v-bar button.pop { animation: ph-pop .42s ${EASE}; }
    @keyframes ph-pop { 0% { transform: scale(1); } 35% { transform: scale(1.32); } 100% { transform: scale(1); } }
    .app-photos .ph-v-scrub { bottom: 83px; height: 50px; padding: 0 16px; display: none; align-items: center; gap: 12px; background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 -.5px 0 var(--sep); }
    .app-photos .ph-viewer.is-video .ph-v-scrub { display: flex; }
    .app-photos .ph-v-scrub button { width: 30px; height: 30px; color: var(--tint); flex: none; display: flex; align-items: center; justify-content: center; }
    .app-photos .ph-v-scrub button svg { width: 22px; height: 22px; }
    .app-photos .ph-v-scrub span { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--label2); letter-spacing: 0; flex: none; min-width: 34px; text-align: right; }
    .app-photos .ph-range { -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; height: 30px; margin: 0; background: none; cursor: pointer; --v: 0%; }
    .app-photos .ph-range::-webkit-slider-runnable-track { height: 5px; border-radius: 3px; background: linear-gradient(90deg, var(--label) var(--v), var(--fill) var(--v)); }
    .app-photos .ph-range::-webkit-slider-thumb { -webkit-appearance: none; width: 9px; height: 17px; margin-top: -6px; border-radius: 4px; background: var(--label); box-shadow: 0 0 0 2px var(--bar-solid); }
    .app-photos .ph-range::-moz-range-track { height: 5px; border-radius: 3px; background: var(--fill); }
    .app-photos .ph-range::-moz-range-thumb { width: 9px; height: 17px; border: 0; border-radius: 4px; background: var(--label); }
    .app-photos .ph-hero { position: absolute; overflow: hidden; z-index: 60; pointer-events: none; background: var(--cell2);
      transition: left .36s ${EASE}, top .36s ${EASE}, width .36s ${EASE}, height .36s ${EASE}, border-radius .36s ${EASE}; }
    .app-photos .ph-hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  `);

  /* sheets are rendered by the OS outside ctx.root → their styles are scoped by their own class names */
  OS.addStyle('photos-sheets', `
    .ph-sh { height: 100%; padding: 0 0 30px; }
    .ph-sh-head { display: flex; align-items: center; gap: 12px; padding: 2px 16px 16px; }
    .ph-sh-head img, .ph-sh-head .ph-sh-th { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; flex: none; background: var(--cell2); }
    .ph-sh-head b { display: block; font-size: 16px; font-weight: 600; letter-spacing: -.3px; }
    .ph-sh-head span { font-size: 13px; color: var(--label2); letter-spacing: -.08px; }
    .ph-sh .ios-row { cursor: pointer; } .ph-sh .ios-row:active { background: var(--fill2); }
    .ph-sh .ios-row svg { width: 23px; height: 23px; flex: none; }
    .ph-sh .ios-row.red { color: var(--red); }
    .ph-sh .ios-list + .ios-list { margin-top: 12px; }
    .ph-inf-date { padding: 0 20px 4px; font-size: 17px; font-weight: 600; letter-spacing: -.4px; }
    .ph-inf-file { padding: 0 20px 14px; font-size: 15px; color: var(--label2); letter-spacing: -.2px; }
    .ph-inf-card { margin: 0 16px; border-radius: 12px; background: var(--cell); overflow: hidden; }
    .ph-inf-card-h { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--fill2); font-size: 15px; font-weight: 600; letter-spacing: -.2px; }
    .ph-inf-card-h i { font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: .3px; padding: 2px 6px; border-radius: 4px; background: var(--fill); color: var(--label2); }
    .ph-inf-card-b { padding: 10px 14px 4px; font-size: 15px; color: var(--label2); letter-spacing: -.2px; }
    .ph-inf-card-f { display: flex; padding: 8px 0 10px; margin: 6px 14px 0; border-top: .5px solid var(--sep); font-size: 13px; color: var(--label2); letter-spacing: 0; }
    .ph-inf-card-f span { flex: 1; text-align: center; } .ph-inf-card-f span + span { border-left: .5px solid var(--sep); }
    .ph-inf-cap { margin: 0 16px 16px; padding: 11px 14px; border-radius: 12px; background: var(--cell); font-size: 17px; }
  `);

  /* ───────────────────────── helpers ───────────────────────── */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = MONTHS.map((m) => m.slice(0, 3));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeFull = (d) => { const a = U.ampm(d); return U.time(d) + (a ? ' ' + a : ''); };
  function fmtRange(a, b) {
    a = new Date(a); b = new Date(b);
    const md = (d) => MON[d.getMonth()] + ' ' + d.getDate();
    if (a.toDateString() === b.toDateString()) return md(a) + ', ' + a.getFullYear();
    if (a.getFullYear() !== b.getFullYear()) return MON[a.getMonth()] + ' ' + a.getFullYear() + ' – ' + MON[b.getMonth()] + ' ' + b.getFullYear();
    if (a.getMonth() === b.getMonth()) return md(a) + ' – ' + b.getDate() + ', ' + a.getFullYear();
    return md(a) + ' – ' + md(b) + ', ' + a.getFullYear();
  }
  function fmtDay(d) {
    d = new Date(d); const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday';
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== now.getFullYear() ? ', ' + d.getFullYear() : '');
  }
  const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const plural = (n, w) => n.toLocaleString('en-US') + ' ' + w + (n === 1 ? '' : 's');
  const isVid = (it) => it && it.kind === 'video';
  function countLabel(list) {
    const v = list.filter(isVid).length, p = list.length - v;
    return [p ? plural(p, 'Photo') : '', v ? plural(v, 'Video') : ''].filter(Boolean).join(', ') || 'No Items';
  }
  function fitRect(ar) { let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; } return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
  const setRect = (el, r) => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; };
  const thumbSrc = (it) => isVid(it) ? (it.poster || (S && S.posters.get(it.id)) || '') : it.src;

  /* ───────────────────────── first-run pictures (all generated) ───────────────────────── */
  const PW = 900, PH = 1200;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noise1(seed) {           // smooth 1-D value noise + fBm
    const r = rng(seed), v = []; for (let i = 0; i < 512; i++) v.push(r());
    const n = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 511] * (1 - u) + v[(i + 1) & 511] * u; };
    return (x, oct = 5, rough = .5) => { let s = 0, a = 1, t = 0, fq = 1; for (let o = 0; o < oct; o++) { s += n(x * fq + o * 17.3) * a; t += a; a *= rough; fq *= 2; } return s / t; };
  }
  function P(g, seed) {             // tiny painting toolkit bound to one canvas
    const R = rng(seed), rr = (a, b) => a + R() * (b - a);
    const T = {
      R, rr,
      grad(x0, y0, x1, y1, stops) { const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => l.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return l; },
      sky(stops, y1 = PH) { g.fillStyle = T.grad(0, 0, 0, y1, stops); g.fillRect(0, 0, PW, PH); },
      glow(x, y, r, col, a = 1, mode = 'lighter') {
        g.save(); g.globalCompositeOperation = mode; g.globalAlpha = a; const q = g.createRadialGradient(x, y, 0, x, y, r);
        q.addColorStop(0, col); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      },
      blob(x, y, r, col, a = 1) { T.glow(x, y, r, col, a, 'source-over'); },
      stars(n, yMax, big = .04) {
        g.save(); for (let i = 0; i < n; i++) { const x = R() * PW, y = Math.pow(R(), 1.3) * yMax, s = R(); g.globalAlpha = .25 + R() * .75; g.fillStyle = s > .8 ? '#ffe9c9' : s > .6 ? '#cfe0ff' : '#fff';
          const rad = R() < big ? rr(1.6, 2.6) : rr(.5, 1.3); g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); if (rad > 1.6) T.glow(x, y, 12, 'rgba(200,220,255,.5)', .6); } g.restore();
      },
      ridge(baseY, amp, freq, fill, s2, opt = {}) {
        const nz = noise1(s2); g.beginPath(); g.moveTo(0, PH);
        for (let x = 0; x <= PW; x += 3) { let h = nz(x * freq, opt.oct || 5, opt.rough || .5); if (opt.sharp) h = 1 - Math.abs(h * 2 - 1); g.lineTo(x, baseY - h * amp + (opt.tilt || 0) * x); }
        g.lineTo(PW, PH); g.closePath(); g.fillStyle = fill; g.fill();
        return (x) => { let h = nz(x * freq, opt.oct || 5, opt.rough || .5); if (opt.sharp) h = 1 - Math.abs(h * 2 - 1); return baseY - h * amp + (opt.tilt || 0) * x; };
      },
      mist(y, h, col, a = 1) { g.save(); g.globalAlpha = a; g.fillStyle = T.grad(0, y - h, 0, y + h, ['rgba(255,255,255,0)', col, 'rgba(255,255,255,0)']); g.fillRect(0, y - h, PW, h * 2); g.restore(); },
      pine(x, y, h, col) {
        g.fillStyle = col; g.beginPath(); const w = h * .36, tiers = 7; g.moveTo(x, y - h);
        for (let i = 1; i <= tiers; i++) { const ty = y - h + (h * .93) * (i / tiers), tw = w * (i / tiers) * rr(.85, 1.1); g.lineTo(x + tw, ty); g.lineTo(x + tw * .45, ty - h * .035); }
        g.lineTo(x + w * .08, y - h * .07); g.lineTo(x + w * .08, y); g.lineTo(x - w * .08, y); g.lineTo(x - w * .08, y - h * .07);
        for (let i = tiers; i >= 1; i--) { const ty = y - h + (h * .93) * (i / tiers), tw = w * (i / tiers) * rr(.85, 1.1); g.lineTo(x - tw * .45, ty - h * .035); g.lineTo(x - tw, ty); }
        g.closePath(); g.fill();
      },
      pines(yf, n, h0, h1, col) { const xs = []; for (let i = 0; i < n; i++) xs.push(R() * PW); xs.forEach((x) => T.pine(x, yf(x) + 6, rr(h0, h1), col)); },
      cloud(cx, cy, w, h, top, under, a = 1) {
        const n = Math.round(w / 14);
        for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
          const t = i / (n - 1) - .5, x = cx + t * w + rr(-14, 14), env = Math.cos(t * Math.PI), r = (h * (.35 + env * .65)) * rr(.55, 1);
          const y = cy - env * h * .35 * R() + (pass ? -r * .22 : r * .12); T.blob(x, y, r, pass ? top : under, a * (pass ? .55 : .5));
        }
      },
      streaks(cx, y0, y1, spread, col, n) {
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = col;
        for (let i = 0; i < n; i++) { const t = Math.pow(R(), .8), y = y0 + t * (y1 - y0), sp = spread * (.25 + t * 1.1), x = cx + (R() + R() - 1) * sp, w = rr(14, 70) * (.5 + t), hh = rr(1.5, 4) * (.6 + t * 1.6);
          g.globalAlpha = (.75 - t * .5) * rr(.4, 1); g.beginPath(); g.ellipse(x, y, w, hh, 0, 0, 7); g.fill(); } g.restore();
      },
    };
    return T;
  }
  let grainTile = null;
  function finish(g, vig = .34) {
    const v = g.createRadialGradient(PW / 2, PH * .48, PH * .28, PW / 2, PH * .5, PH * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${vig})`);
    g.fillStyle = v; g.fillRect(0, 0, PW, PH);
    if (!grainTile) { grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 256; const tg = grainTile.getContext('2d'), id = tg.createImageData(256, 256), r = rng(99);
      for (let i = 0; i < id.data.length; i += 4) { const n = 96 + r() * 64; id.data[i] = id.data[i + 1] = id.data[i + 2] = n; id.data[i + 3] = 255; } tg.putImageData(id, 0, 0); }
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .5; g.fillStyle = g.createPattern(grainTile, 'repeat'); g.fillRect(0, 0, PW, PH); g.restore();
  }

  const SCENES = [
    { title: 'Misty Ridges', tags: ['mountains', 'fog', 'sunrise', 'nature'], days: 412, draw(g, T) {
      T.sky(['#2f4d7c', '#7d8fb5', '#e7b7a2', '#ffdcb0'], 760); T.glow(610, 560, 420, '#ffd9a0', .8); T.glow(610, 585, 60, '#fff6e0', 1);
      const cols = ['#9fb0cb', '#8097b8', '#627ea4', '#47648c', '#2f4a70', '#1c3253', '#0f1f38'];
      cols.forEach((c, i) => { T.ridge(610 + i * 88, 150 + i * 22, .0028 + i * .0007, c, 11 + i * 7, { sharp: i < 3, rough: .48 }); T.mist(690 + i * 88, 70, 'rgba(255,236,220,.55)', .75 - i * .08); });
    } },
    { title: 'Golden Hour at the Lake', tags: ['sunset', 'water', 'lake', 'reflection'], days: 398, draw(g, T) {
      const hz = 700; T.sky(['#23294f', '#6b3f78', '#d8587a', '#ff9a56', '#ffd27a'], hz);
      T.glow(450, hz - 40, 520, '#ffb45e', .9); T.glow(450, hz - 46, 120, '#fff0b8', 1);
      g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(450, hz - 46, 46, 0, 7); g.fill();
      for (let i = 0; i < 7; i++) T.cloud(T.rr(0, PW), T.rr(180, 520), T.rr(220, 460), T.rr(18, 34), 'rgba(255,190,140,.9)', 'rgba(90,50,110,.8)', .8);
      g.fillStyle = T.grad(0, hz, 0, PH, ['#f08a55', '#8b3f6e', '#2a2350', '#11122c']); g.fillRect(0, hz, PW, PH - hz);
      T.ridge(hz + 2, 46, .006, '#1b1436', 5, { rough: .55 }); g.fillStyle = T.grad(0, hz, 0, hz + 60, ['rgba(27,20,54,.75)', 'rgba(27,20,54,0)']); g.fillRect(0, hz, PW, 60);
      T.streaks(450, hz + 8, PH, 150, '#ffd98a', 420); T.streaks(450, hz + 4, PH - 100, 40, '#fff4cf', 160);
    } },
    { title: 'Neon Skyline', tags: ['city', 'night', 'skyline', 'neon', 'lights'], days: 371, draw(g, T) {
      const hz = 860; T.sky(['#0a0620', '#23104a', '#5f1d78', '#c2307f', '#ff7a59'], hz); T.stars(260, 420); T.glow(450, hz, 560, '#ff4f9a', .55);
      const layer = (base, hMin, hMax, col, win, s) => { let x = -20; while (x < PW) { const w = T.rr(46, 120), h = T.rr(hMin, hMax); g.fillStyle = col; g.fillRect(x, base - h, w, h + 4);
        if (T.R() < .35) g.fillRect(x + w / 2 - 2, base - h - T.rr(30, 90), 4, 90); if (T.R() < .3) g.fillRect(x + w * .2, base - h - 14, w * .6, 14);
        if (win) for (let wy = base - h + 12; wy < base - 8; wy += s) for (let wx = x + 7; wx < x + w - 9; wx += s * .8) if (T.R() < .42) { g.fillStyle = win[Math.floor(T.R() * win.length)]; g.globalAlpha = T.rr(.45, 1); g.fillRect(wx, wy, s * .38, s * .5); g.globalAlpha = 1; }
        x += w + T.rr(-6, 10); } };
      layer(hz, 120, 330, '#3a1758', null, 0); layer(hz, 160, 520, '#1d0d3a', ['#ffd76a', '#ff8ad0', '#7ee8ff'], 15); layer(hz, 60, 250, '#0b0519', ['#ffd76a', '#ffe9a8', '#7ee8ff', '#ff6fb5'], 19);
      g.save(); g.translate(0, hz * 2); g.scale(1, -1); g.globalAlpha = .42; g.drawImage(g.canvas, 0, hz - (PH - hz), PW, PH - hz, 0, hz - (PH - hz), PW, PH - hz); g.restore();
      g.fillStyle = T.grad(0, hz, 0, PH, ['rgba(10,5,30,.35)', 'rgba(6,3,20,.9)']); g.fillRect(0, hz, PW, PH - hz);
      g.fillStyle = 'rgba(10,5,28,.5)'; for (let y = hz + 6; y < PH; y += T.rr(7, 16)) g.fillRect(0, y, PW, T.rr(1, 3));
      T.streaks(450, hz + 6, PH, 420, '#ff79c6', 120);
    } },
    { title: 'Aurora Over the Pines', tags: ['aurora', 'night', 'stars', 'forest', 'northern lights'], days: 340, draw(g, T) {
      T.sky(['#030816', '#07142b', '#0d2a3f', '#123f4a']); T.stars(520, 900);
      const nz = noise1(77); g.save(); g.globalCompositeOperation = 'lighter';
      [[300, 250, '#35ff9c', '#7a5cff'], [420, 330, '#4dffc3', '#3f7bff'], [560, 210, '#9bff6a', '#c35cff']].forEach(([by, hh, c1, c2], k) => {
        for (let x = -20; x < PW + 20; x += 3) { const n = nz(x * .004 + k * 9, 4), y = by + Math.sin(x * .006 + k * 2) * 90 + n * 160, h = hh * (.5 + nz(x * .02 + k * 31, 3) * 1.1), a = .05 + nz(x * .011 + k * 5, 3) * .13;
          const l = g.createLinearGradient(0, y - h, 0, y + 30); l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(.35, c2); l.addColorStop(.85, c1); l.addColorStop(1, 'rgba(0,0,0,0)');
          g.globalAlpha = a; g.fillStyle = l; g.fillRect(x, y - h, 4, h + 30); } });
      g.restore(); T.glow(450, 1000, 520, '#1d8a6d', .35);
      const f1 = T.ridge(1010, 60, .004, '#06121a', 3); T.pines(f1, 46, 90, 190, '#06121a'); const f2 = T.ridge(1110, 50, .005, '#02080d', 4); T.pines(f2, 30, 170, 330, '#02080d');
    } },
    { title: 'City Lights Bokeh', tags: ['bokeh', 'lights', 'night', 'macro', 'abstract'], days: 301, draw(g, T) {
      T.sky(['#120a1c', '#24102a', '#3a1626', '#140a14']); T.glow(300, 700, 600, '#ff7a3c', .25); T.glow(700, 400, 500, '#b03cff', .2);
      const cols = ['#ffb347', '#ffd98a', '#ff6f91', '#ff9e6d', '#6fe3ff', '#c08bff', '#fff1c9'];
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 95; i++) { const big = i < 30, x = T.R() * PW, y = T.rr(120, PH - 80), r = big ? T.rr(60, 130) : T.rr(16, 58), c = cols[Math.floor(T.R() * cols.length)];
        g.globalAlpha = big ? T.rr(.08, .2) : T.rr(.18, .5); g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.globalAlpha *= .9; g.lineWidth = Math.max(1.5, r * .05); g.strokeStyle = c; g.beginPath(); g.arc(x, y, r - g.lineWidth / 2, 0, 7); g.stroke(); }
      g.restore();
    } },
    { title: 'Dunes at Dusk', tags: ['desert', 'dunes', 'sand', 'sunset'], days: 288, draw(g, T) {
      T.sky(['#3b4f8a', '#b97f9a', '#f7b27a', '#ffe0a3'], 640); T.glow(720, 500, 420, '#ffe2a8', .9); g.fillStyle = '#fff3d2'; g.beginPath(); g.arc(720, 520, 34, 0, 7); g.fill();
      const dune = (base, amp, ph, lit, dark, k) => { const f = (x) => base - Math.sin(x * .0042 * k + ph) * amp - Math.sin(x * .011 + ph * 2) * amp * .22;
        g.beginPath(); g.moveTo(0, PH); for (let x = 0; x <= PW; x += 4) g.lineTo(x, f(x)); g.lineTo(PW, PH); g.closePath(); g.fillStyle = T.grad(0, base - amp, 0, base + 380, [lit, dark]); g.fill();
        g.save(); g.clip(); g.beginPath(); let px = 0; for (let x = 0; x <= PW; x += 4) { g.lineTo(x, f(x)); px = x; } for (let x = px; x >= 0; x -= 4) { const slope = Math.cos(x * .0042 * k + ph); g.lineTo(x - 60, f(x) + Math.max(0, slope) * amp * 2.4 + 6); }
        g.closePath(); g.fillStyle = 'rgba(70,28,30,.42)'; g.fill();
        g.strokeStyle = 'rgba(255,225,170,.10)'; g.lineWidth = 1.2; for (let j = 0; j < 46; j++) { g.beginPath(); for (let x = 0; x <= PW; x += 8) g.lineTo(x, f(x) + 16 + j * 9 + Math.sin(x * .05 + j) * 2.5); g.stroke(); } g.restore(); };
      dune(690, 40, 1.2, '#f2b272', '#b46a48', 1.4); dune(800, 70, 3.1, '#f6a95e', '#a9553b', 1); dune(930, 95, .4, '#f59a4c', '#8f4232', .8); dune(1100, 80, 2.2, '#e98440', '#6b2c2a', .7);
    } },
    { title: 'Milky Way', tags: ['stars', 'night', 'galaxy', 'milky way', 'space'], days: 251, draw(g, T) {
      T.sky(['#02030b', '#060b1f', '#0d1a38', '#25304f']); T.stars(900, PH, .02);
      g.save(); g.translate(PW / 2, 520); g.rotate(-1.02); const nz = noise1(5);
      for (let i = 0; i < 260; i++) { const t = T.rr(-760, 760), off = (T.R() + T.R() + T.R() - 1.5) * 130, c = ['#6f86ff', '#b28cff', '#ffd9b0', '#8fd0ff'][Math.floor(T.R() * 4)]; T.glow(t, off, T.rr(50, 150), c, .05 + nz(t * .01 + 40, 3) * .06); }
      for (let i = 0; i < 40; i++) T.glow(T.rr(-300, 300), (T.R() - .5) * 60, T.rr(40, 100), '#ffe6c4', .07);
      for (let i = 0; i < 70; i++) { const t = T.rr(-700, 700); T.blob(t, (nz(t * .006, 4) - .5) * 120, T.rr(20, 70), 'rgba(3,4,14,1)', .35); }
      g.fillStyle = '#fff'; for (let i = 0; i < 1500; i++) { g.globalAlpha = T.rr(.2, .9); const t = T.rr(-780, 780), off = (T.R() + T.R() + T.R() - 1.5) * 150; g.fillRect(t, off, T.rr(.6, 1.8), T.rr(.6, 1.8)); }
      g.restore(); T.glow(300, PH, 520, '#ff9f5a', .28);
      const f = T.ridge(1090, 170, .0035, '#03050c', 21, { sharp: true }); T.pines(f, 24, 40, 90, '#03050c');
    } },
    { title: 'Cotton Candy Sky', tags: ['clouds', 'sky', 'pastel', 'pink'], days: 203, draw(g, T) {
      T.sky(['#7ea6e6', '#b7b5ee', '#f3bfd8', '#ffd9c2', '#fff0d6']); T.glow(200, 1050, 700, '#fff1cf', .6);
      for (let i = 0; i < 16; i++) { const d = i / 15, y = 1080 - d * 940 + T.rr(-30, 30), s = .45 + (1 - d) * 1.05; T.cloud(T.rr(-60, PW + 60), y, T.rr(300, 560) * s, T.rr(60, 105) * s, '#ffffff', i % 2 ? 'rgba(214,150,210,.95)' : 'rgba(150,140,220,.9)', .95); }
      for (let i = 0; i < 5; i++) T.cloud(T.rr(0, PW), T.rr(80, 380), T.rr(200, 360), T.rr(10, 18), 'rgba(255,240,245,.9)', 'rgba(255,190,215,.6)', .6);
    } },
    { title: 'Shoreline From Above', tags: ['ocean', 'beach', 'waves', 'aerial', 'water'], days: 170, draw(g, T) {
      g.fillStyle = T.grad(0, 0, PW, PH, ['#053b6b', '#0a6a9a', '#18a5b8', '#5fd6cf', '#c9f2e3']); g.fillRect(0, 0, PW, PH);
      const nz = noise1(8), shore = (y, k = 0) => 560 + (y - 600) * .42 + (nz(y * .004 + k, 4) - .5) * 190;
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(190,255,245,.06)'; g.lineWidth = 2;
      for (let j = 0; j < 90; j++) { g.beginPath(); const ox = T.rr(-200, 500), oy = T.rr(0, PH); for (let t = 0; t < 260; t += 10) g.lineTo(ox + t + Math.sin(t * .05 + j) * 14, oy + t * .45 + Math.cos(t * .04 + j) * 12); g.stroke(); } g.restore();
      g.beginPath(); g.moveTo(PW, 0); for (let y = 0; y <= PH; y += 6) g.lineTo(shore(y) + 40, y); g.lineTo(PW, PH); g.closePath(); g.fillStyle = T.grad(400, 0, PW, 0, ['#d9c49a', '#f1dfb6', '#f8ecd0']); g.fill();
      g.beginPath(); for (let y = 0; y <= PH; y += 6) g.lineTo(shore(y) + 40, y); g.lineWidth = 46; g.strokeStyle = 'rgba(196,170,120,.35)'; g.stroke();
      [[0, 26, .95], [-54, 14, .7], [-120, 9, .5], [-205, 6, .32], [-300, 4, .2]].forEach(([off, lw, a], k) => { g.beginPath(); for (let y = -10; y <= PH + 10; y += 5) g.lineTo(shore(y, k * .35) + off + Math.sin(y * .05 + k * 3) * (5 + k * 3), y);
        g.lineWidth = lw; g.lineCap = 'round'; g.strokeStyle = `rgba(255,255,255,${a})`; g.stroke(); g.lineWidth = lw * 2.6; g.strokeStyle = `rgba(255,255,255,${a * .22})`; g.stroke(); });
      for (let i = 0; i < 900; i++) { const y = T.R() * PH, x = shore(y) + T.rr(-46, 16); g.globalAlpha = T.rr(.3, .9); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, T.rr(.8, 3), 0, 7); g.fill(); } g.globalAlpha = 1;
    } },
    { title: 'Autumn Path', tags: ['autumn', 'fall', 'forest', 'trees', 'leaves', 'path'], days: 142, draw(g, T) {
      const vx = 450, vy = 600; T.sky(['#c9772b', '#f0b04d', '#ffe39a', '#b8742e', '#5a3316']); T.glow(vx, vy - 60, 520, '#fff3b8', .95);
      const leaf = ['#d9480f', '#f08c00', '#ffc034', '#b8320a', '#ffd76a', '#e8590c', '#8f2a08'];
      for (let L = 0; L < 4; L++) { const d = L / 3, n = 9 - L, col = ['#a0703c', '#6e4526', '#452913', '#22130a'][L];
        for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, x = vx + side * (70 + d * 60 + T.R() * (140 + d * 330)), w = 8 + d * 42 * T.rr(.7, 1.3), by = vy + 30 + d * 640; g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, by); g.lineTo(x - w * .3, -20); g.lineTo(x + w * .3, -20); g.lineTo(x + w / 2, by); g.closePath(); g.fill();
          for (let b = 0; b < 3; b++) { const y0 = T.rr(60, vy - 40); g.lineWidth = w * .22; g.strokeStyle = col; g.beginPath(); g.moveTo(x, y0 + 80); g.quadraticCurveTo(x + side * -40, y0 + 20, x + (T.R() - .5) * 300, y0 - 90); g.stroke(); } }
        for (let i = 0; i < 1100; i++) { const x = T.R() * PW, y = Math.pow(T.R(), 1.5) * (vy - 120 + d * 140), away = Math.abs(x - vx) / 450; if (away < .16 && y > 260) continue; g.globalAlpha = T.rr(.5, .95); g.fillStyle = leaf[Math.floor(T.R() * leaf.length)]; g.beginPath(); g.ellipse(x, y, T.rr(3, 8) * (1 + d), T.rr(2, 5) * (1 + d), T.R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1; }
      g.beginPath(); g.moveTo(vx - 16, vy + 20); g.lineTo(vx + 16, vy + 20); g.lineTo(PW * .93, PH); g.lineTo(PW * .07, PH); g.closePath(); g.fillStyle = T.grad(0, vy, 0, PH, ['#f3cf86', '#a9683a', '#54301a']); g.fill();
      for (let i = 0; i < 1500; i++) { const t = Math.pow(T.R(), .7), y = vy + 24 + t * (PH - vy), x = vx + (T.R() - .5) * (40 + t * 1500); g.globalAlpha = T.rr(.5, 1); g.fillStyle = leaf[Math.floor(T.R() * leaf.length)]; g.beginPath(); g.ellipse(x, y, 2 + t * 9, 1.4 + t * 5, T.R() * 3, 0, 7); g.fill(); } g.globalAlpha = 1;
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = T.rr(.9, 2.2), len = 1300, sp = T.rr(.03, .09); g.fillStyle = T.grad(vx, vy - 200, vx + Math.cos(a) * len, vy - 200 + Math.sin(a) * len, ['rgba(255,240,180,.16)', 'rgba(255,240,180,0)']);
        g.beginPath(); g.moveTo(vx, vy - 260); g.lineTo(vx + Math.cos(a - sp) * len, vy - 260 + Math.sin(a - sp) * len); g.lineTo(vx + Math.cos(a + sp) * len, vy - 260 + Math.sin(a + sp) * len); g.closePath(); g.fill(); } g.restore();
    } },
    { title: 'Alpenglow', tags: ['mountains', 'snow', 'peak', 'sunrise', 'winter'], days: 96, draw(g, T) {
      T.sky(['#1a2a5c', '#4a5b9c', '#c58bb0', '#ffc3a6'], 900); T.stars(90, 300); T.glow(120, 860, 600, '#ffb8a0', .5);
      const nz = noise1(31), px = 470, py = 250, edge = (x) => py + Math.abs(x - px) * (x < px ? 1.05 : .92) + (nz(x * .012, 5, .6) - .5) * 120 - 20;
      g.beginPath(); g.moveTo(-10, PH); for (let x = -10; x <= PW + 10; x += 3) g.lineTo(x, edge(x)); g.lineTo(PW + 10, PH); g.closePath(); g.fillStyle = T.grad(0, 250, 0, 1000, ['#7f86c9', '#4b5a97', '#2b3a6c']); g.fill();
      g.save(); g.clip(); for (let i = 0; i < 26; i++) { const x0 = px - 380 + i * 30 + T.rr(-12, 12), y0 = edge(x0), len = T.rr(180, 520), wd = T.rr(30, 90);
        g.beginPath(); g.moveTo(x0, y0 - 4); g.lineTo(x0 - wd * .2 - len * .42, y0 + len); g.lineTo(x0 - wd - len * .62, y0 + len * .92); g.closePath(); g.fillStyle = T.grad(x0, y0, x0 - len * .5, y0 + len, ['#ffc0a8', '#ff9f9a', 'rgba(230,130,160,0)']); g.fill(); }
      for (let i = 0; i < 160; i++) { const x = T.rr(0, PW), y = edge(x) + T.rr(60, 600); g.strokeStyle = 'rgba(20,28,70,.25)'; g.lineWidth = T.rr(1, 3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + T.rr(-30, 30), y + T.rr(30, 110)); g.stroke(); } g.restore();
      T.mist(900, 110, 'rgba(255,215,215,.75)'); const f1 = T.ridge(1000, 90, .004, '#1b2447', 9); T.pines(f1, 40, 60, 130, '#1b2447'); T.mist(1060, 60, 'rgba(200,190,230,.5)'); const f2 = T.ridge(1130, 70, .005, '#0b1026', 13); T.pines(f2, 26, 130, 260, '#0b1026');
    } },
    { title: 'Lavender Rows', tags: ['lavender', 'field', 'flowers', 'sunset', 'purple'], days: 61, draw(g, T) {
      const hz = 520; T.sky(['#4d5fae', '#c48bc0', '#ffb07c', '#ffe3a1'], hz); T.glow(640, hz - 10, 460, '#ffd28a', .9); g.fillStyle = '#fff2c8'; g.beginPath(); g.arc(640, hz - 14, 40, 0, 7); g.fill();
      for (let i = 0; i < 5; i++) T.cloud(T.rr(0, PW), T.rr(120, 380), T.rr(240, 420), T.rr(16, 30), 'rgba(255,205,170,.9)', 'rgba(120,80,150,.7)', .7);
      T.ridge(hz + 4, 50, .004, '#54407c', 2); g.fillStyle = '#3c2a66'; g.fillRect(0, hz, PW, PH - hz);
      const vx = 520, rows = 15; for (let i = -rows; i < rows; i++) { const x0 = vx + i * 150, x1 = vx + (i + .62) * 150; g.beginPath(); g.moveTo(vx + i * 3, hz); g.lineTo(vx + (i + .62) * 3, hz); g.lineTo(x1 * 2.4 - vx * 1.4, PH); g.lineTo(x0 * 2.4 - vx * 1.4, PH); g.closePath();
        g.fillStyle = T.grad(0, hz, 0, PH, ['#b08ad6', '#8a5cc7', '#5e34a0']); g.fill(); }
      for (let i = 0; i < 5200; i++) { const t = Math.pow(T.R(), .6), y = hz + 4 + t * (PH - hz), lane = Math.floor(T.rr(-rows, rows)), u = T.R() * .62, x = vx + (lane + u) * (3 + t * 357); if (x < -10 || x > PW + 10) continue;
        g.globalAlpha = T.rr(.4, .95); g.fillStyle = ['#d7b6ff', '#a673e6', '#7a45c4', '#f2dcff', '#ffcf9a'][Math.floor(T.R() * 5)]; g.beginPath(); g.ellipse(x, y, 1 + t * 5, 1.6 + t * 9, 0, 0, 7); g.fill(); } g.globalAlpha = 1;
      g.fillStyle = '#2a1a44'; g.fillRect(196, hz - 70, 7, 74); for (let i = 0; i < 34; i++) { g.beginPath(); g.arc(200 + T.rr(-44, 44), hz - 96 + T.rr(-36, 30), T.rr(12, 26), 0, 7); g.fill(); }
      g.fillStyle = T.grad(0, hz, 0, PH, ['rgba(255,190,120,.35)', 'rgba(40,10,70,0)']); g.fillRect(0, hz, PW, 360);
    } },
    { title: 'Still Water', tags: ['lake', 'mountains', 'reflection', 'morning', 'water'], days: 33, draw(g, T) {
      const hz = 640; T.sky(['#6fa3d8', '#a9cbe8', '#f6e3cf', '#ffd1a6'], hz); T.glow(250, hz - 60, 420, '#fff0cf', .8);
      for (let i = 0; i < 6; i++) T.cloud(T.rr(0, PW), T.rr(90, 360), T.rr(260, 480), T.rr(26, 50), '#ffffff', 'rgba(170,180,215,.85)', .85);
      T.ridge(hz, 330, .0032, '#8fa6c6', 41, { sharp: true }); T.mist(hz - 40, 60, 'rgba(255,255,255,.6)'); T.ridge(hz, 210, .004, '#5d7aa0', 42, { sharp: true });
      const f = T.ridge(hz, 80, .006, '#2c4a56', 43); T.pines(f, 60, 40, 100, '#21404a'); g.fillStyle = '#21404a'; g.fillRect(0, hz - 4, PW, 6);
      g.save(); g.translate(0, hz * 2); g.scale(1, -1); g.drawImage(g.canvas, 0, hz - (PH - hz), PW, PH - hz, 0, hz - (PH - hz), PW, PH - hz); g.restore();
      g.fillStyle = T.grad(0, hz, 0, PH, ['rgba(20,50,80,.12)', 'rgba(8,30,55,.62)']); g.fillRect(0, hz, PW, PH - hz);
      for (let i = 0; i < 150; i++) { const t = Math.pow(T.R(), .8), y = hz + 6 + t * (PH - hz); g.fillStyle = `rgba(255,255,255,${T.rr(.04, .14)})`; g.fillRect(T.rr(-100, PW), y, T.rr(60, 420) * (.4 + t), 1 + t * 2.4); }
    } },
    { title: 'Island Dusk', tags: ['beach', 'palm', 'tropical', 'sunset', 'ocean'], days: 19, draw(g, T) {
      const hz = 830; T.sky(['#12355f', '#2f7f9b', '#f2a68a', '#ffcf86', '#ffe9b0'], hz); T.glow(330, hz - 120, 520, '#ffc27a', .85);
      g.fillStyle = T.grad(0, hz - 300, 0, hz, ['#fff3c4', '#ff9d6c']); g.beginPath(); g.arc(330, hz - 120, 92, 0, 7); g.fill();
      for (let i = 0; i < 5; i++) T.cloud(T.rr(0, PW), T.rr(200, 560), T.rr(260, 460), T.rr(14, 26), 'rgba(255,200,160,.9)', 'rgba(60,70,120,.7)', .75);
      g.fillStyle = T.grad(0, hz, 0, PH, ['#f59a6f', '#7b4d78', '#1c2447']); g.fillRect(0, hz, PW, PH - hz); T.streaks(330, hz + 4, PH, 130, '#ffe0a0', 300);
      const palm = (bx, by, h, lean, sc) => { const tx = bx + lean, ty = by - h; g.strokeStyle = '#0a0f1e'; g.lineCap = 'round'; for (let i = 0; i < 24; i++) { const t = i / 24, t2 = (i + 1) / 24, q = (u) => [bx + lean * u * u, by - h * u]; const a = q(t), b = q(t2); g.lineWidth = (22 - t * 12) * sc; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        for (let k = 0; k < 9; k++) { const ang = -Math.PI * (.04 + k / 8 * .92) + T.rr(-.1, .1), len = T.rr(230, 330) * sc, ex = tx + Math.cos(ang) * len, ey = ty + Math.sin(ang) * len * .7 + len * .42, cx = tx + Math.cos(ang) * len * .55, cy = ty + Math.sin(ang) * len * .9 - 30 * sc;
          g.lineWidth = 5 * sc; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke(); g.lineWidth = 2.6 * sc;
          for (let j = 1; j < 26; j++) { const u = j / 26, mx = (1 - u) * (1 - u) * tx + 2 * (1 - u) * u * cx + u * u * ex, my = (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * cy + u * u * ey, ll = (1 - Math.abs(u - .45)) * 74 * sc; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(ang) * 12 * sc - 6 * sc, my + ll); g.stroke(); } } };
      g.fillStyle = '#0a0f1e'; g.beginPath(); g.moveTo(420, PH); g.quadraticCurveTo(700, 1010, PW, 1040); g.lineTo(PW, PH); g.closePath(); g.fill();
      palm(760, 1090, 640, -150, 1); palm(860, 1080, 470, 60, .78); palm(610, 1130, 360, -90, .6);
    } },
    { title: 'Cherry Blossoms', tags: ['flowers', 'spring', 'blossom', 'pink', 'tree'], days: 8, draw(g, T) {
      T.sky(['#6db3ee', '#a7d4f6', '#e3f1fb', '#fbe6ee']); T.glow(760, 160, 520, '#ffffff', .7);
      for (let i = 0; i < 26; i++) T.blob(T.R() * PW, T.R() * PH, T.rr(40, 120), ['#ffc6dc', '#ffe1ec', '#ffffff'][i % 3], T.rr(.25, .5));
      const tips = []; const branch = (x, y, a, len, w, d) => { const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2 + T.rr(-len, len) * .16, my = (y + ey) / 2 + T.rr(-len, len) * .16;
        g.strokeStyle = d < 2 ? '#2b1b17' : '#3d2922'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
        if (d > 1) for (let i = 0; i < 4; i++) { const u = T.R(); tips.push([x + (ex - x) * u + T.rr(-14, 14), y + (ey - y) * u + T.rr(-14, 14), d]); }
        if (d < 6) { const n = d < 2 ? 3 : 2; for (let i = 0; i < n; i++) branch(ex, ey, a + T.rr(-.75, .75), len * T.rr(.62, .8), w * .64, d + 1); } else tips.push([ex, ey, d]); };
      branch(-30, 1130, -.62, 330, 40, 0); branch(PW + 30, 320, Math.PI - .35, 250, 24, 1);
      const pet = ['#ffd3e2', '#ffb3cd', '#ff8fb5', '#fff0f5', '#ffc2d6'];
      tips.forEach(([x, y]) => { const n = Math.floor(T.rr(3, 8)); for (let k = 0; k < n; k++) { const fx = x + T.rr(-26, 26), fy = y + T.rr(-26, 26), r = T.rr(7, 13); g.fillStyle = pet[Math.floor(T.R() * pet.length)];
        for (let p = 0; p < 5; p++) { const a = p * 1.2566 + fx; g.beginPath(); g.ellipse(fx + Math.cos(a) * r * .6, fy + Math.sin(a) * r * .6, r * .62, r * .46, a, 0, 7); g.fill(); } g.fillStyle = '#e8527f'; g.beginPath(); g.arc(fx, fy, r * .2, 0, 7); g.fill(); } });
      for (let i = 0; i < 16; i++) T.blob(T.R() * PW, T.R() * PH, T.rr(30, 80), '#ffc4da', T.rr(.35, .7));
    } },
    { title: 'Foggy Pines', tags: ['forest', 'fog', 'trees', 'pines', 'moody', 'green'], days: 2, draw(g, T) {
      T.sky(['#dfe9e6', '#c4d6d2', '#a5bfba', '#8aa9a4']); T.glow(560, 240, 460, '#ffffff', .6);
      const cols = ['#a9c2bc', '#86a59e', '#628781', '#426a65', '#274b49', '#12302f', '#081c1c'];
      cols.forEach((c, i) => { const f = T.ridge(430 + i * 118, 90, .0035 + i * .0006, c, 60 + i * 5, { tilt: (i % 2 ? .05 : -.05) }); T.pines(f, 40 - i * 3, 60 + i * 34, 120 + i * 62, c); T.mist(520 + i * 118, 80, 'rgba(232,242,240,.85)', .8 - i * .09); });
    } },
  ];

  async function seedLibrary() {
    if (S.seeding) return; S.seeding = true;
    const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
    try {
      for (let i = 0; i < SCENES.length; i++) {
        if (!S) return;
        const sc = SCENES[i]; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, PW, PH);
        g.save(); try { sc.draw(g, P(g, 1000 + i * 131)); } catch (e) { console.error('[photos seed]', sc.title, e); } g.restore(); finish(g);
        const r = rng(i + 5), d = new Date(Date.now() - sc.days * 864e5); d.setHours(7 + Math.floor(r() * 13), Math.floor(r() * 60), Math.floor(r() * 60));
        const item = await OS.photos.add({ src: c.toDataURL('image/jpeg', .85), kind: 'photo', date: d.getTime(), meta: { title: sc.title, tags: sc.tags, seeded: true, w: PW, h: PH } });
        if ([1, 6, 10, 14].includes(i) && item && item.id) await OS.photos.update(item.id, { favorite: true });
        await new Promise((res) => setTimeout(res, 16));
      }
      OS.store.set('photos.seeded', true);
    } finally { if (S) S.seeding = false; }
  }

  /* ───────────────────────── data ───────────────────────── */
  async function load() {
    let list = [];
    try { list = await OS.photos.all(); } catch (e) { list = []; }
    if (!S) return;
    const extra = OS.store.get('photos.meta', {}) || {};
    list.forEach((it) => { it.m = Object.assign({}, it.meta || {}, extra[it.id] || {}); if (it.poster) S.posters.set(it.id, it.poster); });
    list.sort((a, b) => a.date - b.date);
    S.items = list; S.byId = new Map(list.map((it) => [it.id, it]));
  }
  function scheduleRefresh() { if (!S) return; clearTimeout(S.refreshT); S.refreshT = setTimeout(refresh, 60); }
  async function refresh() {
    if (!S) return;
    const before = S.items.length; await load(); if (!S) return;
    // drop stale selections
    [...S.sel.ids].forEach((id) => { if (!S.byId.has(id)) S.sel.ids.delete(id); });
    renderLibrary(S.items.length > before);
    if (S.albumsPage) renderAlbums(S.albumsPage.body);
    S.openGrids.forEach((og) => og.redraw());
    if (S.searchPage) renderSearch();
    updateSelBar(); viewerSync(); syncStatusBar();
  }
  const FILTERS = {
    recents: () => true, favorites: (it) => !!it.favorite, videos: isVid, selfies: (it) => !!it.m.selfie, portrait: (it) => !!it.m.portrait,
    panoramas: (it) => !!it.m.pano, screenshots: (it) => it.kind === 'screenshot', photosOnly: (it) => it.kind === 'photo',
  };
  const userAlbums = () => OS.store.get('photos.albums', []) || [];
  function albumItems(key) {
    if (FILTERS[key]) return S.items.filter(FILTERS[key]);
    if (key.startsWith('month:')) { const [y, m] = key.slice(6).split('-').map(Number); return S.items.filter((it) => { const d = new Date(it.date); return d.getFullYear() === y && d.getMonth() === m; }); }
    const a = userAlbums().find((x) => x.id === key); if (!a) return [];
    const set = new Set(a.items); return S.items.filter((it) => set.has(it.id));
  }

  /* video posters (the store keeps only src/kind/date/meta, so make one from the first frame and cache it on the record) */
  function getPoster(it) {
    if (it.poster) return Promise.resolve(it.poster);
    if (S.posters.has(it.id)) return Promise.resolve(S.posters.get(it.id));
    if (S.posterJobs.has(it.id)) return S.posterJobs.get(it.id);
    const job = new Promise((resolve) => {
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
      let done = false; const fin = (url) => { if (done) return; done = true; clearTimeout(to); v.removeAttribute('src'); try { v.load(); } catch (e) {} resolve(url); };
      const to = setTimeout(() => fin(null), 6000);
      v.addEventListener('loadeddata', () => { try { v.currentTime = Math.min(.15, (isFinite(v.duration) ? v.duration : 1) / 2); } catch (e) { fin(null); } });
      v.addEventListener('seeked', () => {
        try {
          const w = v.videoWidth || 360, h = v.videoHeight || 480, k = 480 / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); const url = c.toDataURL('image/jpeg', .8);
          if (S) { S.posters.set(it.id, url); S.aspect.set(it.id, w / h); if (isFinite(v.duration)) S.durs.set(it.id, v.duration); }
          OS.db.get('photos', it.id).then((rec) => { if (rec && !rec.poster) { rec.poster = url; return OS.db.put('photos', rec); } }).catch(() => {});
          fin(url);
        } catch (e) { fin(null); }
      });
      v.addEventListener('error', () => fin(null));
      v.src = it.src;
    });
    S.posterJobs.set(it.id, job); job.then(() => S && S.posterJobs.delete(it.id));
    return job;
  }

  /* ───────────────────────── grid ───────────────────────── */
  function cellHTML(it) {
    const dur = isVid(it) ? `<span class="ph-dur">${fmtDur(S.durs.get(it.id) || it.m.duration || 0)}</span>` : '';
    return `<div class="ph-cell${it.favorite ? ' fav' : ''}${S.sel.ids.has(it.id) ? ' sel' : ''}" data-id="${esc(it.id)}"><img alt="" draggable="false" loading="lazy" decoding="async">${dur}<i class="ph-fav">${IC.heartFill}</i><i class="ph-ck">${IC.check}</i></div>`;
  }
  function fillGrid(grid, list) {
    grid._list = list;
    grid.innerHTML = list.map(cellHTML).join('');
    grid.querySelectorAll('.ph-cell').forEach((cell, i) => {
      const it = list[i], img = cell.firstElementChild;
      img.addEventListener('load', () => { img.classList.add('ok'); if (img.naturalWidth && !isVid(it)) S && S.aspect.set(it.id, img.naturalWidth / img.naturalHeight); });
      const src = thumbSrc(it);
      if (src) img.src = src;
      else if (isVid(it)) getPoster(it).then((url) => { if (url && img.isConnected) { img.src = url; const d = cell.querySelector('.ph-dur'); if (d && S && S.durs.get(it.id)) d.textContent = fmtDur(S.durs.get(it.id)); } });
    });
  }
  function makeGrid(cols) {
    const grid = U.el(`<div class="ph-grid ph-cols-${cols || 3}" style="--cols:${cols || 3}"></div>`);
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.ph-cell'); if (!cell || !S) return;
      const id = cell.dataset.id, list = grid._list || [];
      if (S.sel.active) { if (S.sel.ids.has(id)) S.sel.ids.delete(id); else S.sel.ids.add(id); cell.classList.toggle('sel', S.sel.ids.has(id)); OS.haptic('selection'); updateSelBar(); return; }
      const i = list.findIndex((x) => x.id === id); if (i >= 0) openViewer(list, i, cell);
    });
    U.longPress(grid, (e) => {
      const cell = e.target.closest && e.target.closest('.ph-cell'); if (!cell || !S || S.sel.active) return;
      const it = S.byId.get(cell.dataset.id); if (!it) return;
      OS.ui.contextMenu(cell, [
        { label: 'Copy', icon: IC.copy, onTap: () => copyPhoto(it) },
        { label: it.favorite ? 'Unfavorite' : 'Favorite', icon: it.favorite ? IC.heartFill : IC.heart, onTap: () => OS.photos.update(it.id, { favorite: !it.favorite }) },
        { label: 'Duplicate', icon: IC.dup, onTap: () => duplicate(it) },
        { label: 'Delete', icon: IC.trash, style: 'destructive', onTap: () => confirmDelete([it.id]) },
      ]);
    });
    return grid;
  }

  /* ───────────────────────── select mode ───────────────────────── */
  function setSelecting(on, owner) {
    if (!S || S.sel.active === on) return;
    S.sel.active = on; S.sel.ids.clear(); S.sel.owner = on ? owner : null;
    S.root.classList.toggle('selecting', on); S.lib.classList.toggle('selecting-mode', on);
    S.root.querySelectorAll('.ph-cell.sel').forEach((c) => c.classList.remove('sel'));
    S.selBar.classList.toggle('in', on);
    S.lib.querySelector('[data-act="select"]').textContent = on ? 'Cancel' : 'Select';
    S.openGrids.forEach((og) => og.syncRight());
    updateSelBar();
  }
  function updateSelBar() {
    if (!S) return; const n = S.sel.ids.size;
    S.selBar.querySelector('b').textContent = n ? plural(n, 'Item') + ' Selected' : 'Select Items';
    S.selBar.querySelectorAll('button').forEach((b) => b.classList.toggle('off', !n));
  }
  async function confirmDelete(ids) {
    if (!ids.length) return false;
    const its = ids.map((id) => S.byId.get(id)).filter(Boolean), allVid = its.every(isVid), word = its.length === 1 ? (allVid ? 'Video' : 'Photo') : (allVid ? 'Videos' : its.some(isVid) ? 'Items' : 'Photos');
    const r = await OS.ui.actionSheet({ message: its.length === 1 ? `This ${word.toLowerCase()} will be deleted from your library on this iPhone.` : `These ${word.toLowerCase()} will be deleted from your library on this iPhone.`,
      buttons: [{ label: its.length === 1 ? 'Delete ' + word : `Delete ${its.length} ${word}`, style: 'destructive' }], cancel: 'Cancel' });
    if (r !== 0 || !S) return false;
    OS.sound.play('trash');
    const albums = userAlbums(); let touched = false;
    albums.forEach((a) => { const n = a.items.length; a.items = a.items.filter((x) => !ids.includes(x)); if (a.items.length !== n) touched = true; });
    if (touched) OS.store.set('photos.albums', albums);
    for (const id of ids) { try { await OS.photos.remove(id); } catch (e) {} }
    return true;
  }
  async function selAction(act, anchor) {
    const ids = [...S.sel.ids]; if (!ids.length) return;
    if (act === 'trash') { if (await confirmDelete(ids)) setSelecting(false); return; }
    const its = ids.map((id) => S.byId.get(id)).filter(Boolean), allFav = its.every((x) => x.favorite);
    OS.ui.contextMenu(anchor, [
      { label: allFav ? 'Unfavorite' : 'Favorite', icon: IC.heart, onTap: async () => { for (const it of its) await OS.photos.update(it.id, { favorite: !allFav }); setSelecting(false); } },
      { label: 'Add to Album', icon: IC.album, onTap: () => addToAlbum(ids).then((ok) => ok && setSelecting(false)) },
      { label: 'Duplicate', icon: IC.dup, onTap: async () => { for (const it of its) await duplicate(it, true); OS.ui.toast(plural(its.length, 'Item') + ' Duplicated'); setSelecting(false); } },
    ]);
  }

  /* ───────────────────────── shared actions ───────────────────────── */
  async function copyPhoto(it) {
    try {
      if (!isVid(it) && navigator.clipboard && window.ClipboardItem) {
        const img = new Image(); img.src = it.src; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch (e) { /* clipboard blocked — the HUD still confirms like iOS */ }
    OS.ui.toast('Copied');
  }
  async function duplicate(it, quiet) {
    try { await OS.photos.add({ src: it.src, kind: it.kind, date: Date.now(), meta: Object.assign({}, it.m, { seeded: false }) }); if (!quiet) OS.ui.toast('Duplicated'); }
    catch (e) { OS.ui.toast('Unable to Duplicate'); }
  }
  const fileName = (it) => 'IMG_' + String(S.items.indexOf(it) + 1).padStart(4, '0') + (isVid(it) ? '.MOV' : it.kind === 'screenshot' ? '.PNG' : '.JPG');
  const byteSize = (it) => Math.round(Math.max(0, (String(it.src).length - 23)) * .75);
  const fmtBytes = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  async function saveToFiles(it) {
    try { await OS.db.put('files', { name: fileName(it), kind: isVid(it) ? 'video' : 'image', src: it.src, size: byteSize(it), date: Date.now(), from: 'photos' }); OS.ui.toast('Saved to Files'); }
    catch (e) { OS.ui.toast('Unable to Save'); }
  }
  async function addToAlbum(ids) {
    const albums = userAlbums();
    const r = await OS.ui.actionSheet({ title: 'Add to Album', buttons: albums.map((a) => ({ label: a.name })).concat([{ label: 'New Album…' }]), cancel: 'Cancel' });
    if (r < 0) return false;
    let a = albums[r];
    if (!a) { const name = await OS.ui.prompt({ title: 'New Album', message: 'Enter a name for this album.', placeholder: 'Title', okLabel: 'Save' }); if (!name || !name.trim()) return false; a = { id: 'a' + U.uid(), name: name.trim(), items: [] }; albums.push(a); }
    ids.forEach((id) => { if (!a.items.includes(id)) a.items.push(id); });
    OS.store.set('photos.albums', albums); OS.ui.toast('Added to “' + a.name + '”'); scheduleRefresh(); return true;
  }

  /* ───────────────────────── Library tab ───────────────────────── */
  function libList() { return S.items.filter(FILTERS[S.libFilter] || FILTERS.recents); }
  function renderLibrary(toBottom) {
    const body = S.lib.querySelector('.ph-lib-body'), sc = S.libScroll, list = libList();
    S.lib.classList.toggle('is-empty', !S.items.length && !S.seeding);
    const keep = sc.scrollHeight - sc.scrollTop;
    body.innerHTML = '';
    S.lib.querySelectorAll('.ph-lib-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === S.libMode));
    if (S.libMode === 'all') {
      const grid = makeGrid(S.cols); fillGrid(grid, list); body.appendChild(grid); S.libGrid = grid;
      if (list.length) body.appendChild(U.el(`<div class="ph-count">${esc(countLabel(list))}<span>${S.libFilter === 'recents' ? 'Updated Just Now' : 'Filtered'}</span></div>`));
    } else {
      S.libGrid = null;
      const groups = new Map();
      list.forEach((it) => { const d = new Date(it.date), k = S.libMode === 'years' ? String(d.getFullYear()) : d.getFullYear() + '-' + d.getMonth(); (groups.get(k) || groups.set(k, []).get(k)).push(it); });
      const cards = U.el('<div class="ph-cards"></div>');
      groups.forEach((its, k) => {
        const cover = its.find((x) => x.favorite && !isVid(x)) || its.filter((x) => !isVid(x)).pop() || its[its.length - 1], d = new Date(cover.date);
        const card = U.el(`<div class="ph-card" data-k="${k}"><img alt="" draggable="false"><div class="ph-card-t"><b>${S.libMode === 'years' ? d.getFullYear() : MONTHS[d.getMonth()]}</b><span>${S.libMode === 'years' ? esc(countLabel(its)) : d.getFullYear() + ' · ' + esc(countLabel(its))}</span></div></div>`);
        const src = thumbSrc(cover); if (src) card.firstElementChild.src = src; else getPoster(cover).then((u) => u && (card.firstElementChild.src = u));
        card.addEventListener('click', () => { const first = its[0]; if (S.libMode === 'years') { S.libMode = 'months'; renderLibrary(); const el = S.lib.querySelector(`.ph-card[data-k^="${k}-"]`); if (el) sc.scrollTop = el.offsetTop - 110; }
          else { S.libMode = 'all'; renderLibrary(); const el = S.libGrid && S.libGrid.querySelector(`[data-id="${CSS.escape(first.id)}"]`); if (el) sc.scrollTop = Math.max(0, el.offsetTop - 4); } updateLibTitle(); });
        cards.appendChild(card);
      });
      body.appendChild(cards);
    }
    if (toBottom || !S.libReady) { sc.scrollTop = sc.scrollHeight; if (list.length) S.libReady = true; } else sc.scrollTop = Math.max(0, sc.scrollHeight - keep);
    updateLibTitle();
  }
  function updateLibTitle() {
    if (!S) return; const list = libList(), sc = S.libScroll, t = S.lib.querySelector('.ph-lib-title b'), sub = S.lib.querySelector('.ph-lib-title span');
    const fl2 = { recents: '', favorites: 'Favorites', photosOnly: 'Photos', videos: 'Videos' }[S.libFilter] || '';
    if (!list.length) { t.textContent = fl2 || 'Library'; sub.textContent = fl2 ? 'No Items' : ''; return; }
    if (S.libMode !== 'all' || !S.libGrid) { t.textContent = S.libMode === 'years' ? 'Years' : 'Months'; sub.textContent = fl2 || fmtRange(list[0].date, list[list.length - 1].date); return; }
    const rowH = (W - (S.cols - 1) * 2) / S.cols * (S.cols === 1 ? 4 / 3 : 1) + 2, top = sc.scrollTop - 108;
    const a = U.clamp(Math.floor((top + 100) / rowH) * S.cols, 0, list.length - 1), b = U.clamp((Math.floor((top + H - 100) / rowH) + 1) * S.cols - 1, 0, list.length - 1);
    t.textContent = fmtRange(list[a].date, list[b].date); sub.textContent = fl2;
  }
  function libMenu(anchor) {
    const zoomIn = { 5: 3, 3: 1 }[S.cols], zoomOut = { 1: 3, 3: 5 }[S.cols], items = [];
    const setCols = (c) => { S.cols = c; OS.store.set('photos.cols', c); S.libMode = 'all'; renderLibrary(); };
    if (zoomIn) items.push({ label: 'Zoom In', onTap: () => setCols(zoomIn) });
    if (zoomOut) items.push({ label: 'Zoom Out', onTap: () => setCols(zoomOut) });
    [['recents', 'All Items'], ['favorites', 'Favorites'], ['photosOnly', 'Photos'], ['videos', 'Videos']].forEach(([k, label]) =>
      items.push({ label: (S.libFilter === k ? '✓ ' : '') + label, onTap: () => { S.libFilter = k; renderLibrary(true); } }));
    OS.ui.contextMenu(anchor, items);
  }
  function buildLibrary(pane) {
    pane.classList.add('ph-lib');
    pane.innerHTML = `<div class="ph-lib-scroll ios-scroll"><div class="ph-lib-body"></div></div>
      <div class="ph-lib-head"><div class="ph-lib-title"><b></b><span></span></div><div class="ph-lib-btns"><button class="ph-chip" data-act="select">Select</button><button class="ph-chip round" data-act="more" aria-label="More">${IC.dots}</button></div></div>
      <div class="ph-lib-seg"><button data-m="years">Years</button><button data-m="months">Months</button><button data-m="all">All Photos</button></div>
      <div class="ph-empty"><b>No Photos or Videos</b><span>You can take photos and videos using the camera, and they will appear here.</span></div>`;
    S.lib = pane; S.libScroll = pane.querySelector('.ph-lib-scroll');
    let raf = 0; S.libScroll.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateLibTitle(); }); });
    pane.querySelector('[data-act="select"]').addEventListener('click', () => { if (S.sel.active) setSelecting(false); else { if (S.libMode !== 'all') { S.libMode = 'all'; renderLibrary(true); } setSelecting(true, 'library'); } });
    pane.querySelector('[data-act="more"]').addEventListener('click', (e) => libMenu(e.currentTarget));
    pane.querySelector('.ph-lib-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.m === S.libMode) return; OS.haptic('selection'); S.libMode = b.dataset.m; renderLibrary(true); });
  }

  /* ───────────────────────── Albums tab ───────────────────────── */
  function coverHTML(list, glyph) {
    const c = list.length ? list[list.length - 1] : null, src = c ? thumbSrc(c) : '';
    return `<div class="ph-alb-cover" ${c && !src ? `data-poster="${esc(c.id)}"` : ''}>${c ? `<img alt="" draggable="false" ${src ? `src="${src}"` : ''}>` : IC.album}${glyph ? `<i>${glyph}</i>` : ''}</div>`;
  }
  function renderAlbums(body) {
    const keep = body.scrollTop, ua = userAlbums();
    const alb = (key, name, glyph) => { const l = albumItems(key); return `<div class="ph-alb" data-key="${esc(key)}" data-name="${esc(name)}">${coverHTML(l, glyph)}<b>${esc(name)}</b><span>${l.length.toLocaleString('en-US')}</span></div>`; };
    const type = (key, name, icon) => `<div class="ph-type" data-key="${key}" data-name="${name}">${icon}<b>${name}</b><span>${albumItems(key).length.toLocaleString('en-US')}</span><i class="ios-chevron"></i></div>`;
    body.innerHTML = `<div class="ph-sec"><b>My Albums</b></div><div class="ph-albums">${alb('recents', 'Recents')}${alb('favorites', 'Favorites', IC.heartFill)}${ua.map((a) => alb(a.id, a.name)).join('')}</div>
      <div class="ph-sec"><b>Media Types</b></div><div class="ph-types">${type('videos', 'Videos', IC.video)}${type('selfies', 'Selfies', IC.selfie)}${type('portrait', 'Portrait', IC.portrait)}${type('panoramas', 'Panoramas', IC.pano)}${type('screenshots', 'Screenshots', IC.shot)}</div><div style="height:24px"></div>`;
    body.querySelectorAll('[data-poster]').forEach((el) => { const it = S.byId.get(el.dataset.poster); if (it) getPoster(it).then((u) => { if (u && el.isConnected) el.querySelector('img').src = u; }); });
    body.scrollTop = keep;
    if (body._wired) return; body._wired = true;
    body.addEventListener('click', (e) => { const el = e.target.closest('[data-key]'); if (el) pushAlbum(S.navs.albums, el.dataset.key, el.dataset.name, 'Albums'); });
    U.longPress(body, (e) => {
      const el = e.target.closest && e.target.closest('.ph-alb'); if (!el || !el.dataset.key.startsWith('a')) return; const key = el.dataset.key; if (FILTERS[key]) return;
      OS.ui.contextMenu(el, [
        { label: 'Rename Album', onTap: async () => { const as = userAlbums(), a = as.find((x) => x.id === key); if (!a) return; const n = await OS.ui.prompt({ title: 'Rename Album', value: a.name, placeholder: 'Title', okLabel: 'Save' }); if (n && n.trim()) { a.name = n.trim(); OS.store.set('photos.albums', as); scheduleRefresh(); } } },
        { label: 'Delete Album', style: 'destructive', icon: IC.trash, onTap: async () => { const r = await OS.ui.actionSheet({ message: 'Are you sure you want to delete this album? The photos will not be deleted.', buttons: [{ label: 'Delete Album', style: 'destructive' }], cancel: 'Cancel' }); if (r === 0) { OS.store.set('photos.albums', userAlbums().filter((x) => x.id !== key)); scheduleRefresh(); } } },
      ]);
    });
  }
  async function newAlbum() {
    const name = await OS.ui.prompt({ title: 'New Album', message: 'Enter a name for this album.', placeholder: 'Title', okLabel: 'Save' });
    if (!name || !name.trim() || !S) return;
    const as = userAlbums(); as.push({ id: 'a' + U.uid(), name: name.trim(), items: [] }); OS.store.set('photos.albums', as); scheduleRefresh();
  }
  function pushAlbum(nav, key, name, back) {
    const og = { key, page: null, grid: null,
      redraw() {
        if (!og.page) return; const body = og.page.body, list = albumItems(key), keep = body.scrollHeight - body.scrollTop, first = !og.grid;
        body.innerHTML = '';
        if (!list.length) { og.grid = makeGrid(3); body.appendChild(U.el(`<div class="ph-none"><b>No Photos or Videos</b><span>${key === 'favorites' ? 'Tap the heart on any photo to see it here.' : 'Items you add will appear in this album.'}</span></div>`)); return; }
        og.grid = makeGrid(3); fillGrid(og.grid, list); body.appendChild(og.grid); body.appendChild(U.el(`<div class="ph-count">${esc(countLabel(list))}</div>`));
        body.scrollTop = first ? body.scrollHeight : Math.max(0, body.scrollHeight - keep);
      },
      syncRight() { if (og.page) og.page.setRight([{ label: S.sel.active ? 'Cancel' : 'Select', bold: S.sel.active, onTap: () => setSelecting(!S.sel.active, key) }]); },
    };
    nav.push({ title: name, back, right: [{ label: 'Select', onTap: () => setSelecting(!S.sel.active, key) }],
      render(body, page) { og.page = page; if (S.openGrids.indexOf(og) < 0) S.openGrids.push(og); og.grid = null; og.redraw(); },
      onShow() { if (S && S.openGrids.indexOf(og) < 0) S.openGrids.push(og); },
      onHide() { if (!S) return; if (S.sel.active && S.sel.owner === key) setSelecting(false); setTimeout(() => { if (S && og.page && !og.page.el.isConnected) { const i = S.openGrids.indexOf(og); if (i >= 0) S.openGrids.splice(i, 1); } }, 700); },
    });
  }

  /* ───────────────────────── Search tab ───────────────────────── */
  function haystack(it) {
    const d = new Date(it.date), a = [it.kind, it.kind + 's', MONTHS[d.getMonth()], String(d.getFullYear()), DAYS[d.getDay()], it.m.title || ''].concat(it.m.tags || []);
    if (it.favorite) a.push('favorite', 'favorites', 'favourite'); if (it.m.selfie) a.push('selfie', 'selfies'); if (it.m.portrait) a.push('portrait'); if (it.m.pano) a.push('panorama', 'pano');
    const season = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall autumn', 'fall autumn', 'fall autumn', 'winter'][d.getMonth()];
    return (a.join(' ') + ' ' + season).toLowerCase();
  }
  function setQuery(q) { S.q = q; const inp = S.searchPage && S.searchPage.el.querySelector('.ios-search input, input'); if (inp && inp.value !== q) inp.value = q; renderSearch(); }
  function renderSearch() {
    const body = S.searchPage.body, q = (S.q || '').trim().toLowerCase();
    if (!q) {
      const tagCount = new Map(); S.items.forEach((it) => (it.m.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
      const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map((x) => x[0]);
      const months = new Map(); S.items.forEach((it) => { const d = new Date(it.date), k = d.getFullYear() + '-' + d.getMonth(); (months.get(k) || months.set(k, []).get(k)).push(it); });
      const quick = [['Favorites', IC.heart], ['Videos', IC.video], ['Screenshots', IC.shot], ['Selfies', IC.selfie]];
      body.innerHTML = `<div class="ph-sec"><b>Quick Filters</b></div><div class="ph-tags">${quick.map(([n, i]) => `<button class="ph-tag" data-q="${n}">${i}${n}</button>`).join('')}</div>
        ${tags.length ? `<div class="ph-sec"><b>Categories</b></div><div class="ph-tags">${tags.map((t) => `<button class="ph-tag" data-q="${esc(t)}">${esc(t.replace(/\b\w/g, (c) => c.toUpperCase()))}</button>`).join('')}</div>` : ''}
        ${months.size ? `<div class="ph-sec"><b>Moments</b></div><div class="ph-albums">${[...months.entries()].reverse().slice(0, 12).map(([k, l]) => { const d = new Date(l[0].date), nm = MONTHS[d.getMonth()] + ' ' + d.getFullYear(); return `<div class="ph-alb" data-key="month:${k}" data-name="${nm}">${coverHTML(l)}<b>${nm}</b><span>${l.length}</span></div>`; }).join('')}</div>` : ''}<div style="height:24px"></div>`;
      body.querySelectorAll('[data-poster]').forEach((el) => { const it = S.byId.get(el.dataset.poster); if (it) getPoster(it).then((u) => { if (u && el.isConnected) el.querySelector('img').src = u; }); });
      return;
    }
    const toks = q.split(/\s+/), res = S.items.filter((it) => { const h = haystack(it); return toks.every((t) => h.includes(t)); });
    body.innerHTML = '';
    if (!res.length) { body.appendChild(U.el(`<div class="ph-none"><b>No Results</b><span>No results for “${esc(S.q.trim())}”. Try a month, a year, or a word like “sunset”.</span></div>`)); return; }
    body.appendChild(U.el(`<div class="ph-res-h">${esc(countLabel(res))}<span>matching “${esc(S.q.trim())}”</span></div>`));
    const grid = makeGrid(3); fillGrid(grid, res); body.appendChild(grid);
  }

  /* ───────────────────────── viewer ───────────────────────── */
  function findThumb(id) {
    const pane = S.root.querySelector('.ph-pane.on'); if (!pane) return null;
    const cells = pane.querySelectorAll(`.ph-cell[data-id="${CSS.escape(id)}"]`); let cell = null;
    cells.forEach((c) => { if (c.offsetParent) cell = c; });          // the one on the visible nav page
    if (!cell) return null;
    const page = cell.closest('.nv-page'); if (page && page.classList.contains('nv-under')) return null;
    const sc = cell.closest('.ios-scroll');
    let r = U.rect(cell);
    if (sc && (r.y < 100 || r.y + r.h > H - 90)) { sc.scrollTop += r.y + r.h / 2 - H / 2; r = U.rect(cell); }
    return (r.y + r.h < 0 || r.y > H) ? null : { cell, r };
  }
  function hero(src, from, to, radius, done) {
    const h = U.el(`<div class="ph-hero"><img alt="" draggable="false"></div>`); setRect(h, from); h.style.borderRadius = (radius[0] || 0) + 'px';
    const img = h.firstElementChild; img.src = src; S.root.appendChild(h);
    const go = () => { if (!h.isConnected) return; void h.offsetWidth; setRect(h, to); h.style.borderRadius = (radius[1] || 0) + 'px'; setTimeout(() => { done && done(); requestAnimationFrame(() => h.remove()); }, 370); };
    (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(go);
    return h;
  }
  function openViewer(list, index, cell, instant) {
    if (!S || S.viewer) return;
    const V = S.viewer = { list: list.slice(), i: index, chrome: true, zoom: 1, px: 0, py: 0, slides: {}, mode: null, tapT: 0, lastTap: 0 };
    const el = V.el = U.el(`<div class="ph-viewer"><div class="ph-v-bg"></div><div class="ph-v-track"></div>
      <div class="ph-v-top"><button class="ph-v-back" aria-label="Back">${IC.back}</button><div class="ph-v-title"><b></b><span></span></div><button class="ph-v-more" aria-label="More">${IC.more}</button></div>
      <div class="ph-v-scrub"><button data-a="pp">${IC.play}</button><input type="range" class="ph-range" min="0" max="1000" value="0" step="1"><span>0:00</span></div>
      <div class="ph-v-bar"><button data-a="share" aria-label="Share">${IC.share}</button><button data-a="fav" aria-label="Favorite">${IC.heart}</button><button data-a="info" aria-label="Info">${IC.info}</button><button data-a="trash" aria-label="Delete">${IC.trash}</button></div></div>`);
    V.track = el.querySelector('.ph-v-track'); V.bg = el.querySelector('.ph-v-bg');
    S.root.appendChild(el);
    layoutSlides(); syncViewerChrome();
    const it = V.list[V.i], src = thumbSrc(it);
    if (!instant && cell && src) {
      V.track.style.visibility = 'hidden'; cell.style.visibility = 'hidden';
      const ar = S.aspect.get(it.id) || (it.m.w && it.m.h ? it.m.w / it.m.h : .75);
      hero(src, U.rect(cell), fitRect(ar), [0, 0], () => { if (V.track) V.track.style.visibility = ''; cell.style.visibility = ''; });
      requestAnimationFrame(() => el.classList.add('in'));
    } else { requestAnimationFrame(() => el.classList.add('in')); }
    wireViewer(V); syncStatusBar();
  }
  function buildSlide(V, idx, pos) {
    const it = V.list[idx]; if (!it) return null;
    const el = U.el('<div class="ph-slide"><div class="ph-box"></div></div>'), box = el.firstElementChild, sl = { el, box, it, idx, pos, video: null };
    el.style.transform = `translateX(${pos * (W + GAP)}px)`;
    const fit = (ar) => { if (ar && isFinite(ar)) { S && S.aspect.set(it.id, ar); setRect(box, fitRect(ar)); } };
    setRect(box, fitRect(S.aspect.get(it.id) || (it.m.w && it.m.h ? it.m.w / it.m.h : .75)));
    if (isVid(it)) {
      const v = sl.video = document.createElement('video'); v.playsInline = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); const p = thumbSrc(it); if (p) v.poster = p; v.src = it.src;
      const big = sl.big = U.el(`<button class="ph-playbig" aria-label="Play">${IC.play}</button>`);
      v.addEventListener('loadedmetadata', () => { fit(v.videoWidth / v.videoHeight); if (!isFinite(v.duration)) { const fix = () => { v.removeEventListener('timeupdate', fix); v.currentTime = 0; }; v.addEventListener('timeupdate', fix); try { v.currentTime = 1e7; } catch (e) {} } syncScrub(V); });
      v.addEventListener('durationchange', () => syncScrub(V)); v.addEventListener('timeupdate', () => syncScrub(V));
      v.addEventListener('play', () => { big.classList.add('hide'); syncScrub(V); }); v.addEventListener('pause', () => { big.classList.remove('hide'); syncScrub(V); });
      v.addEventListener('ended', () => { try { v.currentTime = 0; } catch (e) {} });
      v.volume = U.clamp(OS.settings.get('volume'), 0, 1);
      big.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(V); });
      box.appendChild(v); box.appendChild(big);
    } else {
      const img = document.createElement('img'); img.alt = ''; img.draggable = false; img.decoding = 'async';
      img.addEventListener('load', () => fit(img.naturalWidth / img.naturalHeight)); img.src = it.src; box.appendChild(img);
    }
    V.track.appendChild(el); return sl;
  }
  function layoutSlides() {
    const V = S.viewer; if (!V) return;
    Object.values(V.slides).forEach((s) => { if (s) { if (s.video) { try { s.video.pause(); s.video.removeAttribute('src'); s.video.load(); } catch (e) {} } s.el.remove(); } });
    V.zoom = 1; V.px = V.py = 0; V.track.style.transition = 'none'; V.track.style.transform = '';
    V.slides = { prev: buildSlide(V, V.i - 1, -1), cur: buildSlide(V, V.i, 0), next: buildSlide(V, V.i + 1, 1) };
  }
  function shift(dir) {
    const V = S.viewer, s = V.slides; pauseVideo(V);
    const drop = dir > 0 ? s.prev : s.next; if (drop) { if (drop.video) { try { drop.video.removeAttribute('src'); drop.video.load(); } catch (e) {} } drop.el.remove(); }
    V.i += dir;
    if (dir > 0) { s.prev = s.cur; s.cur = s.next; s.next = null; } else { s.next = s.cur; s.cur = s.prev; s.prev = null; }
    [['prev', -1], ['cur', 0], ['next', 1]].forEach(([k, p]) => { if (s[k]) { s[k].pos = p; s[k].el.style.transform = `translateX(${p * (W + GAP)}px)`; } });
    V.track.style.transition = 'none'; V.track.style.transform = '';
    if (dir > 0) s.next = buildSlide(V, V.i + 1, 1); else s.prev = buildSlide(V, V.i - 1, -1);
    syncViewerChrome();
  }
  function applyZoom(V, animate) {
    const b = V.slides.cur && V.slides.cur.box; if (!b) return;
    b.style.transition = animate ? `transform .34s ${EASE}` : 'none';
    b.style.transform = V.zoom === 1 && !V.px && !V.py ? '' : `translate(${V.px}px, ${V.py}px) scale(${V.zoom})`;
  }
  function clampPan(V) {
    const b = V.slides.cur.box, w = parseFloat(b.style.width) * V.zoom, h = parseFloat(b.style.height) * V.zoom, mx = Math.max(0, (w - W) / 2), my = Math.max(0, (h - H) / 2);
    V.px = U.clamp(V.px, -mx, mx); V.py = U.clamp(V.py, -my, my);
  }
  function pauseVideo(V) { const c = V && V.slides.cur; if (c && c.video) { try { c.video.pause(); } catch (e) {} } }
  function togglePlay(V) { const c = V.slides.cur; if (!c || !c.video) return; if (c.video.paused) { const p = c.video.play(); if (p && p.catch) p.catch(() => {}); } else c.video.pause(); }
  function syncScrub(V) {
    if (!S || S.viewer !== V) return; const c = V.slides.cur; if (!c || !c.video) return;
    const v = c.video, dur = isFinite(v.duration) && v.duration ? v.duration : (S.durs.get(c.it.id) || c.it.m.duration || 0), sc = V.el.querySelector('.ph-v-scrub'), range = sc.querySelector('input');
    sc.querySelector('button').innerHTML = v.paused ? IC.play : IC.pause;
    if (!V.scrubbing) { const f = dur ? U.clamp(v.currentTime / dur, 0, 1) : 0; range.value = Math.round(f * 1000); range.style.setProperty('--v', f * 100 + '%'); }
    sc.querySelector('span').textContent = fmtDur(v.paused && !v.currentTime ? dur : v.currentTime);
  }
  function syncViewerChrome() {
    const V = S.viewer; if (!V) return; const it = V.list[V.i]; if (!it) return;
    V.el.querySelector('.ph-v-title b').textContent = fmtDay(it.date); V.el.querySelector('.ph-v-title span').textContent = timeFull(it.date);
    const fav = V.el.querySelector('[data-a="fav"]'); fav.innerHTML = it.favorite ? IC.heartFill : IC.heart;
    V.el.classList.toggle('is-video', isVid(it)); if (isVid(it)) syncScrub(V);
  }
  function viewerSync() {               // library changed underneath an open viewer
    const V = S.viewer; if (!V || V.closing) return;
    const curId = V.list[V.i] && V.list[V.i].id, old = V.list.map((x) => x.id).join();
    V.list = V.list.map((x) => S.byId.get(x.id)).filter(Boolean);
    if (!V.list.length) return closeViewer(true);
    const ni = V.list.findIndex((x) => x.id === curId);
    if (ni < 0) { V.i = Math.min(V.i, V.list.length - 1); layoutSlides(); }
    else { V.i = ni; if (V.list.map((x) => x.id).join() !== old) layoutSlides(); else ['prev', 'cur', 'next'].forEach((k) => { if (V.slides[k]) V.slides[k].it = V.list[V.slides[k].idx = V.i + V.slides[k].pos]; }); }
    syncViewerChrome();
  }
  function toggleChrome(V, on) { V.chrome = on == null ? !V.chrome : on; V.el.classList.toggle('nochrome', !V.chrome); syncStatusBar(); }
  function wireViewer(V) {
    const el = V.el, track = V.track;
    el.querySelector('.ph-v-back').addEventListener('click', () => closeViewer());
    el.querySelector('.ph-v-more').addEventListener('click', (e) => { const it = V.list[V.i]; OS.ui.contextMenu(e.currentTarget, [
      { label: 'Copy', icon: IC.copy, onTap: () => copyPhoto(it) }, { label: 'Duplicate', icon: IC.dup, onTap: () => duplicate(it) },
      { label: 'Add to Album', icon: IC.album, onTap: () => addToAlbum([it.id]) }, { label: 'Save to Files', icon: IC.folder, onTap: () => saveToFiles(it) }]); });
    el.querySelector('.ph-v-bar').addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return; const it = V.list[V.i]; if (!it) return;
      if (b.dataset.a === 'share') shareSheet(it);
      else if (b.dataset.a === 'info') infoSheet(it);
      else if (b.dataset.a === 'fav') { OS.haptic('light'); it.favorite = !it.favorite; b.innerHTML = it.favorite ? IC.heartFill : IC.heart; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); OS.photos.update(it.id, { favorite: it.favorite }); }
      else if (b.dataset.a === 'trash') {
        pauseVideo(V);
        const cur = V.slides.cur; const okay = await confirmDeleteViewer(it, cur);
        if (!okay && cur) { cur.box.style.transition = `transform .3s ${EASE}, opacity .3s`; cur.box.style.opacity = ''; }
      }
    });
    const sc = el.querySelector('.ph-v-scrub'), range = sc.querySelector('input');
    sc.querySelector('button').addEventListener('click', () => togglePlay(V));
    range.addEventListener('input', () => { const c = V.slides.cur; if (!c || !c.video) return; V.scrubbing = true; const dur = isFinite(c.video.duration) ? c.video.duration : 0, f = range.value / 1000; range.style.setProperty('--v', f * 100 + '%'); if (dur) { try { c.video.currentTime = f * dur; } catch (e) {} sc.querySelector('span').textContent = fmtDur(f * dur); } });
    range.addEventListener('change', () => { V.scrubbing = false; });
    track.addEventListener('click', (e) => {
      if (V.closing) return; const now = performance.now(), pt = U.screenPoint(e);
      if (now - V.lastTap < 300) {        // double-tap → zoom in on that point / back out
        clearTimeout(V.tapT); V.lastTap = 0; const c = V.slides.cur; if (!c || c.video) return;
        if (V.zoom > 1) { V.zoom = 1; V.px = V.py = 0; } else { V.zoom = 2.6; V.px = (W / 2 - pt.x) * (V.zoom - 1); V.py = (H / 2 - pt.y) * (V.zoom - 1); clampPan(V); if (V.chrome) toggleChrome(V, false); }
        applyZoom(V, true); return;
      }
      V.lastTap = now; clearTimeout(V.tapT); V.tapT = setTimeout(() => { if (S && S.viewer === V && !V.closing) toggleChrome(V); }, 240);
    });
    track.addEventListener('wheel', (e) => {
      const c = V.slides.cur; if (!c || c.video || !(e.ctrlKey || e.metaKey)) return; e.preventDefault();
      V.zoom = U.clamp(V.zoom * (e.deltaY < 0 ? 1.12 : .89), 1, 5); if (V.zoom === 1) V.px = V.py = 0; clampPan(V); applyZoom(V, false);
    }, { passive: false });
    V.undrag = U.drag(track, {
      threshold: 8,
      onStart(p) {
        if (V.closing || V.busy) return false; clearTimeout(V.tapT);
        if (V.zoom > 1) { V.mode = 'pan'; V.p0 = { x: V.px, y: V.py }; return; }
        V.mode = Math.abs(p.dx) > Math.abs(p.dy) ? 'swipe' : (p.dy > 0 ? 'dismiss' : 'up');
        track.style.transition = 'none'; if (V.mode === 'dismiss') { V.el.classList.add('dragging'); V.bg.style.transition = 'none'; V.slides.cur.box.style.transition = 'none'; }
      },
      onMove(p) {
        if (V.mode === 'pan') { V.px = V.p0.x + p.dx; V.py = V.p0.y + p.dy; clampPan(V); applyZoom(V, false); }
        else if (V.mode === 'swipe') { let dx = p.dx; if ((dx > 0 && !V.slides.prev) || (dx < 0 && !V.slides.next)) dx *= .32; track.style.transform = `translateX(${dx}px)`; }
        else if (V.mode === 'dismiss') { const dy = Math.max(0, p.dy), s = U.clamp(1 - dy / H * .75, .45, 1); V.slides.cur.box.style.transform = `translate(${p.dx}px, ${dy}px) scale(${s})`; V.bg.style.opacity = U.clamp(1 - dy / 320, 0, 1); }
      },
      onEnd(p) {
        const mode = V.mode; V.mode = null;
        if (mode === 'swipe') {
          const dir = (p.dx < -110 || p.vx < -.45) && V.slides.next ? 1 : (p.dx > 110 || p.vx > .45) && V.slides.prev ? -1 : 0;
          track.style.transition = `transform .34s ${EASE}`; track.style.transform = `translateX(${-dir * (W + GAP)}px)`;
          if (dir) { V.busy = true; setTimeout(() => { V.busy = false; if (S && S.viewer === V && !V.closing) shift(dir); }, 340); }
        } else if (mode === 'dismiss') {
          if (p.dy > 110 || p.vy > .5) return closeViewer();
          V.el.classList.remove('dragging'); V.bg.style.transition = ''; V.bg.style.opacity = ''; V.slides.cur.box.style.transition = `transform .34s ${EASE}`; V.slides.cur.box.style.transform = '';
        } else if (mode === 'up') { if (p.dy < -50) infoSheet(V.list[V.i]); }
      },
    });
  }
  async function confirmDeleteViewer(it, cur) {
    const V = S.viewer; if (!V) return false;
    const word = isVid(it) ? 'Video' : 'Photo';
    const r = await OS.ui.actionSheet({ message: `This ${word.toLowerCase()} will be deleted from your library on this iPhone.`, buttons: [{ label: 'Delete ' + word, style: 'destructive' }], cancel: 'Cancel' });
    if (r !== 0 || !S || S.viewer !== V) return false;
    OS.sound.play('trash');
    if (cur) { cur.box.style.transition = `transform .3s ${EASE}, opacity .28s`; cur.box.style.transform = 'scale(.6) translateY(120px)'; cur.box.style.opacity = '0'; }
    await new Promise((res) => setTimeout(res, 260)); if (!S || S.viewer !== V) return true;
    const i = V.list.findIndex((x) => x.id === it.id); if (i >= 0) V.list.splice(i, 1);
    const albums = userAlbums(); albums.forEach((a) => { a.items = a.items.filter((x) => x !== it.id); }); OS.store.set('photos.albums', albums);
    if (!V.list.length) closeViewer(true); else { V.i = Math.min(V.i, V.list.length - 1); layoutSlides(); syncViewerChrome(); }
    try { await OS.photos.remove(it.id); } catch (e) {}
    return true;
  }
  function closeViewer(instant) {
    const V = S && S.viewer; if (!V || V.closing) return; V.closing = true; clearTimeout(V.tapT); pauseVideo(V);
    const finish2 = () => { if (V.undrag) V.undrag(); Object.values(V.slides).forEach((s) => { if (s && s.video) { try { s.video.pause(); s.video.removeAttribute('src'); s.video.load(); } catch (e) {} } }); V.el.remove(); if (S && S.viewer === V) S.viewer = null; if (S) syncStatusBar(); };
    const it = V.list[V.i], cur = V.slides.cur, src = it && thumbSrc(it);
    V.el.classList.remove('in'); V.el.classList.add('dragging'); V.bg.style.transition = ''; V.bg.style.opacity = '';
    const t = !instant && it && src ? findThumb(it.id) : null;
    if (t && cur) {
      const from = U.rect(cur.box); V.track.style.visibility = 'hidden'; t.cell.style.visibility = 'hidden';
      hero(src, from, t.r, [0, 0], () => { t.cell.style.visibility = ''; });
      setTimeout(finish2, 380);
    } else {
      if (cur) { cur.box.style.transition = `transform .3s ${EASE}, opacity .25s`; cur.box.style.transform = (cur.box.style.transform || '') + ' scale(.82)'; cur.box.style.opacity = '0'; }
      setTimeout(finish2, instant ? 0 : 300);
    }
    syncStatusBar();
  }

  /* ───────────────────────── sheets ───────────────────────── */
  function shareSheet(it) {
    let sheet = null; const vid = isVid(it), word = vid ? 'Video' : 'Photo';
    const rows = [
      ['Copy ' + word, IC.copy, () => copyPhoto(it)],
      ['Save to Files', IC.folder, () => saveToFiles(it)],
      vid ? null : ['Use as Wallpaper', IC.phone, () => { OS.settings.set('wallpaper', 'photo:' + it.id); OS.haptic('success'); OS.ui.toast('Wallpaper Set'); }],
      ['Duplicate', IC.dup, () => duplicate(it)],
      ['Add to Album', IC.album, () => addToAlbum([it.id])],
      [it.favorite ? 'Remove from Favorites' : 'Add to Favorites', it.favorite ? IC.heartFill : IC.heart, () => OS.photos.update(it.id, { favorite: !it.favorite })],
    ].filter(Boolean);
    sheet = OS.ui.sheet({ title: '', height: 'medium', right: { label: 'Done', bold: true, onTap() { sheet && sheet.close(); } },
      render(body, sh) {
        sheet = sheet || sh; body.classList.add('ios-scroll'); const th = thumbSrc(it);
        body.innerHTML = `<div class="ph-sh"><div class="ph-sh-head">${th ? `<img alt="" src="${th}">` : '<div class="ph-sh-th"></div>'}<div><b>1 ${word} Selected</b><span>${esc(fmtDay(it.date))} · ${esc(timeFull(it.date))}</span></div></div>
          <div class="ios-list">${rows.slice(0, 1).map((r, i) => `<div class="ios-row" data-i="${i}"><span class="ios-row-label">${r[0]}</span>${r[1]}</div>`).join('')}</div>
          <div class="ios-list">${rows.slice(1).map((r, i) => `<div class="ios-row" data-i="${i + 1}"><span class="ios-row-label">${r[0]}</span>${r[1]}</div>`).join('')}</div></div>`;
        body.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (!r) return; const fn = rows[+r.dataset.i][2]; (sheet || sh).close(); setTimeout(fn, 180); });
      } });
  }
  function infoSheet(it) {
    if (!it) return; let sheet = null; const d = new Date(it.date), vid = isVid(it);
    const cur = S.viewer && S.viewer.slides.cur, media = cur && cur.it.id === it.id ? cur.box.querySelector('img,video') : null;
    const w = (media && (media.naturalWidth || media.videoWidth)) || it.m.w || 0, h = (media && (media.naturalHeight || media.videoHeight)) || it.m.h || 0;
    const mp = w && h ? (w * h / 1e6 < 10 ? (w * h / 1e6).toFixed(1) : Math.round(w * h / 1e6)) + ' MP' : '';
    const kind = vid ? 'Video' : it.kind === 'screenshot' ? 'Screenshot' : it.m.pano ? 'Panorama' : it.m.portrait ? 'Portrait' : it.m.selfie ? 'Selfie' : 'Photo';
    const fmt = vid ? (String(it.src).slice(5, 25).split(/[;,]/)[0].split('/')[1] || 'mov').toUpperCase() : it.kind === 'screenshot' ? 'PNG' : 'JPEG';
    const lens = it.kind === 'screenshot' ? 'Screen capture' : it.m.seeded ? 'Main Camera — 26 mm ƒ1.78' : it.m.selfie ? 'Front Camera — 23 mm ƒ1.9' : 'Main Camera — 26 mm ƒ1.78';
    const dur = vid ? (S.durs.get(it.id) || it.m.duration || (media && isFinite(media.duration) ? media.duration : 0)) : 0;
    sheet = OS.ui.sheet({ title: 'Info', height: 'medium', right: { label: 'Done', bold: true, onTap() { sheet && sheet.close(); } },
      render(body, sh) {
        sheet = sheet || sh; body.classList.add('ios-scroll');
        body.innerHTML = `<div class="ph-sh">${it.m.title ? `<div class="ph-inf-cap">${esc(it.m.title)}</div>` : ''}
          <div class="ph-inf-date">${DAYS[d.getDay()]} · ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${esc(timeFull(d))}</div><div class="ph-inf-file">${esc(fileName(it))}</div>
          <div class="ph-inf-card"><div class="ph-inf-card-h"><span>iPhone 17</span><i>${fmt}</i></div><div class="ph-inf-card-b">${esc(lens)}</div>
          <div class="ph-inf-card-b" style="padding-top:0">${[mp, w && h ? w + ' × ' + h : '', fmtBytes(byteSize(it))].filter(Boolean).join(' · ')}</div>
          <div class="ph-inf-card-f"><span>${esc(kind)}</span>${vid ? `<span>${fmtDur(dur)}</span>` : ''}<span>${it.favorite ? 'Favorite' : 'Not Favorite'}</span>${(it.m.tags || []).length ? `<span>${esc(it.m.tags[0])}</span>` : ''}</div></div></div>`;
      } });
  }

  /* ───────────────────────── app shell ───────────────────────── */
  OS.store.on('photos.meta', () => scheduleRefresh());   // Camera writes selfie/portrait/pano flags here
  function syncStatusBar() {
    if (!S) return; const V = S.viewer;
    S.ctx.setStatusBar(V && !V.closing ? (V.chrome ? 'auto' : 'light') : (S.tab === 'library' && S.items.length ? 'light' : 'auto'));
  }
  function selectTab(tab) {
    if (S.sel.active) setSelecting(false);
    if (S.tab === tab) { if (tab === 'library') { S.libScroll.scrollTo ? S.libScroll.scrollTo({ top: S.libScroll.scrollHeight, behavior: 'smooth' }) : (S.libScroll.scrollTop = S.libScroll.scrollHeight); } else if (S.navs[tab]) S.navs[tab].popToRoot(); return; }
    S.tab = tab; OS.store.set('photos.tab', tab);
    S.root.querySelectorAll('.ph-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
    S.root.querySelectorAll('.ios-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    if (tab === 'library' && !S.libReady) renderLibrary(true);
    syncStatusBar();
  }

  OS.registerApp({
    id: 'photos', name: 'Photos', system: true, statusBar: 'auto', background: 'var(--bg)',
    icon: { bg: '#fff', glyph: `<svg viewBox="0 0 60 60">${['#F8A01C', '#F5D21E', '#A6CE39', '#47BE8F', '#489FDB', '#8C6EC6', '#D96BAA', '#EF5A4C'].map((c, i) =>
      `<rect x="23.200" y="7.500" width="13.600" height="23.500" rx="6.800" fill="${c}" fill-opacity=".86" transform="rotate(${i * 45} 30 30)" style="mix-blend-mode:multiply"/>`).join('')}</svg>` },
    launch(ctx) {
      S = { ctx, root: ctx.root, items: [], byId: new Map(), tab: 'library', libMode: 'all', libFilter: 'recents', cols: OS.store.get('photos.cols', 3) || 3, libReady: false, seeding: false,
        sel: { active: false, ids: new Set(), owner: null }, viewer: null, navs: {}, openGrids: [], albumsPage: null, searchPage: null, q: '',
        aspect: new Map(), posters: new Map(), posterJobs: new Map(), durs: new Map(), refreshT: 0, subs: [] };
      if (![1, 3, 5].includes(S.cols)) S.cols = 3;
      ctx.root.innerHTML = `<div class="ph-pane on" data-pane="library"></div><div class="ph-pane" data-pane="albums"></div><div class="ph-pane" data-pane="search"></div>
        <div class="ios-tabbar"><button class="ios-tab on" data-tab="library">${IC.tabLib}<span>Library</span></button><button class="ios-tab" data-tab="albums">${IC.tabAlb}<span>Albums</span></button><button class="ios-tab" data-tab="search">${IC.tabSearch}<span>Search</span></button></div>
        <div class="ph-selbar"><button data-s="share" class="off" aria-label="Actions">${IC.share}</button><b>Select Items</b><button data-s="trash" class="off" aria-label="Delete">${IC.trash}</button></div>`;
      const pane = (n) => ctx.root.querySelector(`[data-pane="${n}"]`);
      S.selBar = ctx.root.querySelector('.ph-selbar');
      S.selBar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) selAction(b.dataset.s, b); });
      ctx.root.querySelector('.ios-tabbar').addEventListener('click', (e) => { const t = e.target.closest('.ios-tab'); if (t) selectTab(t.dataset.tab); });
      buildLibrary(pane('library'));
      S.navs.albums = OS.ui.createNav(pane('albums'), { tabBarInset: true });
      S.navs.albums.push({ title: 'Albums', largeTitle: true, right: [{ icon: IC.plus, onTap: newAlbum }], render(body, page) { S.albumsPage = page; renderAlbums(body); } });
      S.navs.search = OS.ui.createNav(pane('search'), { tabBarInset: true });
      S.navs.search.push({ title: 'Search', largeTitle: true, search: { placeholder: 'Photos, Places, Dates…', onInput(t) { if (S) { S.q = t; renderSearch(); } } },
        render(body, page) {
          S.searchPage = page; renderSearch();
          body.addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) return setQuery(q.dataset.q); const k = e.target.closest('[data-key]'); if (k) pushAlbum(S.navs.search, k.dataset.key, k.dataset.name, 'Search'); });
        } });
      const onChange = OS.on('photos:change', scheduleRefresh), onVol = OS.on('setting:volume', (v) => { const c = S && S.viewer && S.viewer.slides.cur; if (c && c.video) c.video.volume = U.clamp(v, 0, 1); });
      S.subs.push(['photos:change', onChange], ['setting:volume', onVol]);
      (async () => {
        await load(); if (!S) return;
        renderLibrary(true); renderAlbums(S.albumsPage.body); renderSearch(); syncStatusBar();
        if (!OS.store.get('photos.seeded')) { S.lib.classList.remove('is-empty'); await seedLibrary(); if (S) { S.libReady = false; scheduleRefresh(); } }
      })();
    },
    onResume(ctx, params) {
      if (!S) return;
      refresh().then(() => {
        if (!S || !params) return;
        const want = params.id ? S.items.findIndex((x) => x.id === params.id) : params.open === 'latest' ? S.items.length - 1 : -1;
        if (want >= 0) { if (S.viewer) closeViewer(true); setTimeout(() => { if (!S) return; selectTab('library'); S.libScroll.scrollTop = S.libScroll.scrollHeight; openViewer(S.items, want, null, true); }, S.viewer ? 30 : 0); }
      });
      syncStatusBar();
    },
    onPause() { if (S && S.viewer) pauseVideo(S.viewer); },
    onClose() {
      if (!S) return;
      clearTimeout(S.refreshT); if (S.viewer) { clearTimeout(S.viewer.tapT); pauseVideo(S.viewer); if (S.viewer.undrag) S.viewer.undrag(); }
      S.subs.forEach(([evt, fn]) => OS.off(evt, fn));
      S = null;
    },
  });
})();
