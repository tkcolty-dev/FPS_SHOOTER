/* Maps — Leaflet + OpenStreetMap, iOS Maps look. One allowed external library (Leaflet, loaded on first launch). */
(function () {
  'use strict';

  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ESRI_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
  const RAIL_TILES = 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png';
  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  const W = 402, H = 874, SAFE_TOP = 62;
  const SHEET_TOP = 70;                                   // sheet's top edge at the large detent
  const DET = { large: 0, medium: 400, peek: 708 };       // translateY for each detent
  const HIDDEN = H - SHEET_TOP + 30;
  const DEFAULT_LOC = { lat: 37.3349, lng: -122.00902, real: false, label: 'Cupertino' };

  /* ───────────────────────── icons ───────────────────────── */
  const svg = (inner, extra) => `<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${inner}</svg>`;
  const ARROW_D = 'M20.5 3.5 3.8 10.6c-.6.3-.5 1.1.1 1.2l6.3 1.6c.2.1.4.2.4.4l1.6 6.3c.2.6 1 .7 1.2.1z';
  const I = {
    arrow: svg(`<path d="${ARROW_D}"/>`),
    arrowFill: svg(`<path fill="currentColor" d="${ARROW_D}"/>`),
    map: svg('<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 'stroke-width="2.6"'),
    share: svg('<path d="M12 15V3.5M8 7l4-4 4 4M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17"/>'),
    phone: svg('<path fill="currentColor" stroke="none" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path fill="currentColor" d="m15.5 8.5-2 5-5 2 2-5z"/>'),
    star: svg('<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>'),
    starFill: svg('<path fill="currentColor" d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"/>'),
    house: svg('<path fill="currentColor" stroke="none" d="M12 3.2 2.8 11h2.7v8.3c0 .4.3.7.7.7h3.9v-5.6h3.8V20h3.9c.4 0 .7-.3.7-.7V11h2.7z"/>'),
    work: svg('<path fill="currentColor" stroke="none" d="M9.5 4h5A1.5 1.5 0 0 1 16 5.5V7h3.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-10A1.5 1.5 0 0 1 4.5 7H8V5.5A1.5 1.5 0 0 1 9.5 4zm.3 3h4.4V5.8H9.8z"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
    pin: svg('<path fill="currentColor" stroke="none" d="M12 2.5A6.5 6.5 0 0 0 5.5 9c0 4.6 5.3 11.2 6 12 .3.3.7.3 1 0 .7-.8 6-7.4 6-12A6.5 6.5 0 0 0 12 2.5zm0 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>'),
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>', 'stroke-width="2.4"'),
    car: svg('<path fill="currentColor" stroke="none" d="M6.3 5.5A2 2 0 0 1 8.2 4h7.6a2 2 0 0 1 1.9 1.5l1.2 4.1A2.5 2.5 0 0 1 21 12v5.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17h-11v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V12a2.5 2.5 0 0 1 2.1-2.4zM7.2 9.5h9.6l-.9-3.2a.5.5 0 0 0-.5-.3H8.6a.5.5 0 0 0-.5.3zm-.7 5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm11 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/>'),
    walk: svg('<path fill="currentColor" stroke="none" d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6a2 2 0 0 0-2.5-.8L6 8.3V13h2V9.6z"/>'),
    bike: svg('<path fill="currentColor" stroke="none" d="M15.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm5.8-10 2.4-2.4.8.8A7 7 0 0 0 19 11V9a5 5 0 0 1-3.6-1.5l-1.9-1.9a2 2 0 0 0-1.4-.6c-.6 0-1 .2-1.4.6L7.9 8.4a2 2 0 0 0 0 2.8L11 14v5h2v-6.2zM19 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>'),
    turn: svg('<path d="M7 20v-7a4 4 0 0 1 4-4h8M15 5l4 4-4 4"/>', 'stroke-width="2.4"'),
    up: svg('<path d="M12 20V5M6 11l6-6 6 6"/>', 'stroke-width="2.6"'),
    flag: svg('<path d="M6 21V4"/><path fill="currentColor" d="M6 4h11l-2.5 4L17 12H6z"/>'),
    more: svg('<circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none"/>'),
    back: svg('<path d="m14.5 5-7 7 7 7"/>', 'stroke-width="2.6"'),
    cloudOff: svg('<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.3 4.5 4.5 0 0 0 7 18z"/><path d="M4 4l16 16"/>', 'stroke-width="1.7"'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.8"'),
  };
  const PIN_SVG = `<svg viewBox="0 0 34 46" width="34" height="46"><ellipse cx="17" cy="43.6" rx="5.5" ry="1.9" fill="rgba(0,0,0,.28)"/><rect x="15.7" y="28" width="2.6" height="15" rx="1.3" fill="#B3261E"/><circle cx="17" cy="16.5" r="14.6" fill="#FF3B30" stroke="#fff" stroke-width="1.6"/><path d="M8 11.5a10 10 0 0 1 9-5.6" stroke="rgba(255,255,255,.45)" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="17" cy="16.5" r="5" fill="#fff"/></svg>`;

  /* ───────────────────────── seed data ───────────────────────── */
  const GUIDES = [
    { title: 'Bay Area Day Trips', emoji: '🌉', color: '#FF9F0A', grad: 'linear-gradient(160deg,#FFB340,#FF6B2C)', places: [
      ['Golden Gate Bridge', 'Landmark · San Francisco', 37.8199, -122.4783], ['Alcatraz Island', 'Historic Site · San Francisco Bay', 37.8267, -122.4230],
      ['Muir Woods', 'Redwood Forest · Mill Valley', 37.8970, -122.5811], ['Exploratorium', 'Science Museum · San Francisco', 37.8009, -122.3985],
      ['California Academy of Sciences', 'Museum · Golden Gate Park', 37.7699, -122.4661], ['Santa Cruz Beach Boardwalk', 'Amusement Park · Santa Cruz', 36.9643, -122.0178],
      ['Monterey Bay Aquarium', 'Aquarium · Monterey', 36.6183, -121.9018]] },
    { title: 'National Parks', emoji: '🏞️', color: '#30B455', grad: 'linear-gradient(160deg,#5FD068,#16834A)', places: [
      ['Yosemite Valley', 'National Park · California', 37.7456, -119.5936], ['Grand Canyon — Mather Point', 'National Park · Arizona', 36.0617, -112.1077],
      ['Old Faithful', 'Yellowstone · Wyoming', 44.4605, -110.8281], ['Zion Canyon', 'National Park · Utah', 37.2982, -113.0263],
      ['Delicate Arch', 'Arches · Utah', 38.7436, -109.4993], ['Crater Lake', 'National Park · Oregon', 42.9446, -122.1090],
      ['Logan Pass', 'Glacier · Montana', 48.6966, -113.7182]] },
    { title: 'Wonders of the World', emoji: '🗿', color: '#AF52DE', grad: 'linear-gradient(160deg,#C77DFF,#5E3BD1)', places: [
      ['Eiffel Tower', 'Landmark · Paris, France', 48.8584, 2.2945], ['Colosseum', 'Ancient Arena · Rome, Italy', 41.8902, 12.4922],
      ['Great Pyramid of Giza', 'Ancient Wonder · Egypt', 29.9792, 31.1342], ['Taj Mahal', 'Mausoleum · Agra, India', 27.1751, 78.0421],
      ['Great Wall at Mutianyu', 'Landmark · Beijing, China', 40.4319, 116.5704], ['Machu Picchu', 'Inca Citadel · Peru', -13.1631, -72.5450],
      ['Statue of Liberty', 'Monument · New York', 40.6892, -74.0445], ['Sydney Opera House', 'Landmark · Sydney, Australia', -33.8568, 151.2153],
      ['Christ the Redeemer', 'Monument · Rio de Janeiro', -22.9519, -43.2105]] },
    { title: 'Epic Theme Parks', emoji: '🎢', color: '#FF2D55', grad: 'linear-gradient(160deg,#FF6482,#D6246E)', places: [
      ['Disneyland Park', 'Theme Park · Anaheim', 33.8121, -117.9190], ['Magic Kingdom', 'Theme Park · Orlando', 28.4177, -81.5812],
      ['Universal Studios Hollywood', 'Theme Park · Los Angeles', 34.1381, -118.3534], ['Cedar Point', 'Roller Coasters · Ohio', 41.4822, -82.6835],
      ['LEGOLAND California', 'Theme Park · Carlsbad', 33.1262, -117.3115], ["California's Great America", 'Theme Park · Santa Clara', 37.3979, -121.9743]] },
  ];
  const mkPlace = (name, sub, lat, lng, extra) => Object.assign({ id: 'p' + lat.toFixed(4) + ',' + lng.toFixed(4), name, sub, lat, lng, address: [sub.split(' · ').pop()] }, extra || {});
  GUIDES.forEach(g => { g.places = g.places.map(a => mkPlace(a[0], a[1], a[2], a[3])); });
  const SEED_FAVS = {
    home: mkPlace('Home', 'Cupertino, CA', 37.3189, -122.0296, { address: ['Cupertino, CA 95014', 'United States'] }),
    work: null,
    list: [mkPlace('Main Street Park', 'Park · Cupertino', 37.3236, -122.0093), mkPlace('Cupertino Library', 'Library · Cupertino', 37.3180, -122.0287)],
  };
  const SEED_RECENTS = [
    mkPlace('Apple Park Visitor Center', 'Visitor Center · Cupertino', 37.3327, -122.0053, { address: ['10600 N Tantau Ave', 'Cupertino, CA 95014', 'United States'] }),
    { q: 'ice cream' },
    mkPlace('Golden Gate Bridge', 'Landmark · San Francisco', 37.8199, -122.4783),
    mkPlace('Santa Cruz Beach Boardwalk', 'Amusement Park · Santa Cruz', 36.9643, -122.0178),
    { q: 'skate park' },
    mkPlace('Yosemite Valley', 'National Park · California', 37.7456, -119.5936),
  ];

  /* ───────────────────────── maths / formatting ───────────────────────── */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = d => d * Math.PI / 180;
  function haversine(a, b) {                                // metres
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a, b) {
    const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const compassWord = deg => COMPASS[Math.round(deg / 45) % 8];
  function estimateMinutes(metres, mode) {                  // rough: straight line × road factor ÷ typical speed
    const mi = metres / 1609.344;
    if (mode === 'walk') return mi * 1.2 / 3 * 60;
    if (mode === 'bike') return mi * 1.25 / 11 * 60;
    const road = mi * 1.3, mph = road < 3 ? 22 : road < 15 ? 32 : road < 60 ? 48 : 62;
    return road / mph * 60 + 1;
  }
  function fmtDuration(min) {
    min = Math.max(1, Math.round(min));
    if (min < 60) return min + ' min';
    if (min < 1440) { const h = Math.floor(min / 60), m = min % 60; return h + ' hr' + (m ? ' ' + m + ' min' : ''); }
    const d = Math.floor(min / 1440), h = Math.round((min % 1440) / 60);
    return d + (d === 1 ? ' day' : ' days') + (h ? ' ' + h + ' hr' : '');
  }
  const num = (n, digits) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  function fmtDistance(m, units) {
    if (units === 'km') return m < 1000 ? Math.max(1, Math.round(m / 10) * 10) + ' m' : num(m / 1000, m < 100000 ? 1 : 0) + ' km';
    const mi = m / 1609.344;
    return mi < 0.1 ? Math.max(10, Math.round(m * 3.28084 / 10) * 10) + ' ft' : num(mi, mi < 100 ? 1 : 0) + ' mi';
  }
  const fmtCoords = p => `${Math.abs(p.lat).toFixed(5)}° ${p.lat >= 0 ? 'N' : 'S'}, ${Math.abs(p.lng).toFixed(5)}° ${p.lng >= 0 ? 'E' : 'W'}`;
  const pretty = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  function tileXY(lat, lng, z) {
    const n = 2 ** z, r = rad(clamp(lat, -85, 85));
    const x = Math.floor((lng + 180) / 360 * n), y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
    return { x: ((x % n) + n) % n, y: clamp(y, 0, n - 1) };
  }
  function httpURL(u) { u = String(u || '').trim(); if (!u) return ''; return /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, ''); }
  function placeFromNominatim(r) {
    const a = r.address || {}, x = r.extratags || {};
    const name = r.name || String(r.display_name || '').split(',')[0].trim() || 'Dropped Pin';
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county || '';
    const l1 = [a.house_number, a.road].filter(Boolean).join(' ');
    const l2 = [city, [a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const lines = [l1, l2, a.country].filter(Boolean);
    const kind = pretty(!r.type || r.type === 'yes' ? r.category : r.type);
    const wiki = x.wikipedia && x.wikipedia.indexOf(':') > 0 ? `https://${x.wikipedia.split(':')[0]}.wikipedia.org/wiki/${encodeURIComponent(x.wikipedia.split(':').slice(1).join(':').replace(/ /g, '_'))}` : '';
    return {
      id: 'osm' + String(r.osm_type || 'x')[0] + (r.osm_id || r.place_id), name, kind, lat: +r.lat, lng: +r.lon,
      sub: [kind, city && city !== name ? city : (a.state && a.state !== name ? a.state : a.country !== name ? a.country : '')].filter(Boolean).join(' · '),
      address: lines.length ? lines : [r.display_name || ''],
      bbox: Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null,
      phone: x.phone || x['contact:phone'] || '', website: httpURL(x.website || x['contact:website'] || x.url), wiki,
      hours: x.opening_hours || '', osm: r.osm_type && r.osm_id ? r.osm_type + '/' + r.osm_id : '',
    };
  }

  /* ───────────────────────── Leaflet loading + scale patches ───────────────────────── */
  let leafletPromise = null;
  let mpScale = 1;                                          // device CSS scale (root width / 402), kept fresh by the running app
  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      let link = document.querySelector('link[data-mp-leaflet]');
      if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.setAttribute('data-mp-leaflet', ''); document.head.appendChild(link); }
      const s = document.createElement('script');
      s.src = LEAFLET_JS; s.async = true; s.setAttribute('data-mp-leaflet', '');
      const to = setTimeout(() => fail(new Error('timeout')), 15000);
      function fail(err) { clearTimeout(to); s.remove(); leafletPromise = null; reject(err); }
      s.onload = () => { clearTimeout(to); if (window.L && window.L.map) resolve(); else fail(new Error('Leaflet missing')); };
      s.onerror = () => fail(new Error('network'));
      document.head.appendChild(s);
    });
    return leafletPromise;
  }
  function patchLeaflet() {
    const L = window.L;
    if (L.__mpScalePatched) return;
    L.__mpScalePatched = true;
    // The phone is CSS-transform scaled: pointer → container coordinates must be divided by that scale.
    const mousePos = function (e, container) {
      if (!container) return new L.Point(e.clientX, e.clientY);
      const r = container.getBoundingClientRect();
      const sx = (r.width / container.offsetWidth) || mpScale || 1, sy = (r.height / container.offsetHeight) || mpScale || 1;
      return new L.Point((e.clientX - r.left) / sx - container.clientLeft, (e.clientY - r.top) / sy - container.clientTop);
    };
    try { L.DomEvent.getMousePosition = mousePos; } catch (_) { /* frozen namespace in some builds */ }
    L.Map.prototype.mouseEventToContainerPoint = function (e) { return mousePos(e, this._container); };
    // Dragging: 1.9.x divides the drag offset by the parent's scale itself. If a build doesn't, feed it a scaled event.
    const proto = L.Draggable && L.Draggable.prototype;
    if (proto && proto._onMove && String(proto._onMove).indexOf('_parentScale') < 0) {
      const orig = proto._onMove;
      proto._onMove = function (e) {
        const s = mpScale, sp = this._startPoint;
        if (!sp || !s || Math.abs(s - 1) < 0.001) return orig.call(this, e);
        if (e.touches && e.touches.length > 1) return orig.call(this, e);
        const f = e.touches && e.touches.length === 1 ? e.touches[0] : e;
        return orig.call(this, {
          type: e.type, target: e.target, srcElement: e.target, button: e.button, buttons: e.buttons, touches: undefined, originalEvent: e,
          clientX: sp.x + (f.clientX - sp.x) / s, clientY: sp.y + (f.clientY - sp.y) / s, cancelable: e.cancelable,
          preventDefault() { e.preventDefault(); }, stopPropagation() { e.stopPropagation(); },
        });
      };
    }
  }

  /* ───────────────────────── styles ───────────────────────── */
  OS.addStyle('maps', `
    .app-maps { --mp-card: var(--cell); --mp-ease: cubic-bezier(.32,.72,0,1); background: #EDEBE4; color: var(--label); }
    #screen[data-theme="dark"] .app-maps { --mp-card: var(--cell2); background: #1B1C1E; }
    .app-maps button { font: inherit; color: inherit; border: 0; background: none; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .app-maps .mp-map { position: absolute; inset: 0; z-index: 0; background: #EDEBE4; outline: none; font: inherit; }
    #screen[data-theme="dark"] .app-maps .mp-map { background: #1B1C1E; }
    .app-maps.mp-m-explore .leaflet-tile-pane { filter: saturate(.92) brightness(1.02); }
    .app-maps.mp-m-transit .leaflet-tile-pane { filter: saturate(.3) brightness(1.05) contrast(.94); }
    #screen[data-theme="dark"] .app-maps.mp-m-explore .leaflet-tile-pane,
    #screen[data-theme="dark"] .app-maps.mp-m-transit .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.92) contrast(.86) saturate(.5); }
    #screen[data-theme="dark"] .app-maps.mp-m-transit .leaflet-mp-rail-pane { filter: brightness(1.25) saturate(1.2); }
    .app-maps.mp-m-satellite .leaflet-tile-pane { filter: none; }

    .app-maps .mp-dim { position: absolute; inset: 0; z-index: 1; background: #000; opacity: 0; pointer-events: none; transition: opacity .4s var(--mp-ease); }
    .app-maps .mp-net { position: absolute; z-index: 2; top: calc(var(--safe-top) + 10px); left: 50%; transform: translate(-50%,-14px); opacity: 0; pointer-events: none;
      background: var(--bar); -webkit-backdrop-filter: var(--blur, saturate(180%) blur(20px)); backdrop-filter: var(--blur, saturate(180%) blur(20px));
      color: var(--label2); font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 16px; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,.15);
      transition: opacity .3s, transform .35s var(--mp-ease); display: flex; align-items: center; gap: 6px; }
    .app-maps .mp-net.on { opacity: 1; transform: translate(-50%,0); }
    .app-maps .mp-net svg { width: 16px; height: 16px; }

    .app-maps .mp-controls { position: absolute; z-index: 3; top: calc(var(--safe-top) + 8px); right: 12px; display: flex; flex-direction: column; gap: 10px; transition: opacity .25s; }
    .app-maps .mp-ctl-group { border-radius: 12px; overflow: hidden; background: var(--bar); -webkit-backdrop-filter: var(--blur, saturate(180%) blur(20px)); backdrop-filter: var(--blur, saturate(180%) blur(20px));
      box-shadow: 0 2px 12px rgba(0,0,0,.18), 0 0 0 .5px rgba(0,0,0,.08); }
    .app-maps .mp-ctl { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--tint); transition: background .15s; }
    .app-maps .mp-ctl + .mp-ctl { border-top: .5px solid var(--sep); }
    .app-maps .mp-ctl:active { background: var(--fill); }
    .app-maps .mp-ctl svg { width: 22px; height: 22px; }
    .app-maps .mp-ctl.busy svg { animation: mp-blink .9s ease-in-out infinite; }
    @keyframes mp-blink { 50% { opacity: .3; } }

    /* sheets */
    .app-maps .mp-sheet { position: absolute; z-index: 5; left: 0; right: 0; top: ${SHEET_TOP}px; height: ${H - SHEET_TOP}px; transform: translate3d(0,${HIDDEN}px,0);
      transition: transform .46s var(--mp-ease); will-change: transform; }
    .app-maps .mp-sheet.mp-card { z-index: 6; }
    .app-maps .mp-sheet.mp-noanim { transition: none !important; }
    .app-maps .mp-sheet-in { position: absolute; inset: 0; border-radius: 18px 18px 0 0; overflow: hidden; display: flex; flex-direction: column;
      background: var(--bar); -webkit-backdrop-filter: var(--blur, saturate(180%) blur(20px)); backdrop-filter: var(--blur, saturate(180%) blur(20px));
      box-shadow: 0 -2px 22px rgba(0,0,0,.16), 0 0 0 .5px rgba(0,0,0,.1); }
    #screen[data-theme="dark"] .app-maps .mp-sheet-in { box-shadow: 0 -2px 22px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.12); }
    .app-maps .mp-attrib { position: absolute; left: 10px; top: -17px; font-size: 9.5px; line-height: 12px; color: rgba(0,0,0,.62); text-shadow: 0 0 3px rgba(255,255,255,.9), 0 0 1px #fff;
      transition: opacity .25s; white-space: nowrap; cursor: pointer; }
    #screen[data-theme="dark"] .app-maps .mp-attrib, .app-maps.mp-m-satellite .mp-attrib { color: rgba(255,255,255,.8); text-shadow: 0 0 3px rgba(0,0,0,.9), 0 0 1px #000; }
    .app-maps .mp-head { flex: none; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
    .app-maps .mp-grab { height: 16px; display: flex; justify-content: center; padding-top: 6px; box-sizing: border-box; }
    .app-maps .mp-grab::before { content: ''; width: 36px; height: 5px; border-radius: 3px; background: var(--label3); }
    .app-maps .mp-search-row { display: flex; align-items: center; gap: 10px; padding: 0 16px 10px; }
    .app-maps .mp-search-row .ios-search { flex: 1; margin: 0; min-width: 0; }
    .app-maps .mp-avatar { flex: none; width: 34px; height: 34px; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 600; letter-spacing: .2px;
      background: linear-gradient(180deg,#A5ABB8,#858A96); display: flex; align-items: center; justify-content: center; }
    .app-maps .mp-cancel { flex: none; display: none; color: var(--tint); font-size: 17px; letter-spacing: -.4px; padding: 6px 0; }
    .app-maps .mp-head.searching .mp-cancel { display: block; }
    .app-maps .mp-head.searching .mp-avatar { display: none; }
    .app-maps .mp-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 2px 16px calc(var(--mp-y, 0px) + max(var(--kb-h, 0px), 34px) + 24px); box-sizing: border-box; }

    .app-maps .mp-sec { display: flex; align-items: baseline; justify-content: space-between; margin: 18px 4px 8px; }
    .app-maps .mp-sec:first-child { margin-top: 8px; }
    .app-maps .mp-sec h3 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.4px; }
    .app-maps .mp-sec button { color: var(--tint); font-size: 15px; letter-spacing: -.2px; }
    .app-maps .mp-box { background: var(--mp-card); border-radius: 12px; overflow: hidden; }
    .app-maps .mp-favs { display: flex; gap: 4px; padding: 14px 8px 12px; overflow-x: auto; overflow-y: hidden; }
    .app-maps .mp-fav { flex: none; width: 76px; display: flex; flex-direction: column; align-items: center; text-align: center; transition: opacity .15s, transform .25s var(--mp-ease); }
    .app-maps .mp-fav:active { opacity: .6; transform: scale(.95); }
    .app-maps .mp-fav-ic { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 6px; }
    .app-maps .mp-fav-ic svg { width: 28px; height: 28px; }
    .app-maps .mp-fav-ic.empty { background: var(--fill2); color: var(--tint); }
    .app-maps .mp-fav b { font-size: 13px; font-weight: 500; max-width: 74px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.1px; }
    .app-maps .mp-fav i { font-style: normal; font-size: 12px; color: var(--label2); max-width: 74px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .app-maps .mp-row { display: flex; align-items: center; gap: 12px; padding: 0 14px; min-height: 58px; position: relative; width: 100%; text-align: left; box-sizing: border-box; transition: background .15s; }
    .app-maps .mp-row:active { background: var(--fill2); }
    .app-maps .mp-row + .mp-row::before { content: ''; position: absolute; top: 0; left: 56px; right: 0; height: .5px; background: var(--sep); }
    .app-maps .mp-row-ic { flex: none; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; background: var(--red); font-size: 13px; font-weight: 700; }
    .app-maps .mp-row-ic svg { width: 17px; height: 17px; }
    .app-maps .mp-row-ic.gray { background: var(--gray); }
    .app-maps .mp-row-ic.blue { background: var(--tint); }
    .app-maps .mp-row-t { flex: 1; min-width: 0; padding: 9px 0; }
    .app-maps .mp-row-t b { display: block; font-size: 17px; font-weight: 400; letter-spacing: -.4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .app-maps .mp-row-t span { display: block; font-size: 14px; color: var(--label2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.15px; margin-top: 1px; }
    .app-maps .mp-row-v { flex: none; font-size: 14px; color: var(--label2); }
    .app-maps .mp-row.link b { color: var(--tint); }
    .app-maps .mp-row.link.red b { color: var(--red); }
    .app-maps .mp-row.slim { min-height: 46px; }
    .app-maps .mp-row.slim + .mp-row.slim::before { left: 14px; }
    .app-maps .mp-guides { display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; margin: 0 -16px; padding: 0 16px 4px; }
    .app-maps .mp-guide { flex: none; width: 150px; height: 186px; border-radius: 14px; position: relative; overflow: hidden; color: #fff; text-align: left; box-shadow: 0 3px 10px rgba(0,0,0,.14);
      transition: transform .3s var(--mp-ease), opacity .15s; }
    .app-maps .mp-guide:active { transform: scale(.96); opacity: .85; }
    .app-maps .mp-guide em { position: absolute; top: 22px; left: 0; right: 0; text-align: center; font-style: normal; font-size: 62px; line-height: 1; filter: drop-shadow(0 4px 8px rgba(0,0,0,.25)); }
    .app-maps .mp-guide div { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 12px 12px; background: linear-gradient(180deg,transparent,rgba(0,0,0,.42)); }
    .app-maps .mp-guide b { display: block; font-size: 16px; font-weight: 700; line-height: 19px; letter-spacing: -.3px; }
    .app-maps .mp-guide span { font-size: 12px; opacity: .85; }
    .app-maps .mp-foot { font-size: 12px; line-height: 16px; color: var(--label2); padding: 10px 6px 0; }
    .app-maps .mp-foot a { color: var(--tint); cursor: pointer; }
    .app-maps .mp-msg { text-align: center; padding: 46px 24px 10px; color: var(--label2); }
    .app-maps .mp-msg svg { width: 44px; height: 44px; color: var(--label3); }
    .app-maps .mp-msg h4 { margin: 10px 0 4px; font-size: 20px; font-weight: 700; color: var(--label); letter-spacing: -.4px; }
    .app-maps .mp-msg p { margin: 0 0 16px; font-size: 15px; line-height: 20px; }
    .app-maps .mp-msg .ios-pill { font-size: 15px; }
    .app-maps .mp-spin { width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid var(--fill); border-top-color: var(--label2); animation: mp-rot .8s linear infinite; margin: 0 auto; }
    @keyframes mp-rot { to { transform: rotate(360deg); } }
    .app-maps .mp-loading { display: flex; align-items: center; gap: 10px; padding: 16px 6px; color: var(--label2); font-size: 15px; }
    .app-maps .mp-loading .mp-spin { margin: 0; width: 18px; height: 18px; border-width: 2px; }
    .app-maps .mp-hero { border-radius: 14px; padding: 14px 14px 16px; color: #fff; position: relative; margin: 6px 0 12px; overflow: hidden; }
    .app-maps .mp-hero em { position: absolute; right: 10px; bottom: -8px; font-style: normal; font-size: 84px; line-height: 1; opacity: .9; }
    .app-maps .mp-hero button { display: flex; align-items: center; gap: 2px; font-size: 15px; font-weight: 600; color: #fff; background: rgba(255,255,255,.24); border-radius: 15px; padding: 5px 12px 5px 6px; margin-bottom: 26px; }
    .app-maps .mp-hero button svg { width: 16px; height: 16px; }
    .app-maps .mp-hero h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.5px; line-height: 30px; max-width: 250px; position: relative; }
    .app-maps .mp-hero p { margin: 4px 0 0; font-size: 14px; opacity: .9; position: relative; }

    /* place card */
    .app-maps .mp-title-row { display: flex; align-items: flex-start; gap: 8px; padding: 2px 16px 12px; }
    .app-maps .mp-tt { flex: 1; min-width: 0; }
    .app-maps .mp-title { font-size: 24px; font-weight: 700; letter-spacing: -.5px; line-height: 28px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .app-maps .mp-sub { font-size: 15px; color: var(--label2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.2px; }
    .app-maps .mp-round { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--fill); color: var(--label2); display: flex; align-items: center; justify-content: center; transition: opacity .15s; }
    .app-maps .mp-round:active { opacity: .5; }
    .app-maps .mp-round svg { width: 15px; height: 15px; }
    .app-maps .mp-actions { display: flex; gap: 8px; margin: 2px 0 14px; }
    .app-maps .mp-act { flex: 1; min-width: 0; height: 58px; border-radius: 12px; background: var(--mp-card); color: var(--tint); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      font-size: 12.5px; font-weight: 600; letter-spacing: -.1px; transition: opacity .15s, transform .25s var(--mp-ease); }
    .app-maps .mp-act:active { opacity: .6; transform: scale(.96); }
    .app-maps .mp-act svg { width: 22px; height: 22px; }
    .app-maps .mp-act.primary { background: var(--tint); color: #fff; flex: 1.35; }
    .app-maps .mp-chips { display: flex; gap: 22px; padding: 0 6px 14px; overflow: hidden; }
    .app-maps .mp-chip label { display: block; font-size: 11px; font-weight: 600; color: var(--label2); text-transform: uppercase; letter-spacing: .3px; }
    .app-maps .mp-chip span { font-size: 15px; font-weight: 600; letter-spacing: -.2px; white-space: nowrap; }
    .app-maps .mp-d { padding: 10px 14px; position: relative; }
    .app-maps .mp-d + .mp-d::before { content: ''; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--sep); }
    .app-maps .mp-d label { display: block; font-size: 13px; color: var(--label2); margin-bottom: 2px; }
    .app-maps .mp-d div { font-size: 16px; line-height: 21px; letter-spacing: -.3px; user-select: text; -webkit-user-select: text; word-break: break-word; }
    .app-maps .mp-d div.tint { color: var(--tint); cursor: pointer; }
    .app-maps .mp-gap { height: 14px; }

    /* directions */
    .app-maps .mp-segwrap { margin: 0 0 12px; }
    .app-maps .mp-segwrap .ios-seg button { display: flex; align-items: center; justify-content: center; gap: 5px; }
    .app-maps .mp-segwrap .ios-seg svg { width: 16px; height: 16px; }
    .app-maps .mp-dotc { flex: none; width: 30px; display: flex; justify-content: center; }
    .app-maps .mp-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--tint); border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.15); box-sizing: border-box; }
    .app-maps .mp-route { display: flex; align-items: center; gap: 12px; padding: 14px; margin-top: 12px; }
    .app-maps .mp-route > div { flex: 1; min-width: 0; }
    .app-maps .mp-eta { font-size: 28px; font-weight: 700; letter-spacing: -.6px; line-height: 32px; }
    .app-maps .mp-eta-sub { font-size: 15px; color: var(--label2); letter-spacing: -.2px; margin-top: 1px; }
    .app-maps .mp-est { display: inline-block; margin-top: 7px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--orange); background: color-mix(in srgb, var(--orange) 16%, transparent); padding: 3px 7px; border-radius: 6px; }
    .app-maps .mp-go { flex: none; width: 70px; height: 58px; border-radius: 12px; background: var(--green); color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -.3px; transition: transform .25s var(--mp-ease), opacity .15s; }
    .app-maps .mp-go:active { transform: scale(.94); opacity: .8; }
    .app-maps .mp-nav-row { display: flex; align-items: center; gap: 10px; padding: 0 16px 10px; }
    .app-maps .mp-nav-row > div { flex: 1; min-width: 0; }
    .app-maps .mp-nav-row b { display: block; font-size: 21px; font-weight: 700; letter-spacing: -.5px; line-height: 25px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .app-maps .mp-nav-row span { font-size: 14px; color: var(--label2); white-space: nowrap; }
    .app-maps .mp-end { flex: none; height: 40px; padding: 0 20px; border-radius: 20px; background: var(--red); color: #fff; font-size: 17px; font-weight: 600; transition: opacity .15s; }
    .app-maps .mp-end:active { opacity: .6; }
    .app-maps .mp-banner { position: absolute; z-index: 4; left: 10px; right: 10px; top: calc(var(--safe-top) + 4px); border-radius: 18px; background: #1C1C1E; color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 14px;
      box-shadow: 0 8px 28px rgba(0,0,0,.35); transform: translateY(-190px); transition: transform .5s var(--mp-ease); pointer-events: none; }
    .app-maps .mp-banner.on { transform: none; }
    .app-maps .mp-banner svg { flex: none; width: 46px; height: 46px; }
    .app-maps .mp-banner b { display: block; font-size: 26px; font-weight: 700; letter-spacing: -.5px; line-height: 30px; }
    .app-maps .mp-banner span { display: block; font-size: 17px; color: rgba(255,255,255,.72); letter-spacing: -.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 290px; }

    /* choose-map card */
    .app-maps .mp-modes { position: absolute; z-index: 8; left: 8px; right: 8px; bottom: 8px; border-radius: 26px; padding: 16px 16px calc(var(--safe-bottom) + 6px);
      background: var(--bar); -webkit-backdrop-filter: var(--blur, saturate(180%) blur(20px)); backdrop-filter: var(--blur, saturate(180%) blur(20px));
      box-shadow: 0 8px 40px rgba(0,0,0,.3), 0 0 0 .5px rgba(0,0,0,.1); transform: translateY(115%); transition: transform .42s var(--mp-ease); }
    .app-maps .mp-modes.on { transform: none; }
    .app-maps .mp-modes-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .app-maps .mp-modes-h b { font-size: 22px; font-weight: 700; letter-spacing: -.4px; }
    .app-maps .mp-modes-g { display: flex; gap: 10px; }
    .app-maps .mp-mode { flex: 1; min-width: 0; text-align: center; font-size: 13px; font-weight: 500; color: var(--label); }
    .app-maps .mp-mode i { display: block; height: 76px; border-radius: 11px; margin-bottom: 6px; background-size: cover; background-position: center; box-shadow: inset 0 0 0 .5px rgba(0,0,0,.15); outline: 3px solid transparent; outline-offset: 1px;
      transition: outline-color .2s, transform .25s var(--mp-ease); }
    .app-maps .mp-mode:active i { transform: scale(.95); }
    .app-maps .mp-mode.on i { outline-color: var(--tint); }
    .app-maps .mp-mode.on { color: var(--tint); font-weight: 600; }
    .app-maps .mp-mode[data-mode="transit"] i { filter: saturate(.35); }
    #screen[data-theme="dark"] .app-maps .mp-mode:not([data-mode="satellite"]) i { filter: invert(1) hue-rotate(180deg) brightness(.92) contrast(.86) saturate(.5); }

    /* loading / offline state */
    .app-maps .mp-state { position: absolute; inset: 0; z-index: 9; background: var(--bg2); display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 44px; }
    .app-maps .mp-state.on { display: flex; }
    .app-maps .mp-state > svg { width: 64px; height: 64px; color: var(--label3); }
    .app-maps .mp-state h2 { margin: 14px 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -.4px; }
    .app-maps .mp-state p { margin: 0 0 22px; font-size: 15px; line-height: 20px; color: var(--label2); }
    .app-maps .mp-state .ios-btn { width: 200px; }
    .app-maps .mp-state .mp-spin { width: 28px; height: 28px; margin-bottom: 4px; }

    /* markers */
    .app-maps .mp-pin { background: none; border: 0; }
    .app-maps .mp-pin svg { display: block; transform-origin: 50% 95%; animation: mp-drop .55s var(--mp-ease) both; overflow: visible; }
    @keyframes mp-drop { 0% { transform: translateY(-54px) scale(.5); opacity: 0; } 55% { transform: translateY(0) scale(1.1,.9); opacity: 1; } 78% { transform: translateY(-7px) scale(.97,1.04); } 100% { transform: none; } }
    .app-maps .mp-me-wrap { background: none; border: 0; }
    .app-maps .mp-me { width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.4); position: relative; }
    .app-maps .mp-me::before { content: ''; position: absolute; inset: -16px; border-radius: 50%; background: rgba(0,122,255,.25); animation: mp-pulse 2.4s ease-out infinite; }
    .app-maps .mp-me::after { content: ''; position: absolute; inset: 3.5px; border-radius: 50%; background: #007AFF; animation: mp-beat 2.4s ease-in-out infinite; }
    @keyframes mp-pulse { 0% { transform: scale(.35); opacity: .95; } 100% { transform: scale(1.3); opacity: 0; } }
    @keyframes mp-beat { 50% { transform: scale(.86); } }
    .app-maps .mp-gpin-wrap { background: none; border: 0; }
    .app-maps .mp-gpin { width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid #fff; box-sizing: border-box; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,.35); animation: mp-pop .4s var(--mp-ease) both; }
    @keyframes mp-pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: none; } }
  `);

  /* ───────────────────────── the app ───────────────────────── */
  function createApp(ctx) {
    const root = ctx.root, U = OS.util, esc = U.esc;
    const $ = (sel, el) => (el || root).querySelector(sel);
    let dead = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const cancel = t => { if (t != null) { clearTimeout(t); timers.delete(t); } };

    // persisted state
    let favs = OS.store.get('maps.favs', null) || JSON.parse(JSON.stringify(SEED_FAVS));
    if (!Array.isArray(favs.list)) favs.list = [];
    let recents = OS.store.get('maps.recents', null) || JSON.parse(JSON.stringify(SEED_RECENTS));
    let units = OS.store.get('maps.units', 'mi') === 'km' ? 'km' : 'mi';
    let userLoc = OS.store.get('maps.userLoc', null) || Object.assign({}, DEFAULT_LOC);
    const savedView = OS.store.get('maps.view', null) || { lat: DEFAULT_LOC.lat - 0.012, lng: DEFAULT_LOC.lng, zoom: 13, mode: 'explore' };
    const saveFavs = () => OS.store.set('maps.favs', favs);
    const saveRecents = () => OS.store.set('maps.recents', recents);

    // runtime state
    let map = null, layers = null, mode = ['explore', 'transit', 'satellite'].includes(savedView.mode) ? savedView.mode : 'explore';
    let meMarker = null, meCircle = null, pinMarker = null, routeLines = [], guideMarkers = [];
    let view = 'home', guide = null, assign = null, following = false;
    let place = null, cardView = 'place', travel = 'drive', navOn = false;
    let mainRestY = DET.medium, tileErrors = 0, lpAt = 0;
    let pendingParams = null, saveViewTimer = null, searchTimer = null, searchCtrl = null, pressTimer = null;
    const sr = { q: '', status: 'idle', results: [], local: [] };

    root.innerHTML = `
      <div class="mp-map"></div>
      <div class="mp-dim"></div>
      <div class="mp-net">${I.cloudOff}<span>Map can't load — check your connection</span></div>
      <div class="mp-controls"><div class="mp-ctl-group">
        <button class="mp-ctl" data-a="mode" aria-label="Choose Map">${I.map}</button>
        <button class="mp-ctl" data-a="locate" aria-label="My Location">${I.arrow}</button>
      </div></div>
      <div class="mp-banner"></div>
      <div class="mp-sheet mp-main">
        <div class="mp-attrib"></div>
        <div class="mp-sheet-in">
          <div class="mp-head">
            <div class="mp-grab"></div>
            <div class="mp-search-row">
              <div class="ios-search"><input type="text" placeholder="Search Maps" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"></div>
              <button class="mp-avatar" data-a="account" aria-label="Maps settings"></button>
              <button class="mp-cancel" data-a="cancel">Cancel</button>
            </div>
          </div>
          <div class="mp-body ios-scroll"></div>
        </div>
      </div>
      <div class="mp-sheet mp-card"><div class="mp-sheet-in"><div class="mp-head"></div><div class="mp-body ios-scroll"></div></div></div>
      <div class="mp-modes"></div>
      <div class="mp-state"></div>`;

    const mapEl = $('.mp-map'), dimEl = $('.mp-dim'), netEl = $('.mp-net'), ctlEl = $('.mp-controls'), bannerEl = $('.mp-banner');
    const mainEl = $('.mp-main'), mainHead = $('.mp-head', mainEl), mainBody = $('.mp-body', mainEl), attribEl = $('.mp-attrib'), input = $('input', mainEl);
    const cardEl = $('.mp-card'), cardHead = $('.mp-head', cardEl), cardBody = $('.mp-body', cardEl);
    const modesEl = $('.mp-modes'), stateEl = $('.mp-state'), locateBtn = $('[data-a="locate"]'), avatarEl = $('.mp-avatar');

    /* ── scale handling ── */
    function refreshScale() {
      const w = root.getBoundingClientRect().width;
      if (w > 0) mpScale = w / W;
      if (map) map.invalidateSize({ pan: false });
    }
    const onWinResize = () => refreshScale();
    window.addEventListener('resize', onWinResize);

    /* ── sheets ── */
    function sheetFx() {
      const y = Math.min(activeSheet().liveY, DET.medium);
      const t = clamp((DET.medium - y) / DET.medium, 0, 1);
      dimEl.style.opacity = (t * 0.38).toFixed(3);
      const o = 1 - clamp(t * 3, 0, 1);
      ctlEl.style.opacity = o; ctlEl.style.pointerEvents = o < 0.5 ? 'none' : '';
      attribEl.style.opacity = o;
    }
    function makeSheet(el, head, body, onTap) {
      const sh = { el, y: HIDDEN, liveY: HIDDEN, dragged: false, detents: [DET.large, DET.medium, DET.peek] };
      let startPY = 0, startY = 0, samples = [], downTarget = null;
      const place = (y, anim) => {
        el.classList.toggle('mp-noanim', !anim);
        el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
        sh.liveY = y; sheetFx();
      };
      sh.set = (y, anim) => {
        sh.y = y; place(y, anim !== false);
        if (y <= DET.peek) body.style.setProperty('--mp-y', y + 'px');
      };
      U.drag(head, {
        onStart(p, e) { startPY = p.y; startY = sh.y; samples = []; sh.dragged = false; downTarget = e && e.target; },
        onMove(p) {
          const dy = p.y - startPY;
          if (!sh.dragged && Math.abs(dy) < 6) return;
          sh.dragged = true;
          const lo = sh.detents[0], hi = sh.detents[sh.detents.length - 1];
          let y = startY + dy;
          if (y < lo) y = lo - (lo - y) * 0.22; else if (y > hi) y = hi + (y - hi) * 0.22;
          place(y, false);
          const now = performance.now();
          samples.push([now, y]); while (samples.length > 2 && now - samples[0][0] > 110) samples.shift();
        },
        onEnd() {
          if (!sh.dragged) { if (onTap) onTap(downTarget); return; }
          const now = performance.now(), recent = samples.filter(s => now - s[0] < 140);
          let v = 0;
          if (recent.length > 1) { const a = recent[0], b = recent[recent.length - 1]; v = (b[1] - a[1]) / Math.max(8, b[0] - a[0]); }
          const proj = sh.liveY + clamp(v, -3, 3) * 190;
          let best = sh.detents[0];
          sh.detents.forEach(d => { if (Math.abs(d - proj) < Math.abs(best - proj)) best = d; });
          if (best !== sh.y) OS.haptic('light');
          sh.set(best, true);
          if (sh.onSettle) sh.onSettle(best);
          later(() => { sh.dragged = false; }, 80);
        },
      });
      return sh;
    }
    const activeSheet = () => (place && card ? card : main) || { liveY: DET.medium };
    let main = null, card = null;
    main = makeSheet(mainEl, mainHead, mainBody, target => {
      if (target && target.closest && target.closest('.ios-search')) { input.focus(); return; }
      if (target && target.closest && target.closest('.mp-grab')) main.set(main.y === DET.medium ? DET.large : DET.medium);
    });
    main.onSettle = y => { if (y !== DET.large && document.activeElement === input) input.blur(); };
    card = makeSheet(cardEl, cardHead, cardBody, target => {
      if (target && target.closest && target.closest('.mp-grab') && !navOn) card.set(card.y === DET.medium ? DET.large : DET.medium);
    });

    /* ── status bar ── */
    const syncStatusBar = () => ctx.setStatusBar(navOn || mode === 'satellite' ? 'light' : 'auto');

    /* ── loading / offline state ── */
    function showState(kind) {
      if (!kind) { stateEl.classList.remove('on'); stateEl.innerHTML = ''; return; }
      stateEl.classList.add('on');
      stateEl.innerHTML = kind === 'loading'
        ? `<div class="mp-spin"></div><p style="margin-top:12px">Loading Maps…</p>`
        : `${I.cloudOff}<h2>Maps Is Offline</h2><p>Maps couldn't download what it needs to draw the map. Check your internet connection, then try again.</p><button class="ios-btn" data-a="retry-load">Try Again</button>`;
    }
    stateEl.addEventListener('click', e => { if (e.target.closest('[data-a="retry-load"]')) boot(); });

    function boot() {
      showState('loading');
      loadLeaflet().then(() => {
        if (dead) return;
        patchLeaflet();
        try { initMap(); } catch (err) { console.error('[maps] init failed', err); showState('offline'); return; }
        showState(null);
        main.set(DET.medium);
        if (pendingParams) { const p = pendingParams; pendingParams = null; handleParams(p); }
      }).catch(() => { if (!dead) showState('offline'); });
    }

    /* ── map ── */
    function initMap() {
      const L = window.L;
      refreshScale();
      map = L.map(mapEl, {
        zoomControl: false, attributionControl: false, keyboard: false, worldCopyJump: true, minZoom: 2, maxZoom: 19,
        bounceAtZoomLimits: false, maxBounds: [[-88, -100000], [88, 100000]], maxBoundsViscosity: 1, wheelPxPerZoomLevel: 90,
      });
      map.setView([savedView.lat, savedView.lng], savedView.zoom || 13);
      map.createPane('mp-rail').style.zIndex = 250;
      map.getPane('mp-rail').style.pointerEvents = 'none';
      const osmOpts = { maxZoom: 19, maxNativeZoom: 19, updateWhenIdle: false, keepBuffer: 3 };
      layers = {
        explore: [L.tileLayer(OSM_TILES, osmOpts)],
        transit: [L.tileLayer(OSM_TILES, osmOpts), L.tileLayer(RAIL_TILES, { pane: 'mp-rail', subdomains: 'abc', maxZoom: 19, maxNativeZoom: 19, opacity: 0.9 })],
        satellite: [L.tileLayer(ESRI_TILES, { maxZoom: 19, maxNativeZoom: 18, keepBuffer: 3 }), L.tileLayer(ESRI_LABELS, { pane: 'mp-rail', maxZoom: 19, maxNativeZoom: 18 })],
      };
      Object.keys(layers).forEach(k => {
        const base = layers[k][0];
        base.on('tileerror', () => { if (++tileErrors >= 3) netEl.classList.add('on'); });
        base.on('tileload', () => { tileErrors = 0; netEl.classList.remove('on'); });
      });
      setMode(mode, true);
      drawMe();

      map.on('moveend zoomend', () => {
        cancel(saveViewTimer);
        saveViewTimer = later(() => { const c = map.getCenter(); OS.store.set('maps.view', { lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), zoom: map.getZoom(), mode }); }, 600);
      });
      map.on('dragstart', () => { setFollowing(false); cancelPress(); });
      map.on('zoomstart movestart', cancelPress);
      map.on('click', () => {
        if (document.activeElement === input) input.blur();
        if (modesEl.classList.contains('on')) { toggleModes(false); return; }
        if (!place && main.y === DET.large) main.set(DET.medium);
      });
      // long-press (or right-click) drops a pin, like touch-and-hold on iOS
      let downPt = null;
      map.on('mousedown', e => {
        cancelPress();
        if (e.originalEvent && e.originalEvent.button) return;
        downPt = e.containerPoint;
        const ll = e.latlng;
        pressTimer = later(() => { pressTimer = null; if (!navOn) dropPinAt(ll); }, 650);
      });
      map.on('mousemove', e => { if (pressTimer && downPt && e.containerPoint.distanceTo(downPt) > 6) cancelPress(); });
      map.on('mouseup mouseout', cancelPress);
      map.on('contextmenu', e => { cancelPress(); if (!navOn) dropPinAt(e.latlng); });
    }
    function cancelPress() { if (pressTimer) { cancel(pressTimer); pressTimer = null; } }

    function setMode(m, silent) {
      mode = m;
      Object.keys(layers).forEach(k => layers[k].forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); }));
      layers[m].forEach(l => l.addTo(map));
      ['explore', 'transit', 'satellite'].forEach(k => root.classList.toggle('mp-m-' + k, k === m));
      attribEl.textContent = m === 'satellite' ? 'Imagery © Esri, Maxar, Earthstar Geographics' : m === 'transit' ? '© OpenStreetMap contributors · OpenRailwayMap' : '© OpenStreetMap contributors';
      tileErrors = 0; netEl.classList.remove('on');
      syncStatusBar();
      if (!silent) { const c = map.getCenter(); OS.store.set('maps.view', { lat: c.lat, lng: c.lng, zoom: map.getZoom(), mode }); }
    }
    attribEl.addEventListener('click', () => OS.openURL(mode === 'satellite' ? 'https://www.esri.com/en-us/legal/terms/data-attributions' : 'https://www.openstreetmap.org/copyright'));

    function drawMe() {
      const L = window.L;
      if (!map) return;
      const ll = [userLoc.lat, userLoc.lng];
      if (!meMarker) {
        meMarker = L.marker(ll, { icon: L.divIcon({ className: 'mp-me-wrap', html: '<div class="mp-me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(map);
      } else meMarker.setLatLng(ll);
      if (meCircle) { map.removeLayer(meCircle); meCircle = null; }
      if (userLoc.real && userLoc.acc && userLoc.acc > 25 && userLoc.acc < 3000) {
        meCircle = L.circle(ll, { radius: userLoc.acc, color: '#007AFF', weight: 1, opacity: 0.35, fillColor: '#007AFF', fillOpacity: 0.1, interactive: false }).addTo(map);
      }
    }
    function setFollowing(on) {
      following = on;
      locateBtn.innerHTML = on ? I.arrowFill : I.arrow;
    }
    // Where the middle of the *visible* map is, given whatever sheet covers the bottom.
    function visibleOffsetY() {
      const y = Math.min(activeSheet().y, DET.medium);
      const top = navOn ? SAFE_TOP + 90 : SAFE_TOP;
      return H / 2 - (top + SHEET_TOP + y) / 2;
    }
    function flyTo(p, zoom) {
      if (!map) return;
      const z = clamp(zoom == null ? Math.max(map.getZoom(), 15) : zoom, 2, 19);
      const target = map.unproject(map.project([p.lat, p.lng], z).add([0, visibleOffsetY()]), z);
      const px = map.project(map.getCenter(), z).distanceTo(map.project(target, z));
      if (px < 4 && z === map.getZoom()) return;
      if (px < 1200 && Math.abs(z - map.getZoom()) < 3) map.flyTo(target, z, { duration: 0.7, easeLinearity: 0.3 });
      else map.flyTo(target, z, { duration: 1.5 });
    }
    function fitPoints(pts, maxZoom) {
      if (!map || !pts.length) return;
      const y = Math.min(activeSheet().y, DET.medium);
      map.flyToBounds(window.L.latLngBounds(pts.map(p => [p.lat, p.lng])), {
        paddingTopLeft: [46, (navOn ? SAFE_TOP + 110 : SAFE_TOP + 30)], paddingBottomRight: [46, H - (SHEET_TOP + y) + 34], maxZoom: maxZoom || 16, duration: 1.1,
      });
    }

    function locate() {
      if (!map) return;
      const fallback = () => {
        if (dead) return;
        locateBtn.classList.remove('busy');
        OS.ui.toast(userLoc.real ? 'Using Last Known Location' : 'Location Unavailable — Showing Cupertino');
        setFollowing(true); flyTo(userLoc, Math.max(map.getZoom(), 15));
      };
      if (following && userLoc.real) { flyTo(userLoc, 16.5 | 0); return; }
      if (!navigator.geolocation) return fallback();
      locateBtn.classList.add('busy');
      let done = false;
      const guard = later(() => { if (!done) { done = true; fallback(); } }, 9000);
      try {
        navigator.geolocation.getCurrentPosition(pos => {
          if (done || dead) return; done = true; cancel(guard);
          locateBtn.classList.remove('busy');
          userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, real: true, label: 'Current Location' };
          OS.store.set('maps.userLoc', userLoc);
          drawMe(); setFollowing(true); OS.haptic('light');
          flyTo(userLoc, Math.max(map.getZoom(), 15));
          if (!place) renderMain();
        }, () => { if (done) return; done = true; cancel(guard); fallback(); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 });
      } catch (_) { if (!done) { done = true; cancel(guard); fallback(); } }
    }

    /* ── choose-map card ── */
    function toggleModes(on) {
      if (on === undefined) on = !modesEl.classList.contains('on');
      if (on && map) {
        const c = map.getCenter(), z = clamp(Math.round(map.getZoom()), 3, 15), t = tileXY(c.lat, c.lng, z);
        const osm = `https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`;
        const zs = Math.min(z, 15), ts = tileXY(c.lat, c.lng, zs);
        const thumbs = { explore: osm, transit: osm, satellite: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zs}/${ts.y}/${ts.x}` };
        const fall = { explore: 'linear-gradient(135deg,#DDEBC8,#F3EFE4 45%,#BBDDF5)', transit: 'linear-gradient(135deg,#E4E4E4,#F4F4F4 45%,#D2DAE0)', satellite: 'linear-gradient(135deg,#2E4A2C,#5B6B3D 50%,#1F3D57)' };
        modesEl.innerHTML = `<div class="mp-modes-h"><b>Choose Map</b><button class="mp-round" data-a="modes-close" aria-label="Close">${I.x}</button></div>
          <div class="mp-modes-g">${['explore', 'transit', 'satellite'].map(k => `<button class="mp-mode${k === mode ? ' on' : ''}" data-mode="${k}"><i style="background-image:url('${thumbs[k]}'),${fall[k]}"></i>${pretty(k)}</button>`).join('')}</div>`;
      }
      modesEl.classList.toggle('on', !!on);
    }
    modesEl.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (b && map) {
        setMode(b.dataset.mode); OS.haptic('selection');
        modesEl.querySelectorAll('.mp-mode').forEach(m => m.classList.toggle('on', m === b));
        later(() => toggleModes(false), 220);
      } else if (e.target.closest('[data-a="modes-close"]')) toggleModes(false);
    });
    ctlEl.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'mode') toggleModes(); else if (b.dataset.a === 'locate') { toggleModes(false); locate(); }
    });

    /* ── Nominatim (max 1 request / second, serialised) ── */
    let nomLast = 0, nomChain = Promise.resolve();
    function nominatim(path, signal) {
      const run = () => new Promise((resolve, reject) => {
        const go = () => {
          if (dead || (signal && signal.aborted)) return reject(new Error('aborted'));
          nomLast = Date.now();
          fetch(NOMINATIM + path, { signal, headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))).then(resolve, reject);
        };
        const wait = nomLast + 1100 - Date.now();
        if (wait > 0) { const t = setTimeout(() => { timers.delete(t); go(); }, wait); timers.add(t); } else go();
      });
      const p = nomChain.then(run);
      nomChain = p.then(() => {}, () => {});
      return p;
    }

    /* ── search ── */
    function allKnownPlaces() {
      const out = [], seen = new Set();
      const add = p => { if (p && p.lat != null && !seen.has(p.id)) { seen.add(p.id); out.push(p); } };
      add(favs.home); add(favs.work); favs.list.forEach(add); recents.forEach(add); GUIDES.forEach(g => g.places.forEach(add));
      return out;
    }
    function onQuery(text, immediate) {
      const q = text.trim();
      cancel(searchTimer); searchTimer = null;
      if (searchCtrl) { searchCtrl.stale = true; searchCtrl.abort(); searchCtrl = null; }
      sr.q = q;
      if (!q) { sr.status = 'idle'; sr.results = []; sr.local = []; renderMain(); return; }
      const lq = q.toLowerCase();
      sr.local = allKnownPlaces().filter(p => p.name.toLowerCase().includes(lq)).slice(0, 3);
      sr.status = 'loading'; sr.results = [];
      renderMain();
      searchTimer = later(() => { searchTimer = null; runSearch(q); }, immediate ? 0 : 1000);
    }
    async function runSearch(q) {
      const ctrl = new AbortController(); searchCtrl = ctrl;
      const guard = later(() => ctrl.abort(), 12000);
      let ok = false, data = null;
      try {
        let vb = '';
        if (map && map.getZoom() >= 9) { const b = map.getBounds(); vb = `&viewbox=${clamp(b.getWest(), -180, 180).toFixed(4)},${b.getNorth().toFixed(4)},${clamp(b.getEast(), -180, 180).toFixed(4)},${b.getSouth().toFixed(4)}`; }
        data = await nominatim(`/search?format=jsonv2&limit=8&addressdetails=1&extratags=1&q=${encodeURIComponent(q)}${vb}`, ctrl.signal);
        ok = true;
      } catch (_) { /* offline / aborted */ }
      cancel(guard);
      if (searchCtrl === ctrl) searchCtrl = null;
      if (dead || ctrl.stale || sr.q !== q) return;
      if (ok) {
        const ids = new Set(sr.local.map(p => p.id));
        sr.results = (Array.isArray(data) ? data : []).filter(r => r && r.lat && r.lon).map(placeFromNominatim).filter(p => !ids.has(p.id));
        sr.status = 'done';
      } else sr.status = 'error';
      renderMain();
    }
    function startSearchUI() {
      mainHead.classList.add('searching');
      if (view !== 'search') { clearGuideMarkers(); guide = null; view = 'search'; renderMain(); }
      if (main.y !== DET.large && !place) main.set(DET.large);
    }
    function cancelSearch() {
      cancel(searchTimer); searchTimer = null;
      if (searchCtrl) { searchCtrl.stale = true; searchCtrl.abort(); searchCtrl = null; }
      input.value = ''; input.placeholder = 'Search Maps'; input.blur();
      assign = null; sr.q = ''; sr.status = 'idle'; sr.results = []; sr.local = [];
      mainHead.classList.remove('searching');
      view = 'home'; renderMain();
      if (!place) main.set(DET.medium);
    }
    function startAssign(kind) {
      assign = kind;
      input.value = ''; sr.q = ''; sr.status = 'idle';
      input.placeholder = kind === 'home' ? 'Search for your Home' : kind === 'work' ? 'Search for your Work' : 'Search for a Favorite';
      view = 'home'; startSearchUI(); input.focus();
    }
    input.addEventListener('focus', startSearchUI);
    input.addEventListener('input', () => onQuery(input.value, false));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (input.value.trim()) onQuery(input.value, true); input.blur(); } });

    function pickPlace(p) {
      if (assign) {
        const kind = assign; assign = null; input.placeholder = 'Search Maps';
        const copy = Object.assign({}, p);
        if (kind === 'home' || kind === 'work') { favs[kind] = copy; OS.ui.toast(kind === 'home' ? 'Home Set' : 'Work Set'); }
        else if (!favs.list.some(f => f.id === p.id)) { favs.list.push(copy); OS.ui.toast('Added to Favorites'); }
        saveFavs(); OS.haptic('success');
      } else addRecent(p);
      input.blur();
      openPlace(p);
    }
    function addRecent(item) {
      const key = item.q ? 'q:' + item.q.toLowerCase() : item.id;
      recents = recents.filter(r => (r.q ? 'q:' + r.q.toLowerCase() : r.id) !== key);
      recents.unshift(item.q ? { q: item.q } : Object.assign({}, item));
      recents = recents.slice(0, 12); saveRecents();
    }

    /* ── main sheet rendering ── */
    const distTo = p => fmtDistance(haversine(userLoc, p), units);
    function placeRow(p, attr, icon, cls) {
      return `<button class="mp-row" ${attr}><span class="mp-row-ic ${cls || ''}">${icon || I.pin}</span><span class="mp-row-t"><b>${esc(p.name)}</b><span>${esc(p.sub || (p.address || []).join(', ') || fmtCoords(p))}</span></span><span class="mp-row-v">${distTo(p)}</span></button>`;
    }
    function renderMain() {
      avatarEl.textContent = initials();
      if (view === 'search') return renderSearch();
      if (view === 'guide' && guide) return renderGuide();
      const favItems = [
        { k: 'home', label: 'Home', p: favs.home, icon: I.house, bg: 'var(--tint)' },
        { k: 'work', label: 'Work', p: favs.work, icon: I.work, bg: 'var(--brown)' },
      ].concat(favs.list.map((p, i) => ({ k: 'f' + i, label: p.name, p, icon: I.starFill, bg: 'var(--orange)' })));
      mainBody.innerHTML = `
        <div class="mp-sec"><h3>Favorites</h3></div>
        <div class="mp-box"><div class="mp-favs ios-scroll">
          ${favItems.map(f => `<button class="mp-fav" data-fav="${f.k}"><span class="mp-fav-ic${f.p ? '' : ' empty'}" style="${f.p ? 'background:' + f.bg : ''}">${f.icon}</span><b>${esc(f.label)}</b><i>${f.p ? distTo(f.p) : 'Add'}</i></button>`).join('')}
          <button class="mp-fav" data-fav="add"><span class="mp-fav-ic empty">${I.plus}</span><b>Add</b><i>&nbsp;</i></button>
        </div></div>
        ${recents.length ? `<div class="mp-sec"><h3>Recents</h3><button data-a="clear-recents">Clear</button></div>
        <div class="mp-box">${recents.slice(0, 6).map((r, i) => r.q
          ? `<button class="mp-row" data-recent="${i}"><span class="mp-row-ic gray">${I.search}</span><span class="mp-row-t"><b>${esc(r.q)}</b><span>Search</span></span></button>`
          : placeRow(r, `data-recent="${i}"`)).join('')}</div>` : ''}
        <div class="mp-sec"><h3>Guides</h3></div>
        <div class="mp-guides ios-scroll">${GUIDES.map((g, i) => `<button class="mp-guide" data-guide="${i}" style="background:${g.grad}"><em>${g.emoji}</em><div><b>${esc(g.title)}</b><span>${g.places.length} Places</span></div></button>`).join('')}</div>
        <div class="mp-gap"></div><div class="mp-gap"></div>
        <div class="mp-box">
          <button class="mp-row slim link" data-a="share-loc"><span class="mp-row-t"><b>Share My Location</b></span></button>
          <button class="mp-row slim link" data-a="mark-loc"><span class="mp-row-t"><b>Mark My Location</b></span></button>
        </div>
        <div class="mp-foot">Map data <a data-a="osm">© OpenStreetMap contributors</a>. Search by Nominatim. Travel times are straight-line estimates.</div>`;
      mainBody.querySelectorAll('.mp-fav').forEach(el => {
        const k = el.dataset.fav; if (k === 'add') return;
        U.longPress(el, () => favMenu(k, el));
      });
    }
    function renderSearch() {
      let html = '';
      if (!sr.q) {
        const rp = recents.filter(r => !r.q).slice(0, 8);
        html = assign
          ? `<div class="mp-msg">${I.search}<h4>${assign === 'home' ? 'Add Home' : assign === 'work' ? 'Add Work' : 'Add a Favorite'}</h4><p>Search for a place or address, then tap it to save it.</p></div>`
          : '';
        if (rp.length) html += `<div class="mp-sec"><h3>${assign ? 'Suggestions' : 'Recents'}</h3></div><div class="mp-box">${rp.map(p => placeRow(p, `data-recent="${recents.indexOf(p)}"`)).join('')}</div>`;
        else if (!assign) html = `<div class="mp-msg">${I.search}<h4>Search Maps</h4><p>Find places, addresses, cities and landmarks anywhere in the world.</p></div>`;
      } else {
        const rows = sr.local.map((p, i) => placeRow(p, `data-local="${i}"`, I.starFill, 'blue')).concat(sr.results.map((p, i) => placeRow(p, `data-result="${i}"`)));
        if (rows.length) html += `<div class="mp-box" style="margin-top:6px">${rows.join('')}</div>`;
        if (sr.status === 'loading') html += `<div class="mp-loading"><div class="mp-spin"></div>Searching for “${esc(sr.q)}”…</div>`;
        else if (sr.status === 'error') html += `<div class="mp-msg">${I.cloudOff}<h4>Search Unavailable</h4><p>Maps can't reach the search service right now. Check your internet connection and try again.</p><button class="ios-pill" data-a="retry-search">Try Again</button></div>`;
        else if (sr.status === 'done' && !rows.length) html += `<div class="mp-msg">${I.search}<h4>No Results</h4><p>No places were found for “${esc(sr.q)}”. Check the spelling or try a different search.</p></div>`;
      }
      mainBody.innerHTML = html;
    }
    function renderGuide() {
      const g = guide;
      mainBody.innerHTML = `
        <div class="mp-hero" style="background:${g.grad}"><em>${g.emoji}</em><button data-a="guide-back">${I.back}Guides</button><h2>${esc(g.title)}</h2><p>${g.places.length} Places · Curated for you</p></div>
        <div class="mp-box">${g.places.map((p, i) => `<button class="mp-row" data-gplace="${i}"><span class="mp-row-ic" style="background:${g.color}">${i + 1}</span><span class="mp-row-t"><b>${esc(p.name)}</b><span>${esc(p.sub)}</span></span><span class="mp-row-v">${distTo(p)}</span></button>`).join('')}</div>`;
    }
    function initials() {
      const n = String(OS.settings.get('ownerName') || '').trim();
      return n ? n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '☺';
    }
    function clearGuideMarkers() { guideMarkers.forEach(m => map && map.removeLayer(m)); guideMarkers = []; }
    function openGuide(g) {
      guide = g; view = 'guide'; renderMain(); mainBody.scrollTop = 0;
      main.set(DET.medium);
      clearGuideMarkers();
      if (!map) return;
      g.places.forEach((p, i) => {
        const m = window.L.marker([p.lat, p.lng], { icon: window.L.divIcon({ className: 'mp-gpin-wrap', html: `<div class="mp-gpin" style="background:${g.color};animation-delay:${i * 45}ms">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }), keyboard: false });
        m.on('click', () => openPlace(p)); m.addTo(map); guideMarkers.push(m);
      });
      fitPoints(g.places, 12);
    }
    function favMenu(k, el) {
      lpAt = Date.now(); OS.haptic('medium');
      const isSlot = k === 'home' || k === 'work', p = isSlot ? favs[k] : favs.list[+k.slice(1)];
      if (!p) return;
      OS.ui.contextMenu(el, [
        { label: 'Directions', icon: I.turn, onTap() { openPlace(p, { directions: true }); } },
        isSlot ? { label: 'Change ' + pretty(k), icon: I.search, onTap() { startAssign(k); } } : null,
        { label: isSlot ? 'Remove ' + pretty(k) : 'Remove Favorite', style: 'destructive', onTap() { if (isSlot) favs[k] = null; else favs.list = favs.list.filter(f => f !== p); saveFavs(); renderMain(); } },
      ].filter(Boolean));
    }

    mainBody.addEventListener('click', e => {
      if (main.dragged) return;
      const t = e.target.closest('[data-fav],[data-recent],[data-guide],[data-gplace],[data-result],[data-local],[data-a]');
      if (!t) return;
      const d = t.dataset;
      if (d.fav != null) {
        if (Date.now() - lpAt < 900) return;
        if (d.fav === 'add') return startAssign('fav');
        const p = d.fav === 'home' || d.fav === 'work' ? favs[d.fav] : favs.list[+d.fav.slice(1)];
        return p ? openPlace(p) : startAssign(d.fav);
      }
      if (d.recent != null) {
        const r = recents[+d.recent]; if (!r) return;
        if (r.q) { input.value = r.q; startSearchUI(); onQuery(r.q, true); return; }
        return pickPlace(r);
      }
      if (d.guide != null) return openGuide(GUIDES[+d.guide]);
      if (d.gplace != null && guide) { const p = guide.places[+d.gplace]; addRecent(p); return openPlace(p); }
      if (d.result != null) return sr.results[+d.result] && pickPlace(sr.results[+d.result]);
      if (d.local != null) return sr.local[+d.local] && pickPlace(sr.local[+d.local]);
      switch (d.a) {
        case 'clear-recents':
          OS.ui.actionSheet({ title: 'Clear all recent searches and places?', buttons: [{ label: 'Clear Recents', style: 'destructive' }], cancel: 'Cancel' })
            .then(i => { if (i === 0 && !dead) { recents = []; saveRecents(); renderMain(); } });
          break;
        case 'retry-search': onQuery(sr.q, true); break;
        case 'guide-back': clearGuideMarkers(); guide = null; view = 'home'; renderMain(); break;
        case 'share-loc': copyText(`My Location\n${fmtCoords(userLoc)}\nhttps://www.openstreetmap.org/?mlat=${userLoc.lat.toFixed(5)}&mlon=${userLoc.lng.toFixed(5)}#map=16/${userLoc.lat.toFixed(5)}/${userLoc.lng.toFixed(5)}`, 'Location Copied'); break;
        case 'mark-loc': dropPinAt({ lat: userLoc.lat, lng: userLoc.lng }, 'Marked Location'); break;
        case 'osm': OS.openURL('https://www.openstreetmap.org/copyright'); break;
      }
    });
    mainHead.addEventListener('click', e => {
      if (main.dragged) return;
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'cancel') cancelSearch(); else if (b.dataset.a === 'account') openSettings();
    });

    function copyText(text, okMsg) {
      const done = ok => { if (!dead) OS.ui.toast(ok ? okMsg : 'Copy Unavailable'); };
      try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (_) { done(false); }
    }

    function openSettings() {
      const sheet = OS.ui.sheet({
        title: 'Maps', height: 'medium',
        right: { label: 'Done', bold: true, onTap() { sheet.close(); } },
        render(body) {
          body.innerHTML = `
            <div class="ios-list-header">DISTANCES</div>
            <div class="ios-list"><div class="ios-row"><div class="ios-seg" style="flex:1"><button data-u="mi" class="${units === 'mi' ? 'on' : ''}">Miles</button><button data-u="km" class="${units === 'km' ? 'on' : ''}">Kilometers</button></div></div></div>
            <div class="ios-list-header">HISTORY</div>
            <div class="ios-list"><div class="ios-row tappable" data-s="clear"><span class="ios-row-label" style="color:var(--red)">Clear Recents</span></div></div>
            <div class="ios-list-header">MAP DATA</div>
            <div class="ios-list">
              <div class="ios-row tappable" data-s="osm"><span class="ios-row-label">© OpenStreetMap contributors</span><span class="ios-chevron"></span></div>
              <div class="ios-row tappable" data-s="esri"><span class="ios-row-label">Satellite imagery © Esri</span><span class="ios-chevron"></span></div>
            </div>
            <div class="ios-list-footer">Search is provided by Nominatim. Routes and travel times are straight-line estimates, not turn-by-turn directions.</div>`;
          body.addEventListener('click', e => {
            const u = e.target.closest('[data-u]'), s = e.target.closest('[data-s]');
            if (u) {
              units = u.dataset.u; OS.store.set('maps.units', units); OS.haptic('selection');
              body.querySelectorAll('[data-u]').forEach(b => b.classList.toggle('on', b === u));
              if (!dead) { renderMain(); if (place) renderCard(); }
            } else if (s) {
              if (s.dataset.s === 'clear') { recents = []; saveRecents(); if (!dead) renderMain(); OS.ui.toast('Recents Cleared'); }
              else { sheet.close(); OS.openURL(s.dataset.s === 'osm' ? 'https://www.openstreetmap.org/copyright' : 'https://www.esri.com/en-us/legal/terms/data-attributions'); }
            }
          });
        },
      });
    }

    /* ── place card ── */
    function setPin(p) {
      if (!map) return;
      if (pinMarker) { map.removeLayer(pinMarker); pinMarker = null; }
      if (p) pinMarker = window.L.marker([p.lat, p.lng], { icon: window.L.divIcon({ className: 'mp-pin', html: PIN_SVG, iconSize: [34, 46], iconAnchor: [17, 44] }), keyboard: false, zIndexOffset: 1000, interactive: false }).addTo(map);
    }
    function clearRoute() { routeLines.forEach(l => map && map.removeLayer(l)); routeLines = []; }
    function zoomFor(p) {
      if (p.bbox && p.bbox.length === 4 && map) {
        const [s, n, w, e] = p.bbox;
        if (Math.abs(n - s) > 0.004 || Math.abs(e - w) > 0.004) {
          try { return clamp(map.getBoundsZoom([[s, w], [n, e]], false, [60, 480]), 3, 16); } catch (_) { /* fall through */ }
        }
      }
      return 16;
    }
    function openPlace(p, opts) {
      opts = opts || {};
      if (!map) { pendingParams = { lat: p.lat, lng: p.lng, name: p.name }; return; }
      if (navOn) endNav(true);
      toggleModes(false);
      if (!place) mainRestY = main.y === DET.large ? DET.medium : main.y;
      place = p; cardView = 'place'; setFollowing(false);
      clearRoute(); setPin(p);
      main.set(HIDDEN);
      card.detents = [DET.large, DET.medium, DET.peek];
      renderCard(); cardBody.scrollTop = 0;
      card.set(DET.medium);
      if (opts.directions) showDirections(); else flyTo(p, opts.zoom || zoomFor(p));
      OS.haptic('light');
    }
    function closeCard() {
      if (navOn) endNav(true);
      place = null; clearRoute(); setPin(null);
      card.set(HIDDEN);
      main.set(view === 'search' && document.activeElement === input ? DET.large : mainRestY);
      renderMain();
    }
    function dropPinAt(ll, title) {
      OS.haptic('medium');
      const p = { id: 'pin' + U.uid(), name: title || 'Dropped Pin', sub: fmtCoords(ll), lat: ll.lat, lng: ((ll.lng + 540) % 360) - 180, address: [], dropped: true };
      openPlace(p, { zoom: Math.max(map.getZoom(), 14) });
      nominatim(`/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${p.lat.toFixed(6)}&lon=${p.lng.toFixed(6)}`).then(r => {
        if (dead || place !== p || !r || r.error) return;
        const info = placeFromNominatim(r);
        p.address = info.address; p.sub = (info.address[0] || '') && info.address.slice(0, 2).join(', ') || p.sub; p.osm = '';
        if (cardView === 'place') renderCard();
      }).catch(() => { /* offline: the pin still has coordinates */ });
    }

    const isFav = p => favs.list.some(f => f.id === p.id);
    const grabHTML = '<div class="mp-grab"></div>';
    function arrivalText(mins) {
      const d = new Date(Date.now() + mins * 60000), ap = OS.settings.get('use24h') ? '' : U.ampm(d);
      return U.time(d) + (ap ? ' ' + ap : '');
    }
    function renderCard() {
      if (!place) return;
      if (cardView === 'directions') return renderDirections();
      if (cardView === 'nav') return renderNav();
      const p = place, metres = haversine(userLoc, p), webLabel = p.website ? 'Website' : p.wiki ? 'Wikipedia' : 'More Info';
      cardHead.innerHTML = `${grabHTML}<div class="mp-title-row"><div class="mp-tt"><div class="mp-title">${esc(p.name)}</div><div class="mp-sub">${esc(p.sub || 'Place')}</div></div>
        <button class="mp-round" data-a="share" aria-label="Share">${I.share}</button><button class="mp-round" data-a="close" aria-label="Close">${I.x}</button></div>`;
      const hasLink = p.website || p.wiki || p.osm;
      cardBody.innerHTML = `
        <div class="mp-actions">
          <button class="mp-act primary" data-a="dir">${I.car}<span>${fmtDuration(estimateMinutes(metres, 'drive'))} · Directions</span></button>
          ${p.phone ? `<button class="mp-act" data-a="call">${I.phone}<span>Call</span></button>` : ''}
          ${hasLink ? `<button class="mp-act" data-a="web">${I.compass}<span>${webLabel}</span></button>` : ''}
          <button class="mp-act" data-a="more">${I.more}<span>More</span></button>
        </div>
        <div class="mp-chips">
          <div class="mp-chip"><label>Distance</label><span>${fmtDistance(metres, units)}</span></div>
          ${p.kind ? `<div class="mp-chip"><label>Type</label><span>${esc(p.kind)}</span></div>` : ''}
          <div class="mp-chip"><label>Direction</label><span>${pretty(compassWord(bearing(userLoc, p)))}</span></div>
        </div>
        <div class="mp-sec" style="margin-top:0"><h3>Details</h3></div>
        <div class="mp-box">
          ${p.hours ? `<div class="mp-d"><label>Hours</label><div>${esc(p.hours).replace(/;\s*/g, '<br>')}</div></div>` : ''}
          ${p.phone ? `<div class="mp-d"><label>Phone</label><div class="tint" data-a="call">${esc(p.phone)}</div></div>` : ''}
          ${p.website ? `<div class="mp-d"><label>Website</label><div class="tint" data-a="web">${esc(p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</div></div>` : ''}
          ${(p.address || []).filter(Boolean).length ? `<div class="mp-d"><label>Address</label><div>${p.address.filter(Boolean).map(esc).join('<br>')}</div></div>` : ''}
          <div class="mp-d"><label>Coordinates</label><div>${fmtCoords(p)}</div></div>
        </div>
        <div class="mp-gap"></div>
        <div class="mp-box">
          <button class="mp-row slim link${isFav(p) ? ' red' : ''}" data-a="fav"><span class="mp-row-t"><b>${isFav(p) ? 'Remove from Favorites' : 'Add to Favorites'}</b></span><span class="mp-row-v" style="color:${isFav(p) ? 'var(--orange)' : 'var(--tint)'};display:flex">${isFav(p) ? I.starFill : I.star}</span></button>
          <button class="mp-row slim link" data-a="copy"><span class="mp-row-t"><b>Copy Coordinates</b></span></button>
          ${p.dropped ? `<button class="mp-row slim link red" data-a="close"><span class="mp-row-t"><b>Remove Pin</b></span></button>` : ''}
        </div>`;
    }
    function drawRoute() {
      clearRoute();
      if (!map || !place) return;
      const pts = [[userLoc.lat, userLoc.lng], [place.lat, place.lng]], L = window.L;
      routeLines.push(L.polyline(pts, { color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(map));
      routeLines.push(L.polyline(pts, { color: travel === 'walk' ? '#0A84FF' : '#007AFF', weight: 5.5, opacity: 1, lineCap: 'round', dashArray: travel === 'walk' ? '1 11' : null, interactive: false }).addTo(map));
    }
    function showDirections() {
      cardView = 'directions'; renderCard(); cardBody.scrollTop = 0;
      if (card.y !== DET.medium) card.set(DET.medium);
      drawRoute(); fitPoints([userLoc, place]);
    }
    function renderDirections() {
      const p = place, metres = haversine(userLoc, p), mins = estimateMinutes(metres, travel);
      cardHead.innerHTML = `${grabHTML}<div class="mp-title-row"><div class="mp-tt"><div class="mp-title">Directions</div><div class="mp-sub">to ${esc(p.name)}</div></div><button class="mp-round" data-a="dir-close" aria-label="Close">${I.x}</button></div>`;
      cardBody.innerHTML = `
        <div class="mp-segwrap"><div class="ios-seg">
          <button data-travel="drive" class="${travel === 'drive' ? 'on' : ''}">${I.car}Drive</button>
          <button data-travel="walk" class="${travel === 'walk' ? 'on' : ''}">${I.walk}Walk</button>
          <button data-travel="bike" class="${travel === 'bike' ? 'on' : ''}">${I.bike}Cycle</button>
        </div></div>
        <div class="mp-box">
          <div class="mp-row" style="min-height:52px"><span class="mp-dotc"><span class="mp-dot"></span></span><span class="mp-row-t"><b>My Location</b><span>${userLoc.real ? 'Current location' : 'Cupertino (default — tap the arrow to use yours)'}</span></span></div>
          <div class="mp-row" style="min-height:52px"><span class="mp-row-ic">${I.pin}</span><span class="mp-row-t"><b>${esc(p.name)}</b><span>${esc(p.sub || fmtCoords(p))}</span></span></div>
        </div>
        <div class="mp-box mp-route"><div><div class="mp-eta">${fmtDuration(mins)}</div><div class="mp-eta-sub">${fmtDistance(metres, units)} · Arrive ${arrivalText(mins)}</div><span class="mp-est">Straight-line estimate</span></div>
          <button class="mp-go" data-a="go">GO</button></div>
        <div class="mp-foot">Distance is measured in a straight line and the time is a rough estimate from typical ${travel === 'drive' ? 'driving' : travel === 'walk' ? 'walking' : 'cycling'} speeds. Real roads, traffic and terrain aren't included.</div>`;
    }
    function startNav() {
      navOn = true; cardView = 'nav';
      const p = place, metres = haversine(userLoc, p);
      bannerEl.innerHTML = `${I.up}<div><b>${fmtDistance(metres, units)}</b><span>Head ${compassWord(bearing(userLoc, p))} toward ${esc(p.name)}</span></div>`;
      const arrow = bannerEl.querySelector('svg'); if (arrow) arrow.style.transform = `rotate(${Math.round(bearing(userLoc, p))}deg)`;
      bannerEl.classList.add('on');
      card.detents = [DET.medium, DET.peek];
      renderCard(); card.set(DET.peek);
      syncStatusBar(); OS.haptic('success');
      fitPoints([userLoc, p]);
    }
    function endNav(silent) {
      navOn = false; bannerEl.classList.remove('on');
      card.detents = [DET.large, DET.medium, DET.peek];
      syncStatusBar();
      if (silent) return;
      cardView = 'place'; clearRoute(); renderCard(); card.set(DET.medium);
      flyTo(place, zoomFor(place));
    }
    function renderNav() {
      const p = place, metres = haversine(userLoc, p), mins = estimateMinutes(metres, travel);
      cardHead.innerHTML = `${grabHTML}<div class="mp-nav-row"><div><b>${arrivalText(mins)} arrival</b><span>${fmtDuration(mins)} · ${fmtDistance(metres, units)} · estimate</span></div><button class="mp-end" data-a="end">End</button></div>`;
      cardBody.innerHTML = `
        <div class="mp-box">
          <div class="mp-row"><span class="mp-row-ic blue">${I.up}</span><span class="mp-row-t"><b>Head ${compassWord(bearing(userLoc, p))}</b><span>Continue for ${fmtDistance(metres, units)} (straight line)</span></span></div>
          <div class="mp-row"><span class="mp-row-ic">${I.flag}</span><span class="mp-row-t"><b>Arrive at ${esc(p.name)}</b><span>${esc((p.address || []).filter(Boolean)[0] || p.sub || fmtCoords(p))}</span></span></div>
        </div>
        <div class="mp-foot">This is a straight-line preview, not turn-by-turn navigation.</div>`;
    }
    function cardClick(e) {
      if (card.dragged || !place) return;
      const tr = e.target.closest('[data-travel]');
      if (tr) { travel = tr.dataset.travel; OS.haptic('selection'); renderCard(); drawRoute(); return; }
      const b = e.target.closest('[data-a]'); if (!b) return;
      const p = place;
      switch (b.dataset.a) {
        case 'close': closeCard(); break;
        case 'share': copyText(`${p.name}\n${(p.address || []).filter(Boolean).join(', ')}\nhttps://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=16/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`, 'Link Copied'); break;
        case 'dir': showDirections(); break;
        case 'dir-close': cardView = 'place'; clearRoute(); renderCard(); flyTo(p, zoomFor(p)); break;
        case 'go': startNav(); break;
        case 'end': endNav(false); break;
        case 'call': if (p.phone) OS.openURL('tel:' + p.phone.split(/[;,]/)[0].replace(/[^\d+]/g, '')); break;
        case 'web': OS.openURL(p.website || p.wiki || 'https://www.openstreetmap.org/' + p.osm); break;
        case 'copy': copyText(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`, 'Coordinates Copied'); break;
        case 'fav':
          if (isFav(p)) { favs.list = favs.list.filter(f => f.id !== p.id); OS.ui.toast('Removed from Favorites'); }
          else { favs.list.push(Object.assign({}, p, { dropped: false })); OS.ui.toast('Added to Favorites'); OS.haptic('success'); }
          saveFavs(); renderCard(); break;
        case 'more':
          OS.ui.contextMenu(b, [
            { label: 'Set as Home', icon: I.house, onTap() { favs.home = Object.assign({}, p, { dropped: false }); saveFavs(); OS.ui.toast('Home Set'); } },
            { label: 'Set as Work', icon: I.work, onTap() { favs.work = Object.assign({}, p, { dropped: false }); saveFavs(); OS.ui.toast('Work Set'); } },
            { label: 'Copy Coordinates', icon: I.pin, onTap() { copyText(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`, 'Coordinates Copied'); } },
            { label: 'View on OpenStreetMap', icon: I.compass, onTap() { OS.openURL(p.osm ? 'https://www.openstreetmap.org/' + p.osm : `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=17/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`); } },
          ]);
          break;
      }
    }
    cardHead.addEventListener('click', cardClick);
    cardBody.addEventListener('click', cardClick);

    /* ── params from OS.openApp('maps', {...}) ── */
    function handleParams(params) {
      if (!params || typeof params !== 'object') return;
      if (!map) { pendingParams = params; return; }
      const lat = +params.lat, lng = +(params.lng != null ? params.lng : params.lon != null ? params.lon : params.longitude);
      const query = params.query || params.q;
      if (isFinite(lat) && isFinite(lng) && params.lat != null) {
        const name = String(params.name || params.title || 'Dropped Pin');
        openPlace({ id: 'ext' + lat.toFixed(4) + ',' + lng.toFixed(4), name, sub: params.subtitle ? String(params.subtitle) : fmtCoords({ lat, lng }), lat, lng, address: params.address ? [String(params.address)] : [] }, { zoom: +params.zoom || 12 });
      } else if (query) {
        if (place) closeCard();
        input.value = String(query); startSearchUI(); onQuery(String(query), true);
      }
    }

    /* ── go ── */
    renderMain();
    syncStatusBar();
    boot();

    return {
      resume(params) {
        refreshScale();
        later(refreshScale, 450);                       // again once the open animation has settled
        avatarEl.textContent = initials();
        syncStatusBar();
        if (params) handleParams(params);
      },
      pause() { cancelPress(); if (document.activeElement === input) input.blur(); },
      destroy() {
        dead = true;
        window.removeEventListener('resize', onWinResize);
        timers.forEach(t => clearTimeout(t)); timers.clear();
        if (searchCtrl) { searchCtrl.stale = true; try { searchCtrl.abort(); } catch (_) { /* noop */ } }
        if (map) { try { map.stop(); map.off(); map.remove(); } catch (_) { /* noop */ } map = null; }
      },
    };
  }

  /* ───────────────────────── registration ───────────────────────── */
  let instance = null;
  OS.registerApp({
    id: 'maps',
    name: 'Maps',
    icon: {
      bg: 'linear-gradient(180deg,#F7F4EA,#ECE7D8)',
      glyph: `<svg viewBox="0 0 60 60">
        <path d="M0 0h27L0 31z" fill="#B7E2A0"/>
        <path d="M60 60H29l31-27z" fill="#9CD0F8"/>
        <path d="M60 0v9L47 0z" fill="#F6C9D2"/>
        <path d="M-4 45 64 7" stroke="#F2B21C" stroke-width="10.5"/>
        <path d="M-4 45 64 7" stroke="#FFD451" stroke-width="8"/>
        <path d="M13-4 41 64" stroke="#fff" stroke-width="6"/>
        <path d="M-4 17 64 52" stroke="#fff" stroke-width="4"/>
        <path d="M13-4 41 64" stroke="#D9D4C4" stroke-width=".8" stroke-dasharray="3 3"/>
        <circle cx="39" cy="23" r="13" fill="#fff"/>
        <circle cx="39" cy="23" r="11" fill="#0A7CFF"/>
        <path d="M45.4 16.4 33.2 21.9l5.3 1.7 1.7 5.3z" fill="#fff"/>
      </svg>`,
    },
    system: true,
    statusBar: 'auto',
    background: '#EDEBE4',
    launch(ctx) { instance = createApp(ctx); },
    onResume(ctx, params) { if (instance) instance.resume(params); },
    onPause() { if (instance) instance.pause(); },
    onClose() { if (instance) { instance.destroy(); instance = null; } },
  });
})();
