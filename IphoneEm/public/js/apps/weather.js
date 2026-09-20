/* Weather — real forecasts from Open-Meteo (no key), animated condition backgrounds, iOS layout.
 * Public: OS.weather.current() → { city, temp, code, condition, high, low, unit, isDay, updated } | null   ·   event 'weather:update'
 */
(function () {
  'use strict';
  if (!window.OS) return;
  const U = OS.util, esc = U.esc, clamp = U.clamp;
  const K = { places: 'weather.places', unit: 'weather.unit', page: 'weather.page', cache: 'weather.cache.' };
  const TEN_MIN = 10 * 60000;
  const haptic = (t) => { try { OS.haptic && OS.haptic(t); } catch (_) {} };
  const use24 = () => !!(OS.settings && OS.settings.get('use24h'));

  /* ───────────────────────── state ───────────────────────── */
  let places = OS.store.get(K.places, null);
  if (!Array.isArray(places) || !places.length) {
    places = [
      { id: 'me', me: true, name: 'Cupertino', lat: 37.323, lon: -122.032 },
      { id: 'nyc', name: 'New York', admin: 'New York', country: 'United States', lat: 40.7143, lon: -74.006 },
      { id: 'tyo', name: 'Tokyo', admin: 'Tokyo', country: 'Japan', lat: 35.6895, lon: 139.6917 },
    ];
    OS.store.set(K.places, places);
  }
  let unit = OS.store.get(K.unit, 'F') === 'C' ? 'C' : 'F';
  let pageIdx = clamp(Number(OS.store.get(K.page, 0)) || 0, 0, places.length - 1);
  const mem = {};          // id → { t, lat, lon, data }
  const failed = {};       // id → true when the last refresh failed
  const inflight = {};
  let ui = null, active = false, located = false;

  const savePlaces = () => OS.store.set(K.places, places);
  function getCache(id) {
    if (!(id in mem)) mem[id] = OS.store.get(K.cache + id, null);
    const c = mem[id];
    return c && c.data && c.data.current && c.data.daily && c.data.hourly && Date.now() - c.t < 3 * 864e5 ? c : null;      // older than 3 days = useless
  }
  function setCache(id, c) { mem[id] = c; OS.store.set(K.cache + id, c); }

  /* ───────────────────────── units & formatting ───────────────────────── */
  const T = (f) => (f == null || isNaN(f) ? null : Math.round(unit === 'C' ? ((f - 32) * 5) / 9 : f));
  const deg = (f) => { const v = T(f); return v == null ? '--' : (Object.is(v, -0) ? 0 : v) + '°'; };
  const pms = (s) => (s ? Date.parse(s + (s.length <= 16 ? ':00Z' : 'Z')) : NaN);                 // place-local ISO → pseudo-UTC ms
  const nowP = (d) => Date.now() + (d.off || 0) * 1000;                               // "now" on the place's wall clock (pseudo-UTC ms)
  function fmtClock(ms, spaced) {
    const d = new Date(ms), h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
    if (use24()) return String(h).padStart(2, '0') + ':' + m;
    return ((h % 12) || 12) + ':' + m + (spaced ? ' ' : '') + (h < 12 ? 'AM' : 'PM');
  }
  function fmtHour(ms) { const h = new Date(ms).getUTCHours(); return use24() ? String(h).padStart(2, '0') : ((h % 12) || 12) + (h < 12 ? 'AM' : 'PM'); }
  const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const windU = (mph) => (unit === 'C' ? Math.round(mph * 1.609) : Math.round(mph));
  const windL = () => (unit === 'C' ? 'km/h' : 'mph');
  const precipTxt = (mm) => (unit === 'C' ? (mm < 10 ? Math.round(mm * 10) / 10 : Math.round(mm)) + ' mm' : (Math.round((mm / 25.4) * 100) / 100 || 0) + '"');
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  /* ───────────────────────── WMO codes ───────────────────────── */
  function condition(code, isDay) {
    switch (code) {
      case 0: return isDay ? 'Sunny' : 'Clear';
      case 1: return isDay ? 'Mostly Sunny' : 'Mostly Clear';
      case 2: return 'Partly Cloudy';
      case 3: return 'Cloudy';
      case 45: case 48: return 'Fog';
      case 51: case 53: case 55: return 'Drizzle';
      case 56: case 57: return 'Freezing Drizzle';
      case 61: return 'Light Rain';
      case 63: case 80: case 81: return code === 63 ? 'Rain' : 'Showers';
      case 65: case 82: return 'Heavy Rain';
      case 66: case 67: return 'Freezing Rain';
      case 71: return 'Light Snow';
      case 73: return 'Snow';
      case 75: return 'Heavy Snow';
      case 77: return 'Flurries';
      case 85: case 86: return 'Snow Showers';
      case 95: case 96: case 99: return 'Thunderstorms';
      default: return 'Cloudy';
    }
  }
  function kindOf(code, isDay) {
    if (code <= 1) return isDay ? 'sun' : 'moon';
    if (code === 2) return isDay ? 'cloudSun' : 'cloudMoon';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code === 65 || code === 67 || code === 82) return 'heavy';
    if (code >= 51 && code <= 67) return 'rain';
    if (code === 80 || code === 81) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'bolt';
    return 'cloud';
  }
  function sceneOf(code, isDay) {
    const k = kindOf(code, isDay);
    const type = k === 'sun' || k === 'moon' ? 'clear' : k === 'cloudSun' || k === 'cloudMoon' ? 'partly' : k === 'cloud' ? 'cloudy' : k === 'fog' ? 'fog'
      : k === 'snow' ? 'snow' : k === 'bolt' ? 'thunder' : 'rain';
    return type + '-' + (isDay ? 'day' : 'night');
  }
  const isWet = (code) => (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;
  const GRADS = {
    'clear-day': ['#1B66C4', '#3F8FE0', '#86C3F1'], 'clear-night': ['#03061A', '#0F1838', '#2A3964'],
    'partly-day': ['#2F72C2', '#5F9FDB', '#A0C8EA'], 'partly-night': ['#060A1E', '#162040', '#323F68'],
    'cloudy-day': ['#53708C', '#7A92A8', '#A6B6C4'], 'cloudy-night': ['#10141D', '#232A37', '#3B4453'],
    'rain-day': ['#38475A', '#566779', '#7B8C9D'], 'rain-night': ['#0A0E16', '#19202B', '#2D3644'],
    'snow-day': ['#64778E', '#8C9EB1', '#B6C3CF'], 'snow-night': ['#121823', '#27303F', '#434E60'],
    'thunder-day': ['#1A1F2A', '#2E3647', '#4A5468'], 'thunder-night': ['#06080E', '#131823', '#252D3C'],
    'fog-day': ['#75838F', '#97A3AE', '#BCC5CD'], 'fog-night': ['#181D26', '#2C333E', '#444C58'],
  };
  const sceneCSS = (kind) => { const g = GRADS[kind] || GRADS['clear-day']; return `linear-gradient(180deg,${g[0]},${g[1]} 55%,${g[2]})`; };

  /* ───────────────────────── glyphs (own drawings) ───────────────────────── */
  const Y = '#FFD60A', Wt = '#fff', Bl = '#7FD4FF';
  const CLOUD_D = 'M10 24a5.5 5.5 0 0 1-.9-10.9 7.5 7.5 0 0 1 14.3-1.6A6.3 6.3 0 0 1 22.8 24z';
  const cloud = (tf) => `<path d="${CLOUD_D}" fill="${Wt}"${tf ? ` transform="${tf}"` : ''}/>`;
  function sunShape(cx, cy, r) {
    let rays = '';
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); rays += `M${(cx + c * (r + 2.2)).toFixed(2)} ${(cy + s * (r + 2.2)).toFixed(2)}L${(cx + c * (r + 4.6)).toFixed(2)} ${(cy + s * (r + 4.6)).toFixed(2)}`; }
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${Y}"/><path d="${rays}" stroke="${Y}" stroke-width="1.9" stroke-linecap="round" fill="none"/>`;
  }
  const MOON_D = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
  const line = (d, col, w) => `<path d="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const GLYPHS = {
    sun: sunShape(16, 16, 5.6),
    moon: `<path d="${MOON_D}" fill="${Wt}" transform="translate(4.5 4.5) scale(.96)"/>`,
    cloud: cloud('translate(-.7 1)'),
    cloudSun: sunShape(12, 11.5, 4.3) + cloud('translate(5.2 7.6) scale(.82)'),
    cloudMoon: `<path d="${MOON_D}" fill="${Wt}" transform="translate(14 1.5) scale(.6)"/>` + cloud('translate(1.5 8) scale(.84)'),
    rain: cloud('translate(1 -4.5) scale(.92)') + line('M11 23.5l-1.4 4M16.4 23.5 15 27.5M21.8 23.5l-1.4 4', Bl, 1.9),
    heavy: cloud('translate(1 -5.5) scale(.92)') + line('M9.6 22l-2.2 6.4M14.4 22l-2.2 6.4M19.2 22 17 28.4M24 22l-2.2 6.4', Bl, 1.9),
    snow: cloud('translate(1 -4.5) scale(.92)') + `<g fill="${Wt}"><circle cx="10.5" cy="24.5" r="1.45"/><circle cx="16" cy="27.6" r="1.45"/><circle cx="21.5" cy="24.5" r="1.45"/><circle cx="16" cy="22.6" r="1.1"/></g>`,
    bolt: cloud('translate(1 -5) scale(.92)') + `<path d="M17.6 19.2l-5 6.6h3.6l-1.6 5.2 5.8-7.4h-3.7l1.9-4.4z" fill="${Y}"/>`,
    fog: cloud('translate(1 -5) scale(.92)') + line('M6.5 23.4h19M9.5 27.6h13', Wt, 2),
    sunrise: line('M4 25h24', Wt, 1.8) + `<path d="M9.4 21.5a6.6 6.6 0 0 1 13.2 0z" fill="${Y}"/>` + line('M16 11.5V4.8M12.9 7.8 16 4.7l3.1 3.1', Y, 1.9),
    sunset: line('M4 25h24', Wt, 1.8) + `<path d="M9.4 21.5a6.6 6.6 0 0 1 13.2 0z" fill="${Y}"/>` + line('M16 4.8v6.7M12.9 8.5 16 11.6l3.1-3.1', Y, 1.9),
  };
  const glyph = (kind, size) => `<svg class="wx-g" viewBox="0 0 32 32" width="${size || 28}" height="${size || 28}">${GLYPHS[kind] || GLYPHS.cloud}</svg>`;
  const SF = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const CAP = {
    clock: `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.6" ${SF} stroke-width="1.5"/><path d="M7 3.8V7l2.1 1.3" ${SF} stroke-width="1.5"/></svg>`,
    cal: `<svg viewBox="0 0 14 14"><rect x="1.6" y="2.4" width="10.8" height="10" rx="2.2" ${SF} stroke-width="1.5"/><path d="M1.8 5.8h10.4M4.6 1.2v2.2M9.4 1.2v2.2" ${SF} stroke-width="1.5"/></svg>`,
    uv: `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.7" fill="currentColor"/><path d="M7 .9v1.7M7 11.4v1.7M.9 7h1.7M11.4 7h1.7M2.7 2.7l1.2 1.2M10.1 10.1l1.2 1.2M2.7 11.3l1.2-1.2M10.1 3.9l1.2-1.2" ${SF} stroke-width="1.4"/></svg>`,
    sunset: `<svg viewBox="0 0 14 14"><path d="M1 10.6h12M3.4 13h7.2" ${SF} stroke-width="1.4"/><path d="M3.6 8.6a3.4 3.4 0 0 1 6.8 0z" fill="currentColor"/><path d="M7 1v3.2M5.4 2.8 7 4.4l1.6-1.6" ${SF} stroke-width="1.4"/></svg>`,
    wind: `<svg viewBox="0 0 14 14"><path d="M1 5h7.2a2 2 0 1 0-2-2M1 8h10a2 2 0 1 1-2 2M1 11h4.4" ${SF} stroke-width="1.5"/></svg>`,
    drop: `<svg viewBox="0 0 14 14"><path d="M7 1.2C5 4 3 6.2 3 8.6a4 4 0 0 0 8 0C11 6.2 9 4 7 1.2z" fill="currentColor"/></svg>`,
    thermo: `<svg viewBox="0 0 14 14"><path d="M5.4 8.2V2.8a1.6 1.6 0 0 1 3.2 0v5.4a3 3 0 1 1-3.2 0z" ${SF} stroke-width="1.4"/><circle cx="7" cy="10.4" r="1.4" fill="currentColor"/></svg>`,
    humid: `<svg viewBox="0 0 14 14"><path d="M1.2 4.2c1.4-1.4 2.6-1.4 3.9 0s2.500 1.400 3.900 0 2.600-1.400 3.800 0M1.200 7.600c1.400-1.400 2.600-1.400 3.900 0s2.500 1.400 3.900 0 2.600-1.400 3.800 0M1.200 11c1.400-1.400 2.600-1.400 3.900 0s2.500 1.400 3.900 0 2.600-1.400 3.800 0" ${SF} stroke-width="1.4"/></svg>`,
    eye: `<svg viewBox="0 0 14 14"><path d="M.9 7C2.500 4.300 4.600 3 7 3s4.500 1.300 6.100 4C11.500 9.700 9.400 11 7 11S2.500 9.700.9 7z" ${SF} stroke-width="1.4"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>`,
    gauge: `<svg viewBox="0 0 14 14"><path d="M2.600 11.400a6 6 0 1 1 8.800 0" ${SF} stroke-width="1.5"/><path d="M7 7.400 9.600 4.400" ${SF} stroke-width="1.6"/></svg>`,
    map: `<svg viewBox="0 0 26 26"><path d="M3.500 6.600 9.600 4.200l6.800 2.600 6.100-2.400v15l-6.100 2.400-6.800-2.600-6.100 2.400zM9.600 4.200v15M16.400 6.800v15" ${SF} stroke-width="1.8"/></svg>`,
    list: `<svg viewBox="0 0 26 26"><path d="M9 7h13M9 13h13M9 19h13" ${SF} stroke-width="2"/><circle cx="4.600" cy="7" r="1.500" fill="currentColor"/><circle cx="4.600" cy="13" r="1.500" fill="currentColor"/><circle cx="4.600" cy="19" r="1.500" fill="currentColor"/></svg>`,
    arrow: `<svg viewBox="0 0 12 12"><path d="M10.800 1.200 1.300 5.300l4.200 1.200 1.200 4.200z" fill="currentColor"/></svg>`,
    dots: `<svg viewBox="0 0 22 22"><circle cx="5" cy="11" r="1.800" fill="currentColor"/><circle cx="11" cy="11" r="1.800" fill="currentColor"/><circle cx="17" cy="11" r="1.800" fill="currentColor"/></svg>`,
    trash: `<svg viewBox="0 0 22 22"><path d="M4 6h14M8.500 6V4.200h5V6M6 6l.8 12h8.400L16 6M9.300 9.300v5.600M12.700 9.300v5.600" ${SF} stroke-width="1.700"/></svg>`,
    check: `<svg viewBox="0 0 14 12"><path d="M1.500 6.500l3.800 3.800L12.500 1.700" ${SF} stroke-width="2.200"/></svg>`,
  };

  /* ───────────────────────── data ───────────────────────── */
  function apiURL(p) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day,precipitation' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,is_day,visibility' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=10';
  }
  function trim(j) {
    const h = j.hourly || {}, d = j.daily || {}, ht = h.time || [], n = Math.min(72, ht.length);
    const hp = h.precipitation_probability || [];
    const pop = (d.time || []).map((_, di) => { let m = 0; for (let i = di * 24; i < Math.min((di + 1) * 24, ht.length); i++) m = Math.max(m, hp[i] || 0); return m; });
    const cut = (a) => (a || []).slice(0, n);
    return {
      off: j.utc_offset_seconds || 0, tz: j.timezone || '', current: j.current,
      hourly: { time: cut(ht), temp: cut(h.temperature_2m), code: cut(h.weather_code), pop: cut(hp), isDay: cut(h.is_day), vis: cut(h.visibility) },
      daily: { time: d.time || [], code: d.weather_code || [], max: d.temperature_2m_max || [], min: d.temperature_2m_min || [], sunrise: d.sunrise || [], sunset: d.sunset || [],
        uv: d.uv_index_max || [], precip: d.precipitation_sum || [], pop },
    };
  }
  async function getJSON(url, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => { try { ctl && ctl.abort(); } catch (_) {} }, ms || 12000);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }
  const samePos = (c, p) => c && Math.abs(c.lat - p.lat) < 0.02 && Math.abs(c.lon - p.lon) < 0.02;
  function refreshPlace(p, force) {
    const c = getCache(p.id);
    if (!force && c && samePos(c, p) && Date.now() - c.t < TEN_MIN) return Promise.resolve(c);
    if (inflight[p.id]) return inflight[p.id];
    inflight[p.id] = (async () => {
      let out = null;
      try {
        if (OS.settings && OS.settings.get('airplane') && !OS.settings.get('wifi')) throw new Error('offline');
        const j = await getJSON(apiURL(p));
        if (!j || !j.current || !j.daily || !j.hourly) throw new Error('bad response');
        out = { t: Date.now(), lat: p.lat, lon: p.lon, data: trim(j) };
        setCache(p.id, out);
        failed[p.id] = false;
      } catch (e) { failed[p.id] = true; }
      delete inflight[p.id];
      if (out) { try { OS.emit('weather:update', { id: p.id, primary: places[0] && places[0].id === p.id }); } catch (_) {} }
      if (ui && places.indexOf(p) >= 0) { renderPage(p); renderCards(); syncScene(); }
      return out;
    })();
    return inflight[p.id];
  }
  function refreshAll(force) { places.forEach((p) => refreshPlace(p, force)); }

  function locate() {
    if (located || !navigator.geolocation) return;
    located = true;
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const me = places.find((p) => p.me); if (!me || !pos || !pos.coords) return;
        const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
        const moved = Math.abs(lat - me.lat) > 0.02 || Math.abs(lon - me.lon) > 0.02;
        if (!moved && me.real) return;
        me.lat = lat; me.lon = lon; me.real = true;
        if (moved) {
          me.name = 'My Location';
          // (no reverse geocoding: we never send the device's coordinates to a third party just to get a label)
        }
        savePlaces();
        if (ui) { renderPage(me); renderCards(); }
        refreshPlace(me, moved);
      }, () => {}, { timeout: 3000, maximumAge: 600000, enableHighAccuracy: false });
    } catch (_) {}
  }

  /* ───────────────────────── public API ───────────────────────── */
  OS.weather = {
    current() {
      const p = places[0], c = p && getCache(p.id);
      if (!c || !c.data || !c.data.current) return null;
      const d = c.data, cur = d.current, isDay = !!cur.is_day;
      return { city: p.name, temp: T(cur.temperature_2m), code: cur.weather_code, condition: condition(cur.weather_code, isDay), high: T(d.daily.max[0]), low: T(d.daily.min[0]),
        unit, isDay, updated: c.t };
    },
    refresh() { return places[0] ? refreshPlace(places[0], true) : Promise.resolve(null); },
    glyph(code, isDay, size) { return glyph(kindOf(code, isDay !== false), size); },
  };
  setTimeout(() => { if (places[0]) refreshPlace(places[0]); }, 1500);      // keep the widget / Siri fed even if the app is never opened

  /* ───────────────────────── sky renderer ───────────────────────── */
  function Sky(canvas) {
    const W = 402, H = 874, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    const rnd = (a, b) => a + Math.random() * (b - a);
    let cur = null, prev = null, fadeT0 = 0, raf = 0, last = 0;
    const stars = Array.from({ length: 90 }, () => ({ x: rnd(0, W), y: Math.pow(Math.random(), 1.4) * H * 0.75, r: rnd(0.4, 1.3), p: rnd(0, 6.28), s: rnd(0.6, 2.2), a: rnd(0.35, 1) }));
    const drops = Array.from({ length: 150 }, () => ({ x: rnd(-40, W + 120), y: rnd(0, H), l: rnd(12, 24), v: rnd(850, 1300), a: rnd(0.18, 0.5) }));
    const flakes = Array.from({ length: 120 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.9, 3), v: rnd(35, 95), p: rnd(0, 6.28), a: rnd(0.4, 0.95) }));
    function sprite(rgb) {
      const c = document.createElement('canvas'); c.width = 420; c.height = 190;
      const x = c.getContext('2d');
      [[110, 120, 70], [180, 95, 85], [255, 110, 78], [320, 125, 60], [210, 135, 75], [150, 135, 62], [70, 135, 45]].forEach((b) => {
        const gr = x.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]);
        gr.addColorStop(0, 'rgba(' + rgb + ',.55)'); gr.addColorStop(0.55, 'rgba(' + rgb + ',.28)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
        x.fillStyle = gr; x.beginPath(); x.arc(b[0], b[1], b[2], 0, 6.2832); x.fill();
      });
      return c;
    }
    let sprW = null, sprG = null, sprD = null;
    function make(kind) {
      const parts = kind.split('-'), type = parts[0], night = parts[1] === 'night';
      const n = { clear: 0, partly: 3, cloudy: 7, rain: 6, snow: 5, thunder: 7, fog: 5 }[type] || 0;
      if (!sprW) { sprW = sprite('255,255,255'); sprG = sprite('176,188,202'); sprD = sprite('70,80,98'); }
      const spr = night || type === 'thunder' ? sprD : type === 'rain' ? sprG : sprW;
      const clouds = Array.from({ length: n }, (_, i) => ({
        x: rnd(-200, W), y: type === 'fog' ? rnd(120, 700) : type === 'partly' ? rnd(40, 330) : rnd(-30, 520), s: type === 'fog' ? rnd(1.5, 2.3) : rnd(0.7, 1.5),
        v: rnd(4, 11) * (i % 2 ? 1 : 0.7), a: night ? rnd(0.5, 0.85) : type === 'partly' ? rnd(0.55, 0.85) : type === 'fog' ? rnd(0.35, 0.55) : rnd(0.5, 0.9),
      }));
      return { kind, type, night, grad: GRADS[kind] || GRADS['clear-day'], clouds, spr, flash: 0, nextFlash: performance.now() + rnd(1500, 5000), second: 0 };
    }
    function draw(s, t, dt, alpha) {
      g.globalAlpha = alpha;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, s.grad[0]); gr.addColorStop(0.55, s.grad[1]); gr.addColorStop(1, s.grad[2]);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (s.night && (s.type === 'clear' || s.type === 'partly')) {
        g.fillStyle = '#fff';
        for (let i = 0; i < stars.length; i++) {
          const st = stars[i];
          g.globalAlpha = alpha * st.a * (0.55 + 0.45 * Math.sin(t / 1000 * st.s + st.p));
          g.beginPath(); g.arc(st.x, st.y, st.r, 0, 6.2832); g.fill();
        }
        g.globalAlpha = alpha;
        const mg = g.createRadialGradient(330, 120, 0, 330, 120, 260);
        mg.addColorStop(0, 'rgba(150,170,255,.16)'); mg.addColorStop(1, 'rgba(150,170,255,0)');
        g.fillStyle = mg; g.fillRect(0, 0, W, H);
      }
      if (!s.night && (s.type === 'clear' || s.type === 'partly')) {
        const pulse = 1 + 0.04 * Math.sin(t / 2400), cx = 338, cy = 118;
        const sg = g.createRadialGradient(cx, cy, 0, cx, cy, 330 * pulse);
        sg.addColorStop(0, 'rgba(255,250,220,.95)'); sg.addColorStop(0.07, 'rgba(255,244,190,.75)'); sg.addColorStop(0.22, 'rgba(255,236,170,.26)'); sg.addColorStop(0.55, 'rgba(255,240,200,.08)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = sg; g.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < s.clouds.length; i++) {
        const c = s.clouds[i];
        c.x += c.v * dt; if (c.x > W + 40) c.x = -420 * c.s - 20;
        g.globalAlpha = alpha * c.a;
        g.drawImage(s.spr, c.x, c.y, 420 * c.s, 190 * c.s);
      }
      g.globalAlpha = alpha;
      if (s.type === 'rain' || s.type === 'thunder') {
        g.strokeStyle = 'rgba(205,225,255,1)'; g.lineWidth = 1.1; g.lineCap = 'round';
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.y += d.v * dt; d.x -= d.v * dt * 0.16;
          if (d.y > H + 30) { d.y = -30; d.x = rnd(-20, W + 140); }
          g.globalAlpha = alpha * d.a;
          g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * 0.16, d.y + d.l); g.stroke();
        }
      }
      if (s.type === 'snow') {
        g.fillStyle = '#fff';
        for (let i = 0; i < flakes.length; i++) {
          const f = flakes[i];
          f.y += f.v * dt; f.x += Math.sin(t / 1100 + f.p) * 14 * dt + 6 * dt;
          if (f.y > H + 6) { f.y = -6; f.x = rnd(0, W); }
          if (f.x > W + 6) f.x = -6;
          g.globalAlpha = alpha * f.a;
          g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.2832); g.fill();
        }
      }
      if (s.type === 'thunder') {
        const n = performance.now();
        if (n > s.nextFlash) { s.flash = 1; s.second = Math.random() < 0.6 ? n + 140 : 0; s.nextFlash = n + rnd(3500, 9000); }
        if (s.second && n > s.second) { s.flash = 0.8; s.second = 0; }
        if (s.flash > 0.01) { g.globalAlpha = alpha * s.flash * 0.55; g.fillStyle = '#E8EEFF'; g.fillRect(0, 0, W, H); s.flash *= Math.pow(0.0015, dt); }
      }
      g.globalAlpha = 1;
    }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (!cur) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = prev ? clamp((t - fadeT0) / 500, 0, 1) : 1;
      if (prev && k < 1) draw(prev, t, dt, 1); else prev = null;
      draw(cur, t, dt, k);
    }
    return {
      set(kind) {
        if (cur && cur.kind === kind) return;
        prev = cur; cur = make(kind); fadeT0 = performance.now();
        if (!raf) { g.setTransform(dpr, 0, 0, dpr, 0, 0); draw(cur, fadeT0, 0, 1); }        // static frame while paused
      },
      start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
      stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    };
  }

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('weather', `
  .app-weather{--bg:#000;--bg2:#000;--cell:#1C1C1E;--cell2:#2C2C2E;--label:#fff;--label2:rgba(235,235,245,.6);--label3:rgba(235,235,245,.3);--sep:rgba(84,84,88,.65);
    --fill:rgba(120,120,128,.36);--fill2:rgba(120,120,128,.24);--tint:#fff;background:#1B66C4;color:#fff;color-scheme:dark}
  .app-weather .wx-bg{position:absolute;inset:0;width:402px;height:874px;display:block}
  .app-weather .wx-pager{position:absolute;inset:0;overflow:hidden}
  .app-weather .wx-track{position:absolute;top:0;bottom:0;left:0;display:flex;transition:transform .45s var(--ease);will-change:transform}
  .app-weather .wx-track.drag{transition:none}
  .app-weather .wx-page{position:relative;flex:none;width:402px;height:100%;overflow:hidden}
  .app-weather .wx-g{display:block;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.12))}

  .app-weather .wx-head{position:absolute;left:0;right:0;top:0;height:336px;pointer-events:none;text-align:center;text-shadow:0 1px 6px rgba(0,0,0,.18);z-index:2}
  .app-weather .wx-head-in{position:absolute;left:0;right:0;top:94px;display:flex;flex-direction:column;align-items:center;will-change:transform}
  .app-weather .wx-h-city{font-size:34px;font-weight:400;letter-spacing:.2px;line-height:40px;max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-weather .wx-h-sub{font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;line-height:16px;height:16px;opacity:.95}
  .app-weather .wx-h-temp{font-size:96px;font-weight:200;line-height:100px;letter-spacing:-3px;padding-left:26px;font-variant-numeric:tabular-nums}
  .app-weather .wx-h-cond{font-size:20px;font-weight:500;line-height:26px;letter-spacing:-.2px;opacity:.92}
  .app-weather .wx-h-hl{font-size:20px;font-weight:500;line-height:26px;letter-spacing:-.2px}
  .app-weather .wx-h-compact{position:absolute;left:0;right:0;top:40px;font-size:20px;font-weight:500;line-height:26px;opacity:0;letter-spacing:-.2px}

  .app-weather .wx-scroll{position:absolute;left:0;right:0;top:146px;bottom:0;padding:190px 16px 120px}
  .app-weather .wx-card{position:relative;border-radius:15px;background:rgba(255,255,255,.14);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);margin-bottom:10px;overflow:hidden}
  .app-weather .wx-night .wx-card,.app-weather .wx-dim .wx-card{background:rgba(255,255,255,.1)}
  .app-weather .wx-cap{display:flex;align-items:center;gap:5px;height:34px;padding:4px 15px 0;font-size:12px;font-weight:600;letter-spacing:.2px;text-transform:uppercase;color:rgba(255,255,255,.6)}
  .app-weather .wx-cap svg{width:13px;height:13px;flex:none}
  .app-weather .wx-sum{padding:12px 15px 12px;font-size:15px;line-height:20px;letter-spacing:-.2px;border-bottom:.5px solid rgba(255,255,255,.22);margin:0 0 0 0}
  .app-weather .wx-hours{display:flex;padding:6px 6px 10px}
  .app-weather .wx-h{flex:none;width:58px;display:flex;flex-direction:column;align-items:center;height:104px}
  .app-weather .wx-h.wide{width:78px}
  .app-weather .wx-h .t{font-size:15px;font-weight:600;letter-spacing:-.2px;height:22px;line-height:22px;white-space:nowrap}
  .app-weather .wx-h .t small{font-size:12px;font-weight:600}
  .app-weather .wx-h .g{height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .app-weather .wx-h .pp{font-size:11px;font-weight:700;color:${Bl};line-height:11px;margin-top:-2px}
  .app-weather .wx-h .v{font-size:20px;font-weight:500;letter-spacing:-.2px;line-height:28px;white-space:nowrap}
  .app-weather .wx-h.wide .v{font-size:17px}

  .app-weather .wx-day{display:flex;align-items:center;height:54px;margin:0 15px;border-top:.5px solid rgba(255,255,255,.22);font-size:20px;font-weight:500;letter-spacing:-.2px}
  .app-weather .wx-day .d{width:70px;flex:none}
  .app-weather .wx-day .i{width:44px;flex:none;display:flex;flex-direction:column;align-items:center}
  .app-weather .wx-day .i .pp{font-size:11px;font-weight:700;color:${Bl};line-height:11px;margin-top:-1px}
  .app-weather .wx-day .lo{width:50px;flex:none;text-align:right;color:rgba(255,255,255,.55);padding-right:9px}
  .app-weather .wx-day .hi{width:46px;flex:none;text-align:right}
  .app-weather .wx-bar{position:relative;flex:1;height:5px;border-radius:3px;background:rgba(0,0,0,.18)}
  .app-weather .wx-bar i{position:absolute;top:0;bottom:0;border-radius:3px}
  .app-weather .wx-bar b{position:absolute;top:-1.5px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.3)}

  .app-weather .wx-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
  .app-weather .wx-tile{height:180px;margin:0;display:flex;flex-direction:column}
  .app-weather .wx-tile .big{padding:2px 15px 0;font-size:32px;font-weight:400;letter-spacing:-.4px;line-height:38px}
  .app-weather .wx-tile .big small{font-size:20px;font-weight:500;margin-left:3px}
  .app-weather .wx-tile .word{padding:0 15px;font-size:20px;font-weight:600;letter-spacing:-.2px;line-height:24px}
  .app-weather .wx-tile .foot{margin-top:auto;padding:0 15px 13px;font-size:14px;line-height:18px;letter-spacing:-.15px}
  .app-weather .wx-uvbar{position:relative;height:5px;border-radius:3px;margin:12px 15px 0;background:linear-gradient(90deg,#3DDC6B,#E8E04A 30%,#FF9F0A 55%,#FF453A 75%,#BF5AF2)}
  .app-weather .wx-uvbar b{position:absolute;top:-1.5px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35)}
  .app-weather .wx-tile svg.fig{display:block;margin:0 auto}
  .app-weather .wx-foot{padding:14px 10px 0;text-align:center;font-size:13px;line-height:18px;color:rgba(255,255,255,.62)}
  .app-weather .wx-foot b{display:block;color:#fff;font-weight:600;font-size:15px;margin-bottom:2px}
  .app-weather .wx-foot a{color:rgba(255,255,255,.85);text-decoration:underline;cursor:pointer}
  .app-weather .wx-off{padding:26px 22px 24px;text-align:center}
  .app-weather .wx-off h3{margin:10px 0 6px;font-size:20px;font-weight:600;letter-spacing:-.3px}
  .app-weather .wx-off p{margin:0 0 18px;font-size:15px;line-height:20px;color:rgba(255,255,255,.8)}
  .app-weather .wx-off button{height:40px;padding:0 24px;border-radius:20px;background:rgba(255,255,255,.24);color:#fff;font-size:16px;font-weight:600}
  .app-weather .wx-off button:active{opacity:.6}
  .app-weather .wx-spin{width:26px;height:26px;margin:0 auto;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:wx-spin .8s linear infinite}
  @keyframes wx-spin{to{transform:rotate(360deg)}}
  .app-weather .wx-stale{display:inline-block;margin-bottom:10px;padding:5px 12px;border-radius:12px;background:rgba(0,0,0,.22);font-size:12px;font-weight:600;color:rgba(255,255,255,.85)}

  .app-weather .wx-bottom{position:absolute;left:0;right:0;bottom:0;height:84px;padding:0 18px 34px;display:flex;align-items:center;justify-content:space-between;z-index:5;
    background:rgba(40,60,90,.28);backdrop-filter:blur(26px) saturate(1.4);-webkit-backdrop-filter:blur(26px) saturate(1.4);box-shadow:0 -.5px 0 rgba(255,255,255,.25)}
  .app-weather .wx-bottom button{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:#fff}
  .app-weather .wx-bottom button:active{opacity:.5}
  .app-weather .wx-bottom button svg{width:26px;height:26px}
  .app-weather .wx-dots{display:flex;align-items:center;gap:8px;max-width:240px;overflow:hidden}
  .app-weather .wx-dots span{display:block;width:8px;height:8px;border-radius:50%;background:#fff;opacity:.4;cursor:pointer;flex:none;transition:opacity .2s}
  .app-weather .wx-dots span.loc{width:11px;height:11px;background:none;display:flex}
  .app-weather .wx-dots span.loc svg{width:11px;height:11px}
  .app-weather .wx-dots span.on{opacity:1}

  /* list screen */
  .app-weather .wx-list{position:absolute;inset:0;z-index:10;background:#000;opacity:0;transform:scale(1.04);pointer-events:none;transition:opacity .3s, transform .4s var(--ease)}
  .app-weather .wx-list.in{opacity:1;transform:none;pointer-events:auto}
  .app-weather .wx-l-scroll{position:absolute;inset:0;padding:calc(var(--safe-top) + 4px) 16px calc(60px + var(--kb-h))}
  .app-weather .wx-l-top{display:flex;justify-content:flex-end;height:40px;align-items:center}
  .app-weather .wx-l-more{width:30px;height:30px;border-radius:50%;background:rgba(120,120,128,.3);display:flex;align-items:center;justify-content:center;color:#fff}
  .app-weather .wx-l-more:active{opacity:.5}
  .app-weather .wx-l-more svg{width:20px;height:20px}
  .app-weather .wx-l-title{font-size:34px;font-weight:700;letter-spacing:.35px;margin:0 0 8px}
  .app-weather .wx-l-search{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .app-weather .wx-l-search .ios-search{flex:1}
  .app-weather .wx-l-cancel{display:none;font-size:17px;color:#fff}
  .app-weather .wx-l-search.on .wx-l-cancel{display:block}
  .app-weather .wx-crow{position:relative;margin-bottom:10px;border-radius:22px;overflow:hidden}
  .app-weather .wx-cdel{position:absolute;right:6px;top:50%;margin-top:-28px;width:56px;height:56px;border-radius:50%;background:#FF453A;color:#fff;display:flex;align-items:center;justify-content:center}
  .app-weather .wx-cdel svg{width:26px;height:26px}
  .app-weather .wx-ccard{position:relative;height:116px;border-radius:22px;padding:10px 16px 12px;display:flex;justify-content:space-between;cursor:pointer;transition:transform .3s var(--ease);overflow:hidden}
  .app-weather .wx-ccard:active{filter:brightness(.9)}
  .app-weather .wx-crow.open .wx-ccard{transform:translateX(-74px)}
  .app-weather .wx-ccard .l,.app-weather .wx-ccard .r{display:flex;flex-direction:column;justify-content:space-between;min-width:0}
  .app-weather .wx-ccard .r{align-items:flex-end;flex:none;padding-left:10px}
  .app-weather .wx-ccard .n{font-size:25px;font-weight:700;letter-spacing:-.2px;line-height:30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-weather .wx-ccard .s{font-size:15px;font-weight:600;letter-spacing:-.2px;opacity:.95;line-height:18px}
  .app-weather .wx-ccard .c{font-size:15px;font-weight:500;letter-spacing:-.2px;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .app-weather .wx-ccard .tp{font-size:53px;font-weight:300;line-height:54px;letter-spacing:-1.5px;font-variant-numeric:tabular-nums}
  .app-weather .wx-ccard .hl{font-size:15px;font-weight:500;letter-spacing:-.2px;white-space:nowrap}
  .app-weather .wx-res{border-radius:12px;overflow:hidden}
  .app-weather .wx-res-row{padding:12px 4px;font-size:17px;border-bottom:.5px solid var(--sep);cursor:pointer;color:rgba(235,235,245,.6)}
  .app-weather .wx-res-row b{color:#fff;font-weight:600}
  .app-weather .wx-res-row:active{background:rgba(120,120,128,.2)}
  .app-weather .wx-res-msg{padding:60px 20px;text-align:center;color:rgba(235,235,245,.6);font-size:17px}
  .app-weather .wx-res-msg b{display:block;color:#fff;font-size:22px;font-weight:700;margin-bottom:4px}
  .app-weather .wx-l-foot{padding:18px 10px;text-align:center;font-size:13px;color:rgba(235,235,245,.5)}
  `);

  /* ───────────────────────── page rendering ───────────────────────── */
  const TSTOPS = [[0, [94, 124, 255]], [32, [100, 200, 250]], [50, [104, 214, 178]], [65, [246, 214, 78]], [80, [255, 159, 10]], [96, [255, 78, 60]]];
  function tColor(f) {
    if (f <= TSTOPS[0][0]) return 'rgb(' + TSTOPS[0][1].join(',') + ')';
    for (let i = 1; i < TSTOPS.length; i++) {
      if (f <= TSTOPS[i][0]) { const a = TSTOPS[i - 1], b = TSTOPS[i], k = (f - a[0]) / (b[0] - a[0]); return 'rgb(' + a[1].map((v, j) => Math.round(v + (b[1][j] - v) * k)).join(',') + ')'; }
    }
    return 'rgb(' + TSTOPS[TSTOPS.length - 1][1].join(',') + ')';
  }
  function hourIndex(d) {
    const n = nowP(d), t = d.hourly.time;
    for (let i = t.length - 1; i >= 0; i--) if (pms(t[i]) <= n) return i;
    return 0;
  }
  function dayIndex(d) {
    const key = new Date(nowP(d)).toISOString().slice(0, 10), i = d.daily.time.indexOf(key);
    return i < 0 ? 0 : i;
  }
  function summaryText(d, hi) {
    const cur = d.current, c0 = kindOf(cur.weather_code, !!cur.is_day), h = d.hourly;
    const grp = (k) => (k === 'sun' || k === 'moon' ? 'clear' : k === 'cloudSun' || k === 'cloudMoon' ? 'partly' : k);
    let txt = '';
    for (let i = hi + 1; i < Math.min(h.time.length, hi + 13); i++) {
      if (grp(kindOf(h.code[i], !!h.isDay[i])) !== grp(c0)) { txt = condition(h.code[i], !!h.isDay[i]) + ' conditions expected around ' + fmtHour(pms(h.time[i])) + '.'; break; }
    }
    if (!txt) txt = condition(cur.weather_code, !!cur.is_day) + ' conditions will continue for the rest of the day.';
    return txt + ' Wind is ' + windU(cur.wind_speed_10m) + ' ' + windL() + ' from the ' + COMPASS[Math.round((cur.wind_direction_10m || 0) / 22.5) % 16] + '.';
  }
  function hoursHTML(d, hi) {
    const h = d.hourly, n = nowP(d), items = [];
    const events = [];
    d.daily.sunrise.slice(0, 4).forEach((s) => { if (s) events.push({ at: pms(s), kind: 'sunrise', label: 'Sunrise' }); });
    d.daily.sunset.slice(0, 4).forEach((s) => { if (s) events.push({ at: pms(s), kind: 'sunset', label: 'Sunset' }); });
    const end = Math.min(h.time.length, hi + 25);
    for (let i = hi; i < end; i++) {
      const t0 = pms(h.time[i]), isNow = i === hi, code = isNow ? d.current.weather_code : h.code[i], day = isNow ? !!d.current.is_day : !!h.isDay[i];
      const pop = h.pop[i] || 0, showPop = isWet(code) && pop >= 20;
      items.push(`<div class="wx-h"><span class="t">${isNow ? 'Now' : hourLabel(t0)}</span><span class="g">${glyph(kindOf(code, day), 30)}${showPop ? `<span class="pp">${Math.round(pop / 10) * 10}%</span>` : ''}</span><span class="v">${deg(isNow ? d.current.temperature_2m : h.temp[i])}</span></div>`);
      events.forEach((ev) => {
        if (ev.at > Math.max(t0, n) && ev.at <= t0 + 3600000 && i < end - 1) items.push(`<div class="wx-h wide"><span class="t">${clockLabel(ev.at)}</span><span class="g">${glyph(ev.kind, 30)}</span><span class="v">${ev.label}</span></div>`);
      });
    }
    return items.join('');
  }
  function hourLabel(ms) { const s = fmtHour(ms); return use24() ? s : s.replace(/(AM|PM)$/, '<small>$1</small>'); }
  function clockLabel(ms) { const s = fmtClock(ms, false); return use24() ? s : s.replace(/(AM|PM)$/, '<small>$1</small>'); }
  function daysHTML(d, di) {
    const dl = d.daily, n = dl.time.length;
    let gMin = Infinity, gMax = -Infinity;
    for (let i = di; i < n; i++) { if (dl.min[i] != null) gMin = Math.min(gMin, dl.min[i]); if (dl.max[i] != null) gMax = Math.max(gMax, dl.max[i]); }
    if (d.current && di === dayIndex(d)) { gMin = Math.min(gMin, d.current.temperature_2m); gMax = Math.max(gMax, d.current.temperature_2m); }
    const span = Math.max(1, gMax - gMin);
    let html = '';
    for (let i = di; i < n; i++) {
      const lo = dl.min[i], hi = dl.max[i], l = ((lo - gMin) / span) * 100, r = ((gMax - hi) / span) * 100;
      const wd = i === di ? 'Today' : DAYN[new Date(pms(dl.time[i] + 'T12:00')).getUTCDay()];
      const pop = dl.pop[i] || 0, showPop = isWet(dl.code[i]) && pop >= 20;
      const dot = i === di ? `<b style="left:${clamp(((d.current.temperature_2m - gMin) / span) * 100, 1, 99).toFixed(1)}%"></b>` : '';
      html += `<div class="wx-day"><span class="d">${wd}</span><span class="i">${glyph(kindOf(dl.code[i], true), 28)}${showPop ? `<span class="pp">${Math.round(pop / 10) * 10}%</span>` : ''}</span>
        <span class="lo">${deg(lo)}</span><span class="wx-bar"><i style="left:${l.toFixed(1)}%;right:${r.toFixed(1)}%;background:linear-gradient(90deg,${tColor(lo)},${tColor(hi)})"></i>${dot}</span><span class="hi">${deg(hi)}</span></div>`;
    }
    return { html, count: n - di };
  }
  function sunFig(d, di) {
    const dl = d.daily, sr = pms(dl.sunrise[di]), ss = pms(dl.sunset[di]), n = nowP(d);
    const day0 = pms(dl.time[di] + 'T00:00'), noon = (sr + ss) / 2, Wd = 150, Hh = 62, cy = 36, A = 24, DAY = 864e5;
    const yAt = (t) => cy - A * Math.cos((2 * Math.PI * (t - noon)) / DAY);
    const xAt = (t) => ((t - day0) / DAY) * Wd;
    const hy = yAt(sr);
    let full = '', up = '';
    for (let i = 0; i <= 48; i++) { const t = day0 + (i / 48) * DAY; full += (i ? 'L' : 'M') + xAt(t).toFixed(1) + ' ' + yAt(t).toFixed(1); }
    for (let i = 0; i <= 24; i++) { const t = sr + (i / 24) * (ss - sr); up += (i ? 'L' : 'M') + xAt(t).toFixed(1) + ' ' + yAt(t).toFixed(1); }
    const tn = clamp(n, day0, day0 + DAY), above = n >= sr && n <= ss;
    return `<svg class="fig" viewBox="0 0 ${Wd} ${Hh}" width="${Wd}" height="${Hh}"><path d="${full}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="${up}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.4" stroke-linecap="round"/><path d="M0 ${hy.toFixed(1)}H${Wd}" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
      <circle cx="${xAt(tn).toFixed(1)}" cy="${yAt(tn).toFixed(1)}" r="7" fill="rgba(255,255,255,${above ? '.28' : '.12'})"/><circle cx="${xAt(tn).toFixed(1)}" cy="${yAt(tn).toFixed(1)}" r="4" fill="${above ? '#fff' : 'rgba(255,255,255,.55)'}"/></svg>`;
  }
  function windFig(cur) {
    const c = 59, dir = (cur.wind_direction_10m || 0) + 180;
    let ticks = '';
    for (let i = 0; i < 72; i++) {
      const a = (i * 5 * Math.PI) / 180, big = i % 18 === 0, mid = i % 6 === 0, r1 = 55, r0 = big ? 47 : mid ? 49 : 50.5;
      if (big) continue;
      ticks += `<path d="M${(c + Math.sin(a) * r0).toFixed(1)} ${(c - Math.cos(a) * r0).toFixed(1)}L${(c + Math.sin(a) * r1).toFixed(1)} ${(c - Math.cos(a) * r1).toFixed(1)}" stroke="rgba(255,255,255,${mid ? '.6' : '.28'})" stroke-width="1"/>`;
    }
    const L = (t, x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" font-weight="700" fill="rgba(255,255,255,.8)">${t}</text>`;
    return `<svg class="fig" viewBox="0 0 118 118" width="124" height="124">${ticks}${L('N', c, 15)}${L('E', 108, 63)}${L('S', c, 111)}${L('W', 10, 63)}
      <g transform="rotate(${dir.toFixed(0)} ${c} ${c})"><path d="M${c} 100V19" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M${c} 12l-6.5 11h13z" fill="#fff"/><circle cx="${c}" cy="101" r="3.6" fill="none" stroke="#fff" stroke-width="2.4"/></g>
      <circle cx="${c}" cy="${c}" r="24" fill="rgba(40,55,80,.55)"/><circle cx="${c}" cy="${c}" r="24" fill="rgba(0,0,0,.18)"/>
      <text x="${c}" y="${c + 3}" text-anchor="middle" font-size="20" font-weight="700" fill="#fff">${windU(cur.wind_speed_10m)}</text><text x="${c}" y="${c + 15}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#fff">${windL()}</text></svg>`;
  }
  function pressureFig(hpa) {
    const c = 59, k = clamp((hpa - 960) / 90, 0, 1), ang = -135 + k * 270;
    let ticks = '';
    for (let i = 0; i <= 44; i++) {
      const deg0 = -135 + (i / 44) * 270, a = (deg0 * Math.PI) / 180, near = Math.abs(deg0 - ang) < 22;
      ticks += `<path d="M${(c + Math.sin(a) * 45).toFixed(1)} ${(c - Math.cos(a) * 45).toFixed(1)}L${(c + Math.sin(a) * 54).toFixed(1)} ${(c - Math.cos(a) * 54).toFixed(1)}" stroke="rgba(255,255,255,${near ? (0.9 - Math.abs(deg0 - ang) / 40).toFixed(2) : '.3'})" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    const val = unit === 'C' ? Math.round(hpa).toLocaleString('en-US') : (hpa * 0.02953).toFixed(2), u = unit === 'C' ? 'hPa' : 'inHg';
    return `<svg class="fig" viewBox="0 0 118 118" width="124" height="124">${ticks}
      <g transform="rotate(${ang.toFixed(1)} ${c} ${c})"><path d="M${c} 3.5v15" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
      <path d="M${c - 6} 47h12M${c - 6} 52h12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <text x="${c}" y="74" text-anchor="middle" font-size="${unit === 'C' ? 19 : 20}" font-weight="700" fill="#fff">${val}</text><text x="${c}" y="88" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${u}</text>
      <text x="25" y="112" text-anchor="middle" font-size="11" font-weight="600" fill="rgba(255,255,255,.8)">Low</text><text x="93" y="112" text-anchor="middle" font-size="11" font-weight="600" fill="rgba(255,255,255,.8)">High</text></svg>`;
  }
  function tilesHTML(d, hi, di) {
    const cur = d.current, dl = d.daily, n = nowP(d);
    const cap = (icon, t) => `<div class="wx-cap">${CAP[icon]}<span>${t}</span></div>`;
    // UV
    const sr = pms(dl.sunrise[di]), ss = pms(dl.sunset[di]), uvMax = dl.uv[di] || 0;
    const uvAt = (t) => (t <= sr || t >= ss ? 0 : uvMax * Math.pow(Math.sin((Math.PI * (t - sr)) / (ss - sr)), 1.3));
    const uv = Math.round(uvAt(n)), uvWord = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';
    let uvFoot = 'Low for the rest of the day.';
    if (uvAt(n) >= 3) { let t = n; while (t < ss && uvAt(t) >= 3) t += 1800000; uvFoot = 'Use sun protection until ' + fmtHour(t) + '.'; }
    else if (n < sr || (n < (sr + ss) / 2 && uvMax >= 3)) { let t = Math.max(n, sr); while (t < ss && uvAt(t) < 3) t += 1800000; if (t < ss) uvFoot = 'Use sun protection ' + fmtHour(t) + ' – ' + fmtHour(ss - (t - sr)) + '.'; }
    // sun
    const nextIsSet = n >= sr && n < ss;
    const sunBig = nextIsSet ? fmtClock(ss, false) : fmtClock(n >= ss && dl.sunrise[di + 1] ? pms(dl.sunrise[di + 1]) : sr, false);
    const sunFoot = nextIsSet ? 'Sunrise: ' + fmtClock(dl.sunrise[di + 1] ? pms(dl.sunrise[di + 1]) : sr, false) : 'Sunset: ' + fmtClock(n >= ss && dl.sunset[di + 1] ? pms(dl.sunset[di + 1]) : ss, false);
    // precipitation
    const pToday = dl.precip[di] || 0;
    let pFoot = 'None expected in next 10 days.';
    for (let i = di + (pToday > 0.05 ? 1 : 0); i < dl.time.length; i++) {
      if ((dl.precip[i] || 0) > 0.2) { pFoot = i === di ? precipTxt(dl.precip[i]) + ' expected today.' : 'Next expected is ' + precipTxt(dl.precip[i]) + ' on ' + DAYN[new Date(pms(dl.time[i] + 'T12:00')).getUTCDay()] + '.'; break; }
    }
    // feels like
    const diff = cur.apparent_temperature - cur.temperature_2m;
    const feelFoot = Math.abs(diff) < 2.5 ? 'Similar to the actual temperature.' : diff < 0 ? 'Wind is making it feel cooler.' : 'Humidity is making it feel warmer.';
    // humidity / dew point (Magnus)
    const tc = ((cur.temperature_2m - 32) * 5) / 9, rh = clamp(cur.relative_humidity_2m || 1, 1, 100), al = (17.27 * tc) / (237.7 + tc) + Math.log(rh / 100), dewF = ((237.7 * al) / (17.27 - al)) * 9 / 5 + 32;
    // visibility
    const visM = d.hourly.vis[hi] != null ? d.hourly.vis[hi] : 16000, visMi = visM / 1609.34;
    const visTxt = unit === 'C' ? (visM >= 10000 ? Math.round(visM / 1000) : Math.round(visM / 100) / 10) + ' km' : (visMi >= 10 ? Math.round(visMi) : Math.round(visMi * 10) / 10) + ' mi';
    const visFoot = visMi >= 10 ? 'Perfectly clear view.' : visMi >= 5 ? 'Clear view.' : visMi >= 2 ? 'Light haze is affecting visibility.' : 'Visibility is significantly reduced.';
    return `<div class="wx-tiles">
      <div class="wx-card wx-tile">${cap('uv', 'UV Index')}<div class="big">${uv}</div><div class="word">${uvWord}</div><div class="wx-uvbar"><b style="left:${clamp((uv / 11) * 100, 2, 98).toFixed(0)}%"></b></div><div class="foot">${uvFoot}</div></div>
      <div class="wx-card wx-tile">${cap('sunset', nextIsSet ? 'Sunset' : 'Sunrise')}<div class="big">${sunBig.replace(/(AM|PM)$/, '<small>$1</small>')}</div>${sunFig(d, di)}<div class="foot">${sunFoot}</div></div>
      <div class="wx-card wx-tile">${cap('wind', 'Wind')}<div style="margin:auto">${windFig(cur)}</div></div>
      <div class="wx-card wx-tile">${cap('drop', 'Precipitation')}<div class="big">${precipTxt(pToday)}</div><div class="word">Today</div><div class="foot">${pFoot}</div></div>
      <div class="wx-card wx-tile">${cap('thermo', 'Feels Like')}<div class="big">${deg(cur.apparent_temperature)}</div><div class="foot">${feelFoot}</div></div>
      <div class="wx-card wx-tile">${cap('humid', 'Humidity')}<div class="big">${Math.round(rh)}%</div><div class="foot">The dew point is ${deg(dewF)} right now.</div></div>
      <div class="wx-card wx-tile">${cap('eye', 'Visibility')}<div class="big">${visTxt}</div><div class="foot">${visFoot}</div></div>
      <div class="wx-card wx-tile">${cap('gauge', 'Pressure')}<div style="margin:auto">${pressureFig(cur.surface_pressure || 1013)}</div></div>
    </div>`;
  }

  function pageEls(p) { return ui && ui.pages[p.id]; }
  function renderPage(p) {
    const els = pageEls(p); if (!els) return;
    const c = getCache(p.id), d = c && c.data;
    els.city.textContent = p.me ? 'My Location' : p.name;
    els.sub.textContent = p.me ? p.name : '';
    els.sub.style.display = p.me && p.name && p.name !== 'My Location' ? '' : 'none';
    if (!d) {
      els.temp.textContent = '--'; els.cond.textContent = ''; els.hl.textContent = ''; els.compact.textContent = '';
      els.page.classList.remove('wx-night');
      els.cards.innerHTML = failed[p.id] && !inflight[p.id]
        ? `<div class="wx-card wx-off">${glyph('cloud', 44).replace('class="wx-g"', 'class="wx-g" style="margin:0 auto;opacity:.9"')}<h3>Weather Unavailable</h3><p>The Weather app isn’t connected to the internet. Check your connection, then try again.</p><button data-act="retry">Retry</button></div>`
        : '<div class="wx-card wx-off"><div class="wx-spin"></div><p style="margin:14px 0 0">Loading weather…</p></div>';
      return;
    }
    const cur = d.current, isDay = !!cur.is_day, hi = hourIndex(d), di = dayIndex(d), cond = condition(cur.weather_code, isDay);
    if (!d.daily.sunrise[di] || !d.daily.sunset[di]) { delete mem[p.id]; OS.store.remove(K.cache + p.id); mem[p.id] = null; return renderPage(p); }
    els.temp.textContent = deg(cur.temperature_2m);
    els.cond.textContent = cond;
    els.hl.textContent = 'H:' + deg(d.daily.max[di]) + '  L:' + deg(d.daily.min[di]);
    els.compact.textContent = deg(cur.temperature_2m) + ' | ' + cond;
    els.page.classList.toggle('wx-night', !isDay);
    try {
      const days = daysHTML(d, di);
      const stale = failed[p.id] || Date.now() - c.t > 60 * 60000;
      els.cards.innerHTML = `${stale ? `<div style="text-align:center"><span class="wx-stale">${failed[p.id] ? 'Offline · ' : ''}Updated ${esc(U.relDate(c.t))}</span></div>` : ''}
        <div class="wx-card"><div class="wx-sum">${esc(summaryText(d, hi))}</div><div class="wx-hours ios-scroll x">${hoursHTML(d, hi)}</div></div>
        <div class="wx-card">${`<div class="wx-cap">${CAP.cal}<span>${days.count}-Day Forecast</span></div>`}${days.html}</div>
        ${tilesHTML(d, hi, di)}
        <div class="wx-foot"><b>Weather for ${esc(p.name)}</b>Updated ${esc(fmtClock(c.t + d.off * 1000, true))} · <a data-act="source">Data from Open-Meteo</a></div>`;
    } catch (e) {
      console.error('[weather] render', e);
      els.cards.innerHTML = '<div class="wx-card wx-off"><h3>Weather Unavailable</h3><p>The forecast couldn’t be displayed.</p><button data-act="retry">Retry</button></div>';
    }
  }
  const R = 190;       // header collapse distance
  function applyHeader(els) {
    const st = els.scroll.scrollTop, p = clamp(st / R, 0, 1);
    els.headIn.style.transform = 'translateY(' + (-24 * p).toFixed(1) + 'px)';
    const o1 = clamp(1 - p / 0.35, 0, 1), o2 = clamp(1 - (p - 0.15) / 0.4, 0, 1), o3 = clamp((p - 0.6) / 0.3, 0, 1);
    els.cond.style.opacity = o1; els.hl.style.opacity = o1; els.sub.style.opacity = o1;
    els.temp.style.opacity = o2; els.compact.style.opacity = o3;
  }
  function buildPages() {
    ui.track.innerHTML = ''; ui.pages = {};
    places.forEach((p) => {
      const page = U.el(`<div class="wx-page"><div class="wx-head"><div class="wx-head-in"><div class="wx-h-city"></div><div class="wx-h-sub"></div><div class="wx-h-temp"></div><div class="wx-h-cond"></div><div class="wx-h-hl"></div><div class="wx-h-compact"></div></div></div>
        <div class="wx-scroll ios-scroll"><div class="wx-cards"></div></div></div>`);
      const q = (s) => page.querySelector(s);
      const els = { page, scroll: q('.wx-scroll'), cards: q('.wx-cards'), headIn: q('.wx-head-in'), city: q('.wx-h-city'), sub: q('.wx-h-sub'), temp: q('.wx-h-temp'), cond: q('.wx-h-cond'), hl: q('.wx-h-hl'), compact: q('.wx-h-compact') };
      els.scroll.addEventListener('scroll', () => applyHeader(els), { passive: true });
      els.cards.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'retry') { failed[p.id] = false; renderPage(p); refreshPlace(p, true); }
        if (a.dataset.act === 'source') { try { OS.openURL('https://open-meteo.com/'); } catch (_) {} }
      });
      ui.pages[p.id] = els;
      ui.track.appendChild(page);
      renderPage(p);
    });
    ui.track.style.width = places.length * 402 + 'px';
    pageIdx = clamp(pageIdx, 0, places.length - 1);
    goPage(pageIdx, false);
  }
  function renderDots() {
    ui.dots.innerHTML = places.map((p, i) => `<span class="${p.me ? 'loc ' : ''}${i === pageIdx ? 'on' : ''}" data-i="${i}">${p.me ? CAP.arrow : ''}</span>`).join('');
  }
  function sceneFor(p) {
    const c = p && getCache(p.id);
    if (!c || !c.data || !c.data.current) { const h = new Date().getHours(); return h >= 7 && h < 19 ? 'clear-day' : 'clear-night'; }
    return sceneOf(c.data.current.weather_code, !!c.data.current.is_day);
  }
  function syncScene() {
    if (!ui) return;
    const kind = sceneFor(places[pageIdx]);
    ui.sky.set(kind);
    const g = GRADS[kind] || GRADS['clear-day'];
    ui.root.style.background = g[1];
  }
  function goPage(i, animated) {
    pageIdx = clamp(i, 0, places.length - 1);
    OS.store.set(K.page, pageIdx);
    ui.track.classList.toggle('drag', animated === false);
    ui.track.style.transform = 'translateX(' + -pageIdx * 402 + 'px)';
    if (animated === false) { void ui.track.offsetWidth; ui.track.classList.remove('drag'); }
    renderDots(); syncScene();
  }

  /* ───────────────────────── list screen ───────────────────────── */
  function renderCards() {
    if (!ui) return;
    const box = ui.cards;
    box.innerHTML = places.map((p, i) => {
      const c = getCache(p.id), d = c && c.data, cur = d && d.current;
      const kind = d ? sceneOf(cur.weather_code, !!cur.is_day) : 'cloudy-night', di = d ? dayIndex(d) : 0;
      return `<div class="wx-crow" data-i="${i}">${p.me ? '' : `<button class="wx-cdel" aria-label="Delete">${CAP.trash}</button>`}
        <div class="wx-ccard" style="background:${sceneCSS(kind)}"><div class="l"><div><div class="n">${esc(p.me ? 'My Location' : p.name)}</div><div class="s">${p.me ? esc(p.name) : d ? fmtClock(nowP(d), true) : ''}</div></div>
        <div class="c">${d ? esc(condition(cur.weather_code, !!cur.is_day)) : failed[p.id] ? 'Weather unavailable' : 'Loading…'}</div></div>
        <div class="r"><div class="tp">${d ? deg(cur.temperature_2m) : '--'}</div><div class="hl">${d ? 'H:' + deg(d.daily.max[di]) + '  L:' + deg(d.daily.min[di]) : ''}</div></div></div></div>`;
    }).join('');
    box.querySelectorAll('.wx-crow').forEach((row) => {
      const i = Number(row.dataset.i), p = places[i], card = row.querySelector('.wx-ccard'), del = row.querySelector('.wx-cdel');
      card.addEventListener('click', () => {
        if (row.classList.contains('open')) { row.classList.remove('open'); return; }
        const open = box.querySelector('.wx-crow.open'); if (open) { open.classList.remove('open'); return; }
        haptic('light'); goPage(i, false); showList(false);
      });
      if (!del) return;
      let base = 0;
      U.drag(card, {
        axis: 'x',
        onStart() { base = row.classList.contains('open') ? -74 : 0; card.style.transition = 'none'; box.querySelectorAll('.wx-crow.open').forEach((r) => { if (r !== row) r.classList.remove('open'); }); },
        onMove(pt) { let x = Math.min(0, base + pt.dx); if (x < -74) x = -74 + (x + 74) * 0.35; card.style.transform = 'translateX(' + x + 'px)'; },
        onEnd(pt) { card.style.transition = ''; card.style.transform = ''; row.classList.toggle('open', base + pt.dx < -37 || pt.vx < -0.5); },
      });
      del.addEventListener('click', (e) => {
        e.stopPropagation(); haptic('medium');
        row.style.height = row.offsetHeight + 'px'; void row.offsetHeight;
        row.style.transition = 'height .26s var(--ease), opacity .2s, margin .26s'; row.style.height = '0px'; row.style.opacity = '0'; row.style.marginBottom = '0';
        setTimeout(() => {
          const at = places.indexOf(p); if (at < 0) return;
          places.splice(at, 1); savePlaces();
          OS.store.remove(K.cache + p.id); delete mem[p.id];
          if (pageIdx >= at && pageIdx > 0) pageIdx--;
          buildPages(); renderCards();
        }, 270);
      });
    });
  }
  function showList(on) {
    if (!ui) return;
    ui.list.classList.toggle('in', on);
    ui.listOpen = on;
    if (on) { renderCards(); ui.sky.stop(); } else { ui.search.value = ''; ui.search.blur(); setSearchMode(false); if (active) ui.sky.start(); }
  }
  function setSearchMode(on) {
    ui.searchWrap.classList.toggle('on', on);
    ui.cards.style.display = on ? 'none' : '';
    ui.results.style.display = on ? '' : 'none';
    ui.listFoot.style.display = on ? 'none' : '';
    if (!on) ui.results.innerHTML = '';
  }
  let searchTimer = 0, searchSeq = 0;
  function onSearchInput() {
    const q = ui.search.value.trim();
    clearTimeout(searchTimer);
    if (!q) { setSearchMode(document.activeElement === ui.search); ui.results.innerHTML = ''; return; }
    setSearchMode(true);
    if (q.length < 2) { ui.results.innerHTML = ''; return; }
    const seq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      let list = null;
      try { const j = await getJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=en&format=json', 9000); list = (j && j.results) || []; } catch (_) {}
      if (!ui || seq !== searchSeq) return;
      if (!list) { ui.results.innerHTML = '<div class="wx-res-msg"><b>Search Unavailable</b>Check your internet connection and try again.</div>'; return; }
      if (!list.length) { ui.results.innerHTML = `<div class="wx-res-msg"><b>No Results</b>No results found for “${esc(q)}”.</div>`; return; }
      ui.results.innerHTML = list.map((r, i) => `<div class="wx-res-row" data-i="${i}"><b>${esc(r.name)}</b>${[r.admin1, r.country].filter(Boolean).map((s) => ', ' + esc(s)).join('')}</div>`).join('');
      ui.results.querySelectorAll('.wx-res-row').forEach((row) => row.addEventListener('click', () => {
        const r = list[Number(row.dataset.i)];
        let p = places.find((x) => !x.me && Math.abs(x.lat - r.latitude) < 0.02 && Math.abs(x.lon - r.longitude) < 0.02);
        if (!p) {
          if (places.length >= 20) { OS.ui.toast('City list is full'); return; }
          p = { id: U.uid(), name: r.name, admin: r.admin1 || '', country: r.country || '', lat: Math.round(r.latitude * 10000) / 10000, lon: Math.round(r.longitude * 10000) / 10000 };
          places.push(p); savePlaces(); buildPages();
        }
        haptic('success');
        goPage(places.indexOf(p), false); showList(false); refreshPlace(p);
      }));
    }, 350);
  }
  function openUnitMenu(anchor) {
    const setU = (u) => {
      if (unit === u) return;
      unit = u; OS.store.set(K.unit, u);
      places.forEach(renderPage); renderCards();
      try { OS.emit('weather:update', { unit: u }); } catch (_) {}
    };
    try {
      OS.ui.contextMenu(anchor, [
        { label: 'Celsius (°C)', icon: unit === 'C' ? CAP.check : undefined, onTap() { setU('C'); } },
        { label: 'Fahrenheit (°F)', icon: unit === 'F' ? CAP.check : undefined, onTap() { setU('F'); } },
        { label: 'Refresh All', onTap() { refreshAll(true); OS.ui.toast('Updating…'); } },
      ]);
    } catch (_) { setU(unit === 'F' ? 'C' : 'F'); }
  }

  /* ───────────────────────── launch ───────────────────────── */
  function build(ctx) {
    const root = ctx.root;
    root.innerHTML = `<canvas class="wx-bg"></canvas>
      <div class="wx-pager"><div class="wx-track"></div></div>
      <div class="wx-bottom"><button data-b="map" aria-label="Map">${CAP.map}</button><div class="wx-dots"></div><button data-b="list" aria-label="Locations">${CAP.list}</button></div>
      <div class="wx-list"><div class="wx-l-scroll ios-scroll">
        <div class="wx-l-top"><button class="wx-l-more" aria-label="More">${CAP.dots}</button></div>
        <div class="wx-l-title">Weather</div>
        <div class="wx-l-search"><div class="ios-search"><input type="text" placeholder="Search for a city or airport" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></div><button class="wx-l-cancel">Cancel</button></div>
        <div class="wx-l-cards"></div><div class="wx-res" style="display:none"></div>
        <div class="wx-l-foot">Weather data by Open-Meteo.com</div>
      </div></div>`;
    const $ = (s) => root.querySelector(s);
    ui = { root, sky: Sky($('.wx-bg')), pager: $('.wx-pager'), track: $('.wx-track'), dots: $('.wx-dots'), list: $('.wx-list'), cards: $('.wx-l-cards'), results: $('.wx-res'),
      search: $('.wx-l-search input'), searchWrap: $('.wx-l-search'), listFoot: $('.wx-l-foot'), pages: {}, listOpen: false };
    buildPages();
    // horizontal paging
    let baseX = 0;
    U.drag(ui.pager, {
      axis: 'x',
      filter(e) { return !(e.target.closest && e.target.closest('.wx-hours')); },
      onStart(p, e) { if (e && e.target && e.target.closest && e.target.closest('.wx-hours')) return false; baseX = -pageIdx * 402; ui.track.classList.add('drag'); },
      onMove(p) {
        let x = baseX + p.dx; const min = -(places.length - 1) * 402;
        if (x > 0) x *= 0.3; else if (x < min) x = min + (x - min) * 0.3;
        ui.track.style.transform = 'translateX(' + x + 'px)';
      },
      onEnd(p) {
        ui.track.classList.remove('drag');
        let i = pageIdx;
        if (p.dx < -110 || p.vx < -0.45) i++; else if (p.dx > 110 || p.vx > 0.45) i--;
        if (i !== pageIdx && i >= 0 && i < places.length) haptic('light');
        goPage(i, true);
      },
    });
    ui.dots.addEventListener('click', (e) => { const s = e.target.closest('span[data-i]'); if (s) goPage(Number(s.dataset.i), true); });
    $('[data-b="list"]').addEventListener('click', () => { haptic('light'); showList(true); });
    $('[data-b="map"]').addEventListener('click', () => {
      const p = places[pageIdx];
      try {
        if (OS.isInstalled && OS.isInstalled('maps')) OS.openApp('maps', p ? { query: p.name, lat: p.lat, lon: p.lon, name: p.name } : undefined);
        else OS.openURL('https://www.openstreetmap.org/#map=9/' + (p ? p.lat + '/' + p.lon : '37.323/-122.032'));
      } catch (_) {}
    });
    $('.wx-l-more').addEventListener('click', (e) => openUnitMenu(e.currentTarget));
    ui.search.addEventListener('input', onSearchInput);
    ui.search.addEventListener('focus', () => setSearchMode(true));
    ui.search.addEventListener('blur', () => { if (!ui.search.value.trim()) setSearchMode(false); });
    ui.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.search.blur(); });
    $('.wx-l-cancel').addEventListener('click', () => { ui.search.value = ''; ui.search.blur(); clearTimeout(searchTimer); searchSeq++; setSearchMode(false); });
  }

  const on24 = () => { if (ui) { places.forEach(renderPage); renderCards(); } };
  const onMinute = () => { if (ui && active && ui.listOpen && !ui.searchWrap.classList.contains('on') && !ui.cards.querySelector('.wx-crow.open')) renderCards(); };
  OS.on('setting:use24h', on24);
  OS.on('minute', onMinute);

  OS.registerApp({
    id: 'weather',
    name: 'Weather',
    icon: {
      bg: 'linear-gradient(180deg,#3F86DF 0%,#4A90E2 35%,#7EC8F5 100%)',
      glyph: `<svg viewBox="0 0 60 60"><circle cx="20.5" cy="21" r="10" fill="#FFD60A"/><circle cx="20.5" cy="21" r="13.5" fill="#FFD60A" opacity=".22"/>
        <path d="M21.500 46a9 9 0 0 1-1.300-17.900 12 12 0 0 1 23-2.400A10.200 10.200 0 0 1 42 46z" fill="#fff"/></svg>`,
    },
    system: true,
    statusBar: 'light',
    background: '#1B66C4',
    launch(ctx) { build(ctx); },
    onResume(ctx, params) {
      active = true;
      try { ctx.setStatusBar('light'); } catch (_) {}
      if (!ui) return;
      places.forEach(renderPage);              // keep "Now", sun position, etc. current
      if (params && params.list) showList(true);
      if (ui.listOpen) renderCards(); else ui.sky.start();
      syncScene();
      locate();
      refreshAll(false);
    },
    onPause() { active = false; if (ui) { ui.sky.stop(); ui.search.blur(); } clearTimeout(searchTimer); },
    onClose() { active = false; clearTimeout(searchTimer); searchSeq++; if (ui) ui.sky.stop(); ui = null; },
  });
})();
