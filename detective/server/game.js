const { generateClues } = require('./clues');

const STATE = {
  WAITING: 'waiting',
  GENERATING: 'generating',
  INVESTIGATING: 'investigating',
  MEETING: 'meeting',
  VOTING: 'voting',
  VOTE_RESULT: 'vote_result',
  GAME_OVER: 'gameover'
};

const ROUND_DURATION = 90000; // 90 seconds per investigation round
const MEETING_DURATION = 120000; // 2 min discussion
const VOTE_DURATION = 30000; // 30s to vote

async function startGame(room, io) {
  const playerIds = Array.from(room.players.keys());
  if (playerIds.length < 3) return { error: 'Need at least 3 players' };

  const game = {
    state: STATE.GENERATING,
    players: {},
    playerOrder: shuffle([...playerIds]),
    round: 0,
    maxRounds: 8,
    guessesLeft: 3,
    revealedClues: [],
    meetingCaller: null,
    votes: {},
    voteTarget: null,
    log: [],
    timers: {},
    caseName: '',
    caseIntro: ''
  };

  // Assign roles
  const murdererIdx = Math.floor(Math.random() * playerIds.length);
  const allNames = [];

  playerIds.forEach((id, i) => {
    const pData = room.players.get(id);
    game.players[id] = {
      name: pData.name,
      role: i === murdererIdx ? 'murderer' : 'detective',
      alive: true,
      clues: [],
      hasCalledMeeting: false,
      voted: false,
      notes: ''
    };
    allNames.push(pData.name);
  });

  room.game = game;
  const murdererId = playerIds[murdererIdx];
  const murdererName = game.players[murdererId].name;

  io.to(room.code).emit('game-starting', { message: 'The case is being prepared...' });

  // Generate all clues for the entire game
  let allClues;
  try {
    allClues = await generateClues(murdererName, allNames, game.maxRounds, playerIds.length);
    game.caseName = allClues.caseName || 'The Midnight Murder';
    game.caseIntro = allClues.caseIntro || 'A body has been found under mysterious circumstances. One among you is the killer.';
  } catch (err) {
    console.error('[Game] Clue generation failed:', err);
    allClues = generateFallbackStructure(murdererName, allNames, game.maxRounds);
    game.caseName = allClues.caseName;
    game.caseIntro = allClues.caseIntro;
  }

  game.allClues = allClues;

  // Send game start to each player
  for (const id of playerIds) {
    const p = game.players[id];
    io.to(id).emit('game-started', {
      role: p.role,
      caseName: game.caseName,
      caseIntro: game.caseIntro,
      playerOrder: game.playerOrder.map(pid => ({
        id: pid,
        name: game.players[pid].name
      })),
      maxRounds: game.maxRounds,
      guessesLeft: game.guessesLeft
    });
  }

  // Start first investigation round after brief intro
  setTimeout(() => {
    startRound(room, io);
  }, 5000);

  return { success: true };
}

function startRound(room, io) {
  const game = room.game;
  if (!game || game.state === STATE.GAME_OVER) return;

  game.round++;
  if (game.round > game.maxRounds) {
    endGame(game, { winner: 'murderer', reason: 'The investigation ran cold. The killer got away.' }, io, room.code);
    return;
  }

  game.state = STATE.INVESTIGATING;

  // Reset per-round state
  for (const p of Object.values(game.players)) {
    p.hasCalledMeeting = false;
  }

  // Distribute clues for this round
  const roundClues = game.allClues.rounds[game.round - 1];
  if (roundClues) {
    for (const [id, p] of Object.entries(game.players)) {
      const playerClues = roundClues[p.name] || roundClues.shared || [];
      const cluesForPlayer = Array.isArray(playerClues) ? playerClues : [playerClues];
      for (const clue of cluesForPlayer) {
        if (clue) {
          const clueObj = { ...clue, round: game.round, id: `clue-${game.round}-${p.name}-${Math.random().toString(36).slice(2, 6)}` };
          p.clues.push(clueObj);
        }
      }
      io.to(id).emit('new-clues', {
        clues: p.clues,
        round: game.round,
        newCount: cluesForPlayer.filter(c => c).length
      });
    }
  }

  addLog(game, `Round ${game.round} of ${game.maxRounds} — New evidence has been uncovered.`);

  io.to(room.code).emit('round-started', {
    round: game.round,
    maxRounds: game.maxRounds,
    guessesLeft: game.guessesLeft,
    duration: ROUND_DURATION
  });

  io.to(room.code).emit('game-log', { log: game.log });

  // Auto-advance to next round after timer
  clearTimeout(game.timers.round);
  game.timers.round = setTimeout(() => {
    if (game.state === STATE.INVESTIGATING) {
      startRound(room, io);
    }
  }, ROUND_DURATION);
}

function handleCallMeeting(game, socketId, io, roomCode, room) {
  if (game.state !== STATE.INVESTIGATING) return { error: 'Can only call meetings during investigation' };
  const player = game.players[socketId];
  if (!player || !player.alive) return { error: 'Cannot call meeting' };

  clearTimeout(game.timers.round);
  game.state = STATE.MEETING;
  game.meetingCaller = socketId;

  addLog(game, `${player.name} called an emergency meeting!`);

  io.to(roomCode).emit('meeting-called', {
    callerId: socketId,
    callerName: player.name,
    duration: MEETING_DURATION
  });

  io.to(roomCode).emit('game-log', { log: game.log });

  // After discussion time, prompt for vote or skip
  clearTimeout(game.timers.meeting);
  game.timers.meeting = setTimeout(() => {
    if (game.state === STATE.MEETING) {
      // Auto-end meeting, go back to investigating
      game.state = STATE.INVESTIGATING;
      io.to(roomCode).emit('meeting-ended', { reason: 'Time ran out' });
      // Resume investigation round
      game.timers.round = setTimeout(() => {
        if (game.state === STATE.INVESTIGATING) {
          startRound(room, io);
        }
      }, 30000); // 30s remaining in round after meeting
    }
  }, MEETING_DURATION);

  return { success: true };
}

function handleCallVote(game, socketId, targetId, io, roomCode, room) {
  if (game.state !== STATE.MEETING) return { error: 'Can only vote during a meeting' };
  if (game.guessesLeft <= 0) return { error: 'No guesses remaining' };
  if (!targetId || !game.players[targetId] || !game.players[targetId].alive) return { error: 'Invalid target' };
  if (targetId === socketId) return { error: 'Cannot accuse yourself' };

  const player = game.players[socketId];
  clearTimeout(game.timers.meeting);

  game.state = STATE.VOTING;
  game.votes = {};
  game.voteTarget = targetId;

  addLog(game, `${player.name} accuses ${game.players[targetId].name}! All players must vote.`);

  io.to(roomCode).emit('vote-started', {
    accuserId: socketId,
    accuserName: player.name,
    targetId,
    targetName: game.players[targetId].name,
    guessesLeft: game.guessesLeft,
    duration: VOTE_DURATION
  });

  io.to(roomCode).emit('game-log', { log: game.log });

  // Vote timer
  clearTimeout(game.timers.vote);
  game.timers.vote = setTimeout(() => {
    if (game.state === STATE.VOTING) {
      resolveVote(game, io, roomCode, room);
    }
  }, VOTE_DURATION);

  return { success: true };
}

function handleVote(game, socketId, vote, io, roomCode, room) {
  if (game.state !== STATE.VOTING) return { error: 'No active vote' };
  const player = game.players[socketId];
  if (!player || !player.alive) return { error: 'Cannot vote' };

  game.votes[socketId] = vote; // 'guilty' or 'innocent'

  const aliveCount = Object.values(game.players).filter(p => p.alive).length;
  const voteCount = Object.keys(game.votes).length;

  io.to(roomCode).emit('vote-update', {
    votesIn: voteCount,
    votesNeeded: aliveCount
  });

  if (voteCount >= aliveCount) {
    clearTimeout(game.timers.vote);
    resolveVote(game, io, roomCode, room);
  }

  return { success: true };
}

function resolveVote(game, io, roomCode, room) {
  const votes = Object.values(game.votes);
  const guilty = votes.filter(v => v === 'guilty').length;
  const innocent = votes.filter(v => v === 'innocent').length;
  const majority = guilty > innocent;

  game.state = STATE.VOTE_RESULT;

  if (majority) {
    game.guessesLeft--;
    const target = game.players[game.voteTarget];
    const isCorrect = target.role === 'murderer';

    if (isCorrect) {
      addLog(game, `The vote passes! ${target.name} WAS the murderer! Case solved!`);
      io.to(roomCode).emit('vote-result', {
        passed: true,
        correct: true,
        targetName: target.name,
        targetRole: target.role,
        guilty,
        innocent,
        guessesLeft: game.guessesLeft
      });
      endGame(game, {
        winner: 'detectives',
        reason: `${target.name} was exposed as the murderer! Justice is served.`
      }, io, roomCode);
      return;
    } else {
      addLog(game, `The vote passes, but ${target.name} was INNOCENT! ${game.guessesLeft} guesses remaining.`);
      io.to(roomCode).emit('vote-result', {
        passed: true,
        correct: false,
        targetName: target.name,
        targetRole: 'detective',
        guilty,
        innocent,
        guessesLeft: game.guessesLeft
      });

      if (game.guessesLeft <= 0) {
        endGame(game, {
          winner: 'murderer',
          reason: 'All guesses exhausted! The murderer walks free.'
        }, io, roomCode);
        return;
      }
    }
  } else {
    addLog(game, `The vote fails — not enough votes to convict ${game.players[game.voteTarget].name}.`);
    io.to(roomCode).emit('vote-result', {
      passed: false,
      targetName: game.players[game.voteTarget].name,
      guilty,
      innocent,
      guessesLeft: game.guessesLeft
    });
  }

  // Return to investigation after short delay
  game.votes = {};
  game.voteTarget = null;
  setTimeout(() => {
    if (game.state !== STATE.GAME_OVER) {
      game.state = STATE.INVESTIGATING;
      io.to(roomCode).emit('resume-investigation', { round: game.round });
      game.timers.round = setTimeout(() => {
        if (game.state === STATE.INVESTIGATING) {
          startRound(room, io);
        }
      }, 45000);
    }
  }, 5000);
}

function handleShareClue(game, socketId, clueId, io, roomCode) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };

  const clue = player.clues.find(c => c.id === clueId);
  if (!clue) return { error: 'Clue not found' };

  // Murderer can share modified clues (lie)
  const sharedClue = {
    ...clue,
    sharedBy: player.name,
    sharedById: socketId
  };

  game.revealedClues.push(sharedClue);
  addLog(game, `${player.name} shared evidence with the group.`);

  io.to(roomCode).emit('clue-shared', {
    clue: sharedClue,
    sharedBy: player.name,
    allShared: game.revealedClues
  });

  return { success: true };
}

function handleFakeClue(game, socketId, fakeText, clueType, io, roomCode) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };
  if (player.role !== 'murderer') return { error: 'Only the murderer can fabricate evidence' };

  const fakeClue = {
    id: `fake-${Date.now()}`,
    type: clueType || 'witness_statement',
    title: getClueTypeTitle(clueType || 'witness_statement'),
    text: fakeText,
    round: game.round,
    sharedBy: player.name,
    sharedById: socketId,
    fake: true // Server knows but clients don't
  };

  // Remove the fake flag before sending to clients
  const publicClue = { ...fakeClue };
  delete publicClue.fake;

  game.revealedClues.push(fakeClue);
  addLog(game, `${player.name} shared evidence with the group.`);

  io.to(roomCode).emit('clue-shared', {
    clue: publicClue,
    sharedBy: player.name,
    allShared: game.revealedClues.map(c => { const p = { ...c }; delete p.fake; return p; })
  });

  return { success: true };
}

function handleSaveNotes(game, socketId, notes) {
  const player = game.players[socketId];
  if (!player) return { error: 'Not in game' };
  player.notes = notes.substring(0, 2000);
  return { success: true };
}

function endGame(game, result, io, roomCode) {
  game.state = STATE.GAME_OVER;
  clearTimeout(game.timers.round);
  clearTimeout(game.timers.meeting);
  clearTimeout(game.timers.vote);

  const roles = {};
  for (const [id, p] of Object.entries(game.players)) {
    roles[id] = { name: p.name, role: p.role, alive: p.alive };
  }

  io.to(roomCode).emit('game-over', { ...result, roles, caseName: game.caseName });
}

function getGameState(game, socketId) {
  if (!game || game.state === STATE.WAITING) return null;

  const player = game.players[socketId];
  const players = {};
  for (const [id, p] of Object.entries(game.players)) {
    players[id] = { name: p.name, alive: p.alive };
  }

  return {
    state: game.state,
    players,
    playerOrder: game.playerOrder,
    round: game.round,
    maxRounds: game.maxRounds,
    guessesLeft: game.guessesLeft,
    caseName: game.caseName,
    caseIntro: game.caseIntro,
    clues: player ? player.clues : [],
    sharedClues: game.revealedClues.map(c => { const p = { ...c }; delete p.fake; return p; }),
    role: player ? player.role : null,
    notes: player ? player.notes : '',
    log: game.log
  };
}

function addLog(game, msg) {
  game.log.push({ text: msg, time: Date.now() });
  if (game.log.length > 100) game.log.shift();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getClueTypeTitle(type) {
  const titles = {
    witness_statement: 'Witness Statement',
    forensic_report: 'Forensic Report',
    personal_letter: 'Personal Letter',
    newspaper_clipping: 'Newspaper Clipping',
    crime_scene_note: 'Crime Scene Note',
    phone_record: 'Phone Record',
    photograph: 'Photograph Description',
    autopsy_note: 'Autopsy Note'
  };
  return titles[type] || 'Evidence';
}

function generateFallbackStructure(murdererName, allNames, maxRounds) {
  const idx = allNames.indexOf(murdererName);
  const fl = murdererName[0].toUpperCase();
  const ll = murdererName[murdererName.length - 1].toUpperCase();
  const len = murdererName.length;

  const rounds = [];
  for (let r = 0; r < maxRounds; r++) {
    const roundClues = {};
    for (const name of allNames) {
      const isMurderer = name === murdererName;
      if (r < 3) {
        roundClues[name] = [{
          type: 'crime_scene_note',
          title: 'Crime Scene Note',
          text: isMurderer
            ? 'The crime scene shows signs of a struggle. Footprints lead toward the garden.'
            : ['The victim was last seen alive at 11 PM.', 'A broken window was found on the east side.', 'Traces of mud were found near the entrance.'][r]
        }];
      } else if (r < 6) {
        roundClues[name] = [{
          type: 'witness_statement',
          title: 'Witness Statement',
          text: isMurderer
            ? 'A neighbor heard nothing unusual that evening.'
            : [`A witness saw someone whose name starts with "${fl}" near the scene.`,
               `The suspect is known to have a ${len}-letter name.`,
               `Records show the ${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} person listed had no alibi.`][r - 3]
        }];
      } else {
        roundClues[name] = [{
          type: 'forensic_report',
          title: 'Forensic Report',
          text: isMurderer
            ? 'DNA analysis is still inconclusive.'
            : [`Handwriting analysis points to someone with initials "${fl}.${ll}."`,
               `The suspect\'s name reversed reads "${murdererName.split('').reverse().join('')}".`][r - 6] || `All evidence converges on the ${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} player.`
        }];
      }
    }
    rounds.push(roundClues);
  }

  return {
    caseName: 'The Midnight Murder',
    caseIntro: 'A body has been discovered in the old manor. One among you committed this terrible crime. Gather evidence, share findings, and unmask the killer — but be careful, the murderer walks among you and will try to mislead.',
    rounds
  };
}

module.exports = {
  STATE, startGame, startRound,
  handleCallMeeting, handleCallVote, handleVote,
  handleShareClue, handleFakeClue, handleSaveNotes,
  getGameState
};
