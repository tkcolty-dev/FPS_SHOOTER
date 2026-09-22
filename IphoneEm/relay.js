// Call relay: when two phones can't reach each other directly (strict school/office networks), their
// video and audio go through this server instead. Tiny protocol, one room per call.
//   text frame  → JSON control  {type:'join'|'leave'|'hi', call}
//   binary frame→ [1 byte kind][payload]   kind 0 = JPEG video frame, 1 = 16-bit PCM audio
const { WebSocketServer } = require('ws');

module.exports = function attachRelay(server, accounts) {
  let wss;
  try { wss = new WebSocketServer({ server, path: '/relay', maxPayload: 400000 }); }
  catch (e) { console.error('[relay] could not start:', e.message); return; }

  const rooms = new Map();   // callId -> Set(socket)
  const listeners = new Map();   // userId -> Set(socket) — live push of call signals (?events=1)
  if (accounts.onSignal) accounts.onSignal((s) => {
    const set = listeners.get(s.to); if (!set) return;
    const msg = JSON.stringify({ type: 'signal', signal: s });
    set.forEach((ws) => { if (ws.readyState === 1) { try { ws.send(msg); } catch {} } });
  });

  function leave(ws) {
    const room = rooms.get(ws.callId);
    if (!room) return;
    room.delete(ws);
    room.forEach((peer) => { try { peer.send(JSON.stringify({ type: 'bye' })); } catch {} });
    if (!room.size) rooms.delete(ws.callId);
  }

  wss.on('connection', async (ws, req) => {
    let ok = false;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token') || '';
      const call = String(url.searchParams.get('call') || '').slice(0, 64);
      const who = await accounts.me(token).catch(() => null);
      if (who && url.searchParams.get('events')) {
        const set = listeners.get(who.id) || new Set(); set.add(ws); listeners.set(who.id, set);
        const drop = () => { set.delete(ws); if (!set.size && listeners.get(who.id) === set) listeners.delete(who.id); };
        ws.on('close', drop); ws.on('error', drop);
        const ping = setInterval(() => { if (ws.readyState === 1) { try { ws.ping(); } catch {} } else clearInterval(ping); }, 25000);
        return;
      }
      if (who && call) {
        ws.callId = call; ws.userId = who.id; ok = true;
        const room = rooms.get(call) || new Set();
        if (room.size >= 2) { ws.close(1008, 'full'); return; }
        room.add(ws); rooms.set(call, room);
        room.forEach((peer) => { if (peer !== ws) { try { peer.send(JSON.stringify({ type: 'hi' })); } catch {} } });
        ws.send(JSON.stringify({ type: 'ready', peers: room.size }));
      }
    } catch {}
    if (!ok) { try { ws.close(1008, 'unauthorized'); } catch {} return; }

    ws.on('message', (data, isBinary) => {
      const room = rooms.get(ws.callId); if (!room) return;
      room.forEach((peer) => { if (peer !== ws && peer.readyState === 1) { try { peer.send(data, { binary: isBinary }); } catch {} } });
    });
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
  });

  setInterval(() => { rooms.forEach((room) => room.forEach((ws) => { if (ws.readyState > 1) leave(ws); })); }, 30000).unref();
  console.log('  relay: on (falls back to this when a direct call can’t connect)');
};
