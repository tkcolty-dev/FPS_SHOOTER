const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initRedis } = require('./redis');
const rooms = require('./rooms');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingInterval: 10000,
  pingTimeout: 5000
});

app.use(express.static(path.join(__dirname, '..', 'public')));

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // --- Reconnection ---
  socket.on('register-session', ({ sessionToken, playerName }) => {
    if (!sessionToken) return;
    const result = rooms.reconnect(sessionToken, socket.id);
    if (result) {
      socket.join(result.code);
      const room = rooms.getRoom(result.code);

      // Mark player as reconnected in game state
      if (room.game && room.game.players[socket.id]) {
        room.game.players[socket.id].connected = true;
      }

      socket.emit('room-joined', {
        code: result.code,
        players: rooms.getPlayerList(room),
        isHost: room.hostId === socket.id,
        reconnected: true
      });

      if (room.game && room.game.state !== 'waiting' && room.game.state !== 'gameover') {
        const state = game.getGameState(room.game, socket.id, room);
        socket.emit('game-reconnect', state);
        io.to(result.code).emit('player-reconnected', {
          id: socket.id,
          name: room.game.players[socket.id]?.name
        });
      }
    }
  });

  // --- Room Management ---
  socket.on('create-room', ({ name, isPublic }) => {
    if (!name || name.trim().length === 0) return socket.emit('error-msg', { message: 'Name required' });
    const result = rooms.createRoom(socket.id, name.trim().substring(0, 20), isPublic !== false);
    socket.join(result.code);
    const room = rooms.getRoom(result.code);
    socket.emit('room-created', { code: result.code, sessionToken: result.sessionToken });
    socket.emit('room-joined', {
      code: result.code,
      players: rooms.getPlayerList(room),
      isHost: true
    });
  });

  socket.on('join-room', ({ code, name }) => {
    if (!name || name.trim().length === 0) return socket.emit('error-msg', { message: 'Name required' });
    if (!code) return socket.emit('error-msg', { message: 'Room code required' });
    const result = rooms.joinRoom(code.toUpperCase(), socket.id, name.trim().substring(0, 20));
    if (result.error) return socket.emit('error-msg', { message: result.error });
    socket.join(result.code);
    const room = rooms.getRoom(result.code);
    socket.emit('room-joined', {
      code: result.code,
      sessionToken: result.sessionToken,
      players: rooms.getPlayerList(room),
      isHost: room.hostId === socket.id
    });
    io.to(result.code).emit('room-updated', { players: rooms.getPlayerList(room) });
  });

  socket.on('leave-room', () => {
    const room = rooms.getRoomBySocket(socket.id);
    if (room && room.game && room.game.players[socket.id]) {
      room.game.players[socket.id].connected = false;
    }
    const result = rooms.leaveRoom(socket.id);
    if (result) {
      socket.leave(result.code);
      socket.emit('room-left');
      if (!result.empty) {
        const r = rooms.getRoom(result.code);
        if (r) io.to(result.code).emit('room-updated', { players: rooms.getPlayerList(r) });
      }
    }
  });

  socket.on('browse-rooms', () => {
    socket.emit('public-rooms', rooms.getPublicRooms());
  });

  // --- Game Events ---
  socket.on('start-game', async () => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room) return socket.emit('error-msg', { message: 'Not in a room' });
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Only host can start' });
    if (room.players.size < 1) return socket.emit('error-msg', { message: 'Need at least 1 player' });

    const result = await game.startGame(room, io);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('submit-answer', ({ puzzleId, answer }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleSubmitAnswer(room.game, socket.id, puzzleId, answer, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('request-hint', ({ puzzleId }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleRequestHint(room.game, socket.id, puzzleId, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('pin-document', ({ docId }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handlePinDocument(room.game, socket.id, docId, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('update-suspicion', ({ suspectId, marker }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleUpdateSuspicion(room.game, socket.id, suspectId, marker, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('update-shared-notes', ({ content }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleUpdateSharedNotes(room.game, socket.id, content, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('save-private-notes', ({ content }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    game.handleSavePrivateNotes(room.game, socket.id, content);
  });

  socket.on('proceed-to-act', ({ actNumber }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Only host can advance acts' });
    const result = game.handleProceedToAct(room.game, socket.id, actNumber, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('submit-accusation', ({ suspectId, motive }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleSubmitAccusation(room.game, socket.id, suspectId, motive, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('chat', ({ message }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    io.to(room.code).emit('chat-message', {
      name: player.name,
      message: message.substring(0, 300),
      time: Date.now()
    });
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const room = rooms.getRoomBySocket(socket.id);
    if (room && room.game && room.game.state !== 'waiting' && room.game.state !== 'gameover') {
      const player = room.game.players[socket.id];
      if (player) {
        player.connected = false;
        io.to(room.code).emit('player-disconnected', { id: socket.id, name: player.name });
      }
      // Don't remove from room -- allow reconnect
    } else {
      const result = rooms.leaveRoom(socket.id);
      if (result && !result.empty) {
        const r = rooms.getRoom(result.code);
        if (r) io.to(result.code).emit('room-updated', { players: rooms.getPlayerList(r) });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await initRedis();
  server.listen(PORT, () => console.log(`Whodunit running on :${PORT}`));
})();
