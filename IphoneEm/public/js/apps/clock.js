/* Clock — World Clock · Alarms · Stopwatch · Timers.
 * Alarms + timers are driven by ONE module-level checker (started at script load) so they fire while the app is in the
 * background, never launched, or the phone is locked. Public API: OS.clock.startTimer / cancelTimer / addAlarm.
 */
(function () {
  'use strict';
  if (!window.OS) return;
  const U = OS.util, esc = U.esc;
  const ORANGE = '#FF9F0A';
  const K = { alarms: 'clock.alarms', cities: 'clock.cities', timer: 'clock.timer', recents: 'clock.recents', tsound: 'clock.timerSound',
    tlast: 'clock.timerLast', sw: 'clock.stopwatch', snoozes: 'clock.snoozes', tab: 'clock.tab' };
  const pad = (n) => String(n).padStart(2, '0');
  const haptic = (t) => { try { OS.haptic && OS.haptic(t); } catch (_) {} };

  /* ───────────────────────── state (module level — survives the app being closed) ───────────────────────── */
  let alarms = OS.store.get(K.alarms, null);
  if (!Array.isArray(alarms)) {
    alarms = [
      { id: 'a1', hour: 6, minute: 30, label: 'School', repeat: [1, 2, 3, 4, 5], sound: 'ringtone:Radar', snooze: true, on: false },
      { id: 'a2', hour: 7, minute: 15, label: 'Alarm', repeat: [], sound: 'ringtone:Radar', snooze: true, on: false },
      { id: 'a3', hour: 9, minute: 0, label: 'Weekend', repeat: [0, 6], sound: 'ringtone:Radar', snooze: true, on: false },
    ];
    OS.store.set(K.alarms, alarms);
  }
  let cities = OS.store.get(K.cities, null);
  if (!Array.isArray(cities)) {
    cities = [{ name: 'Cupertino', tz: 'America/Los_Angeles' }, { name: 'New York', tz: 'America/New_York' }, { name: 'London', tz: 'Europe/London' }, { name: 'Tokyo', tz: 'Asia/Tokyo' }];
    OS.store.set(K.cities, cities);
  }
  let timer = OS.store.get(K.timer, null);              // { duration(s), endAt(ms), remaining(ms), state:'running'|'paused', sound, label }
  let recents = OS.store.get(K.recents, [60, 300, 600, 900, 1800]);
  let timerSound = OS.store.get(K.tsound, 'ringtone:Radial');
  let timerLabel = '';
  let snoozes = OS.store.get(K.snoozes, []);            // [{ alarmId, at }]
  let sw = OS.store.get(K.sw, null) || { running: false, startedAt: 0, acc: 0, laps: [] };
  let firing = null;                                    // { kind:'alarm'|'timer', id, label, snooze, handle, stopTimer }
  let islandOn = false;
  let ui = null, active = false, raf = 0;
  let tab = OS.store.get(K.tab, 'world');

  const saveAlarms = () => OS.store.set(K.alarms, alarms);
  const saveCities = () => OS.store.set(K.cities, cities);
  const saveTimer = () => (timer ? OS.store.set(K.timer, timer) : OS.store.remove(K.timer));
  const saveSW = () => OS.store.set(K.sw, sw);
  const saveSnoozes = () => OS.store.set(K.snoozes, snoozes);
  const sortAlarms = () => alarms.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  const minuteKey = (d) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + '-' + d.getHours() + '-' + d.getMinutes();

  /* ───────────────────────── sounds ───────────────────────── */
  const FALLBACK_TONES = ['Radar', 'Radial', 'Reflection', 'Opening', 'Apex', 'Beacon', 'Bulletin', 'By The Seaside', 'Chimes', 'Circuit', 'Constellation', 'Cosmic',
    'Crystals', 'Hillside', 'Illuminate', 'Marimba', 'Night Owl', 'Playtime', 'Presto', 'Ripples', 'Sencha', 'Signal', 'Silk', 'Slow Rise', 'Stargaze', 'Summit', 'Twinkle', 'Uplift', 'Waves'];
  let toneNames = null, listLoaded = false;
  async function soundNames() {
    if (toneNames) return toneNames;
    let names = [];
    try { names = (await OS.sound.list()).filter((id) => id.indexOf('ringtone:') === 0).map((id) => id.slice(9)); listLoaded = true; } catch (_) {}
    if (!names.length) names = FALLBACK_TONES.slice();
    names.sort((a, b) => (a === 'Radar' ? -1 : b === 'Radar' ? 1 : a.localeCompare(b)));
    toneNames = names;
    return names;
  }
  const soundLabel = (id) => String(id || '').replace(/^ringtone:/, '') || 'Radar';
  // resolve an id to something the host really has (Radial → Radar fallback)
  function resolveSound(id) {
    id = id || 'ringtone:Radar';
    try { if (listLoaded && OS.sound.has && !OS.sound.has(id) && OS.sound.has('ringtone:Radar')) return 'ringtone:Radar'; } catch (_) {}
    return id;
  }
  function playAlert(id) { try { return OS.sound.play(resolveSound(id), { loop: true, category: 'ringer' }); } catch (_) { return { stop() {} }; } }
  let preview = null, previewWatch = 0;
  function stopPreview() { if (preview) { try { preview.stop(); } catch (_) {} preview = null; } clearInterval(previewWatch); previewWatch = 0; }
  function startPreview(id, hostEl) {
    stopPreview();
    try { preview = OS.sound.play(id, { category: 'ringer' }); } catch (_) {}
    if (hostEl) previewWatch = setInterval(() => { if (!hostEl.isConnected) stopPreview(); }, 400);
  }
  soundNames().then(() => {
    if (timerSound === 'ringtone:Radial' && resolveSound(timerSound) !== timerSound) { timerSound = 'ringtone:Radar'; if (ui) renderTimerOptions(); }
  });

  /* ───────────────────────── firing ───────────────────────── */
  function stopFiring() {
    if (!firing) return;
    try { firing.handle && firing.handle.stop(); } catch (_) {}
    clearTimeout(firing.stopTimer);
    firing = null;
    if (ui) hideTakeover();
  }
  function fireAlarm(a, fromSnooze) {
    stopFiring();
    const label = a.label || 'Alarm';
    firing = { kind: 'alarm', id: a.id, label, snooze: a.snooze !== false, handle: playAlert(a.sound), at: new Date() };
    firing.stopTimer = setTimeout(() => { if (firing && firing.id === a.id) stopFiring(); }, 15 * 60000);
    if (!fromSnooze && !(a.repeat && a.repeat.length)) { a.on = false; saveAlarms(); }   // one-shot alarms switch off after firing
    haptic('warning');
    try { OS.notify({ appId: 'clock', title: 'Alarm', body: label, sound: false, onTap() { OS.openApp('clock', { alarm: a.id }); } }); } catch (_) {}
    if (ui) { renderAlarms(); showTakeover(); }
    try { OS.openApp('clock', { alarm: a.id }); } catch (_) {}
  }
  function snoozeFiring() {
    if (!firing || firing.kind !== 'alarm') return;
    const id = firing.id;
    stopFiring();
    snoozes = snoozes.filter((s) => s.alarmId !== id);
    snoozes.push({ alarmId: id, at: Date.now() + 9 * 60000 });
    saveSnoozes();
    if (ui) renderAlarms();
    try { OS.ui.toast('Snoozing for 9 minutes'); } catch (_) {}
  }
  function timerDone() {
    const t = timer;
    timer = null; saveTimer(); islandSync();
    stopFiring();
    firing = { kind: 'timer', id: 'timer', label: t.label || 'Timer', handle: playAlert(t.sound) };
    firing.stopTimer = setTimeout(() => { if (firing && firing.kind === 'timer') stopFiring(); }, 15 * 60000);
    const mine = firing;
    haptic('warning');
    try { OS.notify({ appId: 'clock', title: 'Timer', body: t.label ? t.label + ' — Timer done' : 'Timer done', sound: false, onTap() { OS.openApp('clock', { tab: 'timer' }); } }); } catch (_) {}
    refresh();
    let p = null;
    try { p = OS.ui.alert({ title: t.label || 'Timer', message: 'Timer done', buttons: [{ label: 'Repeat' }, { label: 'Stop', style: 'cancel' }] }); } catch (_) {}
    if (p && p.then) {
      p.then((i) => {
        if (firing === mine) stopFiring();
        if (i === 0) startTimer(t.duration, t.label, t.sound);
      }).catch(() => { if (firing === mine) stopFiring(); });
    }
  }

  /* ───────────────────────── timer engine ───────────────────────── */
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  function durWords(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, out = [];
    if (h) out.push(h + ' hr'); if (m) out.push(m + ' min'); if (s) out.push(s + ' sec');
    return out.join(', ') || '0 sec';
  }
  const timerRemainingMs = () => (!timer ? 0 : timer.state === 'paused' ? timer.remaining : Math.max(0, timer.endAt - Date.now()));
  function startTimer(seconds, label, sound) {
    seconds = Math.round(Number(seconds) || 0);
    if (seconds <= 0) return false;
    if (firing && firing.kind === 'timer') stopFiring();
    timer = { duration: seconds, endAt: Date.now() + seconds * 1000, remaining: seconds * 1000, state: 'running', sound: sound || resolveSound(timerSound), label: label ? String(label) : '' };
    saveTimer();
    recents = [seconds].concat(recents.filter((r) => r !== seconds)).slice(0, 8);
    OS.store.set(K.recents, recents);
    OS.store.set(K.tlast, seconds);
    islandSync(); refresh();
    return true;
  }
  function cancelTimer() {
    if (firing && firing.kind === 'timer') stopFiring();
    if (!timer) return false;
    timer = null; saveTimer(); islandSync(); refresh();
    return true;
  }
  function pauseTimer() {
    if (!timer || timer.state !== 'running') return;
    timer.remaining = Math.max(0, timer.endAt - Date.now()); timer.state = 'paused';
    saveTimer(); islandSync(); refresh();
  }
  function resumeTimer() {
    if (!timer || timer.state !== 'paused') return;
    timer.endAt = Date.now() + timer.remaining; timer.state = 'running';
    saveTimer(); islandSync(); refresh();
  }
  const ISLAND_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" style="display:block"><circle cx="12" cy="13" r="8" fill="none" stroke="${ORANGE}" stroke-width="2.2"/><path d="M12 13V8.4" stroke="${ORANGE}" stroke-width="2.2" stroke-linecap="round"/><path d="M9.6 2.6h4.8" stroke="${ORANGE}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  function islandParts() {
    const paused = timer.state === 'paused';
    const txt = fmtDur(Math.ceil(timerRemainingMs() / 1000));
    const btn = 'width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer';
    const toggleIcon = paused
      ? `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5.5v13l10.5-6.5z" fill="${ORANGE}"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="${ORANGE}"/></svg>`;
    return {
      leading: ISLAND_ICON,
      trailing: `<span style="color:${ORANGE};font-variant-numeric:tabular-nums;font-weight:500;${paused ? 'opacity:.55' : ''}">${txt}</span>`,
      expanded: `<div style="display:flex;align-items:center;gap:10px;width:100%;padding:4px 6px">
        <div onclick="event.stopPropagation();OS.clock.${paused ? 'resumeTimer' : 'pauseTimer'}()" style="${btn};background:rgba(255,159,10,.28)">${toggleIcon}</div>
        <div onclick="event.stopPropagation();OS.clock.cancelTimer()" style="${btn};background:rgba(255,255,255,.2)"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg></div>
        <div style="flex:1;text-align:right;line-height:1.05"><div style="color:${ORANGE};font-size:13px;font-weight:600;opacity:.85">${esc(timer.label || 'Timer')}</div>
        <div style="color:${ORANGE};font-size:36px;font-weight:300;font-variant-numeric:tabular-nums;letter-spacing:-.5px;${paused ? 'opacity:.55' : ''}">${txt}</div></div></div>`,
    };
  }
  let islandSig = '';
  function islandSync() {
    if (!OS.island) return;
    try {
      if (!timer) { if (islandOn) { OS.island.end('timer'); islandOn = false; islandSig = ''; } return; }
      const parts = islandParts();
      if (!islandOn) {
        OS.island.start(Object.assign({ id: 'timer', appId: 'clock', onTap() { OS.openApp('clock', { tab: 'timer' }); } }, parts));
        islandOn = true; islandSig = parts.trailing;
      } else if (parts.trailing !== islandSig) { islandSig = parts.trailing; OS.island.update('timer', parts); }
    } catch (_) {}
  }

  /* ───────────────────────── THE checker: one interval for the life of the page ───────────────────────── */
  let lastKey = '';
  function check() {
    const now = new Date(), key = minuteKey(now), t = now.getTime();
    if (key !== lastKey) {
      lastKey = key;
      const due = alarms.filter((a) => a.on && a.hour === now.getHours() && a.minute === now.getMinutes() &&
        (!a.repeat || !a.repeat.length || a.repeat.indexOf(now.getDay()) >= 0) && a.lastFired !== key);
      if (due.length) {
        due.forEach((a) => { a.lastFired = key; if (!(a.repeat && a.repeat.length)) a.on = false; });
        saveAlarms();
        fireAlarm(due[0]);
      }
    }
    if (snoozes.length) {
      const dueS = snoozes.filter((s) => t >= s.at);
      if (dueS.length) {
        snoozes = snoozes.filter((s) => t < s.at); saveSnoozes();
        const a = alarms.find((x) => x.id === dueS[0].alarmId);
        if (a && t - dueS[0].at < 10 * 60000) fireAlarm(a, true); else if (ui) renderAlarms();
      }
    }
    if (timer && timer.state === 'running') {
      if (t >= timer.endAt) {
        if (t - timer.endAt > 5 * 60000) { timer = null; saveTimer(); islandSync(); refresh(); }   // page was closed long past the end — don't ring out of nowhere
        else timerDone();
      } else islandSync();
    } else if (timer && !islandOn) islandSync();
  }
  setInterval(() => { try { check(); } catch (e) { console.error('[clock]', e); } }, 1000);

  /* ───────────────────────── public API (Siri, Control Center) ───────────────────────── */
  OS.clock = {
    startTimer(seconds, label) { return startTimer(seconds, label); },
    cancelTimer() { return cancelTimer(); },
    pauseTimer, resumeTimer,
    timer() { return timer ? { duration: timer.duration, remaining: Math.ceil(timerRemainingMs() / 1000), state: timer.state, label: timer.label } : null; },
    addAlarm(o) {
      o = o || {};
      const now = new Date();
      const a = { id: U.uid(), hour: U.clamp(Math.round(Number(o.hour) || 0), 0, 23), minute: U.clamp(Math.round(Number(o.minute) || 0), 0, 59), label: o.label ? String(o.label) : 'Alarm',
        repeat: Array.isArray(o.repeat) ? o.repeat.slice() : [], sound: o.sound || 'ringtone:Radar', snooze: o.snooze !== false, on: true };
      if (a.hour === now.getHours() && a.minute === now.getMinutes()) a.lastFired = minuteKey(now);
      alarms.push(a); sortAlarms(); saveAlarms();
      if (ui) renderAlarms();
      return a.id;
    },
    alarms() { return alarms.map((a) => Object.assign({}, a)); },
    stopAlert() { stopFiring(); },
  };

  /* ───────────────────────── world-clock helpers ───────────────────────── */
  const CITY_DB = ('Abu Dhabi|U.A.E.|Asia/Dubai;Amsterdam|Netherlands|Europe/Amsterdam;Anchorage|U.S.A.|America/Anchorage;Athens|Greece|Europe/Athens;Auckland|New Zealand|Pacific/Auckland;' +
    'Bangkok|Thailand|Asia/Bangkok;Beijing|China|Asia/Shanghai;Berlin|Germany|Europe/Berlin;Bogotá|Colombia|America/Bogota;Boston|U.S.A.|America/New_York;Brussels|Belgium|Europe/Brussels;' +
    'Buenos Aires|Argentina|America/Argentina/Buenos_Aires;Cairo|Egypt|Africa/Cairo;Cape Town|South Africa|Africa/Johannesburg;Chicago|U.S.A.|America/Chicago;Copenhagen|Denmark|Europe/Copenhagen;' +
    'Cupertino|U.S.A.|America/Los_Angeles;Dallas|U.S.A.|America/Chicago;Denver|U.S.A.|America/Denver;Dubai|U.A.E.|Asia/Dubai;Dublin|Ireland|Europe/Dublin;Helsinki|Finland|Europe/Helsinki;' +
    'Ho Chi Minh City|Vietnam|Asia/Ho_Chi_Minh;Hong Kong|China|Asia/Hong_Kong;Honolulu|U.S.A.|Pacific/Honolulu;Istanbul|Türkiye|Europe/Istanbul;Jakarta|Indonesia|Asia/Jakarta;' +
    'Johannesburg|South Africa|Africa/Johannesburg;Karachi|Pakistan|Asia/Karachi;Kathmandu|Nepal|Asia/Kathmandu;Kuala Lumpur|Malaysia|Asia/Kuala_Lumpur;Lagos|Nigeria|Africa/Lagos;Lima|Peru|America/Lima;' +
    'Lisbon|Portugal|Europe/Lisbon;London|England|Europe/London;Los Angeles|U.S.A.|America/Los_Angeles;Madrid|Spain|Europe/Madrid;Manila|Philippines|Asia/Manila;Melbourne|Australia|Australia/Melbourne;' +
    'Mexico City|Mexico|America/Mexico_City;Miami|U.S.A.|America/New_York;Montréal|Canada|America/Toronto;Moscow|Russia|Europe/Moscow;Mumbai|India|Asia/Kolkata;Nairobi|Kenya|Africa/Nairobi;' +
    'New Delhi|India|Asia/Kolkata;New York|U.S.A.|America/New_York;Oslo|Norway|Europe/Oslo;Paris|France|Europe/Paris;Phoenix|U.S.A.|America/Phoenix;Prague|Czechia|Europe/Prague;' +
    'Reykjavík|Iceland|Atlantic/Reykjavik;Rio de Janeiro|Brazil|America/Sao_Paulo;Rome|Italy|Europe/Rome;San Francisco|U.S.A.|America/Los_Angeles;Santiago|Chile|America/Santiago;' +
    'São Paulo|Brazil|America/Sao_Paulo;Seattle|U.S.A.|America/Los_Angeles;Seoul|South Korea|Asia/Seoul;Shanghai|China|Asia/Shanghai;Singapore|Singapore|Asia/Singapore;Stockholm|Sweden|Europe/Stockholm;' +
    'Sydney|Australia|Australia/Sydney;Taipei|Taiwan|Asia/Taipei;Tehran|Iran|Asia/Tehran;Tokyo|Japan|Asia/Tokyo;Toronto|Canada|America/Toronto;Vancouver|Canada|America/Vancouver;Vienna|Austria|Europe/Vienna;' +
    'Warsaw|Poland|Europe/Warsaw;Washington, D.C.|U.S.A.|America/New_York;Zurich|Switzerland|Europe/Zurich').split(';').map((s) => { const p = s.split('|'); return { name: p[0], country: p[1], tz: p[2] }; });
  const fmtCache = {};
  function tzInfo(tz, now) {
    try {
      const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }));
      const p = {}; f.formatToParts(now).forEach((x) => { if (x.type !== 'literal') p[x.type] = parseInt(x.value, 10); });
      p.hour = p.hour % 24;
      const there = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
      const here = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
      const dayDiff = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
      return { h: p.hour, m: p.minute, offMin: Math.round((there - here) / 60000), dayDiff };
    } catch (_) { return null; }
  }
  function offsetText(info) {
    const day = info.dayDiff === 0 ? 'Today' : info.dayDiff > 0 ? 'Tomorrow' : 'Yesterday';
    const abs = Math.abs(info.offMin), h = Math.floor(abs / 60), m = abs % 60;
    const sign = info.offMin < 0 ? '-' : '+';
    return day + ', ' + sign + h + (m ? ':' + pad(m) : '') + (h === 1 && !m ? 'HR' : 'HRS');
  }
  const hmDate = (h, m) => new Date(2001, 0, 1, h, m, 0);

  /* ───────────────────────── alarm text helpers ───────────────────────── */
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function repeatText(rep, forRow) {
    const r = (rep || []).slice().sort();
    if (!r.length) return forRow ? '' : 'Never';
    const key = r.join('');
    if (r.length === 7) return forRow ? 'every day' : 'Every Day';
    if (key === '12345') return forRow ? 'every weekday' : 'Weekdays';
    if (key === '06') return forRow ? 'every weekend' : 'Weekends';
    if (r.length === 1) return (forRow ? 'every ' : 'Every ') + DAYS[r[0]];
    const order = r.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return order.map((d) => DAYS[d].slice(0, 3)).join(' ');
  }

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('clock', `
  .app-clock{--bg:#000;--bg2:#000;--cell:#1C1C1E;--cell2:#2C2C2E;--label:#fff;--label2:rgba(235,235,245,.6);--label3:rgba(235,235,245,.3);--sep:rgba(84,84,88,.65);
    --fill:rgba(120,120,128,.36);--fill2:rgba(120,120,128,.24);--tint:#FF9F0A;--bar:rgba(22,22,24,.82);--green:#30D158;--red:#FF453A;--orange:#FF9F0A;--gray:#8E8E93;--gray4:#3A3A3C;
    background:#000;color:#fff;color-scheme:dark}
  .app-clock .ck-pane{position:absolute;inset:0;display:none}
  .app-clock .ck-pane.on{display:block}
  .app-clock .ck-scroll{position:absolute;inset:0;padding:calc(var(--safe-top) + 44px) 0 110px}
  .app-clock .ck-bar{position:absolute;left:0;right:0;top:0;height:calc(var(--safe-top) + 44px);padding:var(--safe-top) 16px 0;display:flex;align-items:center;justify-content:space-between;z-index:20;
    transition:background .2s, box-shadow .2s}
  .app-clock .ck-pane.scrolled .ck-bar{background:rgba(22,22,24,.82);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:0 .5px 0 var(--sep)}
  .app-clock .ck-bar-title{position:absolute;left:90px;right:90px;text-align:center;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none}
  .app-clock .ck-pane.scrolled .ck-bar-title{opacity:1}
  .app-clock .ck-bar button{color:${ORANGE};font-size:17px;min-width:44px;height:44px;display:flex;align-items:center}
  .app-clock .ck-bar button:active{opacity:.4}
  .app-clock .ck-bar button.bold{font-weight:600}
  .app-clock .ck-bar .ck-plus{justify-content:flex-end}
  .app-clock .ck-bar .ck-plus svg{width:22px;height:22px}
  .app-clock .ck-title{font-size:34px;font-weight:700;letter-spacing:.35px;padding:2px 16px 8px;border-bottom:.5px solid var(--sep);margin:0 0 0 0}
  .app-clock .ck-empty{padding:120px 40px 0;text-align:center;color:#8E8E93;font-size:22px;font-weight:600;letter-spacing:-.3px}
  .app-clock .ck-empty small{display:block;font-size:15px;font-weight:400;margin-top:6px;letter-spacing:-.2px}

  /* swipe / edit rows */
  .app-clock .ck-srow{position:relative;overflow:hidden}
  .app-clock .ck-srow::after{content:'';position:absolute;left:16px;right:0;bottom:0;height:.5px;background:var(--sep)}
  .app-clock .ck-del{position:absolute;right:0;top:0;bottom:0;width:84px;background:#FF453A;color:#fff;font-size:17px}
  .app-clock .ck-srow-in{position:relative;display:flex;align-items:center;background:#000;padding:0 16px;transition:transform .3s var(--ease);cursor:pointer}
  .app-clock .ck-srow.open .ck-srow-in{transform:translateX(-84px)}
  .app-clock .ck-minus{flex:none;width:0;overflow:hidden;opacity:0;transition:width .3s var(--ease), opacity .3s;height:44px;display:flex;align-items:center}
  .app-clock .ck-minus i{display:block;width:22px;height:22px;border-radius:50%;background:#FF453A;position:relative;flex:none}
  .app-clock .ck-minus i::after{content:'';position:absolute;left:5px;right:5px;top:10px;height:2px;border-radius:1px;background:#fff}
  .app-clock .ck-pane.editing .ck-minus{width:36px;opacity:1}

  /* world clock */
  .app-clock .ck-wrow{height:90px}
  .app-clock .ck-w-l{flex:1;min-width:0}
  .app-clock .ck-w-off{font-size:15px;color:#8E8E93;letter-spacing:-.2px}
  .app-clock .ck-w-city{font-size:26px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
  .app-clock .ck-w-time{flex:none;font-size:56px;font-weight:300;letter-spacing:-1px;font-variant-numeric:tabular-nums;line-height:1;transition:opacity .25s}
  .app-clock .ck-w-time small{font-size:26px;font-weight:400;letter-spacing:0;margin-left:1px}
  .app-clock .ck-pane.editing .ck-w-time{opacity:0}

  /* alarms */
  .app-clock .ck-arow{min-height:96px;padding-top:6px;padding-bottom:9px}
  .app-clock .ck-a-l{flex:1;min-width:0}
  .app-clock .ck-a-time{font-size:58px;font-weight:200;letter-spacing:-1.5px;line-height:1.08;font-variant-numeric:tabular-nums}
  .app-clock .ck-a-time small{font-size:30px;font-weight:300;letter-spacing:-.3px;margin-left:2px}
  .app-clock .ck-a-sub{font-size:15px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-clock .ck-srow.off .ck-a-time,.app-clock .ck-srow.off .ck-a-sub{color:#8E8E93}
  .app-clock .ck-arow .ios-chevron{display:none;margin-left:8px}
  .app-clock .ck-pane.editing .ck-arow .ios-switch{display:none}
  .app-clock .ck-pane.editing .ck-arow .ios-chevron{display:block}
  .app-clock .ck-sec{display:flex;align-items:center;gap:6px;font-size:20px;font-weight:700;padding:22px 16px 8px;border-bottom:.5px solid var(--sep);letter-spacing:-.2px}

  /* round buttons */
  .app-clock .ck-round{position:relative;width:84px;height:84px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:17px;letter-spacing:-.3px;
    background:var(--c);color:var(--t);transition:filter .1s, opacity .15s}
  .app-clock .ck-round::after{content:'';position:absolute;inset:3px;border-radius:50%;border:2px solid #000;pointer-events:none}
  .app-clock .ck-round:active{filter:brightness(.62)}
  .app-clock .ck-round.gray{--c:#333;--t:#fff}
  .app-clock .ck-round.green{--c:#0B3014;--t:#30D158}
  .app-clock .ck-round.red{--c:#3A0F0D;--t:#FF453A}
  .app-clock .ck-round.orange{--c:#3A2503;--t:#FF9F0A}
  .app-clock .ck-round[disabled]{opacity:.45;pointer-events:none}
  .app-clock .ck-btnrow{display:flex;justify-content:space-between;padding:0 18px}

  /* stopwatch */
  .app-clock .ck-sw{position:absolute;inset:0;display:flex;flex-direction:column}
  .app-clock .ck-sw-read{flex:none;height:388px;padding-top:var(--safe-top);display:flex;align-items:center;justify-content:center;font-size:88px;font-weight:200;letter-spacing:-2px;
    font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
  .app-clock .ck-sw-read.long{font-size:66px;letter-spacing:-1.5px}
  .app-clock .ck-sw-laps{flex:1;min-height:0;margin:14px 16px 0;padding:0 0 100px;border-top:.5px solid var(--sep)}
  .app-clock .ck-lap{display:flex;justify-content:space-between;align-items:center;height:44px;border-bottom:.5px solid var(--sep);font-size:17px;font-variant-numeric:tabular-nums}
  .app-clock .ck-lap.fast{color:#30D158}.app-clock .ck-lap.slow{color:#FF453A}

  /* timers */
  .app-clock .ck-tm-wheel{margin:4px 12px 0;--fill2:rgba(120,120,128,.24)}
  .app-clock .ck-tm .ck-btnrow{margin-top:22px}
  .app-clock .ck-tm .ios-list{margin-top:26px}
  .app-clock .ck-tm .ios-row input{text-align:right;color:var(--label2)}
  .app-clock .ck-tm .ck-lab{flex:none}
  .app-clock .ck-ring{position:relative;width:340px;height:340px;margin:10px auto 0}
  .app-clock .ck-ring svg{width:100%;height:100%;display:block;transform:rotate(-90deg)}
  .app-clock .ck-ring-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .app-clock .ck-ring-lab{font-size:17px;color:#8E8E93;height:24px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-clock .ck-ring-t{font-size:82px;font-weight:200;letter-spacing:-2px;font-variant-numeric:tabular-nums;line-height:1.1}
  .app-clock .ck-ring-t.long{font-size:64px}
  .app-clock .ck-ring-end{display:flex;align-items:center;gap:5px;font-size:17px;color:#8E8E93;height:24px;transition:opacity .2s}
  .app-clock .ck-ring-end svg{width:15px;height:15px}
  .app-clock .ck-ring.paused .ck-ring-end{opacity:.4}
  .app-clock .ck-rec-h{font-size:22px;font-weight:700;padding:30px 16px 8px;border-bottom:.5px solid var(--sep);letter-spacing:-.3px}
  .app-clock .ck-rrow{height:88px}
  .app-clock .ck-r-l{flex:1;min-width:0}
  .app-clock .ck-r-t{font-size:50px;font-weight:200;letter-spacing:-1px;line-height:1.05;font-variant-numeric:tabular-nums}
  .app-clock .ck-r-s{font-size:15px;color:#8E8E93;letter-spacing:-.2px}
  .app-clock .ck-play{width:42px;height:42px;border-radius:50%;background:rgba(48,209,88,.22);display:flex;align-items:center;justify-content:center;flex:none}
  .app-clock .ck-play:active{opacity:.5}
  .app-clock .ck-play svg{width:18px;height:18px;margin-left:2px}

  /* alarm takeover */
  .app-clock .ck-takeover{position:absolute;inset:0;z-index:200;background:radial-gradient(120% 80% at 50% 0,#2b1a05 0,#0a0603 55%,#000 100%);display:flex;flex-direction:column;align-items:center;
    opacity:0;pointer-events:none;transition:opacity .3s}
  .app-clock .ck-takeover.in{opacity:1;pointer-events:auto}
  .app-clock .ck-to-icon{margin-top:128px;width:40px;height:40px;color:#fff;animation:ck-ring 1s ease-in-out infinite}
  @keyframes ck-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(5deg)}}
  .app-clock .ck-to-time{margin-top:10px;font-size:96px;font-weight:200;letter-spacing:-3px;line-height:1.05;font-variant-numeric:tabular-nums}
  .app-clock .ck-to-label{font-size:24px;color:rgba(255,255,255,.85);max-width:340px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-clock .ck-to-snooze{margin-top:96px;width:300px;height:76px;border-radius:38px;background:${ORANGE};color:#000;font-size:26px;font-weight:600;letter-spacing:-.3px}
  .app-clock .ck-to-snooze:active,.app-clock .ck-to-stop:active{opacity:.6}
  .app-clock .ck-to-stop{position:absolute;bottom:92px;left:50%;margin-left:-84px;width:168px;height:56px;border-radius:28px;background:rgba(255,255,255,.18);color:#fff;font-size:20px;font-weight:500;
    backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}

  /* sheet content (OS sheets live outside the app root → not scoped, unique ck- prefix) */
  .ck-sheet-body{overflow-y:auto}
  .ck-sh-wheel{margin:0 12px 18px}
  .ck-sheet-body .ios-row input.ck-sh-label{text-align:right;color:var(--label2)}
  .ck-sheet-body .ck-lab{flex:none}
  .ck-sh-delete{justify-content:center;color:var(--red)}
  .ck-sh-search{margin:0 16px 12px}
  .ck-sub{position:absolute;inset:0;z-index:40;background:var(--bg2);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .38s cubic-bezier(.32,.72,0,1)}
  #screen[data-theme="dark"] .ios-sheet .ck-sub{background:#1C1C1E}
  .ck-sub.in{transform:none}
  .ck-sub-bar{position:relative;flex:none;height:56px;display:flex;align-items:center;padding:0 8px;font-size:17px}
  .ck-sub-back{display:flex;align-items:center;gap:5px;color:${ORANGE};height:44px;padding:0 8px}
  .ck-sub-back:active{opacity:.4}
  .ck-sub-back svg{width:12px;height:20px}
  .ck-sub-title{position:absolute;left:90px;right:90px;text-align:center;font-weight:600;pointer-events:none}
  .ck-sub-body{flex:1;min-height:0;padding:8px 0 60px}
  `);

  /* ───────────────────────── icons ───────────────────────── */
  const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const IC = {
    world: `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" ${S} stroke-width="1.8"/><ellipse cx="13" cy="13" rx="4.6" ry="10" ${S} stroke-width="1.6"/><path d="M3 13h20M4.6 8h16.8M4.6 18h16.8" ${S} stroke-width="1.6"/></svg>`,
    alarm: `<svg viewBox="0 0 26 26"><circle cx="13" cy="14.5" r="8.3" ${S} stroke-width="1.9"/><path d="M13 9.8v5l3.1 1.9" ${S} stroke-width="1.9"/><path d="M3.6 7.4 7.4 4.2M22.4 7.4l-3.8-3.2" ${S} stroke-width="2.3"/><path d="M7.4 21.2 6 23M18.6 21.2 20 23" ${S} stroke-width="1.9"/></svg>`,
    stopwatch: `<svg viewBox="0 0 26 26"><circle cx="13" cy="15" r="8.6" ${S} stroke-width="1.9"/><path d="M13 15V9.6" ${S} stroke-width="1.9"/><path d="M10.4 2.8h5.2M13 3v3.2M20.2 7.4l1.5-1.5" ${S} stroke-width="2"/></svg>`,
    timer: `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" ${S} stroke-width="1.9"/><path d="M13 13 8.4 8.2" ${S} stroke-width="2"/><path d="M13 3v3.4" ${S} stroke-width="1.9"/><circle cx="13" cy="13" r="1.4" fill="currentColor"/></svg>`,
    plus: `<svg viewBox="0 0 22 22"><path d="M11 3v16M3 11h16" ${S} stroke-width="2.2"/></svg>`,
    back: `<svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8" ${S} stroke-width="2.6"/></svg>`,
    bell: `<svg viewBox="0 0 16 16"><path d="M8 1.3c-2.6 0-4.3 2-4.3 4.6 0 2.9-.9 4-1.7 4.9-.3.4-.1 1 .5 1h11c.6 0 .8-.6.5-1-.8-.9-1.7-2-1.7-4.9 0-2.6-1.7-4.6-4.3-4.6zM6.3 13a1.8 1.8 0 0 0 3.4 0z" fill="currentColor"/></svg>`,
    play: `<svg viewBox="0 0 18 18"><path d="M4 2.2v13.6L15.6 9z" fill="#30D158"/></svg>`,
    alarmBig: `<svg viewBox="0 0 26 26"><circle cx="13" cy="14.5" r="8.3" fill="currentColor"/><path d="M13 9.8v5l3.1 1.9" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.6 7.4 7.4 4.2M22.4 7.4l-3.8-3.2" ${S} stroke-width="2.6"/></svg>`,
  };
  function iconGlyph() {
    const d = new Date(), h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
    const ha = (h + m / 60) * 30, ma = (m + s / 60) * 6, sa = s * 6;
    let nums = '';
    for (let i = 1; i <= 12; i++) {
      const a = (i * 30 * Math.PI) / 180, x = 30 + Math.sin(a) * 19.4, y = 30 - Math.cos(a) * 19.4;
      nums += `<text x="${x.toFixed(1)}" y="${(y + 2.4).toFixed(1)}" text-anchor="middle" font-size="6.6" font-weight="600" fill="#000" font-family="system-ui,-apple-system,'SF Pro Rounded','Helvetica Neue',sans-serif" letter-spacing="-.3">${i}</text>`;
    }
    return `<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="#fff"/>${nums}
      <g stroke-linecap="round"><line x1="30" y1="30" x2="30" y2="17.5" stroke="#000" stroke-width="2.5" transform="rotate(${ha.toFixed(1)} 30 30)"/>
      <line x1="30" y1="30" x2="30" y2="9" stroke="#000" stroke-width="1.9" transform="rotate(${ma.toFixed(1)} 30 30)"/>
      <line x1="30" y1="35.5" x2="30" y2="7.5" stroke="${ORANGE}" stroke-width=".9" transform="rotate(${sa} 30 30)"/></g>
      <circle cx="30" cy="30" r="1.9" fill="#000"/><circle cx="30" cy="30" r="1" fill="${ORANGE}"/></svg>`;
  }

  /* ───────────────────────── generic UI helpers ───────────────────────── */
  function closeOpenRows(scope, except) { scope.querySelectorAll('.ck-srow.open').forEach((r) => { if (r !== except) r.classList.remove('open'); }); }
  function wireSwipe(container, onDelete) {
    container.querySelectorAll('.ck-srow').forEach((row) => {
      const inner = row.querySelector('.ck-srow-in');
      let base = 0;
      U.drag(inner, {
        axis: 'x',
        onStart() { base = row.classList.contains('open') ? -84 : 0; inner.style.transition = 'none'; closeOpenRows(container, row); },
        onMove(p) { let x = Math.min(0, base + p.dx); if (x < -84) x = -84 + (x + 84) * 0.35; inner.style.transform = 'translateX(' + x + 'px)'; },
        onEnd(p) { inner.style.transition = ''; inner.style.transform = ''; row.classList.toggle('open', base + p.dx < -42 || p.vx < -0.5); },
      });
      row.querySelector('.ck-del').addEventListener('click', (e) => {
        e.stopPropagation();
        haptic('light');
        row.style.height = row.offsetHeight + 'px'; void row.offsetHeight;
        row.style.transition = 'height .26s var(--ease), opacity .2s'; row.style.height = '0px'; row.style.opacity = '0';
        setTimeout(() => onDelete(row.dataset.k), 270);
      });
      const minus = row.querySelector('.ck-minus');
      if (minus) minus.addEventListener('click', (e) => { e.stopPropagation(); closeOpenRows(container, row); row.classList.toggle('open'); });
    });
  }
  function tintSheet(body) {
    const host = (body.closest && body.closest('.ios-sheet')) || body;
    try { host.style.setProperty('--tint', ORANGE); } catch (_) {}
    body.classList.add('ck-sheet-body', 'ios-scroll');
    return host;
  }
  function subPage(host, title, build, onBack) {
    const pg = U.el(`<div class="ck-sub"><div class="ck-sub-bar"><button class="ck-sub-back">${IC.back}<span>Back</span></button><div class="ck-sub-title">${esc(title)}</div></div><div class="ck-sub-body ios-scroll"></div></div>`);
    host.appendChild(pg);
    build(pg.querySelector('.ck-sub-body'), pg);
    requestAnimationFrame(() => requestAnimationFrame(() => pg.classList.add('in')));
    pg.querySelector('.ck-sub-back').addEventListener('click', () => {
      if (onBack) onBack();
      pg.classList.remove('in');
      setTimeout(() => pg.remove(), 400);
    });
    return pg;
  }
  function buildSoundList(body, current, onPick, hostEl) {
    body.innerHTML = '<div class="ios-list-header">Ringtones</div><div class="ios-list"></div>';
    const list = body.querySelector('.ios-list');
    const draw = (names) => {
      list.innerHTML = names.map((n) => `<div class="ios-row tappable${'ringtone:' + n === current ? ' check' : ''}" data-id="${esc('ringtone:' + n)}"><span class="ios-row-label">${esc(n)}${n === 'Radar' ? ' (Default)' : ''}</span></div>`).join('');
    };
    draw(toneNames || FALLBACK_TONES);
    if (!toneNames) soundNames().then((n) => { if (list.isConnected) draw(n); });
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.ios-row'); if (!row) return;
      current = row.dataset.id;
      list.querySelectorAll('.ios-row').forEach((r) => r.classList.toggle('check', r === row));
      haptic('selection');
      startPreview(current, hostEl || list);
      onPick(current);
    });
  }

  /* ───────────────────────── World Clock ───────────────────────── */
  function worldRowText(c, now) {
    const info = tzInfo(c.tz, now);
    if (!info) return { off: '', t: '--:--', ap: '' };
    const d = hmDate(info.h, info.m);
    return { off: offsetText(info), t: U.time(d), ap: U.ampm(d) };
  }
  function renderWorld() {
    if (!ui) return;
    const now = new Date(), list = ui.worldList;
    if (!cities.length) { list.innerHTML = '<div class="ck-empty">No World Clocks</div>'; setEditing('world', false); return; }
    list.innerHTML = cities.map((c, i) => {
      const x = worldRowText(c, now);
      return `<div class="ck-srow" data-k="${i}"><button class="ck-del">Delete</button><div class="ck-srow-in ck-wrow"><span class="ck-minus"><i></i></span>
        <div class="ck-w-l"><div class="ck-w-off">${esc(x.off)}</div><div class="ck-w-city">${esc(c.name)}</div></div>
        <div class="ck-w-time"><b style="font-weight:inherit">${x.t}</b><small>${x.ap}</small></div></div></div>`;
    }).join('');
    wireSwipe(list, (k) => { cities.splice(Number(k), 1); saveCities(); renderWorld(); });
    list.querySelectorAll('.ck-srow-in').forEach((el) => el.addEventListener('click', () => closeOpenRows(list)));
  }
  function updateWorldTimes() {
    if (!ui) return;
    const now = new Date();
    ui.worldList.querySelectorAll('.ck-srow').forEach((row) => {
      const c = cities[Number(row.dataset.k)]; if (!c) return;
      const x = worldRowText(c, now);
      const off = row.querySelector('.ck-w-off'), b = row.querySelector('.ck-w-time b'), sm = row.querySelector('.ck-w-time small');
      if (off.textContent !== x.off) off.textContent = x.off;
      if (b.textContent !== x.t) b.textContent = x.t;
      if (sm.textContent !== x.ap) sm.textContent = x.ap;
    });
  }
  function openCitySheet() {
    let ref = null;
    const close = () => { const s = ref; ref = null; if (s) s.close(); };
    const sh = OS.ui.sheet({
      title: 'Choose a City', height: 'large',
      right: { label: 'Cancel', onTap() { close(); } },
      render(body, s) {
        if (s) ref = s;
        tintSheet(body);
        body.innerHTML = '<div class="ck-sh-search ios-search"><input type="text" placeholder="Search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></div><div class="ios-list"></div><div class="ios-list-footer" style="text-align:center;margin-top:30px;display:none">No Results</div>';
        const list = body.querySelector('.ios-list'), none = body.querySelector('.ios-list-footer'), input = body.querySelector('input');
        const draw = () => {
          const q = input.value.trim().toLowerCase();
          const have = new Set(cities.map((c) => c.name + '|' + c.tz));
          const rows = CITY_DB.filter((c) => !have.has(c.name + '|' + c.tz) && (!q || (c.name + ', ' + c.country).toLowerCase().indexOf(q) >= 0));
          list.innerHTML = rows.map((c) => `<div class="ios-row tappable" data-n="${esc(c.name)}" data-tz="${esc(c.tz)}"><span class="ios-row-label">${esc(c.name)}, ${esc(c.country)}</span></div>`).join('');
          list.style.display = rows.length ? '' : 'none'; none.style.display = rows.length ? 'none' : '';
        };
        input.addEventListener('input', draw);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        list.addEventListener('click', (e) => {
          const row = e.target.closest('.ios-row'); if (!row) return;
          cities.push({ name: row.dataset.n, tz: row.dataset.tz }); saveCities(); renderWorld(); haptic('light'); input.blur(); close();
        });
        draw();
      },
    });
    if (sh && !ref) ref = sh;
  }

  /* ───────────────────────── Alarms ───────────────────────── */
  function alarmSub(a) {
    const sn = snoozes.find((s) => s.alarmId === a.id);
    if (sn) return 'Snoozing until ' + U.time(new Date(sn.at));
    const rep = repeatText(a.repeat, true);
    return (a.label || 'Alarm') + (rep ? ', ' + rep : '');
  }
  function renderAlarms() {
    if (!ui) return;
    const list = ui.alarmList;
    if (!alarms.length) { list.innerHTML = '<div class="ck-empty">No Alarms</div>'; setEditing('alarms', false); return; }
    list.innerHTML = alarms.map((a) => {
      const d = hmDate(a.hour, a.minute);
      return `<div class="ck-srow${a.on ? '' : ' off'}" data-k="${esc(a.id)}"><button class="ck-del">Delete</button><div class="ck-srow-in ck-arow"><span class="ck-minus"><i></i></span>
        <div class="ck-a-l"><div class="ck-a-time">${U.time(d)}<small>${U.ampm(d)}</small></div><div class="ck-a-sub">${esc(alarmSub(a))}</div></div>
        <label class="ios-switch"><input type="checkbox"${a.on ? ' checked' : ''}><i></i></label><span class="ios-chevron"></span></div></div>`;
    }).join('');
    wireSwipe(list, (k) => deleteAlarm(k));
    list.querySelectorAll('.ck-srow').forEach((row) => {
      const a = alarms.find((x) => x.id === row.dataset.k); if (!a) return;
      row.querySelector('.ck-srow-in').addEventListener('click', (e) => {
        if (e.target.closest('.ios-switch') || e.target.closest('.ck-minus')) return;
        if (row.classList.contains('open')) { row.classList.remove('open'); return; }
        closeOpenRows(list);
        openAlarmSheet(a);
      });
      row.querySelector('.ios-switch input').addEventListener('change', (e) => {
        a.on = e.target.checked;
        const now = new Date();
        if (a.on && a.hour === now.getHours() && a.minute === now.getMinutes()) a.lastFired = minuteKey(now);
        if (!a.on && snoozes.some((s) => s.alarmId === a.id)) { snoozes = snoozes.filter((s) => s.alarmId !== a.id); saveSnoozes(); }
        saveAlarms(); haptic('light');
        row.classList.toggle('off', !a.on);
        row.querySelector('.ck-a-sub').textContent = alarmSub(a);
      });
    });
  }
  function deleteAlarm(id) {
    alarms = alarms.filter((a) => a.id !== id); saveAlarms();
    if (snoozes.some((s) => s.alarmId === id)) { snoozes = snoozes.filter((s) => s.alarmId !== id); saveSnoozes(); }
    if (firing && firing.kind === 'alarm' && firing.id === id) stopFiring();
    renderAlarms();
  }
  function openAlarmSheet(alarm) {
    const isNew = !alarm, now = new Date();
    const d = alarm ? Object.assign({}, alarm, { repeat: (alarm.repeat || []).slice() })
      : { id: U.uid(), hour: now.getHours(), minute: now.getMinutes(), label: 'Alarm', repeat: [], sound: 'ringtone:Radar', snooze: true, on: true };
    const h24 = !!(OS.settings && OS.settings.get('use24h'));
    let picker = null, ref = null, host = null;
    const close = () => { stopPreview(); const s = ref; ref = null; if (picker) { try { picker.destroy(); } catch (_) {} picker = null; } if (s) s.close(); };
    const readPicker = (v) => {
      if (!v) return;
      if (h24) { d.hour = Number(v[0]); d.minute = Number(v[1]); }
      else { d.hour = (Number(v[0]) % 12) + (v[2] === 'PM' ? 12 : 0); d.minute = Number(v[1]); }
    };
    const sh = OS.ui.sheet({
      title: isNew ? 'Add Alarm' : 'Edit Alarm', height: 'large',
      left: { label: 'Cancel', onTap() { close(); } },
      right: {
        label: 'Save', bold: true,
        onTap() {
          if (picker) readPicker(picker.getValues());
          d.label = (d.label || '').trim() || 'Alarm';
          d.on = true;
          const n = new Date();
          d.lastFired = d.hour === n.getHours() && d.minute === n.getMinutes() ? minuteKey(n) : undefined;
          if (isNew) alarms.push(d); else Object.assign(alarm, d);
          snoozes = snoozes.filter((s) => s.alarmId !== d.id); saveSnoozes();
          sortAlarms(); saveAlarms(); haptic('success'); renderAlarms(); close();
        },
      },
      render(body, s) {
        if (s) ref = s;
        host = tintSheet(body);
        body.innerHTML = `<div class="ck-sh-wheel" data-no-dragscroll></div>
          <div class="ios-list">
            <div class="ios-row tappable" data-r="repeat"><span class="ios-row-label">Repeat</span><span class="ios-row-value" data-v="repeat"></span><span class="ios-chevron"></span></div>
            <div class="ios-row"><span class="ios-row-label ck-lab">Label</span><input type="text" class="ck-sh-label" placeholder="Alarm" enterkeyhint="done" autocomplete="off" maxlength="40"></div>
            <div class="ios-row tappable" data-r="sound"><span class="ios-row-label">Sound</span><span class="ios-row-value" data-v="sound"></span><span class="ios-chevron"></span></div>
            <div class="ios-row"><span class="ios-row-label">Snooze</span><label class="ios-switch"><input type="checkbox" data-sw="snooze"><i></i></label></div>
          </div>
          ${isNew ? '' : '<div class="ios-list" style="margin-top:35px"><div class="ios-row tappable ck-sh-delete">Delete Alarm</div></div>'}
          <div style="height:40px"></div>`;
        const mins = []; for (let i = 0; i < 60; i++) mins.push(i);
        const cols = h24
          ? [{ values: Array.from({ length: 24 }, (_, i) => i), labels: Array.from({ length: 24 }, (_, i) => pad(i)), value: d.hour, loop: true, width: 90, align: 'right' },
            { values: mins, labels: mins.map(pad), value: d.minute, loop: true, width: 90, align: 'left' }]
          : [{ values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], value: d.hour % 12 || 12, loop: true, width: 78, align: 'right' },
            { values: mins, labels: mins.map(pad), value: d.minute, loop: true, width: 70 },
            { values: ['AM', 'PM'], value: d.hour < 12 ? 'AM' : 'PM', width: 78, align: 'left' }];
        picker = OS.ui.wheelPicker(body.querySelector('.ck-sh-wheel'), { columns: cols, onChange: readPicker, onTick: readPicker });
        const vRepeat = body.querySelector('[data-v="repeat"]'), vSound = body.querySelector('[data-v="sound"]');
        const sync = () => { vRepeat.textContent = repeatText(d.repeat, false); vSound.textContent = soundLabel(d.sound); };
        sync();
        const lab = body.querySelector('.ck-sh-label');
        lab.value = d.label === 'Alarm' ? '' : d.label;
        lab.addEventListener('input', () => { d.label = lab.value; });
        lab.addEventListener('keydown', (e) => { if (e.key === 'Enter') lab.blur(); });
        const sn = body.querySelector('[data-sw="snooze"]');
        sn.checked = d.snooze !== false;
        sn.addEventListener('change', () => { d.snooze = sn.checked; });
        body.querySelector('[data-r="repeat"]').addEventListener('click', () => {
          lab.blur();
          subPage(host, 'Repeat', (pb) => {
            pb.innerHTML = '<div class="ios-list" style="margin-top:12px">' + [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="ios-row tappable${d.repeat.indexOf(i) >= 0 ? ' check' : ''}" data-d="${i}"><span class="ios-row-label">Every ${DAYS[i]}</span></div>`).join('') + '</div>';
            pb.addEventListener('click', (e) => {
              const row = e.target.closest('.ios-row'); if (!row) return;
              const i = Number(row.dataset.d), at = d.repeat.indexOf(i);
              if (at >= 0) d.repeat.splice(at, 1); else d.repeat.push(i);
              row.classList.toggle('check', at < 0); haptic('selection'); sync();
            });
          });
        });
        body.querySelector('[data-r="sound"]').addEventListener('click', () => {
          lab.blur();
          subPage(host, 'Sound', (pb, pg) => buildSoundList(pb, d.sound, (id) => { d.sound = id; sync(); }, pg), stopPreview);
        });
        const del = body.querySelector('.ck-sh-delete');
        if (del) del.addEventListener('click', () => { haptic('medium'); close(); deleteAlarm(alarm.id); });
      },
    });
    if (sh && !ref) ref = sh;
  }

  /* ───────────────────────── Stopwatch ───────────────────────── */
  const swTotal = () => sw.acc + (sw.running ? Date.now() - sw.startedAt : 0);
  function fmtSW(ms) {
    const cs = Math.floor(Math.max(0, ms) / 10), c = cs % 100, s = Math.floor(cs / 100) % 60, m = Math.floor(cs / 6000) % 60, h = Math.floor(cs / 360000);
    return (h ? h + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(c);
  }
  function renderSW() {
    if (!ui) return;
    const total = swTotal();
    ui.swLap.textContent = sw.running || total === 0 ? 'Lap' : 'Reset';
    ui.swLap.disabled = !sw.running && total === 0;
    ui.swGo.textContent = sw.running ? 'Stop' : 'Start';
    ui.swGo.className = 'ck-round ' + (sw.running ? 'red' : 'green');
    let fast = -1, slow = -1;
    if (sw.laps.length >= 2) { let mn = Infinity, mx = -1; sw.laps.forEach((l, i) => { if (l < mn) { mn = l; fast = i; } if (l > mx) { mx = l; slow = i; } }); }
    let html = '';
    if (total > 0 || sw.laps.length) html += `<div class="ck-lap"><span>Lap ${sw.laps.length + 1}</span><span class="ck-lap-live"></span></div>`;
    for (let i = sw.laps.length - 1; i >= 0; i--) html += `<div class="ck-lap${i === fast ? ' fast' : i === slow ? ' slow' : ''}"><span>Lap ${i + 1}</span><span>${fmtSW(sw.laps[i])}</span></div>`;
    ui.swLaps.innerHTML = html;
    ui.swLive = ui.swLaps.querySelector('.ck-lap-live');
    tickSW();
  }
  function tickSW() {
    if (!ui) return;
    const total = swTotal(), txt = fmtSW(total);
    if (ui.swRead.textContent !== txt) { ui.swRead.textContent = txt; ui.swRead.classList.toggle('long', txt.length > 8); }
    if (ui.swLive) ui.swLive.textContent = fmtSW(total - sw.laps.reduce((a, b) => a + b, 0));
  }
  function swToggle() {
    if (sw.running) { sw.acc = swTotal(); sw.running = false; } else { sw.startedAt = Date.now(); sw.running = true; }
    saveSW(); haptic('light'); renderSW();
  }
  function swLapReset() {
    if (sw.running) { const total = swTotal(); sw.laps.push(total - sw.laps.reduce((a, b) => a + b, 0)); }
    else sw = { running: false, startedAt: 0, acc: 0, laps: [] };
    saveSW(); haptic('light'); renderSW();
  }

  /* ───────────────────────── Timers ───────────────────────── */
  const RING_C = 2 * Math.PI * 160;
  function renderTimerOptions() {
    if (!ui) return;
    ui.root.querySelectorAll('[data-v="tsound"]').forEach((el) => { el.textContent = soundLabel(timer ? timer.sound : timerSound); });
  }
  function renderRecents() {
    if (!ui) return;
    const box = ui.recents;
    if (!recents.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="ck-rec-h">Recents</div>' + recents.map((r) => `<div class="ck-srow" data-k="${r}"><button class="ck-del">Delete</button><div class="ck-srow-in ck-rrow">
      <div class="ck-r-l"><div class="ck-r-t">${fmtDur(r)}</div><div class="ck-r-s">${durWords(r)}</div></div><button class="ck-play" aria-label="Start">${IC.play}</button></div></div>`).join('');
    wireSwipe(box, (k) => { recents = recents.filter((r) => r !== Number(k)); OS.store.set(K.recents, recents); renderRecents(); });
    box.querySelectorAll('.ck-srow').forEach((row) => {
      row.querySelector('.ck-play').addEventListener('click', (e) => { e.stopPropagation(); haptic('light'); startTimer(Number(row.dataset.k), '', resolveSound(timerSound)); });
      row.querySelector('.ck-srow-in').addEventListener('click', () => closeOpenRows(box));
    });
  }
  function renderTimer() {
    if (!ui) return;
    const running = !!timer;
    ui.tmSetup.hidden = running; ui.tmRun.hidden = !running;
    ui.tmSetup.style.display = running ? 'none' : ''; ui.tmRun.style.display = running ? '' : 'none';
    renderTimerOptions();
    if (running) {
      const paused = timer.state === 'paused';
      ui.tmPause.textContent = paused ? 'Resume' : 'Pause';
      ui.tmPause.className = 'ck-round ' + (paused ? 'green' : 'orange');
      ui.ring.classList.toggle('paused', paused);
      ui.ringLab.textContent = timer.label || '';
      tickTimerUI(true);
    } else {
      renderRecents();
      ui.tmStart.disabled = pickerSeconds() <= 0;
    }
  }
  function tickTimerUI(force) {
    if (!ui || !timer) return;
    const ms = timerRemainingMs(), txt = fmtDur(Math.ceil(ms / 1000));
    if (force || ui.ringT.textContent !== txt) { ui.ringT.textContent = txt; ui.ringT.classList.toggle('long', txt.length > 5); }
    const frac = U.clamp(1 - ms / (timer.duration * 1000), 0, 1);
    ui.ringArc.style.strokeDashoffset = String(-RING_C * frac);
    const end = new Date(timer.state === 'paused' ? Date.now() + ms : timer.endAt);
    const et = U.time(end) + (U.ampm(end) ? ' ' + U.ampm(end) : '');
    if (ui.ringEndT.textContent !== et) ui.ringEndT.textContent = et;
  }
  let tmVals = [0, 5, 0];
  const pickerSeconds = () => tmVals[0] * 3600 + tmVals[1] * 60 + tmVals[2];
  function openTimerSoundSheet() {
    let ref = null, chosen = timer ? timer.sound : timerSound;
    const close = () => { stopPreview(); const s = ref; ref = null; if (s) s.close(); };
    const sh = OS.ui.sheet({
      title: 'When Timer Ends', height: 'large',
      left: { label: 'Cancel', onTap() { close(); } },
      right: { label: 'Set', bold: true, onTap() {
        timerSound = chosen; OS.store.set(K.tsound, timerSound);
        if (timer) { timer.sound = chosen; saveTimer(); }
        renderTimerOptions(); close();
      } },
      render(body, s) { if (s) ref = s; const host = tintSheet(body); buildSoundList(body, chosen, (id) => { chosen = id; }, host); body.insertAdjacentHTML('beforeend', '<div style="height:40px"></div>'); },
    });
    if (sh && !ref) ref = sh;
  }

  /* ───────────────────────── takeover ───────────────────────── */
  function showTakeover() {
    if (!ui) return;
    if (!firing || firing.kind !== 'alarm') { hideTakeover(); return; }
    ui.takeover.innerHTML = `<div class="ck-to-icon">${IC.alarmBig}</div><div class="ck-to-time">${U.time(new Date())}</div><div class="ck-to-label">${esc(firing.label)}</div>
      ${firing.snooze ? '<button class="ck-to-snooze" data-act="snooze">Snooze</button>' : ''}<button class="ck-to-stop" data-act="stop">Stop</button>`;
    ui.takeover.classList.add('in');
  }
  function hideTakeover() { if (ui) ui.takeover.classList.remove('in'); }

  /* ───────────────────────── tabs / loop / refresh ───────────────────────── */
  function setEditing(which, on) {
    const pane = ui && ui.panes[which]; if (!pane) return;
    pane.classList.toggle('editing', on);
    const btn = pane.querySelector('.ck-edit');
    if (btn) { btn.textContent = on ? 'Done' : 'Edit'; btn.classList.toggle('bold', on); }
    if (!on) closeOpenRows(pane);
  }
  function selectTab(t) {
    if (!ui || !ui.panes[t]) return;
    tab = t; OS.store.set(K.tab, t);
    Object.keys(ui.panes).forEach((k) => { ui.panes[k].classList.toggle('on', k === t); if (k !== t) setEditing(k, false); });
    ui.tabs.forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'world') updateWorldTimes();
    if (t === 'alarms') renderAlarms();
    if (t === 'stopwatch') renderSW();
    if (t === 'timer') renderTimer();
  }
  function refresh() { if (!ui) return; renderTimer(); }
  let lastSec = 0;
  function loop() {
    raf = 0;
    if (!ui || !active) return;
    if (tab === 'stopwatch') { if (sw.running) tickSW(); }
    else if (tab === 'timer') { if (timer && timer.state === 'running') tickTimerUI(); }
    const s = Math.floor(Date.now() / 1000);
    if (s !== lastSec) {
      lastSec = s;
      if (tab === 'world') updateWorldTimes();
      if (firing && firing.kind === 'alarm') { const t = ui.takeover.querySelector('.ck-to-time'); if (t) { const x = U.time(new Date()); if (t.textContent !== x) t.textContent = x; } }
    }
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!raf && active) raf = requestAnimationFrame(loop); }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  const on24h = () => { if (!ui) return; renderWorld(); renderAlarms(); renderTimer(); };
  OS.on('setting:use24h', on24h);

  /* ───────────────────────── launch ───────────────────────── */
  function build(ctx) {
    const root = ctx.root;
    root.innerHTML = `
      <div class="ck-pane" data-pane="world">
        <div class="ck-scroll ios-scroll"><div class="ck-title">World Clock</div><div class="ck-list"></div></div>
        <div class="ck-bar"><button class="ck-edit">Edit</button><div class="ck-bar-title">World Clock</div><button class="ck-plus" aria-label="Add">${IC.plus}</button></div>
      </div>
      <div class="ck-pane" data-pane="alarms">
        <div class="ck-scroll ios-scroll"><div class="ck-title">Alarms</div><div class="ck-list"></div></div>
        <div class="ck-bar"><button class="ck-edit">Edit</button><div class="ck-bar-title">Alarms</div><button class="ck-plus" aria-label="Add">${IC.plus}</button></div>
      </div>
      <div class="ck-pane" data-pane="stopwatch">
        <div class="ck-sw"><div class="ck-sw-read">00:00.00</div>
          <div class="ck-btnrow"><button class="ck-round gray" data-sw="lap">Lap</button><button class="ck-round green" data-sw="go">Start</button></div>
          <div class="ck-sw-laps ios-scroll"></div></div>
      </div>
      <div class="ck-pane ck-tm" data-pane="timer">
        <div class="ck-scroll ios-scroll"><div class="ck-title" style="border-bottom:0">Timers</div>
          <div class="ck-tm-setup">
            <div class="ck-tm-wheel" data-no-dragscroll></div>
            <div class="ck-btnrow"><button class="ck-round gray" data-tm="cancel0" disabled>Cancel</button><button class="ck-round green" data-tm="start">Start</button></div>
            <div class="ios-list">
              <div class="ios-row"><span class="ios-row-label ck-lab">Label</span><input type="text" class="ck-tm-label" placeholder="Timer" enterkeyhint="done" autocomplete="off" maxlength="40"></div>
              <div class="ios-row tappable" data-tm="sound"><span class="ios-row-label">When Timer Ends</span><span class="ios-row-value" data-v="tsound"></span><span class="ios-chevron"></span></div>
            </div>
            <div class="ck-recents"></div>
          </div>
          <div class="ck-tm-run" hidden>
            <div class="ck-ring"><svg viewBox="0 0 340 340"><circle cx="170" cy="170" r="160" fill="none" stroke="#2C2C2E" stroke-width="8"/>
              <circle class="ck-ring-arc" cx="170" cy="170" r="160" fill="none" stroke="${ORANGE}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${RING_C.toFixed(2)} ${RING_C.toFixed(2)}"/></svg>
              <div class="ck-ring-c"><div class="ck-ring-lab"></div><div class="ck-ring-t">0:00</div><div class="ck-ring-end">${IC.bell}<span></span></div></div></div>
            <div class="ck-btnrow" style="margin-top:6px"><button class="ck-round gray" data-tm="cancel">Cancel</button><button class="ck-round orange" data-tm="pause">Pause</button></div>
            <div class="ios-list"><div class="ios-row tappable" data-tm="sound"><span class="ios-row-label">When Timer Ends</span><span class="ios-row-value" data-v="tsound"></span><span class="ios-chevron"></span></div></div>
          </div>
        </div>
        <div class="ck-bar"><span></span><div class="ck-bar-title">Timers</div><span></span></div>
      </div>
      <div class="ios-tabbar">
        <div class="ios-tab" data-tab="world">${IC.world}<span>World Clock</span></div>
        <div class="ios-tab" data-tab="alarms">${IC.alarm}<span>Alarms</span></div>
        <div class="ios-tab" data-tab="stopwatch">${IC.stopwatch}<span>Stopwatch</span></div>
        <div class="ios-tab" data-tab="timer">${IC.timer}<span>Timers</span></div>
      </div>
      <div class="ck-takeover"></div>`;
    const $ = (s) => root.querySelector(s);
    const panes = {}; root.querySelectorAll('.ck-pane').forEach((p) => { panes[p.dataset.pane] = p; });
    ui = {
      root, panes, tabs: Array.from(root.querySelectorAll('.ios-tab')), takeover: $('.ck-takeover'),
      worldList: panes.world.querySelector('.ck-list'), alarmList: panes.alarms.querySelector('.ck-list'),
      swRead: $('.ck-sw-read'), swLap: $('[data-sw="lap"]'), swGo: $('[data-sw="go"]'), swLaps: $('.ck-sw-laps'), swLive: null,
      tmSetup: $('.ck-tm-setup'), tmRun: $('.ck-tm-run'), tmStart: $('[data-tm="start"]'), tmPause: $('[data-tm="pause"]'), recents: $('.ck-recents'),
      ring: $('.ck-ring'), ringArc: $('.ck-ring-arc'), ringT: $('.ck-ring-t'), ringLab: $('.ck-ring-lab'), ringEndT: $('.ck-ring-end span'), picker: null,
    };
    // collapse large titles
    root.querySelectorAll('.ck-pane > .ck-scroll').forEach((sc) => sc.addEventListener('scroll', () => sc.parentElement.classList.toggle('scrolled', sc.scrollTop > 36), { passive: true }));
    ui.tabs.forEach((b) => b.addEventListener('click', () => { if (tab !== b.dataset.tab) haptic('selection'); selectTab(b.dataset.tab); }));
    // world / alarms bars
    panes.world.querySelector('.ck-edit').addEventListener('click', () => { if (cities.length) setEditing('world', !panes.world.classList.contains('editing')); });
    panes.world.querySelector('.ck-plus').addEventListener('click', () => { setEditing('world', false); openCitySheet(); });
    panes.alarms.querySelector('.ck-edit').addEventListener('click', () => { if (alarms.length) setEditing('alarms', !panes.alarms.classList.contains('editing')); });
    panes.alarms.querySelector('.ck-plus').addEventListener('click', () => { setEditing('alarms', false); openAlarmSheet(null); });
    // stopwatch
    ui.swGo.addEventListener('click', swToggle);
    ui.swLap.addEventListener('click', swLapReset);
    // timers
    const last = Math.max(0, Number(OS.store.get(K.tlast, 300)) || 300);
    tmVals = [Math.min(23, Math.floor(last / 3600)), Math.floor((last % 3600) / 60), last % 60];
    const r60 = Array.from({ length: 60 }, (_, i) => i);
    const onVals = (v) => { tmVals = v.map(Number); ui.tmStart.disabled = pickerSeconds() <= 0; };
    ui.picker = OS.ui.wheelPicker($('.ck-tm-wheel'), {
      columns: [{ values: Array.from({ length: 24 }, (_, i) => i), value: tmVals[0], unit: 'hours' }, { values: r60, value: tmVals[1], unit: 'min', loop: true }, { values: r60, value: tmVals[2], unit: 'sec', loop: true }],
      onChange: onVals, onTick: onVals,
    });
    const tl = $('.ck-tm-label');
    tl.value = timerLabel;
    tl.addEventListener('input', () => { timerLabel = tl.value; });
    tl.addEventListener('keydown', (e) => { if (e.key === 'Enter') tl.blur(); });
    ui.tmStart.addEventListener('click', () => {
      tl.blur();
      if (ui.picker) tmVals = ui.picker.getValues().map(Number);
      if (pickerSeconds() <= 0) return;
      haptic('light'); startTimer(pickerSeconds(), timerLabel.trim(), resolveSound(timerSound));
    });
    root.querySelector('[data-tm="cancel"]').addEventListener('click', () => { haptic('light'); cancelTimer(); });
    ui.tmPause.addEventListener('click', () => { haptic('light'); if (timer && timer.state === 'paused') resumeTimer(); else pauseTimer(); });
    root.querySelectorAll('[data-tm="sound"]').forEach((el) => el.addEventListener('click', openTimerSoundSheet));
    // takeover
    ui.takeover.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      haptic('medium');
      if (b.dataset.act === 'snooze') snoozeFiring(); else stopFiring();
    });
    renderWorld(); renderAlarms(); renderSW(); renderTimer();
    selectTab(ui.panes[tab] ? tab : 'world');
  }

  OS.registerApp({
    id: 'clock',
    name: 'Clock',
    icon: { bg: '#000', glyph: iconGlyph() },
    system: true,
    statusBar: 'light',
    background: '#000',
    launch(ctx) { build(ctx); },
    onResume(ctx, params) {
      active = true;
      try { ctx.setStatusBar('light'); } catch (_) {}
      if (!ui) return;
      if (params && params.tab && ui.panes[params.tab]) selectTab(params.tab);
      else if (params && params.alarm) selectTab('alarms');
      else selectTab(tab);
      renderWorld();
      if (firing && firing.kind === 'alarm') showTakeover(); else hideTakeover();
      startLoop();
    },
    onPause() { active = false; stopLoop(); stopPreview(); },
    onClose() {
      active = false; stopLoop(); stopPreview();
      if (ui && ui.picker) { try { ui.picker.destroy(); } catch (_) {} }
      ui = null;                                   // the module-level checker keeps running: alarms + timers still fire
    },
  });
})();
