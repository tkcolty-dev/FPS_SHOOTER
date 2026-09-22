// Real calls: WebRTC video (FaceTime) and voice (Phone) between two real accounts, signalled through the server.
(function () {
  const { el, esc } = OS.util;
  const A = () => OS.account;
  let ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
  fetch('/api/ice').then((r) => r.json()).then((j) => { if (j && j.iceServers) ICE = { iceServers: j.iceServers }; }).catch(() => {});
  let call = null, ui = null, ringer = null, timer = 0;

  OS.addStyle('calls', `
    #callui{position:absolute;inset:0;z-index:84;display:none;background:#0b0b10;color:#fff;overflow:hidden;font-family:-apple-system,system-ui,sans-serif}
    #callui.on{display:block}
    #callui .bgwash{position:absolute;inset:-40px;background:radial-gradient(80% 55% at 50% 18%,color-mix(in srgb,var(--pc) 70%,#000) 0%,color-mix(in srgb,var(--pc) 25%,#07070a) 55%,#050507 100%);filter:saturate(1.1)}
    #callui .bgwash::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.55))}
    #callui video{position:absolute;object-fit:cover;background:#000;display:none}
    #callui video.has{display:block}
    #callui .remote{inset:0;width:100%;height:100%}
    #callui .self{right:14px;top:calc(var(--safe-top) + 58px);width:104px;height:150px;border-radius:18px;box-shadow:0 8px 28px rgba(0,0,0,.55);transform:scaleX(-1);z-index:3;cursor:grab;border:1px solid rgba(255,255,255,.15)}
    #callui:not(.connected) .self.has{inset:0;width:100%;height:100%;border-radius:0;border:0;box-shadow:none;z-index:1;filter:brightness(.55)}
    #callui .head{position:absolute;left:0;right:0;top:calc(var(--safe-top) + 34px);text-align:center;z-index:4;transition:opacity .3s;text-shadow:0 1px 10px rgba(0,0,0,.35)}
    #callui .head .av{display:inline-block;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,.45)}
    #callui .head .nm{font-size:32px;font-weight:600;letter-spacing:-.5px;margin-top:16px}
    #callui .head .st{font-size:17px;color:rgba(255,255,255,.72);margin-top:5px;font-variant-numeric:tabular-nums}
    #callui.connected.video .head{top:calc(var(--safe-top) + 8px)} #callui.connected.video .head .nm{font-size:19px;margin-top:0} #callui.connected.video .head .st{font-size:14px;margin-top:1px} #callui.connected.video .head .av{display:none}
    /* buttons */
    #callui .bt{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none}
    #callui .bt i{width:var(--sz,74px);height:var(--sz,74px);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);transition:transform .18s var(--ease),background .2s,color .2s}
    #callui .bt:active i{transform:scale(.9)} #callui .bt i svg{width:44%;height:44%;fill:currentColor}
    #callui .bt.on i{background:#fff;color:#111}
    #callui .bt.end i{background:#FF3B30;color:#fff} #callui .bt.accept i{background:#34C759;color:#fff}
    #callui .bt small{font-size:13px;font-weight:500;letter-spacing:-.08px;color:#fff}
    /* incoming: decline left, accept right */
    #callui .ctl{position:absolute;left:0;right:0;z-index:4}
    #callui .ctl.incoming{bottom:calc(var(--safe-bottom) + 34px);display:flex;justify-content:space-between;padding:0 46px}
    #callui .ctl.incoming .bt{--sz:78px}
    #callui .ctl.incoming .bt.accept i{animation:callpulse 1.6s ease-out infinite}
    @keyframes callpulse{0%{box-shadow:0 0 0 0 rgba(52,199,89,.55)}70%{box-shadow:0 0 0 18px rgba(52,199,89,0)}100%{box-shadow:0 0 0 0 rgba(52,199,89,0)}}
    /* voice call: two round buttons, end button centred underneath */
    #callui .ctl.audio{bottom:calc(var(--safe-bottom) + 30px);display:grid;grid-template-columns:repeat(3,1fr);row-gap:34px;justify-items:center;padding:0 34px}
    #callui .ctl.audio .bt.end{grid-column:2}
    /* FaceTime: one frosted bar of buttons */
    #callui .ctl.video{bottom:calc(var(--safe-bottom) + 18px);left:16px;right:16px;display:flex;justify-content:space-around;align-items:center;padding:14px 10px;border-radius:34px;background:rgba(30,30,34,.45);backdrop-filter:blur(26px) saturate(1.6);-webkit-backdrop-filter:blur(26px) saturate(1.6);box-shadow:0 10px 40px rgba(0,0,0,.35)}
    #callui .ctl.video .bt{--sz:58px} #callui .ctl.video .bt i{background:rgba(255,255,255,.18)} #callui .ctl.video .bt.on i{background:#fff} #callui .ctl.video .bt.end i{background:#FF3B30}
    #callui .ctl.calling{bottom:calc(var(--safe-bottom) + 34px);display:flex;justify-content:center;gap:56px}
    #callui .err{position:absolute;left:24px;right:24px;top:50%;transform:translateY(-50%);text-align:center;font-size:15px;opacity:.85;z-index:4;line-height:21px}
  `);
  const I = {
    mute: '<svg viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 3l16 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    camoff: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M17 12.5l4.5-3.2v5.4z"/><path d="M3 3.5l17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M17 12.5l4.5-3.2v5.4z"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-1.8c.3-.4.7-.7 1.2-.7h2.6c.5 0 .9.3 1.2.7L15.8 6h1.7A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><path d="M8.6 12.6a3.5 3.5 0 0 1 6-2.1M15.4 13.4a3.5 3.5 0 0 1-6 2.1" fill="none" stroke="#1c1c1e" stroke-width="1.5" stroke-linecap="round"/><path d="M15.3 8.8v1.9h-1.9M8.7 17.2v-1.9h1.9" fill="none" stroke="#1c1c1e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    end: '<svg viewBox="0 0 24 24"><g transform="rotate(134 12 12)"><path d="M6.6 10.8c3.4-2.4 7.4-2.4 10.8 0 .8.6 1 1.7.5 2.5l-1 1.5c-.4.6-1.2.8-1.8.5l-2-.9c-.5-.2-.8-.7-.8-1.2v-1c-1-.3-2-.3-3 0v1c0 .5-.3 1-.8 1.2l-2 .9c-.6.3-1.4.1-1.8-.5l-1-1.5c-.5-.8-.3-1.9.5-2.5z"/></g></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 3.5c.7-.3 1.5 0 1.9.7l1.6 2.9c.3.6.2 1.4-.3 1.9L8.5 10.3c1 2 2.6 3.6 4.6 4.6l1.3-1.3c.5-.5 1.3-.6 1.9-.3l2.9 1.6c.7.4 1 1.2.7 1.9l-.9 2.1c-.3.7-1 1.1-1.8 1C9.6 19.1 4.9 14.4 4 6.8c-.1-.8.3-1.5 1-1.8z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L7 8.5H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  };

  function host() { if (!ui) { ui = el('<div id="callui"></div>'); OS.screen.appendChild(ui); } return ui; }
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };

  function render() {
    const h = host(); if (!call) { h.classList.remove('on'); h.innerHTML = ''; return; }
    const p = call.person, live = call.state !== 'incoming' && call.state !== 'calling';
    h.className = 'on ' + call.mode + (call.state === 'connected' ? ' connected' : '');
    h.style.setProperty('--pc', p.color || '#5856D6');
    h.innerHTML = `<div class="bgwash"></div>
      ${call.mode === 'video' ? '<video class="remote" autoplay playsinline></video><video class="self" autoplay playsinline muted></video>' : '<audio class="remoteaudio" autoplay></audio>'}
      <div class="head"><div class="av">${A().avatar(p, 112)}</div><div class="nm">${esc(p.name)}</div><div class="st"></div></div>
      <div class="ctl"></div>`;
    const ctl = h.querySelector('.ctl');
    const btn = (cls, icon, label, fn) => { const b = el(`<div class="bt ${cls}"><i>${icon}</i>${label ? `<small>${label}</small>` : ''}</div>`); b.addEventListener('click', fn); ctl.appendChild(b); return b; };
    if (call.state === 'incoming') {
      ctl.classList.add('incoming');
      btn('end', I.end, 'Decline', () => hangUp('declined'));
      btn('accept', call.mode === 'video' ? I.cam : I.phone, 'Accept', accept);
    } else if (call.mode === 'video' && live) {
      ctl.classList.add('video');
      btn(call.muted ? 'on' : '', call.muted ? I.muted : I.mute, '', toggleMute);
      btn(call.camOff ? 'on' : '', call.camOff ? I.camoff : I.cam, '', toggleCam);
      btn('', I.flip, '', flip);
      btn('end', I.end, '', () => hangUp('ended'));
    } else if (call.mode === 'video') {
      ctl.classList.add('calling');
      btn(call.muted ? 'on' : '', call.muted ? I.muted : I.mute, 'Mute', toggleMute);
      btn('end', I.end, 'Cancel', () => hangUp('ended'));
    } else {
      ctl.classList.add('audio');
      btn(call.speaker ? 'on' : '', I.speaker, 'Speaker', () => { call.speaker = !call.speaker; render(); });
      ctl.appendChild(document.createElement('span'));
      btn(call.muted ? 'on' : '', call.muted ? I.muted : I.mute, 'Mute', toggleMute);
      btn('end', I.end, '', () => hangUp('ended'));
    }
    attachStreams();
    tick();
  }
  function attachStreams() {
    const h = host();
    const rv = h.querySelector('.remote'), sv = h.querySelector('.self'), ra = h.querySelector('.remoteaudio');
    if (rv && call.remote) { rv.srcObject = call.remote; rv.classList.add('has'); }
    if (sv && call.local) { sv.srcObject = call.local; sv.classList.add('has'); }
    if (ra && call.remote) ra.srcObject = call.remote;
    if (sv) OS.util.drag(sv, { onMove(p) { sv.style.left = Math.max(8, Math.min(OS.W - 120, p.x - 56)) + 'px'; sv.style.top = Math.max(60, Math.min(OS.H - 200, p.y - 80)) + 'px'; sv.style.right = 'auto'; } });
  }
  function tick() {
    const h = host(); const st = h.querySelector('.st'); if (!st || !call) return;
    st.textContent = call.state === 'incoming' ? (call.mode === 'video' ? 'FaceTime Video…' : 'iPhone…')
      : call.state === 'calling' ? 'Calling…' : call.state === 'connecting' ? 'Connecting…'
      : call.state === 'connected' ? fmt((Date.now() - call.since) / 1000) + (call.relay ? ' · Relay' : '') : call.state === 'failed' ? 'Call Failed' : 'Ended';
  }

  async function media(mode) {
    return navigator.mediaDevices.getUserMedia(mode === 'video' ? { video: { facingMode: 'user', width: { ideal: 640 } }, audio: true } : { audio: true });
  }
  function peer() {
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => {
      if (!e.candidate || !call) return;
      const sig = { call: call.id, kind: 'ice', data: e.candidate.toJSON() };
      if (call.sdpSent) A().signal(call.with, sig).catch(() => {}); else (call.iceOut = call.iceOut || []).push(sig);
    };
    pc.ontrack = (e) => { if (!call) return; call.remote = e.streams[0]; if (call.state !== 'connected') { call.state = 'connected'; call.since = Date.now(); OS.sound.play('facetime_join'); render(); } else attachStreams(); };
    pc.onconnectionstatechange = () => {
      if (!call) return;
      if (pc.connectionState === 'connected' && call.state !== 'connected') { call.state = 'connected'; call.since = call.since || Date.now(); render(); }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') { if (call.state === 'connected') return; OS.ui.toast('Using relay…'); startRelay(true); }
    };
    return pc;
  }
  // offer/answer first, then the ICE candidates — otherwise the other phone drops candidates for a call it hasn't seen yet
  function flushIce() { if (!call) return; call.sdpSent = true; const q = call.iceOut || []; call.iceOut = []; q.forEach((sig) => A().signal(call.with, sig).catch(() => {})); }
  function stopRing() { if (ringer) { ringer.stop(); ringer = null; } }
  function startTimer() { clearInterval(timer); timer = setInterval(tick, 500); }

  async function start(personId, mode = 'video') {
    if (call) return OS.ui.toast('Already on a call');
    if (!A().signedIn) return OS.ui.toast('Sign in first');
    const p = A().person(personId); if (!p) return OS.ui.toast('No such person');
    call = { id: OS.util.uid(), with: personId, person: p, mode, state: 'calling', caller: true, muted: false, camOff: false, since: 0 };
    OS.emit('call:pace');
    render(); startTimer(); OS.setStatusBarStyle('light');
    try { call.local = await media(mode); }
    catch (e) { call.state = 'failed'; render(); host().appendChild(el(`<div class="err">Your ${mode === 'video' ? 'camera' : 'microphone'} isn’t available.<br>Allow access in the browser and try again.</div>`)); setTimeout(() => hangUp('failed'), 2600); return; }
    call.pc = peer();
    call.local.getTracks().forEach((t) => call.pc.addTrack(t, call.local));
    attachStreams();
    const offer = await call.pc.createOffer(); await call.pc.setLocalDescription(offer);
    await A().signal(personId, { call: call.id, kind: 'offer', mode, data: offer });
    flushIce();
    ringer = OS.sound.play('ringback', { loop: true, category: 'ringer' });
    call.fallback = setTimeout(() => { if (call && call.state !== 'connected' && call.answered) { OS.ui.toast('Using relay…'); startRelay(true); } }, 9000);
    call.timeout = setTimeout(() => { if (call && call.state === 'calling') { OS.ui.toast(p.name + ' didn’t answer'); hangUp('noanswer'); } }, 45000);
  }

  function incoming(sig, person) {
    if (call) { A().signal(sig.from, { call: sig.call, kind: 'busy' }); return; }
    call = { id: sig.call, with: sig.from, person, mode: sig.mode || 'video', state: 'incoming', caller: false, offer: sig.data, muted: false, camOff: false, since: 0, pending: [] };
    OS.emit('call:pace');
    if (OS.lock.asleep) OS.lock.wake();
    render(); startTimer(); OS.setStatusBarStyle('light');
    ringer = OS.sound.play(OS.sound.ringtone(), { loop: true, category: 'ringer' });
    OS.haptic('heavy');
    call.timeout = setTimeout(() => { if (call && call.state === 'incoming') hangUp('missed'); }, 40000);
  }

  async function accept() {
    if (!call || call.state !== 'incoming') return;
    stopRing(); clearTimeout(call.timeout);
    call.state = 'connecting'; render();
    try { call.local = await media(call.mode); }
    catch (e) { host().appendChild(el('<div class="err">Your camera or microphone isn’t available.</div>')); setTimeout(() => hangUp('failed'), 2200); return; }
    call.pc = peer();
    call.local.getTracks().forEach((t) => call.pc.addTrack(t, call.local));
    attachStreams();
    await call.pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    for (const c of call.pending) { try { await call.pc.addIceCandidate(c); } catch {} }
    call.pending = [];
    const ans = await call.pc.createAnswer(); await call.pc.setLocalDescription(ans);
    await A().signal(call.with, { call: call.id, kind: 'answer', data: ans });
    flushIce();
    call.fallback = setTimeout(() => { if (call && call.state !== 'connected') { OS.ui.toast('Using relay…'); startRelay(true); } }, 9000);
  }

  function toggleMute() { if (!call || !call.local) return; call.muted = !call.muted; call.local.getAudioTracks().forEach((t) => (t.enabled = !call.muted)); OS.haptic('light'); render(); }
  function toggleCam() { if (!call || !call.local) return; call.camOff = !call.camOff; call.local.getVideoTracks().forEach((t) => (t.enabled = !call.camOff)); OS.haptic('light'); render(); }
  async function flip() {
    if (!call || !call.local || call.mode !== 'video') return;
    call.front = !call.front;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: call.front ? 'environment' : 'user' }, audio: true });
      const track = s.getVideoTracks()[0]; const sender = call.pc.getSenders().find((x) => x.track && x.track.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      call.local.getVideoTracks().forEach((t) => t.stop());
      call.local = s; attachStreams();
      host().querySelector('.self').style.transform = call.front ? 'none' : 'scaleX(-1)';
    } catch { OS.ui.toast('Only one camera here'); }
  }

  function cleanup() {
    clearInterval(timer); stopRing(); stopRelay();
    if (call) {
      clearTimeout(call.timeout);
      clearTimeout(call.fallback);
      if (call.local) call.local.getTracks().forEach((t) => t.stop());
      if (call.pc) { try { call.pc.close(); } catch {} }
    }
    call = null; host().classList.remove('on'); host().innerHTML = ''; OS.refreshChrome(); OS.emit('call:pace');
  }
  function hangUp(why) {
    if (!call) return;
    if (OS._callDebug) console.log('[call] hangUp:', why, call.state);
    const other = call.with, id = call.id, missed = why === 'missed', p = call.person, mode = call.mode;
    if (why !== 'remote') A().signal(other, { call: id, kind: 'end' }).catch(() => {});
    if (call.state === 'connected') OS.sound.play('endcall'); else if (why === 'declined' || why === 'ended') OS.sound.play('facetime_leave');
    logCall(p, mode, call.state === 'connected' ? Date.now() - call.since : 0, call.caller ? 'out' : missed ? 'missed' : 'in');
    cleanup();
    if (missed) OS.notify({ appId: mode === 'video' ? 'facetime' : 'phone', title: 'Missed ' + (mode === 'video' ? 'FaceTime' : 'Call'), body: p.name, sound: false });
  }
  function logCall(person, mode, ms, dir) {
    const log = OS.store.get('calls.log', []);
    log.unshift({ id: OS.util.uid(), person: { id: person.id, name: person.name, handle: person.handle, emoji: person.emoji, color: person.color }, mode, ms, dir, t: Date.now() });
    OS.store.set('calls.log', log.slice(0, 60));
    OS.emit('calls:log');
  }

  // ── signals from the other side ──
  OS.on('account:signal', async (sig) => {
    const p = A().person(sig.from) || { id: sig.from, name: 'Unknown', color: '#8E8E93' };
    if (sig.kind === 'offer') return incoming(sig, p);
    if (!call || sig.call !== call.id) { if (sig.kind === 'ice' || sig.kind === 'answer') return; return; }
    if (sig.kind === 'answer') {
      stopRing(); clearTimeout(call.timeout); call.answered = true;
      call.state = 'connecting'; render();
      try { await call.pc.setRemoteDescription(new RTCSessionDescription(sig.data)); } catch (e) { console.warn('answer', e); }
      for (const c of (call.pending || [])) { try { await call.pc.addIceCandidate(c); } catch {} }
      call.pending = [];
    } else if (sig.kind === 'ice') {
      const c = new RTCIceCandidate(sig.data);
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(c); } catch {} }
      else (call.pending = call.pending || []).push(c);
    } else if (sig.kind === 'end') {
      if (call.state === 'incoming') { OS.sound.play('endcall'); logCall(call.person, call.mode, 0, 'missed'); cleanup(); OS.notify({ appId: call && call.mode === 'video' ? 'facetime' : 'phone', title: 'Missed Call', body: p.name, sound: false }); }
      else { OS.ui.toast(p.name + ' ended the call'); hangUp('remote'); }
    } else if (sig.kind === 'relay') { clearTimeout(call.fallback); startRelay(false);
    } else if (sig.kind === 'busy') { OS.ui.toast(p.name + ' is on another call'); hangUp('remote'); }
  });

  /* ───────── relay fallback (used when a direct connection can't be made) ───────── */
  const RELAY = { fps: 10, w: 320, h: 240, rate: 16000 };
  function startRelay(announce) {
    if (!call || call.relay) return;
    call.relay = { sending: false };
    if (announce) A().signal(call.with, { call: call.id, kind: 'relay' }).catch(() => {});
    if (call.pc) { try { call.pc.close(); } catch {} call.pc = null; }
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = call.relay.ws = new WebSocket(proto + location.host + '/relay?call=' + encodeURIComponent(call.id) + '&token=' + encodeURIComponent(A().token));
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { if (call && call.relay) beginRelayMedia(); };
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') { const m = JSON.parse(e.data || '{}'); if (m.type === 'bye') hangUp('remote'); return; }
      const buf = new Uint8Array(e.data); const kind = buf[0], body = buf.subarray(1);
      if (kind === 0) showRelayFrame(body); else if (kind === 1) playRelayAudio(body);
    };
    ws.onerror = () => { if (call) { call.state = 'failed'; render(); } };
    ws.onclose = () => { if (call && call.relay && call.state === 'connected') hangUp('remote'); };
  }
  function beginRelayMedia() {
    if (!call || !call.relay || call.relay.sending) return;
    call.relay.sending = true;
    call.state = 'connected'; call.since = call.since || Date.now(); stopRing(); render();
    OS.sound.play('facetime_join');
    const ws = call.relay.ws;
    // video → JPEG frames
    if (call.mode === 'video' && call.local && call.local.getVideoTracks().length) {
      const v = document.createElement('video'); v.srcObject = call.local; v.muted = true; v.playsInline = true;
      v.style.cssText = 'position:absolute;width:2px;height:2px;opacity:.01;pointer-events:none'; host().appendChild(v);
      v.play().catch(() => {}); call.relay.capture = v;
      const cv = document.createElement('canvas'); cv.width = RELAY.w; cv.height = RELAY.h; const g = cv.getContext('2d');
      call.relay.video = setInterval(() => {
        if (!call || !call.relay || ws.readyState !== 1 || call.camOff || !v.videoWidth) return;
        g.drawImage(v, 0, 0, RELAY.w, RELAY.h);
        cv.toBlob((b) => { if (!b || ws.readyState !== 1) return; b.arrayBuffer().then((ab) => { const out = new Uint8Array(ab.byteLength + 1); out[0] = 0; out.set(new Uint8Array(ab), 1); try { ws.send(out); } catch {} }); }, 'image/jpeg', .45);
      }, 1000 / RELAY.fps);
    }
    // audio → 16-bit PCM
    try {
      const ctx = OS.sound.ctx; const src = ctx.createMediaStreamSource(call.local);
      const node = ctx.createScriptProcessor(2048, 1, 1);
      const ratio = ctx.sampleRate / RELAY.rate;
      node.onaudioprocess = (e) => {
        if (!call || !call.relay || ws.readyState !== 1 || call.muted) return;
        const inp = e.inputBuffer.getChannelData(0); const len = Math.floor(inp.length / ratio);
        const out = new Uint8Array(len * 2 + 1); out[0] = 1; const dv = new DataView(out.buffer);
        for (let i = 0; i < len; i++) { const s = Math.max(-1, Math.min(1, inp[Math.floor(i * ratio)])); dv.setInt16(1 + i * 2, s * 32767, true); }
        try { ws.send(out); } catch {}
      };
      const sink = ctx.createGain(); sink.gain.value = 0; src.connect(node); node.connect(sink); sink.connect(ctx.destination);   // silent sink keeps the processor running (no echo)
      call.relay.audioNodes = [src, node, sink];
    } catch (e) { console.warn('[relay audio]', e); }
  }
  function showRelayFrame(bytes) {
    const h = host(); let img = h.querySelector('.relayimg');
    if (!img) {
      const rv = h.querySelector('.remote'); if (rv) rv.style.display = 'none';
      img = el('<img class="relayimg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#111">');
      h.insertBefore(img, h.firstChild.nextSibling);
    }
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const old = img.dataset.url; img.src = url; img.dataset.url = url;
    if (old) setTimeout(() => URL.revokeObjectURL(old), 200);
  }
  function playRelayAudio(bytes) {
    if (!call || !call.relay) return;
    const ctx = OS.sound.ctx; if (!ctx) return;
    const n = Math.floor(bytes.byteLength / 2);
    const buf = ctx.createBuffer(1, n, RELAY.rate);
    const ch = buf.getChannelData(0); const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 32768;
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(OS.sound.mediaOut);
    const now = ctx.currentTime;
    call.relay.playAt = Math.max(now + .06, call.relay.playAt || 0);
    src.start(call.relay.playAt); call.relay.playAt += buf.duration;
  }
  function stopRelay() {
    if (!call || !call.relay) return;
    clearInterval(call.relay.video);
    if (call.relay.capture) { try { call.relay.capture.remove(); } catch {} }
    (call.relay.audioNodes || []).forEach((n) => { try { n.disconnect(); } catch {} });
    try { call.relay.ws && call.relay.ws.close(); } catch {}
    call.relay = null;
  }

  OS.calls = {
    start, hangUp, accept,
    useRelay: () => startRelay(true),
    get current() { return call; },
    get active() { return !!call; },
    log: () => OS.store.get('calls.log', []),
    clearLog: () => { OS.store.set('calls.log', []); OS.emit('calls:log'); },
  };
})();
