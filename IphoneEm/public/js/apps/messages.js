// Messages — iMessage-style conversations with AI-played contacts, tapbacks, typing indicator, notifications.
(function () {
  'use strict';
  const U = OS.util, el = U.el, esc = U.esc;
  const KEY = 'messages.threads';
  const HOUR = 3600e3;
  const EASE = 'cubic-bezier(.32,.72,0,1)';

  /* ------------------------------------------------------------------ icons */
  const sv = (body, vb) => `<svg viewBox="${vb || '0 0 24 24'}" aria-hidden="true">${body}</svg>`;
  const st = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    compose: sv(`<path d="M19.2 13.2v5.3a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 18.5V7.3a2.5 2.5 0 0 1 2.5-2.5h5.3" ${st} stroke-width="1.8"/><path d="M9.6 14.4l.7-3.2 8.5-8.5a1.6 1.6 0 0 1 2.2 0l.3.3a1.6 1.6 0 0 1 0 2.2l-8.5 8.5z" ${st} stroke-width="1.7"/>`),
    back: sv(`<path d="M10 2L2 10.5 10 19" ${st} stroke-width="2.8"/>`, '0 0 12 21'),
    video: sv(`<rect x="1.5" y="6" width="14.5" height="12" rx="3.4" fill="currentColor"/><path d="M17.4 10.3l3.7-2.6c.6-.4 1.4 0 1.4.8v7c0 .8-.8 1.2-1.4.8l-3.7-2.6z" fill="currentColor"/>`),
    plus: sv(`<path d="M12 5.5v13M5.5 12h13" ${st} stroke-width="2.2"/>`),
    up: sv(`<path d="M12 19V6.2M6.4 11.6L12 6l5.6 5.6" ${st} stroke-width="2.7"/>`),
    chev: sv(`<path d="M1.5 1.5l4 4-4 4" ${st} stroke-width="1.8"/>`, '0 0 7 11'),
    trash: sv(`<path d="M4 6.8h16M9.3 6.8V4.9c0-.5.4-.9.9-.9h3.6c.5 0 .9.4.9.9v1.9M6 6.8l.8 12.3c.1 1.1.9 1.9 2 1.9h6.4c1.1 0 1.9-.8 2-1.9L18 6.8M10 10.8v6.4M14 10.8v6.4" ${st} stroke-width="1.7"/>`),
    bellOff: sv(`<path d="M6.5 9.8a5.5 5.5 0 0 1 9-4.2M17.5 10v3.2l1.6 2.9c.2.4-.1.9-.5.9H9.5M6.5 12.5v.7l-1.6 2.9c-.2.4.1.9.5.9h.6M10 19.5a2 2 0 0 0 4 0M4 3.5l16 17" ${st} stroke-width="1.8"/>`),
    bell: sv(`<path d="M6.5 13.2V9.8a5.5 5.5 0 0 1 11 0v3.4l1.6 2.9c.2.4-.1.9-.5.9H5.4c-.5 0-.8-.5-.5-.9zM10 19.5a2 2 0 0 0 4 0" ${st} stroke-width="1.8"/>`),
    moon: sv(`<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/>`),
    phone: sv(`<path d="M8.7 3.6l1.7 3.7c.2.5.1 1.1-.3 1.5L8.6 10.3a12 12 0 0 0 5.1 5.1l1.5-1.5c.4-.4 1-.5 1.5-.3l3.7 1.7c.6.3.9.9.8 1.5l-.5 2.5c-.1.7-.8 1.2-1.5 1.2C10.6 20.5 3.5 13.4 3.5 4.8c0-.7.5-1.4 1.2-1.5l2.5-.5c.6-.1 1.2.2 1.5.8z" fill="currentColor"/>`),
    mail: sv(`<rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor"/><path d="M4 8l8 6 8-6" style="fill:none;stroke:var(--mg-ic-cut,#fff);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"/>`),
    bubble: sv(`<path d="M12 3.5c-5.2 0-9.5 3.6-9.5 8 0 2.5 1.4 4.8 3.6 6.2-.2 1.1-.800 2.1-1.6 2.9 1.9 0 3.6-.7 4.9-1.8.8.2 1.7.3 2.6.3 5.2 0 9.5-3.4 9.5-7.8s-4.3-7.8-9.5-7.8z" fill="currentColor"/>`),
    camera: sv(`<path d="M8.3 5.5l.9-1.4c.3-.4.7-.6 1.2-.6h3.2c.5 0 .9.2 1.2.6l.9 1.4h2.8A2.5 2.5 0 0 1 21 8v9.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5V8a2.5 2.5 0 0 1 2.5-2.5z" ${st} stroke-width="1.7"/><circle cx="12" cy="12.5" r="3.7" ${st} stroke-width="1.7"/>`),
    photos: sv(`<rect x="3" y="4.5" width="18" height="15" rx="3" ${st} stroke-width="1.7"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/><path d="M4 17l4.8-4.6c.4-.4 1-.4 1.4 0l2.6 2.5 2.5-2.4c.4-.4 1-.4 1.4 0L20.5 16" ${st} stroke-width="1.7"/>`),
    smile: sv(`<circle cx="12" cy="12" r="9" ${st} stroke-width="1.7"/><path d="M8.3 14.2c.9 1.4 2.2 2.1 3.7 2.1s2.8-.7 3.7-2.1" ${st} stroke-width="1.7"/><circle cx="9" cy="9.8" r="1.1" fill="currentColor"/><circle cx="15" cy="9.8" r="1.1" fill="currentColor"/>`),
    copy: sv(`<rect x="8" y="8" width="12" height="13" rx="2.5" ${st} stroke-width="1.7"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-7A2.5 2.5 0 0 0 4 5.5v8A2.5 2.5 0 0 0 6.5 16H8" ${st} stroke-width="1.7"/>`),
    check: sv(`<path d="M2 7.5l4 4 8-9" ${st} stroke-width="2.2"/>`, '0 0 16 14'),
    person: sv(`<circle cx="12" cy="8.6" r="4.3" fill="currentColor"/><path d="M3.8 21c.5-4.3 3.9-7 8.2-7s7.7 2.7 8.2 7z" fill="currentColor"/>`),
  };
  const TAPS = [
    { id: 'heart', sound: 'tapback_heart', svg: sv('<path d="M12 21.350l-1.450-1.320C5.4 15.360 2 12.280 2 8.5 2 5.420 4.420 3 7.5 3c1.740 0 3.410.810 4.5 2.090C13.090 3.810 14.760 3 16.5 3 19.580 3 22 5.420 22 8.5c0 3.780-3.4 6.860-8.550 11.540L12 21.350z" fill="currentColor"/>') },
    { id: 'up', sound: 'tapback_up', svg: sv('<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.310l.950-4.570.030-.320c0-.410-.170-.790-.440-1.060L14.170 1 7.590 7.590C7.220 7.950 7 8.450 7 9v10c0 1.1.9 2 2 2h9c.830 0 1.540-.5 1.840-1.220l3.020-7.050c.090-.230.140-.470.140-.730v-2z" fill="currentColor"/>') },
    { id: 'down', sound: 'tapback_down', svg: sv('<g transform="translate(0,24) scale(1,-1)"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.310l.950-4.570.030-.320c0-.410-.170-.790-.440-1.060L14.170 1 7.590 7.590C7.220 7.950 7 8.450 7 9v10c0 1.1.9 2 2 2h9c.830 0 1.540-.5 1.840-1.220l3.020-7.050c.090-.230.140-.470.140-.730v-2z" fill="currentColor"/></g>') },
    { id: 'haha', sound: 'tapback_haha', svg: '<span class="mg-tx ha">HA<br>HA</span>' },
    { id: 'exclaim', sound: 'tapback_exclaim', svg: '<span class="mg-tx">!!</span>' },
    { id: 'question', sound: 'tapback_question', svg: '<span class="mg-tx">?</span>' },
  ];
  const tapById = (id) => TAPS.find((t) => t.id === id);

  /* ------------------------------------------------------------------ styles */
  const S2 = ':is(.app-messages, .mg-sheet)';
  OS.addStyle('messages', `
    ${S2} { --mg-blue: #007AFF; --mg-grey: #E9E9EB; }
    #screen[data-theme="dark"] ${S2} { --mg-blue: #0A84FF; --mg-grey: #26252A; }
    .app-messages .mg-navhost { position: absolute; inset: 0; transition: transform .42s ${EASE}, filter .42s; }
    .app-messages .mg-navhost.under { transform: translateX(-30%); filter: brightness(.92); }
    .app-messages .mg-navhost.nodrag, .app-messages .mg-convo.nodrag { transition: none; }

    /* conversation list */
    .app-messages .mg-rw { position: relative; overflow: hidden; background: var(--bg); transition: height .32s ${EASE}, opacity .25s; }
    .app-messages .mg-acts { position: absolute; top: 0; right: 0; bottom: 0; width: 0; display: flex; overflow: hidden; }
    .app-messages .mg-acts button { flex: 1; min-width: 0; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 13px; letter-spacing: -.08px; white-space: nowrap; }
    .app-messages .mg-acts svg { width: 24px; height: 24px; flex: none; }
    .app-messages .mg-act-mute { background: var(--indigo); } .app-messages .mg-act-del { background: var(--red); }
    .app-messages .mg-r { position: relative; display: flex; align-items: center; height: 76px; padding-left: 28px; background: var(--bg); cursor: pointer; transition: padding .3s ${EASE}; }
    .app-messages .mg-r.pressed { background: var(--gray5, var(--cell2)); }
    .app-messages .mg-dot { position: absolute; left: 9px; top: 50%; width: 11px; height: 11px; margin-top: -5.5px; border-radius: 50%; background: var(--mg-blue); transform: scale(0); transition: transform .25s ${EASE}; }
    .app-messages .mg-r.unread .mg-dot { transform: scale(1); }
    .app-messages .mg-sel { position: absolute; left: 12px; top: 50%; width: 22px; height: 22px; margin-top: -11px; border-radius: 50%; border: 1.5px solid var(--label3); opacity: 0; transform: scale(.6); transition: opacity .25s, transform .3s ${EASE}; display: flex; align-items: center; justify-content: center; color: #fff; }
    .app-messages .mg-sel svg { width: 12px; height: 11px; opacity: 0; }
    .app-messages .mg-list.editing .mg-r { padding-left: 46px; }
    .app-messages .mg-list.editing .mg-sel { opacity: 1; transform: none; }
    .app-messages .mg-list.editing .mg-dot { left: 38px; width: 8px; height: 8px; margin-top: -4px; display: none; }
    .app-messages .mg-r.picked .mg-sel { background: var(--mg-blue); border-color: var(--mg-blue); } .app-messages .mg-r.picked .mg-sel svg { opacity: 1; }
    .app-messages .mg-r-main { flex: 1; min-width: 0; height: 100%; margin-left: 11px; padding: 8px 16px 0 0; box-shadow: 0 .5px 0 var(--sep); }
    .app-messages .mg-r-top { display: flex; align-items: center; gap: 6px; }
    .app-messages .mg-r-top b { flex: 1; min-width: 0; font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-messages .mg-r-top .t { flex: none; font-size: 15px; color: var(--label2); letter-spacing: -.2px; }
    .app-messages .mg-r-top .ios-chevron { margin-left: 2px; }
    .app-messages .mg-r-top .mute { flex: none; width: 13px; height: 13px; color: var(--label3); } .app-messages .mg-r-top .mute svg { width: 13px; height: 13px; display: block; }
    .app-messages .mg-r-prev { font-size: 15px; line-height: 20px; color: var(--label2); letter-spacing: -.2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-right: 14px; word-break: break-word; }
    .app-messages .mg-r-prev mark { background: none; color: var(--label); font-weight: 600; }
    .app-messages .mg-empty { padding: 120px 40px 0; text-align: center; color: var(--label2); font-size: 20px; font-weight: 600; }
    .app-messages .mg-empty small { display: block; margin-top: 6px; font-size: 15px; font-weight: 400; }
    .app-messages .mg-selbar { position: absolute; left: 0; right: 0; bottom: 0; height: calc(49px + var(--safe-bottom)); padding: 0 18px var(--safe-bottom); display: flex; align-items: center; justify-content: space-between; z-index: 25;
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 -.5px 0 var(--sep); transform: translateY(100%); transition: transform .35s ${EASE}; }
    .app-messages .mg-selbar.in { transform: none; }
    .app-messages .mg-selbar button { color: var(--tint); font-size: 17px; } .app-messages .mg-selbar button.del { color: var(--red); }
    .app-messages .mg-selbar button:disabled { opacity: .35; pointer-events: none; }

    /* conversation page */
    .app-messages .mg-convo { position: absolute; inset: 0; z-index: 5; background: var(--bg); transform: translateX(100%); transition: transform .42s ${EASE}; box-shadow: -14px 0 14px -14px rgba(0,0,0,.12); }
    .app-messages .mg-convo.in { transform: none; }
    .app-messages .mg-scroll { position: absolute; inset: 0; padding: calc(var(--safe-top) + 66px) 16px calc(var(--mg-bar-h, 84px) + var(--kb-h, 0px) + 8px); }
    .app-messages .mg-head { position: absolute; left: 0; right: 0; top: 0; z-index: 6; height: calc(var(--safe-top) + 58px); background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); box-shadow: 0 .5px 0 var(--sep); }
    .app-messages .mg-back { position: absolute; left: 0; top: var(--safe-top); height: 44px; padding: 0 14px 0 9px; display: flex; align-items: center; gap: 6px; color: var(--tint); }
    .app-messages .mg-back svg { width: 12px; height: 21px; }
    .app-messages .mg-back-n { min-width: 22px; height: 22px; padding: 0 7px; border-radius: 11px; background: var(--tint); color: #fff; font-size: 14px; font-weight: 500; line-height: 22px; text-align: center; letter-spacing: 0; }
    .app-messages .mg-back-n:empty { display: none; }
    .app-messages .mg-who { position: absolute; left: 90px; right: 90px; top: calc(var(--safe-top) - 1px); display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .app-messages .mg-who-name { display: flex; align-items: center; gap: 3px; max-width: 100%; font-size: 11px; letter-spacing: .06px; color: var(--label); }
    .app-messages .mg-who-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-messages .mg-who-name svg { width: 5px; height: 8px; color: var(--label3); flex: none; }
    .app-messages .mg-ft { position: absolute; right: 6px; top: var(--safe-top); width: 48px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--tint); }
    .app-messages .mg-ft svg { width: 27px; height: 27px; }
    .app-messages .mg-back:active, .app-messages .mg-ft:active, .app-messages .mg-who:active { opacity: .45; }
    .app-messages .mg-edge { position: absolute; left: 0; top: calc(var(--safe-top) + 58px); bottom: 120px; width: 22px; z-index: 7; }

    /* bubbles */
    ${S2} .mg-stamp { text-align: center; font-size: 11px; letter-spacing: .06px; color: var(--label2); margin: 16px 0 5px; } ${S2} .mg-stamp:first-child { margin-top: 4px; }
    ${S2} .mg-stamp b { font-weight: 600; }
    ${S2} .mg-m { display: flex; margin-top: 2px; } ${S2} .mg-m.first { margin-top: 9px; } ${S2} .mg-m.hastap { margin-top: 22px; }
    ${S2} .mg-m.me { justify-content: flex-end; }
    ${S2} .mg-b { position: relative; isolation: isolate; max-width: 76%; padding: 7px 13px; border-radius: 18px; font-size: 17px; line-height: 22px; letter-spacing: -.4px; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; cursor: default; user-select: none; -webkit-user-select: none; }
    ${S2} .mg-m.me .mg-b { color: #fff; background: linear-gradient(180deg, color-mix(in srgb, var(--mg-blue) 84%, #fff), var(--mg-blue) 70%); }
    ${S2} .mg-m.them .mg-b { color: var(--label); background: var(--mg-grey); }
    ${S2} .mg-m.tail .mg-b::before, ${S2} .mg-m.tail .mg-b::after { content: ''; position: absolute; z-index: -1; bottom: 0; height: 18px; }
    ${S2} .mg-m.me.tail .mg-b::before { right: -7px; width: 20px; background: var(--mg-blue); border-bottom-left-radius: 16px 14px; }
    ${S2} .mg-m.me.tail .mg-b::after { right: -26px; width: 26px; background: var(--bg); border-bottom-left-radius: 10px; }
    ${S2} .mg-m.them.tail .mg-b::before { left: -7px; width: 20px; background: var(--mg-grey); border-bottom-right-radius: 16px 14px; }
    ${S2} .mg-m.them.tail .mg-b::after { left: -26px; width: 26px; background: var(--bg); border-bottom-right-radius: 10px; }
    ${S2} .mg-m.big .mg-b { background: none !important; padding: 2px 2px 0; font-size: 50px; line-height: 60px; letter-spacing: 2px; }
    ${S2} .mg-m.big .mg-b::before, ${S2} .mg-m.big .mg-b::after, ${S2} .mg-m.img .mg-b::before, ${S2} .mg-m.img .mg-b::after { display: none; }
    ${S2} .mg-m.img .mg-b { padding: 0; background: var(--mg-grey) !important; min-width: 120px; min-height: 90px; color: var(--label2) !important; display: flex; align-items: center; justify-content: center; font-size: 13px; }
    ${S2} .mg-m.img img { display: block; max-width: 230px; max-height: 300px; width: auto; height: auto; border-radius: 18px; }
    ${S2} .mg-link { text-decoration: underline; cursor: pointer; }
    ${S2} .mg-m.pop .mg-b { animation: mg-pop .38s ${EASE} both; } ${S2} .mg-m.me.pop .mg-b { transform-origin: 100% 100%; } ${S2} .mg-m.them.pop .mg-b { transform-origin: 0 100%; }
    @keyframes mg-pop { from { opacity: 0; transform: translateY(22px) scale(.82); } to { opacity: 1; transform: none; } }
    ${S2} .mg-m.held .mg-b { visibility: hidden; }
    ${S2} .mg-tap { position: absolute; top: -17px; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--bg); z-index: 1; font-size: 0; letter-spacing: 0; }
    ${S2} .mg-m.me .mg-tap { left: -13px; } ${S2} .mg-m.them .mg-tap { right: -13px; }
    ${S2} .mg-tap::after { content: ''; position: absolute; bottom: -1px; width: 8px; height: 8px; border-radius: 50%; background: inherit; box-shadow: 0 0 0 1.5px var(--bg); z-index: -1; }
    ${S2} .mg-m.me .mg-tap::after { left: 1px; } ${S2} .mg-m.them .mg-tap::after { right: 1px; }
    ${S2} .mg-tap.byme { background: var(--mg-blue); color: #fff; } ${S2} .mg-tap.bythem { background: var(--mg-grey); color: var(--gray); }
    ${S2} .mg-tap.heart { color: #FF5C93; } ${S2} .mg-tap.bythem.heart { color: var(--pink); }
    ${S2} .mg-tap svg { width: 15px; height: 15px; } ${S2} .mg-tap.popin { animation: mg-tapin .45s ${EASE} both; }
    @keyframes mg-tapin { 0% { transform: scale(0); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
    ${S2} .mg-tx { font-size: 13px; font-weight: 800; line-height: 1; letter-spacing: -.3px; font-family: system-ui,-apple-system, 'SF Pro Rounded', sans-serif; } ${S2} .mg-tx.ha { font-size: 8.5px; line-height: 8.5px; text-align: center; letter-spacing: 0; }
    ${S2} .mg-status { text-align: right; font-size: 11px; letter-spacing: .06px; color: var(--label2); padding: 3px 3px 0; font-weight: 600; } ${S2} .mg-status.anim { animation: mg-fade .3s both; } ${S2} .mg-status span { font-weight: 400; }
    @keyframes mg-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    ${S2} .mg-m.typing .mg-b { display: flex; align-items: center; gap: 4px; padding: 13px 13px; min-height: 36px; }
    ${S2} .mg-m.typing i { width: 8px; height: 8px; border-radius: 50%; background: var(--label2); animation: mg-dots 1.2s infinite ease-in-out; }
    ${S2} .mg-m.typing i:nth-child(2) { animation-delay: .2s; } ${S2} .mg-m.typing i:nth-child(3) { animation-delay: .4s; }
    @keyframes mg-dots { 0%, 60%, 100% { opacity: .3; transform: scale(.85); } 30% { opacity: .9; transform: scale(1.05); } }

    /* input bar */
    ${S2} .mg-bar { display: flex; align-items: flex-end; gap: 9px; padding: 7px 14px 7px 11px; }
    .app-messages .mg-bar { position: absolute; left: 0; right: 0; bottom: var(--kb-h, 0px); z-index: 6; padding-bottom: max(7px, calc(var(--safe-bottom) + 6px - var(--kb-h, 0px)));
      background: var(--bar); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); transition: bottom .33s ${EASE}, padding-bottom .33s ${EASE}; }
    ${S2} .mg-plus { flex: none; width: 34px; height: 34px; margin-bottom: 1px; border-radius: 50%; background: var(--fill2); color: var(--gray); display: flex; align-items: center; justify-content: center; transition: transform .2s; }
    ${S2} .mg-plus:active { transform: scale(.9); background: var(--fill); } ${S2} .mg-plus svg { width: 20px; height: 20px; }
    ${S2} .mg-field { position: relative; flex: 1; min-width: 0; min-height: 36px; border-radius: 18px; border: 1px solid var(--sep); background: var(--bg); }
    #screen[data-theme="dark"] ${S2} .mg-field { background: transparent; }
    ${S2} .mg-field textarea { display: block; width: 100%; height: 34px; max-height: 122px; border: 0; background: none; resize: none; padding: 6px 40px 6px 13px; font-size: 17px; line-height: 22px; letter-spacing: -.4px; color: var(--label); overflow-y: auto; scrollbar-width: none; }
    ${S2} .mg-field textarea::placeholder { color: var(--label3); }
    ${S2} .mg-send { position: absolute; right: 3px; bottom: 3px; width: 28px; height: 28px; border-radius: 50%; background: var(--mg-blue); color: #fff; display: flex; align-items: center; justify-content: center; transform: scale(0); opacity: 0; transition: transform .28s ${EASE}, opacity .2s; }
    ${S2} .mg-send.on { transform: scale(1); opacity: 1; } ${S2} .mg-send.on:active { transform: scale(.88); } ${S2} .mg-send svg { width: 18px; height: 18px; }

    /* tapback overlay */
    .app-messages .mg-ov { position: absolute; inset: 0; z-index: 20; }
    .app-messages .mg-ov-dim { position: absolute; inset: 0; background: rgba(0,0,0,.18); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); opacity: 0; transition: opacity .25s; }
    #screen[data-theme="dark"] .app-messages .mg-ov-dim { background: rgba(0,0,0,.45); }
    .app-messages .mg-ov.in .mg-ov-dim { opacity: 1; }
    .app-messages .mg-ov .mg-m { position: absolute; margin: 0; transition: transform .36s ${EASE}; }
    .app-messages .mg-ov .mg-tap { box-shadow: none; } .app-messages .mg-ov .mg-tap::after { box-shadow: none; }
    .app-messages .mg-tbar { position: absolute; height: 46px; padding: 0 8px; border-radius: 23px; display: flex; align-items: center; gap: 2px; background: var(--material-thick, var(--cell)); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
      box-shadow: 0 6px 30px rgba(0,0,0,.2); transform: scale(.3); opacity: 0; transition: transform .36s ${EASE}, opacity .2s; }
    .app-messages .mg-ov.in .mg-tbar, .app-messages .mg-ov.in .mg-tmenu { transform: none; opacity: 1; }
    .app-messages .mg-tbar button { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--gray); transition: transform .2s ${EASE}, background .2s; }
    .app-messages .mg-tbar button:active { transform: scale(1.25); } .app-messages .mg-tbar button svg { width: 21px; height: 21px; }
    .app-messages .mg-tbar button.heart { color: #FF5C93; } .app-messages .mg-tbar button.on { background: var(--mg-blue); color: #fff; }
    .app-messages .mg-tbar .mg-tx { font-size: 17px; } .app-messages .mg-tbar .mg-tx.ha { font-size: 11px; line-height: 10.5px; }
    .app-messages .mg-tmenu { position: absolute; width: 210px; border-radius: 13px; overflow: hidden; background: var(--material-thick, var(--cell)); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
      box-shadow: 0 10px 40px rgba(0,0,0,.22); transform: scale(.3); opacity: 0; transition: transform .36s ${EASE}, opacity .2s; }
    .app-messages .mg-tmenu button { display: flex; width: 100%; height: 44px; padding: 0 16px; align-items: center; justify-content: space-between; font-size: 17px; color: var(--label); }
    .app-messages .mg-tmenu button + button { box-shadow: 0 -.5px 0 var(--sep); } .app-messages .mg-tmenu button:active { background: var(--fill); }
    .app-messages .mg-tmenu button.red { color: var(--red); } .app-messages .mg-tmenu svg { width: 20px; height: 20px; }

    /* sheets (rendered outside the app root) */
    .mg-sheet { height: 100%; display: flex; flex-direction: column; color: var(--label); }
    .mg-sheet.flow { height: auto; display: block; }
    .ios-sheet:has(.mg-compose) { background: var(--bg); }
    #screen[data-theme="dark"] .ios-sheet:has(.mg-compose) { background: #1C1C1E; }
    .mg-sheet .mg-to { flex: none; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 16px; box-shadow: 0 .5px 0 var(--sep); font-size: 17px; }
    .mg-sheet .mg-to > span { color: var(--label2); flex: none; }
    .mg-sheet .mg-to input { flex: 1; min-width: 0; border: 0; background: none; padding: 0; height: 34px; }
    .mg-sheet .mg-chip { flex: none; max-width: 230px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 3px 10px; border-radius: 14px; background: color-mix(in srgb, var(--mg-blue) 16%, transparent); color: var(--mg-blue); cursor: pointer; }
    .mg-sheet .mg-to-add { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--tint); color: var(--tint); display: flex; align-items: center; justify-content: center; }
    .mg-sheet .mg-to-add svg { width: 16px; height: 16px; }
    .mg-sheet .mg-sugg { flex: 1; min-height: 0; }
    .mg-sheet .mg-sg { display: flex; align-items: center; gap: 12px; padding: 8px 16px; cursor: pointer; } .mg-sheet .mg-sg:active { background: var(--fill2); }
    .mg-sheet .mg-sg div { flex: 1; min-width: 0; box-shadow: 0 .5px 0 var(--sep); padding-bottom: 8px; margin-bottom: -8px; } .mg-sheet .mg-sg b { display: block; font-weight: 600; } .mg-sheet .mg-sg small { font-size: 14px; color: var(--label2); }
    .mg-sheet .mg-sg small em { font-style: normal; color: var(--mg-blue); }
    .mg-sheet .mg-bar { flex: none; }
    .mg-sheet.shake .mg-to { animation: mg-shake .4s; }
    @keyframes mg-shake { 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(3px); } }
    .mg-sheet .mg-info-top { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 6px 16px 18px; }
    .mg-sheet .mg-info-top h2 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: .2px; text-align: center; }
    .mg-sheet .mg-info-acts { display: flex; gap: 8px; padding: 0 16px 22px; }
    .mg-sheet .mg-info-acts button { flex: 1; height: 58px; border-radius: 12px; background: var(--cell); color: var(--tint); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; letter-spacing: .06px; }
    .mg-sheet .mg-info-acts button:active { opacity: .6; } .mg-sheet .mg-info-acts svg { width: 22px; height: 22px; } .mg-sheet .mg-info-acts button:disabled { color: var(--label3); }
    .mg-sheet .mg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 0 0 20px; }
    .mg-sheet .mg-grid button { aspect-ratio: 1; background: var(--cell2) center/cover no-repeat; } .mg-sheet .mg-grid button:active { opacity: .7; }
    .mg-sheet .mg-stick { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; padding: 4px 14px 20px; }
    .mg-sheet .mg-stick button { aspect-ratio: 1; font-size: 40px; line-height: 1; border-radius: 14px; transition: transform .2s ${EASE}; } .mg-sheet .mg-stick button:active { transform: scale(1.25); background: var(--fill2); }
    .mg-sheet .mg-none { padding: 70px 40px; text-align: center; color: var(--label2); } .mg-sheet .mg-none b { display: block; font-size: 20px; color: var(--label); margin-bottom: 6px; }
    .mg-sheet .mg-none .ios-btn { margin-top: 22px; }
  `);

  /* ------------------------------------------------------------------ data */
  let threads = null;
  const typing = {};          // threadId → true while the contact is "typing"
  const pending = {};         // threadId → reply job
  let UI = null;              // per-process UI state (launch → onClose)

  const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const owner = () => (OS.settings && OS.settings.get('ownerName')) || 'Colton';
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const byName = (name) => OS.contacts.all().find((c) => OS.contacts.name(c).toLowerCase() === name.toLowerCase()) || null;
  function fmtPhone(p) { const d = digits(p); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || ''); }

  function load() {
    if (threads) return threads;
    const saved = OS.store.get(KEY, null);
    if (Array.isArray(saved)) threads = saved; else { threads = seed(); save(); }
    return threads;
  }
  function save() {
    if (!threads) return;
    threads.forEach((t) => { if (t.msgs.length > 400) t.msgs = t.msgs.slice(-400); });
    OS.store.set(KEY, threads);
  }
  const contactOf = (th) => OS.contacts.find(th.key) || (th.phone ? OS.contacts.find(th.phone) : null);
  function displayName(th) { const c = contactOf(th); return c ? OS.contacts.name(c) : (fmtPhone(th.phone) || th.name || 'Unknown'); }
  function avatarOf(th, size) {
    const c = contactOf(th); if (c) return OS.contacts.avatar(c, size);
    return `<span style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(180deg,#A5ABB8,#858A96);color:#fff">${I.person.replace('<svg', `<svg width="${Math.round(size * .62)}" height="${Math.round(size * .62)}"`)}</span>`;
  }
  const sorted = () => load().filter((t) => t.msgs.length).sort((a, b) => b.msgs[b.msgs.length - 1].t - a.msgs[a.msgs.length - 1].t);
  const unreadTotal = () => load().reduce((n, t) => n + (t.unread || 0), 0);
  function updateBadge() { try { OS.badge && OS.badge('messages', unreadTotal()); } catch (e) { /* core not ready */ } }

  function threadByTo(to, create) {
    load(); if (to == null || to === '') return null;
    const open = UI && UI.convo ? UI.convo.th : null;
    const all = open && !threads.includes(open) ? threads.concat(open) : threads;
    let th = all.find((t) => t.id === to || t.key === to); if (th) return th;
    const c = OS.contacts.find(to);
    if (c) { th = all.find((t) => t.key === c.id || (digits(t.phone) && digits(t.phone) === digits(c.phone))); if (th) return th; }
    const d = digits(to);
    if (!c && d) { th = all.find((t) => digits(t.phone) === d); if (th) return th; }
    if (!create) return null;
    return { id: U.uid(), key: c ? c.id : 'p' + (d || String(to)), name: c ? OS.contacts.name(c) : String(to), phone: c ? c.phone : String(to), msgs: [], unread: 0, status: '', readAt: 0, draft: '', muted: false };
  }
  function commit(th) { if (!threads.includes(th)) threads.push(th); }

  function seed() {
    const now = Date.now(), out = [];
    const add = (name, rows, unread) => {
      const c = byName(name); if (!c) return;
      const msgs = rows.map((r) => { const m = { id: U.uid(), me: r[0] === 1, text: r[1], t: now - r[2] * 60000 }; if (r[3]) m.tap = r[3]; return m; });
      const last = msgs[msgs.length - 1];
      out.push({ id: U.uid(), key: c.id, name: OS.contacts.name(c), phone: c.phone, msgs, unread: unread || 0, status: last.me ? 'Read' : '', readAt: last.me ? last.t + 120000 : 0, draft: '', muted: false });
    };
    add('Mom', [
      [0, 'Don’t forget your water bottle for practice today!', 2890], [1, 'got it 👍', 2884],
      [0, 'Dinner at 6. Tacos 🌮', 1520], [1, 'YES', 1518, { them: 'heart' }], [1, 'can Alex come over after?', 1517], [0, 'Sure, if homework is done first 😊', 1511],
      [0, 'How did the science quiz go?', 58], [1, 'pretty good i think! got the volcano question right', 52], [0, 'That’s my kid!! ❤️ Proud of you', 50],
      [0, 'Can you feed Biscuit when you get home? I’ll be a little late', 12],
    ], 1);
    add('Alex Rivera', [
      [1, 'did you finish the math worksheet', 1700], [0, 'almost. #7 is impossible', 1696], [1, 'its 42 i think', 1690], [0, 'LEGEND', 1689],
      [0, 'get on after school?? found a huge cave in our world', 150], [1, 'yes!! 4pm', 141], [0, 'bring torches this time lol', 140],
    ], 0);
    add('Grandma Rose', [
      [0, 'Hello dear, it is Grandma. I made oatmeal cookies and I am saving you a dozen. Love, Grandma 🍪', 3100], [1, 'thank you grandma!! save me the big ones', 3050],
      [0, 'Already did. How is school going? Love, Grandma', 3040], [1, 'good! im building a new game for the science fair', 3031],
      [0, 'How wonderful!! You will have to teach me how to play it 👵', 3025, { me: 'heart' }],
    ], 0);
    add('Coach Daniels', [
      [0, 'Team — practice is moved to 4:30 tomorrow on Field 2. Bring shin guards and water.', 1350], [1, 'ok coach ill be there', 1320],
      [0, 'Great hustle last game. Keep working on that left foot 💪', 310],
    ], 1);
    add('Pixel Forge Studio', [
      [0, 'Hi! Thanks for signing up to playtest Skybound Islands 🎮 Your build unlocks this Saturday at 10 AM.', 5900], [1, 'awesome thank you!! cant wait', 5880],
      [0, 'We’d love your feedback on the grappling hook — reply here anytime with bugs or ideas!', 5875],
      [1, 'will do. found one already in the trailer lol, the bird flies backwards at 0:42', 4400], [0, 'Ha! Good eye — sending that to the animation team. 🐦', 4380, { me: 'up' }],
    ], 0);
    return out;
  }

  /* ------------------------------------------------------------------ personas + replies */
  const PERSONAS = {
    'mom': { fam: true, bio: 'You are their mom: warm, caring, a little busy. You ask about homework, dinner, chores and the family dog Biscuit, and you are proud of their coding projects. You use proper punctuation and the occasional ❤️ or 😊.', lines: ['Okay sweetie ❤️', 'Sounds good. Love you!', 'Did you finish your homework?', 'Dinner’s at 6, don’t be late 😊', 'Proud of you, kiddo.', 'Remember to drink some water!', 'Okay! Text me when you’re home.'] },
    'grandma rose': { fam: true, bio: 'You are Grandma Rose: very sweet, slightly formal, types carefully, often signs off with "Love, Grandma", bakes cookies, gardens, asks about school, sometimes uses an emoji slightly wrong.', lines: ['That is wonderful, dear. Love, Grandma', 'I am so proud of you! 🌷', 'Come visit soon, I have cookies. Love, Grandma', 'How nice! Tell your mother I said hello.', 'You are such a smart cookie 🍪', 'I love you very much, dear.'] },
    'alex rivera': { bio: 'You are Alex, their best friend from school: a gamer who plays Minecraft and Roblox with them, types in all lowercase with no punctuation, enthusiastic, says "lol", "bro", "lets gooo".', lines: ['lol', 'bro same', 'lets gooo', 'wait fr??', 'get on later', 'thats actually so cool', 'haha no way', 'ok ok ok hear me out… we build a castle'] },
    'bailey chen': { bio: 'You are Bailey, a school friend who loves drawing pixel art and making block-coding projects; creative, encouraging, uses ✨ and 🎨.', lines: ['ooh I love that ✨', 'can I draw the sprites for it??', 'haha yes', 'send me the link!', 'that’s so cool 🎨', 'omg wait I have an idea'] },
    'coach daniels': { bio: 'You are Coach Daniels, their soccer coach: brief, upbeat, encouraging, talks about practice times, hustle and teamwork. Professional and kind.', lines: ['Sounds good. See you at practice.', 'Great attitude 💪', 'Thanks for letting me know.', 'Get some rest and hydrate.', 'Keep working hard — it shows.', 'Practice is 4:30 on Field 2.'] },
    'dylan brooks': { bio: 'You are Dylan, a funny friend from school who skateboards and loves memes; jokey, short messages.', lines: ['LOL', 'no way 💀', 'bro what', 'ok that’s actually fire', 'haha bet', 'did you see what happened at lunch'] },
    'emma park': { bio: 'You are Emma, a classmate and science-fair partner: organized, friendly, likes planning.', lines: ['Sounds good!', 'I can bring the poster board 📋', 'Haha yes', 'Okay see you in class!', 'Did you start the slides yet?'] },
    'jordan lee': { bio: 'You are Jordan, a friend from the soccer team: sporty, chill, short replies.', lines: ['yep', 'nice', 'see you at practice', 'lol true', 'we got this ⚽'] },
    'maya patel': { bio: 'You are Maya, a friend who loves reading and music; kind and thoughtful.', lines: ['Aw that’s so nice', 'Haha I know right', 'Yes!! 🎶', 'Okay! Talk later', 'You should totally do it'] },
    'mr. hoffman': { bio: 'You are Mr. Hoffman, their science teacher: polite, clear, encouraging about the science fair, replies briefly and professionally.', lines: ['Good question — let’s go over it in class tomorrow.', 'Nice work. Keep it up.', 'Thanks for letting me know.', 'Remember the project proposal is due Friday.'] },
    'noah kim': { bio: 'You are Noah, a friend who is into building PCs and strategy games.', lines: ['nice', 'oh that’s sick', 'wanna play later?', 'lol', 'gg'] },
    'zoe martinez': { bio: 'You are Zoe, a cheerful friend from art club.', lines: ['yesss', 'haha love that', 'omg same', 'see you tomorrow! 💛', 'that’s awesome'] },
    'pixel forge studio': { bio: 'You are the friendly community manager at Pixel Forge Studio, a small indie game studio making a game called Skybound Islands. You are excited about playtesters, bug reports and game jams. Helpful and upbeat.', lines: ['Thanks so much for the feedback! 🎮', 'Great catch — passing that to the team.', 'We love hearing from playtesters!', 'New build drops Saturday at 10 AM.', 'Awesome idea. Adding it to our list!'] },
    'pizza planet': { bio: 'You are the text line of Pizza Planet, a local pizza shop: cheerful and brief, about orders, pickup times and specials.', lines: ['Thanks for texting Pizza Planet! 🍕 Your order will be ready in about 20 minutes.', 'Today’s special: large two-topping for $12.', 'You got it! See you soon.'] },
  };
  const GENERIC = { bio: 'You are a friendly person they know. Keep it light and brief.', lines: ['Sounds good!', 'Haha nice', 'Okay!', 'Oh cool', 'Got it 👍', 'Talk soon!'] };
  function personaFor(th) { const n = displayName(th).toLowerCase(); return PERSONAS[n] || PERSONAS[n.split(' ')[0]] || GENERIC; }

  function canned(th) {
    const p = personaFor(th), mine = [...th.msgs].reverse().find((m) => m.me), t = ((mine && mine.text) || '').toLowerCase();
    const lastThem = [...th.msgs].reverse().find((m) => !m.me);
    let pool;
    if (mine && mine.photoId) pool = ['Whoa, nice photo!', 'Love it 😄', 'Cool pic!'];
    else if (/\b(love you|ily|luv u)\b/.test(t)) pool = p.fam ? ['Love you too! ❤️', 'Love you more!'] : ['aww haha'];
    else if (/^(hi|hey|hello|yo|sup|hola|heyy+)\b/.test(t)) pool = ['Hey!', 'Hi! What’s up?', 'Hey hey 👋'];
    else if (/\b(thanks|thank you|thx|ty)\b/.test(t)) pool = ['Of course!', 'Anytime 😊', 'No problem!'];
    else if (/\b(bye|gtg|g2g|good ?night|gn|ttyl|see ya)\b/.test(t)) pool = ['Talk later! 👋', 'Bye!', p.fam ? 'Goodnight, love you!' : 'see ya'];
    else if (/\b(haha|lol|lmao|😂|🤣)\b/.test(t)) pool = ['😂', 'haha right??', 'LOL'];
    else if (/\?\s*$/.test(t)) pool = ['Hmm, good question — let me think.', 'Yes!! 100%', 'I think so!', 'Not sure, I’ll find out and tell you.', 'Probably! Ask me again later 😄'];
    else pool = p.lines;
    const fresh = pool.filter((x) => !lastThem || x !== lastThem.text);
    return pick(fresh.length ? fresh : pool);
  }

  function askAI(th) {
    return Promise.reject(new Error('canned replies only'));   // texts never use AI (saves usage)
    const name = displayName(th), me = owner(), p = personaFor(th);
    const lines = th.msgs.slice(-12).map((m) => `${m.me ? me : name}: ${m.photoId ? '[sent a photo]' : m.text}`).join('\n');
    const system = `You are role-playing as ${name} in a phone text-message conversation with ${me}, a kid who loves coding and making video games. ${p.bio} Stay fully in character. Reply with ONLY the text of your next message: 1-2 short sentences, natural texting style, kid-friendly and kind, only occasionally an emoji. Never say you are an AI. No name prefix, no quotation marks, no stage directions.`;
    const prompt = `Conversation so far:\n${lines}\n\nWrite ${name}'s next text message.`;
    let req; try { req = OS.ai(prompt, { system, fast: true }); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(req).then((t) => {
      const first = name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = String(t || '').trim().replace(new RegExp('^' + first + '[^:\\n]{0,24}:\\s*', 'i'), '').replace(/^["“”']+|["“”']+$/g, '').replace(/\s*\n+\s*/g, ' ').trim();
      if (!t) throw new Error('empty');
      return t.length > 320 ? t.slice(0, 317).replace(/\s+\S*$/, '') + '…' : t;
    });
  }

  function cancelReply(id) { const j = pending[id]; if (!j) return; j.dead = true; j.timers.forEach(clearTimeout); delete pending[id]; setTyping(id, false); }
  function scheduleReply(th) {
    cancelReply(th.id);
    const job = pending[th.id] = { dead: false, timers: [] };
    const later = (fn, ms) => job.timers.push(setTimeout(() => { if (!job.dead) fn(); }, ms));
    const readIn = 600 + Math.random() * 1200, typeFor = 1200 + Math.random() * 1800;
    let text = null, aiDone = false, typed = false;
    const finish = () => {
      if (job.dead || !aiDone || !typed) return;
      job.dead = true; job.timers.forEach(clearTimeout); delete pending[th.id];
      typing[th.id] = false;
      if (!load().includes(th)) return;
      const mine = [...th.msgs].reverse().find((m) => m.me);
      if (mine && !mine.tap && Math.random() < .14) { mine.tap = { them: /haha|lol|😂|joke/i.test(mine.text || '') ? 'haha' : pick(['heart', 'up', 'exclaim']) }; }
      deliver(th, text || canned(th));
    };
    later(() => { th.status = 'Read'; th.readAt = Date.now(); save(); if (viewing(th)) renderMsgs('__status'); }, readIn);
    later(() => setTyping(th.id, true), readIn + 350);
    later(() => { typed = true; finish(); }, readIn + 350 + typeFor);
    later(() => { if (!aiDone) { aiDone = true; text = null; typed = true; finish(); } }, 25000);
    askAI(th).then((t) => { if (!aiDone) { aiDone = true; text = t; finish(); } }, () => { if (!aiDone) { aiDone = true; finish(); } });
  }
  function setTyping(id, on) {
    if (!!typing[id] === !!on) return; typing[id] = !!on;
    if (UI && UI.convo && UI.convo.th.id === id) renderMsgs(on ? '__typing' : null);
  }

  const viewing = (th) => !!(UI && UI.convo && UI.convo.th === th);
  const viewingLive = (th) => viewing(th) && UI.active && (!UI.ctx.isActive || UI.ctx.isActive());

  function deliver(th, text, extra) {
    load(); commit(th);
    const m = Object.assign({ id: U.uid(), me: false, text: String(text), t: Date.now() }, extra || {});
    th.msgs.push(m); th.status = '';
    if (viewingLive(th)) { th.unread = 0; OS.sound.play('received'); }
    else {
      th.unread = (th.unread || 0) + 1;
      if (!th.muted) {
        const key = th.key;
        OS.notify({ appId: 'messages', title: displayName(th), body: m.photoId ? 'Photo' : m.text, sound: OS.sound.textTone(), onTap() { OS.openApp('messages', { to: key }); } });
      }
    }
    save(); updateBadge();
    if (viewing(th)) renderMsgs(m.id);
    renderList();
    return m;
  }

  function sendMsg(th, payload) {
    load(); commit(th);
    const m = Object.assign({ id: U.uid(), me: true, text: '', t: Date.now() }, payload);
    th.msgs.push(m); th.status = ''; th.draft = '';
    OS.sound.play('sent'); OS.haptic && OS.haptic('light');
    save();
    if (viewing(th)) renderMsgs(m.id);
    renderList();
    setTimeout(() => { if (!load().includes(th) || th.msgs[th.msgs.length - 1] !== m || th.status) return; th.status = 'Delivered'; save(); if (viewing(th)) renderMsgs('__status'); }, 650);
    scheduleReply(th);
  }

  function removeThread(th) { cancelReply(th.id); threads = load().filter((t) => t !== th); save(); updateBadge(); }

  /* public hook for the rest of the OS */
  OS.messages = {
    receive(to, text) { const th = threadByTo(to, true); if (!th || text == null || text === '') return null; cancelReply(th.id); return deliver(th, text); },
    unread: () => unreadTotal(),
  };

  /* ------------------------------------------------------------------ formatting */
  const EMOJI_ONLY = /^(?:(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|[\u{1F1E6}-\u{1F1FF}]{2})\s*){1,3}$/u;
  const isBig = (t) => { try { return EMOJI_ONLY.test(String(t).trim()); } catch (e) { return false; } };
  function stamp(t) {
    const d = new Date(t), now = new Date(), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    const tm = U.time(d) + (U.ampm(d) ? ' ' + U.ampm(d) : '');
    let lead;
    if (diff === 0) lead = 'Today'; else if (diff === 1) lead = 'Yesterday';
    else if (diff < 7) lead = d.toLocaleDateString('en-US', { weekday: 'long' });
    else lead = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + (d.getFullYear() !== now.getFullYear() ? ', ' + d.getFullYear() : '') + ' at';
    return `<b>${esc(lead)}</b> ${esc(tm)}`;
  }
  const richText = (t) => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,!?)])/g, '<span class="mg-link" data-url="$1">$1</span>');
  function previewOf(th) { const m = th.msgs[th.msgs.length - 1]; if (!m) return ''; return m.photoId ? 'Attachment: 1 Image' : m.text; }

  /* ------------------------------------------------------------------ list page */
  function later(fn, ms) { if (!UI) return 0; const t = setTimeout(() => { if (UI) { UI.timers.delete(t); fn(); } }, ms); UI.timers.add(t); return t; }

  function swipeable(row, acts, width, onFull) {
    let open = false, base = 0, cur = 0, skip = false;
    const set = (x, anim) => {
      cur = x; row.style.transition = anim ? `transform .34s ${EASE}, padding .3s ${EASE}` : 'none'; acts.style.transition = anim ? `width .34s ${EASE}` : 'none';
      row.style.transform = x ? `translateX(${x}px)` : ''; acts.style.width = Math.max(0, -x) + 'px';
    };
    const api = { get open() { return open; }, close() { open = false; set(0, true); if (UI && UI.swipe === api) UI.swipe = null; } };
    U.drag(row, {
      axis: 'x',
      onStart(p) {
        skip = !UI || UI.editing || (p.x - p.dx) < 28; if (skip) return false;
        if (UI.swipe && UI.swipe !== api) UI.swipe.close();
        base = open ? -width : 0; row.classList.remove('pressed');
      },
      onMove(p) { if (skip) return; let x = base + p.dx; if (x > 0) x = x * .12; set(x, false); },
      onEnd(p) {
        if (skip) return;
        if (onFull && cur < -250) { set(-OS.W, true); onFull(() => api.close()); return; }
        open = p.vx < -.35 || (cur < -width / 2 && p.vx < .35);
        set(open ? -width : 0, true); if (UI) UI.swipe = open ? api : (UI.swipe === api ? null : UI.swipe);
      },
    });
    return api;
  }

  function confirmDelete(list, done, cancelled) {
    OS.ui.actionSheet({
      message: list.length > 1 ? `Would you like to delete these ${list.length} conversations? They will be deleted from all of your devices.` : 'Would you like to delete this conversation? This conversation will be deleted from all of your devices.',
      buttons: [{ label: 'Delete', style: 'destructive' }], cancel: 'Cancel',
    }).then((i) => { if (i === 0) done(); else cancelled && cancelled(); });
  }

  function renderList() {
    if (!UI || !UI.listWrap) return;
    const wrap = UI.listWrap, q = UI.query.trim().toLowerCase();
    UI.swipe = null;
    let list = sorted();
    const hits = {};
    if (q) list = list.filter((th) => {
      if (displayName(th).toLowerCase().includes(q)) return true;
      const m = [...th.msgs].reverse().find((x) => (x.text || '').toLowerCase().includes(q)); if (m) hits[th.id] = m.text; return !!m;
    });
    wrap.innerHTML = ''; wrap.classList.toggle('editing', UI.editing);
    if (!list.length) { wrap.innerHTML = q ? `<div class="mg-empty">No Results<small>for “${esc(UI.query.trim())}”</small></div>` : '<div class="mg-empty">No Messages</div>'; updateSelBar(); return; }
    list.forEach((th) => {
      const last = th.msgs[th.msgs.length - 1];
      let prev = esc(hits[th.id] || previewOf(th));
      if (hits[th.id]) { const i = hits[th.id].toLowerCase().indexOf(q); const a = Math.max(0, i - 24); prev = (a ? '…' : '') + esc(hits[th.id].slice(a, i)) + '<mark>' + esc(hits[th.id].slice(i, i + q.length)) + '</mark>' + esc(hits[th.id].slice(i + q.length)); }
      else if (typing[th.id]) prev = '…';
      else if (th.draft && !viewing(th)) prev = '<span style="color:var(--label3)">Draft:</span> ' + esc(th.draft);
      const rw = el(`<div class="mg-rw"><div class="mg-acts"><button class="mg-act-mute">${th.muted ? I.bell : I.bellOff}<span>${th.muted ? 'Show Alerts' : 'Hide Alerts'}</span></button><button class="mg-act-del">${I.trash}<span>Delete</span></button></div>
        <div class="mg-r${th.unread ? ' unread' : ''}${UI.picked.has(th.id) ? ' picked' : ''}"><i class="mg-dot"></i><i class="mg-sel">${I.check}</i>${avatarOf(th, 45)}
          <div class="mg-r-main"><div class="mg-r-top"><b>${esc(displayName(th))}</b>${th.muted ? `<span class="mute">${I.moon}</span>` : ''}<span class="t">${esc(U.relDate(last.t))}</span><i class="ios-chevron"></i></div>
          <div class="mg-r-prev">${prev}</div></div></div></div>`);
      const row = rw.querySelector('.mg-r'), acts = rw.querySelector('.mg-acts');
      const collapse = (then) => { rw.style.height = rw.offsetHeight + 'px'; rw.getBoundingClientRect(); rw.style.height = '0px'; rw.style.opacity = '0'; later(then, 300); };
      const del = (undo) => confirmDelete([th], () => collapse(() => { removeThread(th); renderList(); }), undo);
      const sw = swipeable(row, acts, 164, del);
      row.addEventListener('pointerdown', () => { if (!sw.open) row.classList.add('pressed'); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => row.addEventListener(n, () => row.classList.remove('pressed')));
      row.addEventListener('click', () => {
        if (sw.open) return sw.close();
        if (UI.swipe) return UI.swipe.close();
        if (UI.editing) { UI.picked.has(th.id) ? UI.picked.delete(th.id) : UI.picked.add(th.id); row.classList.toggle('picked'); updateSelBar(); return; }
        openConvo(th, {});
      });
      rw.querySelector('.mg-act-del').addEventListener('click', () => del(() => sw.close()));
      rw.querySelector('.mg-act-mute').addEventListener('click', () => { th.muted = !th.muted; save(); sw.close(); later(renderList, 340); });
      wrap.appendChild(rw);
    });
    updateSelBar();
  }

  function setEditing(on) {
    if (!UI) return;
    UI.editing = on; UI.picked.clear(); if (UI.swipe) UI.swipe.close();
    UI.listWrap.classList.toggle('editing', on);
    UI.listWrap.querySelectorAll('.mg-r.picked').forEach((r) => r.classList.remove('picked'));
    const page = UI.listPage;
    if (page && page.setLeft) page.setLeft({ label: on ? 'Done' : 'Edit', bold: on, onTap: editTapped });
    UI.selBar.classList.toggle('in', on); updateSelBar();
  }
  function updateSelBar() {
    if (!UI || !UI.selBar) return;
    const n = UI.picked.size, [read, del] = UI.selBar.querySelectorAll('button');
    read.textContent = n ? 'Read' : 'Read All'; del.disabled = !n;
  }
  function editTapped(page, node) {
    if (UI.editing) return setEditing(false);
    const items = [
      { label: 'Select Messages', icon: I.check, onTap: () => setEditing(true) },
      { label: 'Mark All as Read', icon: I.bubble, onTap: () => { load().forEach((t) => { t.unread = 0; }); save(); updateBadge(); renderList(); } },
    ];
    if (node && node.getBoundingClientRect) OS.ui.contextMenu(node, items);
    else OS.ui.actionSheet({ buttons: items.map((x) => ({ label: x.label })) }).then((i) => { if (i >= 0) items[i].onTap(); });
  }

  function pushList() {
    UI.listPage = UI.nav.push({
      title: 'Messages', largeTitle: true,
      left: { label: 'Edit', onTap: editTapped },
      right: [{ icon: I.compose, onTap: () => openCompose({}) }],
      search: { placeholder: 'Search', onInput(text) { UI.query = text || ''; renderList(); } },
      render(body, page) {
        UI.listWrap = el('<div class="mg-list"></div>'); body.appendChild(UI.listWrap);
        UI.selBar = el('<div class="mg-selbar"><button>Read All</button><button class="del">Delete</button></div>');
        (page && page.el ? page.el : body.parentNode).appendChild(UI.selBar);
        const [read, del] = UI.selBar.querySelectorAll('button');
        read.addEventListener('click', () => { load().forEach((t) => { if (!UI.picked.size || UI.picked.has(t.id)) t.unread = 0; }); save(); updateBadge(); setEditing(false); renderList(); });
        del.addEventListener('click', () => {
          const list = load().filter((t) => UI.picked.has(t.id)); if (!list.length) return;
          confirmDelete(list, () => { list.forEach(removeThread); setEditing(false); renderList(); });
        });
        renderList();
      },
    });
  }

  /* ------------------------------------------------------------------ conversation page */
  function growField(ta, sendBtn) {
    ta.style.height = '34px';
    const h = Math.min(122, Math.max(34, ta.scrollHeight)); ta.style.height = h + 'px';
    if (sendBtn) sendBtn.classList.toggle('on', !!ta.value.trim());
  }
  const barHTML = (ph) => `<div class="mg-bar"><button class="mg-plus" aria-label="Apps">${I.plus}</button><div class="mg-field"><textarea rows="1" placeholder="${ph}" autocomplete="off" autocapitalize="sentences"></textarea><button class="mg-send" aria-label="Send">${I.up}</button></div></div>`;
  function wireField(ta, sendBtn, onSend, onInput) {
    ta.addEventListener('input', () => { growField(ta, sendBtn); onInput && onInput(); });
    // a hardware Return sends (like a Mac / iPad keyboard); the on-screen return key inserts a new line, like iOS
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.isTrusted && !e.shiftKey && !e.isComposing) { e.preventDefault(); onSend(); } });
    ['pointerdown', 'mousedown'].forEach((n) => sendBtn.addEventListener(n, (e) => e.preventDefault()));   // keep the keyboard up
    sendBtn.addEventListener('click', onSend);
  }

  function openConvo(th, opts) {
    if (!UI) return;
    opts = opts || {};
    if (UI.convo) { if (UI.convo.th === th) { if (opts.body != null && opts.body !== '') setDraft(opts.body); if (opts.focus) UI.convo.ta.focus(); return; } closeConvo(true); }
    const node = el(`<div class="mg-convo">
      <div class="mg-scroll ios-scroll"><div class="mg-msgs"></div></div>
      <div class="mg-head"><button class="mg-back" aria-label="Back">${I.back}<span class="mg-back-n"></span></button>
        <button class="mg-who">${avatarOf(th, 38)}<span class="mg-who-name"><span>${esc(displayName(th))}</span>${I.chev}</span></button>
        <button class="mg-ft" aria-label="FaceTime">${I.video}</button></div>
      ${barHTML('iMessage')}<div class="mg-edge"></div></div>`);
    const C = UI.convo = { th, node, scroll: node.querySelector('.mg-scroll'), msgs: node.querySelector('.mg-msgs'), bar: node.querySelector('.mg-bar'), ta: node.querySelector('textarea'), send: node.querySelector('.mg-send'), atBottom: true, photos: null, ro: null, draftT: 0 };
    UI.ctx.root.appendChild(node);

    node.querySelector('.mg-back').addEventListener('click', () => closeConvo());
    node.querySelector('.mg-who').addEventListener('click', () => openInfo(th));
    node.querySelector('.mg-ft').addEventListener('click', () => {
      if (OS.isInstalled && !OS.isInstalled('facetime')) return OS.ui.toast('FaceTime is not installed');
      const c = contactOf(th); OS.openApp('facetime', { to: c ? c.id : th.phone });
    });
    node.querySelector('.mg-plus').addEventListener('click', (e) => openPlus(e.currentTarget, th));
    wireField(C.ta, C.send, () => { const v = C.ta.value.trim(); if (!v) return; C.ta.value = ''; growField(C.ta, C.send); C.atBottom = true; sendMsg(th, { text: v }); },
      () => { clearTimeout(C.draftT); C.draftT = setTimeout(() => { th.draft = C.ta.value; if (load().includes(th)) save(); }, 400); });
    C.scroll.addEventListener('scroll', () => { C.atBottom = C.scroll.scrollHeight - C.scroll.scrollTop - C.scroll.clientHeight < 48; }, { passive: true });
    C.scroll.addEventListener('click', (e) => {
      const link = e.target.closest('.mg-link'); if (link) return void OS.openURL(link.dataset.url);
      if (!e.target.closest('.mg-b')) C.ta.blur();
    });
    U.longPress(C.msgs, (e) => {
      const row = e.target && e.target.closest ? e.target.closest('.mg-m') : null; if (!row || row.classList.contains('typing')) return;
      const m = th.msgs.find((x) => x.id === row.dataset.id); if (m) openTapback(m, row);
    }, 420);
    if (typeof ResizeObserver === 'function') {
      C.ro = new ResizeObserver(() => { node.style.setProperty('--mg-bar-h', C.bar.offsetHeight + 'px'); if (C.atBottom) toBottom(); });
      C.ro.observe(C.bar);
    }
    // edge-swipe back
    const host = UI.navHost;
    U.drag(node.querySelector('.mg-edge'), {
      axis: 'x',
      onStart() { node.classList.add('nodrag'); host.classList.add('nodrag'); C.ta.blur(); },
      onMove(p) { const x = Math.max(0, p.dx); node.style.transform = `translateX(${x}px)`; host.style.transform = `translateX(${-30 + (x / OS.W) * 30}%)`; },
      onEnd(p) { node.classList.remove('nodrag'); host.classList.remove('nodrag'); node.style.transform = ''; host.style.transform = ''; if (p.dx > OS.W * .35 || p.vx > .5) closeConvo(); },
    });

    C.ta.value = opts.body != null && opts.body !== '' ? opts.body : (th.draft || '');
    markRead(th); renderMsgs(); refreshBackCount();
    if (opts.instant) { node.classList.add('nodrag'); host.classList.add('nodrag'); }
    node.getBoundingClientRect();
    requestAnimationFrame(() => {
      node.classList.add('in'); host.classList.add('under');
      if (opts.instant) { node.getBoundingClientRect(); node.classList.remove('nodrag'); host.classList.remove('nodrag'); }
      growField(C.ta, C.send); toBottom();
    });
    if (opts.focus) later(() => { if (UI.convo === C) C.ta.focus(); }, opts.instant ? 80 : 460);
  }
  function setDraft(text) { const C = UI && UI.convo; if (!C) return; C.ta.value = text; growField(C.ta, C.send); }

  function closeConvo(instant) {
    const C = UI && UI.convo; if (!C) return;
    UI.convo = null; closeTapback(true);
    clearTimeout(C.draftT); C.th.draft = C.ta.value; if (load().includes(C.th)) save();
    C.ta.blur(); if (C.ro) C.ro.disconnect();
    UI.navHost.classList.remove('under'); C.node.classList.remove('in');
    if (instant) C.node.remove(); else { const n = C.node; const t = setTimeout(() => n.remove(), 440); UI.timers.add(t); }
    renderList();
  }
  function markRead(th) { if (th.unread) { th.unread = 0; save(); updateBadge(); } }
  function refreshBackCount() {
    const C = UI && UI.convo; if (!C) return;
    const n = load().reduce((s, t) => s + (t !== C.th ? (t.unread || 0) : 0), 0);
    C.node.querySelector('.mg-back-n').textContent = n ? String(n) : '';
  }
  function toBottom() { const C = UI && UI.convo; if (C) C.scroll.scrollTop = C.scroll.scrollHeight; }

  function tapHTML(m, popId) {
    if (!m.tap) return '';
    const mine = !!m.tap.me, id = m.tap.me || m.tap.them, t = tapById(id); if (!t) return '';
    return `<span class="mg-tap ${mine ? 'byme' : 'bythem'} ${id}${popId === m.id ? ' popin' : ''}">${t.svg}</span>`;
  }
  function renderMsgs(animId) {
    const C = UI && UI.convo; if (!C) return;
    const th = C.th, msgs = th.msgs, animMsg = animId ? th.msgs.find((x) => x.id === animId) : null, stick = C.atBottom || !!(animMsg && animMsg.me);
    const stCls = animId === '__status' ? 'mg-status anim' : 'mg-status';
    let html = '', prevT = 0;
    const tapPop = typeof animId === 'string' && animId.indexOf('tap:') === 0 ? animId.slice(4) : null;
    msgs.forEach((m, i) => {
      const prev = msgs[i - 1], next = msgs[i + 1];
      const newStamp = !prev || m.t - prevT > HOUR; if (newStamp) html += `<div class="mg-stamp">${stamp(m.t)}</div>`;
      prevT = m.t;
      const first = newStamp || !prev || prev.me !== m.me;
      const lastOfRun = !next || next.me !== m.me || next.t - m.t > HOUR;
      const big = !m.photoId && isBig(m.text), hasTap = !!(m.tap && (m.tap.me || m.tap.them));
      const cls = ['mg-m', m.me ? 'me' : 'them', first ? 'first' : '', lastOfRun && !big && !m.photoId ? 'tail' : '', big ? 'big' : '', m.photoId ? 'img' : '', hasTap ? 'hastap' : '', animId === m.id ? 'pop' : ''].filter(Boolean).join(' ');
      const inner = m.photoId ? `<span data-pid="${esc(m.photoId)}">Photo</span>` : richText(m.text);
      html += `<div class="${cls}" data-id="${m.id}"><div class="mg-b">${inner}${tapHTML(m, tapPop)}</div></div>`;
    });
    const last = msgs[msgs.length - 1];
    if (last && last.me && th.status) {
      html += th.status === 'Read' ? `<div class="${stCls}">Read <span>${esc(U.relDate(th.readAt || last.t))}</span></div>` : `<div class="${stCls}">${esc(th.status)}</div>`;
    }
    if (typing[th.id]) html += `<div class="mg-m them tail first typing${animId === '__typing' ? ' pop' : ''}"><div class="mg-b"><i></i><i></i><i></i></div></div>`;
    if (!msgs.length) html = `<div class="mg-stamp"><b>iMessage</b><br>${stamp(Date.now())}</div>`;
    C.msgs.innerHTML = html;
    fillPhotos(C);
    if (stick) { C.atBottom = true; toBottom(); }
    refreshBackCount();
  }
  function fillPhotos(C) {
    const slots = C.msgs.querySelectorAll('[data-pid]'); if (!slots.length) return;
    const apply = () => slots.forEach((s) => {
      const p = C.photos.find((x) => String(x.id) === s.dataset.pid); if (!p || typeof p.src !== 'string') return;
      const img = new Image(); img.alt = ''; img.onload = () => { if (C.atBottom) toBottom(); }; img.src = p.src; s.replaceWith(img);
    });
    if (C.photos) return apply();
    Promise.resolve(OS.photos ? OS.photos.all() : []).then((a) => { C.photos = a || []; if (UI && UI.convo === C) apply(); }).catch(() => { C.photos = []; });
  }

  /* ------------------------------------------------------------------ tapback overlay */
  function closeTapback(instant) {
    const o = UI && UI.tapOv; if (!o) return; UI.tapOv = null;
    o.row.classList.remove('held'); o.node.classList.remove('in'); o.clone.style.transform = '';
    if (instant) o.node.remove(); else { const n = o.node; const t = setTimeout(() => n.remove(), 260); UI.timers.add(t); }
  }
  function openTapback(m, row) {
    const C = UI && UI.convo; if (!C) return; closeTapback(true); C.ta.blur();
    const root = UI.ctx.root, rr = root.getBoundingClientRect(), k = (rr.width / root.offsetWidth) || 1, W = root.offsetWidth, H = root.offsetHeight;
    const rel = (e2) => { const r = e2.getBoundingClientRect(); return { x: (r.left - rr.left) / k, y: (r.top - rr.top) / k, w: r.width / k, h: r.height / k }; };
    const B = rel(row.querySelector('.mg-b')), R = rel(row);
    const canCopy = !m.photoId, menuH = (canCopy ? 2 : 1) * 44, barH = 46, barW = 6 * 38 + 5 * 2 + 16;
    const minY = 62 + barH + 22, maxY = H - 34 - menuH - 20 - B.h;
    const y = Math.max(minY, Math.min(B.y, maxY)), dy = y - B.y;
    const node = el(`<div class="mg-ov"><div class="mg-ov-dim"></div></div>`);
    const clone = row.cloneNode(true); clone.classList.remove('tail', 'pop', 'first', 'hastap');
    clone.style.cssText = `left:${R.x}px;top:${R.y}px;width:${R.w}px`;
    const bar = el(`<div class="mg-tbar">${TAPS.map((t) => `<button class="${t.id}${m.tap && m.tap.me === t.id ? ' on' : ''}" data-tap="${t.id}">${t.svg}</button>`).join('')}</div>`);
    const bx = U.clamp(m.me ? B.x + B.w - barW + 12 : B.x - 12, 8, W - barW - 8);
    bar.style.cssText = `left:${bx}px;top:${y - barH - 10}px;transform-origin:${m.me ? '100%' : '0'} 100%`;
    const menu = el(`<div class="mg-tmenu">${canCopy ? `<button data-act="copy">Copy${I.copy}</button>` : ''}<button class="red" data-act="del">Delete${I.trash}</button></div>`);
    const mx = U.clamp(m.me ? B.x + B.w - 210 : B.x, 8, W - 218);
    menu.style.cssText = `left:${mx}px;top:${Math.min(y + B.h + 10, H - 34 - menuH - 8)}px;transform-origin:${m.me ? '100%' : '0'} 0`;
    node.appendChild(clone); node.appendChild(bar); node.appendChild(menu); root.appendChild(node);
    row.classList.add('held');
    UI.tapOv = { node, row, clone };
    node.getBoundingClientRect();
    requestAnimationFrame(() => { node.classList.add('in'); clone.style.transform = `translateY(${dy}px)`; });
    node.querySelector('.mg-ov-dim').addEventListener('click', () => closeTapback());
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tap]'); if (!b) return;
      const t = tapById(b.dataset.tap), was = m.tap && m.tap.me === t.id;
      m.tap = Object.assign({}, m.tap); if (was) delete m.tap.me; else m.tap.me = t.id;
      if (!m.tap.me && !m.tap.them) delete m.tap;
      if (!was) OS.sound.play(t.sound);
      OS.haptic && OS.haptic('light');
      save(); closeTapback(true); renderMsgs(was ? null : 'tap:' + m.id);
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'copy') { try { navigator.clipboard && navigator.clipboard.writeText(m.text).catch(() => {}); } catch (e2) { /* no clipboard */ } closeTapback(); OS.ui.toast('Copied'); return; }
      const th = C.th; th.msgs = th.msgs.filter((x) => x !== m);
      if (!th.msgs.length) { closeTapback(true); removeThread(th); closeConvo(); return; }
      save(); closeTapback(true); renderMsgs(); renderList();
    });
  }

  /* ------------------------------------------------------------------ sheets */
  function makeSheet(opts) {
    let ref = null;
    const api = { close() { try { ref && ref.close(); } catch (e) { /* already closed */ } } };
    const o = Object.assign({}, opts, { render(body, s) { ref = ref || s || null; opts.render(body, api); } });
    const r = OS.ui.sheet(o); if (r) ref = r;
    return api;
  }

  function openPlus(anchor, th) {
    OS.ui.contextMenu(anchor, [
      { label: 'Camera', icon: I.camera, onTap: () => { if (OS.isInstalled && !OS.isInstalled('camera')) return OS.ui.toast('Camera is not installed'); OS.openApp('camera'); } },
      { label: 'Photos', icon: I.photos, onTap: () => openPhotoPicker(th) },
      { label: 'Stickers', icon: I.smile, onTap: () => openStickers(th) },
    ]);
  }
  function openPhotoPicker(th) {
    makeSheet({
      title: 'Photos', right: { label: 'Cancel' },
      render(body, sheet) {
        const box = el('<div class="mg-sheet flow"><div class="mg-none">Loading…</div></div>'); body.appendChild(box);
        Promise.resolve(OS.photos ? OS.photos.all() : []).catch(() => []).then((all) => {
          const pics = (all || []).filter((p) => p.kind !== 'video' && typeof p.src === 'string').reverse();
          if (!pics.length) {
            box.innerHTML = '<div class="mg-none"><b>No Photos</b>Photos you take with Camera show up here, ready to send.<button class="ios-btn">Open Camera</button></div>';
            box.querySelector('button').addEventListener('click', () => { sheet.close(); OS.openApp('camera'); });
            return;
          }
          box.innerHTML = '<div class="mg-grid"></div>';
          pics.forEach((p) => {
            const b = el('<button></button>'); b.style.backgroundImage = `url("${String(p.src).replace(/"/g, '%22')}")`;
            b.addEventListener('click', () => { sheet.close(); if (UI && UI.convo) { UI.convo.photos = null; UI.convo.atBottom = true; } sendMsg(th, { text: '', photoId: p.id }); });
            box.firstElementChild.appendChild(b);
          });
        });
      },
    });
  }
  function openStickers(th) {
    const set = ['😀', '😂', '🥳', '😎', '🤩', '😭', '🙄', '😴', '❤️', '🔥', '👍', '👀', '💀', '🎮', '🕹️', '🚀', '⚽', '🍕', '🌮', '🍪', '🐶', '🐱', '🦖', '🏰', '⭐', '🎉', '✨', '🌈', '👾', '🤖'];
    makeSheet({
      title: 'Stickers', height: 'medium', right: { label: 'Done', bold: true },
      render(body, sheet) {
        const box = el(`<div class="mg-sheet flow"><div class="mg-stick">${set.map((e) => `<button>${e}</button>`).join('')}</div></div>`); body.appendChild(box);
        box.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sheet.close(); if (UI && UI.convo) UI.convo.atBottom = true; sendMsg(th, { text: b.textContent }); });
      },
    });
  }

  function openInfo(th) {
    const c = contactOf(th);
    makeSheet({
      title: '', right: { label: 'Done', bold: true },
      render(body, sheet) {
        const phone = c ? c.phone : th.phone, email = c && c.email;
        const box = el(`<div class="mg-sheet flow"><div class="mg-info-top">${avatarOf(th, 96)}<h2>${esc(displayName(th))}</h2></div>
          <div class="mg-info-acts"><button data-a="call" ${phone ? '' : 'disabled'}>${I.phone}<span>call</span></button><button data-a="video">${I.video}<span>video</span></button><button data-a="mail" ${email ? '' : 'disabled'}>${I.mail}<span>mail</span></button></div>
          <div class="ios-list">${phone ? `<div class="ios-row tappable" data-a="call"><div class="ios-row-label" style="font-size:15px">mobile<span class="ios-row-sub" style="font-size:17px;color:var(--tint);letter-spacing:-.4px">${esc(fmtPhone(phone))}</span></div></div>` : ''}
            ${email ? `<div class="ios-row tappable" data-a="mail"><div class="ios-row-label" style="font-size:15px">email<span class="ios-row-sub" style="font-size:17px;color:var(--tint);letter-spacing:-.4px">${esc(email)}</span></div></div>` : ''}</div>
          <div class="ios-list" style="margin-top:35px"><div class="ios-row"><div class="ios-row-label">Hide Alerts</div><label class="ios-switch"><input type="checkbox" ${th.muted ? 'checked' : ''}><i></i></label></div></div>
          ${c ? '' : '<div class="ios-list" style="margin-top:35px"><div class="ios-row tappable" data-a="add"><div class="ios-row-label" style="color:var(--tint)">Create New Contact</div></div></div>'}
          <div class="ios-list" style="margin-top:35px"><div class="ios-row tappable" data-a="del"><div class="ios-row-label" style="color:var(--red)">Delete Conversation</div></div></div><div style="height:30px"></div></div>`);
        box.style.setProperty('--mg-ic-cut', 'var(--cell)');
        body.appendChild(box);
        box.querySelector('.ios-switch input').addEventListener('change', (e) => { th.muted = e.target.checked; if (load().includes(th)) save(); renderList(); });
        box.addEventListener('click', (e) => {
          const t = e.target.closest('[data-a]'); if (!t || t.disabled) return; const a = t.dataset.a;
          if (a === 'call') { sheet.close(); OS.openURL('tel:' + encodeURIComponent(phone)); }
          else if (a === 'video') { sheet.close(); OS.openApp('facetime', { to: c ? c.id : th.phone }); }
          else if (a === 'mail') { sheet.close(); OS.openURL('mailto:' + email); }
          else if (a === 'add') {
            OS.ui.prompt({ title: 'New Contact', message: fmtPhone(th.phone), placeholder: 'Name', okLabel: 'Save' }).then((name) => {
              if (!name || !name.trim()) return; const parts = name.trim().split(/\s+/);
              const nc = OS.contacts.add({ first: parts.shift(), last: parts.join(' '), phone: th.phone }); th.key = nc.id; th.name = OS.contacts.name(nc); if (load().includes(th)) save();
              sheet.close(); renderList();
              if (UI && UI.convo && UI.convo.th === th) { const w = UI.convo.node.querySelector('.mg-who'); w.innerHTML = `${avatarOf(th, 38)}<span class="mg-who-name"><span>${esc(displayName(th))}</span>${I.chev}</span>`; }
            });
          } else if (a === 'del') { sheet.close(); confirmDelete([th], () => { removeThread(th); closeConvo(); }); }
        });
      },
    });
  }

  function openCompose(pre) {
    pre = pre || {};
    makeSheet({
      title: 'New Message', right: { label: 'Cancel' },
      render(body, sheet) {
        body.style.overflow = 'hidden';
        const box = el(`<div class="mg-sheet mg-compose"><div class="mg-to"><span>To:</span><input type="text" autocomplete="off" autocapitalize="words" enterkeyhint="next" aria-label="To"><button class="mg-to-add" aria-label="Add Contact">${I.plus}</button></div>
          <div class="mg-sugg ios-scroll"></div>${barHTML('iMessage')}</div>`);
        body.appendChild(box);
        const toRow = box.querySelector('.mg-to'), input = toRow.querySelector('input'), sugg = box.querySelector('.mg-sugg'), ta = box.querySelector('textarea'), send = box.querySelector('.mg-send');
        let picked = null, showAll = false;
        if (pre.body) { ta.value = pre.body; }
        const matches = () => {
          const q = input.value.trim().toLowerCase(), qd = digits(q);
          if (!q && !showAll) return [];
          return OS.contacts.all().filter((c) => c.phone && (!q || OS.contacts.name(c).toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || OS.contacts.name(c).toLowerCase().startsWith(q) || (qd.length >= 3 && digits(c.phone).includes(qd))));
        };
        const drawSugg = () => {
          sugg.innerHTML = ''; if (picked) return;
          matches().forEach((c) => {
            const r = el(`<div class="mg-sg">${OS.contacts.avatar(c, 40)}<div><b>${esc(OS.contacts.name(c))}</b><small>mobile <em>${esc(c.phone)}</em></small></div></div>`);
            r.addEventListener('click', () => choose(c.id, OS.contacts.name(c))); sugg.appendChild(r);
          });
        };
        const choose = (to, label) => {
          picked = to; input.value = ''; input.style.display = 'none';
          const chip = el(`<span class="mg-chip">${esc(label)}</span>`); toRow.insertBefore(chip, input);
          chip.addEventListener('click', () => { chip.remove(); picked = null; input.style.display = ''; input.focus(); drawSugg(); });
          drawSugg(); ta.focus();
        };
        const resolveTyped = () => {
          if (picked) return true;
          const v = input.value.trim(); if (!v) return false;
          const m = matches();
          if (m.length && (m.length === 1 || OS.contacts.name(m[0]).toLowerCase() === v.toLowerCase())) { choose(m[0].id, OS.contacts.name(m[0])); return true; }
          if (digits(v).length >= 3 && !/[a-z]/i.test(v)) { choose(v, fmtPhone(v)); return true; }
          return false;
        };
        const fail = () => { OS.haptic && OS.haptic('error'); box.classList.remove('shake'); box.getBoundingClientRect(); box.classList.add('shake'); if (!picked) input.focus(); };
        input.addEventListener('input', () => { showAll = false; drawSugg(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!resolveTyped()) fail(); } });
        box.querySelector('.mg-to-add').addEventListener('click', () => { if (picked) return; showAll = !showAll; drawSugg(); });
        ta.addEventListener('focus', () => { if (!picked && input.value.trim()) resolveTyped(); });
        box.querySelector('.mg-plus').addEventListener('click', () => { if (!resolveTyped()) return fail(); const th = threadByTo(picked, true); sheet.close(); openConvo(th, { instant: true, body: ta.value }); later(() => { const C = UI && UI.convo; if (C) openPlus(C.node.querySelector('.mg-plus'), th); }, 450); });
        wireField(ta, send, () => {
          const v = ta.value.trim(); if (!v) return;
          if (!resolveTyped()) return fail();
          const th = threadByTo(picked, true); sheet.close(); openConvo(th, { instant: true }); sendMsg(th, { text: v });
        });
        growField(ta, send);
        if (pre.to) { const c = OS.contacts.find(pre.to); choose(c ? c.id : pre.to, c ? OS.contacts.name(c) : fmtPhone(pre.to)); }
        else setTimeout(() => { try { input.focus(); } catch (e) { /* closed */ } }, 420);
      },
    });
  }

  /* ------------------------------------------------------------------ app */
  OS.registerApp({
    id: 'messages',
    name: 'Messages',
    icon: {
      bg: 'linear-gradient(180deg,#5BF675,#0CBD2A)',
      glyph: `<svg viewBox="0 0 60 60"><ellipse cx="30" cy="28.5" rx="20.5" ry="16.8" fill="#fff"/><path d="M17.2 39.5c.4 3.5-.9 6.7-3.4 9.2-.4.4-.1 1.1.5 1 4.7-.3 8.8-2.5 11.5-5.9z" fill="#fff"/></svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',

    launch(ctx) {
      load();
      UI = { ctx, nav: null, navHost: null, listPage: null, listWrap: null, selBar: null, query: '', editing: false, picked: new Set(), swipe: null, convo: null, tapOv: null, timers: new Set(), active: true, onMinute: null, onKb: null };
      UI.navHost = el('<div class="mg-navhost"></div>'); ctx.root.appendChild(UI.navHost);
      UI.nav = OS.ui.createNav(UI.navHost, { tabBarInset: false });
      pushList();
      UI.onMinute = () => { if (UI && !UI.swipe && !UI.editing) renderList(); };
      UI.onKb = () => { const C = UI && UI.convo; if (!C || !C.atBottom) return; toBottom(); later(toBottom, 60); later(toBottom, 360); };
      OS.on('minute', UI.onMinute); OS.on('keyboard', UI.onKb);
      updateBadge();
    },

    onResume(ctx, params) {
      if (!UI) return;
      UI.active = true;
      if (params && (params.to != null && params.to !== '')) {
        const th = threadByTo(params.to, true);
        if (th) openConvo(th, { instant: !UI.convo, body: params.body || '', focus: !th.msgs.length || !!params.body });
      } else if (params && params.body) { openCompose({ body: params.body }); }
      else if (params && params.compose) openCompose({});
      if (UI.convo) { markRead(UI.convo.th); renderMsgs(); }
      renderList();
    },

    onPause() {
      if (!UI) return;
      UI.active = false; closeTapback(true);
      if (UI.convo) { UI.convo.th.draft = UI.convo.ta.value; if (load().includes(UI.convo.th)) save(); UI.convo.ta.blur(); }
      if (UI.swipe) UI.swipe.close();
    },

    onClose() {
      if (!UI) return;
      if (UI.convo) { clearTimeout(UI.convo.draftT); UI.convo.th.draft = UI.convo.ta.value; if (UI.convo.ro) UI.convo.ro.disconnect(); if (load().includes(UI.convo.th)) save(); }
      if (UI.onMinute) OS.off('minute', UI.onMinute);
      if (UI.onKb) OS.off('keyboard', UI.onKb);
      UI.timers.forEach((t) => clearTimeout(t)); UI.timers.clear();
      UI = null;
      // pending contact replies are intentionally left running: like a real phone, the reply arrives as a notification.
    },
  });

  /* ------------------------------------------------------------------ page-level: badge + one unprompted text per page load */
  setTimeout(() => { try { load(); updateBadge(); } catch (e) { console.warn('[messages] init', e); } }, 0);
  setTimeout(() => {
    try {
      const friend = ['Bailey Chen', 'Dylan Brooks', 'Alex Rivera'].map(byName).filter(Boolean)[0]; if (!friend) return;
      const lines = { 'bailey chen': ['are you doing the game jam this weekend?? we should team up ✨', 'I just shared a project and it has your sprite in it 😄 go look!!'], 'dylan brooks': ['yo did you see what happened at lunch 💀', 'bro you HAVE to see this video i found'], 'alex rivera': ['get on!! i found diamonds', 'bro are you coming over saturday'] };
      OS.messages.receive(friend.id, pick(lines[OS.contacts.name(friend).toLowerCase()] || ['hey! you around?']));
    } catch (e) { console.warn('[messages] unprompted text', e); }
  }, 125000 + Math.random() * 40000);
})();
