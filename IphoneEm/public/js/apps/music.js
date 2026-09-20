/* Music — Home / Library / Search, album + playlist pages, mini-player, full Now Playing sheet, queue / shuffle / repeat.
   The library is real audio: the genuine iPhone ringtones (streamed from /sys/sound) and ten original instrumentals that
   are synthesized live with WebAudio (lookahead scheduler → OS.sound.mediaOut). Exposes OS.music = { toggle, next, prev, playing }.
   Storage: 'music.recent' (recently played collections), 'music.loved' (favourite track ids), 'music.durs' (ringtone lengths). */
(function () {
  'use strict';
  const U = OS.util, esc = U.esc;
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  let S = null;   // UI state (null while the app isn't running — the player itself is UI-independent)

  /* ───────────────────────── icons ───────────────────────── */
  const fl = (b, vb = 24) => `<svg viewBox="0 0 ${vb} ${vb}"><g fill="currentColor" stroke="none">${b}</g></svg>`;
  const st = (b, w = 1.9) => `<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${b}</g></svg>`;
  const FWD = 'M2.5 6.300v11.400c0 .9 1 1.400 1.700.9l7.300-5v4.100c0 .9 1 1.400 1.700.9l8.200-5.700c.6-.4.6-1.400 0-1.800l-8.200-5.700c-.7-.5-1.700 0-1.700.9v4.100l-7.300-5c-.7-.5-1.700 0-1.700.9z';
  const NOTE = 'M19.500 3.600c0-.7-.6-1.200-1.300-1L8.700 4.700c-.6.1-1 .6-1 1.200v9.700c-.5-.2-1.200-.3-1.900-.1-1.800.4-3 1.800-2.700 3.200.3 1.400 1.900 2.200 3.700 1.800 1.600-.3 2.800-1.500 2.800-2.800V9.300l7.900-1.700v6.300c-.5-.2-1.200-.3-1.900-.1-1.800.4-3 1.800-2.700 3.200.3 1.400 1.900 2.200 3.700 1.800 1.600-.3 2.800-1.500 2.800-2.800z';
  const STAR = 'M12 3.200l2.600 5.600 6.100.7-4.500 4.200 1.200 6-5.400-3-5.400 3 1.200-6-4.500-4.200 6.100-.7z';
  const IC = {
    play: fl('<path d="M6.500 4.300v15.400c0 .9 1 1.500 1.800 1l12.200-7.700c.7-.5.7-1.500 0-2L8.300 3.300c-.8-.5-1.800.1-1.800 1z"/>'),
    pause: fl('<rect x="5" y="3.500" width="5" height="17" rx="1.500"/><rect x="14" y="3.500" width="5" height="17" rx="1.500"/>'),
    next: fl(`<path d="${FWD}"/>`),
    prev: fl(`<path transform="translate(24 0) scale(-1 1)" d="${FWD}"/>`),
    shuffle: st('<path d="M3 7h3.200c1.500 0 2.800.7 3.600 1.900l4.400 6.200c.8 1.200 2.100 1.900 3.600 1.900H21M3 17h3.200c1.500 0 2.800-.7 3.600-1.900l.6-.9M21 7h-3.200c-1.500 0-2.800.7-3.600 1.900l-.6.9M18.500 4.500 21 7l-2.500 2.500M18.500 14.500 21 17l-2.500 2.500"/>'),
    repeat: st('<path d="M4 11.500V10a3.500 3.500 0 0 1 3.500-3.500H20M17.500 4 20 6.500 17.500 9M20 12.500V14a3.500 3.500 0 0 1-3.500 3.500H4M6.500 20 4 17.500 6.500 15"/>'),
    star: st(`<path d="${STAR}"/>`, 1.7), starFill: fl(`<path d="${STAR}"/>`),
    dots: fl('<circle cx="5.500" cy="12" r="1.900"/><circle cx="12" cy="12" r="1.900"/><circle cx="18.500" cy="12" r="1.900"/>'),
    lyrics: st('<path d="M5.500 4.500h13a2.500 2.500 0 0 1 2.500 2.500v8a2.500 2.500 0 0 1-2.500 2.500H11l-4.500 3.500V17.500h-1A2.500 2.500 0 0 1 3 15V7a2.500 2.500 0 0 1 2.500-2.500z"/><path d="M8.500 9.300v3.200M8.500 9.300c1.300 0 2 .6 2 1.600M14 9.300v3.200M14 9.300c1.300 0 2 .6 2 1.600" stroke-width="1.600"/>'),
    airplay: st('<path d="M7.500 17.500H6A2.500 2.500 0 0 1 3.500 15V7A2.500 2.500 0 0 1 6 4.500h12A2.500 2.500 0 0 1 20.500 7v8a2.500 2.500 0 0 1-2.500 2.500h-1.500"/><path d="M12 14.500l4.500 6h-9z" fill="currentColor" stroke-width="1.200"/>'),
    queue: st('<path d="M8.500 6.500H21M8.500 12H21M8.500 17.500H21"/><g fill="currentColor" stroke="none"><circle cx="4.200" cy="6.500" r="1.400"/><circle cx="4.200" cy="12" r="1.400"/><circle cx="4.200" cy="17.500" r="1.400"/></g>', 2.1),
    volLo: fl('<path d="M12.500 5.200v13.600c0 .8-.9 1.200-1.500.7L6.600 16H4.300c-.7 0-1.300-.6-1.300-1.300V9.300C3 8.600 3.600 8 4.300 8h2.300L11 4.500c.6-.5 1.500-.1 1.500.7z"/>'),
    volHi: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11.500 5.200v13.600c0 .8-.9 1.200-1.500.7L5.600 16H3.300c-.7 0-1.300-.6-1.300-1.300V9.300C2 8.600 2.600 8 3.300 8h2.300L10 4.500c.6-.5 1.500-.1 1.500.7z"/><g fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"><path d="M14.800 9.200c1.500 1.600 1.500 4 0 5.600M17.500 6.800c2.900 2.900 2.900 7.500 0 10.400M20.200 4.500c4.100 4.200 4.100 10.800 0 15"/></g></svg>`,
    note: fl(`<path d="${NOTE}"/>`),
    playlist: st('<path d="M3.500 6h11M3.500 11h11M3.500 16h6"/><path d="M19.500 8v8.300M19.500 8l-4 1.200v8.300" stroke-width="1.700"/><g fill="currentColor" stroke="none"><ellipse cx="17.700" cy="16.500" rx="1.900" ry="1.500"/><ellipse cx="13.700" cy="17.700" rx="1.900" ry="1.500"/></g>'),
    artist: st('<rect x="9" y="2.800" width="6" height="11" rx="3"/><path d="M5.800 11.500a6.200 6.200 0 0 0 12.400 0M12 17.700v3.500M8.500 21.200h7"/>'),
    album: st('<rect x="3.500" y="7.500" width="17" height="13" rx="2.500"/><path d="M6 4.800h12"/><circle cx="12" cy="14" r="2.600"/>'),
    tabHome: fl('<path d="M11.200 3.200 3.300 9.900c-.3.300-.5.600-.5 1V19.500c0 .8.700 1.500 1.500 1.500h4.200c.4 0 .7-.3.7-.7v-4.600c0-.7.600-1.200 1.200-1.200h3.200c.7 0 1.200.5 1.200 1.200v4.600c0 .4.300.7.7.7h4.200c.8 0 1.500-.7 1.500-1.500V10.900c0-.4-.2-.7-.5-1l-7.900-6.700c-.5-.4-1.100-.4-1.600 0z"/>', 24),
    tabLib: `<svg viewBox="0 0 24 24"><g fill="currentColor"><rect x="3" y="8.200" width="18" height="12.800" rx="2.800"/><rect x="5.200" y="5.200" width="13.600" height="1.700" rx=".85"/><rect x="7.400" y="2.500" width="9.200" height="1.700" rx=".85"/></g></svg>`,
    tabSearch: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round"><circle cx="10.700" cy="10.700" r="6.400"/><path d="M15.500 15.500l5 5"/></g></svg>',
  };

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('music', `
    .app-music { --tint: #FA243C; background: var(--bg); }
    #screen[data-theme="dark"] .app-music { --tint: #FA2D48; }
    .app-music .mu-pane { position: absolute; inset: 0; display: none; } .app-music .mu-pane.on { display: block; }
    .app-music .mu-pad { height: 74px; }
    .app-music .mu-art { position: relative; overflow: hidden; background-color: #555; background-size: cover; flex: none; }
    .app-music .mu-art::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 .5px rgba(128,128,128,.35); pointer-events: none; }
    .app-music .mu-art span { position: absolute; left: 9%; bottom: 8%; right: 9%; color: #fff; font-weight: 800; font-size: 1em; line-height: 1.02; letter-spacing: -.02em; text-shadow: 0 1px 10px rgba(0,0,0,.25); }
    .app-music .mu-art em { position: absolute; left: 9%; top: 8%; font-style: normal; font-size: .36em; font-weight: 700; letter-spacing: .02em; color: rgba(255,255,255,.85); display: flex; align-items: center; gap: .3em; }
    .app-music .mu-art em svg { width: 1.1em; height: 1.1em; }

    .app-music .mu-h { display: flex; align-items: baseline; justify-content: space-between; padding: 18px 20px 10px; }
    .app-music .mu-h b { font-size: 22px; font-weight: 700; letter-spacing: .2px; }
    .app-music .mu-h span { font-size: 15px; color: var(--label2); }
    .app-music .mu-hrow { display: flex; gap: 14px; padding: 0 20px 6px; }
    .app-music .mu-hrow::after { content: ''; flex: none; width: 6px; }
    .app-music .mu-pick { flex: none; width: 250px; border-radius: 14px; overflow: hidden; cursor: pointer; transition: transform .3s ${EASE}; box-shadow: 0 8px 22px rgba(0,0,0,.16); }
    .app-music .mu-pick:active { transform: scale(.965); }
    .app-music .mu-pick .mu-art { width: 250px; height: 250px; font-size: 38px; }
    .app-music .mu-pick-cap { height: 78px; padding: 12px 14px; color: #fff; font-size: 14px; line-height: 18px; letter-spacing: -.15px; display: flex; flex-direction: column; justify-content: center; }
    .app-music .mu-pick-cap b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-pick-cap span { opacity: .78; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .app-music .mu-pick-k { padding: 0 2px 7px; font-size: 13px; color: var(--label2); letter-spacing: -.08px; white-space: nowrap; }
    .app-music .mu-tile { flex: none; width: 152px; cursor: pointer; }
    .app-music .mu-tile .mu-art { width: 152px; height: 152px; border-radius: 8px; font-size: 24px; transition: transform .3s ${EASE}, filter .2s; box-shadow: 0 4px 12px rgba(0,0,0,.12); }
    .app-music .mu-tile:active .mu-art { transform: scale(.955); filter: brightness(.9); }
    .app-music .mu-tile b { display: block; margin-top: 6px; font-size: 14px; font-weight: 400; letter-spacing: -.15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-tile i { display: block; font-style: normal; font-size: 14px; color: var(--label2); letter-spacing: -.15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 16px; padding: 0 20px 8px; }
    .app-music .mu-grid .mu-tile { width: auto; min-width: 0; } .app-music .mu-grid .mu-tile .mu-art { width: 100%; height: auto; aspect-ratio: 1; font-size: 27px; }

    .app-music .mu-links { margin: 0 0 0 20px; border-top: .5px solid var(--sep); }
    .app-music .mu-link { display: flex; align-items: center; gap: 12px; height: 48px; padding-right: 18px; border-bottom: .5px solid var(--sep); cursor: pointer; font-size: 20px; letter-spacing: .2px; }
    .app-music .mu-link:active { opacity: .5; }
    .app-music .mu-link > svg { width: 26px; height: 26px; color: var(--tint); flex: none; } .app-music .mu-link b { flex: 1; font-weight: 400; }

    .app-music .mu-songs { margin-left: 20px; }
    .app-music .mu-song { position: relative; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 5px 12px 5px 0; cursor: pointer; }
    .app-music .mu-song + .mu-song::before { content: ''; position: absolute; left: 60px; right: 0; top: 0; height: .5px; background: var(--sep); }
    .app-music .mu-songs.numbered .mu-song { min-height: 46px; } .app-music .mu-songs.numbered .mu-song + .mu-song::before { left: 34px; }
    .app-music .mu-song:active { opacity: .55; }
    .app-music .mu-song .mu-art { width: 48px; height: 48px; border-radius: 5px; font-size: 0; }
    .app-music .mu-song-n { width: 22px; flex: none; text-align: center; color: var(--label2); font-size: 16px; font-variant-numeric: tabular-nums; position: relative; height: 18px; line-height: 18px; }
    .app-music .mu-song-t { flex: 1; min-width: 0; }
    .app-music .mu-song-t b { display: block; font-size: 16px; font-weight: 400; letter-spacing: -.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-song-t i { display: block; font-style: normal; font-size: 13px; color: var(--label2); letter-spacing: -.08px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-song-d { font-size: 14px; color: var(--label2); font-variant-numeric: tabular-nums; letter-spacing: 0; flex: none; }
    .app-music .mu-song-m { width: 30px; height: 36px; flex: none; color: var(--label); display: flex; align-items: center; justify-content: center; }
    .app-music .mu-song-m svg { width: 18px; height: 18px; } .app-music .mu-song-star { width: 12px; height: 12px; color: var(--tint); flex: none; display: none; } .app-music .mu-song.loved .mu-song-star { display: block; }
    .app-music .mu-song.is-cur .mu-song-t b { color: var(--tint); font-weight: 500; }
    .app-music .mu-eq { position: absolute; inset: 0; display: none; align-items: flex-end; justify-content: center; gap: 2px; padding-bottom: 2px; }
    .app-music .mu-eq i { width: 3px; height: 30%; border-radius: 1.500px; background: var(--tint); }
    .app-music .mu-song.is-cur .mu-eq { display: flex; } .app-music .mu-song.is-cur .mu-song-n > span { visibility: hidden; }
    .app-music .mu-song .mu-art .mu-eq { background: rgba(0,0,0,.45); align-items: center; padding: 0; } .app-music .mu-song .mu-art .mu-eq i { background: #fff; }
    .app-music .mu-song.is-play .mu-eq i { animation: mu-eq .9s ease-in-out infinite; }
    .app-music .mu-eq i:nth-child(2) { animation-delay: -.35s !important; } .app-music .mu-eq i:nth-child(3) { animation-delay: -.6s !important; } .app-music .mu-eq i:nth-child(4) { animation-delay: -.15s !important; }
    @keyframes mu-eq { 0%,100% { height: 22%; } 30% { height: 95%; } 60% { height: 45%; } 80% { height: 75%; } }

    .app-music .mu-hero { display: flex; flex-direction: column; align-items: center; padding: 6px 24px 0; text-align: center; }
    .app-music .mu-hero .mu-art { width: 252px; height: 252px; border-radius: 10px; font-size: 42px; box-shadow: 0 16px 36px rgba(0,0,0,.24), 0 3px 8px rgba(0,0,0,.12); text-align: left; }
    .app-music .mu-hero h2 { margin: 18px 0 0; font-size: 20px; font-weight: 600; letter-spacing: -.3px; line-height: 25px; }
    .app-music .mu-hero h3 { margin: 0; font-size: 20px; font-weight: 400; color: var(--tint); letter-spacing: -.3px; line-height: 25px; cursor: pointer; }
    .app-music .mu-hero p { margin: 3px 0 0; font-size: 11px; font-weight: 600; color: var(--label2); letter-spacing: .3px; text-transform: uppercase; }
    .app-music .mu-cta { display: flex; gap: 14px; padding: 16px 20px 14px; }
    .app-music .mu-cta button { flex: 1; height: 48px; border-radius: 12px; background: var(--fill2) !important; color: var(--tint) !important; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 7px; transition: transform .25s ${EASE}, opacity .15s; }
    .app-music .mu-cta button:active { transform: scale(.96); opacity: .7; } .app-music .mu-cta button svg { width: 18px; height: 18px; }
    .app-music .mu-desc { padding: 0 20px 12px; font-size: 15px; color: var(--label2); line-height: 20px; letter-spacing: -.2px; }
    .app-music .mu-foot { padding: 14px 20px 6px; font-size: 15px; color: var(--label2); line-height: 20px; letter-spacing: -.2px; }
    .app-music .mu-artist { display: flex; align-items: center; gap: 14px; height: 60px; margin-left: 20px; padding-right: 18px; border-bottom: .5px solid var(--sep); cursor: pointer; font-size: 17px; }
    .app-music .mu-artist:active { opacity: .5; } .app-music .mu-artist .mu-art { width: 44px; height: 44px; border-radius: 50%; font-size: 0; } .app-music .mu-artist b { flex: 1; font-weight: 400; }
    .app-music .mu-cats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 20px 8px; }
    .app-music .mu-cat { position: relative; height: 100px; border-radius: 10px; overflow: hidden; cursor: pointer; color: #fff; font-size: 16px; font-weight: 700; letter-spacing: -.2px; transition: transform .3s ${EASE}; }
    .app-music .mu-cat:active { transform: scale(.96); } .app-music .mu-cat b { position: absolute; left: 12px; bottom: 10px; right: 12px; text-shadow: 0 1px 6px rgba(0,0,0,.35); }
    .app-music .mu-none { text-align: center; padding: 120px 40px 0; } .app-music .mu-none b { display: block; font-size: 20px; font-weight: 700; margin-bottom: 4px; } .app-music .mu-none span { color: var(--label2); font-size: 15px; }

    /* mini player */
    .app-music .mu-mini { position: absolute; left: 8px; right: 8px; bottom: 89px; height: 56px; border-radius: 14px; z-index: 35; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 8px; cursor: pointer;
      background: var(--material-thick, var(--bar)); backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8); box-shadow: 0 6px 22px rgba(0,0,0,.16), 0 0 0 .5px var(--sep);
      transition: transform .45s ${EASE}, opacity .3s; }
    .app-music .mu-mini.away { transform: translateY(40px) scale(.96); opacity: 0; pointer-events: none; }
    .app-music .mu-mini .mu-art { width: 40px; height: 40px; border-radius: 6px; font-size: 0; box-shadow: 0 2px 6px rgba(0,0,0,.18); transition: transform .4s ${EASE}; }
    .app-music .mu-mini.paused .mu-art { transform: scale(.88); }
    .app-music .mu-mini.empty .mu-art { background: var(--fill) !important; display: flex; align-items: center; justify-content: center; color: var(--label3); }
    .app-music .mu-mini .mu-art > svg { width: 20px; height: 20px; display: none; } .app-music .mu-mini.empty .mu-art > svg { display: block; }
    .app-music .mu-mini b { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; letter-spacing: -.25px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-mini button { width: 40px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--label); border-radius: 50%; transition: transform .2s ${EASE}, background .2s; }
    .app-music .mu-mini button:active { transform: scale(.86); background: var(--fill2); }
    .app-music .mu-mini button svg { width: 24px; height: 24px; } .app-music .mu-mini button[data-a="next"] svg { width: 28px; height: 28px; }
    .app-music .mu-mini.empty button[data-a="next"] { opacity: .3; pointer-events: none; }

    /* now playing */
    .app-music .mu-np { position: absolute; inset: 0; z-index: 60; overflow: hidden; color: #fff; background: #1b1b1f; border-radius: 0; transform: translateY(100%); transition: transform .5s ${EASE}, border-radius .3s; visibility: hidden; --tint: #fff; }
    .app-music .mu-np.open { transform: none; visibility: visible; } .app-music .mu-np.closing { visibility: visible; } .app-music .mu-np.drag { transition: none; border-radius: 38px 38px 0 0; }
    .app-music .mu-np-bg { position: absolute; inset: -30%; background-size: cover; filter: blur(64px) saturate(1.7); animation: mu-drift 38s linear infinite; transition: background 1s; }
    .app-music .mu-np-bg2 { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.42) 55%, rgba(0,0,0,.6)); }
    @keyframes mu-drift { 0% { transform: rotate(0deg) scale(1.15); } 50% { transform: rotate(180deg) scale(1.45); } 100% { transform: rotate(360deg) scale(1.15); } }
    .app-music .mu-np-grab { position: absolute; left: 0; right: 0; top: 0; height: 100px; cursor: grab; } .app-music .mu-np-grab::after { content: ''; position: absolute; left: 50%; top: 70px; width: 38px; height: 5px; margin-left: -19px; border-radius: 3px; background: rgba(255,255,255,.45); }
    .app-music .mu-np-art { position: absolute; left: 36px; top: 112px; width: 330px; height: 330px; border-radius: 12px; font-size: 54px; box-shadow: 0 24px 60px rgba(0,0,0,.42); cursor: grab;
      transition: transform .55s cubic-bezier(.3,1.35,.5,1), left .5s ${EASE}, top .5s ${EASE}, width .5s ${EASE}, height .5s ${EASE}, border-radius .5s, font-size .5s, box-shadow .5s; }
    .app-music .mu-np.paused .mu-np-art { transform: scale(.8); box-shadow: 0 12px 30px rgba(0,0,0,.3); }
    .app-music .mu-np.alt .mu-np-art { left: 28px; top: 96px; width: 64px; height: 64px; border-radius: 6px; font-size: 0; transform: none; box-shadow: 0 6px 16px rgba(0,0,0,.3); }
    .app-music .mu-np-meta { position: absolute; left: 32px; right: 28px; top: 478px; display: flex; align-items: center; gap: 10px; transition: opacity .3s, transform .5s ${EASE}; }
    .app-music .mu-np.alt .mu-np-meta { top: 102px; left: 106px; right: 24px; }
    .app-music .mu-np-tt { flex: 1; min-width: 0; -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent); mask-image: linear-gradient(90deg, #000 88%, transparent); }
    .app-music .mu-np-tt b { display: block; font-size: 21px; font-weight: 700; letter-spacing: -.3px; line-height: 26px; white-space: nowrap; }
    .app-music .mu-np-tt span { display: block; font-size: 20px; line-height: 25px; color: rgba(255,255,255,.62); letter-spacing: -.3px; white-space: nowrap; cursor: pointer; }
    .app-music .mu-np.alt .mu-np-tt b { font-size: 17px; line-height: 21px; } .app-music .mu-np.alt .mu-np-tt span { font-size: 15px; line-height: 19px; }
    .app-music .mu-np-rb { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.16) !important; color: #fff !important; display: flex; align-items: center; justify-content: center; flex: none; transition: transform .2s ${EASE}; }
    .app-music .mu-np-rb:active { transform: scale(.85); } .app-music .mu-np-rb svg { width: 17px; height: 17px; } .app-music .mu-np-rb.on { background: #fff !important; color: #FA243C !important; }
    .app-music .mu-np-rb.pop { animation: mu-pop .45s ${EASE}; } @keyframes mu-pop { 35% { transform: scale(1.35); } }
    .app-music .mu-np-panel { position: absolute; left: 0; right: 0; top: 176px; height: 372px; opacity: 0; pointer-events: none; transition: opacity .3s; -webkit-mask-image: linear-gradient(180deg, transparent, #000 14px, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(180deg, transparent, #000 14px, #000 calc(100% - 22px), transparent); }
    .app-music .mu-np.alt .mu-np-panel.on { opacity: 1; pointer-events: auto; }
    .app-music .mu-q-head { display: flex; align-items: center; gap: 8px; padding: 14px 24px 8px 28px; }
    .app-music .mu-q-head b { flex: 1; font-size: 17px; font-weight: 700; letter-spacing: -.3px; } .app-music .mu-q-head b span { display: block; font-size: 13px; font-weight: 400; color: rgba(255,255,255,.55); letter-spacing: -.08px; }
    .app-music .mu-q-tg { width: 44px; height: 30px; border-radius: 8px; background: rgba(255,255,255,.14) !important; color: #fff !important; display: flex; align-items: center; justify-content: center; position: relative; transition: transform .2s ${EASE}; }
    .app-music .mu-q-tg:active { transform: scale(.9); } .app-music .mu-q-tg svg { width: 19px; height: 19px; } .app-music .mu-q-tg.on { background: #fff !important; color: #222 !important; }
    .app-music .mu-q-tg u { position: absolute; right: 6px; bottom: 3px; font-size: 9px; font-weight: 800; text-decoration: none; display: none; } .app-music .mu-q-tg.one u { display: block; }
    .app-music .mu-q-row { display: flex; align-items: center; gap: 12px; padding: 6px 24px 6px 28px; cursor: pointer; } .app-music .mu-q-row:active { background: rgba(255,255,255,.08); }
    .app-music .mu-q-row .mu-art { width: 44px; height: 44px; border-radius: 5px; font-size: 0; }
    .app-music .mu-q-row div { flex: 1; min-width: 0; } .app-music .mu-q-row b { display: block; font-size: 16px; font-weight: 400; letter-spacing: -.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-music .mu-q-row span { display: block; font-size: 13px; color: rgba(255,255,255,.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .app-music .mu-q-row em { font-style: normal; font-size: 13px; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
    .app-music .mu-q-none { padding: 40px 40px 0; text-align: center; color: rgba(255,255,255,.55); font-size: 15px; }
    .app-music .mu-ly { height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 0 32px; }
    .app-music .mu-ly b { font-size: 30px; font-weight: 800; letter-spacing: -.4px; line-height: 36px; } .app-music .mu-ly span { margin-top: 10px; font-size: 17px; color: rgba(255,255,255,.6); line-height: 23px; }
    .app-music .mu-ly i { display: flex; gap: 9px; margin-bottom: 22px; } .app-music .mu-ly i u { width: 13px; height: 13px; border-radius: 50%; background: #fff; opacity: .35; animation: mu-dot 1.500s ease-in-out infinite; } .app-music .mu-ly i u:nth-child(2) { animation-delay: .25s; } .app-music .mu-ly i u:nth-child(3) { animation-delay: .5s; }
    .app-music .mu-np.paused .mu-ly i u { animation-play-state: paused; } @keyframes mu-dot { 0%,100% { opacity: .3; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
    .app-music .mu-bar { position: absolute; left: 32px; right: 32px; height: 30px; cursor: grab; touch-action: none; }
    .app-music .mu-bar > i { position: absolute; left: 0; right: 0; top: 11px; height: 7px; border-radius: 4px; background: rgba(255,255,255,.26); overflow: hidden; transition: height .3s ${EASE}, top .3s ${EASE}, border-radius .3s, transform .3s ${EASE}; }
    .app-music .mu-bar > i > u { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255,255,255,.62); transition: background .2s; }
    .app-music .mu-bar.act > i { height: 13px; top: 8px; border-radius: 7px; transform: scaleX(1.03); } .app-music .mu-bar.act > i > u { background: #fff; }
    .app-music .mu-np-scrub { top: 552px; }
    .app-music .mu-np-times { position: absolute; left: 32px; right: 32px; top: 580px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; letter-spacing: 0; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; transition: transform .3s ${EASE}, color .2s; }
    .app-music .mu-bar.act + .mu-np-times { transform: translateY(4px); color: #fff; }
    .app-music .mu-np-ctl { position: absolute; left: 0; right: 0; top: 622px; height: 76px; display: flex; align-items: center; justify-content: center; gap: 46px; }
    .app-music .mu-np-ctl button { width: 68px; height: 68px; border-radius: 50%; color: #fff !important; display: flex; align-items: center; justify-content: center; transition: transform .22s ${EASE}, background .25s; }
    .app-music .mu-np-ctl button:active { transform: scale(.84); background: rgba(255,255,255,.16); } .app-music .mu-np-ctl svg { width: 42px; height: 42px; } .app-music .mu-np-ctl [data-a="toggle"] svg { width: 46px; height: 46px; }
    .app-music .mu-np-vol { position: absolute; left: 0; right: 0; top: 722px; height: 30px; color: rgba(255,255,255,.6); }
    .app-music .mu-np-vol > svg { position: absolute; top: 5px; width: 20px; height: 20px; } .app-music .mu-np-vol > svg:first-child { left: 30px; } .app-music .mu-np-vol > svg:last-child { right: 26px; width: 22px; }
    .app-music .mu-np-vol .mu-bar { left: 62px; right: 62px; top: 0; }
    .app-music .mu-np-btm { position: absolute; left: 0; right: 0; top: 774px; display: flex; justify-content: center; gap: 62px; }
    .app-music .mu-np-btm button { width: 44px; height: 40px; border-radius: 10px; color: rgba(255,255,255,.72) !important; display: flex; align-items: center; justify-content: center; transition: transform .2s ${EASE}, background .25s, color .25s; }
    .app-music .mu-np-btm button:active { transform: scale(.88); } .app-music .mu-np-btm svg { width: 25px; height: 25px; } .app-music .mu-np-btm button.on { background: rgba(255,255,255,.9); color: #333 !important; }
  `);

  /* ───────────────────────── catalogue ───────────────────────── */
  const ART = {
    drive: 'radial-gradient(circle at 50% 58%, #ffe08a 0 13%, #ff9a5c 13.500% 20%, #ff4f8f 20.500% 27%, transparent 27.500%), repeating-linear-gradient(90deg, rgba(255,120,220,.55) 0 1.500px, transparent 1.500px 12.500%), repeating-linear-gradient(180deg, transparent 0 66%, rgba(255,120,220,.5) 66% 66.800%, transparent 66.800% 74%, rgba(255,120,220,.5) 74% 75%, transparent 75% 85%, rgba(255,120,220,.5) 85% 86.200%, transparent 86.200% 100%), linear-gradient(180deg, #12082e 0%, #3b1469 38%, #b0257f 58%, #ff6a88 62%, #170a33 62.500%, #0d0620 100%)',
    lantern: 'radial-gradient(circle at 28% 30%, #ffe1a8 0 9%, rgba(255,190,120,.35) 9.500% 17%, transparent 17.500%), radial-gradient(circle at 70% 44%, #ffc58a 0 7%, rgba(255,170,110,.3) 7.500% 13%, transparent 13.500%), radial-gradient(circle at 44% 70%, #ff9f7a 0 5.500%, rgba(255,140,110,.28) 6% 10%, transparent 10.500%), radial-gradient(circle at 84% 78%, #ffd59a 0 3.500%, transparent 4%), linear-gradient(160deg, #1f2a52 0%, #4a3f7c 45%, #a35f86 78%, #e79a7c 100%)',
    pixel: 'linear-gradient(135deg, rgba(88,28,180,.78), rgba(14,165,233,.35) 60%, rgba(45,226,166,.55)), conic-gradient(#22d3ee 25%, #1e1b4b 0 50%, #22d3ee 0 75%, #1e1b4b 0) 0 0 / 20% 20%',
    ring: 'radial-gradient(circle at 50% 50%, #fff 0 5%, transparent 5.500% 15%, rgba(255,255,255,.5) 15.500% 17%, transparent 17.500% 28%, rgba(255,255,255,.32) 28.500% 30%, transparent 30.500% 42%, rgba(255,255,255,.18) 42.500% 44%, transparent 44.500%), linear-gradient(145deg, #9aa7bd, #56627c 55%, #2c3448)',
    chill: 'radial-gradient(circle at 20% 20%, #9be7ff, transparent 55%), radial-gradient(circle at 85% 30%, #b892ff, transparent 50%), radial-gradient(circle at 60% 90%, #ff9ecd, transparent 55%), linear-gradient(135deg, #4f7cff, #7a5cff)',
    night: 'radial-gradient(circle at 80% 15%, #ff5fa2, transparent 50%), radial-gradient(circle at 15% 85%, #6a3cff, transparent 55%), linear-gradient(160deg, #1a0b3d, #3d1466 60%, #ff4f8f)',
    arcade: 'radial-gradient(circle at 25% 80%, #2de2a6, transparent 55%), radial-gradient(circle at 80% 20%, #ffd23f, transparent 50%), linear-gradient(135deg, #0ea5e9, #6d28d9)',
    fav: 'radial-gradient(circle at 30% 25%, #ff8aa0, transparent 55%), linear-gradient(140deg, #ff375f, #fa233b 55%, #b3123a)',
  };
  const song = (style, key, bpm, bars, seed, prog, x) => Object.assign({ style, key, bpm, bars, seed, prog }, x || {});
  const ALBUMS = [
    { id: 'drive', title: 'Midnight Drive', artist: 'Neon Harbor', year: 2025, genre: 'Synthwave', art: ART.drive, tint: '#7a1f7f', note: 'Analog arps, gated drums and a sun that never quite sets. Synthesized live on this iPhone.' },
    { id: 'lantern', title: 'Paper Lanterns', artist: 'Low Tide Club', year: 2026, genre: 'Lo-Fi · Ambient', art: ART.lantern, tint: '#5a4580', note: 'Dusty keys, slow tides and late-night piano for studying, reading or doing nothing at all.' },
    { id: 'pixel', title: 'Pixel Quest', artist: '8-Bit Atlas', year: 2024, genre: 'Chiptune', art: ART.pixel, tint: '#3a2aa0', note: 'Three square waves, one triangle and a noise channel. Press Start.' },
  ];
  const TRACKS = [
    { id: 's1', album: 'drive', title: 'Midnight Drive', song: song('wave', 45, 100, 64, 11, [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']]) },
    { id: 's2', album: 'drive', title: 'Chrome Horizon', song: song('wave', 40, 112, 68, 23, [[0, 'min'], [5, 'min'], [8, 'maj'], [7, 'maj']], { lead: 'square' }) },
    { id: 's3', album: 'drive', title: 'Afterglow', song: song('wave', 38, 88, 44, 37, [[0, 'min9'], [8, 'maj7'], [3, 'maj7'], [10, 'sus2']], { soft: true }) },
    { id: 's4', album: 'lantern', title: 'Rainy Window', song: song('lofi', 48, 76, 40, 41, [[2, 'min9'], [7, 'dom9'], [0, 'maj9'], [9, 'min9']]) },
    { id: 's5', album: 'lantern', title: 'Paper Lanterns', song: song('piano', 53, 70, 36, 53, [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']]) },
    { id: 's6', album: 'lantern', title: 'Slow Tide', song: song('ambient', 50, 60, 36, 67, [[0, 'maj9'], [0, 'maj9'], [5, 'maj9'], [5, 'maj9'], [9, 'min9'], [9, 'min9'], [5, 'maj9'], [7, 'sus2']]) },
    { id: 's7', album: 'lantern', title: 'Sunday Cassette', song: song('lofi', 51, 84, 44, 71, [[0, 'maj9'], [9, 'min9'], [2, 'min9'], [7, 'dom9']], { bright: true }) },
    { id: 's8', album: 'pixel', title: 'Pixel Quest', song: song('chip', 60, 150, 72, 83, [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj'], [7, 'maj']]) },
    { id: 's9', album: 'pixel', title: 'Boss Rush', song: song('chip', 57, 172, 80, 97, [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']], { minor: true, hard: true }) },
    { id: 's10', album: 'pixel', title: 'Save Point', song: song('chip', 55, 96, 44, 101, [[0, 'maj7'], [9, 'min7'], [5, 'maj7'], [7, 'maj']], { gentle: true }) },
  ];
  TRACKS.forEach((t) => { const a = ALBUMS.find((x) => x.id === t.album); t.artist = a.artist; t.kind = 'synth'; t.dur = t.song.bars * 240 / t.song.bpm; });
  const PLAYLISTS = [
    { id: 'pl-chill', title: 'Chill Mix', label: 'Chill<br>Mix', artist: 'Made for You', art: ART.chill, tint: '#4f6cd8', playlist: true, ids: ['s4', 's6', 's5', 's7', 's3', 's10'], note: 'Unhurried keys and soft edges, updated for you.' },
    { id: 'pl-night', title: 'Night Drive', label: 'Night<br>Drive', artist: 'Apple Music Synthwave', art: ART.night, tint: '#5a1d70', playlist: true, ids: ['s1', 's2', 's3', 's9'], note: 'Windows down, city lights smearing past.' },
    { id: 'pl-arcade', title: 'Arcade Classics', label: 'Arcade<br>Classics', artist: 'Apple Music Gaming', art: ART.arcade, tint: '#2563a8', playlist: true, ids: ['s8', 's9', 's10', 's2'], note: 'High scores only.' },
    { id: 'pl-fav', title: 'Favorite Songs', label: 'Favorite<br>Songs', artist: 'Playlist', art: ART.fav, tint: '#b3123a', playlist: true, fav: true, ids: [], note: 'Songs you mark with a star appear here.' },
  ];
  const byId = (id) => TRACKS.find((t) => t.id === id);
  const albumOf = (t) => ALBUMS.find((a) => a.id === t.album);
  const artOf = (t) => (albumOf(t) || {}).art || '#555';
  const collection = (id) => ALBUMS.find((a) => a.id === id) || PLAYLISTS.find((p) => p.id === id);
  const loved = () => OS.store.get('music.loved', []) || [];
  function tracksOf(c) { if (!c) return []; if (c.fav) return loved().map(byId).filter(Boolean); if (c.playlist) return c.ids.map(byId).filter(Boolean); return TRACKS.filter((t) => t.album === c.id); }
  const fmt = (s) => { if (!isFinite(s) || s < 0) s = 0; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const artHTML = (c, cls = '', tag = 'div') => `<${tag} class="mu-art ${cls}" style="background:${c.art}">${c.playlist ? `<em>${IC.note}Music</em><span>${c.label}</span>` : ''}</${tag}>`;

  let ringsLoaded = null;
  function loadRingtones() {
    if (ringsLoaded) return ringsLoaded;
    ringsLoaded = OS.sound.list().then((ids) => {
      const rt = (ids || []).filter((i) => i.indexOf('ringtone:') === 0).sort((a, b) => a.localeCompare(b));
      if (!rt.length || ALBUMS.some((a) => a.id === 'ring')) return;
      const durs = OS.store.get('music.durs', {}) || {}, first = ['ringtone:Reflection', 'ringtone:Opening'];
      rt.sort((a, b) => (first.indexOf(b) - first.indexOf(a)) || 0);
      ALBUMS.push({ id: 'ring', title: 'Ringtones', artist: 'iPhone', year: 2007, genre: 'Ringtones', art: ART.ring, tint: '#56627c', note: 'The genuine ringtones that ship on iPhone, from Marimba to Reflection.' });
      rt.forEach((id) => TRACKS.push({ id, album: 'ring', title: id.slice(9), artist: 'iPhone', kind: 'file', url: OS.sound.url(id), dur: durs[id] || 0 }));
    }).catch(() => {});
    return ringsLoaded;
  }

  /* ───────────────────────── synthesizer ───────────────────────── */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const CH = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14], dom9: [0, 4, 7, 10, 14], sus2: [0, 2, 7] };
  const SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentM: [0, 2, 4, 7, 9], pentm: [0, 3, 5, 7, 10] };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const scaleNote = (sc, i) => { const n = sc.length, o = Math.floor(i / n); return sc[((i % n) + n) % n] + o * 12; };

  const Synth = (() => {
    let ctx = null, out = null, bus = null, tone, sendD, sendR, delay, fb, noiseBuf = null, timer = 0, cur = null, bed = null;
    const live = new Set();
    function init() {
      if (out) return true;
      ctx = OS.sound.ctx; if (!ctx) return false;
      out = ctx.createGain(); out.gain.value = 0; out.connect(OS.sound.mediaOut);
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = .006; comp.release.value = .2; comp.connect(out);
      tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 18000; tone.Q.value = .4; tone.connect(comp);
      const dry = ctx.createGain(); dry.connect(tone);
      sendD = ctx.createGain(); delay = ctx.createDelay(1.5); fb = ctx.createGain(); fb.gain.value = .36; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
      sendD.connect(delay); delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(tone);
      sendR = ctx.createGain(); const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate), r = rng(7);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      conv.buffer = ir; const rw = ctx.createGain(); rw.gain.value = .55; sendR.connect(conv); conv.connect(rw); rw.connect(tone);
      const mk = (d, v) => { const g = ctx.createGain(); g.connect(dry); if (d) { const s = ctx.createGain(); s.gain.value = d; g.connect(s); s.connect(sendD); } if (v) { const s = ctx.createGain(); s.gain.value = v; g.connect(s); s.connect(sendR); } return g; };
      bus = { dry: mk(0, 0), room: mk(0, .22), verb: mk(0, .6), echo: mk(.34, .3), wash: mk(.3, .95) };
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0), nr = rng(3); for (let i = 0; i < nd.length; i++) nd[i] = nr() * 2 - 1;
      return true;
    }
    const keep = (src, g) => { live.add(src); src.onended = () => { live.delete(src); try { g.disconnect(); } catch (e) {} }; };
    /* one enveloped oscillator voice */
    function v(t, m, dur, o) {
      const osc = ctx.createOscillator(), g = ctx.createGain(), f = mtof(m); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
      if (o.det) osc.detune.setValueAtTime(o.det, t);
      if (o.bend) { osc.frequency.setValueAtTime(f * o.bend, t); osc.frequency.exponentialRampToValueAtTime(f, t + (o.bendT || .05)); }
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * .008 * o.vib, t + Math.min(.4, dur)); l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 1); }
      let last = osc;
      if (o.lp) { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.Q.value = o.q || .8; if (o.env) { b.frequency.setValueAtTime(Math.min(16000, o.lp * o.env), t); b.frequency.exponentialRampToValueAtTime(o.lp, t + (o.envT || .18)); } else b.frequency.setValueAtTime(o.lp, t); osc.connect(b); last = b; }
      const a = o.a || .004, r = o.r || .08, pk = o.g || .15;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a);
      if (o.dec) g.gain.setTargetAtTime(pk * (o.sus || 0), t + a, o.dec);
      g.gain.setTargetAtTime(0, t + Math.max(a, dur), r / 3);
      last.connect(g); g.connect(o.bus || bus.dry); osc.start(t); osc.stop(t + Math.max(a, dur) + r * 2 + .05); keep(osc, g);
    }
    function nz(t, dur, o) {
      const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
      b.type = o.type || 'highpass'; b.frequency.setValueAtTime(o.f || 6000, t); if (o.f2) b.frequency.exponentialRampToValueAtTime(o.f2, t + dur); b.Q.value = o.q || .7;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.g || .2, t + (o.a || .002)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(b); b.connect(g); g.connect(o.bus || bus.dry); s.start(t, (t * 7.13) % 1.5); s.stop(t + dur + .03); keep(s, g);
    }
    const I = {
      kick: (t, g = .9, deep) => { v(t, deep ? 31 : 36, .16, { type: 'sine', g, bend: deep ? 3.4 : 4.2, bendT: .07, a: .001, dec: .09, r: .12 }); nz(t, .02, { type: 'lowpass', f: 2600, g: g * .25 }); },
      snare: (t, g = .4, big) => { nz(t, big ? .34 : .16, { type: 'bandpass', f: 1900, q: .6, g, bus: big ? bus.verb : bus.room }); v(t, 55, .08, { type: 'triangle', g: g * .55, bend: 1.6, a: .001, dec: .04, r: .06 }); },
      hat: (t, g = .12, open) => nz(t, open ? .22 : .045, { f: 7800, g }),
      rim: (t, g = .2) => { nz(t, .03, { type: 'bandpass', f: 2600, q: 3, g }); v(t, 84, .02, { type: 'square', g: g * .25, r: .02 }); },
      keys: (t, m, dur, g = .1) => { v(t, m, dur, { type: 'sine', g, dec: .7, sus: .25, r: .5, bus: bus.room }); v(t, m, dur * .7, { type: 'triangle', g: g * .45, dec: .3, sus: .1, r: .3, lp: 1800, bus: bus.room }); v(t, m + 12, .2, { type: 'sine', g: g * .16, dec: .08, r: .1, bus: bus.room }); },
      piano: (t, m, dur, g = .13) => { const br = 900 + (m - 40) * 38; v(t, m, dur, { type: 'triangle', g, dec: .9 + (84 - m) * .02, sus: .08, r: .7, lp: br, env: 3.2, envT: .25, bus: bus.verb }); v(t, m, dur, { type: 'sine', g: g * .7, dec: 1.4, sus: .1, r: .8, bus: bus.verb }); v(t, m + 12.04, dur * .5, { type: 'sine', g: g * .2, dec: .35, r: .3, bus: bus.verb }); v(t, m + 19.02, .3, { type: 'sine', g: g * .07, dec: .12, r: .15, bus: bus.verb }); },
      pad: (t, ms, dur, g = .035, lp = 1100, a = .5) => ms.forEach((m) => { v(t, m, dur, { type: 'sawtooth', g, a, r: 1.4, det: -9, lp, bus: bus.verb }); v(t, m, dur, { type: 'sawtooth', g, a, r: 1.4, det: 8, lp, bus: bus.verb }); }),
      bell: (t, m, g = .08) => { v(t, m, .1, { type: 'sine', g, dec: .9, sus: 0, r: 2.4, bus: bus.wash }); v(t, m + 12, .05, { type: 'sine', g: g * .35, dec: .5, r: 1.5, bus: bus.wash }); v(t, m + 28.2, .03, { type: 'sine', g: g * .12, dec: .2, r: .7, bus: bus.wash }); },
      sub: (t, m, dur, g = .2) => v(t, m, dur, { type: 'sine', g, a: .012, r: .12 }),
    };

    /* deterministic per-bar melody: 8-bar phrases that repeat once, then evolve every 16 bars */
    function melody(sg, bar, o) {
      const k = (bar % 8) + ':' + Math.floor(bar / 16) + ':' + o.id; if (sg.cache[k]) return sg.cache[k];
      const r = rng(sg.seed * 131 + (bar % 8) * 31 + Math.floor(bar / 16) * 977 + o.id * 13), pat = o.rhythms[Math.floor(r() * o.rhythms.length)], sc = SC[o.scale];
      const ch = sg.prog[bar % sg.prog.length], tones = CH[ch[1]].map((x) => (x + ch[0]) % 12); let idx = o.center + Math.floor(r() * 5) - 2;
      const notes = pat.map(([s0, ln]) => {
        idx = U.clamp(idx + [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(r() * 8)], o.lo, o.hi); let semi = scaleNote(sc, idx);
        if (s0 % 8 === 0) { let best = semi, bd = 9; for (let d = -3; d <= 3; d++) { const pc = (((semi + d) % 12) + 12) % 12; if (tones.indexOf(pc) >= 0 && Math.abs(d) < bd) { bd = Math.abs(d); best = semi + d; } } semi = best; }
        return { s: s0, ln, m: sg.key + o.oct * 12 + semi, vel: .75 + r() * .25 };
      });
      return (sg.cache[k] = notes);
    }
    const form = (sg, bar) => { const n = sg.bars, intro = bar < 4, outro = bar >= n - 4, brk = bar >= Math.floor(n * .5) && bar < Math.floor(n * .5) + 4, last = bar >= n - 1; return { intro, outro, brk, last, full: !intro && !outro && !brk, second: bar >= 16, lvl: outro ? Math.max(.25, (n - bar) / 5) : 1 }; };
    const R8 = [[[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 4], [10, 2], [12, 4]], [[0, 6], [6, 2], [8, 6], [14, 2]], [[2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]], [[0, 8], [8, 4], [12, 4]]];
    const RS = [[[0, 6], [8, 6]], [[0, 4], [6, 6], [12, 4]], [[4, 4], [8, 8]], [[0, 12]], [[2, 6], [10, 6]]];
    const R16 = [[[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 2], [10, 1], [11, 1], [12, 4]], [[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]], [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]], [[0, 4], [4, 2], [6, 1], [7, 1], [8, 4], [12, 2], [14, 2]]];

    const STYLE = {
      wave(sg, n, t, sd) {
        const bar = Math.floor(n / 16), s = n % 16, F = form(sg, bar), ch = sg.prog[bar % sg.prog.length], root = sg.key + ch[0], tones = CH[ch[1]], L = F.lvl, soft = sg.soft;
        if (s === 0) I.pad(t, tones.map((x) => root + 12 + x), sd * 16, (soft ? .034 : .026) * L, F.intro || F.brk ? 700 : 1300, .35);
        if (!F.intro && !F.brk && s % 2 === 0) v(t, root - 12 + (s % 8 === 6 ? 12 : 0), sd * 1.7, { type: 'sawtooth', g: .17 * L, lp: 420, env: 5, envT: .13, q: 3, r: .06 });
        if (F.brk && s === 0) I.sub(t, root - 12, sd * 15, .2);
        if (F.full || (F.outro && !F.last)) {
          if (s % 4 === 0) I.kick(t, .8 * L, true); if (s === 4 || s === 12) I.snare(t, (soft ? .22 : .34) * L, true);
          if (!soft || s % 2 === 0) I.hat(t, (s % 4 === 2 ? .1 : .045) * L, s === 14 && bar % 4 === 3);
        }
        if (F.brk && bar % 4 === 3 && s >= 8) I.snare(t, .1 + (s - 8) * .03, false);
        if (!F.last) { const seq = [0, 1, 2, 1, 3 % tones.length, 2, 1, 2], tn = tones[seq[s % 8] % tones.length] + (s % 8 >= 4 ? 12 : 0); if (!soft || s % 2 === 0) v(t, root + 24 + tn, sd * (soft ? 1.6 : .8), { type: sg.lead === 'square' ? 'square' : 'sawtooth', g: (F.intro ? .03 : .045) * L, lp: F.intro ? 900 + n * 22 : 2600, env: 2, envT: .08, q: 2, r: .1, bus: bus.echo }); }
        if (F.second && F.full) melody(sg, bar, { id: 1, rhythms: RS, scale: 'minor', center: 9, lo: 5, hi: 15, oct: 2 }).forEach((nt) => { if (nt.s === s) v(t, nt.m, sd * nt.ln * .95, { type: 'sawtooth', g: .075 * nt.vel, lp: 3000, env: 1.8, a: .02, r: .25, vib: 1, det: 5, bus: bus.echo }); });
      },
      lofi(sg, n, t, sd) {
        const bar = Math.floor(n / 16), s = n % 16, F = form(sg, bar), ch = sg.prog[bar % sg.prog.length], root = sg.key + ch[0], tones = CH[ch[1]], L = F.lvl, r = rng(sg.seed + n * 17);
        if (s % 2 === 1) t += sd * .34;                              // swing
        t += (r() - .5) * .012;                                      // human timing
        const chordAt = (tt, g) => tones.forEach((x, i) => I.keys(tt + i * .018, root + 12 + (x > 12 ? x - 12 : x) + (i === 0 ? -12 : 0), sd * 7, g * (i === 0 ? 1.2 : 1)));
        if (s === 0) chordAt(t, .085 * L); if (s === 10 && bar % 2 === 1) chordAt(t, .06 * L);
        if (!F.intro && (s === 0 || s === 7 || s === 10)) I.sub(t, root - 12 + (s === 7 ? 7 : 0), sd * (s === 0 ? 5 : 2.4), .24 * L);
        if (F.full || F.outro) {
          if (s === 0 || s === 10 || (s === 7 && bar % 2)) I.kick(t, .62 * L); if (s === 4 || s === 12) { I.snare(t, .2 * L); I.rim(t, .12 * L); }
          if (s % 2 === 0 || r() < .25) I.hat(t, (.03 + r() * .05) * L, s === 6 && r() < .3);
        }
        if (!F.intro && !F.last && (bar % 4 < 3)) melody(sg, bar, { id: 2, rhythms: R8, scale: 'pentM', center: 8, lo: 4, hi: 13, oct: 2 }).forEach((nt) => { if (nt.s === s && (F.brk || r() < .85)) { v(t, nt.m, sd * nt.ln, { type: 'triangle', g: .085 * nt.vel * L, dec: .5, sus: .3, r: .4, lp: sg.bright ? 2600 : 1700, a: .012, bus: bus.echo }); } });
      },
      piano(sg, n, t, sd) {
        const bar = Math.floor(n / 16), s = n % 16, F = form(sg, bar), ch = sg.prog[bar % sg.prog.length], root = sg.key + ch[0], tones = CH[ch[1]], L = F.lvl, r = rng(sg.seed + n * 29);
        t += (r() - .5) * .014; const rub = F.last ? 1.6 : 1;
        if (s % 2 === 0 && !F.last) { const arp = [0, 7, 12 + tones[1], 7, 12, 7, 12 + tones[1], 12 + tones[2] - 12 + 0][s / 2]; I.piano(t, root - 12 + arp, sd * 5, (s === 0 ? .1 : .06) * L * (F.intro ? .8 : 1)); }
        if (F.last && s === 0) [0, 7, 12, 12 + tones[1], 19, 24].forEach((x, i) => I.piano(t + i * .09 * rub, root - 12 + x, 4, .085));
        if (!F.intro && !F.last) melody(sg, bar, { id: 3, rhythms: F.brk ? RS : R8, scale: 'major', center: 10, lo: 5, hi: 17, oct: 1 }).forEach((nt) => { if (nt.s === s) { I.piano(t, nt.m + 12, sd * nt.ln * 1.5, .12 * nt.vel * L); if (F.second && nt.s % 8 === 0 && !F.brk) I.piano(t, nt.m, sd * nt.ln, .05 * L); } });
      },
      ambient(sg, n, t, sd) {
        const bar = Math.floor(n / 16), s = n % 16, F = form(sg, bar), ch = sg.prog[bar % sg.prog.length], root = sg.key + ch[0], tones = CH[ch[1]], L = F.lvl, r = rng(sg.seed + n * 13);
        if (s === 0 && bar % 2 === 0) { I.pad(t, tones.map((x) => root + 12 + x), sd * 34, .03 * L, 900 + (F.full ? 500 : 0), 3.2); I.sub(t, root - 12, sd * 30, .13 * L); v(t, root + 24 + tones[2], sd * 30, { type: 'sine', g: .022 * L, a: 4, r: 3, bus: bus.wash }); }
        if (s === 0 && bar % 4 === 2) nz(t, sd * 30, { type: 'bandpass', f: 500, f2: 2400, q: 1.2, g: .035 * L, a: sd * 12, bus: bus.wash });
        if (!F.intro && s % 2 === 0 && r() < (F.brk ? .16 : .3)) { const sc = SC.pentM, m = sg.key + 36 + scaleNote(sc, Math.floor(r() * 9)) + (tones.indexOf(11) >= 0 ? 0 : 0); I.bell(t + r() * sd, m, (.035 + r() * .045) * L); }
      },
      chip(sg, n, t, sd) {
        const bar = Math.floor(n / 16), s = n % 16, F = form(sg, bar), ch = sg.prog[bar % sg.prog.length], root = sg.key + ch[0], tones = CH[ch[1]], L = F.lvl, gentle = sg.gentle;
        const sq = (tt, m, d, g, o) => v(tt, m, d, Object.assign({ type: 'square', g, a: .002, r: .03, dec: gentle ? .25 : .12, sus: .55, bus: gentle ? bus.room : bus.dry }, o || {}));
        if (s % 2 === 0 && !(F.intro && bar < 2)) v(t, root - 12 + (s % 4 === 2 ? 7 : 0) + (s === 14 ? 12 : 0), sd * 1.6, { type: 'triangle', g: .3 * L, a: .002, r: .03 });
        if (!F.brk && !gentle) sq(t, root + 12 + tones[s % tones.length] + (s % 8 >= 4 ? 12 : 0), sd * .8, .028 * L, { dec: .05, sus: .2 });
        if (gentle && s % 4 === 0) tones.forEach((x, i) => sq(t + i * sd * .5, root + 12 + x, sd * 3, .03 * L));
        if (F.full || F.outro) { if (s % 4 === 0 || (sg.hard && s === 10)) v(t, 40, .07, { type: 'triangle', g: .42 * L, bend: 4, bendT: .05, a: .001, r: .04 }); if (s === 4 || s === 12) nz(t, .09, { type: 'highpass', f: 1500, g: .16 * L }); if (s % 2 === 0 || sg.hard) nz(t, .025, { f: 9000, g: (s % 4 === 2 ? .07 : .035) * L }); }
        if (F.brk && bar % 4 === 3 && s >= 12) nz(t, .05, { f: 1200, g: .1 + (s - 12) * .03 });
        if (!F.intro && !F.last) melody(sg, bar, { id: 4, rhythms: gentle ? R8 : R16, scale: sg.minor ? 'minor' : 'major', center: 8, lo: 3, hi: 15, oct: 1 }).forEach((nt) => { if (nt.s === s) { sq(t, nt.m + 12, sd * nt.ln * .9, .075 * nt.vel * L, { vib: nt.ln >= 4 ? 1 : 0 }); if (!gentle) sq(t + sd * 3, nt.m + 12, sd * Math.min(2, nt.ln) * .8, .022 * L, { det: 8 }); } });
        if (F.last && s === 0) [0, 4, 7, 12, 16, 19, 24].forEach((x, i) => sq(t + i * sd, root + 12 + (tones[1] === 3 && (x % 12 === 4) ? x - 1 : x), sd * 1.5, .06));
      },
    };

    function tick() {
      if (!cur) return;
      const look = document.hidden ? 2.2 : .3, sd = cur.sd;
      while (cur.step < cur.total && cur.origin + cur.step * sd < ctx.currentTime + look) {
        const t = Math.max(ctx.currentTime + .005, cur.origin + cur.step * sd);
        try { STYLE[cur.sg.style](cur.sg, cur.step, t, sd); } catch (e) { console.error('[music synth]', e); }
        cur.step++;
      }
      if (ctx.currentTime - cur.origin >= cur.dur) { const cb = cur.onEnd; halt(); cb && cb(); }
    }
    function startBed(sg) {
      stopBed(); if (sg.style !== 'lofi') return;
      const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true; b.type = 'bandpass'; b.frequency.value = 3800; b.Q.value = .5; g.gain.value = .012;
      s.connect(b); b.connect(g); g.connect(bus.dry); s.start(); bed = { s, g };
    }
    function stopBed() { if (bed) { try { bed.s.stop(); bed.g.disconnect(); } catch (e) {} bed = null; } }
    function halt() {
      clearInterval(timer); timer = 0; cur = null; stopBed();
      if (out) { const now = ctx.currentTime; out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, .015); }
      const dead = [...live]; live.clear(); setTimeout(() => dead.forEach((s) => { try { s.onended = null; s.stop(); s.disconnect(); } catch (e) {} }), 90);
    }
    const onVis = () => { if (cur) tick(); };
    return {
      start(sg, pos, onEnd) {
        if (!init()) return false; halt();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const sd = 60 / sg.bpm / 4, barDur = sd * 16, bar = U.clamp(Math.floor((pos || 0) / barDur + .0001), 0, sg.bars - 1);
        sg.cache = sg.cache || {};
        tone.frequency.setTargetAtTime(sg.style === 'lofi' ? (sg.bright ? 5200 : 3800) : sg.style === 'ambient' ? 7000 : 17000, ctx.currentTime, .05);
        delay.delayTime.setTargetAtTime(Math.min(1.4, sd * (sg.style === 'ambient' ? 6 : 3)), ctx.currentTime, .01); fb.gain.setTargetAtTime(sg.style === 'ambient' ? .5 : .34, ctx.currentTime, .05);
        cur = { sg, sd, step: bar * 16, total: sg.bars * 16, dur: sg.bars * barDur, origin: ctx.currentTime + .12 - bar * barDur, onEnd };
        out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(1, ctx.currentTime + .1, .03);
        startBed(sg); tick(); timer = setInterval(tick, 60);
        document.removeEventListener('visibilitychange', onVis); document.addEventListener('visibilitychange', onVis);
        return true;
      },
      stop() { halt(); },
      pos() { return cur ? U.clamp(ctx.currentTime - cur.origin, 0, cur.dur) : 0; },
      active() { return !!cur; },
      dispose() { halt(); document.removeEventListener('visibilitychange', onVis); if (out) { const o = out; setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 200); out = null; bus = null; } },
    };
  })();

  /* ───────────────────────── player ───────────────────────── */
  const P = { queue: [], base: [], idx: -1, playing: false, shuffle: false, repeat: 'off', pos: 0, audio: null, source: null, ticker: 0, lastNP: 0 };
  const current = () => P.queue[P.idx] || null;
  function ensureAudio() {
    if (P.audio) return P.audio;
    const a = P.audio = new Audio(); a.preload = 'auto'; a.volume = U.clamp(OS.settings.get('volume'), 0, 1);
    a.addEventListener('ended', () => { if (current() && current().kind === 'file') advance(true); });
    a.addEventListener('loadedmetadata', () => { const t = current(); if (t && t.kind === 'file' && isFinite(a.duration)) { t.dur = a.duration; const d = OS.store.get('music.durs', {}) || {}; d[t.id] = a.duration; OS.store.set('music.durs', d); changed(); } });
    a.addEventListener('error', () => { const t = current(); if (t && t.kind === 'file' && P.playing) { OS.ui.toast('Unable to Play “' + t.title + '”'); advance(true); } });
    return a;
  }
  function position() { const t = current(); if (!t) return 0; if (!P.playing) return P.pos; return t.kind === 'file' ? (P.audio ? P.audio.currentTime : 0) : Synth.pos(); }
  function duration() { const t = current(); if (!t) return 0; if (t.kind === 'file' && P.audio && isFinite(P.audio.duration) && P.audio.duration) return P.audio.duration; return t.dur || 0; }
  function silence() { Synth.stop(); if (P.audio) { try { P.audio.pause(); } catch (e) {} } }
  function startAt(pos) {
    const t = current(); if (!t) return; silence(); P.playing = true;
    if (t.kind === 'file') {
      const a = ensureAudio(); if (a._id !== t.id) { a.src = t.url; a._id = t.id; }
      try { a.currentTime = pos || 0; } catch (e) {}
      const pr = a.play(); if (pr && pr.catch) pr.catch(() => { if (current() === t) { P.playing = false; P.pos = pos || 0; changed(); } });
    } else {
      const sd = 240 / t.song.bpm; P.pos = Math.floor((pos || 0) / sd + .0001) * sd;
      if (!Synth.start(t.song, pos || 0, () => advance(true))) { P.playing = false; OS.ui.toast('Audio Unavailable'); }
    }
    changed();
  }
  function pause() { if (!P.playing) return; P.pos = position(); P.playing = false; silence(); changed(); }
  function resume() { if (!current()) return playAll(true); startAt(P.pos); }
  function toggle() { if (P.playing) pause(); else resume(); }
  function seek(sec) { const t = current(); if (!t) return; sec = U.clamp(sec, 0, Math.max(0, duration() - .25)); if (P.playing) startAt(sec); else { P.pos = t.kind === 'synth' ? Math.floor(sec / (240 / t.song.bpm)) * (240 / t.song.bpm) : sec; changed(); } }
  function go(i, play = true) { P.idx = i; P.pos = 0; if (play) startAt(0); else { silence(); P.playing = false; changed(); } }
  function advance(auto) {
    if (!P.queue.length) return;
    if (auto && P.repeat === 'one') return startAt(0);
    if (P.idx + 1 < P.queue.length) return go(P.idx + 1, auto ? true : P.playing || true);
    if (P.repeat === 'all' || !auto) return go(0, true);
    go(0, false);                                                   // reached the end of the queue
  }
  function previous() { if (!current()) return; if (position() > 3 || P.idx === 0) return P.playing ? startAt(0) : seek(0); go(P.idx - 1, true); }
  function shuffled(list, keepFirst) { const a = list.slice(), first = keepFirst ? a.splice(a.indexOf(keepFirst), 1) : []; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return first.concat(a); }
  function playList(tracks, startIdx, opts) {
    tracks = tracks.filter(Boolean); if (!tracks.length) return;
    opts = opts || {}; if (opts.shuffle != null) P.shuffle = !!opts.shuffle;
    P.base = tracks.slice(); P.source = opts.source || null;
    const first = startIdx == null ? null : tracks[startIdx];
    P.queue = P.shuffle ? shuffled(tracks, first) : tracks.slice();
    if (opts.source) { const rec = (OS.store.get('music.recent', []) || []).filter((x) => x !== opts.source); rec.unshift(opts.source); OS.store.set('music.recent', rec.slice(0, 12)); }
    go(first ? P.queue.indexOf(first) : 0, true);
  }
  function playAll(shuffle) { playList(TRACKS.filter((t) => t.kind === 'synth'), null, { shuffle, source: null }); }
  function setShuffle(on) {
    P.shuffle = on; const c = current(); if (!c) return changed();
    if (on) { P.queue = shuffled(P.base, c); P.idx = 0; } else { P.queue = P.base.slice(); P.idx = Math.max(0, P.queue.indexOf(c)); }
    changed();
  }
  function enqueue(t, nextUp) { if (!current()) return playList([t], 0, {}); if (nextUp) P.queue.splice(P.idx + 1, 0, t); else P.queue.push(t); P.base.push(t); OS.ui.toast(nextUp ? 'Playing Next' : 'Playing Last'); changed(); }
  function toggleLove(t) { if (!t) return false; let l = loved(); const on = l.indexOf(t.id) < 0; l = on ? l.concat([t.id]) : l.filter((x) => x !== t.id); OS.store.set('music.loved', l); OS.haptic(on ? 'success' : 'light'); changed(); return on; }
  function stopAll() {
    silence(); Synth.dispose(); clearInterval(P.ticker); P.ticker = 0;
    if (P.audio) { try { P.audio.removeAttribute('src'); P.audio.load(); } catch (e) {} P.audio = null; }
    P.queue = []; P.base = []; P.idx = -1; P.playing = false; P.pos = 0;
    try { OS.nowPlaying.clear(); } catch (e) {} try { OS.island.end('music'); } catch (e) {} P.island = false;
  }

  /* keep the OS (Control Center, Lock Screen, Dynamic Island) and the UI in step with the player */
  function pushNowPlaying() {
    const t = current(); P.lastNP = Date.now();
    if (!t) { try { OS.nowPlaying.clear(); } catch (e) {} return; }
    try { OS.nowPlaying.set({ appId: 'music', title: t.title, artist: t.artist, artwork: artOf(t), playing: P.playing, duration: duration(), position: position(), onToggle: toggle, onNext: () => advance(false), onPrev: previous, onSeek: seek }); } catch (e) {}
  }
  function changed() {
    const t = current();
    pushNowPlaying();
    try {
      if (t && P.playing) {
        const parts = { leading: `<div class="isl-art" style="background:${artOf(t)}"></div>`, trailing: '<div class="isl-eq"><i></i><i></i><i></i><i></i><i></i></div>' };
        if (P.island) OS.island.update('music', parts); else { OS.island.start(Object.assign({ id: 'music', appId: 'music' }, parts)); P.island = true; }
      } else if (P.island) { OS.island.end('music'); P.island = false; }
    } catch (e) {}
    if (P.playing && !P.ticker) P.ticker = setInterval(() => { if (Date.now() - P.lastNP > 950) pushNowPlaying(); if (S) UI.progress(); }, 250);
    if (!P.playing && P.ticker) { clearInterval(P.ticker); P.ticker = 0; }
    if (S) UI.sync();
  }
  OS.on('setting:volume', (v) => { if (P.audio) P.audio.volume = U.clamp(v, 0, 1); if (S) UI.volume(); });
  OS.music = { toggle, next: () => advance(false), prev: previous, playing: () => P.playing };

  /* ───────────────────────── screens ───────────────────────── */
  const el = U.el;
  function songRow(t, i, list, opts) {
    opts = opts || {};
    const n = el(`<div class="mu-song${loved().includes(t.id) ? ' loved' : ''}" data-id="${esc(t.id)}">${opts.numbered ? `<div class="mu-song-n"><span>${i + 1}</span><div class="mu-eq"><i></i><i></i><i></i><i></i></div></div>` : `<div class="mu-art" style="background:${artOf(t)};position:relative"><div class="mu-eq"><i></i><i></i><i></i><i></i></div></div>`}
      <div class="mu-song-t"><b>${esc(t.title)}</b>${opts.numbered ? '' : `<i>${esc(t.artist)}</i>`}</div><span class="mu-song-star">${fl(`<path d="${STAR}"/>`)}</span><span class="mu-song-d">${t.dur ? fmt(t.dur) : ''}</span><button class="mu-song-m">${IC.dots}</button></div>`);
    n.addEventListener('click', (e) => {
      if (e.target.closest('.mu-song-m')) return OS.ui.contextMenu(e.target.closest('.mu-song-m'), [
        { label: 'Play Next', onTap: () => enqueue(t, true) }, { label: 'Play Last', onTap: () => enqueue(t, false) },
        { label: loved().includes(t.id) ? 'Undo Favorite' : 'Favorite', onTap: () => { toggleLove(t); n.classList.toggle('loved', loved().includes(t.id)); } },
      ]);
      playList(list, i, { source: opts.source || null });
    });
    return n;
  }
  function tile(c, nav) {
    const n = el(`<div class="mu-tile">${artHTML(c)}<b>${esc(c.title)}</b><i>${esc(c.artist)}</i></div>`);
    n.addEventListener('click', () => nav.push(collectionPage(c, nav))); return n;
  }
  function collectionPage(c, nav) {
    return { title: '', background: 'var(--bg)', render(body) {
      const tr = tracksOf(c);
      body.appendChild(el(`<div class="mu-hero">${artHTML(c)}<h2>${esc(c.title)}</h2><h3>${esc(c.artist)}</h3><p>${esc(c.genre || 'Playlist')}${c.year ? ' · ' + c.year : ''}</p></div>`));
      const cta = el(`<div class="mu-cta"><button data-a="play">${IC.play}Play</button><button data-a="shuf">${IC.shuffle}Shuffle</button></div>`);
      cta.querySelector('[data-a="play"]').addEventListener('click', () => playList(tr, 0, { shuffle: false, source: c.id }));
      cta.querySelector('[data-a="shuf"]').addEventListener('click', () => playList(tr, null, { shuffle: true, source: c.id }));
      body.appendChild(cta);
      const list = el(`<div class="mu-songs${c.playlist ? '' : ' numbered'}" style="padding-left:20px"></div>`);
      if (!tr.length) list.appendChild(el('<div class="mu-none" style="padding-top:30px"><b>No Songs</b><span>Tap ••• on any song and choose Favorite.</span></div>'));
      tr.forEach((t, i) => list.appendChild(songRow(t, i, tr, { numbered: !c.playlist, source: c.id })));
      body.appendChild(list);
      if (c.note) body.appendChild(el(`<div class="mu-desc" style="padding:16px 20px;color:var(--label2);font-size:13px">${tr.length} songs · ${Math.round(tr.reduce((s, t) => s + (t.dur || 0), 0) / 60)} minutes<br><br>${esc(c.note)}</div>`));
      body.appendChild(el('<div class="mu-pad"></div>')); UI.sync();
    } };
  }
  const header = (body, title) => body.appendChild(el(`<div style="padding:4px 20px 6px"><h1 class="ios-large-title">${title}</h1></div>`));
  const PAGES = {
    home: (nav) => ({ title: 'Home', largeTitle: 'custom', background: 'var(--bg)', render(body) {
      header(body, 'Home');
      body.appendChild(el('<div class="mu-h"><b>Top Picks for You</b></div>'));
      const r1 = el('<div class="mu-hrow ios-scroll x"></div>'); PLAYLISTS.filter((p) => !p.fav).concat(ALBUMS).forEach((c) => r1.appendChild(tile(c, nav))); body.appendChild(r1);
      const recent = (OS.store.get('music.recent', []) || []).map(collection).filter(Boolean);
      if (recent.length) { body.appendChild(el('<div class="mu-h"><b>Recently Played</b></div>')); const r2 = el('<div class="mu-hrow ios-scroll x"></div>'); recent.forEach((c) => r2.appendChild(tile(c, nav))); body.appendChild(r2); }
      body.appendChild(el('<div class="mu-h"><b>Albums</b></div>')); const g = el('<div class="mu-grid"></div>'); ALBUMS.forEach((c) => g.appendChild(tile(c, nav))); body.appendChild(g);
      body.appendChild(el('<div class="mu-pad"></div>'));
    } }),
    library: (nav) => ({ title: 'Library', largeTitle: true, background: 'var(--bg)', render(body) {
      const list = el('<div class="ios-list" style="margin:0 16px 22px"></div>');
      [['Playlists', PLAYLISTS[0]], ['Favorite Songs', PLAYLISTS[3]]].forEach(([n, c]) => { const r = el(`<div class="ios-row tappable"><span class="ios-row-label" style="color:var(--tint)">${n}</span><span class="ios-chevron"></span></div>`); r.addEventListener('click', () => nav.push(collectionPage(c, nav))); list.appendChild(r); });
      const all = el('<div class="ios-row tappable"><span class="ios-row-label" style="color:var(--tint)">Songs</span><span class="ios-chevron"></span></div>');
      all.addEventListener('click', () => nav.push({ title: 'Songs', background: 'var(--bg)', render(b) { const l = el('<div class="mu-songs" style="padding-left:20px"></div>'); const tr = TRACKS.slice().sort((a, z) => a.title.localeCompare(z.title)); tr.forEach((t, i) => l.appendChild(songRow(t, i, tr))); b.appendChild(l); b.appendChild(el('<div class="mu-pad"></div>')); UI.sync(); } }));
      list.appendChild(all); body.appendChild(list);
      body.appendChild(el('<div class="mu-h"><b>Recently Added</b></div>')); const g = el('<div class="mu-grid"></div>'); ALBUMS.slice().reverse().concat(PLAYLISTS).forEach((c) => g.appendChild(tile(c, nav))); body.appendChild(g);
      body.appendChild(el('<div class="mu-pad"></div>'));
    } }),
    search: (nav) => ({ title: 'Search', largeTitle: true, background: 'var(--bg)', search: { placeholder: 'Artists, Songs, and More', onInput(q, pg) { draw(pg.body, q); } }, render(body) { draw(body, ''); } }),
  };
  function draw(body, q) {
    body.querySelectorAll('.mu-res').forEach((n) => n.remove()); q = q.trim().toLowerCase();
    const out = el('<div class="mu-res mu-songs" style="padding-left:20px"></div>');
    const res = q ? TRACKS.filter((t) => (t.title + ' ' + t.artist + ' ' + ((albumOf(t) || {}).title || '')).toLowerCase().includes(q)) : TRACKS.filter((t) => t.kind === 'synth');
    if (!res.length) out.appendChild(el(`<div class="mu-none"><b>No Results</b><span>for “${esc(q)}”</span></div>`));
    res.forEach((t, i) => out.appendChild(songRow(t, i, res))); body.appendChild(out); body.appendChild(el('<div class="mu-pad mu-res"></div>')); UI.sync();
  }

  /* ── Now Playing sheet ── */
  function bar(host, get, set) {   // draggable progress bar
    const b = el('<div class="mu-bar"><i><u></u></i></div>'); host.appendChild(b);
    let dragging = false;
    const val = (e) => { const r = U.rect(b); return U.clamp((U.screenPoint(e).x - r.x) / r.w, 0, 1); };
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); dragging = true; b.classList.add('act'); b.setPointerCapture(e.pointerId); b.querySelector('u').style.width = val(e) * 100 + '%'; });
    b.addEventListener('pointermove', (e) => { if (dragging) b.querySelector('u').style.width = val(e) * 100 + '%'; });
    b.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; b.classList.remove('act'); set(val(e)); });
    b.paint = () => { if (!dragging) b.querySelector('u').style.width = U.clamp(get(), 0, 1) * 100 + '%'; };
    return b;
  }
  const UI = {
    sync() {
      if (!S) return; const t = current();
      S.root.querySelectorAll('.mu-song').forEach((n) => { const cur = t && n.dataset.id === t.id; n.classList.toggle('is-cur', !!cur); n.classList.toggle('is-play', !!(cur && P.playing)); });
      const m = S.mini; m.classList.toggle('empty', !t); m.classList.toggle('paused', !P.playing);
      m.querySelector('.mu-art').style.background = t ? artOf(t) : ''; m.querySelector('b').textContent = t ? t.title : 'Not Playing';
      m.querySelector('[data-a="toggle"]').innerHTML = P.playing ? IC.pause : IC.play;
      const np = S.np; if (!t) return;
      np.classList.toggle('paused', !P.playing);
      np.querySelector('.mu-np-art').style.background = artOf(t); np.querySelector('.mu-np-bg').style.background = artOf(t);
      np.querySelector('.mu-np-tt b').textContent = t.title; np.querySelector('.mu-np-tt span').textContent = t.artist;
      np.querySelector('[data-a="love"]').classList.toggle('on', loved().includes(t.id));
      np.querySelector('.mu-np-ctl [data-a="toggle"]').innerHTML = P.playing ? IC.pause : IC.play;
      const sh = np.querySelector('[data-a="shuffle"]'), rp = np.querySelector('[data-a="repeat"]');
      sh.classList.toggle('on', P.shuffle); rp.classList.toggle('on', P.repeat !== 'off'); rp.classList.toggle('one', P.repeat === 'one');
      if (np.querySelector('.mu-np-panel.on')) UI.queue();
      UI.progress();
    },
    progress() { if (!S || !S.np.classList.contains('open')) return; const d = duration(), p = position(); S.scrub.paint(); const tm = S.np.querySelectorAll('.mu-np-times span'); tm[0].textContent = fmt(p); tm[1].textContent = '-' + fmt(Math.max(0, d - p)); },
    volume() { if (S) S.vol.paint(); },
    queue() {
      const panel = S.np.querySelector('.mu-np-panel'); panel.innerHTML = '';
      panel.appendChild(el(`<div class="mu-q-head"><b>Playing Next<span>${P.source ? esc((collection(P.source) || {}).title || '') : 'From Library'}</span></b><button class="mu-q-tg${P.shuffle ? ' on' : ''}" data-q="shuffle">${IC.shuffle}</button><button class="mu-q-tg${P.repeat !== 'off' ? ' on' : ''}${P.repeat === 'one' ? ' one' : ''}" data-q="repeat">${IC.repeat}<u>1</u></button></div>`));
      const up = P.queue.slice(P.idx + 1);
      if (!up.length) panel.appendChild(el('<div class="mu-q-none">Nothing else is queued.</div>'));
      up.forEach((t, k) => { const r = el(`<div class="mu-q-row"><div class="mu-art" style="background:${artOf(t)}"></div><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div><em>${fmt(t.dur)}</em></div>`); r.addEventListener('click', () => go(P.idx + 1 + k, true)); panel.appendChild(r); });
      panel.querySelector('[data-q="shuffle"]').addEventListener('click', () => { setShuffle(!P.shuffle); });
      panel.querySelector('[data-q="repeat"]').addEventListener('click', () => { P.repeat = P.repeat === 'off' ? 'all' : P.repeat === 'all' ? 'one' : 'off'; changed(); });
    },
  };
  function openNP() { if (!current()) return playAll(true); const np = S.np; np.classList.add('open'); S.ctx.setStatusBar('light'); UI.sync(); UI.volume(); }
  function closeNP() { const np = S.np; np.classList.remove('open', 'alt'); np.querySelectorAll('.mu-np-panel, .mu-np-btm button').forEach((n) => n.classList.remove('on')); np.style.transform = ''; S.ctx.setStatusBar('auto'); }
  function buildNP(root) {
    const np = el(`<div class="mu-np"><div class="mu-np-bg"></div><div class="mu-np-bg2"></div><div class="mu-np-grab"></div>
      <div class="mu-art mu-np-art"></div><div class="mu-np-meta"><div class="mu-np-tt"><b></b><span></span></div><button class="mu-np-rb" data-a="love">${fl(`<path d="${STAR}"/>`)}</button><button class="mu-np-rb" data-a="more">${IC.dots}</button></div>
      <div class="mu-np-panel ios-scroll"></div><div class="mu-np-scrubhost"></div><div class="mu-np-times"><span>0:00</span><span>-0:00</span></div>
      <div class="mu-np-ctl"><button data-a="prev">${IC.prev}</button><button data-a="toggle">${IC.play}</button><button data-a="next">${IC.next}</button></div>
      <div class="mu-np-vol">${IC.volLo}<div class="mu-volhost"></div>${IC.volHi}</div>
      <div class="mu-np-btm"><button data-a="lyrics">${IC.lyrics}</button><button data-a="airplay">${IC.airplay}</button><button data-a="queue">${IC.queue}</button></div>
      <button data-a="shuffle" style="display:none"></button><button data-a="repeat" style="display:none"></button></div>`);
    root.appendChild(np);
    S.scrub = bar(np.querySelector('.mu-np-scrubhost'), () => (duration() ? position() / duration() : 0), (v) => seek(v * duration()));
    S.scrub.classList.add('mu-np-scrub'); np.insertBefore(S.scrub, np.querySelector('.mu-np-times'));
    S.vol = bar(np.querySelector('.mu-volhost'), () => OS.settings.get('volume'), (v) => { OS.settings.set('volume', Math.round(v * 100) / 100); OS.haptic('selection'); });
    np.querySelector('.mu-volhost').replaceWith(S.vol);
    const act = { prev: previous, next: () => advance(false), toggle, love: () => { const b = np.querySelector('[data-a="love"]'); toggleLove(current()); b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 460); },
      more: (b) => OS.ui.contextMenu(b, [{ label: 'Go to Album', onTap: () => { const a = albumOf(current()); closeNP(); if (a) S.navs[S.tab].push(collectionPage(a, S.navs[S.tab])); } }, { label: 'Share Song…', onTap: () => OS.ui.toast('Link Copied') }]),
      lyrics: (b) => { OS.ui.toast('Instrumental — no lyrics'); }, airplay: () => OS.ui.actionSheet({ title: 'AirPlay', buttons: [{ label: '✓ iPhone' }, { label: OS.settings.get('ownerName') + '’s AirPods Pro' }] }),
      queue: (b) => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); np.classList.toggle('alt', on); np.querySelector('.mu-np-panel').classList.toggle('on', on); if (on) UI.queue(); } };
    np.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const f = act[b.dataset.a]; if (f) { f(b); OS.haptic('light'); } }));
    np.querySelector('.mu-np-tt span').addEventListener('click', () => act.more(np.querySelector('[data-a="more"]')));
    U.drag(np.querySelector('.mu-np-grab'), { axis: 'y', onStart() { np.classList.add('drag'); }, onMove(p) { np.style.transform = `translateY(${Math.max(0, p.dy)}px)`; }, onEnd(p) { np.classList.remove('drag'); if (p.dy > 150 || p.vy > .6) closeNP(); else np.style.transform = ''; } });
    np.querySelector('.mu-np-grab').addEventListener('click', closeNP);
    return np;
  }

  const TABS = [['home', 'Home', IC.tabHome], ['library', 'Library', IC.tabLib], ['search', 'Search', IC.tabSearch]];
  OS.registerApp({
    id: 'music', name: 'Music', system: true, statusBar: 'auto', category: 'Entertainment',
    icon: { bg: 'linear-gradient(180deg,#FA5C6F,#FA233B)', glyph: `<svg viewBox="0 0 60 60"><g transform="translate(12 11) scale(1.5)" fill="#fff"><path d="${NOTE}"/></g></svg>` },
    launch(ctx) {
      S = { ctx, root: ctx.root, navs: {}, tab: 'home' };
      ctx.root.innerHTML = TABS.map(([id]) => `<div class="mu-pane" data-t="${id}"></div>`).join('') +
        `<div class="mu-mini empty"><div class="mu-art"></div><b>Not Playing</b><button data-a="toggle">${IC.play}</button><button data-a="next">${IC.next}</button></div>` +
        `<div class="ios-tabbar">${TABS.map(([id, l, svg]) => `<div class="ios-tab" data-t="${id}">${svg}<span>${l}</span></div>`).join('')}</div>`;
      S.mini = ctx.root.querySelector('.mu-mini');
      S.mini.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { e.stopPropagation(); OS.haptic('light'); return b.dataset.a === 'toggle' ? (current() ? toggle() : playAll(true)) : advance(false); } openNP(); });
      S.np = buildNP(ctx.root);
      const show = (t) => { S.tab = t; ctx.root.querySelectorAll('.mu-pane').forEach((p) => p.classList.toggle('on', p.dataset.t === t)); ctx.root.querySelectorAll('.ios-tab').forEach((p) => p.classList.toggle('on', p.dataset.t === t)); };
      const build = () => TABS.forEach(([id]) => { const host = ctx.root.querySelector(`.mu-pane[data-t="${id}"]`); host.innerHTML = ''; S.navs[id] = OS.ui.createNav(host, { tabBarInset: true }); S.navs[id].push(PAGES[id](S.navs[id])); });
      ctx.root.querySelectorAll('.ios-tab').forEach((b) => b.addEventListener('click', () => { if (S.tab === b.dataset.t) S.navs[S.tab].popToRoot(); show(b.dataset.t); OS.haptic('selection'); }));
      build(); show('home'); UI.sync();
      loadRingtones().then(() => { if (S) { build(); show(S.tab); UI.sync(); } });
    },
    onResume() { UI.sync(); },
    onClose() { stopAll(); S = null; },
  });
})();
