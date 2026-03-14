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
// Tournament storage
const tournaments = new Map();
// Rematch requests: gameId -> { requester socketId }
const rematchRequests = new Map();
// Friend system: friendCode -> {socketId, name, friendCode, friends:[], online:true}
const players = new Map();
// Reverse lookup: socket.id -> friendCode
const socketToCode = new Map();

// === Moderation system ===

// Blocked words list (profanity, slurs, extreme insults)
const BLOCKED_WORDS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fucks',
  'shit', 'shitty', 'bullshit', 'shits',
  'ass', 'asshole', 'asshat', 'dumbass', 'jackass', 'smartass',
  'bitch', 'bitches', 'bitchy',
  'damn', 'damned', 'dammit', 'goddamn', 'goddammit',
  'hell',
  'dick', 'dickhead', 'dicks',
  'cock', 'cocksucker',
  'cunt', 'cunts',
  'piss', 'pissed', 'pissing',
  'crap', 'crappy',
  'bastard', 'bastards',
  'whore', 'whores',
  'slut', 'sluts', 'slutty',
  'nigger', 'niggers', 'nigga', 'niggas',
  'faggot', 'faggots', 'fag', 'fags',
  'retard', 'retarded', 'retards',
  'spic', 'spics',
  'chink', 'chinks',
  'kike', 'kikes',
  'wetback', 'wetbacks',
  'tranny', 'trannies',
  'dyke', 'dykes',
  'twat', 'twats',
  'wanker', 'wankers',
  'tosser', 'tossers',
  'prick', 'pricks',
  'douche', 'douchebag', 'douchebags',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'stfu', 'gtfo', 'lmfao',
  'kys', 'killyourself',
  'nazi', 'nazis'
];

// Allowed emoji reactions
const ALLOWED_EMOJIS = [
  '👍', '👎', '😂', '😮', '😢', '😡',
  '🔥', '💯', '👏', '🤔', '😎', '🎉',
  '♟️', '👑', '🏆', '💪', '🤝', '😱',
  'gg', 'GG', 'wp', 'WP', 'gl', 'GL', 'hf', 'HF',
  'nice', 'wow', 'oops', '!!'
];

// Muted players: friendCode -> mute expiry timestamp
const mutedPlayers = new Map();

// Reports: array of { reportedCode, reporterCode, gameId, reason, time }
const reports = [];

// Blocked players: friendCode -> Set of blocked friendCodes
const blockedPlayers = new Map();

// Rate limiting: socket.id -> array of message timestamps
const chatRateLimits = new Map();

// Check if a message contains blocked words (whole-word, case-insensitive)
function containsBlockedWord(text) {
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) return true;
  }
  return false;
}

// Filter a message: returns filtered text or null if clean
function filterMessage(message) {
  if (containsBlockedWord(message)) {
    return '***';
  }
  return message;
}

// Sanitize a player name
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Player';
  // Strip HTML tags
  let clean = name.replace(/<[^>]*>/g, '');
  // Trim whitespace
  clean = clean.trim();
  // Max 20 characters
  clean = clean.slice(0, 20);
  // No empty names
  if (!clean) return 'Player';
  // Filter blocked words
  if (containsBlockedWord(clean)) return 'Player';
  return clean;
}

// Check if a player is currently muted
function isPlayerMuted(friendCode) {
  if (!friendCode) return false;
  const expiry = mutedPlayers.get(friendCode);
  if (!expiry) return false;
  if (Date.now() >= expiry) {
    mutedPlayers.delete(friendCode);
    return false;
  }
  return true;
}

// Check rate limit for a socket. Returns true if rate-limited.
function isRateLimited(socketId) {
  const now = Date.now();
  let timestamps = chatRateLimits.get(socketId);
  if (!timestamps) {
    timestamps = [];
    chatRateLimits.set(socketId, timestamps);
  }
  // Remove timestamps older than 10 seconds
  const cutoff = now - 10000;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  // Check if over limit (5 messages in 10 seconds)
  if (timestamps.length >= 5) {
    return true;
  }
  timestamps.push(now);
  return false;
}

// Check if playerA has blocked playerB
function isBlocked(playerACode, playerBCode) {
  const blocked = blockedPlayers.get(playerACode);
  if (!blocked) return false;
  return blocked.has(playerBCode);
}

function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (players.has(code));
  return code;
}

function broadcastFriendStatus(friendCode) {
  const player = players.get(friendCode);
  if (!player) return;
  for (const fc of player.friends) {
    const friend = players.get(fc);
    if (friend && friend.online) {
      const friendSocket = io.sockets.sockets.get(friend.socketId);
      if (friendSocket) {
        friendSocket.emit('friend-status', {
          friendCode: player.friendCode,
          name: player.name,
          online: player.online
        });
      }
    }
  }
}

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

function getActiveGames() {
  const list = [];
  for (const [id, game] of games) {
    if (game.status === 'playing') {
      list.push({
        id,
        name: game.name,
        whiteName: game.whiteName,
        blackName: game.blackName,
        moveCount: game.moves.length,
        timeControl: game.timeControl
      });
    }
  }
  return list;
}

function handleTournamentGameEnd(gameId, winner) {
  for (const [tournId, tourn] of tournaments) {
    const matchIdx = tourn.bracket.findIndex(m => m.gameId === gameId);
    if (matchIdx === -1) continue;

    const match = tourn.bracket[matchIdx];
    match.winner = winner === 'white' ? match.white : winner === 'black' ? match.black : null;
    match.status = 'finished';

    // Check if current round is complete
    const currentRound = match.round;
    const roundMatches = tourn.bracket.filter(m => m.round === currentRound);
    const allDone = roundMatches.every(m => m.status === 'finished');

    if (allDone) {
      const winners = roundMatches.map(m => m.winner).filter(Boolean);
      if (winners.length <= 1) {
        // Tournament is over
        tourn.status = 'finished';
        tourn.winner = winners[0] || null;
        io.emit('tournament-update', tourn);
        return;
      }
      // Create next round matches
      const nextRound = currentRound + 1;
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          const newGameId = uuidv4().slice(0, 8);
          const chess = new Chess();
          const p1 = winners[i];
          const p2 = winners[i + 1];

          games.set(newGameId, {
            id: newGameId,
            name: `${tourn.name} - Round ${nextRound}`,
            chess,
            fen: chess.fen(),
            white: p1.socketId,
            whiteName: p1.name,
            black: p2.socketId,
            blackName: p2.name,
            status: 'playing',
            timeControl: '5',
            whiteTime: 300,
            blackTime: 300,
            lastMoveTime: Date.now(),
            moves: [],
            chat: [],
            createdAt: Date.now(),
            tournamentId: tournId
          });

          tourn.bracket.push({
            round: nextRound,
            white: p1,
            black: p2,
            gameId: newGameId,
            winner: null,
            status: 'playing'
          });

          // Join players to the new game room
          const whiteSocket = io.sockets.sockets.get(p1.socketId);
          const blackSocket = io.sockets.sockets.get(p2.socketId);
          if (whiteSocket) {
            whiteSocket.join(newGameId);
            whiteSocket.gameId = newGameId;
            whiteSocket.playerColor = 'white';
            whiteSocket.emit('tournament-match-start', {
              gameId: newGameId,
              color: 'white',
              fen: chess.fen(),
              whiteName: p1.name,
              blackName: p2.name,
              round: nextRound
            });
          }
          if (blackSocket) {
            blackSocket.join(newGameId);
            blackSocket.gameId = newGameId;
            blackSocket.playerColor = 'black';
            blackSocket.emit('tournament-match-start', {
              gameId: newGameId,
              color: 'black',
              fen: chess.fen(),
              whiteName: p1.name,
              blackName: p2.name,
              round: nextRound
            });
          }

          startTimer(newGameId);
        } else {
          // Bye - auto-advance
          tourn.bracket.push({
            round: nextRound,
            white: winners[i],
            black: null,
            gameId: null,
            winner: winners[i],
            status: 'finished'
          });
        }
      }
    }

    io.emit('tournament-update', tourn);
    return;
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Send current game list and online count on connect
  socket.emit('game-list', getPublicGameList());
  io.emit('online-count', io.engine.clientsCount);

  socket.on('create-game', ({ playerName, gameName, timeControl }) => {
    const gameId = uuidv4().slice(0, 8);
    const chess = new Chess();
    const safeName = sanitizeName(playerName);
    const safeGameName = gameName ? sanitizeName(gameName) : `${safeName}'s game`;

    games.set(gameId, {
      id: gameId,
      name: safeGameName,
      chess,
      fen: chess.fen(),
      white: socket.id,
      whiteName: safeName,
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
    socket.emit('challenge-link', { gameId });
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

    // Check if joiner is blocked by the game creator
    const joinerCode = socketToCode.get(socket.id);
    const creatorCode = socketToCode.get(game.white);
    if (creatorCode && joinerCode && isBlocked(creatorCode, joinerCode)) {
      socket.emit('error-msg', 'You cannot join this game');
      return;
    }

    game.black = socket.id;
    game.blackName = sanitizeName(playerName);
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

      if (game.status === 'finished' && game.tournamentId) {
        handleTournamentGameEnd(gameId, winner);
      }
    } catch (e) {
      socket.emit('error-msg', 'Invalid move');
    }
  });

  socket.on('chat-message', ({ gameId, message, playerName }) => {
    const game = games.get(gameId);
    if (!game) return;
    if (!message || typeof message !== 'string') return;

    // Check if player is muted
    const senderCode = socketToCode.get(socket.id);
    if (isPlayerMuted(senderCode)) {
      socket.emit('error-msg', 'You are muted for inappropriate behavior');
      return;
    }

    // Rate limiting
    if (isRateLimited(socket.id)) {
      socket.emit('error-msg', 'You are sending messages too fast. Please slow down.');
      return;
    }

    // Filter message content
    let filteredMessage = filterMessage(message.slice(0, 200));
    const wasFiltered = filteredMessage === '***';

    const chatMsg = {
      sender: sanitizeName(playerName),
      message: filteredMessage,
      time: Date.now()
    };
    game.chat.push(chatMsg);
    io.to(gameId).emit('chat-message', chatMsg);

    // Warn player if message was filtered
    if (wasFiltered) {
      socket.emit('error-msg', 'Your message was filtered for inappropriate content.');
    }
  });

  socket.on('resign', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;
    // Only actual players can resign
    if (socket.id !== game.white && socket.id !== game.black) return;

    game.status = 'finished';
    const winner = socket.id === game.white ? 'black' : 'white';
    io.to(gameId).emit('game-over', { reason: 'resignation', winner });
    if (game.tournamentId) handleTournamentGameEnd(gameId, winner);
  });

  socket.on('offer-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;
    // Only actual players can offer draws
    if (socket.id !== game.white && socket.id !== game.black) return;

    const opponent = socket.id === game.white ? game.black : game.white;
    io.to(opponent).emit('draw-offered');
  });

  socket.on('accept-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;
    // Only actual players can accept draws
    if (socket.id !== game.white && socket.id !== game.black) return;

    game.status = 'finished';
    io.to(gameId).emit('game-over', { reason: 'draw', winner: null });
    if (game.tournamentId) handleTournamentGameEnd(gameId, null);
  });

  socket.on('decline-draw', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;
    // Only actual players can decline draws
    if (socket.id !== game.white && socket.id !== game.black) return;

    const opponent = socket.id === game.white ? game.black : game.white;
    io.to(opponent).emit('draw-declined');
  });

  socket.on('quick-play', ({ playerName }) => {
    const safePlayerName = sanitizeName(playerName);

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
          game.blackName = safePlayerName;
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
      whiteName: safePlayerName,
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

    quickPlayQueue.push({ socket, gameId, playerName: safePlayerName });
    socket.emit('game-created', { gameId, color: 'white' });
    io.emit('game-list', getPublicGameList());
  });

  // === Spectate games ===
  socket.on('get-active-games', () => {
    socket.emit('active-games', getActiveGames());
  });

  socket.on('spectate-game', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error-msg', 'Game not found');
      return;
    }

    socket.join(gameId);
    socket.emit('spectate-joined', {
      gameId,
      fen: game.fen,
      whiteName: game.whiteName,
      blackName: game.blackName,
      moves: game.moves,
      status: game.status,
      timeControl: game.timeControl,
      whiteTime: game.whiteTime,
      blackTime: game.blackTime
    });
  });

  // === Join by ID (challenge link) ===
  socket.on('join-by-id', ({ gameId, playerName }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error-msg', 'Game not found');
      return;
    }
    if (game.black) {
      socket.emit('error-msg', 'Game is full');
      return;
    }

    // Check if joiner is blocked by the game creator
    const joinerCode = socketToCode.get(socket.id);
    const creatorCode = socketToCode.get(game.white);
    if (creatorCode && joinerCode && isBlocked(creatorCode, joinerCode)) {
      socket.emit('error-msg', 'You cannot join this game');
      return;
    }

    game.black = socket.id;
    game.blackName = sanitizeName(playerName);
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

    if (game.timeControl !== 'none') {
      startTimer(gameId);
    }
  });

  // === Rematch ===
  socket.on('request-rematch', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game || game.status !== 'finished') return;

    const isWhite = socket.id === game.white;
    const isBlack = socket.id === game.black;
    if (!isWhite && !isBlack) return;

    rematchRequests.set(gameId, { requester: socket.id });
    const opponent = isWhite ? game.black : game.white;
    io.to(opponent).emit('rematch-requested', { gameId });
  });

  socket.on('accept-rematch', ({ gameId }) => {
    const oldGame = games.get(gameId);
    if (!oldGame || oldGame.status !== 'finished') return;

    const request = rematchRequests.get(gameId);
    if (!request) return;

    // Only the non-requester can accept
    const isWhite = socket.id === oldGame.white;
    const isBlack = socket.id === oldGame.black;
    if (!isWhite && !isBlack) return;
    if (socket.id === request.requester) return;

    rematchRequests.delete(gameId);

    // Verify both sockets still exist before creating rematch
    const whiteSocket = io.sockets.sockets.get(oldGame.black);  // swapped
    const blackSocket = io.sockets.sockets.get(oldGame.white);  // swapped
    if (!whiteSocket || !blackSocket) {
      socket.emit('error-msg', 'Opponent has disconnected');
      return;
    }

    // Create new game with swapped colors
    const newGameId = uuidv4().slice(0, 8);
    const chess = new Chess();

    const newGame = {
      id: newGameId,
      name: oldGame.name,
      chess,
      fen: chess.fen(),
      white: oldGame.black,       // swap colors
      whiteName: oldGame.blackName,
      black: oldGame.white,
      blackName: oldGame.whiteName,
      status: 'playing',
      timeControl: oldGame.timeControl,
      whiteTime: oldGame.timeControl !== 'none' ? parseInt(oldGame.timeControl) * 60 : null,
      blackTime: oldGame.timeControl !== 'none' ? parseInt(oldGame.timeControl) * 60 : null,
      lastMoveTime: Date.now(),
      moves: [],
      chat: [],
      createdAt: Date.now()
    };

    games.set(newGameId, newGame);

    if (whiteSocket) {
      whiteSocket.join(newGameId);
      whiteSocket.gameId = newGameId;
      whiteSocket.playerColor = 'white';
    }
    if (blackSocket) {
      blackSocket.join(newGameId);
      blackSocket.gameId = newGameId;
      blackSocket.playerColor = 'black';
    }

    const rematchPayload = {
      gameId: newGameId,
      fen: newGame.fen,
      whiteName: newGame.whiteName,
      blackName: newGame.blackName,
      timeControl: newGame.timeControl,
      whiteTime: newGame.whiteTime,
      blackTime: newGame.blackTime
    };

    if (whiteSocket) {
      whiteSocket.emit('rematch-started', { ...rematchPayload, color: 'white' });
    }
    if (blackSocket) {
      blackSocket.emit('rematch-started', { ...rematchPayload, color: 'black' });
    }

    io.emit('game-list', getPublicGameList());

    if (newGame.timeControl !== 'none') {
      startTimer(newGameId);
    }
  });

  // === Chat reactions ===
  socket.on('chat-reaction', ({ gameId, emoji }) => {
    const game = games.get(gameId);
    if (!game) return;
    if (!emoji || typeof emoji !== 'string') return;

    // Validate emoji is in allowed list
    const trimmedEmoji = emoji.slice(0, 8);
    if (!ALLOWED_EMOJIS.includes(trimmedEmoji)) {
      socket.emit('error-msg', 'That reaction is not allowed.');
      return;
    }

    // Check if player is muted
    const senderCode = socketToCode.get(socket.id);
    if (isPlayerMuted(senderCode)) {
      socket.emit('error-msg', 'You are muted for inappropriate behavior');
      return;
    }

    // Determine sender name
    let sender = 'Spectator';
    if (socket.id === game.white) sender = game.whiteName;
    else if (socket.id === game.black) sender = game.blackName;

    io.to(gameId).emit('chat-reaction', {
      sender,
      emoji: trimmedEmoji,
      time: Date.now()
    });
  });

  // === Tournament system ===
  socket.on('create-tournament', ({ name, maxPlayers }) => {
    const tournId = uuidv4().slice(0, 8);
    const safeTournName = sanitizeName(name) || 'Tournament';
    const tournament = {
      id: tournId,
      name: safeTournName,
      creator: { socketId: socket.id, name: 'Host' },
      players: [{ socketId: socket.id, name: 'Host' }],
      status: 'waiting',
      bracket: [],
      maxPlayers: maxPlayers || 8,
      createdAt: Date.now()
    };

    tournaments.set(tournId, tournament);
    socket.tournamentId = tournId;
    socket.emit('tournament-created', tournament);
    io.emit('tournament-update', tournament);
  });

  socket.on('join-tournament', ({ tournamentId, playerName }) => {
    const tourn = tournaments.get(tournamentId);
    if (!tourn) {
      socket.emit('error-msg', 'Tournament not found');
      return;
    }
    if (tourn.status !== 'waiting') {
      socket.emit('error-msg', 'Tournament already started');
      return;
    }
    if (tourn.players.length >= tourn.maxPlayers) {
      socket.emit('error-msg', 'Tournament is full');
      return;
    }
    if (tourn.players.some(p => p.socketId === socket.id)) {
      socket.emit('error-msg', 'Already in tournament');
      return;
    }

    tourn.players.push({ socketId: socket.id, name: sanitizeName(playerName) });
    socket.tournamentId = tournamentId;
    socket.emit('tournament-joined', tourn);
    io.emit('tournament-update', tourn);
  });

  socket.on('start-tournament', ({ tournamentId }) => {
    const tourn = tournaments.get(tournamentId);
    if (!tourn) {
      socket.emit('error-msg', 'Tournament not found');
      return;
    }
    if (tourn.creator.socketId !== socket.id) {
      socket.emit('error-msg', 'Only the creator can start the tournament');
      return;
    }
    if (tourn.players.length < 2) {
      socket.emit('error-msg', 'Need at least 2 players');
      return;
    }
    if (tourn.status !== 'waiting') {
      socket.emit('error-msg', 'Tournament already started');
      return;
    }

    tourn.status = 'playing';

    // Shuffle players for fair bracket
    const shuffled = [...tourn.players].sort(() => Math.random() - 0.5);

    // Create round 1 matches
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const newGameId = uuidv4().slice(0, 8);
        const chess = new Chess();

        games.set(newGameId, {
          id: newGameId,
          name: `${tourn.name} - Round 1`,
          chess,
          fen: chess.fen(),
          white: shuffled[i].socketId,
          whiteName: shuffled[i].name,
          black: shuffled[i + 1].socketId,
          blackName: shuffled[i + 1].name,
          status: 'playing',
          timeControl: '5',
          whiteTime: 300,
          blackTime: 300,
          lastMoveTime: Date.now(),
          moves: [],
          chat: [],
          createdAt: Date.now(),
          tournamentId: tournamentId
        });

        tourn.bracket.push({
          round: 1,
          white: shuffled[i],
          black: shuffled[i + 1],
          gameId: newGameId,
          winner: null,
          status: 'playing'
        });

        // Join players to game rooms
        const whiteSocket = io.sockets.sockets.get(shuffled[i].socketId);
        const blackSocket = io.sockets.sockets.get(shuffled[i + 1].socketId);

        if (whiteSocket) {
          whiteSocket.join(newGameId);
          whiteSocket.gameId = newGameId;
          whiteSocket.playerColor = 'white';
          whiteSocket.emit('tournament-match-start', {
            gameId: newGameId,
            color: 'white',
            fen: chess.fen(),
            whiteName: shuffled[i].name,
            blackName: shuffled[i + 1].name,
            round: 1
          });
        }
        if (blackSocket) {
          blackSocket.join(newGameId);
          blackSocket.gameId = newGameId;
          blackSocket.playerColor = 'black';
          blackSocket.emit('tournament-match-start', {
            gameId: newGameId,
            color: 'black',
            fen: chess.fen(),
            whiteName: shuffled[i].name,
            blackName: shuffled[i + 1].name,
            round: 1
          });
        }

        startTimer(newGameId);
      } else {
        // Odd player gets a bye
        tourn.bracket.push({
          round: 1,
          white: shuffled[i],
          black: null,
          gameId: null,
          winner: shuffled[i],
          status: 'finished'
        });
      }
    }

    io.emit('tournament-update', tourn);
  });

  socket.on('request-game-list', () => {
    socket.emit('game-list', getPublicGameList());
  });

  // === Friend system ===
  socket.on('register-player', ({ playerName, friendCode }) => {
    const safeName = sanitizeName(playerName);

    // If friendCode provided and exists, reconnect to existing player
    if (friendCode && players.has(friendCode)) {
      const player = players.get(friendCode);
      // Remove old socket mapping if it exists
      if (player.socketId) {
        socketToCode.delete(player.socketId);
      }
      player.socketId = socket.id;
      player.name = safeName || player.name;
      player.online = true;
      socketToCode.set(socket.id, friendCode);
      socket.emit('registered', { friendCode: player.friendCode });
      broadcastFriendStatus(friendCode);
    } else {
      // Generate new friend code
      const newCode = generateFriendCode();
      const player = {
        socketId: socket.id,
        name: safeName,
        friendCode: newCode,
        friends: [],
        online: true
      };
      players.set(newCode, player);
      socketToCode.set(socket.id, newCode);
      socket.emit('registered', { friendCode: newCode });
    }
  });

  socket.on('add-friend', ({ friendCode }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('error-msg', 'You must register first');
      return;
    }
    if (friendCode === myCode) {
      socket.emit('error-msg', 'You cannot add yourself');
      return;
    }
    const target = players.get(friendCode);
    if (!target) {
      socket.emit('error-msg', 'Player not found');
      return;
    }
    const me = players.get(myCode);
    // Check if already friends
    if (me.friends.includes(friendCode)) {
      socket.emit('error-msg', 'Already friends');
      return;
    }
    // Bidirectional add
    me.friends.push(friendCode);
    target.friends.push(myCode);
    // Notify both
    socket.emit('friend-added', {
      friendCode: target.friendCode,
      name: target.name,
      online: target.online
    });
    if (target.online) {
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit('friend-added', {
          friendCode: me.friendCode,
          name: me.name,
          online: me.online
        });
      }
    }
  });

  socket.on('remove-friend', ({ friendCode }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) return;
    const me = players.get(myCode);
    const target = players.get(friendCode);
    if (!me || !target) return;
    // Remove from both lists
    me.friends = me.friends.filter(fc => fc !== friendCode);
    target.friends = target.friends.filter(fc => fc !== myCode);
    // Notify both
    socket.emit('friend-removed', { friendCode });
    if (target.online) {
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit('friend-removed', { friendCode: myCode });
      }
    }
  });

  socket.on('get-friends', () => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('friends-list', []);
      return;
    }
    const me = players.get(myCode);
    if (!me) {
      socket.emit('friends-list', []);
      return;
    }
    const friendsList = me.friends.map(fc => {
      const friend = players.get(fc);
      if (!friend) return null;
      return {
        friendCode: friend.friendCode,
        name: friend.name,
        online: friend.online
      };
    }).filter(Boolean);
    socket.emit('friends-list', friendsList);
  });

  socket.on('challenge-friend', ({ friendCode, timeControl }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('error-msg', 'You must register first');
      return;
    }
    const me = players.get(myCode);
    const target = players.get(friendCode);
    if (!target) {
      socket.emit('error-msg', 'Player not found');
      return;
    }
    if (!target.online) {
      socket.emit('error-msg', 'Player is offline');
      return;
    }
    // Check if either player has blocked the other
    if (isBlocked(myCode, friendCode) || isBlocked(friendCode, myCode)) {
      socket.emit('error-msg', 'You cannot challenge this player');
      return;
    }

    // Create a game with challenger as white
    const gameId = uuidv4().slice(0, 8);
    const chess = new Chess();
    const tc = timeControl || '5';

    games.set(gameId, {
      id: gameId,
      name: `${me.name} vs ${target.name}`,
      chess,
      fen: chess.fen(),
      white: socket.id,
      whiteName: me.name,
      black: null,
      blackName: null,
      status: 'waiting',
      timeControl: tc,
      whiteTime: tc !== 'none' ? parseInt(tc) * 60 : null,
      blackTime: tc !== 'none' ? parseInt(tc) * 60 : null,
      lastMoveTime: null,
      moves: [],
      chat: [],
      createdAt: Date.now(),
      friendChallenge: true
    });

    socket.join(gameId);
    socket.gameId = gameId;
    socket.playerColor = 'white';

    socket.emit('game-created', { gameId, color: 'white' });

    // Notify the target
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit('friend-challenge', {
        gameId,
        challengerName: me.name,
        challengerCode: myCode,
        timeControl: tc
      });
    }
  });

  socket.on('accept-challenge', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error-msg', 'Game not found');
      return;
    }
    if (game.black) {
      socket.emit('error-msg', 'Game is full');
      return;
    }

    // Check if either player has blocked the other
    const myCode = socketToCode.get(socket.id);
    const creatorCode = socketToCode.get(game.white);
    if (myCode && creatorCode && (isBlocked(creatorCode, myCode) || isBlocked(myCode, creatorCode))) {
      socket.emit('error-msg', 'You cannot join this game');
      return;
    }

    const me = myCode ? players.get(myCode) : null;

    game.black = socket.id;
    game.blackName = (me && me.name) || 'Player';
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

    if (game.timeControl !== 'none') {
      startTimer(gameId);
    }
  });

  // === Report player ===
  socket.on('report-player', ({ reportedCode, gameId, reason }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('error-msg', 'You must register first');
      return;
    }
    if (!reportedCode || reportedCode === myCode) {
      socket.emit('error-msg', 'Invalid report');
      return;
    }
    const reportedPlayer = players.get(reportedCode);
    if (!reportedPlayer) {
      socket.emit('error-msg', 'Player not found');
      return;
    }

    // Check if already reported this player recently (prevent spam reports)
    const recentReport = reports.find(r =>
      r.reporterCode === myCode &&
      r.reportedCode === reportedCode &&
      Date.now() - r.time < 30 * 60 * 1000
    );
    if (recentReport) {
      socket.emit('error-msg', 'You have already reported this player recently');
      return;
    }

    // Store the report
    reports.push({
      reportedCode,
      reporterCode: myCode,
      gameId: gameId || null,
      reason: (reason || 'No reason given').slice(0, 200),
      time: Date.now()
    });

    // Confirm to reporter
    socket.emit('player-reported', {
      reportedCode,
      message: 'Report submitted. Thank you.'
    });

    // Warn the reported player
    if (reportedPlayer.online) {
      const reportedSocket = io.sockets.sockets.get(reportedPlayer.socketId);
      if (reportedSocket) {
        reportedSocket.emit('you-were-reported', {
          message: 'You have been reported for inappropriate behavior. Continued violations may result in a mute.'
        });
      }
    }

    // Check if player has 3+ reports -> auto-mute for 30 minutes
    const totalReports = reports.filter(r => r.reportedCode === reportedCode).length;
    if (totalReports >= 3 && !isPlayerMuted(reportedCode)) {
      const muteExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes
      mutedPlayers.set(reportedCode, muteExpiry);

      if (reportedPlayer.online) {
        const reportedSocket = io.sockets.sockets.get(reportedPlayer.socketId);
        if (reportedSocket) {
          reportedSocket.emit('you-were-muted', {
            message: 'You have been muted for 30 minutes due to multiple reports.',
            expiresAt: muteExpiry
          });
        }
      }
    }
  });

  // === Block player ===
  socket.on('block-player', ({ friendCode }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('error-msg', 'You must register first');
      return;
    }
    if (!friendCode || friendCode === myCode) {
      socket.emit('error-msg', 'Invalid block request');
      return;
    }
    if (!players.has(friendCode)) {
      socket.emit('error-msg', 'Player not found');
      return;
    }

    // Add to blocked set
    if (!blockedPlayers.has(myCode)) {
      blockedPlayers.set(myCode, new Set());
    }
    blockedPlayers.get(myCode).add(friendCode);

    socket.emit('player-blocked', {
      friendCode,
      message: 'Player blocked. They can no longer join your games.'
    });
  });

  // === Unblock player ===
  socket.on('unblock-player', ({ friendCode }) => {
    const myCode = socketToCode.get(socket.id);
    if (!myCode) {
      socket.emit('error-msg', 'You must register first');
      return;
    }
    const blocked = blockedPlayers.get(myCode);
    if (blocked) {
      blocked.delete(friendCode);
      if (blocked.size === 0) blockedPlayers.delete(myCode);
    }
    socket.emit('player-unblocked', { friendCode });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    // Clean up rate limit data
    chatRateLimits.delete(socket.id);
    // Remove from quick play queue
    const qpIdx = quickPlayQueue.findIndex(q => q.socket.id === socket.id);
    if (qpIdx !== -1) quickPlayQueue.splice(qpIdx, 1);
    io.emit('online-count', io.engine.clientsCount - 1);

    // Mark player offline in friend system (don't delete)
    const disconnectedCode = socketToCode.get(socket.id);
    if (disconnectedCode) {
      const player = players.get(disconnectedCode);
      if (player) {
        player.online = false;
        broadcastFriendStatus(disconnectedCode);
      }
      socketToCode.delete(socket.id);
    }

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
      if (game.tournamentId) handleTournamentGameEnd(gameId, winner);
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
    if (!game.lastMoveTime) return; // No moves made yet, don't tick timer
    const elapsed = (Date.now() - game.lastMoveTime) / 1000;

    if (turn === 'w') {
      const remaining = game.whiteTime - elapsed;
      if (remaining <= 0) {
        game.status = 'finished';
        clearInterval(interval);
        timerIntervals.delete(gameId);
        io.to(gameId).emit('game-over', { reason: 'timeout', winner: 'black' });
        if (game.tournamentId) handleTournamentGameEnd(gameId, 'black');
      }
    } else {
      const remaining = game.blackTime - elapsed;
      if (remaining <= 0) {
        game.status = 'finished';
        clearInterval(interval);
        timerIntervals.delete(gameId);
        io.to(gameId).emit('game-over', { reason: 'timeout', winner: 'white' });
        if (game.tournamentId) handleTournamentGameEnd(gameId, 'white');
      }
    }
  }, 500);

  timerIntervals.set(gameId, interval);
}

// Clean up old finished games, tournaments, expired mutes, and old reports every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of games) {
    if (game.status === 'finished' && now - game.createdAt > 30 * 60 * 1000) {
      games.delete(id);
    }
  }
  for (const [id, tourn] of tournaments) {
    if (tourn.status === 'finished' && now - tourn.createdAt > 60 * 60 * 1000) {
      tournaments.delete(id);
    }
  }
  // Clean expired mutes
  for (const [code, expiry] of mutedPlayers) {
    if (now >= expiry) {
      mutedPlayers.delete(code);
    }
  }
  // Clean old reports (older than 24 hours)
  while (reports.length > 0 && now - reports[0].time > 24 * 60 * 60 * 1000) {
    reports.shift();
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`XS Chess server running on port ${PORT}`);
});
