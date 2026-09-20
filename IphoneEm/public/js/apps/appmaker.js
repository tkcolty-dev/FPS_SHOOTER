// App Maker — build real apps on the phone: describe one to Claude, start from a template, or write the code.
// Apps install to the Home Screen and can be published to this phone's App Store.
(function () {
  const { el, esc, uid } = OS.util;
  const GRADS = [['#5E5CE6', '#BF5AF2'], ['#0A84FF', '#64D2FF'], ['#30D158', '#00C7BE'], ['#FF9F0A', '#FF375F'], ['#FF453A', '#FF9F0A'], ['#FFD60A', '#FF9F0A'], ['#1c1c1e', '#48484A'], ['#FF375F', '#BF5AF2'], ['#00C7BE', '#0A84FF'], ['#A2845E', '#5b4630']];
  const EMOJI = '⭐ 🎮 🚀 🎨 🎵 📝 ⏱️ 🎲 🧠 🐱 🐶 🦖 ⚽ 🏀 🍕 🌈 🔥 💎 👾 🤖 🧩 📷 💬 ❤️ ✅ 🏆 🌍 ☀️ 🌙 ⚡'.split(' ');
  const grad = (g) => `linear-gradient(160deg,${g[0]},${g[1]})`;

  const BASE = (title, css, body, js) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column;
         padding: 62px 20px 34px; box-sizing: border-box; user-select: none; ${css.body || ''} }
${css.rest || ''}
</style>
</head>
<body>
${body}
<script>
${js}
</scr` + `ipt>
</body>
</html>`;

  const TEMPLATES = [
    { name: 'Blank', emoji: '📄', grad: 6, desc: 'An empty screen and the basics.', html: BASE('My App', { body: 'background:#f2f2f7;color:#111;align-items:center;justify-content:center;text-align:center;', rest: '  h1 { font-size: 34px; margin: 0 0 8px; }\n  p { color: #8e8e93; font-size: 17px; }\n  button { margin-top: 24px; font: 600 17px system-ui, -apple-system, sans-serif; color: #fff; background: #007aff; border: 0; border-radius: 14px; padding: 14px 28px; }' },
      '<h1>Hello, iPhone!</h1>\n<p>Edit the code to make this yours.</p>\n<button id="btn">Tap me</button>',
      "let taps = 0;\ndocument.getElementById('btn').onclick = () => {\n  taps++;\n  iPhone.haptic('light');\n  document.querySelector('p').textContent = 'You tapped ' + taps + ' times';\n};") },
    { name: 'Clicker Game', emoji: '🍪', grad: 3, desc: 'Tap to score, buy upgrades, saves progress.', html: BASE('Clicker', { body: 'background:linear-gradient(180deg,#2b1055,#7597de);color:#fff;align-items:center;text-align:center;', rest: '  #score { font-size: 64px; font-weight: 800; margin-top: 30px; }\n  #per { opacity: .7; }\n  #big { font-size: 150px; margin: 40px 0; transition: transform .08s; cursor: pointer; }\n  #big:active { transform: scale(.88); }\n  .shop { width: 100%; margin-top: auto; }\n  .shop button { width: 100%; margin-top: 10px; padding: 16px; border: 0; border-radius: 16px; font: 600 17px system-ui, -apple-system, sans-serif; background: rgba(255,255,255,.18); color: #fff; }\n  .shop button:disabled { opacity: .4; }' },
      '<div id="score">0</div>\n<div id="per">1 per tap</div>\n<div id="big">🍪</div>\n<div class="shop">\n  <button id="up1"></button>\n  <button id="up2"></button>\n</div>',
      "let s = { score: 0, tap: 1, auto: 0 };\nconst $ = (id) => document.getElementById(id);\nconst cost1 = () => 20 * s.tap * s.tap, cost2 = () => 50 * (s.auto + 1) * (s.auto + 1);\nfunction draw() {\n  $('score').textContent = Math.floor(s.score);\n  $('per').textContent = s.tap + ' per tap · ' + s.auto + ' per second';\n  $('up1').textContent = 'Stronger taps — ' + cost1(); $('up1').disabled = s.score < cost1();\n  $('up2').textContent = 'Auto baker — ' + cost2(); $('up2').disabled = s.score < cost2();\n}\n$('big').onclick = () => { s.score += s.tap; iPhone.haptic('light'); draw(); };\n$('up1').onclick = () => { s.score -= cost1(); s.tap++; iPhone.haptic('success'); draw(); };\n$('up2').onclick = () => { s.score -= cost2(); s.auto++; iPhone.haptic('success'); draw(); };\nsetInterval(() => { s.score += s.auto / 10; draw(); }, 100);\nsetInterval(() => iPhone.storage.set('save', s), 2000);\niPhone.storage.get('save').then((v) => { if (v) s = v; draw(); });") },
    { name: 'To‑Do List', emoji: '✅', grad: 2, desc: 'Add, check off and delete tasks.', html: BASE('To-Do', { body: 'background:#f2f2f7;color:#111;', rest: '  h1 { font-size: 34px; margin: 6px 0 14px; }\n  form { display: flex; gap: 8px; }\n  input { flex: 1; font: 17px system-ui, -apple-system, sans-serif; padding: 13px 14px; border: 0; border-radius: 12px; outline: none; }\n  form button { border: 0; border-radius: 12px; background: #34c759; color: #fff; font: 600 22px system-ui, -apple-system, sans-serif; width: 50px; }\n  ul { list-style: none; padding: 0; margin: 16px 0 0; background: #fff; border-radius: 12px; overflow: auto; }\n  li { display: flex; align-items: center; gap: 12px; padding: 13px 14px; font-size: 17px; border-bottom: .5px solid #d1d1d6; }\n  li i { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #c7c7cc; flex: none; }\n  li.done i { background: #34c759; border-color: #34c759; }\n  li.done span { color: #8e8e93; text-decoration: line-through; }\n  li b { margin-left: auto; color: #ff3b30; font-weight: 400; }' },
      '<h1>To‑Do</h1>\n<form id="f"><input id="t" placeholder="New task"><button>+</button></form>\n<ul id="list"></ul>',
      "let items = [];\nconst list = document.getElementById('list');\nfunction draw() {\n  list.innerHTML = '';\n  items.forEach((it, i) => {\n    const li = document.createElement('li');\n    li.className = it.done ? 'done' : '';\n    li.innerHTML = '<i></i><span></span><b>✕</b>';\n    li.querySelector('span').textContent = it.text;\n    li.onclick = (e) => {\n      if (e.target.tagName === 'B') items.splice(i, 1);\n      else { it.done = !it.done; iPhone.haptic(it.done ? 'success' : 'light'); }\n      save(); draw();\n    };\n    list.appendChild(li);\n  });\n}\nconst save = () => iPhone.storage.set('items', items);\ndocument.getElementById('f').onsubmit = (e) => {\n  e.preventDefault();\n  const t = document.getElementById('t');\n  if (t.value.trim()) { items.push({ text: t.value.trim(), done: false }); t.value = ''; save(); draw(); }\n};\niPhone.storage.get('items', []).then((v) => { items = v; draw(); });") },
    { name: 'Drawing Pad', emoji: '🎨', grad: 7, desc: 'Finger painting with colours.', html: BASE('Draw', { body: 'background:#fff;padding:0;', rest: '  canvas { flex: 1; touch-action: none; }\n  .bar { position: absolute; left: 0; right: 0; bottom: 34px; display: flex; justify-content: center; gap: 12px; padding: 12px; }\n  .bar span { width: 36px; height: 36px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,.25); }\n  .bar span.on { outline: 3px solid #007aff; outline-offset: 2px; }' },
      '<canvas id="c"></canvas>\n<div class="bar" id="bar"></div>',
      "const c = document.getElementById('c'), g = c.getContext('2d');\nc.width = innerWidth * 2; c.height = innerHeight * 2; g.scale(2, 2);\ng.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 6;\nlet color = '#111', last = null;\n['#111', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#fff'].forEach((col, i) => {\n  const s = document.createElement('span');\n  s.style.background = col; if (i === 0) s.className = 'on';\n  s.onclick = () => { color = col; g.lineWidth = col === '#fff' ? 26 : 6; document.querySelectorAll('.bar span').forEach((x) => x.className = ''); s.className = 'on'; iPhone.haptic('selection'); };\n  document.getElementById('bar').appendChild(s);\n});\nc.onpointerdown = (e) => { last = [e.clientX, e.clientY]; };\nc.onpointermove = (e) => {\n  if (!last) return;\n  g.strokeStyle = color; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(e.clientX, e.clientY); g.stroke();\n  last = [e.clientX, e.clientY];\n};\nonpointerup = () => { last = null; };") },
    { name: 'Quiz', emoji: '🧠', grad: 1, desc: 'Multiple choice with a score.', html: BASE('Quiz', { body: 'background:linear-gradient(180deg,#0f2027,#2c5364);color:#fff;', rest: '  #n { opacity: .6; margin-top: 10px; }\n  h1 { font-size: 28px; line-height: 34px; min-height: 110px; }\n  button { display: block; width: 100%; margin-bottom: 12px; padding: 17px; border: 0; border-radius: 16px; font: 600 17px system-ui, -apple-system, sans-serif; background: rgba(255,255,255,.14); color: #fff; text-align: left; }\n  button.good { background: #34c759; } button.bad { background: #ff3b30; }' },
      '<div id="n"></div>\n<h1 id="q"></h1>\n<div id="a"></div>',
      "// Add your own questions here!  [question, [answers], index of the right answer]\nconst QUESTIONS = [\n  ['Which language runs in every web browser?', ['Python', 'JavaScript', 'Scratch', 'Swift'], 1],\n  ['How many bits are in a byte?', ['4', '8', '16', '64'], 1],\n  ['What does CSS style?', ['Databases', 'Web pages', 'Robots', 'Sound'], 1],\n  ['Which planet is the Red Planet?', ['Venus', 'Jupiter', 'Mars', 'Saturn'], 2],\n];\nlet i = 0, score = 0;\nfunction show() {\n  if (i >= QUESTIONS.length) {\n    document.getElementById('n').textContent = 'Finished';\n    document.getElementById('q').textContent = 'You got ' + score + ' of ' + QUESTIONS.length + '!';\n    document.getElementById('a').innerHTML = '<button onclick=\"i=0;score=0;show()\">Play again</button>';\n    return iPhone.haptic('success');\n  }\n  const [q, answers, right] = QUESTIONS[i];\n  document.getElementById('n').textContent = 'Question ' + (i + 1) + ' of ' + QUESTIONS.length;\n  document.getElementById('q').textContent = q;\n  const box = document.getElementById('a'); box.innerHTML = '';\n  answers.forEach((t, k) => {\n    const b = document.createElement('button'); b.textContent = t;\n    b.onclick = () => {\n      if (box.dataset.lock) return; box.dataset.lock = 1;\n      b.className = k === right ? 'good' : 'bad';\n      box.children[right].className = 'good';\n      if (k === right) { score++; iPhone.haptic('success'); } else iPhone.haptic('error');\n      setTimeout(() => { delete box.dataset.lock; i++; show(); }, 900);\n    };\n    box.appendChild(b);\n  });\n}\nshow();") },
    { name: 'Soundboard', emoji: '🔊', grad: 4, desc: 'Buttons that play REAL iPhone sounds.', html: BASE('Soundboard', { body: 'background:#111;color:#fff;', rest: '  h1 { font-size: 34px; margin: 6px 0 16px; }\n  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n  .grid div { aspect-ratio: 1.500; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 600; gap: 6px; transition: transform .08s; }\n  .grid div:active { transform: scale(.93); }\n  .grid span { font-size: 40px; }' },
      '<h1>Soundboard</h1>\n<div class="grid" id="g"></div>',
      "// iPhone.sound() plays the real system sounds of the phone\nconst PADS = [\n  ['📸', 'Shutter', 'shutter', '#ff9f0a'], ['💬', 'Sent', 'sent', '#30d158'],\n  ['📥', 'Received', 'received', '#0a84ff'], ['🔒', 'Lock', 'lock', '#8e8e93'],\n  ['💳', 'Pay', 'pay', '#bf5af2'], ['🔌', 'Charge', 'charge', '#34c759'],\n  ['🎵', 'Marimba', 'ringtone:Marimba', '#ff375f'], ['🔔', 'Tri‑Tone', 'tone:Tri-Tone', '#64d2ff'],\n];\nPADS.forEach(([emoji, name, id, color]) => {\n  const d = document.createElement('div');\n  d.style.background = color;\n  d.innerHTML = '<span>' + emoji + '</span>' + name;\n  d.onclick = () => { iPhone.sound(id); iPhone.haptic('medium'); };\n  document.getElementById('g').appendChild(d);\n});") },
  ];

  OS.addStyle('appmaker', `
    .app-appmaker .mk-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:6px 20px 30px}
    .app-appmaker .mk-card{border-radius:20px;background:var(--cell);padding:16px;cursor:pointer;position:relative;box-shadow:0 1px 6px rgba(0,0,0,.06);transition:transform .2s var(--ease)}.app-appmaker .mk-card:active{transform:scale(.96)}
    .app-appmaker .mk-card .icon-img{width:64px;height:64px;border-radius:15px;font-size:34px;margin-bottom:12px}.app-appmaker .mk-card b{display:block;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.app-appmaker .mk-card small{color:var(--label2);font-size:13px}
    .app-appmaker .mk-card.new{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:150px;color:var(--tint);border:2px dashed var(--label3);background:none;box-shadow:none;font-weight:600}.app-appmaker .mk-card.new span{font-size:44px;font-weight:300;line-height:44px}
    .app-appmaker .mk-hero{margin:0 20px 22px;padding:20px;border-radius:22px;color:#fff;background:linear-gradient(135deg,#5E5CE6,#BF5AF2 60%,#FF375F);box-shadow:0 10px 30px rgba(94,92,230,.35)}.app-appmaker .mk-hero h2{margin:0 0 6px;font-size:24px}.app-appmaker .mk-hero p{margin:0 0 14px;font-size:15px;opacity:.9;line-height:20px}
    .app-appmaker .mk-hero button{background:#fff;color:#5E5CE6;font-weight:700;font-size:16px;border-radius:14px;padding:12px 18px}
    .mk-ed{position:absolute;inset:0;background:var(--bg2);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .42s var(--ease);z-index:5}.mk-ed.in{transform:none}
    .mk-top{padding:var(--safe-top) 12px 0;height:calc(var(--safe-top) + 48px);display:flex;align-items:center;gap:8px;background:var(--bar);box-shadow:0 .5px 0 var(--sep);flex:none}
    .mk-top .ttl{flex:1;text-align:center;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mk-top .run{background:var(--green);color:#fff;font-weight:700;font-size:15px;border-radius:16px;padding:6px 14px}
    .mk-seg{padding:10px 16px;flex:none}.mk-pane{flex:1;min-height:0;position:relative;display:none}.mk-pane.on{display:block}
    .mk-code{position:absolute;left:0;right:0;top:0;bottom:var(--kb-h,0px);width:100%;border:0;resize:none;padding:12px 14px 60px;background:#1e1f26;color:#e6e6e6!important;font:12.500px/18px ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:0!important;white-space:pre;overflow:auto;tab-size:2}
    .mk-keys{position:absolute;left:0;right:0;bottom:var(--kb-h,0px);height:40px;display:none;align-items:center;gap:6px;padding:0 8px;background:#2a2b33;overflow-x:auto;z-index:2}.mk-ed.kb .mk-keys{display:flex}.mk-ed.kb .mk-code{padding-bottom:50px}
    .mk-keys button{flex:none;min-width:34px;height:30px;border-radius:7px;background:#454752;color:#fff;font:600 14px ui-monospace,Menlo,monospace}.mk-keys button.done{margin-left:auto;background:var(--tint);padding:0 12px;font-family:-apple-system}
    .mk-prevwrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:30px}.mk-phone{width:301.500px;height:655.500px;border-radius:44px;overflow:hidden;background:#000;box-shadow:0 0 0 6px #2c2c2e,0 20px 50px rgba(0,0,0,.35);position:relative}
    .mk-phone iframe{width:402px;height:874px;border:0;transform:scale(.75);transform-origin:0 0;background:#fff}.mk-phone::after{content:'';position:absolute;left:50%;top:8px;width:94px;height:28px;margin-left:-47px;border-radius:14px;background:#000;pointer-events:none}
    .mk-full{position:absolute;inset:0;z-index:20;background:#000}.mk-full iframe{width:100%;height:100%;border:0;background:#fff}.mk-full .x{position:absolute;right:14px;top:58px;z-index:2;padding:7px 14px;border-radius:16px;background:rgba(0,0,0,.55);color:#fff;font-size:14px;font-weight:600;cursor:pointer;backdrop-filter:blur(10px)}
    .mk-iconrow{display:flex;gap:18px;align-items:center;padding:14px 16px}.mk-iconrow .icon-img{width:84px;height:84px;border-radius:19px;font-size:44px;flex:none}
    .mk-sw{display:flex;gap:10px;flex-wrap:wrap;padding:12px 16px}.mk-sw span{width:34px;height:34px;border-radius:50%;cursor:pointer}.mk-sw span.on{outline:3px solid var(--tint);outline-offset:2px}
    .mk-em{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;padding:10px 12px;font-size:24px;text-align:center}.mk-em span{cursor:pointer;border-radius:8px;line-height:32px}.mk-em span.on{background:var(--fill)}
    .mk-ai{padding:0 16px}.mk-ai textarea{width:100%;height:120px;border:0;border-radius:14px;background:var(--cell);padding:14px;resize:none;font-size:16px;line-height:21px}
    .mk-ai .chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}.mk-ai .chips span{padding:7px 12px;border-radius:16px;background:var(--fill2);font-size:13px;cursor:pointer}
    .mk-log{margin-top:16px;border-radius:14px;background:#1e1f26;color:#9ece6a;font:11.500px/16px ui-monospace,Menlo,monospace;letter-spacing:0;padding:12px;height:190px;overflow:hidden;white-space:pre-wrap;word-break:break-all;display:none;position:relative}.mk-log.on{display:block}
    .mk-log::before{content:'';position:absolute;left:0;right:0;top:0;height:50px;background:linear-gradient(#1e1f26,transparent)}
    .mk-tpl{display:flex;align-items:center;gap:14px}.mk-tpl .icon-img{width:48px;height:48px;border-radius:11px;font-size:26px;flex:none}
  `);

  let root, nav, editor = null, previewFrame = null;
  const apps = () => OS.store.get('maker.apps', []);
  const saveApps = (l) => { OS.store.set('maker.apps', l); OS.appstore && OS.appstore.refresh(); };
  const getApp = (id) => apps().find((a) => a.id === id);
  function patch(id, p) { const l = apps(); const a = l.find((x) => x.id === id); if (!a) return null; Object.assign(a, p, { updated: Date.now() }); saveApps(l); return a; }
  const entry = (a) => ({ id: a.id, name: a.name, icon: a.icon, kind: 'maker', html: a.html, statusBar: a.statusBar || 'auto', category: 'Made by You' });

  // preview iframes aren't registered apps — give them a friendly subset of the SDK
  const pvStore = {};
  OS.maker = { onPreviewMessage(e) { const d = e.data; const reply = (v) => { try { e.source.postMessage({ __iphoneHost: true, type: 'reply', reqId: d.reqId, value: v }, '*'); } catch {} };
    if (d.type === 'haptic') OS.haptic(d.value); else if (d.type === 'sound' && typeof d.value === 'string') OS.sound.play(d.value.slice(0, 60)); else if (d.type === 'notify') OS.ui.toast('🔔 ' + String(d.title || '').slice(0, 40));
    else if (d.type === 'storage.get') reply(pvStore[d.key] === undefined ? null : pvStore[d.key]); else if (d.type === 'storage.set') { pvStore[d.key] = d.value; reply(true); } else if (d.type === 'storage.remove') { delete pvStore[d.key]; reply(true); } else if (d.type === 'ready') { try { e.source.postMessage({ __iphoneHost: true, type: 'theme', theme: OS.settings.get('darkMode') ? 'dark' : 'light' }, '*'); } catch {} } } };
  let sdk = ''; fetch('/sdk.js').then((r) => r.text()).then((t) => { sdk = t; });
  function docFor(html) { const boot = `<script>${sdk}<\/script>`; return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + boot) : boot + html; }
  function frame(html) { const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals'); f.srcdoc = docFor(html); return f; }

  // ── AI ──
  const SYSTEM = `You write complete, polished single-file web apps that run inside an iPhone 17 emulator's app sandbox (an <iframe>).
HARD RULES
- Output ONE complete HTML document inside a single \`\`\`html code fence. Nothing else — no explanation before or after.
- The screen is exactly 402x874 CSS px. html,body{margin:0;height:100%;overflow:hidden}. The OS draws the status bar / Dynamic Island over the top 62px and the home indicator over the bottom 34px: backgrounds go edge to edge, but keep text and controls out of those zones (e.g. body padding: 62px 20px 34px).
- People use a MOUSE (and sometimes touch): use click and Pointer Events (pointerdown/move/up, touch-action:none on drag surfaces). Games must be fully playable by pointer; keyboard controls are a bonus only.
- No external requests at all (no CDNs, fonts, images, APIs). Draw with CSS / canvas / inline SVG / emoji. Audio via WebAudio only, created on first pointerdown.
- Look like a great native iOS app: font-family: system-ui, -apple-system, sans-serif (always include system-ui — a bare -apple-system does not resolve in Chrome, including inside the "font:" shorthand on buttons/inputs); rounded cards; smooth transitions; good colour; user-select:none; no scrollbars visible.
- A global "iPhone" SDK already exists (do NOT define or load it): iPhone.haptic('light'|'medium'|'heavy'|'success'|'warning'|'error'), iPhone.sound('pay'|'shutter'|'sent'|'received'|'lock'|'tone:Note'|'ringtone:Marimba'), iPhone.notify(title, body), await iPhone.storage.get(key, fallback), await iPhone.storage.set(key, value), iPhone.onPause(fn), iPhone.onResume(fn), iPhone.setStatusBar('light'|'dark'). localStorage is NOT available — use iPhone.storage. Never call alert/confirm/prompt.
- Must work completely: real game loop / logic, restart flow, saved high score or data where it makes sense. No placeholders, no TODOs. Keep it under ~450 lines.`;
  function extractHTML(text) { const m = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(text); let h = m ? m[1] : text; const i = h.search(/<!doctype html|<html/i); if (i > 0) h = h.slice(i); return /<html|<body|<script|<div/i.test(h) ? h.trim() : null; }

  async function aiBuild(promptText, baseHtml, logEl) {
    logEl.classList.add('on'); logEl.textContent = 'Claude is thinking…';
    const p = baseHtml ? `Here is the current app:\n\`\`\`html\n${baseHtml}\n\`\`\`\n\nChange request: ${promptText}\n\nReturn the COMPLETE updated HTML document.` : `Build this app: ${promptText}`;
    const text = await OS.ai(p, { system: SYSTEM, fast: false, timeout: 280000, onText(t) { const lines = t.split('\n'); logEl.textContent = `✍️ writing… ${lines.length} lines\n` + lines.slice(-11).join('\n'); } });
    const html = extractHTML(text); if (!html) throw new Error('No code came back'); return html;
  }

  // ── pages ──
  function homePage() {
    return { title: 'App Maker', largeTitle: true, background: 'var(--bg2)', render(body) {
      const draw = () => {
        body.querySelectorAll('.mk-dyn').forEach((n) => n.remove()); const wrap = el('<div class="mk-dyn"></div>');
        const hero = el('<div class="mk-hero"><h2>Make your own app</h2><p>Describe an idea and Claude builds it, start from a template, or write the code yourself. Then put it on your Home Screen — or publish it to the App Store.</p><button>＋ New App</button></div>'); hero.querySelector('button').addEventListener('click', newAppSheet); wrap.appendChild(hero);
        const list = apps(); if (list.length) wrap.appendChild(el('<div class="ios-list-header" style="margin-top:0">My Apps</div>'));
        const grid = el('<div class="mk-grid"></div>');
        list.slice().reverse().forEach((a) => { const c = el(`<div class="mk-card">${OS.iconHTML(a)}<b>${esc(a.name)}</b><small>${OS.webapps.isInstalled(a.id) ? 'On Home Screen' : 'Draft'}${a.published ? ' · Published' : ''}</small></div>`); c.addEventListener('click', () => openEditor(a.id)); grid.appendChild(c); });
        const n = el('<div class="mk-card new"><span>＋</span>New App</div>'); n.addEventListener('click', newAppSheet); grid.appendChild(n); wrap.appendChild(grid); body.appendChild(wrap);
      };
      draw(); OS.store.on('maker.apps', draw); OS.on('apps:change', draw);
    } };
  }

  function create(name, html, g, glyph) { const a = { id: 'mk' + uid(), name, html, icon: { bg: grad(GRADS[g]), glyph }, grad: g, statusBar: 'auto', published: false, created: Date.now(), updated: Date.now() }; saveApps([...apps(), a]); return a; }

  function newAppSheet() {
    OS.ui.sheet({ title: 'New App', left: { label: 'Cancel' }, render(body, sh) {
      const ai = el(`<div class="mk-ai"><div class="ios-list-header" style="margin-left:16px">Describe your app — Claude builds it</div><textarea placeholder="A game where you catch falling stars with a basket, gets faster over time, saves my high score…" enterkeyhint="done"></textarea>
        <div class="chips"><span>Flappy rocket game</span><span>Pixel art editor 16×16</span><span>Reaction time tester</span><span>Magic 8 ball</span><span>Space shooter</span><span>Habit streak tracker</span></div><button class="ios-btn">✨ Build with Claude</button><div class="mk-log"></div></div>`);
      const ta = ai.querySelector('textarea'), log = ai.querySelector('.mk-log'), go = ai.querySelector('.ios-btn');
      ai.querySelectorAll('.chips span').forEach((c) => c.addEventListener('click', () => { ta.value = c.textContent; }));
      go.addEventListener('click', async () => {
        const text = ta.value.trim(); if (!text) return OS.ui.toast('Describe your app first'); ta.blur(); go.style.opacity = '.5'; go.style.pointerEvents = 'none'; go.textContent = 'Building… (about a minute)';
        try { const html = await aiBuild(text, null, log); const nm = (/<title>([^<]{1,24})<\/title>/i.exec(html) || [])[1] || text.split(/\s+/).slice(0, 2).join(' '); const a = create(nm.trim().slice(0, 18) || 'My App', html, Math.floor(Math.random() * GRADS.length), '✨'); OS.haptic('success'); OS.sound.play('pay'); sh.close(); openEditor(a.id, 'preview'); }
        catch (e) { log.classList.remove('on'); go.style.opacity = ''; go.style.pointerEvents = ''; go.textContent = '✨ Build with Claude'; OS.haptic('error'); OS.ui.alert({ title: 'Claude couldn’t build it', message: 'The AI builder needs the emulator server running with Claude Code installed. You can still start from a template.' }); }
      });
      body.appendChild(ai); body.appendChild(el('<div class="ios-list-header">Or start from a template</div>'));
      const l = el('<div class="ios-list"></div>');
      TEMPLATES.forEach((t) => { const r = el(`<div class="ios-row tappable mk-tpl"><div class="icon-img" style="background:${grad(GRADS[t.grad])}"><span>${t.emoji}</span></div><span class="ios-row-label">${esc(t.name)}<span class="ios-row-sub">${esc(t.desc)}</span></span><span class="ios-chevron"></span></div>`); r.addEventListener('click', async () => { const nm = await OS.ui.prompt({ title: 'Name your app', value: t.name === 'Blank' ? 'My App' : t.name, okLabel: 'Create' }); if (!nm) return; const a = create(nm.trim().slice(0, 18), t.html, t.grad, t.emoji); sh.close(); openEditor(a.id, 'code'); }); l.appendChild(r); });
      body.appendChild(l); body.appendChild(el('<div style="height:40px"></div>'));
    } });
  }

  function openEditor(id, startTab = 'design') {
    const a0 = getApp(id); if (!a0) return; closeEditor(true);
    const ed = editor = el(`<div class="mk-ed"><div class="mk-top"><div class="nv-back"><span>Apps</span></div><div class="ttl"></div><button class="run">▶ Run</button><div class="nv-btn more" style="font-size:22px;padding:0 4px">⋯</div></div>
      <div class="mk-seg"><div class="ios-seg"><button data-t="design">Design</button><button data-t="code">Code</button><button data-t="preview">Preview</button><button data-t="ai">✨ AI</button></div></div>
      <div class="mk-pane ios-scroll" data-p="design"></div><div class="mk-pane" data-p="code"><textarea class="mk-code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea><div class="mk-keys"></div></div><div class="mk-pane" data-p="preview"><div class="mk-prevwrap"><div class="mk-phone"></div></div></div><div class="mk-pane ios-scroll" data-p="ai"></div></div>`);
    root.appendChild(ed); ed.getBoundingClientRect(); requestAnimationFrame(() => ed.classList.add('in'));
    const A = () => getApp(id); const code = ed.querySelector('.mk-code'); code.value = a0.html; ed.querySelector('.ttl').textContent = a0.name;
    let dirtyTimer = 0; code.addEventListener('input', () => { clearTimeout(dirtyTimer); dirtyTimer = setTimeout(() => patch(id, { html: code.value }), 400); });
    code.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); } });
    code.addEventListener('focus', () => ed.classList.add('kb')); code.addEventListener('blur', () => ed.classList.remove('kb'));
    const keys = ed.querySelector('.mk-keys'); ['<', '>', '/', '{', '}', '(', ')', ';', '=', '"', "'", '.', ':', '#', '[', ']', '+', '-', '*', '!', '&', '|', '$', '_'].forEach((k) => { const b = el(`<button>${esc(k)}</button>`); b.addEventListener('pointerdown', (e) => { e.preventDefault(); document.execCommand('insertText', false, k); OS.sound.play('key'); }); keys.appendChild(b); });
    const doneB = el('<button class="done">Done</button>'); doneB.addEventListener('pointerdown', (e) => { e.preventDefault(); code.blur(); }); keys.appendChild(doneB);

    const flush = () => { clearTimeout(dirtyTimer); if (A() && A().html !== code.value) patch(id, { html: code.value }); };
    const show = (t) => { flush(); ed.querySelectorAll('.ios-seg button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); ed.querySelectorAll('.mk-pane').forEach((p) => p.classList.toggle('on', p.dataset.p === t)); code.blur(); const ph = ed.querySelector('.mk-phone'); ph.innerHTML = ''; if (t === 'preview') ph.appendChild(frame(A().html)); if (t === 'design') design(); if (t === 'ai') aiPane(); };
    ed.querySelectorAll('.ios-seg button').forEach((b) => b.addEventListener('click', () => { show(b.dataset.t); OS.haptic('selection'); }));
    ed.querySelector('.nv-back').addEventListener('click', () => { flush(); closeEditor(); });
    ed.querySelector('.run').addEventListener('click', () => { flush(); const full = el('<div class="mk-full"><div class="x">✕ Stop</div></div>'); full.appendChild(frame(A().html)); full.querySelector('.x').addEventListener('click', () => full.remove()); ed.appendChild(full); OS.haptic('medium'); });
    ed.querySelector('.more').addEventListener('click', (e) => OS.ui.contextMenu(e.currentTarget, [
      { label: 'Duplicate', icon: '⧉', onTap() { flush(); const s = A(); const c = create((s.name + ' 2').slice(0, 18), s.html, s.grad || 0, s.icon.glyph); OS.ui.toast('Duplicated'); openEditor(c.id); } },
      { label: 'Export .html', icon: '⬇︎', onTap() { flush(); const b = new Blob([A().html], { type: 'text/html' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = A().name.replace(/[^\w-]+/g, '_') + '.html'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); } },
      { label: 'Delete App', icon: '🗑', style: 'destructive', async onTap() { const i = await OS.ui.actionSheet({ message: `Delete “${A().name}”? This also removes it from the Home Screen and App Store.`, buttons: [{ label: 'Delete', style: 'destructive' }] }); if (i !== 0) return; if (OS.webapps.isInstalled(id)) OS.webapps.uninstall(id); saveApps(apps().filter((x) => x.id !== id)); OS.sound.play('trash'); closeEditor(); } },
    ]));

    function design() {
      const pane = ed.querySelector('[data-p="design"]'); const a = A(); pane.innerHTML = '';
      const iconRow = el(`<div class="ios-list"><div class="mk-iconrow">${OS.iconHTML(a)}<div style="flex:1;min-width:0"><input class="ios-input nm" value="${esc(a.name)}" maxlength="18" placeholder="App name" enterkeyhint="done"><div style="font-size:13px;color:var(--label2);margin-top:6px">Shown under the icon on the Home Screen</div></div></div></div>`); pane.appendChild(iconRow);
      const refreshIcon = () => { iconRow.querySelector('.icon-img').outerHTML = OS.iconHTML(A()); if (OS.webapps.isInstalled(id)) OS.webapps.update(id, entry(A())); };
      iconRow.querySelector('.nm').addEventListener('change', (e) => { const v = e.target.value.trim() || 'My App'; patch(id, { name: v }); ed.querySelector('.ttl').textContent = v; refreshIcon(); });
      pane.appendChild(el('<div class="ios-list-header">Icon colour</div>')); const sw = el('<div class="ios-list"><div class="mk-sw"></div></div>'); GRADS.forEach((g, i) => { const s = el(`<span class="${(a.grad || 0) === i ? 'on' : ''}" style="background:${grad(g)}"></span>`); s.addEventListener('click', () => { patch(id, { grad: i, icon: { ...A().icon, bg: grad(g) } }); sw.querySelectorAll('span').forEach((x) => x.classList.toggle('on', x === s)); refreshIcon(); OS.haptic('selection'); }); sw.firstElementChild.appendChild(s); }); pane.appendChild(sw);
      pane.appendChild(el('<div class="ios-list-header">Icon symbol</div>')); const em = el('<div class="ios-list"><div class="mk-em"></div><div class="ios-row"><span class="ios-row-label">Or use a letter</span><input type="text" maxlength="2" style="text-align:right;width:70px;flex:none" placeholder="A" class="lt"></div></div>');
      EMOJI.forEach((e) => { const s = el(`<span class="${a.icon.glyph === e ? 'on' : ''}">${e}</span>`); s.addEventListener('click', () => { patch(id, { icon: { ...A().icon, glyph: e } }); em.querySelectorAll('.mk-em span').forEach((x) => x.classList.toggle('on', x === s)); refreshIcon(); OS.haptic('selection'); }); em.firstElementChild.appendChild(s); });
      em.querySelector('.lt').addEventListener('input', (e) => { const v = e.target.value.trim(); if (v) { patch(id, { icon: { ...A().icon, glyph: v } }); refreshIcon(); } }); pane.appendChild(em);
      const stat = el(`<div class="ios-list" style="margin-top:35px"><div class="ios-row"><span class="ios-row-label">Status bar text</span><div class="ios-seg" style="width:190px"><button data-v="auto">Auto</button><button data-v="dark">Black</button><button data-v="light">White</button></div></div></div>`); stat.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', (a.statusBar || 'auto') === b.dataset.v); b.addEventListener('click', () => { patch(id, { statusBar: b.dataset.v }); stat.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (OS.webapps.isInstalled(id)) OS.webapps.update(id, entry(A())); }); }); pane.appendChild(stat);
      const act = el('<div style="padding:30px 16px 60px;display:flex;flex-direction:column;gap:12px"></div>'); const inst = OS.webapps.isInstalled(id);
      const b1 = el(`<button class="ios-btn">${inst ? 'Update on Home Screen' : 'Add to Home Screen'}</button>`); b1.addEventListener('click', async () => { flush(); if (inst) { OS.webapps.update(id, entry(A())); OS.ui.toast('Updated'); OS.haptic('success'); return; } closeEditor(); OS.goHome(); await OS.util.wait(450); OS.webapps.install(entry(A()), { duration: 2200 }); setTimeout(() => OS.home.showApp(id), 50); }); act.appendChild(b1);
      const b2 = el(`<button class="ios-btn gray">${a.published ? 'Remove from App Store' : 'Publish to App Store'}</button>`); b2.addEventListener('click', async () => { if (!A().published) { const sub = await OS.ui.prompt({ title: 'Publish to App Store', message: 'Write a short subtitle for your store page.', value: A().subtitle || '', placeholder: 'The best app ever made', okLabel: 'Publish' }); if (sub == null) return; patch(id, { published: true, subtitle: sub.slice(0, 40) }); OS.sound.play('pay'); OS.haptic('success'); OS.notify({ appId: 'appstore', title: 'App Store', body: `“${A().name}” is now live on the App Store.`, sound: false, onTap: () => OS.openApp('appstore', { app: id }) }); } else patch(id, { published: false }); design(); }); act.appendChild(b2);
      pane.appendChild(act);
    }
    function aiPane() {
      const pane = ed.querySelector('[data-p="ai"]'); pane.innerHTML = '';
      const box = el(`<div class="mk-ai" style="padding-top:4px"><div class="ios-list-header" style="margin-left:16px;margin-top:6px">Ask Claude to change this app</div><textarea placeholder="Make the background dark blue, add a high score, and make it speed up every 10 points…" enterkeyhint="done"></textarea><div class="chips"><span>Add sound effects</span><span>Add a high score that saves</span><span>Make it look more colourful</span><span>Add a start screen</span><span>Fix any bugs you can find</span></div><button class="ios-btn">✨ Apply with Claude</button><div class="mk-log"></div><div class="ios-list-footer" style="margin:14px 16px">Claude rewrites the whole file. Your current code is kept as an undo step (⌘Z in the Code tab won’t bring it back — use “Undo last AI change” here).</div></div>`);
      const ta = box.querySelector('textarea'), log = box.querySelector('.mk-log'), go = box.querySelector('.ios-btn'); box.querySelectorAll('.chips span').forEach((c) => c.addEventListener('click', () => { ta.value = c.textContent; }));
      if (A().prevHtml) { const u = el('<button class="ios-btn gray" style="margin-top:10px">Undo last AI change</button>'); u.addEventListener('click', () => { const p = A().prevHtml; patch(id, { html: p, prevHtml: null }); code.value = p; OS.ui.toast('Reverted'); aiPane(); }); box.insertBefore(u, log); }
      go.addEventListener('click', async () => { const text = ta.value.trim(); if (!text) return OS.ui.toast('Say what to change'); flush(); ta.blur(); go.style.opacity = '.5'; go.style.pointerEvents = 'none'; go.textContent = 'Working…';
        try { const before = A().html; const html = await aiBuild(text, before, log); if (!editor || editor !== ed) return; patch(id, { html, prevHtml: before }); code.value = html; OS.haptic('success'); if (OS.webapps.isInstalled(id)) OS.webapps.update(id, entry(A())); show('preview'); }
        catch (e) { log.classList.remove('on'); OS.haptic('error'); OS.ui.alert({ title: 'Claude couldn’t do that', message: 'Make sure the emulator server is running with Claude Code installed, then try again.' }); }
        go.style.opacity = ''; go.style.pointerEvents = ''; go.textContent = '✨ Apply with Claude'; });
      pane.appendChild(box);
    }
    show(startTab);
  }
  function closeEditor(instant) { if (!editor) return; const ed = editor; editor = null; const c = ed.querySelector('.mk-code'); c && c.blur(); if (instant) return ed.remove(); ed.classList.remove('in'); setTimeout(() => ed.remove(), 430); }

  OS.registerApp({
    id: 'appmaker', name: 'App Maker', system: true, statusBar: 'auto', background: 'var(--bg2)',
    icon: { bg: 'linear-gradient(150deg,#5E5CE6,#BF5AF2 55%,#FF375F)', glyph: '<svg viewBox="0 0 60 60"><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20 11 30l11 10M38 20l11 10-11 10"/><path d="M33.500 15.500 26.500 44.500"/></g><path d="M46 8l1.600 4.400L52 14l-4.400 1.600L46 20l-1.600-4.400L40 14l4.400-1.600z" fill="#fff"/></svg>' },
    launch(ctx) { root = ctx.root; nav = OS.ui.createNav(root); nav.push(homePage()); },
    onResume(ctx, params) { if (params && params.edit) openEditor(params.edit); },
    onClose() { editor = null; },
  });
})();
