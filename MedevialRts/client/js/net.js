// WebSocket client. Connects lazily on first send; routes server messages to
// callbacks registered by main.js.

import { G } from './state.js';

const handlers = {};
export function on(type, fn) { handlers[type] = fn; }

let queue = [];

export function connect() {
  if (G.ws && G.ws.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  G.ws = ws;
  ws.onopen = () => { for (const m of queue) ws.send(JSON.stringify(m)); queue = []; };
  ws.onmessage = ev => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (handlers[m.t]) handlers[m.t](m);
  };
  ws.onclose = () => { if (handlers._closed) handlers._closed(); };
}

export function send(msg) {
  connect();
  if (G.ws.readyState === 1) G.ws.send(JSON.stringify(msg));
  else queue.push(msg);
}

export function cmd(L, c) { send({ t: 'cmd', lp: L.lp, ...c }); }
