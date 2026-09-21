// Start-up: core services → load every app script in /js/apps → installed web apps → Home Screen → boot logo → Lock Screen
(async function () {
  OS.screen = document.getElementById('screen');
  const boot = document.getElementById('boot');
  boot.innerHTML = '<span style="font-family:system-ui,-apple-system,sans-serif">\uF8FF</span>'; boot.classList.add('on');

  OS.initDevice(); OS.initCore(); OS.initKeyboard(); OS.initIsland(); OS.initOverlays(); OS.initLock(); OS.initSiri();

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
