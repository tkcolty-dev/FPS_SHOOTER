const DEFAULT = 'https://cloudplug.apps.tas-ndc.kuhn-labs.com';
chrome.storage.sync.get({ server: '' }, (c) => { document.getElementById('server').value = c.server || ''; document.getElementById('dash').href = c.server || DEFAULT; });
document.getElementById('save').onclick = () => { const server = document.getElementById('server').value.trim().replace(/\/$/, ''); chrome.storage.sync.set({ server }, () => { document.getElementById('ok').textContent = 'saved — reload Scratch'; document.getElementById('dash').href = server || DEFAULT; }); };
