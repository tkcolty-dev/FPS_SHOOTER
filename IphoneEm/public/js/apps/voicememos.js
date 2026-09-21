/* Voice Memos — real microphone recording (getUserMedia + MediaRecorder), live scrolling waveform,
   expandable recordings list with waveform scrubber, Dynamic Island live activity while recording
   in the background. Recordings live in OS.db 'recordings'. */
(function () {
  'use strict';

  const ID = 'voicememos';
  const ISLAND_ID = 'voicememos-rec';
  const SEED_KEY = 'voicememos.seeded';
  const BAR_MS = 50;          // one live waveform bar per 50ms
  const BAR_STEP = 3;         // px between bars (2px bar + 1px gap)
  const BAR_W = 2;
  const MAX_PEAKS = 200;
  const PANEL_IDLE_H = 130;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  /* ───────────────────────── icons ───────────────────────── */
  const APP_ICON = (function () {
    const hs = [5, 9, 15, 8, 21, 30, 13, 37, 19, 27, 11, 17, 7, 11, 5];
    const step = 3.3, n = hs.length, x0 = 30 - ((n - 1) * step) / 2;
    const bars = hs.map((h, i) => {
      const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);      // 0 centre → 1 edge
      const t = clamp((d - 0.22) / 0.5, 0, 1);                  // red centre fading to white
      const r = 255, g = Math.round(59 + (255 - 59) * t), b = Math.round(48 + (255 - 48) * t);
      return `<rect x="${(x0 + i * step - 1).toFixed(2)}" y="${(30 - h / 2).toFixed(2)}" width="2" height="${h}" rx="1" fill="rgb(${r},${g},${b})"/>`;
    }).join('');
    return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
  })();

  const IC = {
    play: '<svg viewBox="0 0 28 28"><path d="M8.5 4.9c0-1 1.1-1.6 2-1.1l14 8.1c.9.5.9 1.7 0 2.2l-14 8.1c-.9.5-2-.1-2-1.1z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 28 28"><rect x="6.5" y="4.5" width="5.2" height="19" rx="1.4" fill="currentColor"/><rect x="16.3" y="4.5" width="5.2" height="19" rx="1.4" fill="currentColor"/></svg>',
    back15: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5.5a9 9 0 1 1-8.2 5.3"/><path d="M14.6 2.1 10.9 5.5l3.7 3.4"/><text x="14" y="17.6" text-anchor="middle" font-size="8.2" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,-apple-system,system-ui,sans-serif">15</text></svg>',
    fwd15: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(28 0) scale(-1 1)"><path d="M14 5.5a9 9 0 1 1-8.2 5.3"/><path d="M14.6 2.1 10.9 5.5l3.7 3.4"/></g><text x="14" y="17.6" text-anchor="middle" font-size="8.2" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,-apple-system,system-ui,sans-serif">15</text></svg>',
    trash: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 7.5h17M11 7.2V5.6c0-.9.7-1.6 1.6-1.6h2.8c.9 0 1.6.7 1.6 1.6v1.6M7.5 7.5l1 14.2c.1 1.3 1.1 2.3 2.4 2.3h6.2c1.3 0 2.3-1 2.4-2.3l1-14.2M11.6 11.5l.4 8M16.4 11.5l-.4 8"/></svg>',
    more: '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="10.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9.3" cy="14" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/><circle cx="18.7" cy="14" r="1.5" fill="currentColor"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19z"/><path d="M14.5 6l3.5 3.5"/></svg>',
    dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.500 4h-7A2.500 2.500 0 0 0 4 6.500v7A2.500 2.500 0 0 0 6.500 16H8"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.500 7.500A2.500 2.500 0 0 1 6 5h3.200c.6 0 1.200.3 1.600.8l.9 1.200h6.300a2.500 2.500 0 0 1 2.500 2.500v7A2.500 2.500 0 0 1 18 19H6a2.500 2.500 0 0 1-2.500-2.500z"/></svg>',
    trashSm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.500 6.500h15M9.500 6.200V5a1.500 1.500 0 0 1 1.500-1.500h2A1.500 1.500 0 0 1 14.500 5v1.200M6.500 6.500l.8 12a2 2 0 0 0 2 1.900h5.400a2 2 0 0 0 2-1.900l.8-12"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9.500V6a3 3 0 0 1 6 0v5.500M15 14a3 3 0 0 1-5.600.8M6 11.500a6 6 0 0 0 9.700 4.700M18 11.500c0 .9-.2 1.700-.5 2.500M12 17.500V21M4 3.500l16 17"/></svg>',
    wave: '<svg viewBox="0 0 64 40" fill="currentColor"><rect x="2" y="16" width="4" height="8" rx="2"/><rect x="11" y="10" width="4" height="20" rx="2"/><rect x="20" y="3" width="4" height="34" rx="2"/><rect x="29" y="12" width="4" height="16" rx="2"/><rect x="38" y="6" width="4" height="28" rx="2"/><rect x="47" y="13" width="4" height="14" rx="2"/><rect x="56" y="17" width="4" height="6" rx="2"/></svg>',
    resume: '<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="7" fill="currentColor"/></svg>',
  };

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle(ID, `
    .app-voicememos { --vm-panel: #F2F2F7; --vm-ring: rgba(60,60,67,.34); --vm-ease: cubic-bezier(.32,.72,0,1);
      background: var(--bg); color: var(--label); user-select: none; -webkit-user-select: none; }
    #screen[data-theme="dark"] .app-voicememos { --vm-panel: #1C1C1E; --vm-ring: #fff; }
    .app-voicememos button { font: inherit; color: inherit; border: 0; background: none; padding: 0; margin: 0; cursor: pointer; }

    /* top bar */
    .app-voicememos .vm-top { position: absolute; left: 0; right: 0; top: 0; height: calc(var(--safe-top) + 44px); z-index: 5; }
    .app-voicememos .vm-top::before { content: ''; position: absolute; inset: 0; background: var(--bar);
      backdrop-filter: var(--blur, blur(20px) saturate(1.8)); -webkit-backdrop-filter: var(--blur, blur(20px) saturate(1.8));
      box-shadow: 0 .5px 0 var(--sep); opacity: 0; transition: opacity .2s; }
    .app-voicememos .vm-top.solid::before { opacity: 1; }
    .app-voicememos .vm-top-row { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; justify-content: center; }
    .app-voicememos .vm-top-title { font-size: 17px; font-weight: 600; letter-spacing: -.4px; opacity: 0; transform: translateY(4px); transition: opacity .2s, transform .25s var(--vm-ease); }
    .app-voicememos .vm-top.solid .vm-top-title { opacity: 1; transform: none; }
    .app-voicememos .vm-edit { position: absolute; right: 16px; top: 0; height: 44px; font-size: 17px; letter-spacing: -.4px; color: var(--tint); transition: opacity .15s; }
    .app-voicememos .vm-edit:active { opacity: .4; }
    .app-voicememos .vm-edit.bold { font-weight: 600; }
    .app-voicememos .vm-edit[disabled] { color: var(--label3); pointer-events: none; }

    /* list */
    .app-voicememos .vm-scroll { position: absolute; inset: 0; padding-top: calc(var(--safe-top) + 44px); padding-bottom: ${PANEL_IDLE_H + 24}px; }
    .app-voicememos .vm-large { font-size: 34px; font-weight: 700; letter-spacing: .37px; line-height: 41px; margin: 0; padding: 3px 16px 8px; }
    .app-voicememos .vm-search { margin: 0 16px 10px; }
    .app-voicememos .vm-row { position: relative; overflow: hidden; transition: height .32s var(--vm-ease), opacity .28s ease, background-color .2s; }
    .app-voicememos .vm-row::after { content: ''; position: absolute; left: 16px; right: 0; bottom: 0; height: .5px; background: var(--sep); transition: left .3s var(--vm-ease); }
    .app-voicememos.editing .vm-row::after { left: 50px; }
    .app-voicememos .vm-row-head { display: flex; align-items: center; min-height: 64px; padding: 10px 16px; cursor: pointer; }
    .app-voicememos .vm-row:not(.open) .vm-row-head:active { background: var(--fill2); }
    .app-voicememos .vm-check { flex: none; width: 0; margin-right: 0; opacity: 0; overflow: hidden; transition: width .3s var(--vm-ease), margin .3s var(--vm-ease), opacity .25s; }
    .app-voicememos.editing .vm-check { width: 22px; margin-right: 12px; opacity: 1; }
    .app-voicememos .vm-check i { display: block; width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--label3); }
    .app-voicememos .vm-row.sel .vm-check i { border-color: var(--tint);
      background: var(--tint) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath d='M6 11.500l3.300 3.300L16 8' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/22px no-repeat; }
    .app-voicememos .vm-row-main { flex: 1; min-width: 0; }
    .app-voicememos .vm-title { font-size: 17px; font-weight: 600; letter-spacing: -.4px; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-voicememos .vm-row.open .vm-title { cursor: text; }
    .app-voicememos .vm-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 2px; font-size: 15px; letter-spacing: -.2px; line-height: 20px; color: var(--label2); font-variant-numeric: tabular-nums; }
    .app-voicememos .vm-detail { height: 0; opacity: 0; overflow: hidden; transition: height .36s var(--vm-ease), opacity .24s ease; }
    .app-voicememos .vm-row.open .vm-detail { height: 144px; opacity: 1; }
    .app-voicememos .vm-row.noanim, .app-voicememos .vm-row.noanim .vm-detail { transition: none; }
    .app-voicememos .vm-wave { display: block; margin: 4px 16px 0; width: 370px; height: 54px; cursor: pointer; touch-action: none; }
    .app-voicememos .vm-times { display: flex; justify-content: space-between; margin: 4px 16px 0; font-size: 12px; letter-spacing: 0; color: var(--label2); font-variant-numeric: tabular-nums; }
    .app-voicememos .vm-ctrls { display: flex; align-items: center; justify-content: space-between; height: 58px; padding: 0 14px; margin-top: 2px; }
    .app-voicememos .vm-ctrls button { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--label); transition: opacity .15s, transform .2s var(--vm-ease), background-color .2s; }
    .app-voicememos .vm-ctrls button:active { opacity: .45; transform: scale(.9); }
    .app-voicememos .vm-ctrls button svg { width: 28px; height: 28px; }
    .app-voicememos .vm-ctrls .vm-tint { color: var(--tint); }
    .app-voicememos .vm-ctrls .vm-play { width: 52px; height: 52px; }
    .app-voicememos .vm-ctrls .vm-play svg { width: 36px; height: 36px; }
    .app-voicememos .vm-transport { display: flex; align-items: center; gap: 22px; }

    /* empty / no-results / mic card */
    .app-voicememos .vm-empty { display: none; flex-direction: column; align-items: center; text-align: center; padding: 120px 40px 0; color: var(--label2); }
    .app-voicememos .vm-empty.show { display: flex; }
    .app-voicememos .vm-empty svg { width: 64px; height: 40px; color: var(--label3); margin-bottom: 18px; }
    .app-voicememos .vm-empty b { font-size: 22px; font-weight: 700; letter-spacing: .35px; color: var(--label); margin-bottom: 6px; }
    .app-voicememos .vm-empty span { font-size: 15px; letter-spacing: -.2px; line-height: 20px; }
    .app-voicememos .vm-miccard { display: none; gap: 12px; margin: 2px 16px 14px; padding: 14px; border-radius: 14px; background: var(--cell2); }
    .app-voicememos .vm-miccard.show { display: flex; animation: vm-card-in .4s var(--vm-ease); }
    .app-voicememos .vm-mic-ic { flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--red); display: flex; align-items: center; justify-content: center; }
    .app-voicememos .vm-mic-ic svg { width: 22px; height: 22px; }
    .app-voicememos .vm-mic-t { font-size: 15px; font-weight: 600; letter-spacing: -.2px; line-height: 20px; }
    .app-voicememos .vm-mic-d { font-size: 13px; letter-spacing: -.1px; line-height: 18px; color: var(--label2); margin: 2px 0 10px; }
    .app-voicememos .vm-mic-btns { display: flex; gap: 8px; }
    .app-voicememos .vm-mic-btn { height: 30px; padding: 0 14px; border-radius: 15px; background: var(--tint); color: #fff; font-size: 15px; font-weight: 600; letter-spacing: -.2px; }
    .app-voicememos .vm-mic-btn.plain { background: var(--fill); color: var(--tint); }
    .app-voicememos .vm-mic-btn:active { opacity: .6; }
    @keyframes vm-card-in { from { opacity: 0; transform: translateY(-8px) scale(.97); } to { opacity: 1; transform: none; } }

    /* dim behind the recording panel */
    .app-voicememos .vm-dim { position: absolute; inset: 0; z-index: 7; background: rgba(0,0,0,.22); opacity: 0; pointer-events: none; transition: opacity .35s ease; }
    #screen[data-theme="dark"] .app-voicememos .vm-dim { background: rgba(0,0,0,.5); }
    .app-voicememos.recording .vm-dim { opacity: 1; pointer-events: auto; }

    /* record panel */
    .app-voicememos .vm-panel { position: absolute; left: 0; right: 0; bottom: 0; height: ${PANEL_IDLE_H}px; z-index: 8; overflow: hidden;
      background: var(--vm-panel); border-radius: 14px 14px 0 0; box-shadow: 0 -.5px 0 var(--sep), 0 -8px 30px rgba(0,0,0,.06);
      transition: height .42s var(--vm-ease), transform .42s var(--vm-ease); }
    .app-voicememos .vm-panel.rec { height: 408px; }
    .app-voicememos.editing .vm-panel { transform: translateY(105%); }
    .app-voicememos .vm-grab { position: absolute; left: 50%; top: 6px; width: 36px; height: 5px; margin-left: -18px; border-radius: 3px; background: var(--label3); opacity: 0; transition: opacity .3s; }
    .app-voicememos .vm-panel.rec .vm-grab { opacity: 1; }
    .app-voicememos .vm-rec-info { position: absolute; left: 0; right: 0; top: 0; padding-top: 26px; text-align: center; opacity: 0; transform: translateY(16px); pointer-events: none;
      transition: opacity .2s ease, transform .42s var(--vm-ease); }
    .app-voicememos .vm-panel.rec .vm-rec-info { opacity: 1; transform: none; transition: opacity .3s ease .08s, transform .42s var(--vm-ease); }
    .app-voicememos .vm-rec-name { font-size: 22px; font-weight: 700; letter-spacing: .35px; line-height: 28px; padding: 0 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-voicememos .vm-rec-state { font-size: 13px; letter-spacing: -.1px; line-height: 18px; color: var(--label2); margin-top: 1px; }
    .app-voicememos .vm-rec-state.live { color: var(--red); }
    .app-voicememos .vm-live { display: block; width: 402px; height: 124px; margin-top: 8px; }
    .app-voicememos .vm-rec-time { font-size: 44px; font-weight: 300; letter-spacing: .4px; line-height: 52px; margin-top: 6px; font-variant-numeric: tabular-nums; transition: opacity .2s; }
    .app-voicememos .vm-panel.paused .vm-rec-time { animation: vm-blink 1.2s ease-in-out infinite; }
    @keyframes vm-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
    .app-voicememos .vm-rec-ctrls { position: absolute; left: 0; right: 0; bottom: var(--safe-bottom); height: 96px; display: flex; align-items: center; justify-content: center; }
    .app-voicememos .vm-recbtn { position: relative; width: 72px; height: 72px; border-radius: 50%; border: 4px solid var(--vm-ring); display: flex; align-items: center; justify-content: center; transition: transform .2s var(--vm-ease), border-color .2s; }
    .app-voicememos .vm-recbtn i { display: block; width: 58px; height: 58px; border-radius: 29px; background: var(--red); transition: width .3s var(--vm-ease), height .3s var(--vm-ease), border-radius .3s var(--vm-ease), transform .15s ease, opacity .2s; }
    .app-voicememos .vm-recbtn:active i { transform: scale(.9); }
    .app-voicememos .vm-panel.rec .vm-recbtn i { width: 28px; height: 28px; border-radius: 7px; }
    .app-voicememos .vm-panel.busy .vm-recbtn { pointer-events: none; }
    .app-voicememos .vm-panel.busy .vm-recbtn i { opacity: .55; }
    .app-voicememos .vm-side { position: absolute; top: 50%; width: 96px; height: 44px; margin-top: -22px; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none;
      transform: scale(.8); transition: opacity .25s ease, transform .35s var(--vm-ease); }
    .app-voicememos .vm-panel.rec .vm-side { opacity: 1; pointer-events: auto; transform: none; }
    .app-voicememos .vm-panel.busy .vm-side { opacity: .35; pointer-events: none; }
    .app-voicememos .vm-side:active { opacity: .5; }
    .app-voicememos .vm-pause { left: 28px; }
    .app-voicememos .vm-pause span { width: 48px; height: 48px; border-radius: 50%; background: var(--fill); display: flex; align-items: center; justify-content: center; color: var(--label); }
    .app-voicememos .vm-panel.paused .vm-pause span { color: var(--red); }
    .app-voicememos .vm-pause svg { width: 24px; height: 24px; }
    .app-voicememos .vm-done { right: 28px; }
    .app-voicememos .vm-done span { height: 36px; padding: 0 18px; border-radius: 18px; background: var(--fill); color: var(--tint); font-size: 17px; font-weight: 600; letter-spacing: -.4px; display: flex; align-items: center; }

    /* edit toolbar */
    .app-voicememos .vm-editbar { position: absolute; left: 0; right: 0; bottom: 0; height: 83px; padding: 0 16px var(--safe-bottom); z-index: 9; display: flex; align-items: center; justify-content: space-between;
      background: var(--bar); backdrop-filter: var(--blur, blur(20px) saturate(1.8)); -webkit-backdrop-filter: var(--blur, blur(20px) saturate(1.8)); box-shadow: 0 -.5px 0 var(--sep);
      transform: translateY(105%); transition: transform .42s var(--vm-ease); }
    .app-voicememos.editing .vm-editbar { transform: none; }
    .app-voicememos .vm-editbar button { height: 44px; font-size: 17px; letter-spacing: -.4px; color: var(--tint); }
    .app-voicememos .vm-editbar button:active { opacity: .4; }
    .app-voicememos .vm-editbar .vm-del { color: var(--red); font-weight: 600; }
    .app-voicememos .vm-editbar button[disabled] { color: var(--label3); pointer-events: none; }

    /* Dynamic Island snippets live OUTSIDE .app-voicememos → uniquely prefixed, un-scoped */
    .vm-isl-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #FF453A; vertical-align: middle; animation: vm-isl-pulse 1.4s ease-in-out infinite; }
    .vm-isl-dot.paused { animation: none; opacity: .45; }
    .vm-isl-wave { display: inline-flex; align-items: center; gap: 2px; height: 18px; vertical-align: middle; }
    .vm-isl-wave i { display: block; width: 2.5px; border-radius: 2px; background: #FF453A; animation: vm-isl-bar 0.9s ease-in-out infinite; }
    .vm-isl-wave.paused i { animation: none; opacity: .45; }
    .vm-isl-time { font: 600 14px/1 system-ui,-apple-system, system-ui, sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -.2px; color: #FF453A; }
    .vm-isl-time.paused { color: #FF9F0A; }
    .vm-isl-exp { display: flex; align-items: center; gap: 12px; padding: 4px 6px; color: #fff; font-family: system-ui,-apple-system, system-ui, sans-serif; }
    .vm-isl-exp .vm-isl-ic { flex: none; width: 40px; height: 40px; border-radius: 10px; background: #1C1C1E; display: flex; align-items: center; justify-content: center; }
    .vm-isl-exp .vm-isl-tx { flex: 1; min-width: 0; text-align: left; }
    .vm-isl-exp .vm-isl-n { font-size: 15px; font-weight: 600; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vm-isl-exp .vm-isl-s { font-size: 12px; color: rgba(235,235,245,.6); margin-top: 1px; }
    .vm-isl-exp .vm-isl-big { font-size: 26px; font-weight: 300; font-variant-numeric: tabular-nums; color: #FF453A; }
    .vm-isl-exp .vm-isl-big.paused { color: #FF9F0A; }
    @keyframes vm-isl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }
    @keyframes vm-isl-bar { 0%, 100% { transform: scaleY(.45); } 50% { transform: scaleY(1); } }

    @media (prefers-reduced-motion: reduce) {
      .app-voicememos .vm-panel, .app-voicememos .vm-row, .app-voicememos .vm-detail, .app-voicememos .vm-recbtn i { transition-duration: .01s; }
    }
  `);

  /* ───────────────────────── formatting ───────────────────────── */
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec + 0.0001));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000);
    return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
  }
  function fmtDate(ts) {
    const d = new Date(ts), now = new Date();
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.floor((day0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
    if (diffDays <= 0) {
      try { return OS.util.time(d) + (OS.settings.get('use24h') ? '' : ' ' + OS.util.ampm(d)); }
      catch (e) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function extFor(mime) {
    mime = (mime || '').toLowerCase();
    if (mime.includes('wav')) return '.wav';
    if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return '.m4a';
    if (mime.includes('ogg')) return '.ogg';
    return '.webm';
  }

  /* ───────────────────────── waveform helpers ───────────────────────── */
  function resample(peaks, n) {
    const out = new Array(n);
    if (!peaks || !peaks.length) { for (let i = 0; i < n; i++) out[i] = 0.04; return out; }
    const len = peaks.length;
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i * len) / n), b = Math.max(a + 1, Math.ceil(((i + 1) * len) / n));
      let m = 0;
      for (let j = a; j < b && j < len; j++) if (peaks[j] > m) m = peaks[j];
      out[i] = m;
    }
    return out;
  }
  function normalizePeaks(peaks, n) {
    let p = peaks.length > n ? resample(peaks, n) : peaks.slice();
    let max = 0;
    for (let i = 0; i < p.length; i++) if (p[i] > max) max = p[i];
    const k = max > 0.03 ? 0.95 / max : 1;
    return p.map((v) => Math.round(clamp(v * k, 0.02, 1) * 1000) / 1000);
  }
  function fitCanvas(cv, w, h) {
    const dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }
  function roundBar(g, x, y, w, h) {
    const r = Math.min(w / 2, h / 2);
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
    g.fill();
  }

  /* ───────────────────────── sample-audio synthesis (first run) ───────────────────────── */
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noiseBuffer(ctx, seconds, rnd) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    return buf;
  }
  function roomTone(ctx, dur, rnd, level) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2, rnd); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = level;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start(0); src.stop(dur);
  }
  function synthMelody(ctx, dur, rnd) {           // plucked guitar-ish idea, A minor pentatonic
    const out = ctx.createGain(); out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    out.connect(lp); lp.connect(ctx.destination);
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    const steps = [-2, -1, -1, 1, 1, 2, 0];
    function pluck(f, t, decay, vol) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.003;
      const g2 = ctx.createGain(); g2.gain.value = 0.22;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      o.start(t); o2.start(t); o.stop(t + decay + 0.05); o2.stop(t + decay + 0.05);
    }
    let t = 0.7, idx = 4;
    while (t < dur - 1.8) {
      idx = clamp(idx + steps[Math.floor(rnd() * steps.length)], 0, scale.length - 1);
      const long = rnd() < 0.28;
      pluck(scale[idx], t, long ? 1.9 : 1.3, 0.55 + rnd() * 0.3);
      if (rnd() < 0.3) pluck(scale[idx] / 2, t, 2.1, 0.4);
      t += long ? 0.76 : 0.38;
      if (rnd() < 0.12) t += 0.38;
    }
    pluck(220, t, 2.4, 0.7); pluck(329.63, t + 0.03, 2.4, 0.5); pluck(440, t + 0.06, 2.4, 0.45);
    roomTone(ctx, dur, rnd, 0.012);
  }
  function synthVoice(ctx, dur, rnd) {            // mumbling "voice": sawtooth through moving formants
    const out = ctx.createGain(); out.gain.value = 0.7; out.connect(ctx.destination);
    const src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = 118;
    const amp = ctx.createGain(); amp.gain.value = 0;
    src.connect(amp);
    const vowels = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410], [440, 1020, 2240]];
    const bands = [0, 1, 2].map((i) => {
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = [5, 9, 11][i]; b.frequency.value = vowels[0][i];
      const g = ctx.createGain(); g.gain.value = [1, 0.6, 0.28][i];
      amp.connect(b); b.connect(g); g.connect(out);
      return b;
    });
    let t = 0.55;
    while (t < dur - 0.9) {
      const n = 3 + Math.floor(rnd() * 6);
      let pitch = 108 + rnd() * 28;
      for (let k = 0; k < n && t < dur - 0.9; k++) {
        const len = 0.11 + rnd() * 0.2;
        const v = vowels[Math.floor(rnd() * vowels.length)];
        bands.forEach((b, i) => b.frequency.setTargetAtTime(v[i], t, 0.03));
        src.frequency.setTargetAtTime(pitch * (1 + (rnd() - 0.5) * 0.14), t, 0.04);
        amp.gain.setTargetAtTime(0.45 + rnd() * 0.55, t, 0.014);
        amp.gain.setTargetAtTime(0.03, t + len * 0.72, 0.028);
        t += len + 0.03 + rnd() * 0.05;
        pitch *= 0.985;
      }
      amp.gain.setTargetAtTime(0, t, 0.04);
      t += 0.35 + rnd() * 0.75;
    }
    src.start(0); src.stop(dur);
    roomTone(ctx, dur, rnd, 0.02);
  }
  function synthRain(ctx, dur, rnd) {             // rain hiss + rumble + droplets
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuffer(ctx, 4, rnd); hiss.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    const hg = ctx.createGain(); hg.gain.setValueAtTime(0.12, 0);
    for (let t = 0.5; t < dur; t += 0.5 + rnd() * 0.6) hg.gain.linearRampToValueAtTime(0.1 + rnd() * 0.2, t);
    hiss.connect(hp); hp.connect(lp); lp.connect(hg); hg.connect(ctx.destination);
    hiss.start(0); hiss.stop(dur);
    const rum = ctx.createBufferSource(); rum.buffer = noiseBuffer(ctx, 3, rnd); rum.loop = true;
    const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 320;
    const rg = ctx.createGain(); rg.gain.value = 0.22;
    rum.connect(rl); rl.connect(rg); rg.connect(ctx.destination);
    rum.start(0); rum.stop(dur);
    const drops = Math.floor(dur * 3.2);
    for (let i = 0; i < drops; i++) {
      const t = 0.2 + rnd() * (dur - 0.5), f = 800 + rnd() * 1600;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 + rnd() * 0.25, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.09);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.12);
    }
  }
  function renderOffline(ctx) {
    return new Promise((resolve, reject) => {
      ctx.oncomplete = (e) => resolve(e.renderedBuffer);
      let p;
      try { p = ctx.startRendering(); } catch (e) { reject(e); return; }
      if (p && p.then) p.then(resolve, reject);
    });
  }
  function wavBlob(data, sampleRate) {
    const n = data.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = clamp(data[i], -1, 1);
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }
  async function synthSample(def) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = 22050;
    const ctx = new OAC(1, Math.floor(sr * def.dur), sr);
    def.build(ctx, def.dur, prng(def.seed));
    const rendered = await renderOffline(ctx);
    const data = rendered.getChannelData(0);
    let max = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > max) max = a; }
    const k = max > 0 ? def.level / max : 1;
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < data.length; i++) {
      let f = 1;
      if (i < fade) f = i / fade; else if (i > data.length - fade) f = (data.length - i) / fade;
      data[i] *= k * f;
    }
    const raw = [], bucket = Math.max(1, Math.floor(data.length / 180));
    for (let i = 0; i < data.length; i += bucket) {
      let m = 0;
      for (let j = i; j < i + bucket && j < data.length; j++) { const a = Math.abs(data[j]); if (a > m) m = a; }
      raw.push(m);
    }
    return { duration: data.length / sr, peaks: normalizePeaks(raw, MAX_PEAKS), blob: wavBlob(data, sr), mime: 'audio/wav' };
  }

  /* ───────────────────────── app state ───────────────────────── */
  let S = null;   // per-process state, rebuilt in launch()

  function isDark() {
    const scr = S.root.closest('[data-theme]');
    if (scr) return scr.getAttribute('data-theme') === 'dark';
    try { return !!OS.settings.get('darkMode'); } catch (e) { return false; }
  }
  function readColors() {
    const cs = getComputedStyle(S.root), dark = isDark();
    const v = (n, fb) => (cs.getPropertyValue(n) || '').trim() || fb;
    S.colors = {
      label: v('--label', dark ? '#fff' : '#000'),
      label2: v('--label2', dark ? 'rgba(235,235,245,.6)' : 'rgba(60,60,67,.6)'),
      label3: v('--label3', dark ? 'rgba(235,235,245,.3)' : 'rgba(60,60,67,.3)'),
      tint: v('--tint', dark ? '#0A84FF' : '#007AFF'),
      red: v('--red', dark ? '#FF453A' : '#FF3B30'),
      sep: v('--sep', dark ? 'rgba(84,84,88,.65)' : 'rgba(60,60,67,.29)'),
    };
  }
  function mediaVolume() {
    let v;
    try { v = OS.settings.get('volume'); } catch (e) {}
    return typeof v === 'number' && isFinite(v) ? clamp(v, 0, 1) : 1;
  }
  const isRecordingState = (s) => s.recState === 'starting' || s.recState === 'recording' || s.recState === 'paused' || s.recState === 'stopping';

  /* ───────────────────────── build UI ───────────────────────── */
  function build(ctx) {
    const root = ctx.root;
    root.innerHTML = `
      <div class="vm-scroll ios-scroll">
        <h1 class="vm-large ios-large-title">All Recordings</h1>
        <div class="vm-search ios-search"><input type="text" placeholder="Search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <div class="vm-miccard">
          <div class="vm-mic-ic">${IC.micOff}</div>
          <div>
            <div class="vm-mic-t">Microphone Access Needed</div>
            <div class="vm-mic-d"></div>
            <div class="vm-mic-btns"><button class="vm-mic-btn vm-mic-retry">Try Again</button><button class="vm-mic-btn plain vm-mic-dismiss">Not Now</button></div>
          </div>
        </div>
        <div class="vm-list"></div>
        <div class="vm-empty">${IC.wave}<b></b><span></span></div>
      </div>
      <div class="vm-top"><div class="vm-top-row"><div class="vm-top-title">All Recordings</div><button class="vm-edit">Edit</button></div></div>
      <div class="vm-dim"></div>
      <div class="vm-panel">
        <div class="vm-grab"></div>
        <div class="vm-rec-info">
          <div class="vm-rec-name">New Recording</div>
          <div class="vm-rec-state">Recording</div>
          <canvas class="vm-live"></canvas>
          <div class="vm-rec-time">00:00.00</div>
        </div>
        <div class="vm-rec-ctrls">
          <button class="vm-side vm-pause" aria-label="Pause"><span>${IC.pause}</span></button>
          <button class="vm-recbtn" aria-label="Record"><i></i></button>
          <button class="vm-side vm-done"><span>Done</span></button>
        </div>
      </div>
      <div class="vm-editbar"><button class="vm-selall">Select All</button><button class="vm-del" disabled>Delete</button></div>
    `;
    const $ = (sel) => root.querySelector(sel);
    const s = S;
    s.el = {
      scroll: $('.vm-scroll'), top: $('.vm-top'), edit: $('.vm-edit'), search: $('.vm-search input'), list: $('.vm-list'),
      empty: $('.vm-empty'), micCard: $('.vm-miccard'), micText: $('.vm-mic-d'), panel: $('.vm-panel'), recName: $('.vm-rec-name'),
      recState: $('.vm-rec-state'), recTime: $('.vm-rec-time'), live: $('.vm-live'), recBtn: $('.vm-recbtn'), pauseBtn: $('.vm-pause'),
      doneBtn: $('.vm-done'), selAll: $('.vm-selall'), del: $('.vm-del'),
    };
    s.live = { g: fitCanvas(s.el.live, 402, 124), w: 402, h: 124 };

    s.el.scroll.addEventListener('scroll', () => s.el.top.classList.toggle('solid', s.el.scroll.scrollTop > 38));
    s.el.search.addEventListener('input', () => { s.query = s.el.search.value; collapseRow(); renderList(); });
    s.el.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') s.el.search.blur(); });
    s.el.edit.addEventListener('click', () => setEditing(!s.editing));
    s.el.recBtn.addEventListener('click', () => {
      if (s.recState === 'idle') startRecording();
      else if (s.recState === 'recording' || s.recState === 'paused') stopRecording(true);
    });
    s.el.doneBtn.addEventListener('click', () => stopRecording(true));
    s.el.pauseBtn.addEventListener('click', togglePauseRecording);
    $('.vm-mic-retry').addEventListener('click', () => startRecording());
    $('.vm-mic-dismiss').addEventListener('click', () => s.el.micCard.classList.remove('show'));
    s.el.selAll.addEventListener('click', () => {
      const vis = visibleRecs();
      const all = vis.length && vis.every((r) => s.selected.has(r.id));
      vis.forEach((r) => (all ? s.selected.delete(r.id) : s.selected.add(r.id)));
      try { OS.haptic('selection'); } catch (e) {}
      syncSelection();
    });
    s.el.del.addEventListener('click', deleteSelected);
  }

  /* ───────────────────────── list ───────────────────────── */
  function visibleRecs() {
    const q = (S.query || '').trim().toLowerCase();
    return S.recs.filter((r) => !q || String(r.name || '').toLowerCase().includes(q));
  }

  function renderList() {
    const s = S;
    if (!s || s.closed) return;
    const items = visibleRecs();
    s.rows.clear();
    s.el.list.innerHTML = '';
    items.forEach((rec) => s.el.list.appendChild(buildRow(rec)));
    const none = !items.length;
    s.el.empty.classList.toggle('show', none && s.loaded);
    if (none) {
      const searching = !!(s.query || '').trim();
      s.el.empty.querySelector('b').textContent = searching ? 'No Results' : 'No Recordings';
      s.el.empty.querySelector('span').textContent = searching
        ? `No recordings match “${s.query.trim()}”.`
        : 'Tap the Record button to start a Voice Memo.';
    }
    s.el.edit.disabled = !s.recs.length && !s.editing;
    if (s.openId != null) {
      const row = s.rows.get(s.openId);
      if (row) { row.classList.add('noanim', 'open'); attachOpenRow(s.current, row); void row.offsetHeight; row.classList.remove('noanim'); }
      else collapseRow();
    }
    syncSelection();
  }

  function buildRow(rec) {
    const s = S, esc = OS.util.esc;
    const row = OS.util.el(`
      <div class="vm-row">
        <div class="vm-row-head">
          <div class="vm-check"><i></i></div>
          <div class="vm-row-main">
            <div class="vm-title">${esc(rec.name || 'Recording')}</div>
            <div class="vm-meta"><span>${esc(fmtDate(rec.date))}</span><span>${fmtDur(rec.duration || 0)}</span></div>
          </div>
        </div>
        <div class="vm-detail">
          <canvas class="vm-wave"></canvas>
          <div class="vm-times"><span class="vm-t-el">0:00</span><span class="vm-t-rem">-${fmtDur(rec.duration || 0)}</span></div>
          <div class="vm-ctrls">
            <button class="vm-tint vm-more" aria-label="More">${IC.more}</button>
            <div class="vm-transport">
              <button class="vm-b15" aria-label="Back 15 seconds">${IC.back15}</button>
              <button class="vm-play" aria-label="Play">${IC.play}</button>
              <button class="vm-f15" aria-label="Forward 15 seconds">${IC.fwd15}</button>
            </div>
            <button class="vm-tint vm-trash" aria-label="Delete">${IC.trash}</button>
          </div>
        </div>
      </div>`);
    s.rows.set(rec.id, row);
    const head = row.querySelector('.vm-row-head');
    head.addEventListener('click', (e) => {
      if (Date.now() - s.longPressAt < 600) return;
      if (s.editing) {
        if (s.selected.has(rec.id)) s.selected.delete(rec.id); else s.selected.add(rec.id);
        try { OS.haptic('selection'); } catch (err) {}
        syncSelection();
        return;
      }
      if (s.openId === rec.id && e.target.closest('.vm-title')) { renameRec(rec); return; }
      toggleRow(rec);
    });
    try {
      OS.util.longPress(head, () => {
        if (s.editing || s.recState !== 'idle') return;
        s.longPressAt = Date.now();
        openMenu(rec, head);
      });
    } catch (e) {}
    row.querySelector('.vm-play').addEventListener('click', () => togglePlay());
    row.querySelector('.vm-b15').addEventListener('click', () => seekTo(s.pos - 15));
    row.querySelector('.vm-f15').addEventListener('click', () => seekTo(s.pos + 15));
    row.querySelector('.vm-trash').addEventListener('click', () => confirmDelete([rec]));
    const more = row.querySelector('.vm-more');
    more.addEventListener('click', () => openMenu(rec, more));
    return row;
  }

  function toggleRow(rec) {
    const s = S;
    if (s.openId === rec.id) { collapseRow(); return; }
    collapseRow();
    const row = s.rows.get(rec.id);
    if (!row) return;
    s.openId = rec.id; s.current = rec; s.pos = 0;
    row.classList.add('open');
    attachOpenRow(rec, row);
    s.ready = loadAudio(rec);
    // keep the expanded row clear of the record panel
    setTimeout(() => {
      if (!S || S !== s || s.openId !== rec.id) return;
      const sc = s.el.scroll, bottom = row.offsetTop + 64 + 144 + 12;
      const visibleBottom = sc.scrollTop + sc.clientHeight - PANEL_IDLE_H;
      if (bottom > visibleBottom) { try { sc.scrollTo({ top: sc.scrollTop + (bottom - visibleBottom), behavior: 'smooth' }); } catch (e) { sc.scrollTop += bottom - visibleBottom; } }
    }, 60);
  }

  function attachOpenRow(rec, row) {
    const s = S, cv = row.querySelector('.vm-wave');
    const w = 370, h = 54;
    s.open = {
      row, cv, g: fitCanvas(cv, w, h), w, h,
      bars: resample(rec.peaks, Math.floor(w / BAR_STEP)),
      play: row.querySelector('.vm-play'), tEl: row.querySelector('.vm-t-el'), tRem: row.querySelector('.vm-t-rem'), icon: null,
    };
    if (!cv._vmBound) {
      cv._vmBound = true;
      let st = null;
      const fracAt = (x) => {
        const r = cv.getBoundingClientRect(), rr = s.root.getBoundingClientRect();
        const scale = (rr.width / (s.root.offsetWidth || 402)) || 1;
        return clamp((x - (r.left - rr.left) / scale) / w, 0, 1);
      };
      OS.util.drag(cv, {
        onStart(p, e) {
          if (e && e.stopPropagation) e.stopPropagation();
          if (s.openId !== rec.id) { st = null; return; }
          st = { x0: p.x, f0: fracAt(p.x) };
          s.scrubbing = true;
          seekTo(st.f0 * (rec.duration || 0));
        },
        onMove(p) { if (st) seekTo(clamp(st.f0 + (p.x - st.x0) / w, 0, 1) * (rec.duration || 0)); },
        onEnd() { st = null; s.scrubbing = false; },
      });
      cv.addEventListener('click', (e) => {
        if (s.openId !== rec.id) return;
        let pt = null;
        try { pt = OS.util.screenPoint(e); } catch (err) {}
        if (pt) seekTo(fracAt(pt.x) * (rec.duration || 0));
      });
    }
    updatePlayUI();
  }

  function collapseRow() {
    const s = S;
    if (!s) return;
    pausePlayback();
    if (s.openId != null) {
      const row = s.rows.get(s.openId);
      if (row) row.classList.remove('open');
    }
    s.openId = null; s.current = null; s.open = null; s.pos = 0; s.scrubbing = false;
    s.loadTok++;
    releaseAudio(s);
  }

  function drawScrub() {
    const s = S, o = s && s.open, rec = s && s.current;
    if (!o || !rec) return;
    const { g, w, h, bars } = o, c = s.colors;
    const frac = rec.duration > 0 ? clamp(s.pos / rec.duration, 0, 1) : 0;
    const px = frac * w, mid = h / 2 + 3, maxH = h - 12;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < bars.length; i++) {
      const x = i * BAR_STEP + 0.5, bh = Math.max(2, bars[i] * maxH);
      g.fillStyle = x + BAR_W / 2 <= px ? c.label : c.label3;
      roundBar(g, x, mid - bh / 2, BAR_W, bh);
    }
    const lx = clamp(px, 1, w - 1);
    g.fillStyle = c.tint;
    g.fillRect(lx - 0.75, 5, 1.5, h - 5);
    g.beginPath(); g.arc(lx, 4.5, 3.5, 0, Math.PI * 2); g.fill();
  }

  function updatePlayUI() {
    const s = S, o = s && s.open, rec = s && s.current;
    if (!o || !rec) return;
    const icon = s.playing ? 'pause' : 'play';
    if (o.icon !== icon) { o.icon = icon; o.play.innerHTML = IC[icon]; o.play.setAttribute('aria-label', s.playing ? 'Pause' : 'Play'); }
    const dur = rec.duration || 0;
    o.tEl.textContent = fmtDur(s.pos);
    o.tRem.textContent = '-' + fmtDur(Math.max(0, dur - s.pos));
    drawScrub();
  }

  /* ───────────────────────── playback ───────────────────────── */
  function releaseAudio(s) {
    const a = s.audio;
    try { a.pause(); } catch (e) {}
    if (s.url) {
      try { a.removeAttribute('src'); a.load(); } catch (e) {}
      try { URL.revokeObjectURL(s.url); } catch (e) {}
      s.url = null;
    }
  }

  function loadAudio(rec) {
    const s = S, a = s.audio, tok = s.loadTok;
    releaseAudio(s);
    return new Promise((resolve) => {
      let src = null;
      if (rec.blob instanceof Blob) { s.url = URL.createObjectURL(rec.blob); src = s.url; }
      else if (typeof rec.blob === 'string') src = rec.blob;
      else if (typeof rec.src === 'string') src = rec.src;
      if (!src) { resolve(false); return; }
      let done = false;
      const timers = [];
      const finish = (ok) => {
        if (done) return; done = true;
        timers.forEach(clearTimeout);
        a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('error', onErr); a.removeEventListener('durationchange', onFix);
        resolve(ok && tok === s.loadTok);
      };
      // MediaRecorder WebM blobs report duration = Infinity until the file has been walked once.
      const onFix = () => {
        if (isFinite(a.duration) && a.duration > 0) { try { a.currentTime = 0; } catch (e) {} finish(true); }
      };
      const onMeta = () => {
        if (tok !== s.loadTok) { finish(false); return; }
        if (!isFinite(a.duration)) {
          a.addEventListener('durationchange', onFix);
          try { a.currentTime = 1e101; } catch (e) { finish(true); return; }
          timers.push(setTimeout(() => { try { a.currentTime = 0; } catch (e) {} finish(true); }, 1500));
        } else finish(true);
      };
      const onErr = () => finish(false);
      a.addEventListener('loadedmetadata', onMeta);
      a.addEventListener('error', onErr);
      timers.push(setTimeout(() => finish(a.readyState >= 1), 4000));
      a.preload = 'auto';
      a.volume = mediaVolume();
      a.src = src;
      try { a.load(); } catch (e) {}
    });
  }

  async function togglePlay() {
    const s = S, rec = s.current;
    if (!rec || s.recState !== 'idle' || s.playBusy) return;
    if (s.playing) { pausePlayback(); return; }
    s.playBusy = true;
    const tok = s.loadTok;
    let ok = false;
    try { ok = await s.ready; } catch (e) {}
    if (s.closed || tok !== s.loadTok || s.current !== rec) { s.playBusy = false; return; }
    if (!ok) { s.playBusy = false; try { OS.ui.toast('Unable to Play Recording'); } catch (e) {} return; }
    if (s.pos >= (rec.duration || 0) - 0.05) s.pos = 0;
    try { s.audio.currentTime = s.pos; } catch (e) {}
    s.audio.volume = mediaVolume();
    try { await s.audio.play(); }
    catch (e) { s.playBusy = false; if (!s.closed) { try { OS.ui.toast('Unable to Play Recording'); } catch (err) {} } return; }
    s.playBusy = false;
    if (s.closed || tok !== s.loadTok || !s.active || s.recState !== 'idle') { try { s.audio.pause(); } catch (e) {} return; }
    s.playing = true;
    updatePlayUI();
    startPlayLoop();
  }

  function pausePlayback() {
    const s = S;
    if (!s) return;
    if (s.playRaf) { cancelAnimationFrame(s.playRaf); s.playRaf = 0; }
    try { s.audio.pause(); } catch (e) {}
    if (s.playing) { s.playing = false; updatePlayUI(); }
  }

  function startPlayLoop() {
    const s = S;
    if (s.playRaf) cancelAnimationFrame(s.playRaf);
    const loop = () => {
      s.playRaf = 0;
      if (s.closed || !s.playing || !s.active || !s.current) return;
      if (!s.scrubbing) {
        const dur = s.current.duration || 0;
        s.pos = clamp(s.audio.currentTime || 0, 0, dur);
      }
      updatePlayUI();
      s.playRaf = requestAnimationFrame(loop);
    };
    s.playRaf = requestAnimationFrame(loop);
  }

  function onAudioEnded() {
    const s = S;
    if (!s || s.closed) return;
    if (s.playRaf) { cancelAnimationFrame(s.playRaf); s.playRaf = 0; }
    s.playing = false; s.pos = 0;
    updatePlayUI();
  }

  function seekTo(t) {
    const s = S, rec = s.current;
    if (!rec) return;
    const dur = rec.duration || 0;
    s.pos = clamp(t, 0, dur);
    if (s.url || s.audio.currentSrc) {
      // keep a hair before the very end so a seek never silently triggers 'ended' mid-scrub
      try { s.audio.currentTime = Math.min(s.pos, Math.max(0, dur - 0.02)); } catch (e) {}
    }
    updatePlayUI();
  }

  /* ───────────────────────── rename / duplicate / files / delete ───────────────────────── */
  async function saveRec(rec) {
    try { const id = await OS.db.put('recordings', rec); if (rec.id == null && id != null) rec.id = id; }
    catch (e) { try { OS.ui.toast('Could Not Save'); } catch (err) {} }
  }

  async function renameRec(rec) {
    const s = S;
    let name = null;
    try { name = await OS.ui.prompt({ title: 'Rename Recording', message: 'Enter a new name for this recording.', placeholder: 'Name', value: rec.name, okLabel: 'Save' }); } catch (e) {}
    if (s.closed || name == null) return;
    name = String(name).trim();
    if (!name || name === rec.name) return;
    rec.name = name;
    await saveRec(rec);
    if (s.closed) return;
    const row = s.rows.get(rec.id);
    if (row) row.querySelector('.vm-title').textContent = name;
    if ((s.query || '').trim()) renderList();
  }

  async function duplicateRec(rec) {
    const s = S;
    const used = new Set(s.recs.map((r) => r.name));
    let name = rec.name + ' copy', n = 2;
    while (used.has(name)) name = `${rec.name} copy ${n++}`;
    const copy = { name, date: Date.now(), duration: rec.duration, peaks: (rec.peaks || []).slice(), blob: rec.blob, mime: rec.mime };
    await saveRec(copy);
    if (s.closed) return;
    if (copy.id == null) { await loadAll(s); return; }
    s.recs.unshift(copy);
    renderList();
    const row = s.rows.get(copy.id);
    if (row) flashRow(row);
  }

  async function saveToFiles(rec) {
    const s = S;
    try {
      await OS.db.put('files', {
        name: rec.name + extFor(rec.mime), kind: 'audio', type: rec.mime || 'audio/webm', folder: 'Voice Memos',
        size: rec.blob && rec.blob.size ? rec.blob.size : 0, date: Date.now(), duration: rec.duration, blob: rec.blob,
      });
      if (!s.closed) { OS.ui.toast('Saved to Files'); try { OS.haptic('success'); } catch (e) {} }
    } catch (e) { if (!s.closed) OS.ui.toast('Could Not Save to Files'); }
  }

  function openMenu(rec, anchor) {
    try {
      OS.ui.contextMenu(anchor, [
        { label: 'Rename', icon: IC.pencil, onTap: () => renameRec(rec) },
        { label: 'Duplicate', icon: IC.dup, onTap: () => duplicateRec(rec) },
        { label: 'Save to Files', icon: IC.folder, onTap: () => saveToFiles(rec) },
        { label: 'Delete', icon: IC.trashSm, style: 'destructive', onTap: () => confirmDelete([rec]) },
      ]);
    } catch (e) {}
  }

  function flashRow(row) {
    const h = row.offsetHeight;
    row.style.height = '0px'; row.style.opacity = '0';
    void row.offsetHeight;
    row.style.height = h + 'px'; row.style.opacity = '1';
    setTimeout(() => { row.style.height = ''; row.style.opacity = ''; }, 380);
  }

  async function confirmDelete(list) {
    const s = S;
    if (!list.length) return;
    const label = list.length === 1 ? 'Delete Recording' : `Delete ${list.length} Recordings`;
    let idx = -1;
    try {
      idx = await OS.ui.actionSheet({
        title: list.length === 1 ? `“${list[0].name}” will be deleted.` : 'These recordings will be deleted.',
        message: 'This action cannot be undone.',
        buttons: [{ label, style: 'destructive' }], cancel: 'Cancel',
      });
    } catch (e) {}
    if (s.closed || idx !== 0) return;
    await deleteRecs(list);
  }

  async function deleteRecs(list) {
    const s = S;
    const ids = new Set(list.map((r) => r.id));
    if (s.openId != null && ids.has(s.openId)) collapseRow();
    try { OS.sound.play('trash'); } catch (e) {}
    try { OS.haptic('medium'); } catch (e) {}
    list.forEach((rec) => {
      const row = s.rows.get(rec.id);
      if (!row) return;
      row.style.height = row.offsetHeight + 'px';
      void row.offsetHeight;
      row.style.height = '0px'; row.style.opacity = '0';
    });
    s.recs = s.recs.filter((r) => !ids.has(r.id));
    ids.forEach((id) => s.selected.delete(id));
    await Promise.all(list.map((rec) => Promise.resolve().then(() => OS.db.del('recordings', rec.id)).catch(() => {})));
    setTimeout(() => {
      if (s.closed) return;
      if (s.editing && !s.recs.length) setEditing(false);
      else renderList();
    }, 330);
  }

  function deleteSelected() {
    const s = S;
    confirmDelete(s.recs.filter((r) => s.selected.has(r.id)));
  }

  /* ───────────────────────── edit mode ───────────────────────── */
  function setEditing(on) {
    const s = S;
    if (on && (s.recState !== 'idle' || !s.recs.length)) return;
    s.editing = !!on;
    s.selected.clear();
    if (on) collapseRow();
    s.root.classList.toggle('editing', s.editing);
    s.el.edit.textContent = s.editing ? 'Done' : 'Edit';
    s.el.edit.classList.toggle('bold', s.editing);
    s.el.scroll.style.paddingBottom = s.editing ? '107px' : '';
    renderList();
  }

  function syncSelection() {
    const s = S;
    s.rows.forEach((row, id) => row.classList.toggle('sel', s.editing && s.selected.has(id)));
    const n = s.selected.size, vis = visibleRecs();
    s.el.del.disabled = !n;
    s.el.del.textContent = n ? `Delete (${n})` : 'Delete';
    s.el.selAll.textContent = vis.length && vis.every((r) => s.selected.has(r.id)) ? 'Deselect All' : 'Select All';
    s.el.selAll.disabled = !vis.length;
  }

  /* ───────────────────────── microphone state ───────────────────────── */
  function showMicCard(kind) {
    const s = S;
    const text = {
      denied: 'Voice Memos can’t hear you. Allow microphone access for this page in your browser, then try again. Your saved recordings still play.',
      nomic: 'No microphone was found. Connect or enable a microphone, then try again. Your saved recordings still play.',
      unsupported: 'Recording isn’t available in this browser (it needs a secure page with microphone support). Your saved recordings still play.',
      busy: 'The microphone couldn’t be started — another app may be using it. Try again in a moment.',
    }[kind] || '';
    s.el.micText.textContent = text;
    s.el.micCard.classList.remove('show');
    void s.el.micCard.offsetHeight;
    s.el.micCard.classList.add('show');
    try { s.el.scroll.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { s.el.scroll.scrollTop = 0; }
    try { OS.haptic('error'); } catch (e) {}
  }

  /* ───────────────────────── recording ───────────────────────── */
  function nextName() {
    const used = new Set(S.recs.map((r) => r.name));
    if (!used.has('New Recording')) return 'New Recording';
    let n = 2;
    while (used.has('New Recording ' + n)) n++;
    return 'New Recording ' + n;
  }
  function pickMime() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const t of types) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return '';
  }
  function elapsedMs(s) {
    if (s.recState === 'starting') return 0;
    if (s.recState === 'stopping' || s.recState === 'idle') return s.finalMs || 0;
    return (s.recState === 'paused' ? s.pauseAt : performance.now()) - s.t0 - s.pausedMs;
  }

  async function startRecording() {
    const s = S;
    if (s.recState !== 'idle') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') { showMicCard('unsupported'); return; }
    if (s.editing) setEditing(false);
    collapseRow();
    s.recState = 'starting';
    s.el.panel.classList.add('busy');
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (err) {
      if (s.closed) return;
      s.recState = 'idle';
      s.el.panel.classList.remove('busy');
      const n = err && err.name;
      showMicCard(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'nomic' : n === 'NotReadableError' || n === 'AbortError' ? 'busy' : 'denied');
      return;
    }
    if (s.closed) { stream.getTracks().forEach((t) => t.stop()); return; }
    s.stream = stream;
    s.el.micCard.classList.remove('show');

    // analyser for the live waveform — on the shared context when there is one
    try {
      let actx = OS.sound && OS.sound.ctx;
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); s.ownCtx = actx; }
      if (actx.state === 'suspended' && actx.resume) actx.resume().catch(() => {});
      s.srcNode = actx.createMediaStreamSource(stream);
      s.analyser = actx.createAnalyser();
      s.analyser.fftSize = 1024; s.analyser.smoothingTimeConstant = 0;
      s.sink = actx.createGain(); s.sink.gain.value = 0;       // silent sink keeps the graph pulled in every browser; nothing is audible
      s.srcNode.connect(s.analyser); s.analyser.connect(s.sink); s.sink.connect(actx.destination);
      s.timeData = new Uint8Array(s.analyser.fftSize);
    } catch (e) { s.analyser = null; }

    s.recName = nextName();
    s.livePeaks = []; s.finalMs = 0; s.lastLevel = 0; s.finalized = false; s.islandSec = -1;
    s.el.recName.textContent = s.recName;
    s.el.recTime.textContent = '00:00.00';
    s.el.recState.textContent = 'Recording'; s.el.recState.classList.add('live');
    s.el.pauseBtn.querySelector('span').innerHTML = IC.pause;
    s.el.pauseBtn.setAttribute('aria-label', 'Pause');
    s.el.recBtn.setAttribute('aria-label', 'Stop');
    s.el.panel.classList.remove('paused');
    s.el.panel.classList.add('rec');
    s.root.classList.add('recording');
    readColors(); drawLive();
    try { OS.sound.play('begin_record'); } catch (e) {}
    try { OS.haptic('medium'); } catch (e) {}
    if (!s.active) startIsland();
    // start capturing just after the chime so it isn't in the recording
    s.startTimer = setTimeout(() => { s.startTimer = 0; beginCapture(s); }, 350);
  }

  function beginCapture(s) {
    if (s.closed || s.recState !== 'starting') return;
    const mime = pickMime();
    let mr = null;
    try { mr = mime ? new MediaRecorder(s.stream, { mimeType: mime }) : new MediaRecorder(s.stream); }
    catch (e) { try { mr = new MediaRecorder(s.stream); } catch (e2) { mr = null; } }
    if (!mr) { abortRecording(s); showMicCard('unsupported'); return; }
    s.recorder = mr; s.mime = mime; s.chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); };
    mr.onstop = () => finalizeRecording(s);
    mr.onerror = () => { if (s.recState === 'recording' || s.recState === 'paused') stopRecording(false); };
    try { mr.start(1000); } catch (e) { abortRecording(s); showMicCard('busy'); return; }
    // if the mic is unplugged / permission revoked mid-recording, keep what we have
    s.stream.getAudioTracks().forEach((t) => { t.onended = () => { if (s.recState === 'recording' || s.recState === 'paused') stopRecording(false); }; });
    s.t0 = performance.now(); s.pausedMs = 0;
    s.recState = 'recording';
    s.el.panel.classList.remove('busy');
    s.tick = setInterval(() => sampleTick(s), BAR_MS);
    if (s.active) startLiveLoop(); else updateIsland(true);
  }

  function sampleTick(s) {
    if (s.recState !== 'recording') return;
    let level = s.lastLevel * 0.6;
    if (s.analyser) {
      s.analyser.getByteTimeDomainData(s.timeData);
      let peak = 0, sum = 0;
      const d = s.timeData;
      for (let i = 0; i < d.length; i++) { const v = (d[i] - 128) / 128; const a = v < 0 ? -v : v; if (a > peak) peak = a; sum += v * v; }
      const rms = Math.sqrt(sum / d.length);
      level = clamp(peak * 0.6 + rms * 1.6, 0, 1);
    }
    s.lastLevel = level;
    const target = Math.floor(elapsedMs(s) / BAR_MS);
    while (s.livePeaks.length < target) s.livePeaks.push(level);   // also back-fills if timers were throttled
    if (!s.active) updateIsland(false);
  }

  function togglePauseRecording() {
    const s = S, mr = s.recorder;
    if (!mr) return;
    if (s.recState === 'recording') {
      s.pauseAt = performance.now();
      try { mr.pause(); } catch (e) {}
      s.recState = 'paused';
    } else if (s.recState === 'paused') {
      s.pausedMs += performance.now() - s.pauseAt;
      try { mr.resume(); } catch (e) {}
      s.recState = 'recording';
    } else return;
    const paused = s.recState === 'paused';
    try { OS.haptic('light'); } catch (e) {}
    s.el.panel.classList.toggle('paused', paused);
    s.el.recState.textContent = paused ? 'Paused' : 'Recording';
    s.el.recState.classList.toggle('live', !paused);
    s.el.pauseBtn.querySelector('span').innerHTML = paused ? IC.resume : IC.pause;
    s.el.pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    s.el.recTime.textContent = fmtClock(elapsedMs(s));
    if (paused) drawLive(); else if (s.active) startLiveLoop();
    if (!s.active) updateIsland(true);
  }

  function stopRecording(withSound) {
    const s = S;
    if (!s || (s.recState !== 'recording' && s.recState !== 'paused')) return;
    s.finalMs = elapsedMs(s);
    s.recState = 'stopping';
    if (s.tick) { clearInterval(s.tick); s.tick = 0; }
    if (s.liveRaf) { cancelAnimationFrame(s.liveRaf); s.liveRaf = 0; }
    if (!s.closed) { s.el.panel.classList.add('busy'); s.el.recTime.textContent = fmtClock(s.finalMs); }
    let stopped = false;
    try { if (s.recorder.state !== 'inactive') { s.recorder.stop(); stopped = true; } } catch (e) {}
    if (!stopped) finalizeRecording(s);
    else setTimeout(() => finalizeRecording(s), 2500);        // safety net if onstop never fires
    if (withSound) { try { OS.sound.play('end_record'); } catch (e) {} try { OS.haptic('medium'); } catch (e) {} }
  }

  function releaseMic(s) {
    if (s.startTimer) { clearTimeout(s.startTimer); s.startTimer = 0; }
    if (s.tick) { clearInterval(s.tick); s.tick = 0; }
    if (s.liveRaf) { cancelAnimationFrame(s.liveRaf); s.liveRaf = 0; }
    if (s.stream) { try { s.stream.getTracks().forEach((t) => { t.onended = null; t.stop(); }); } catch (e) {} s.stream = null; }
    [s.srcNode, s.analyser, s.sink].forEach((n) => { if (n) { try { n.disconnect(); } catch (e) {} } });
    s.srcNode = s.analyser = s.sink = null;
    if (s.ownCtx) { try { s.ownCtx.close(); } catch (e) {} s.ownCtx = null; }
    endIsland(s);
  }

  function resetPanel(s) {
    s.recState = 'idle';
    s.recorder = null;
    if (s.closed) return;
    s.el.panel.classList.remove('rec', 'paused', 'busy');
    s.root.classList.remove('recording');
    s.el.recState.classList.remove('live');
    s.el.recBtn.setAttribute('aria-label', 'Record');
  }

  function abortRecording(s) {
    releaseMic(s);
    s.chunks = [];
    resetPanel(s);
  }

  async function finalizeRecording(s) {
    if (s.finalized) return;
    s.finalized = true;
    const mr = s.recorder;
    const type = (mr && mr.mimeType) || s.mime || 'audio/webm';
    const blob = new Blob(s.chunks || [], { type });
    const durMs = s.finalMs || 0;
    const peaks = s.livePeaks || [];
    s.chunks = [];
    if (mr) { mr.ondataavailable = mr.onstop = mr.onerror = null; }
    releaseMic(s);
    resetPanel(s);
    if (!blob.size || durMs < 300) return;                    // accidental tap — nothing worth keeping
    const rec = { name: s.recName, date: Date.now(), duration: Math.round(durMs) / 1000, peaks: normalizePeaks(peaks, MAX_PEAKS), blob, mime: type };
    try { const id = await OS.db.put('recordings', rec); if (id != null) rec.id = id; }
    catch (e) { if (!s.closed) { try { OS.ui.toast('Could Not Save Recording'); } catch (err) {} } return; }
    if (s.closed || S !== s) return;
    if (rec.id == null) { await loadAll(s); return; }
    s.recs.unshift(rec);
    if ((s.query || '').trim()) { s.query = ''; s.el.search.value = ''; }
    renderList();
    try { s.el.scroll.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { s.el.scroll.scrollTop = 0; }
    const row = s.rows.get(rec.id);
    if (row) flashRow(row);
    setTimeout(() => { if (!s.closed && S === s && s.openId == null && s.recState === 'idle' && !s.editing && s.rows.get(rec.id)) toggleRow(rec); }, 420);
  }

  /* live waveform */
  function startLiveLoop() {
    const s = S;
    if (s.liveRaf) cancelAnimationFrame(s.liveRaf);
    const loop = () => {
      s.liveRaf = 0;
      if (s.closed || !s.active || s.recState !== 'recording') return;
      s.el.recTime.textContent = fmtClock(elapsedMs(s));
      drawLive();
      s.liveRaf = requestAnimationFrame(loop);
    };
    s.liveRaf = requestAnimationFrame(loop);
  }

  function drawLive() {
    const s = S;
    if (!s || s.closed || !s.live) return;
    const { g, w, h } = s.live, c = s.colors;
    const ms = elapsedMs(s), cx = w / 2, pxPerMs = BAR_STEP / BAR_MS;
    const top = 20, mid = top + (h - top) / 2, maxH = h - top - 10;
    g.clearRect(0, 0, w, h);

    // time ruler
    g.font = '10px system-ui,-apple-system, system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    const tMin = Math.max(0, Math.ceil((ms - cx / pxPerMs) / 250) * 250), tMax = ms + cx / pxPerMs;
    for (let t = tMin; t <= tMax; t += 250) {
      const x = cx + (t - ms) * pxPerMs, major = t % 1000 === 0;
      g.fillStyle = c.label3;
      g.fillRect(Math.round(x), major ? 10 : 14, 1, major ? 8 : 4);
      if (major) { g.fillStyle = c.label2; g.fillText(fmtDur(t / 1000), Math.round(x) + 4, 12); }
    }
    g.fillStyle = c.sep;
    g.fillRect(0, top - 1.5, w, 0.5);

    // flat "future" line to the right of the playhead
    g.fillStyle = c.label3;
    for (let x = cx + 4; x < w; x += BAR_STEP * 2) g.fillRect(x, mid - 0.5, BAR_W, 1);

    // recorded bars scroll right → left, newest at the playhead
    const peaks = s.livePeaks || [];
    const first = Math.max(0, Math.floor((ms - cx / pxPerMs) / BAR_MS) - 1);
    g.fillStyle = c.red;
    for (let i = first; i < peaks.length; i++) {
      const x = cx - (ms - i * BAR_MS) * pxPerMs;
      if (x > cx) break;
      const amp = clamp(Math.pow(peaks[i] * 2.4, 0.8), 0, 1);
      const bh = Math.max(2, amp * maxH);
      roundBar(g, x - BAR_W / 2, mid - bh / 2, BAR_W, bh);
    }

    // playhead
    g.fillStyle = c.tint;
    g.fillRect(cx - 0.75, top + 2, 1.5, h - top - 4);
    g.beginPath(); g.arc(cx, top + 2, 3.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx, h - 3.5, 3.5, 0, Math.PI * 2); g.fill();
  }

  /* ───────────────────────── Dynamic Island ───────────────────────── */
  function islandParts(s) {
    const paused = s.recState === 'paused';
    const t = fmtDur(elapsedMs(s) / 1000), p = paused ? ' paused' : '';
    const bars = [7, 14, 10, 17, 9].map((h, i) => `<i style="height:${h}px;animation-delay:${-i * 0.17}s"></i>`).join('');
    return {
      leading: `<span class="vm-isl-dot${p}"></span>`,
      trailing: `<span class="vm-isl-time${p}">${t}</span>`,
      expanded: `<div class="vm-isl-exp"><div class="vm-isl-ic"><span class="vm-isl-wave${p}">${bars}</span></div>` +
        `<div class="vm-isl-tx"><div class="vm-isl-n">${OS.util.esc(s.recName || 'New Recording')}</div><div class="vm-isl-s">${paused ? 'Paused' : 'Recording'} · Voice Memos</div></div>` +
        `<div class="vm-isl-big${p}">${t}</div></div>`,
    };
  }
  function startIsland() {
    const s = S;
    if (!s || s.islandOn || !isRecordingState(s) || s.recState === 'stopping') return;
    try {
      OS.island.start(Object.assign({ id: ISLAND_ID, appId: ID, onTap() { OS.openApp(ID); } }, islandParts(s)));
      s.islandOn = true; s.islandSec = Math.floor(elapsedMs(s) / 1000);
    } catch (e) {}
  }
  function updateIsland(force) {
    const s = S;
    if (!s || !s.islandOn) return;
    const sec = Math.floor(elapsedMs(s) / 1000);
    if (!force && sec === s.islandSec) return;
    s.islandSec = sec;
    try { OS.island.update(ISLAND_ID, islandParts(s)); } catch (e) {}
  }
  function endIsland(s) {
    if (!s.islandOn) return;
    s.islandOn = false;
    try { OS.island.end(ISLAND_ID); } catch (e) {}
  }

  /* ───────────────────────── data ───────────────────────── */
  async function loadAll(s) {
    let list = [];
    try { list = (await OS.db.all('recordings')) || []; } catch (e) {}
    if (s.closed) return;
    s.recs = list.filter((r) => r && typeof r === 'object' && r.id != null).sort((a, b) => (b.date || 0) - (a.date || 0));
    s.loaded = true;
    renderList();
  }

  async function seedIfNeeded(s) {
    return;   // no sample recordings
    let seeded = false;
    try { seeded = !!OS.store.get(SEED_KEY, false); } catch (e) {}
    if (seeded) return;
    if (s.recs.length) { try { OS.store.set(SEED_KEY, true); } catch (e) {} return; }
    if (!(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return;
    try { OS.store.set(SEED_KEY, true); } catch (e) {}
    const at = (daysAgo, h, m) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setHours(h, m, 12, 0); return d.getTime(); };
    const defs = [
      { name: 'Melody Idea', date: at(1, 16, 12), dur: 13.5, seed: 7, level: 0.72, build: synthMelody },
      { name: 'Note to Self', date: at(5, 9, 47), dur: 8.4, seed: 23, level: 0.78, build: synthVoice },
      { name: 'Rain on the Porch', date: at(19, 21, 5), dur: 18, seed: 41, level: 0.6, build: synthRain },
    ];
    for (const def of defs) {
      try {
        const a = await synthSample(def);
        const rec = { name: def.name, date: def.date, duration: a.duration, peaks: a.peaks, blob: a.blob, mime: a.mime };
        const id = await OS.db.put('recordings', rec);
        if (id != null) rec.id = id;
        if (s.closed) continue;
        if (rec.id != null && !s.recs.some((r) => r.id === rec.id)) s.recs.push(rec);
      } catch (e) { /* synthesis unavailable — the app simply starts empty */ }
    }
    if (s.closed) return;
    if (s.recs.some((r) => r.id == null)) { await loadAll(s); return; }
    s.recs.sort((a, b) => (b.date || 0) - (a.date || 0));
    if (!s.editing) renderList();
  }

  /* ───────────────────────── lifecycle ───────────────────────── */
  OS.registerApp({
    id: ID,
    name: 'Voice Memos',
    icon: { bg: 'linear-gradient(180deg,#1C1C1E,#000)', glyph: APP_ICON },
    system: true,
    statusBar: 'auto',
    background: 'var(--bg)',

    launch(ctx) {
      const s = S = {
        ctx, root: ctx.root, closed: false, active: false, loaded: false,
        recs: [], rows: new Map(), query: '', editing: false, selected: new Set(), longPressAt: 0,
        openId: null, current: null, open: null, pos: 0, playing: false, playBusy: false, scrubbing: false, playRaf: 0,
        audio: new Audio(), url: null, ready: Promise.resolve(false), loadTok: 0,
        recState: 'idle', recName: '', stream: null, recorder: null, chunks: [], mime: '', livePeaks: [], lastLevel: 0,
        t0: 0, pausedMs: 0, pauseAt: 0, finalMs: 0, finalized: false, tick: 0, liveRaf: 0, startTimer: 0,
        analyser: null, srcNode: null, sink: null, timeData: null, ownCtx: null, islandOn: false, islandSec: -1,
        colors: null, live: null, el: null,
      };
      s.audio.preload = 'auto';
      s.audio.volume = mediaVolume();
      s.onEnded = () => { if (S === s) onAudioEnded(); };
      s.audio.addEventListener('ended', s.onEnded);
      build(ctx);
      readColors();
      drawLive();

      s.onVolume = () => { s.audio.volume = mediaVolume(); };
      s.onTheme = () => requestAnimationFrame(() => { if (s.closed || S !== s) return; readColors(); drawScrub(); drawLive(); });
      s.onMinute = () => { if (!s.closed && S === s && s.active && s.recState === 'idle' && !s.playing && s.openId == null && !s.editing) renderList(); };
      try { OS.on('setting:volume', s.onVolume); OS.on('volumechange', s.onVolume); OS.on('themechange', s.onTheme); OS.on('setting:use24h', s.onMinute); } catch (e) {}

      loadAll(s).then(() => seedIfNeeded(s));
    },

    onResume(ctx, params) {
      const s = S;
      if (!s) return;
      s.active = true;
      endIsland(s);
      readColors();
      s.audio.volume = mediaVolume();
      if (s.recState === 'recording') startLiveLoop();
      else if (isRecordingState(s)) { s.el.recTime.textContent = fmtClock(elapsedMs(s)); drawLive(); }
      else if (s.openId == null && !s.editing) renderList();       // refresh relative dates
      drawScrub();
      if (params && params.record && s.recState === 'idle') startRecording();
    },

    onPause() {
      const s = S;
      if (!s) return;
      s.active = false;
      pausePlayback();
      if (s.liveRaf) { cancelAnimationFrame(s.liveRaf); s.liveRaf = 0; }
      try { s.el.search.blur(); } catch (e) {}
      if (isRecordingState(s) && s.recState !== 'stopping') startIsland();   // recording carries on in the background
    },

    onClose() {
      const s = S;
      if (!s) return;
      s.active = false;
      s.closed = true;
      try { OS.off('setting:volume', s.onVolume); OS.off('volumechange', s.onVolume); OS.off('themechange', s.onTheme); OS.off('setting:use24h', s.onMinute); } catch (e) {}
      if (s.playRaf) { cancelAnimationFrame(s.playRaf); s.playRaf = 0; }
      s.playing = false;
      s.audio.removeEventListener('ended', s.onEnded);
      releaseAudio(s);
      // keep what was recorded: stop → onstop → finalizeRecording saves it, then the mic is released
      if (s.recState === 'recording' || s.recState === 'paused') stopRecording(false);
      else if (s.recState === 'starting') abortRecording(s);
      endIsland(s);
      if (s.recState === 'idle') releaseMic(s);
      S = null;
    },
  });
})();
