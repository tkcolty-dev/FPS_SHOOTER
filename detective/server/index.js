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
      socket.emit('room-joined', {
        code: result.code,
        players: rooms.getPlayerList(room),
        isHost: room.hostId === socket.id,
        reconnected: true
      });
      if (room.game && room.game.state !== 'waiting') {
        const state = game.getGameState(room.game, socket.id);
        socket.emit('game-reconnect', state);
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
    const result = rooms.leaveRoom(socket.id);
    if (result) {
      socket.leave(result.code);
      socket.emit('room-left');
      if (!result.empty) {
        const room = rooms.getRoom(result.code);
        if (room) io.to(result.code).emit('room-updated', { players: rooms.getPlayerList(room) });
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
    if (room.players.size < 3) return socket.emit('error-msg', { message: 'Need at least 3 players' });

    const result = await game.startGame(room, io);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('call-meeting', () => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleCallMeeting(room.game, socket.id, io, room.code, room);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('call-vote', ({ targetId }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleCallVote(room.game, socket.id, targetId, io, room.code, room);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('cast-vote', ({ vote }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleVote(room.game, socket.id, vote, io, room.code, room);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('share-clue', ({ clueId }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleShareClue(room.game, socket.id, clueId, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('fake-clue', ({ text, clueType }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    const result = game.handleFakeClue(room.game, socket.id, text, clueType, io, room.code);
    if (result.error) socket.emit('error-msg', { message: result.error });
  });

  socket.on('save-notes', ({ notes }) => {
    const room = rooms.getRoomBySocket(socket.id);
    if (!room || !room.game) return;
    game.handleSaveNotes(room.game, socket.id, notes);
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
        io.to(room.code).emit('player-disconnected', { name: player.name });
      }
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
