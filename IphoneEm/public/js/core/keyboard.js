// System keyboard: raises for any text field on the screen, types with the real key-click recordings.
(function () {
  const { el, esc } = OS.util;
  const HEIGHT = 336, PAD_HEIGHT = 300;
  let kb, target = null, layout = 'letters', shift = false, caps = false, lastShiftTap = 0, hideTimer = 0, visible = false;

  const ROWS = {
    letters: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    numbers: ['1234567890', '-/:;()$&@"', '.,?!\''],
    symbols: ['[]{}#%^*+=', '_\\|~<>€£¥•', '.,?!\''],
  };
  const EMOJI = '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤔 🤨 😐 😏 😒 🙄 😬 😴 🤤 😷 🤒 🥵 🥶 🤯 🤠 🥳 😎 🤓 😕 😮 😳 🥺 😢 😭 😱 😤 😡 🤬 💀 👻 👽 🤖 💩 😺 🙈 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💯 💥 ✨ 🔥 ⭐ 🌈 ☀️ 🌙 ⚡ ❄️ 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 🤞 👀 🎉 🎂 🎁 🏆 ⚽ 🏀 🏈 🎮 🕹️ 🎧 🎸 🚀 ✈️ 🚗 🍕 🍔 🍟 🌮 🍩 🍪 🍎 🍓 🐶 🐱 🦊 🐼 🦄 🐢 🦖 🐙'.split(' ');
  const WORDS = 'the to and you that it of in is for on with this have be are not but what all was can your one my out just about get like up when if me so do know time there would see they we he she will good going think want really yeah okay thanks thank please sorry love game games play playing school home tonight tomorrow today later soon great awesome cool nice right here where how why because maybe sure come coming call text phone photo picture make making made build building code coding project scratch roblox minecraft level score player friend friends mom dad dinner lunch practice homework weekend morning night happy birthday hello hey what\'s that\'s don\'t can\'t i\'m it\'s let\'s'.split(' ');

  const isField = (n) => {
    if (!n || !n.closest || !n.closest('#screen')) return false;
    if (n.isContentEditable) return true;
    if (n.tagName === 'TEXTAREA') return !n.readOnly && !n.disabled;
    if (n.tagName === 'INPUT') return !n.readOnly && !n.disabled && !/^(checkbox|radio|range|button|submit|file|color|date|time|datetime-local|month|week|image|reset|hidden)$/i.test(n.type);
    return false;
  };
  const modeFor = (n) => {
    const im = (n.getAttribute('inputmode') || '').toLowerCase(); const t = (n.type || '').toLowerCase();
    if (im === 'numeric' || im === 'decimal' || im === 'tel' || t === 'tel' || t === 'number') return im === 'decimal' || t === 'number' ? 'decimal' : im === 'tel' || t === 'tel' ? 'tel' : 'numeric';
    return 'text';
  };

  function curValue() { return !target ? '' : target.isContentEditable ? (target.textContent || '') : (target.value || ''); }
  function autoShift() {
    if (!target || caps) return;
    const t = (target.type || '').toLowerCase(); const ac = (target.getAttribute('autocapitalize') || '').toLowerCase();
    if (/^(email|url|password|search)$/.test(t) && ac !== 'sentences' || ac === 'off' || ac === 'none' || /^(email|url)$/.test((target.getAttribute('inputmode') || ''))) { shift = false; return; }
    let before = curValue();
    try { if (!target.isContentEditable && target.selectionStart != null) before = before.slice(0, target.selectionStart); } catch {}
    shift = before.length === 0 || /[.!?]\s+$/.test(before) || /\n$/.test(before);
  }

  // ── text operations (execCommand keeps undo + fires native input events) ──
  function insert(text) {
    if (!target) return;
    target.focus({ preventScroll: true });
    let ok = false; try { ok = document.execCommand('insertText', false, text); } catch {}
    if (!ok && !target.isContentEditable) {
      try { const s = target.selectionStart, e = target.selectionEnd; target.setRangeText(text, s, e, 'end'); } catch { target.value += text; }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
  }
  function backspace() {
    if (!target) return;
    target.focus({ preventScroll: true });
    let ok = false; try { ok = document.execCommand('delete', false); } catch {}
    if (!ok && !target.isContentEditable) {
      try { const s = target.selectionStart, e = target.selectionEnd; if (s === e && s > 0) target.setRangeText('', s - 1, s, 'end'); else target.setRangeText('', s, e, 'end'); } catch { target.value = target.value.slice(0, -1); }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
  }
  function enter() {
    if (!target) return;
    const mk = (type) => new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
    const notCancelled = target.dispatchEvent(mk('keydown'));
    target.dispatchEvent(mk('keyup'));
    if (!notCancelled) return;
    if (target.tagName === 'TEXTAREA') insert('\n');
    else if (target.isContentEditable) { try { document.execCommand('insertParagraph'); } catch { insert('\n'); } }
    else { target.dispatchEvent(new Event('change', { bubbles: true })); const f = target.form; if (f) f.requestSubmit ? f.requestSubmit() : f.submit(); const hint = target.getAttribute('enterkeyhint'); if (hint !== 'next') target.blur(); }
  }

  // ── suggestions ──
  function currentWord() {
    if (!target || target.isContentEditable) return '';
    let v = curValue(); try { if (target.selectionStart != null) v = v.slice(0, target.selectionStart); } catch {}
    const m = /([A-Za-z']+)$/.exec(v); return m ? m[1] : '';
  }
  function renderSugg() {
    const bar = kb.querySelector('.kb-sugg'); if (!bar) return;
    const w = currentWord(); let list;
    const t = target && (target.type || '').toLowerCase();
    if (t === 'password' || t === 'email' || t === 'url') { bar.innerHTML = '<span></span><span></span><span></span>'; return; }
    if (!w) list = ['I', 'The', 'I’m'];
    else { const lw = w.toLowerCase(); const c = WORDS.filter((x) => x.startsWith(lw) && x !== lw).slice(0, 2); list = [`“${w}”`, ...c]; while (list.length < 3) list.push(''); }
    bar.innerHTML = list.map((s) => `<span>${esc(s)}</span>`).join('');
  }
  function applySugg(text) {
    if (!text) return; const w = currentWord();
    let word = text.replace(/^“|”$/g, '');
    if (w && /^[A-Z]/.test(w) && !/^“/.test(text)) word = word[0].toUpperCase() + word.slice(1);
    for (let i = 0; i < w.length; i++) backspace();
    insert(word + ' '); OS.sound.play('key'); after();
  }

  // ── rendering ──
  const SHIFT_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3.5 3.500 12.500h4.700V19h7.600v-6.500h4.700z" stroke-linejoin="round"/></svg>';
  const DEL_SVG = '<svg viewBox="0 0 26 24"><path d="M9 4.500h12.500a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9L2.500 12z" stroke-linejoin="round"/><path d="m12.500 9 6 6m0-6-6 6" stroke-linecap="round"/></svg>';
  function keyHTML(ch) { const shown = layout === 'letters' && (shift || caps) ? ch.toUpperCase() : ch; return `<div class="kb-key" data-k="${esc(shown)}">${esc(shown)}<div class="kb-pop">${esc(shown)}</div></div>`; }
  function retLabel() { const h = target && (target.getAttribute('enterkeyhint') || '').toLowerCase(); return ({ search: 'search', go: 'go', send: 'send', done: 'done', next: 'next' })[h] || 'return'; }

  function render() {
    const mode = target ? modeFor(target) : 'text';
    kb.classList.toggle('pad', mode !== 'text');
    if (mode !== 'text') {
      const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
      let h = '<div class="kb-pad">';
      for (let i = 1; i <= 9; i++) h += `<div class="kb-key" data-k="${i}">${i}<small>${letters[i - 1]}</small></div>`;
      h += mode === 'decimal' ? '<div class="kb-key" data-k=".">.</div>' : mode === 'tel' ? '<div class="kb-key" data-k="+" style="font-size:20px">+ ✱ #</div>' : '<div class="kb-key clear"></div>';
      h += `<div class="kb-key" data-k="0">0</div><div class="kb-key clear sp" data-a="del" style="background:none;box-shadow:none">${DEL_SVG}</div></div>`;
      kb.innerHTML = h; return;
    }
    if (layout === 'emoji') {
      kb.innerHTML = `<div class="kb-sugg" style="padding:0 14px;font-size:13px;font-weight:600;opacity:.6;text-transform:uppercase;letter-spacing:.3px">Smileys &amp; more</div><div class="kb-emoji ios-scroll">${EMOJI.map((e) => `<span data-k="${e}">${e}</span>`).join('')}</div>
        <div class="kb-bottom" style="align-items:flex-start"><div class="kb-key sp n123" data-a="abc" style="box-shadow:none;background:none;font-weight:500">ABC</div><div class="kb-key sp" data-a="del" style="box-shadow:none;background:none">${DEL_SVG}</div></div>`;
      return;
    }
    const rows = ROWS[layout]; const isL = layout === 'letters'; const ret = retLabel();
    kb.innerHTML = `<div class="kb-sugg"></div><div class="kb-rows ${isL ? '' : 'kb-num'}">
      <div class="kb-row">${[...rows[0]].map(keyHTML).join('')}</div>
      <div class="kb-row">${[...rows[1]].map(keyHTML).join('')}</div>
      <div class="kb-row r3"><div class="kb-key sp w15 shift ${shift ? 'on' : ''} ${caps ? 'on caps' : ''}" data-a="${isL ? 'shift' : 'alt'}" style="margin-right:${isL ? 13 : 14}px">${isL ? SHIFT_SVG : (layout === 'numbers' ? '#+=' : '123')}</div>
        ${[...rows[2]].map((c) => isL ? keyHTML(c) : keyHTML(c).replace('class="kb-key"', 'class="kb-key mid"')).join('')}
        <div class="kb-key sp w15" data-a="del" style="margin-left:${isL ? 13 : 14}px">${DEL_SVG}</div></div>
      <div class="kb-row"><div class="kb-key sp n123" data-a="${isL ? '123' : 'abc'}">${isL ? '123' : 'ABC'}</div><div class="kb-key sp emo" data-a="emoji">☺</div>
        <div class="kb-key space" data-a="space">space</div><div class="kb-key sp ret ${ret !== 'return' && ret !== 'next' ? 'blue' : ''}" data-a="ret">${ret}</div></div>
    </div><div class="kb-bottom"><svg viewBox="0 0 28 28" data-a="globe"><circle cx="14" cy="14" r="10.5" fill="none" stroke="currentColor" stroke-width="1.700"/><ellipse cx="14" cy="14" rx="4.500" ry="10.500" fill="none" stroke="currentColor" stroke-width="1.700"/><path d="M3.500 14h21M5 8.500h18M5 19.500h18" stroke="currentColor" stroke-width="1.700" fill="none"/></svg>
      <svg viewBox="0 0 28 28" data-a="mic"><rect x="10.500" y="3" width="7" height="14" rx="3.500"/><path d="M6.500 13.500a7.500 7.500 0 0 0 15 0M14 21v4" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/></svg></div>`;
    kb.querySelectorAll('.kb-key.sp svg').forEach((s) => { if (!s.closest('.kb-bottom')) { s.style.fill = 'none'; s.style.stroke = 'currentColor'; } });
    if (caps) { const s = kb.querySelector('.shift svg'); if (s) s.style.fill = 'currentColor'; }
    renderSugg();
  }
  function after() { const wasShift = shift; autoShift(); if (layout === 'letters' && wasShift !== shift) render(); else renderSugg(); }

  // ── key handling ──
  let repeatTimer = 0, repeatInt = 0;
  function press(keyEl) {
    const a = keyEl.dataset.a, k = keyEl.dataset.k;
    if (k != null) {
      insert(k); OS.sound.play('key');
      if (layout === 'letters' && shift && !caps) { shift = false; render(); } else if (layout !== 'letters' && layout !== 'emoji' && k === "'") { layout = 'letters'; render(); }
      if (kb.classList.contains('pad') || layout === 'emoji') return; after(); return;
    }
    switch (a) {
      case 'del': backspace(); OS.sound.play('key_delete'); after(); break;
      case 'space': {
        const v = curValue(); const now = performance.now();
        if (press._lastSpace && now - press._lastSpace < 350 && / $/.test(v) && /\w $/.test(v)) { backspace(); insert('. '); } else insert(' ');
        press._lastSpace = now; OS.sound.play('key_modifier'); if (layout !== 'letters' && layout !== 'emoji') layout = 'letters'; autoShift(); render(); break;
      }
      case 'ret': OS.sound.play('key_modifier'); enter(); if (target) after(); break;
      case 'shift': { const now = performance.now(); if (now - lastShiftTap < 320) { caps = true; shift = true; } else if (caps) { caps = false; shift = false; } else shift = !shift; lastShiftTap = now; OS.sound.play('key_modifier'); render(); break; }
      case 'alt': layout = layout === 'numbers' ? 'symbols' : 'numbers'; OS.sound.play('key_modifier'); render(); break;
      case '123': layout = 'numbers'; OS.sound.play('key_modifier'); render(); break;
      case 'abc': layout = 'letters'; OS.sound.play('key_modifier'); render(); break;
      case 'emoji': case 'globe': layout = layout === 'emoji' ? 'letters' : 'emoji'; OS.sound.play('key_modifier'); render(); break;
      case 'mic': dictate(); break;
    }
  }
  function dictate() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return OS.ui.toast('Dictation isn’t available');
    try { const r = new SR(); r.lang = 'en-US'; r.interimResults = false; OS.sound.play('begin_record'); r.onresult = (e) => { insert(e.results[0][0].transcript + ' '); after(); }; r.onend = () => OS.sound.play('end_record'); r.start(); } catch { OS.ui.toast('Dictation isn’t available'); }
  }

  function show(n) {
    clearTimeout(hideTimer); const changed = target !== n; target = n;
    if (changed) { layout = 'letters'; caps = false; autoShift(); }
    render();
    const h = kb.classList.contains('pad') ? PAD_HEIGHT : HEIGHT; kb.style.height = h + 'px';
    if (!visible) { visible = true; kb.classList.add('up'); }
    OS.screen.style.setProperty('--kb-h', h + 'px'); OS.emit('keyboard', { visible: true, height: h });
    // keep the caret visible inside its own scroller, never let the screen itself scroll
    setTimeout(() => { if (target !== n) return; const sc = n.closest('.ios-scroll'); if (!sc) return; const r = OS.util.rect(n), limit = OS.H - h - 60; if (r.y + Math.min(r.h, 60) > limit) sc.scrollTop += r.y + Math.min(r.h, 60) - limit; }, 360);
  }
  function hide(immediate) {
    clearTimeout(hideTimer);
    const go = () => { if (!visible) return; visible = false; target = null; kb.classList.remove('up'); OS.screen.style.setProperty('--kb-h', '0px'); OS.emit('keyboard', { visible: false, height: 0 }); };
    if (immediate) { const a = document.activeElement; if (isField(a)) a.blur(); go(); } else hideTimer = setTimeout(go, 60);
  }

  OS.keyboard = { get visible() { return visible; }, get height() { return visible ? (kb.classList.contains('pad') ? PAD_HEIGHT : HEIGHT) : 0; }, hide, show };

  OS.initKeyboard = function () {
    kb = document.getElementById('keyboard');
    document.addEventListener('focusin', (e) => { if (isField(e.target)) { if (OS.lock && OS.lock.locked && !e.target.closest('#lock')) return; show(e.target); } });
    document.addEventListener('focusout', (e) => { if (isField(e.target)) hide(); });
    // never steal focus from the field
    kb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const sg = e.target.closest('.kb-sugg span'); if (sg) return applySugg(sg.textContent);
      const key = e.target.closest('[data-k],[data-a]'); if (!key) return;
      key.classList.add('down'); press(key);
      if (key.dataset.a === 'del') { repeatTimer = setTimeout(() => { repeatInt = setInterval(() => { backspace(); OS.sound.play('key_delete', { volume: .7 }); }, 85); }, 420); }
      const up = () => { clearTimeout(repeatTimer); clearInterval(repeatInt); kb.querySelectorAll('.down').forEach((k) => k.classList.remove('down')); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); after0(); };
      const after0 = () => {};
      window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    });
    kb.addEventListener('mousedown', (e) => e.preventDefault());
    // the browser may try to scroll clipped ancestors to reveal a focused field — pin them
    OS.screen.addEventListener('scroll', (e) => { const t = e.target; if (t === OS.screen || (t.classList && (t.classList.contains('app-root') || t.classList.contains('app-window') || t.classList.contains('nv') || t.classList.contains('nv-page')))) { t.scrollTop = 0; t.scrollLeft = 0; } }, true);
    document.addEventListener('selectionchange', () => { if (visible && target && layout === 'letters') renderSugg(); });
  };
})();
