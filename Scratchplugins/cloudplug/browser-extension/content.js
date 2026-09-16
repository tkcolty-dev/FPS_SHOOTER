// Runs at document_start on scratch.mit.edu: passes settings to the page and injects inject.js into the page's world
(async () => {
  let cfg = {};
  try { cfg = await new Promise((r) => chrome.storage.sync.get({ server: '' }, r)); } catch {}
  if (!cfg.server) delete cfg.server;
  document.documentElement.dataset.cloudplug = JSON.stringify(cfg);
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('inject.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();
