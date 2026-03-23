const { v4: uuidv4 } = require('uuid');

const rooms = new Map();
const socketToRoom = new Map();
const sessionToSocket = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateCode() : code;
}

function createRoom(socketId, playerName, isPublic) {
  const code = generateCode();
  const sessionToken = uuidv4();
  const room = {
    code,
    isPublic,
    hostId: socketId,
    players: new Map([[socketId, { name: playerName, sessionToken }]]),
    game: null,
    createdAt: Date.now()
  };
  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  sessionToSocket.set(sessionToken, socketId);
  return { code, sessionToken };
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.players.size >= 8) return { error: 'Room is full' };
  if (room.game && room.game.state !== 'waiting') return { error: 'Game already in progress' };

  const sessionToken = uuidv4();
  room.players.set(socketId, { name: playerName, sessionToken });
  socketToRoom.set(socketId, code);
  sessionToSocket.set(sessionToken, socketId);
  return { code, sessionToken };
}

function leaveRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) { socketToRoom.delete(socketId); return null; }

  const player = room.players.get(socketId);
  if (player) sessionToSocket.delete(player.sessionToken);
  room.players.delete(socketId);
  socketToRoom.delete(socketId);

  if (room.players.size === 0) {
    rooms.delete(code);
    return { code, empty: true };
  }
  // Transfer host
  if (room.hostId === socketId) {
    room.hostId = room.players.keys().next().value;
  }
  return { code, empty: false, newHostId: room.hostId };
}

function reconnect(sessionToken, newSocketId) {
  const oldSocketId = sessionToSocket.get(sessionToken);
  if (!oldSocketId) return null;
  const code = socketToRoom.get(oldSocketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.get(oldSocketId);
  if (!player) return null;

  room.players.delete(oldSocketId);
  room.players.set(newSocketId, player);
  socketToRoom.delete(oldSocketId);
  socketToRoom.set(newSocketId, code);
  sessionToSocket.set(sessionToken, newSocketId);

  if (room.hostId === oldSocketId) room.hostId = newSocketId;

  // Update game player references
  if (room.game && room.game.players[oldSocketId]) {
    room.game.players[newSocketId] = room.game.players[oldSocketId];
    delete room.game.players[oldSocketId];
    room.game.playerOrder = room.game.playerOrder.map(id => id === oldSocketId ? newSocketId : id);
  }

  return { code, playerName: player.name };
}

function getRoom(code) { return rooms.get(code); }
function getRoomBySocket(socketId) {
  const code = socketToRoom.get(socketId);
  return code ? rooms.get(code) : null;
}
function getRoomCode(socketId) { return socketToRoom.get(socketId); }

function getPublicRooms() {
  const list = [];
  for (const [code, room] of rooms) {
    if (room.isPublic && (!room.game || room.game.state === 'waiting')) {
      list.push({
        code,
        host: room.players.get(room.hostId)?.name || 'Unknown',
        count: room.players.size
      });
    }
  }
  return list;
}

function getPlayerList(room) {
  const list = [];
  for (const [id, p] of room.players) {
    list.push({ id, name: p.name, isHost: id === room.hostId });
  }
  return list;
}

module.exports = {
  createRoom, joinRoom, leaveRoom, reconnect,
  getRoom, getRoomBySocket, getRoomCode,
  getPublicRooms, getPlayerList
};
