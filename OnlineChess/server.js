const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const games = new Map();
// Quick play queue
const quickPlayQueue = [];

function getPublicGameList() {
  const list = [];
  for (const [id, game] of games) {
    if (!game.black && game.status === 'waiting') {
      list.push({
        id,
        name: game.name,
        creator: game.whiteName,
        timeControl: game.timeControl,
        createdAt: game.createdAt
      });
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Send current game list and online count on connect
  socket.emit('game-list', getPublicGameList());
  io.emit('online-count', io.engine.clientsCount);

  socket.on('create-game', ({ playerName, gameName, timeControl }) => {
    const gameId = uuidv4().slice(0, 8);
    const chess = new Chess();

    games.set(gameId, {
      id: gameId,
      name: gameName || `${playerName}'s game`,
      chess,
      fen: chess.fen(),
      white: socket.id,
      whiteName: playerName || 'Anonymous',
      black: null,
      blackName: null,
      status: 'waiting',
      timeControl: timeControl || 'none',
      whiteTime: timeControl !== 'none' ? parseInt(timeControl) * 60 : null,
      blackTime: timeControl !== 'none' ? parseInt(timeControl) * 60 : null,
      lastMoveTime: null,
      moves: [],
      chat: [],
      createdAt: Date.now()
    });

    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerColor = 'white';

    socket.emit('game-created', { gameId, color: 'white' });
    io.emit('game-list', getPublicGameList());
  });

  socket.on('join-game', ({ gameId, playerName }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error-msg', 'Game not found');
      return;
    }
    if (game.black) {
      socket.emit('error-msg', 'Game is full');
      return;
    }

    game.black = socket.id;
    game.blackName = playerName || 'Anonymous';
    game.status = 'playing';
    game.lastMoveTime = Date.now();

    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerColor = 'black';

    socket.emit('game-joined', {
      gameId,
      color: 'black',
      fen: game.fen,
      whiteName: game.whiteName,
      blackName: game.blackName,
      timeControl: game.timeControl,
      whiteTime: game.whiteTime,
      blackTime: game.blackTime
    });

    io.to(game.white).emit('opponent-joined', {
      blackName: game.blackName,
      fen: game.fen,
      whiteTime: game.whiteTime,
      blackTime: game.blackTime
    });

    io.emit('game-list', getPublicGameList());

    // Start timer ticking
    if (game.timeControl !== 'none') {
      startTimer(gameId);
    }
  });

  socket.on('make-move', ({ gameId, from, to, promotion }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;

    const turn = game.chess.turn();
    const isWhite = socket.id === game.white;
    const isBlack = socket.id === game.black;

    if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack)) {
      socket.emit('error-msg', 'Not your turn');
      return;
    }

    try {
      const move = game.chess.move({ from, to, promotion: promotion || 'q' });
      if (!move) {
        socket.emit('error-msg', 'Invalid move');
        return;
      }

      // Update time
      if (game.timeControl !== 'none' && game.lastMoveTime) {
        const elapsed = (Date.now() - game.lastMoveTime) / 1000;
        if (turn === 'w') {
          game.whiteTime = Math.max(0, game.whiteTime - elapsed);
        } else {
          game.blackTime = Math.max(0, game.blackTime - elapsed);
        }
        game.lastMoveTime = Date.now();
      }

      game.fen = game.chess.fen();
      game.moves.push(move);

      let status = 'playing';
      let winner = null;

      if (game.chess.isCheckmate()) {
        status = 'checkmate';
        winner = turn === 'w' ? 'white' : 'black';
        game.status = 'finished';
      } else if (game.chess.isDraw()) {
        status = 'draw';
        game.status = 'finished';
      } else if (game.chess.isStalemate()) {
        status = 'stalemate';
        game.status = 'finished';
      }

      io.to(gameId).emit('move-made', {
        move,
        fen: game.fen,
        status,
        winner,
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
        moves: game.moves,
        inCheck: game.chess.inCheck()
      });
    } catch (e) {
      socket.emit('error-msg', 'Invalid move');
    }
  });

  socket.on('chat-message', ({ gameId, message, playerName }) => {
    const game = games.get(gameId);
    if (!game) return;

    const chatMsg = {
      sender: playerName,
      message: message.slice(0, 200),
      time: Date.now()
    };
    game.chat.push(chatMsg);
    io.to(gameId).emit('chat-message', chatMsg);
  });

  socket.on('resign', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;

    game.status = 'finished';
    const winner = socket.id === game.white ? 'black' : 'white';
    io.to(gameId).emit('game-over', { reason: 'resignation', winner });
  });

  socket.on('offer-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;

    const opponent = socket.id === game.white ? game.black : game.white;
    io.to(opponent).emit('draw-offered');
  });

  socket.on('accept-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;

    game.status = 'finished';
    io.to(gameId).emit('game-over', { reason: 'draw', winner: null });
  });

  socket.on('decline-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;

    const opponent = socket.id === game.white ? game.black : game.white;
    io.to(opponent).emit('draw-declined');
  });

  socket.on('quick-play', ({ playerName }) => {
    // Remove this socket from queue if already there
    const existingIdx = quickPlayQueue.findIndex(q => q.socket.id === socket.id);
    if (existingIdx !== -1) quickPlayQueue.splice(existingIdx, 1);

    // Check if someone is already waiting in queue
    if (quickPlayQueue.length > 0) {
      const waiting = quickPlayQueue.shift();
      // Verify the waiting socket is still connected
      if (waiting.socket.connected) {
        // The waiting player already created a game, join it
        const game = games.get(waiting.gameId);
        if (game && game.status === 'waiting' && !game.black) {
          game.black = socket.id;
          game.blackName = playerName || 'Anonymous';
          game.status = 'playing';
          game.lastMoveTime = Date.now();

          socket.join(waiting.gameId);
          socket.gameId = waiting.gameId;
          socket.playerColor = 'black';

          socket.emit('quick-play-matched', { gameId: waiting.gameId });
          socket.emit('game-joined', {
            gameId: waiting.gameId,
            color: 'black',
            fen: game.fen,
            whiteName: game.whiteName,
            blackName: game.blackName,
            timeControl: game.timeControl,
            whiteTime: game.whiteTime,
            blackTime: game.blackTime
          });

          io.to(game.white).emit('quick-play-matched', { gameId: waiting.gameId });
          io.to(game.white).emit('opponent-joined', {
            blackName: game.blackName,
            fen: game.fen,
            whiteTime: game.whiteTime,
            blackTime: game.blackTime
          });

          io.emit('game-list', getPublicGameList());

          if (game.timeControl !== 'none') {
            startTimer(waiting.gameId);
          }
          return;
        }
      }
    }

    // No one waiting - create a game and add to queue
    const gameId = uuidv4().slice(0, 8);
    const chess = new Chess();

    games.set(gameId, {
      id: gameId,
      name: `Quick Play`,
      chess,
      fen: chess.fen(),
      white: socket.id,
      whiteName: playerName || 'Anonymous',
      black: null,
      blackName: null,
      status: 'waiting',
      timeControl: '5',
      whiteTime: 300,
      blackTime: 300,
      lastMoveTime: null,
      moves: [],
      chat: [],
      createdAt: Date.now()
    });

    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerColor = 'white';

    quickPlayQueue.push({ socket, gameId, playerName });
    socket.emit('game-created', { gameId, color: 'white' });
    io.emit('game-list', getPublicGameList());
  });

  socket.on('request-game-list', () => {
    socket.emit('game-list', getPublicGameList());
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    // Remove from quick play queue
    const qpIdx = quickPlayQueue.findIndex(q => q.socket.id === socket.id);
    if (qpIdx !== -1) quickPlayQueue.splice(qpIdx, 1);
    io.emit('online-count', io.engine.clientsCount - 1);
    const gameId = socket.gameId;
    if (!gameId) return;

    const game = games.get(gameId);
    if (!game) return;

    if (game.status === 'waiting') {
      games.delete(gameId);
      io.emit('game-list', getPublicGameList());
    } else if (game.status === 'playing') {
      const winner = socket.id === game.white ? 'black' : 'white';
      game.status = 'finished';
      io.to(gameId).emit('game-over', { reason: 'disconnect', winner });
    }
  });
});

// Timer management
const timerIntervals = new Map();

function startTimer(gameId) {
  if (timerIntervals.has(gameId)) return;

  const interval = setInterval(() => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') {
      clearInterval(interval);
      timerIntervals.delete(gameId);
      return;
    }

    const turn = game.chess.turn();
    const elapsed = (Date.now() - game.lastMoveTime) / 1000;

    if (turn === 'w') {
      const remaining = game.whiteTime - elapsed;
      if (remaining <= 0) {
        game.status = 'finished';
        clearInterval(interval);
        timerIntervals.delete(gameId);
        io.to(gameId).emit('game-over', { reason: 'timeout', winner: 'black' });
      }
    } else {
      const remaining = game.blackTime - elapsed;
      if (remaining <= 0) {
        game.status = 'finished';
        clearInterval(interval);
        timerIntervals.delete(gameId);
        io.to(gameId).emit('game-over', { reason: 'timeout', winner: 'white' });
      }
    }
  }, 500);

  timerIntervals.set(gameId, interval);
}

// Clean up old finished games every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of games) {
    if (game.status === 'finished' && now - game.createdAt > 30 * 60 * 1000) {
      games.delete(id);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`XS Chess server running on port ${PORT}`);
});
