// iPhone SDK — available inside App Store apps and App Maker apps (they run in an iframe).
// Talks to the emulator OS over postMessage. Safe to load outside the emulator (calls become no-ops).
(function () {
  if (window.iPhone) return;
  var inPhone = window.parent && window.parent !== window;
  var seq = 0, waiting = {}, pauseFns = [], resumeFns = [], themeFns = [];
  var theme = 'light';

  function send(msg) {
    if (!inPhone) return;
    msg.__iphone = true;
    try { window.parent.postMessage(msg, '*'); } catch (e) {}
  }
  function request(msg) {
    return new Promise(function (resolve) {
      if (!inPhone) return resolve(undefined);
      var id = ++seq;
      waiting[id] = resolve;
      msg.reqId = id;
      send(msg);
      setTimeout(function () { if (waiting[id]) { delete waiting[id]; resolve(undefined); } }, 4000);
    });
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.__iphoneHost) return;
    if (d.type === 'reply' && waiting[d.reqId]) { waiting[d.reqId](d.value); delete waiting[d.reqId]; }
    else if (d.type === 'pause') pauseFns.forEach(function (f) { try { f(); } catch (e) {} });
    else if (d.type === 'resume') resumeFns.forEach(function (f) { try { f(); } catch (e) {} });
    else if (d.type === 'theme') {
      theme = d.theme;
      document.documentElement.setAttribute('data-theme', theme);
      themeFns.forEach(function (f) { try { f(theme); } catch (e) {} });
    }
  });

  window.iPhone = {
    device: { model: 'iPhone 17', width: 402, height: 874 },
    safeArea: { top: 62, bottom: 34 },
    get theme() { return theme; },
    // 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'
    haptic: function (type) { send({ type: 'haptic', value: type || 'light' }); },
    // system sound id: 'key','pay','shutter','sent','received','lock','tone:Note','ringtone:Marimba', …
    sound: function (id) { send({ type: 'sound', value: id }); },
    notify: function (title, body) { send({ type: 'notify', title: String(title || ''), body: String(body || '') }); },
    // 'light' = white status bar text (dark backgrounds), 'dark' = black text (light backgrounds)
    setStatusBar: function (style) { send({ type: 'statusbar', value: style }); },
    close: function () { send({ type: 'close' }); },
    openURL: function (url) { send({ type: 'openurl', value: String(url) }); },
    storage: {
      get: function (key, fallback) {
        return request({ type: 'storage.get', key: String(key) }).then(function (v) { return v === undefined || v === null ? fallback : v; });
      },
      set: function (key, value) { return request({ type: 'storage.set', key: String(key), value: value }); },
      remove: function (key) { return request({ type: 'storage.remove', key: String(key) }); }
    },
    onPause: function (fn) { pauseFns.push(fn); },
    onResume: function (fn) { resumeFns.push(fn); },
    onTheme: function (fn) { themeFns.push(fn); }
  };

  send({ type: 'ready' });
})();
