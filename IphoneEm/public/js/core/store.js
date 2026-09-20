// Persistence: OS.store (localStorage JSON), OS.settings, OS.db (IndexedDB), OS.contacts, OS.photos
(function () {
  const PREFIX = 'ip17:';
  const watchers = {};
  const mem = {};
  let lsOK = true;
  try { localStorage.setItem(PREFIX + '_t', '1'); localStorage.removeItem(PREFIX + '_t'); } catch { lsOK = false; }

  OS.store = {
    get(key, fallback) {
      try {
        const raw = lsOK ? localStorage.getItem(PREFIX + key) : mem[key];
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try { if (lsOK) localStorage.setItem(PREFIX + key, raw); else mem[key] = raw; } catch (e) { mem[key] = raw; console.warn('store full?', e); }
      (watchers[key] || []).slice().forEach((fn) => { try { fn(value); } catch (e) { console.error(e); } });
    },
    remove(key) { try { if (lsOK) localStorage.removeItem(PREFIX + key); delete mem[key]; } catch {} (watchers[key] || []).forEach((fn) => fn(undefined)); },
    on(key, fn) { (watchers[key] = watchers[key] || []).push(fn); },
    keys(prefix = '') { const out = []; if (lsOK) for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length)); } return out; },
    eraseAll() { OS.store.keys().forEach((k) => localStorage.removeItem(PREFIX + k)); try { indexedDB.deleteDatabase('iphone17'); } catch {} },
  };

  // ── settings ──
  const DEFAULTS = {
    darkMode: false, autoTheme: false, brightness: 1, volume: 0.6, ringerVolume: 0.7, silent: false,
    wifi: true, bluetooth: true, airplane: false, cellular: true, focus: false, rotationLock: true, lowPower: false,
    use24h: false, ownerName: 'Colton', deviceName: 'Colton’s iPhone', wallpaper: 'aurora',
    keyboardClicks: true, lockSound: true, haptics: true, ringtone: 'ringtone:Reflection', textTone: 'tone:Note', alertTone: 'tone:Rebound',
    alwaysOn: true, autoLock: 120, passcode: '', faceId: true, siriVoice: true, color: 'lavender', caseColor: '',
    trueTone: true, nightShift: false, textSize: 3, boldText: false, batteryPercent: true,
  };
  let cache = OS.store.get('settings', {});
  OS.settings = {
    defaults: DEFAULTS,
    get(name) { return name in cache ? cache[name] : DEFAULTS[name]; },
    set(name, value) {
      if (OS.settings.get(name) === value) return;
      cache[name] = value; OS.store.set('settings', cache);
      OS.emit('setting:' + name, value); OS.emit('setting', name, value);
    },
    all() { return { ...DEFAULTS, ...cache }; },
  };

  // ── IndexedDB ──
  const STORES = ['photos', 'recordings', 'files', 'blobs'];
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open('iphone17', 2); } catch (e) { return reject(e); }
      req.onupgradeneeded = () => { const d = req.result; STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  const tx = (store, mode, fn) => db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode); const os = t.objectStore(store); const r = fn(os);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  }));
  const memdb = {};
  const fall = (store) => (memdb[store] = memdb[store] || new Map());
  OS.db = {
    put(store, obj) { if (!obj.id) obj.id = OS.util.uid(); return tx(store, 'readwrite', (os) => os.put(obj)).then(() => obj.id).catch(() => { fall(store).set(obj.id, obj); return obj.id; }); },
    get(store, id) { return tx(store, 'readonly', (os) => os.get(id)).catch(() => fall(store).get(id)); },
    all(store) { return tx(store, 'readonly', (os) => os.getAll()).then((a) => a || []).catch(() => [...fall(store).values()]); },
    del(store, id) { return tx(store, 'readwrite', (os) => os.delete(id)).catch(() => { fall(store).delete(id); }); },
  };

  // ── photos ──
  OS.photos = {
    async add({ src, kind = 'photo', date, meta }) {
      if (src instanceof Blob) src = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(src); });
      const item = { id: OS.util.uid(), src, kind, date: date || Date.now(), favorite: false, meta: meta || null };
      await OS.db.put('photos', item); OS.emit('photos:change'); return item;
    },
    async all() { const a = await OS.db.all('photos'); return a.sort((x, y) => x.date - y.date); },
    get(id) { return OS.db.get('photos', id); },
    async update(id, patch) { const p = await OS.db.get('photos', id); if (!p) return; Object.assign(p, patch); await OS.db.put('photos', p); OS.emit('photos:change'); return p; },
    async remove(id) { await OS.db.del('photos', id); OS.emit('photos:change'); },
  };

  // ── contacts ──
  const COLORS = ['#FF9500', '#34C759', '#5856D6', '#FF2D55', '#30B0C7', '#AF52DE', '#FF3B30', '#007AFF', '#A2845E', '#00C7BE'];
  const SEED = [
    ['Mom', '', '(555) 010-2210', 'mom@family.example', true, '❤️'],    ['Grandma', 'Rose', '(555) 010-3300', 'rose@family.example', true],
    ['Alex', 'Rivera', '(555) 014-7781', 'alex.rivera@mail.example', false], ['Bailey', 'Chen', '(555) 012-9034', 'bailey.c@mail.example', false],
    ['Coach', 'Daniels', '(555) 015-4420', 'coach.daniels@school.example', false], ['Dylan', 'Brooks', '(555) 013-6612', 'dylanb@mail.example', false],
    ['Emma', 'Park', '(555) 016-1205', 'emma.park@mail.example', false], ['Jordan', 'Lee', '(555) 011-5567', 'jlee@mail.example', false],
    ['Maya', 'Patel', '(555) 017-8890', 'maya.p@mail.example', false], ['Mr.', 'Hoffman', '(555) 018-2043', 'hoffman@school.example', false],
    ['Noah', 'Kim', '(555) 019-3376', 'noahk@mail.example', false], ['Pixel Forge', 'Studio', '(555) 010-0042', 'hello@pixelforge.example', false],
    ['Pizza', 'Planet', '(555) 010-7492', 'orders@pizzaplanet.example', false], ['Zoe', 'Martinez', '(555) 014-9021', 'zoe.m@mail.example', false],
  ];
  function load() {
    let list = OS.store.get('contacts', null);
    if (!list) {
      list = SEED.map((s, i) => ({ id: 'c' + (i + 1), first: s[0], last: s[1], phone: s[2], email: s[3], favorite: !!s[4], emoji: s[5] || '', color: COLORS[i % COLORS.length] }));
      OS.store.set('contacts', list);
    }
    return list;
  }
  const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  OS.contacts = {
    all() { return load().slice().sort((a, b) => OS.contacts.name(a).localeCompare(OS.contacts.name(b))); },
    name(c) { return c ? [c.first, c.last].filter(Boolean).join(' ') || c.phone || 'No Name' : ''; },
    find(q) { if (q == null) return null; const d = digits(q); return load().find((c) => c.id === q || (d && digits(c.phone) === d)) || null; },
    add(c) { const list = load(); const n = { id: OS.util.uid(), first: '', last: '', phone: '', email: '', favorite: false, emoji: '', color: COLORS[list.length % COLORS.length], ...c }; list.push(n); OS.store.set('contacts', list); OS.emit('contacts:change'); return n; },
    update(id, patch) { const list = load(); const c = list.find((x) => x.id === id); if (c) { Object.assign(c, patch); OS.store.set('contacts', list); OS.emit('contacts:change'); } return c; },
    remove(id) { OS.store.set('contacts', load().filter((c) => c.id !== id)); OS.emit('contacts:change'); },
    initials(c) { const a = (c.first || '').trim(), b = (c.last || '').trim(); return ((a[0] || '') + (b[0] || '')).toUpperCase() || '#'; },
    avatar(c, size = 40) {
      c = c || {}; const col = c.color || '#8E8E93';
      const inner = c.emoji ? `<span style="font-size:${size * .52}px;line-height:1">${c.emoji}</span>` : OS.util.esc(OS.contacts.initials(c));
      return `<span class="avatar" style="display:inline-flex;align-items:center;justify-content:center;flex:none;width:${size}px;height:${size}px;border-radius:50%;` +
        `background:linear-gradient(180deg, color-mix(in srgb, ${col} 72%, #fff), ${col});color:#fff;font-weight:600;font-size:${size * .4}px;letter-spacing:0;font-family:-apple-system,'SF Pro Rounded',sans-serif">${inner}</span>`;
    },
  };
})();
