const { generateCase, getClientCase, validateAnswer, getCaseStats } = require('./cases');

// --- Helpers ---

function addLog(game, text, type = 'system') {
  game.gameLog.push({ text, type, time: Date.now() });
  if (game.gameLog.length > 200) game.gameLog.shift();
}

function isActComplete(game, actNumber) {
  if (!game.case || !game.case.acts) return false;
  const act = game.case.acts[actNumber - 1];
  if (!act || !act.puzzles) return true;
  return act.puzzles.every(puzzle => {
    const state = game.puzzleState[puzzle.id];
    return state && state.solvedBy !== null;
  });
}

function getActData(game, actNumber) {
  if (!game.case || !game.case.acts) return { documents: [], puzzles: [] };
  const act = game.case.acts[actNumber - 1];
  if (!act) return { documents: [], puzzles: [] };

  const documents = (act.documents || []).map(doc => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    content: doc.content,
    act: actNumber
  }));

  const puzzles = (act.puzzles || []).map(puzzle => {
    const state = game.puzzleState[puzzle.id] || { attempts: 0, hintsUsed: 0, solvedBy: null, solvedAt: null };
    const revealedHints = [];
    if (puzzle.hints) {
      for (let i = 0; i < state.hintsUsed && i < puzzle.hints.length; i++) {
        revealedHints.push(puzzle.hints[i]);
      }
    }
    return {
      id: puzzle.id,
      title: puzzle.title,
      description: puzzle.description,
      type: puzzle.type,
      act: actNumber,
      attempts: state.attempts,
      hintsUsed: state.hintsUsed,
      solvedBy: state.solvedBy,
      solvedAt: state.solvedAt,
      revealedHints,
      revealText: state.solvedBy ? puzzle.revealText : undefined
    };
  });

  return { documents, puzzles };
}

// --- Core game functions ---

async function startGame(room, io) {
  const playerIds = Array.from(room.players.keys());

  const game = {
    state: 'generating',
    case: null,
    clientCase: null,
    currentAct: 1,
    players: {},
    playerOrder: shuffle([...playerIds]),
    sharedNotes: '',
    privateNotes: {},
    pinnedDocuments: [],
    suspicionMarkers: {},
    puzzleState: {},
    gameLog: [],
    startTime: Date.now(),
    endTime: null,
    stars: 5
  };

  for (const id of playerIds) {
    const pData = room.players.get(id);
    game.players[id] = {
      name: pData.name,
      connected: true
    };
    game.privateNotes[id] = '';
    game.suspicionMarkers[id] = {};
  }

  room.game = game;

  io.to(room.code).emit('game-starting', { message: 'Generating the case file...' });

  let caseData;
  try {
    caseData = await generateCase(playerIds.length);
  } catch (err) {
    console.error('[Game] Case generation failed:', err);
    game.state = 'gameover';
    io.to(room.code).emit('error-msg', { message: 'Failed to generate case. Please try again.' });
    return { error: 'Case generation failed' };
  }

  game.case = caseData;
  game.clientCase = getClientCase(caseData);

  // Initialize puzzle state for all puzzles across all acts
  for (const act of caseData.acts) {
    if (act.puzzles) {
      for (const puzzle of act.puzzles) {
        game.puzzleState[puzzle.id] = {
          attempts: 0,
          hintsUsed: 0,
          solvedBy: null,
          solvedAt: null
        };
      }
    }
  }

  game.state = 'intro';

  addLog(game, 'A new case has been opened.', 'system');
  addLog(game, `Case: ${caseData.title}`, 'system');

  const actData = getActData(game, 1);

  for (const id of playerIds) {
    io.to(id).emit('game-started', {
      clientCase: game.clientCase,
      suspects: game.clientCase.suspects,
      currentAct: 1,
      documents: actData.documents,
      puzzles: actData.puzzles,
      players: buildPlayerList(game),
      playerOrder: game.playerOrder,
      stars: game.stars,
      gameLog: game.gameLog
    });
  }

  return { success: true };
}

function handleSubmitAnswer(game, socketId, puzzleId, answer, io, roomCode) {
  if (game.state !== 'playing' && game.state !== 'intro') {
    return { error: 'Cannot submit answers in current state' };
  }

  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  const puzzleStateEntry = game.puzzleState[puzzleId];
  if (!puzzleStateEntry) return { error: 'Puzzle not found' };
  if (puzzleStateEntry.solvedBy !== null) return { error: 'Puzzle already solved' };

  // Find the puzzle in the case data
  let puzzle = null;
  for (const act of game.case.acts) {
    if (act.puzzles) {
      puzzle = act.puzzles.find(p => p.id === puzzleId);
      if (puzzle) break;
    }
  }
  if (!puzzle) return { error: 'Puzzle not found in case data' };

  const isCorrect = validateAnswer(puzzle, answer);

  if (isCorrect) {
    puzzleStateEntry.solvedBy = socketId;
    puzzleStateEntry.solvedAt = Date.now();

    addLog(game, `${player.name} solved: ${puzzle.title}`, 'puzzle');

    io.to(roomCode).emit('puzzle-solved', {
      puzzleId,
      solvedBy: socketId,
      solvedByName: player.name,
      revealText: puzzle.revealText || 'The answer has been revealed.',
      puzzleState: game.puzzleState[puzzleId]
    });

    io.to(roomCode).emit('game-log', { log: game.gameLog });

    // Check if the current act is complete
    if (isActComplete(game, game.currentAct)) {
      addLog(game, `All puzzles in Act ${game.currentAct} have been solved.`, 'act');

      if (game.currentAct >= game.case.acts.length) {
        // All acts complete -- move to final accusation
        game.state = 'final_accusation';
        addLog(game, 'All evidence has been examined. Time to make your accusation.', 'system');
        io.to(roomCode).emit('act-complete', {
          actNumber: game.currentAct,
          allActsComplete: true
        });
      } else {
        game.state = 'act_transition';
        io.to(roomCode).emit('act-complete', {
          actNumber: game.currentAct,
          allActsComplete: false,
          nextAct: game.currentAct + 1
        });
      }

      io.to(roomCode).emit('game-log', { log: game.gameLog });
    }

    return { success: true, correct: true };
  } else {
    puzzleStateEntry.attempts++;

    // Auto-reveal hints at attempt thresholds: 2, 4, 6
    let hintRevealed = null;
    const autoHintThresholds = [2, 4, 6];
    if (autoHintThresholds.includes(puzzleStateEntry.attempts) && puzzle.hints) {
      const nextHintIndex = puzzleStateEntry.hintsUsed;
      if (nextHintIndex < puzzle.hints.length) {
        puzzleStateEntry.hintsUsed++;
        hintRevealed = puzzle.hints[nextHintIndex];
      }
    }

    io.to(roomCode).emit('puzzle-result', {
      puzzleId,
      correct: false,
      attempts: puzzleStateEntry.attempts,
      submittedBy: socketId,
      submittedByName: player.name,
      hintRevealed,
      hintsUsed: puzzleStateEntry.hintsUsed
    });

    return { success: true, correct: false, attempts: puzzleStateEntry.attempts };
  }
}

function handleRequestHint(game, socketId, puzzleId, io, roomCode) {
  if (game.state !== 'playing' && game.state !== 'intro') {
    return { error: 'Cannot request hints in current state' };
  }

  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  const puzzleStateEntry = game.puzzleState[puzzleId];
  if (!puzzleStateEntry) return { error: 'Puzzle not found' };
  if (puzzleStateEntry.solvedBy !== null) return { error: 'Puzzle already solved' };

  // Find the puzzle in the case data
  let puzzle = null;
  for (const act of game.case.acts) {
    if (act.puzzles) {
      puzzle = act.puzzles.find(p => p.id === puzzleId);
      if (puzzle) break;
    }
  }
  if (!puzzle) return { error: 'Puzzle not found in case data' };

  if (!puzzle.hints || puzzleStateEntry.hintsUsed >= puzzle.hints.length) {
    return { error: 'No more hints available' };
  }

  if (game.stars <= 0) {
    return { error: 'No stars remaining to spend on hints' };
  }

  game.stars--;
  const hintIndex = puzzleStateEntry.hintsUsed;
  puzzleStateEntry.hintsUsed++;
  const hint = puzzle.hints[hintIndex];

  addLog(game, `${player.name} requested a hint for: ${puzzle.title} (${game.stars} stars remaining)`, 'puzzle');

  io.to(roomCode).emit('hint-revealed', {
    puzzleId,
    hint,
    hintIndex,
    hintsUsed: puzzleStateEntry.hintsUsed,
    requestedBy: socketId,
    requestedByName: player.name,
    starsRemaining: game.stars
  });

  io.to(roomCode).emit('game-log', { log: game.gameLog });

  return { success: true };
}

function handlePinDocument(game, socketId, docId, io, roomCode) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  const idx = game.pinnedDocuments.indexOf(docId);
  if (idx === -1) {
    game.pinnedDocuments.push(docId);
  } else {
    game.pinnedDocuments.splice(idx, 1);
  }

  addLog(game, `${player.name} ${idx === -1 ? 'pinned' : 'unpinned'} a document.`, 'system');

  io.to(roomCode).emit('document-pinned', {
    docId,
    pinned: idx === -1,
    pinnedDocuments: game.pinnedDocuments,
    pinnedBy: socketId,
    pinnedByName: player.name
  });

  return { success: true };
}

function handleUpdateSuspicion(game, socketId, suspectId, marker, io, roomCode) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  if (!game.suspicionMarkers[socketId]) {
    game.suspicionMarkers[socketId] = {};
  }

  if (marker === null || marker === undefined) {
    delete game.suspicionMarkers[socketId][suspectId];
  } else {
    game.suspicionMarkers[socketId][suspectId] = marker;
  }

  io.to(roomCode).emit('suspicion-updated', {
    playerId: socketId,
    playerName: player.name,
    suspectId,
    marker,
    allSuspicionMarkers: game.suspicionMarkers
  });

  return { success: true };
}

function handleUpdateSharedNotes(game, socketId, content, io, roomCode) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  game.sharedNotes = (content || '').substring(0, 5000);

  io.to(roomCode).emit('shared-notes-updated', {
    content: game.sharedNotes,
    updatedBy: socketId,
    updatedByName: player.name
  });

  return { success: true };
}

function handleSavePrivateNotes(game, socketId, content) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  game.privateNotes[socketId] = (content || '').substring(0, 5000);

  return { success: true };
}

function handleProceedToAct(game, socketId, actNumber, io, roomCode) {
  if (game.state !== 'act_transition') {
    return { error: 'Cannot proceed to next act in current state' };
  }

  if (actNumber !== game.currentAct + 1) {
    return { error: 'Invalid act number' };
  }

  if (actNumber > game.case.acts.length) {
    return { error: 'No more acts available' };
  }

  // Verify the previous act is actually complete
  if (!isActComplete(game, game.currentAct)) {
    return { error: 'Current act is not complete' };
  }

  game.currentAct = actNumber;
  game.state = 'playing';

  const actData = getActData(game, actNumber);

  addLog(game, `Act ${actNumber} has begun.`, 'act');

  io.to(roomCode).emit('act-started', {
    actNumber,
    documents: actData.documents,
    puzzles: actData.puzzles,
    totalActs: game.case.acts.length
  });

  io.to(roomCode).emit('game-log', { log: game.gameLog });

  return { success: true };
}

function handleSubmitAccusation(game, socketId, data, io, roomCode) {
  if (game.state !== 'final_accusation') {
    return { error: 'Cannot submit accusation in current state' };
  }

  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  const { suspectId, motive } = data;
  if (!suspectId) return { error: 'Must specify a suspect' };

  const accusation = game.case.finalAccusation;
  if (!accusation) return { error: 'Case has no final accusation data' };

  const correctSuspect = suspectId === accusation.culpritId;
  const correctMotive = motive && accusation.motive &&
    motive.toLowerCase().trim() === accusation.motive.toLowerCase().trim();

  // Calculate final star rating
  // Start with current stars (reduced by hints used)
  let finalStars = game.stars;

  // Bonus for correct accusation
  if (correctSuspect) {
    // Keep current stars as base
    if (correctMotive) {
      // Bonus star for getting the motive right (cap at 5)
      finalStars = Math.min(5, finalStars + 1);
    }
  } else {
    // Wrong suspect -- major penalty
    finalStars = Math.max(1, finalStars - 2);
  }

  game.stars = finalStars;
  game.endTime = Date.now();
  game.state = 'gameover';

  const stats = getCaseStats(game);
  const elapsed = game.endTime - game.startTime;

  addLog(game, `${player.name} submitted the final accusation.`, 'system');
  addLog(game, correctSuspect ? 'The correct culprit has been identified.' : 'The accusation was incorrect.', 'system');

  io.to(roomCode).emit('accusation-result', {
    submittedBy: socketId,
    submittedByName: player.name,
    suspectId,
    motive: motive || '',
    correctSuspect,
    correctMotive: !!correctMotive,
    actualCulpritId: accusation.culpritId,
    actualMotive: accusation.motive,
    explanation: accusation.explanation || '',
    stars: finalStars
  });

  io.to(roomCode).emit('game-over', {
    stars: finalStars,
    correctSuspect,
    correctMotive: !!correctMotive,
    actualCulpritId: accusation.culpritId,
    actualMotive: accusation.motive,
    explanation: accusation.explanation || '',
    stats,
    elapsed,
    gameLog: game.gameLog
  });

  io.to(roomCode).emit('game-log', { log: game.gameLog });

  return { success: true, correctSuspect, stars: finalStars };
}

function getGameState(game, socketId) {
  if (!game) return null;

  const allDocuments = [];
  const allPuzzles = [];
  for (let act = 1; act <= game.currentAct; act++) {
    const actData = getActData(game, act);
    allDocuments.push(...actData.documents);
    allPuzzles.push(...actData.puzzles);
  }

  return {
    state: game.state,
    clientCase: game.clientCase,
    suspects: game.clientCase ? game.clientCase.suspects : [],
    currentAct: game.currentAct,
    totalActs: game.case ? game.case.acts.length : 3,
    players: buildPlayerList(game),
    playerOrder: game.playerOrder,
    documents: allDocuments,
    puzzles: allPuzzles,
    pinnedDocuments: game.pinnedDocuments,
    suspicionMarkers: game.suspicionMarkers,
    sharedNotes: game.sharedNotes,
    privateNotes: game.privateNotes[socketId] || '',
    puzzleState: game.puzzleState,
    gameLog: game.gameLog,
    stars: game.stars,
    startTime: game.startTime,
    endTime: game.endTime
  };
}

// --- Internal helpers ---

function buildPlayerList(game) {
  const list = {};
  for (const [id, p] of Object.entries(game.players)) {
    list[id] = { name: p.name, connected: p.connected };
  }
  return list;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  startGame,
  handleSubmitAnswer,
  handleRequestHint,
  handlePinDocument,
  handleUpdateSuspicion,
  handleUpdateSharedNotes,
  handleSavePrivateNotes,
  handleProceedToAct,
  handleSubmitAccusation,
  getGameState
};
