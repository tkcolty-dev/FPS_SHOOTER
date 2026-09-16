// --- scratch.mit.edu glue: find the running VM and plug the block category in, live ---
(function () {
  'use strict';
  if (window.__cloudplugInstalled) return; window.__cloudplugInstalled = true;
  const cfg = (() => { try { return JSON.parse(document.documentElement.dataset.cloudplug || '{}'); } catch { return {}; } })();
  const SERVER = cfg.server || '__SERVER__';
  let vm = null, ext = null, pill = null;

  const projectFromUrl = () => { const m = location.pathname.match(/projects\/(\d+)/); return m ? m[1] : 'scratch-editor'; };
  const username = () => { try { const u = vm && vm.runtime.ioDevices.userData._username; if (u) return u; } catch {} try { const el = document.querySelector('.profile-name, [class*="user-name"], .account-nav .profile-name'); if (el && el.textContent.trim()) return el.textContent.trim(); } catch {} return 'player'; };

  function install(v) {
    if (vm || !v || !v.extensionManager) return;
    vm = v;
    ext = new CloudPlugBlocks({ runtime: v.runtime, server: SERVER, getProject: projectFromUrl, getUser: username, onStatus: updatePill });
    const em = v.extensionManager;
    if (em.isExtensionLoaded && em.isExtensionLoaded('cloudplug')) return;
    const serviceName = em._registerInternalExtension(ext);
    em._loadedExtensions.set('cloudplug', serviceName);
    // if the blocks workspace (the editor) mounts later — e.g. "See inside" — tell it about our category again
    const reannounce = () => { const info = v.runtime._blockInfo.find((c) => c.id === 'cloudplug'); if (info) v.runtime.emit('EXTENSION_ADDED', info); };
    let hadWorkspace = !!document.querySelector('.blocklyWorkspace');
    new MutationObserver(() => { const has = !!document.querySelector('.blocklyWorkspace'); if (has && !hadWorkspace) setTimeout(reannounce, 50); hadWorkspace = has; }).observe(document.documentElement, { childList: true, subtree: true });
    makePill();
    window.CloudPlug = ext;
    console.log('[CloudPlug] blocks plugged into Scratch →', SERVER);
  }

  // 1) early: catch the VM the moment scratch-gui binds one of its methods (before the project loads)
  const origBind = Function.prototype.bind;
  Function.prototype.bind = function (...args) {
    const t = args[0];
    if (!vm && t && typeof t === 'object' && t.runtime && t.extensionManager && typeof t.loadProject === 'function') { Function.prototype.bind = origBind; try { install(t); } catch (e) { console.warn('[CloudPlug] install failed', e); } }
    return origBind.apply(this, args);
  };
  // 2) late: walk React's tree to the redux store (works when injected after the page loaded)
  function findVM() {
    const app = document.getElementById('app'); if (!app) return null;
    let fiber = null;
    for (const k of Object.keys(app)) { if (k.startsWith('__reactContainer')) fiber = app[k]; if (k.startsWith('__reactInternalInstance')) fiber = app[k]; }
    if (!fiber && app._reactRootContainer) fiber = app._reactRootContainer._internalRoot ? app._reactRootContainer._internalRoot.current : app._reactRootContainer.current;
    let n = 0; const stack = [fiber];
    while (stack.length && n++ < 5000) {
      const f = stack.pop(); if (!f) continue;
      const props = f.memoizedProps || (f.stateNode && f.stateNode.props);
      const store = props && props.store;
      if (store && typeof store.getState === 'function') { try { const s = store.getState(); if (s.scratchGui && s.scratchGui.vm) return s.scratchGui.vm; } catch {} }
      if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling);
    }
    return null;
  }
  const poll = setInterval(() => { if (vm) return clearInterval(poll); try { const v = findVM(); if (v) install(v); } catch {} }, 400);
  setTimeout(() => clearInterval(poll), 120000);

  // little status pill so you can see it's alive
  function makePill() {
    if (pill || !document.body) return;
    pill = document.createElement('div');
    pill.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:99999;background:#4c97ff;color:#fff;font:600 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:7px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;opacity:.92';
    pill.title = 'CloudPlug — click to open the dashboard';
    pill.onclick = () => window.open(SERVER, '_blank');
    document.body.appendChild(pill);
    updatePill(ext ? ext.status : 'ready');
  }
  function updatePill(s) { if (!pill) return; const icon = { connected: '🟢', connecting: '🟡', error: '🔴', disconnected: '⚪' }[s] || '🔌'; pill.textContent = `${icon} CloudPlug ${s === 'disconnected' ? 'ready' : s}`; }
})();
