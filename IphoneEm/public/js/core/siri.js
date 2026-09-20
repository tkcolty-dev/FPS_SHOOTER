// Siri: edge glow, type or talk, on-device intents first, Claude for everything else.
(function () {
  const { el, esc } = OS.util;
  let root, answerEl, input, micBtn, rec = null, busy = false, abort = null, closeTimer = 0;
  const S = OS.siri = { active: false, open, close, ask };

  function open() {
    if (S.active || OS.power.off) return;
    if (OS.lock.asleep) OS.lock.wake();
    S.active = true; OS.overlays.closeAll();
    root.classList.add('on'); root.getBoundingClientRect(); root.classList.add('in');
    answerEl.classList.remove('on'); answerEl.innerHTML = ''; input.value = '';
    OS.sound.play('siri_begin'); OS.haptic('medium');
    listen();
  }
  function close() {
    if (!S.active) return; S.active = false; clearTimeout(closeTimer);
    stopListening(); abort && abort.abort(); abort = null; try { speechSynthesis.cancel(); } catch {}
    input.blur(); root.classList.remove('in', 'typing'); setTimeout(() => { if (!S.active) root.classList.remove('on'); }, 450);
  }

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    try {
      rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false; let finalText = '';
      rec.onresult = (e) => { let t = ''; for (const r of e.results) t += r[0].transcript; input.value = t; if (e.results[e.results.length - 1].isFinal) finalText = t; };
      rec.onend = () => { micBtn.classList.remove('live'); rec = null; if (finalText.trim() && S.active) ask(finalText.trim()); };
      rec.onerror = () => { micBtn.classList.remove('live'); rec = null; };
      rec.start(); micBtn.classList.add('live');
    } catch { rec = null; }
  }
  function stopListening() { if (rec) { try { rec.abort(); } catch {} rec = null; } micBtn.classList.remove('live'); }

  function say(text, opts = {}) {
    answerEl.classList.add('on');
    answerEl.innerHTML = (opts.you ? `<div class="you">“${esc(opts.you)}”</div>` : '') + `<div class="txt">${esc(text)}</div>`;
    answerEl.scrollTop = answerEl.scrollHeight;
    if (opts.final !== false) {
      if (OS.settings.get('siriVoice') && OS.settings.get('volume') > 0) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.slice(0, 600)); u.volume = Math.min(1, OS.settings.get('volume') + .2); u.rate = 1.02; const v = speechSynthesis.getVoices().find((x) => /Samantha|Ava|Siri/i.test(x.name) && /en[-_]US/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch {} }
      OS.sound.play('siri_confirm', { volume: .6 });
    }
  }
  const done = (text, you, thenClose) => { say(text, { you }); if (thenClose) { clearTimeout(closeTimer); closeTimer = setTimeout(close, 1500); } };

  const SETTINGS = [[/dark mode|dark appearance/, 'darkMode', 'Dark Mode'], [/wi-?fi/, 'wifi', 'Wi-Fi'], [/bluetooth/, 'bluetooth', 'Bluetooth'], [/air ?plane mode/, 'airplane', 'Airplane Mode'], [/do not disturb|focus/, 'focus', 'Do Not Disturb'], [/silent mode|mute/, 'silent', 'Silent Mode'], [/low power( mode)?/, 'lowPower', 'Low Power Mode']];
  function findApp(name) { name = name.toLowerCase().replace(/^the /, '').replace(/ app$/, '').trim(); const apps = OS.apps.filter((a) => OS.isInstalled(a.id)); return apps.find((a) => a.name.toLowerCase() === name) || apps.find((a) => a.name.toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, '')) || apps.find((a) => a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase())); }
  function findContact(name) { name = name.toLowerCase().trim(); return OS.contacts.all().find((c) => OS.contacts.name(c).toLowerCase() === name) || OS.contacts.all().find((c) => OS.contacts.name(c).toLowerCase().includes(name) || (c.first || '').toLowerCase() === name); }
  function parseDuration(q) { let s = 0, m; const re = /(\d+(?:\.\d+)?|an?|one|two|three|four|five|ten|fifteen|twenty|thirty|forty five|sixty)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/g; const W = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, 'forty five': 45, sixty: 60 }; while ((m = re.exec(q))) { const n = W[m[1]] != null ? W[m[1]] : parseFloat(m[1]); s += n * (/^h/.test(m[2]) ? 3600 : /^m/.test(m[2]) ? 60 : 1); } return Math.round(s); }

  function localIntent(q) {
    const l = q.toLowerCase().replace(/[?.!]+$/, '').replace(/^(hey |ok )?siri[, ]*/, '').trim(); let m;
    if ((m = /^(?:open|launch|start|go to)\s+(.+)$/.exec(l))) { const a = findApp(m[1]); if (a) { done(`Opening ${a.name}.`, q); setTimeout(() => { close(); OS.openApp(a.id); }, 700); return true; } }
    if (/timer/.test(l) && (m = parseDuration(l))) { if (OS.clock && OS.clock.startTimer) { OS.clock.startTimer(m, 'Timer'); const mm = Math.floor(m / 60), ss = m % 60; done(`${mm ? mm + (mm === 1 ? ' minute' : ' minutes') : ''}${mm && ss ? ' ' : ''}${ss ? ss + ' seconds' : ''}, counting down.`, q, true); return true; } }
    if ((m = /alarm (?:for|at) (\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/.exec(l)) && OS.clock && OS.clock.addAlarm) { let h = +m[1]; const min = +(m[2] || 0); const pm = m[3] && /^p/.test(m[3]); if (pm && h < 12) h += 12; if (m[3] && !pm && h === 12) h = 0; OS.clock.addAlarm({ hour: h, minute: min, label: 'Alarm' }); done(`I set an alarm for ${((h % 12) || 12)}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}.`, q, true); return true; }
    if (/what(?:'s| is) the time|what time is it|current time/.test(l)) { done(`It’s ${OS.util.timeFull()}.`, q); return true; }
    if (/what(?:'s| is) (?:the |today'?s )?date|what day is it/.test(l)) { done(`It’s ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`, q); return true; }
    if ((m = /^(?:turn|switch) (on|off) (?:the )?(.+)$|^(enable|disable) (.+)$/.exec(l))) {
      const on = m[1] ? m[1] === 'on' : m[3] === 'enable'; const what = m[2] || m[4];
      if (/flash ?light|torch/.test(what)) { OS.flashlight.set(on); done(`The flashlight is ${on ? 'on' : 'off'}.`, q, true); return true; }
      const s = SETTINGS.find((x) => x[0].test(what)); if (s) { OS.settings.set(s[1], on); done(`OK, I turned ${on ? 'on' : 'off'} ${s[2]}.`, q, true); return true; }
    }
    if (/volume up|turn (it|the volume) up|louder/.test(l)) { OS.volume.change(.125); done('Volume up.', q, true); return true; }
    if (/volume down|turn (it|the volume) down|quieter/.test(l)) { OS.volume.change(-.125); done('Volume down.', q, true); return true; }
    if ((m = /brightness (?:to )?(\d+)/.exec(l))) { OS.settings.set('brightness', Math.max(.08, Math.min(1, +m[1] / 100))); done(`Brightness set to ${m[1]} percent.`, q, true); return true; }
    if ((m = /^(?:call|phone|dial)\s+(.+)$/.exec(l))) { const c = findContact(m[1]); const num = c ? c.phone : m[1].replace(/[^\d+]/g, ''); if (num) { done(`Calling ${c ? OS.contacts.name(c) : num}…`, q); setTimeout(() => { close(); OS.openURL('tel:' + num); }, 900); return true; } }
    if ((m = /^(?:text|message|tell)\s+(\w+(?: \w+)?)\s*(?:saying|that|:)?\s*(.*)$/.exec(l))) { const c = findContact(m[1]); if (c) { done(m[2] ? `Here’s your message to ${OS.contacts.name(c)}.` : `Opening your conversation with ${OS.contacts.name(c)}.`, q); setTimeout(() => { close(); OS.openApp('messages', { to: c.id, body: m[2] || '' }); }, 900); return true; } }
    if ((m = /^facetime\s+(.+)$/.exec(l))) { const c = findContact(m[1]); if (c) { done(`Starting FaceTime with ${OS.contacts.name(c)}.`, q); setTimeout(() => { close(); OS.openApp('facetime', { to: c.id }); }, 900); return true; } }
    if (/take a (photo|picture|selfie)/.test(l)) { done('Say cheese.', q); setTimeout(() => { close(); OS.openApp('camera', { capture: true }); }, 800); return true; }
    if (/screenshot/.test(l)) { done('OK.', q); setTimeout(() => { close(); setTimeout(() => OS.screenshot(), 500); }, 500); return true; }
    if (/^(play|resume)( some| the)? ?(music|song|songs)?$/.test(l) && OS.music) { if (!OS.music.playing()) OS.music.toggle(); done('Here’s some music.', q, true); return true; }
    if (/^(pause|stop)( the)? ?(music|song)?$/.test(l) && OS.music) { if (OS.music.playing()) OS.music.toggle(); done('Paused.', q, true); return true; }
    if (/next (song|track)|skip/.test(l) && OS.music) { OS.music.next(); done('Skipping.', q, true); return true; }
    if (/weather|temperature outside|is it (raining|cold|hot)/.test(l)) { const w = OS.weather && OS.weather.current && OS.weather.current(); if (w) { done(`It’s currently ${Math.round(w.temp)}° and ${String(w.condition || '').toLowerCase()} in ${w.city}, with a high of ${Math.round(w.high)}° and a low of ${Math.round(w.low)}°.`, q); return true; } done('Let me show you the forecast.', q); setTimeout(() => { close(); OS.openApp('weather'); }, 900); return true; }
    if (/flip a coin/.test(l)) { done(Math.random() < .5 ? 'It’s heads.' : 'It’s tails.', q); return true; }
    if (/roll (a |the )?(die|dice)/.test(l)) { done(`It’s a ${1 + Math.floor(Math.random() * 6)}.`, q); return true; }
    if ((m = /^(?:search(?: the web)? for|google|look up)\s+(.+)$/.exec(l))) { done(`Here’s what I found for “${m[1]}”.`, q); setTimeout(() => { close(); OS.openApp('safari', { search: m[1] }); }, 800); return true; }
    if (/^(lock|sleep)( the| my)? ?(phone|screen|iphone)?$/.test(l)) { close(); setTimeout(() => OS.lock.sleep(), 300); return true; }
    if (/^(hi|hello|hey)( siri)?$/.test(l)) { done(`Hi ${OS.settings.get('ownerName')}. How can I help?`, q); return true; }
    if (/who are you|what are you/.test(l)) { done('I’m Siri, running on your iPhone 17 emulator — with a little help from Claude.', q); return true; }
    return false;
  }

  async function ask(q) {
    q = (q || '').trim(); if (!q || busy) return;
    stopListening(); input.value = ''; input.blur(); clearTimeout(closeTimer);
    if (localIntent(q)) return;
    busy = true; abort = new AbortController();
    answerEl.classList.add('on'); answerEl.innerHTML = `<div class="you">“${esc(q)}”</div><div class="siri-dots"><i></i><i></i><i></i></div>`;
    try {
      const sys = `You are Siri on an iPhone 17 that belongs to ${OS.settings.get('ownerName')}, a kid who loves coding and making games. Today is ${new Date().toDateString()}, ${OS.util.timeFull()}. Answer like Siri: friendly, direct, 1–3 short sentences, plain text only (no markdown, no lists unless asked). Kid-safe.`;
      const text = await OS.ai(q, { system: sys, fast: true, signal: abort.signal, timeout: 60000, onText: (t) => { if (S.active) say(t, { you: q, final: false }); } });
      if (S.active) say(text, { you: q });
    } catch (e) {
      if (S.active) { say('I can’t reach my brain right now, but here’s what I found on the web.', { you: q }); setTimeout(() => { if (S.active) { close(); OS.openApp('safari', { search: q }); } }, 1800); }
    } finally { busy = false; abort = null; }
  }

  OS.initSiri = function () {
    root = document.getElementById('siri');
    root.innerHTML = `<div class="siri-glow"></div><div class="siri-panel"><div class="siri-answer ios-scroll"></div><div class="siri-input"><input type="text" placeholder="Ask Siri…" enterkeyhint="go" autocomplete="off"><div class="siri-mic"><svg viewBox="0 0 24 24"><rect x="9" y="2.500" width="6" height="12" rx="3"/><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v3.500" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg></div></div></div>`;
    answerEl = root.querySelector('.siri-answer'); input = root.querySelector('input'); micBtn = root.querySelector('.siri-mic');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(input.value); } });
    input.addEventListener('focus', () => { stopListening(); root.classList.add('typing'); }); input.addEventListener('blur', () => root.classList.remove('typing'));
    micBtn.addEventListener('click', () => { if (rec) stopListening(); else { input.blur(); OS.sound.play('siri_begin', { volume: .6 }); listen(); } });
    root.addEventListener('click', (e) => { if (e.target === root || e.target.classList.contains('siri-glow')) { OS.sound.play('siri_cancel', { volume: .6 }); close(); } });
    try { speechSynthesis.getVoices(); } catch {}
  };
})();
