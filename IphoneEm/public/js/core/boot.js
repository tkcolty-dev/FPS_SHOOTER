// Start-up: core services → load every app script in /js/apps → installed web apps → Home Screen → boot logo → Lock Screen
(async function () {
  OS.screen = document.getElementById('screen');
  const boot = document.getElementById('boot');
  boot.innerHTML = '<span style="font-family:system-ui,-apple-system,sans-serif">\uF8FF</span>'; boot.classList.add('on');

  OS.initDevice(); OS.initCore(); OS.initKeyboard(); OS.initIsland(); OS.initOverlays(); OS.initLock(); OS.initSiri();

  // videos are no longer saved — clear out any the Camera recorded before
  if (!OS.store.get('cleanup.videos.v1')) {
    try { (await OS.photos.all()).filter((p) => p.kind === 'video').forEach((p) => OS.photos.remove(p.id)); } catch {}
    OS.store.set('cleanup.videos.v1', true);
  }
  // one-time cleanup: remove the made-up sample content older versions put on this phone
  if (!OS.store.get('cleanup.presets.v1')) {
    ['notes.items', 'notes.folders', 'reminders.items', 'reminders.lists', 'calendar.events', 'files.tree', 'maps.recents',
     'phone.recents', 'phone.voicemail', 'phone.seeded', 'phone.unseenMissed', 'mail.messages', 'mail.vips',
     'messages.threads', 'contacts', 'wallet.tx', 'voicememos.seeded', 'photos.seeded', 'badges'].forEach((k) => OS.store.remove(k));
    try {
      (await OS.photos.all()).filter((p) => p.meta && p.meta.seeded).forEach((p) => OS.photos.remove(p.id));
      (await OS.db.all('recordings')).filter((r) => ['Melody Idea','Note to Self','Rain on the Porch'].includes(r.name)).forEach((r) => OS.db.del('recordings', r.id));
    } catch {}
    OS.store.set('cleanup.presets.v1', true);
  }

  let scripts = [];
  try { scripts = await (await fetch('/api/app-scripts')).json(); } catch (e) { console.error('could not list apps', e); }
  await Promise.all(scripts.map((src, i) => new Promise((res) => {
    const s = document.createElement('script'); s.src = src; s.async = false;   // async=false keeps execution in list order
    s.onload = res; s.onerror = () => { console.error('failed to load', src); res(); };
    document.body.appendChild(s);
  })));
  OS.initWebApps();
  OS.initAccount();
  OS.initHome();

  OS.lock.locked = true; OS.lock.asleep = true;
  document.getElementById('lock').classList.add('on');
  setTimeout(() => { boot.classList.add('fade'); OS.lock.wake(); setTimeout(() => boot.classList.remove('on'), 650); }, 1300);
  OS.emit('ready');
})();
