// Dynamic Island: live activities (compact leading/trailing), expanded view on long-press, and transient system alerts.
(function () {
  const { el } = OS.util;
  let isl, lead, trail, exp; const acts = []; let transient = null, transientTimer = 0, expandedId = null, expandTimer = 0;

  const current = () => { for (let i = acts.length - 1; i >= 0; i--) { const a = acts[i]; if (a.appId && a.appId === OS.activeApp && !(OS.lock && OS.lock.locked) && !OS.switcherOpen) continue; return a; } return null; };

  function render() {
    if (!isl) return;
    isl.classList.remove('compact', 'wide', 'expanded', 'tall', 'square');
    if (transient) {
      exp.innerHTML = transient.html; isl.classList.add(transient.square ? 'square' : 'expanded'); if (transient.tall) isl.classList.add('tall');
      lead.innerHTML = ''; trail.innerHTML = ''; return;
    }
    const a = current();
    if (!a) { lead.innerHTML = ''; trail.innerHTML = ''; exp.innerHTML = ''; return; }
    if (expandedId === a.id && a.expanded) { exp.innerHTML = typeof a.expanded === 'function' ? a.expanded() : a.expanded; isl.classList.add('expanded'); if (a.tall) isl.classList.add('tall'); return; }
    lead.innerHTML = a.leading || ''; trail.innerHTML = a.trailing || ''; exp.innerHTML = '';
    isl.classList.add('compact'); if (a.wide) isl.classList.add('wide');
  }

  OS.island = {
    start(a) { const i = acts.findIndex((x) => x.id === a.id); if (i >= 0) acts.splice(i, 1); acts.push({ ...a }); render(); bump(); },
    update(id, patch) {
      const a = acts.find((x) => x.id === id); if (!a) return; Object.assign(a, patch);
      if (transient) return;
      if (current() === a) { if (expandedId === id && a.expanded) exp.innerHTML = typeof a.expanded === 'function' ? a.expanded() : a.expanded; else { if ('leading' in patch) lead.innerHTML = a.leading || ''; if ('trailing' in patch) trail.innerHTML = a.trailing || ''; } }
    },
    end(id) { const i = acts.findIndex((x) => x.id === id); if (i >= 0) { acts.splice(i, 1); if (expandedId === id) expandedId = null; render(); } },
    endForApp(appId) { for (let i = acts.length - 1; i >= 0; i--) if (acts[i].appId === appId) acts.splice(i, 1); render(); },
    has(id) { return acts.some((x) => x.id === id); },
    // transient system presentation (Face ID, silent switch, charging…)
    flash({ html, ms = 1800, square = false, tall = false }) { transient = { html, square, tall }; render(); clearTimeout(transientTimer); transientTimer = setTimeout(() => { transient = null; render(); }, ms); },
    clearFlash() { clearTimeout(transientTimer); transient = null; render(); },
    refresh: render,
  };
  function bump() { isl.classList.add('bump'); setTimeout(() => isl.classList.remove('bump'), 260); }

  OS.initIsland = function () {
    isl = document.getElementById('island');
    lead = el('<div class="isl-lead"></div>'); trail = el('<div class="isl-trail"></div>'); exp = el('<div class="isl-exp"></div>');
    isl.append(lead, trail, exp);
    isl.addEventListener('click', (e) => {
      if (transient) return;
      const a = current(); if (!a) return bump();
      if (expandedId === a.id && e.target.closest('[data-isl]')) return;      // controls inside the expanded view handle themselves
      clearTimeout(expandTimer); expandedId = null;
      if (a.onTap) a.onTap(); else if (a.appId) OS.openApp(a.appId);
      render();
    });
    OS.util.longPress(isl, () => {
      const a = current(); if (!a || !a.expanded || transient) return;
      expandedId = a.id; render(); clearTimeout(expandTimer); expandTimer = setTimeout(() => { expandedId = null; render(); }, 5000);
    }, 380);
    ['appopen', 'appclose', 'lock', 'unlock'].forEach((ev) => OS.on(ev, () => { expandedId = null; render(); }));
  };
})();
