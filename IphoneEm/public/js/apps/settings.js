// Settings — every switch here drives the real emulator state (OS.settings)
(function () {
  const { el, esc } = OS.util;
  const S = OS.settings;
  const ic = (path, extra = '') => `<svg viewBox="0 0 24 24" ${extra}>${path}</svg>`;
  const strip = (svg) => svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const IC = {
    airplane: strip(OS.icons.airplane), wifi: strip(OS.icons.wifi), bt: strip(OS.icons.bluetooth), cell: strip(OS.icons.cellular), battery: strip(OS.icons.battery),
    gear: '<path d="M12 8.200a3.800 3.800 0 1 0 0 7.600 3.800 3.800 0 0 0 0-7.600zm9.200 5.300-1.900-.4a7.500 7.500 0 0 1-.7 1.700l1.100 1.600-1.900 1.900-1.600-1.100c-.5.300-1.100.500-1.700.7l-.4 1.900h-2.600l-.4-1.900a7.500 7.500 0 0 1-1.700-.7l-1.600 1.100-1.900-1.900 1.100-1.600a7.500 7.500 0 0 1-.7-1.700l-1.900-.4v-2.600l1.900-.4c.2-.6.400-1.200.7-1.700L4.500 6.600l1.900-1.900L8 5.800c.5-.3 1.100-.5 1.700-.7l.4-1.900h2.600l.4 1.900c.6.2 1.200.4 1.700.7l1.600-1.100 1.900 1.900-1.100 1.600c.3.5.5 1.100.7 1.700l1.900.4z" fill-rule="evenodd"/>',
    sun: strip(OS.icons.sun), bell: strip(OS.icons.bell), moon: strip(OS.icons.moon), speaker: strip(OS.icons.speaker),
    faceid: '<g fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"><path d="M3.500 8V6A2.500 2.500 0 0 1 6 3.500h2M16 3.500h2A2.500 2.500 0 0 1 20.500 6v2M20.500 16v2a2.500 2.500 0 0 1-2.500 2.500h-2M8 20.500H6A2.500 2.500 0 0 1 3.500 18v-2M8.500 9v2M15.500 9v2M12 9v4h-1M8.700 15.500c1.900 1.700 4.700 1.700 6.600 0"/></g>',
    flower: '<g><circle cx="12" cy="6.500" r="3.200"/><circle cx="12" cy="17.500" r="3.200"/><circle cx="6.500" cy="12" r="3.200"/><circle cx="17.500" cy="12" r="3.200"/></g>',
    siri: '<circle cx="12" cy="12" r="8.500" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.500 12c1.500-4 3-4 4.500 0s3 4 4.500 0" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/>',
    hand: '<path d="M12 2.500a9.500 9.500 0 1 0 0 19 9.500 9.500 0 0 0 0-19zm0 3a1.600 1.600 0 1 1 0 3.200 1.600 1.600 0 0 1 0-3.200zm4.500 5-3 .700v2.300l1.500 4.700-1.400.500L12 14.500l-1.600 4.200-1.400-.500 1.500-4.700v-2.300l-3-.700.300-1.400 4.200.800 4.200-.800z" fill-rule="evenodd"/>',
    phone: '<rect x="6.500" y="2" width="11" height="20" rx="2.800" fill="none" stroke="currentColor" stroke-width="1.900"/><path d="M10.500 4.700h3" stroke="currentColor" stroke-width="1.600" stroke-linecap="round"/>',
    grid: '<rect x="3.500" y="3.500" width="7" height="7" rx="2"/><rect x="13.500" y="3.500" width="7" height="7" rx="2"/><rect x="3.500" y="13.500" width="7" height="7" rx="2"/><rect x="13.500" y="13.500" width="7" height="7" rx="2"/>',
    lockp: '<rect x="5" y="10.500" width="14" height="10.500" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" fill="none" stroke="currentColor" stroke-width="2"/>',
  };
  const rowIcon = (key, bg) => `<span class="ios-row-icon" style="background:${bg}">${ic(IC[key])}</span>`;

  OS.addStyle('settings', `
    .app-settings .st-profile{display:flex;align-items:center;gap:14px;padding:10px 16px;min-height:80px}
    .app-settings .st-profile b{display:block;font-size:20px;font-weight:400;letter-spacing:.2px}.app-settings .st-profile small{font-size:13px;color:var(--label2);letter-spacing:-.08px}
    .app-settings .st-slider{gap:12px;color:var(--label2)} .app-settings .st-slider svg{width:20px;height:20px;fill:currentColor;flex:none}
    .app-settings .st-appear{display:flex;justify-content:space-around;padding:18px 0 12px}.app-settings .st-appear div{text-align:center;font-size:15px;cursor:pointer}
    .app-settings .st-appear i{display:block;width:64px;height:132px;border-radius:12px;margin:0 auto 8px;border:1px solid var(--sep);position:relative;overflow:hidden}
    .app-settings .st-appear i::after{content:'9:41';position:absolute;left:0;right:0;top:22px;font:600 15px -apple-system;font-style:normal;color:#fff;text-align:center}
    .app-settings .st-appear u{display:block;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--label3);margin:8px auto 0;text-decoration:none}
    .app-settings .st-appear .on u{background:var(--tint);border-color:var(--tint);box-shadow:inset 0 0 0 4px var(--tint);background:#fff;border:6px solid var(--tint)}
    .app-settings .st-wp{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:4px 20px 20px}.app-settings .st-wp div{aspect-ratio:402/874;border-radius:16px;position:relative;overflow:hidden;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.15);transition:transform .2s var(--ease)}
    .app-settings .st-wp div:active{transform:scale(.95)} .app-settings .st-wp div.on{outline:3px solid var(--tint);outline-offset:2px}
    .app-settings .st-storage{height:22px;border-radius:6px;overflow:hidden;display:flex;background:var(--fill2);margin:10px 0 8px}.app-settings .st-storage i{display:block;height:100%}
    .app-settings .st-about-hero{text-align:center;padding:10px 0 22px}.app-settings .st-about-hero div{font-size:54px;line-height:1}
    .app-settings .st-spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--label3);border-top-color:var(--label2);animation:stspin .8s linear infinite}@keyframes stspin{to{transform:rotate(360deg)}}
    .app-settings .st-batt{display:flex;align-items:flex-end;gap:3px;height:90px;padding:6px 0}.app-settings .st-batt i{flex:1;background:var(--green);border-radius:2px 2px 0 0;min-height:3px}
    .app-settings .st-colors{display:flex;gap:14px;padding:14px 16px;flex-wrap:wrap}.app-settings .st-colors span{width:38px;height:38px;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px var(--sep)}.app-settings .st-colors span.on{outline:3px solid var(--tint);outline-offset:2px}
  `);

  let nav, preview = null;
  const stopPreview = () => { if (preview) { preview.stop(); preview = null; } };

  // ── declarative list builder ──
  function list(body, items, header, footer) {
    if (header) body.appendChild(el(`<div class="ios-list-header">${esc(header)}</div>`));
    const box = el('<div class="ios-list"></div>'); if (!header && body.lastElementChild) box.style.marginTop = '35px';
    items.filter(Boolean).forEach((it) => box.appendChild(row(it)));
    body.appendChild(box);
    if (footer) body.appendChild(el(`<div class="ios-list-footer">${esc(footer)}</div>`));
    return box;
  }
  function row(it) {
    if (it.node) return it.node;
    const r = el(`<div class="ios-row ${it.onTap || it.page ? 'tappable' : ''}">${it.icon ? rowIcon(it.icon[0], it.icon[1]) : ''}<span class="ios-row-label" style="${it.color ? 'color:' + it.color : ''}${it.center ? ';text-align:center' : ''}">${esc(it.label)}${it.sub ? `<span class="ios-row-sub">${esc(it.sub)}</span>` : ''}</span></div>`);
    if (it.setting) {
      const sw = el(`<label class="ios-switch"><input type="checkbox" ${S.get(it.setting) ? 'checked' : ''}><i></i></label>`);
      const inp = sw.querySelector('input'); inp.addEventListener('change', () => { S.set(it.setting, inp.checked); OS.haptic('light'); it.onChange && it.onChange(inp.checked); });
      OS.on('setting:' + it.setting, (v) => { inp.checked = !!v; }); r.appendChild(sw);
    } else {
      if (it.value != null) { const v = el(`<span class="ios-row-value"></span>`); const upd = () => { v.textContent = typeof it.value === 'function' ? it.value() : it.value; }; upd(); if (it.watch) [].concat(it.watch).forEach((k) => OS.on('setting:' + k, upd)); r.appendChild(v); }
      if (it.checked) r.classList.add('check');
      if (it.page || it.chevron) r.appendChild(el('<span class="ios-chevron"></span>'));
    }
    if (it.page) r.addEventListener('click', () => nav.push(it.page()));
    else if (it.onTap) r.addEventListener('click', () => it.onTap(r));
    return r;
  }
  function sliderRow(key, leftIcon, rightIcon, onInput, min = 0) {
    const r = el(`<div class="ios-row st-slider">${ic(leftIcon, 'style="transform:scale(.8)"')}<input type="range" class="ios-slider" min="${min}" max="1" step=".01" value="${S.get(key)}">${ic(rightIcon)}</div>`);
    const inp = r.querySelector('input'); const paint = () => inp.style.setProperty('--v', ((inp.value - min) / (1 - min)) * 100 + '%'); paint();
    inp.addEventListener('input', () => { S.set(key, +inp.value); paint(); onInput && onInput(+inp.value); });
    OS.on('setting:' + key, (v) => { inp.value = v; paint(); });
    return { node: r };
  }
  const page = (title, render, extra = {}) => ({ title, background: 'var(--bg2)', render(body, pg) { body.style.paddingTop = ''; body.appendChild(el('<div style="height:12px"></div>')); render(body, pg); body.appendChild(el('<div style="height:40px"></div>')); }, ...extra });

  // ── pages ──
  const NETWORKS = ['Home Wi-Fi 5G', 'Kuhn Labs', 'PixelForge Guest', 'Library-Public', 'xfinitywifi', 'NETGEAR42'];
  const wifiPage = () => page('Wi-Fi', (body) => {
    const draw = () => {
      body.querySelectorAll('.dyn').forEach((n) => n.remove()); if (!S.get('wifi')) return;
      const cur = OS.store.get('settings.wifiName', NETWORKS[0]); const wrap = el('<div class="dyn"></div>');
      list(wrap, [{ label: cur, checked: true, sub: 'Privacy Warning'.slice(0, 0) }]);
      list(wrap, NETWORKS.filter((n) => n !== cur).map((n) => ({ label: n, value: '🔒', onTap: async (r) => { r.querySelector('.ios-row-value').innerHTML = '<div class="st-spin"></div>'; await OS.util.wait(1100); OS.store.set('settings.wifiName', n); OS.haptic('success'); draw(); } })), 'Networks');
      body.insertBefore(wrap, body.lastElementChild);
    };
    list(body, [{ label: 'Wi-Fi', setting: 'wifi', onChange: draw }]); draw();
  });
  const btPage = () => page('Bluetooth', (body) => {
    list(body, [{ label: 'Bluetooth', setting: 'bluetooth', onChange: () => draw() }], null, `This iPhone is discoverable as “${S.get('deviceName')}” while Bluetooth Settings is open.`);
    const wrap = el('<div></div>'); body.appendChild(wrap);
    const draw = () => { wrap.innerHTML = ''; if (!S.get('bluetooth')) return; list(wrap, [{ label: `${S.get('ownerName')}’s AirPods Pro`, value: 'Connected', chevron: true }, { label: 'Xbox Wireless Controller', value: 'Not Connected' }, { label: 'Kitchen Speaker', value: 'Not Connected' }], 'My Devices'); };
    draw();
  });
  const batteryPage = () => page('Battery', (body) => {
    list(body, [{ label: 'Battery Percentage', setting: 'batteryPercent' }, { label: 'Low Power Mode', setting: 'lowPower' }], null, 'Low Power Mode temporarily reduces background activity like downloads and mail fetch until you can fully charge your iPhone.');
    list(body, [{ label: 'Battery Health', value: 'Normal', chevron: true }, { label: 'Maximum Capacity', value: '100%' }, { label: 'Charging', value: () => (OS.power.charging ? 'Charging' : 'Not Charging') }]);
    const lvl = Math.round(OS.power.level * 100); const bars = Array.from({ length: 24 }, (_, i) => Math.max(8, Math.min(100, lvl + (23 - i) * 2.2 + Math.sin(i * 1.3) * 9)));
    list(body, [{ node: el(`<div class="ios-row" style="display:block"><div style="font-size:13px;color:var(--label2)">BATTERY LEVEL · LAST 24 HOURS</div><div class="st-batt">${bars.map((b) => `<i style="height:${b}%"></i>`).join('')}</div></div>`) }]);
  });
  const aboutPage = () => page('About', (body) => {
    list(body, [{ label: 'Name', value: () => S.get('deviceName'), watch: 'deviceName', chevron: true, onTap: async () => { const v = await OS.ui.prompt({ title: 'Name', value: S.get('deviceName') }); if (v) S.set('deviceName', v); } }, { label: 'iOS Version', value: '26.0' }, { label: 'Model Name', value: 'iPhone 17' }, { label: 'Model Number', value: 'MG6K4LL/A' }, { label: 'Serial Number', value: 'F17EMU' + (OS.store.get('settings.serial') || (OS.store.set('settings.serial', Math.random().toString(36).slice(2, 8).toUpperCase()), OS.store.get('settings.serial'))) }]);
    list(body, [{ label: 'Songs', value: '0' }, { label: 'Photos', value: '…', }, { label: 'Applications', value: String(OS.apps.filter((a) => OS.isInstalled(a.id)).length) }, { label: 'Capacity', value: '256 GB' }, { label: 'Available', value: '201.4 GB' }]);
    OS.photos.all().then((p) => { const v = body.querySelectorAll('.ios-list')[1].querySelectorAll('.ios-row-value')[1]; if (v) v.textContent = String(p.length); });
    list(body, [{ label: 'Wi-Fi Address', value: '3C:17:0E:4A:91:F2' }, { label: 'Bluetooth', value: '3C:17:0E:4A:91:F3' }, { label: 'Chip', value: 'A19' }]);
  });
  const updatePage = () => page('Software Update', (body) => {
    const box = el('<div style="text-align:center;padding:80px 40px;color:var(--label2)"><div class="st-spin" style="margin:0 auto 14px;width:26px;height:26px"></div>Checking for Update…</div>'); body.appendChild(box);
    setTimeout(() => { box.innerHTML = '<div style="font-size:22px;color:var(--label);font-weight:600;margin-bottom:6px">iOS 26.0</div>iOS is up to date'; }, 1600);
  });
  const storagePage = () => page('iPhone Storage', (body) => {
    const apps = OS.apps.filter((a) => OS.isInstalled(a.id)); const sizes = apps.map((a, i) => ({ a, mb: Math.round(40 + ((a.id.length * 97 + i * 53) % 900)) })).sort((x, y) => y.mb - x.mb);
    list(body, [{ node: el(`<div class="ios-row" style="display:block;padding:12px 16px"><div style="display:flex;justify-content:space-between"><b style="font-weight:600">iPhone</b><span style="color:var(--label2)">54.6 GB of 256 GB Used</span></div><div class="st-storage"><i style="width:9%;background:var(--red)"></i><i style="width:6%;background:var(--yellow)"></i><i style="width:4%;background:var(--green)"></i><i style="width:2.500%;background:var(--purple)"></i></div><div style="font-size:12px;color:var(--label2);display:flex;gap:12px"><span>● Apps</span><span>● Photos</span><span>● iOS</span><span>● System Data</span></div></div>`) }]);
    list(body, sizes.map(({ a, mb }) => ({ node: (() => { const r = el(`<div class="ios-row">${OS.iconHTML(a)}<span class="ios-row-label">${esc(a.name)}</span><span class="ios-row-value">${mb > 999 ? (mb / 1000).toFixed(2) + ' GB' : mb + ' MB'}</span></div>`); const i = r.querySelector('.icon-img'); i.style.cssText += ';width:29px;height:29px;border-radius:7px;font-size:15px;flex:none;position:relative'; return r; })() })));
  });
  const resetPage = () => page('Transfer or Reset iPhone', (body) => {
    list(body, [{ label: 'Reset Home Screen Layout', color: 'var(--tint)', onTap: async () => { const i = await OS.ui.actionSheet({ message: 'This will reset your Home Screen layout to factory defaults.', buttons: [{ label: 'Reset Home Screen', style: 'destructive' }] }); if (i === 0) { OS.home.resetLayout(); OS.ui.toast('Home Screen Reset'); } } }]);
    list(body, [{ label: 'Erase All Content and Settings', color: 'var(--tint)', onTap: async () => { const i = await OS.ui.actionSheet({ message: 'This will delete all media, data, downloaded apps, and reset all settings on this emulated iPhone.', buttons: [{ label: 'Erase iPhone', style: 'destructive' }] }); if (i === 0) { OS.store.eraseAll(); setTimeout(() => location.reload(), 300); } } }]);
  });
  const generalPage = () => page('General', (body) => {
    list(body, [{ label: 'About', page: aboutPage }, { label: 'Software Update', page: updatePage }]);
    list(body, [{ label: 'iPhone Storage', page: storagePage }]);
    list(body, [{ label: '24-Hour Time', setting: 'use24h' }], 'Date & Time');
    list(body, [{ label: 'Keyboard Clicks', setting: 'keyboardClicks' }], 'Keyboard');
    list(body, [{ label: 'Transfer or Reset iPhone', page: resetPage }]);
    list(body, [{ label: 'Shut Down', color: 'var(--tint)', onTap: () => OS.showPowerOff() }]);
  });
  const AUTOLOCK = [[30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [0, 'Never']];
  const pickerPage = (title, options, get, set) => () => page(title, (body) => { const draw = () => { body.querySelectorAll('.ios-list').forEach((n) => n.remove()); const b = list(body, options.map(([v, l]) => ({ label: l, checked: get() === v, onTap: () => { set(v); OS.haptic('selection'); draw(); } }))); body.insertBefore(b, body.lastElementChild); }; draw(); });
  const displayPage = () => page('Display & Brightness', (body) => {
    const ap = el(`<div class="ios-row" style="display:block;padding:0"><div class="st-appear"><div data-m="light"><i style="background:linear-gradient(180deg,#5b8def,#e86fb0)"></i>Light<u></u></div><div data-m="dark"><i style="background:linear-gradient(180deg,#0b1024,#0e4a55)"></i>Dark<u></u></div></div></div>`);
    const sync = () => ap.querySelectorAll('[data-m]').forEach((d) => d.classList.toggle('on', (d.dataset.m === 'dark') === !!S.get('darkMode'))); sync();
    ap.querySelectorAll('[data-m]').forEach((d) => d.addEventListener('click', () => { S.set('darkMode', d.dataset.m === 'dark'); OS.haptic('light'); sync(); })); OS.on('setting:darkMode', sync);
    list(body, [{ node: ap }], 'Appearance');
    list(body, [sliderRow('brightness', IC.sun, IC.sun, null, .08), { label: 'True Tone', setting: 'trueTone' }], 'Brightness');
    list(body, [{ label: 'Night Shift', value: 'Off', chevron: true }]);
    list(body, [{ label: 'Auto-Lock', value: () => (AUTOLOCK.find((a) => a[0] === S.get('autoLock')) || AUTOLOCK[2])[1], watch: 'autoLock', page: pickerPage('Auto-Lock', AUTOLOCK, () => S.get('autoLock'), (v) => S.set('autoLock', v)) }, { label: 'Always On Display', setting: 'alwaysOn' }], null, 'Always On Display dims the Lock Screen while keeping the time and notifications visible.');
  });
  const WALLS = [['aurora', 'Aurora'], ['sunrise', 'Sunrise'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['candy', 'Candy'], ['ember', 'Ember'], ['graphite', 'Graphite']];
  const wallpaperPage = () => page('Wallpaper', (body) => {
    body.appendChild(el('<div class="ios-list-header">Choose a wallpaper</div>'));
    const grid = el('<div class="st-wp"></div>');
    const draw = async () => {
      grid.innerHTML = ''; const cur = S.get('wallpaper');
      WALLS.forEach(([id]) => { const d = el(`<div class="wp-${id} ${cur === id ? 'on' : ''}"></div>`); d.addEventListener('click', () => { S.set('wallpaper', id); OS.haptic('light'); draw(); }); grid.appendChild(d); });
      const photos = (await OS.photos.all()).filter((p) => p.kind !== 'video').slice(-8).reverse();
      photos.forEach((p) => { const d = el(`<div class="${cur === 'photo:' + p.id ? 'on' : ''}" style="background:url(${p.src}) center/cover"></div>`); d.addEventListener('click', () => { S.set('wallpaper', 'photo:' + p.id); OS.haptic('light'); draw(); }); grid.appendChild(d); });
    };
    draw(); body.appendChild(grid); body.appendChild(el('<div class="ios-list-footer">Your own photos from the Photos app show up here too.</div>'));
  });
  const tonePage = (title, prefix, key) => () => page(title, (body) => {
    const host = el('<div></div>'); body.appendChild(host);
    OS.sound.list().then((ids) => {
      let names = ids.filter((i) => i.startsWith(prefix)).map((i) => i.slice(prefix.length));
      if (!names.length) names = prefix === 'ringtone:' ? ['Reflection', 'Opening', 'Marimba', 'Radar'] : ['Note', 'Tri-Tone', 'Chord', 'Rebound'];
      const first = prefix === 'ringtone:' ? 'Reflection' : key === 'alertTone' ? 'Rebound' : 'Note'; names.sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
      const draw = () => { host.innerHTML = ''; list(host, names.map((n) => ({ label: n + (n === first ? ' (Default)' : ''), checked: S.get(key) === prefix + n, onTap: () => { S.set(key, prefix + n); stopPreview(); preview = OS.sound.play(prefix + n, { category: 'ringer' }); draw(); } })), prefix === 'ringtone:' ? 'Ringtones' : 'Alert Tones'); };
      draw();
    });
  }, { onHide: stopPreview });
  const soundsPage = () => page('Sounds & Haptics', (body) => {
    list(body, [{ label: 'Silent Mode', icon: ['bell', 'var(--red)'], setting: 'silent' }], null, 'The Action button on the left side of the iPhone toggles this too.');
    let t = 0;
    list(body, [sliderRow('ringerVolume', IC.speaker, IC.speaker, () => { clearTimeout(t); t = setTimeout(() => { stopPreview(); preview = OS.sound.play(OS.sound.ringtone(), { category: 'ringer' }); setTimeout(stopPreview, 2600); }, 250); })], 'Ringtone and Alerts');
    const short = (k) => () => String(S.get(k)).split(':')[1] || '';
    list(body, [{ label: 'Ringtone', value: short('ringtone'), watch: 'ringtone', page: tonePage('Ringtone', 'ringtone:', 'ringtone') }, { label: 'Text Tone', value: short('textTone'), watch: 'textTone', page: tonePage('Text Tone', 'tone:', 'textTone') }, { label: 'Default Alerts', value: short('alertTone'), watch: 'alertTone', page: tonePage('Default Alerts', 'tone:', 'alertTone') }]);
    list(body, [{ label: 'Keyboard Clicks', setting: 'keyboardClicks' }, { label: 'Lock Sound', setting: 'lockSound' }, { label: 'System Haptics', setting: 'haptics' }], null, 'These are the real iPhone sounds: tones, camera, messages and charger chimes are played from this Mac’s system audio; key clicks are your own recordings.');
  }, { onHide: stopPreview });
  const passcodePage = () => page('Face ID & Passcode', (body) => {
    const draw = () => {
      body.querySelectorAll('.dyn').forEach((n) => n.remove()); const wrap = el('<div class="dyn"></div>'); const has = !!S.get('passcode');
      list(wrap, [{ label: 'iPhone Unlock', setting: 'faceId' }], 'Use Face ID for', 'Face ID recognises you instantly in the emulator. Turn it off to be asked for the passcode every time.');
      const ask = async (title) => { const v = await OS.ui.prompt({ title, message: 'Enter 4 or 6 digits', type: 'password', placeholder: 'Passcode' }); if (v == null) return null; if (!/^\d{4}$|^\d{6}$/.test(v)) { OS.ui.alert({ title: 'Passcode must be 4 or 6 digits' }); return null; } return v; };
      list(wrap, [has ? { label: 'Turn Passcode Off', color: 'var(--tint)', onTap: async () => { const v = await OS.ui.prompt({ title: 'Enter Your Passcode', type: 'password' }); if (v === S.get('passcode')) { S.set('passcode', ''); draw(); } else if (v != null) { OS.haptic('error'); OS.ui.alert({ title: 'Incorrect Passcode' }); } } } : { label: 'Turn Passcode On', color: 'var(--tint)', onTap: async () => { const v = await ask('Set a Passcode'); if (v) { S.set('passcode', v); OS.haptic('success'); draw(); } } },
        has ? { label: 'Change Passcode', color: 'var(--tint)', onTap: async () => { const v = await ask('New Passcode'); if (v) { S.set('passcode', v); OS.ui.toast('Passcode Changed'); } } } : null]);
      body.insertBefore(wrap, body.lastElementChild);
    };
    draw();
  });
  const siriPage = () => page('Siri', (body) => {
    list(body, [{ label: 'Voice Feedback', setting: 'siriVoice' }], 'Siri Responses', 'Hold the side button to talk or type to Siri. Timers, alarms, settings, calls and app launching work on‑device; everything else is answered by Claude through the emulator’s server.');
    list(body, [{ label: 'Try “Set a timer for 5 minutes”', onTap: () => { OS.siri.open(); setTimeout(() => OS.siri.ask('Set a timer for 5 minutes'), 600); } }, { label: 'Try “Turn on Dark Mode”', onTap: () => { OS.siri.open(); setTimeout(() => OS.siri.ask('Turn on dark mode'), 600); } }]);
  });
  const FIN = [['lavender', '#cfc3e6'], ['sage', '#c3cdb0'], ['mist', '#b9cbe2'], ['white', '#efefec'], ['black', '#3a3b40']];
  const CASES = [['', 'transparent'], ['clear', '#e9e9ee'], ['midnight', '#1f222b'], ['clay', '#b97a5c'], ['lake', '#3f7396'], ['forest', '#445d4a'], ['pink', '#e8a3b8']];
  const devicePage = () => page('Finish & Case', (body) => {
    const mk = (title, opts, key) => { body.appendChild(el(`<div class="ios-list-header">${title}</div>`)); const b = el('<div class="ios-list"><div class="st-colors"></div></div>'); const h = b.firstElementChild; const draw = () => { h.innerHTML = ''; opts.forEach(([id, c]) => { const s = el(`<span class="${S.get(key) === id ? 'on' : ''}" style="background:${c}" title="${id || 'None'}">${id ? '' : '<svg viewBox="0 0 38 38"><path d="M8 30L30 8" stroke="#8e8e93" stroke-width="2"/></svg>'}</span>`); s.addEventListener('click', () => { S.set(key, id); OS.haptic('light'); draw(); }); h.appendChild(s); }); }; draw(); body.appendChild(b); };
    mk('Finish', FIN, 'color'); mk('Case', CASES, 'caseColor');
    body.appendChild(el('<div class="ios-list-footer">Use the Flip button beside the phone to see the back.</div>'));
  });
  const profilePage = () => page('Apple Account', (body) => {
    body.appendChild(el(`<div class="st-about-hero">${OS.contacts.avatar({ first: S.get('ownerName'), color: '#8E8E93' }, 96)}<div style="font-size:26px;font-weight:600;margin-top:10px">${esc(S.get('ownerName'))}</div></div>`));
    list(body, [{ label: 'Name', value: () => S.get('ownerName'), watch: 'ownerName', chevron: true, onTap: async () => { const v = await OS.ui.prompt({ title: 'Your Name', value: S.get('ownerName') }); if (v) { S.set('ownerName', v.trim()); S.set('deviceName', v.trim() + '’s iPhone'); } } }]);
    list(body, [{ label: 'iCloud', value: '5 GB', chevron: true }, { label: 'Media & Purchases', chevron: true, onTap: () => OS.openApp('appstore') }]);
  });

  function root() {
    return { title: 'Settings', largeTitle: true, background: 'var(--bg2)', search: { placeholder: 'Search', onInput(q, pg) { q = q.toLowerCase(); pg.body.querySelectorAll('.ios-row').forEach((r) => { r.style.display = !q || r.textContent.toLowerCase().includes(q) ? '' : 'none'; }); } },
      render(body) {
        const prof = el(`<div class="ios-row tappable st-profile">${OS.contacts.avatar({ first: S.get('ownerName'), color: '#8E8E93' }, 60)}<div style="flex:1"><b class="pn">${esc(S.get('ownerName'))}</b><small>Apple Account, iCloud+, and more</small></div><span class="ios-chevron"></span></div>`);
        prof.addEventListener('click', () => nav.push(profilePage())); OS.on('setting:ownerName', (v) => { prof.querySelector('.pn').textContent = v; });
        list(body, [{ node: prof }]);
        list(body, [{ label: 'Airplane Mode', icon: ['airplane', 'var(--orange)'], setting: 'airplane' }, { label: 'Wi-Fi', icon: ['wifi', 'var(--tint)'], value: () => (S.get('wifi') ? OS.store.get('settings.wifiName', NETWORKS[0]) : 'Off'), watch: 'wifi', page: wifiPage }, { label: 'Bluetooth', icon: ['bt', 'var(--tint)'], value: () => (S.get('bluetooth') ? 'On' : 'Off'), watch: 'bluetooth', page: btPage }, { label: 'Cellular', icon: ['cell', 'var(--green)'], setting: 'cellular' }, { label: 'Battery', icon: ['battery', 'var(--green)'], page: batteryPage }]);
        list(body, [{ label: 'General', icon: ['gear', 'var(--gray)'], page: generalPage }, { label: 'Display & Brightness', icon: ['sun', 'var(--tint)'], page: displayPage }, { label: 'Wallpaper', icon: ['flower', 'var(--cyan)'], page: wallpaperPage }, { label: 'Finish & Case', icon: ['phone', 'var(--indigo)'], page: devicePage }, { label: 'Siri', icon: ['siri', 'linear-gradient(135deg,#ff5e8a,#a66bff,#4ab8ff)'], page: siriPage }]);
        list(body, [{ label: 'Sounds & Haptics', icon: ['speaker', 'var(--pink)'], page: soundsPage }, { label: 'Do Not Disturb', icon: ['moon', 'var(--indigo)'], setting: 'focus' }]);
        list(body, [{ label: 'Face ID & Passcode', icon: ['faceid', 'var(--green)'], page: passcodePage }]);
        list(body, [{ label: 'App Store', icon: ['grid', 'var(--tint)'], chevron: true, onTap: () => OS.openApp('appstore') }]);
      } };
  }

  OS.registerApp({
    id: 'settings', name: 'Settings', system: true, statusBar: 'auto', background: 'var(--bg2)',
    icon: { bg: 'linear-gradient(180deg,#b4b4b9,#7d7d83)', glyph: `<svg viewBox="0 0 60 60"><g fill="none" stroke="#e9e9ec" stroke-width="2.200"><circle cx="30" cy="30" r="19"/><circle cx="30" cy="30" r="6.500"/></g><g stroke="#e9e9ec" stroke-width="3.200" stroke-linecap="butt">${Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<path d="M${30 + Math.cos(a) * 19} ${30 + Math.sin(a) * 19}L${30 + Math.cos(a) * 24} ${30 + Math.sin(a) * 24}"/>`; }).join('')}</g><g stroke="#e9e9ec" stroke-width="1.800">${[0, 120, 240].map((d) => { const a = (d * Math.PI) / 180; return `<path d="M${30 + Math.cos(a) * 6.500} ${30 + Math.sin(a) * 6.500}L${30 + Math.cos(a) * 18} ${30 + Math.sin(a) * 18}"/>`; }).join('')}</g></svg>` },
    launch(ctx) { nav = OS.ui.createNav(ctx.root); nav.push(root()); },
    onResume(ctx, params) { if (params && params.page === 'sounds') { nav.popToRoot(false); nav.push(soundsPage()); } },
    onPause() { stopPreview(); },
  });
})();
