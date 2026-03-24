/* ============================================
   WHODUNIT - COOPERATIVE MYSTERY CLIENT
   ============================================ */
const App = (() => {
  let socket = null;
  let sessionToken = localStorage.getItem('whodunit-session');
  let roomCode = null;
  let isHost = false;
  let gameState = null;
  let elapsedInterval = null;
  let unreadChat = 0;
  let currentDocFilter = 'all';
  let openPuzzleId = null;
  let notesDebounce = null;

  function init() {
    socket = io({ transports: ['polling', 'websocket'], upgrade: true });
    bindSocket();
    bindUI();
    const saved = localStorage.getItem('whodunit-name');
    if (saved) $('player-name').value = saved;
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) $('room-code-input').value = params.get('room');
  }

  // ---- Socket Events ----
  function bindSocket() {
    socket.on('connect', () => {
      if (sessionToken) socket.emit('register-session', { sessionToken, playerName: localStorage.getItem('whodunit-name') || '' });
    });

    socket.on('room-created', d => { sessionToken = d.sessionToken; localStorage.setItem('whodunit-session', sessionToken); });
    socket.on('room-joined', d => {
      if (d.sessionToken) { sessionToken = d.sessionToken; localStorage.setItem('whodunit-session', sessionToken); }
      roomCode = d.code;
      isHost = d.isHost;
      $('lobby-code').textContent = d.code;
      renderPlayerList(d.players);
      updateLobbyStatus(d.players.length);
      showScreen('lobby');
    });
    socket.on('room-updated', d => {
      renderPlayerList(d.players);
      updateLobbyStatus(d.players.length);
      const me = d.players.find(p => p.id === socket.id);
      if (me) isHost = me.isHost;
    });
    socket.on('room-left', () => { roomCode = null; gameState = null; showScreen('title'); });
    socket.on('public-rooms', renderPublicRooms);
    socket.on('error-msg', d => toast(d.message, 'red'));

    // Game events
    socket.on('game-started', onGameStarted);
    socket.on('game-reconnect', onGameReconnect);
    socket.on('puzzle-result', onPuzzleResult);
    socket.on('puzzle-solved', onPuzzleSolved);
    socket.on('hint-revealed', onHintRevealed);
    socket.on('document-pinned', onDocumentPinned);
    socket.on('suspicion-updated', onSuspicionUpdated);
    socket.on('shared-notes-updated', onSharedNotesUpdated);
    socket.on('act-complete', onActCompleted);
    socket.on('act-started', onActStarted);
    socket.on('accusation-result', onAccusationResult);
    socket.on('game-over', onGameOver);
    socket.on('chat-message', onChatMessage);
    socket.on('player-disconnected', d => addSystemChat(d.name + ' disconnected'));
    socket.on('player-reconnected', d => addSystemChat(d.name + ' reconnected'));
  }

  // ---- UI Bindings ----
  function bindUI() {
    $('btn-create-public').addEventListener('click', () => createRoom(true));
    $('btn-create-private').addEventListener('click', () => createRoom(false));
    $('btn-join-code').addEventListener('click', joinByCode);
    $('btn-browse').addEventListener('click', () => { socket.emit('browse-rooms'); showScreen('browse'); });
    $('btn-how-to-play').addEventListener('click', () => showScreen('howto'));
    $('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinByCode(); });
    $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(true); });
    $('btn-howto-back').addEventListener('click', () => showScreen('title'));
    $('btn-browse-back').addEventListener('click', () => showScreen('title'));
    $('btn-refresh-rooms').addEventListener('click', () => socket.emit('browse-rooms'));

    $('btn-start-game').addEventListener('click', () => socket.emit('start-game'));
    $('btn-leave-room').addEventListener('click', () => { socket.emit('leave-room'); clearSession(); });
    $('btn-copy-code').addEventListener('click', copyInvite);

    $('btn-begin-investigation').addEventListener('click', () => { showScreen('game'); startElapsedTimer(); });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Doc filters
    document.querySelectorAll('.doc-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.doc-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDocFilter = btn.dataset.filter;
        renderDocuments();
      });
    });

    // Document viewer
    $('btn-close-doc').addEventListener('click', closeDocViewer);
    $('btn-pin-doc').addEventListener('click', () => {
      const docId = $('btn-pin-doc').dataset.docId;
      if (docId) socket.emit('pin-document', { docId });
    });

    // Puzzle viewer
    $('btn-close-puzzle').addEventListener('click', closePuzzleViewer);
    $('btn-submit-answer').addEventListener('click', submitAnswer);
    $('puzzle-answer-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });
    $('btn-request-hint').addEventListener('click', requestHint);

    // Chat
    $('btn-chat-send').addEventListener('click', sendChat);
    $('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

    // Notes
    $('shared-notes').addEventListener('input', () => {
      clearTimeout(notesDebounce);
      notesDebounce = setTimeout(() => {
        socket.emit('update-shared-notes', { content: $('shared-notes').value });
      }, 500);
    });
    $('private-notes').addEventListener('input', () => {
      clearTimeout(notesDebounce);
      notesDebounce = setTimeout(() => {
        socket.emit('save-private-notes', { content: $('private-notes').value });
      }, 1000);
    });

    // Accusation
    $('btn-submit-accusation').addEventListener('click', submitAccusation);
    $('btn-back-to-game').addEventListener('click', () => showScreen('game'));

    // Game over
    $('btn-play-again').addEventListener('click', () => { socket.emit('leave-room'); clearSession(); showScreen('title'); });
  }

  // ---- Screens ----
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
    // Hide overlays
    $('doc-viewer').classList.add('hidden');
    $('puzzle-viewer').classList.add('hidden');
    $('screen-act-transition').classList.add('hidden');
  }

  // ---- Room Logic ----
  function createRoom(pub) {
    const name = getName();
    if (!name) return toast('Enter your name first!', 'red');
    localStorage.setItem('whodunit-name', name);
    socket.emit('create-room', { name, isPublic: pub });
  }

  function joinByCode() {
    const name = getName();
    const code = $('room-code-input').value.trim().toUpperCase();
    if (!name) return toast('Enter your name first!', 'red');
    if (!code || code.length !== 4) return toast('Enter a 4-letter room code', 'red');
    localStorage.setItem('whodunit-name', name);
    socket.emit('join-room', { code, name });
  }

  function getName() { return $('player-name').value.trim(); }

  function copyInvite() {
    navigator.clipboard.writeText(location.origin + '?room=' + roomCode).then(() => {
      const btn = $('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy Invite', 2000);
    });
  }

  function clearSession() {
    sessionToken = null; roomCode = null; gameState = null;
    clearInterval(elapsedInterval);
    localStorage.removeItem('whodunit-session');
  }

  function renderPlayerList(players) {
    $('player-list').innerHTML = players.map((p, i) =>
      '<div class="player-item"><div class="player-avatar" style="background:' +
      ['#c0392b','#2980b9','#27ae60','#d4a040','#8e44ad','#16a085','#d35400','#c0392b'][i % 8] +
      '">' + esc(p.name[0]).toUpperCase() + '</div><span class="player-name">' + esc(p.name) + '</span>' +
      (p.isHost ? '<span class="host-badge">HOST</span>' : '') + '</div>'
    ).join('');
  }

  function updateLobbyStatus(count) {
    $('lobby-status').textContent = count + ' investigator' + (count !== 1 ? 's' : '') + ' ready';
    $('btn-start-game').style.display = isHost ? '' : 'none';
  }

  function renderPublicRooms(rooms) {
    const list = $('rooms-list');
    if (!rooms.length) { list.innerHTML = '<p class="empty-msg">No open cases. Create a new one.</p>'; return; }
    list.innerHTML = rooms.map(r =>
      '<div class="room-item"><div><span class="room-host">' + esc(r.host) + '\'s Case</span><br><span class="room-count">' + r.count + '/8 investigators</span></div>' +
      '<button class="btn btn-gold btn-sm" onclick="App.joinPublic(\'' + r.code + '\')">Join</button></div>'
    ).join('');
  }

  function joinPublic(code) {
    const name = getName();
    if (!name) { showScreen('title'); return toast('Enter your name first!', 'red'); }
    localStorage.setItem('whodunit-name', name);
    socket.emit('join-room', { code, name });
  }

  // ---- Game Start ----
  function onGameStarted(data) {
    // Server sends clientCase, documents, puzzles, suspects
    const caseData = data.clientCase || {};
    // Merge act 1 documents/puzzles into the case acts structure
    if (caseData.acts && caseData.acts[0]) {
      caseData.acts[0].documents = data.documents || caseData.acts[0].documents || [];
      caseData.acts[0].puzzles = data.puzzles || caseData.acts[0].puzzles || [];
    }

    gameState = {
      caseData: caseData,
      currentAct: data.currentAct || 1,
      puzzleState: {},
      pinnedDocuments: [],
      suspicionMarkers: {},
      sharedNotes: '',
      privateNotes: '',
      stars: data.stars || 5,
      startTime: Date.now()
    };

    // Init puzzle state
    if (caseData.acts) {
      caseData.acts.forEach(act => {
        if (act.puzzles) act.puzzles.forEach(p => {
          gameState.puzzleState[p.id] = { attempts: 0, hintsUsed: 0, solved: false, solvedBy: null };
        });
      });
    }

    // Show intro
    const c = caseData;
    $('intro-case-name').textContent = c.title;
    $('intro-setting').textContent = c.setting;
    $('intro-case-text').textContent = c.crimeDescription;
    $('intro-victim').innerHTML = '<strong>Victim:</strong> ' + esc(c.victim.name) + ' -- ' + esc(c.victim.description);

    $('intro-suspects').innerHTML = c.suspects.map(s =>
      '<div class="intro-suspect-card">' +
      '<div class="suspect-initial">' + esc(s.name[0]) + '</div>' +
      '<div><strong>' + esc(s.name) + '</strong><br><span class="dim">' + esc(s.occupation) + '</span></div></div>'
    ).join('');

    showScreen('intro');
  }

  function onGameReconnect(data) {
    if (!data) return;
    gameState = {
      caseData: data.caseData,
      currentAct: data.currentAct,
      puzzleState: data.puzzleState || {},
      pinnedDocuments: data.pinnedDocuments || [],
      suspicionMarkers: data.suspicionMarkers || {},
      sharedNotes: data.sharedNotes || '',
      privateNotes: data.privateNotes || '',
      stars: data.stars || 5,
      startTime: data.startTime
    };
    showScreen('game');
    setupGameUI();
    startElapsedTimer();
  }

  function setupGameUI() {
    if (!gameState || !gameState.caseData) return;
    $('topbar-case-name').textContent = gameState.caseData.title;
    updateStats();
    renderDocuments();
    renderPuzzles();
    renderSuspects();
    $('shared-notes').value = gameState.sharedNotes;
    $('private-notes').value = gameState.privateNotes;
  }

  // ---- Documents ----
  function renderDocuments() {
    if (!gameState || !gameState.caseData) return;
    const list = $('document-list');
    let docs = [];

    gameState.caseData.acts.forEach((act, i) => {
      if (i + 1 <= gameState.currentAct && act.documents) {
        act.documents.forEach(d => docs.push({ ...d, actNum: i + 1 }));
      }
    });

    // Apply filter
    if (currentDocFilter === 'pinned') {
      docs = docs.filter(d => gameState.pinnedDocuments.includes(d.id));
    } else if (currentDocFilter !== 'all') {
      docs = docs.filter(d => d.actNum === parseInt(currentDocFilter));
    }

    if (!docs.length) {
      list.innerHTML = '<div class="empty-state"><p class="typewriter">No documents match this filter.</p></div>';
      return;
    }

    list.innerHTML = docs.map(d => {
      const pinned = gameState.pinnedDocuments.includes(d.id);
      return '<div class="doc-card ' + (pinned ? 'pinned' : '') + '" data-doc-id="' + d.id + '">' +
        '<div class="doc-card-clip"></div>' +
        '<div class="doc-card-inner">' +
        '<div class="doc-card-header">' +
        '<span class="doc-type-badge">' + esc(formatDocType(d.type)) + '</span>' +
        '<span class="doc-act-badge">Act ' + d.actNum + '</span>' +
        '</div>' +
        '<h4 class="doc-card-title">' + esc(d.title) + '</h4>' +
        '<p class="doc-card-preview">' + esc(d.content.substring(0, 120)) + '...</p>' +
        (pinned ? '<span class="pin-indicator">PINNED</span>' : '') +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.doc-card').forEach(card => {
      card.addEventListener('click', () => openDocument(card.dataset.docId));
    });
  }

  function openDocument(docId) {
    if (!gameState) return;
    let doc = null;
    gameState.caseData.acts.forEach(act => {
      if (act.documents) act.documents.forEach(d => { if (d.id === docId) doc = d; });
    });
    if (!doc) return;

    $('doc-viewer-type').textContent = formatDocType(doc.type);
    $('doc-viewer-title').textContent = doc.title;
    $('doc-viewer-meta').textContent = (doc.author ? 'By ' + doc.author : '') + (doc.date ? ' -- ' + doc.date : '');
    $('doc-viewer-body').innerHTML = esc(doc.content).replace(/\n/g, '<br>');
    $('btn-pin-doc').dataset.docId = docId;
    $('btn-pin-doc').textContent = gameState.pinnedDocuments.includes(docId) ? 'Unpin' : 'Pin to Board';
    $('doc-viewer').classList.remove('hidden');
  }

  function closeDocViewer() { $('doc-viewer').classList.add('hidden'); }

  function onDocumentPinned(data) {
    if (!gameState) return;
    if (data.pinned) {
      if (!gameState.pinnedDocuments.includes(data.docId)) gameState.pinnedDocuments.push(data.docId);
    } else {
      gameState.pinnedDocuments = gameState.pinnedDocuments.filter(id => id !== data.docId);
    }
    renderDocuments();
    if (!$('doc-viewer').classList.contains('hidden')) {
      $('btn-pin-doc').textContent = data.pinned ? 'Unpin' : 'Pin to Board';
    }
  }

  function formatDocType(type) {
    const types = {
      witness_statement: 'Witness Statement', forensic_report: 'Forensic Report',
      letter: 'Letter', newspaper_clipping: 'Newspaper Clipping',
      photograph: 'Photograph', map: 'Map', diary_entry: 'Diary Entry',
      financial_record: 'Financial Record', phone_record: 'Phone Record'
    };
    return types[type] || 'Document';
  }

  // ---- Puzzles ----
  function renderPuzzles() {
    if (!gameState || !gameState.caseData) return;
    const list = $('puzzle-list');
    let puzzles = [];

    gameState.caseData.acts.forEach((act, i) => {
      if (i + 1 <= gameState.currentAct && act.puzzles) {
        puzzles.push({ actTitle: 'Act ' + (i + 1) + ': ' + act.title, items: act.puzzles, actNum: i + 1 });
      }
    });

    if (!puzzles.length) {
      list.innerHTML = '<div class="empty-state"><p class="typewriter">No puzzles available yet.</p></div>';
      return;
    }

    list.innerHTML = puzzles.map(group =>
      '<h3 class="puzzle-group-title">' + esc(group.actTitle) + '</h3>' +
      group.items.map(p => {
        const state = gameState.puzzleState[p.id] || {};
        const solved = state.solved;
        return '<div class="puzzle-card ' + (solved ? 'solved' : '') + '" data-puzzle-id="' + p.id + '" data-act="' + group.actNum + '">' +
          '<div class="puzzle-card-inner">' +
          '<div class="puzzle-card-header">' +
          '<span class="puzzle-type-badge">' + esc(formatPuzzleType(p.type)) + '</span>' +
          (solved ? '<span class="puzzle-solved-badge">SOLVED</span>' : '<span class="puzzle-difficulty">' + (p.difficulty || 'medium').toUpperCase() + '</span>') +
          '</div>' +
          '<h4 class="puzzle-card-title">' + esc(p.title) + '</h4>' +
          '<p class="puzzle-card-desc">' + esc(p.description.substring(0, 100)) + (p.description.length > 100 ? '...' : '') + '</p>' +
          (solved && state.solvedBy ? '<span class="puzzle-solved-by">Solved by ' + esc(state.solvedBy) + '</span>' : '') +
          '</div></div>';
      }).join('')
    ).join('');

    list.querySelectorAll('.puzzle-card:not(.solved)').forEach(card => {
      card.addEventListener('click', () => openPuzzle(card.dataset.puzzleId, parseInt(card.dataset.act)));
    });

    updateStats();
  }

  function openPuzzle(puzzleId, actNum) {
    if (!gameState) return;
    let puzzle = null;
    gameState.caseData.acts.forEach(act => {
      if (act.puzzles) act.puzzles.forEach(p => { if (p.id === puzzleId) puzzle = p; });
    });
    if (!puzzle) return;
    openPuzzleId = puzzleId;

    $('puzzle-viewer-type').textContent = formatPuzzleType(puzzle.type);
    $('puzzle-viewer-title').textContent = puzzle.title;
    $('puzzle-viewer-desc').innerHTML = esc(puzzle.description).replace(/\n/g, '<br>');

    // Render puzzle-specific data
    const dataEl = $('puzzle-viewer-data');
    if (puzzle.puzzleData) {
      if (puzzle.type === 'cipher' && puzzle.puzzleData.cipherText) {
        dataEl.innerHTML = '<div class="cipher-box"><span class="cipher-label">ENCODED MESSAGE:</span><div class="cipher-text">' + esc(puzzle.puzzleData.cipherText) + '</div></div>';
      } else if (puzzle.puzzleData.question) {
        dataEl.innerHTML = '<div class="puzzle-question">' + esc(puzzle.puzzleData.question) + '</div>';
      } else {
        dataEl.innerHTML = '';
      }
    } else {
      dataEl.innerHTML = '';
    }

    // Show hints that have been revealed
    const state = gameState.puzzleState[puzzleId] || {};
    renderPuzzleHints(puzzleId);

    $('puzzle-answer-input').value = '';
    $('puzzle-feedback').innerHTML = '';
    $('btn-submit-answer').disabled = false;
    $('puzzle-answer-area').classList.remove('hidden');
    $('btn-request-hint').classList.remove('hidden');
    $('puzzle-viewer').classList.remove('hidden');
  }

  function closePuzzleViewer() {
    $('puzzle-viewer').classList.add('hidden');
    openPuzzleId = null;
  }

  function submitAnswer() {
    if (!openPuzzleId) return;
    const answer = $('puzzle-answer-input').value.trim();
    if (!answer) return toast('Enter an answer', 'red');
    socket.emit('submit-answer', { puzzleId: openPuzzleId, answer });
  }

  function requestHint() {
    if (!openPuzzleId) return;
    socket.emit('request-hint', { puzzleId: openPuzzleId });
  }

  function onPuzzleResult(data) {
    if (!gameState) return;
    if (gameState.puzzleState[data.puzzleId]) {
      gameState.puzzleState[data.puzzleId].attempts = data.attempts;
    }
    if (data.puzzleId === openPuzzleId) {
      $('puzzle-feedback').innerHTML = '<div class="feedback-wrong">' + esc(data.message || 'Incorrect. Try again.') + ' (Attempt ' + data.attempts + ')</div>';
    }
    renderPuzzleHints(data.puzzleId);
  }

  function onPuzzleSolved(data) {
    if (!gameState) return;
    if (gameState.puzzleState[data.puzzleId]) {
      gameState.puzzleState[data.puzzleId].solved = true;
      gameState.puzzleState[data.puzzleId].solvedBy = data.solvedBy;
    }

    // Add unlocked document if any
    if (data.unlockedDoc) {
      gameState.caseData.acts.forEach(act => {
        if (act.documents && !act.documents.find(d => d.id === data.unlockedDoc.id)) {
          act.documents.push(data.unlockedDoc);
        }
      });
    }

    const solverName = data.solvedByName || data.solvedBy || 'someone';

    if (data.puzzleId === openPuzzleId) {
      $('puzzle-feedback').innerHTML = '<div class="feedback-correct"><strong>CORRECT!</strong> ' + esc(data.revealText || '') + '</div>';
      $('puzzle-answer-area').classList.add('hidden');
      $('btn-request-hint').classList.add('hidden');
    }

    renderPuzzles();
    renderDocuments();
    toast('Puzzle solved by ' + solverName + '!', 'teal');
    addSystemChat('PUZZLE SOLVED: "' + (data.puzzleTitle || data.puzzleId) + '" solved by ' + solverName);
  }

  function onHintRevealed(data) {
    if (!gameState) return;
    if (gameState.puzzleState[data.puzzleId]) {
      gameState.puzzleState[data.puzzleId].hintsUsed = data.hintIndex + 1;
    }
    gameState.stars = Math.max(1, (gameState.stars || 5) - 1);
    updateStats();
    renderPuzzleHints(data.puzzleId);
    if (data.puzzleId === openPuzzleId) {
      toast('Hint revealed', 'gold');
    }
  }

  function renderPuzzleHints(puzzleId) {
    if (!gameState) return;
    const state = gameState.puzzleState[puzzleId] || {};
    let puzzle = null;
    gameState.caseData.acts.forEach(act => {
      if (act.puzzles) act.puzzles.forEach(p => { if (p.id === puzzleId) puzzle = p; });
    });
    if (!puzzle || puzzleId !== openPuzzleId) return;

    const hintsEl = $('puzzle-hints');
    const hintsUsed = state.hintsUsed || 0;
    if (!puzzle.hints || !puzzle.hints.length || hintsUsed === 0) {
      hintsEl.innerHTML = '';
      return;
    }
    hintsEl.innerHTML = puzzle.hints.slice(0, hintsUsed).map((h, i) =>
      '<div class="hint-card"><span class="hint-label">HINT ' + (i + 1) + ':</span> ' + esc(h) + '</div>'
    ).join('');
  }

  function formatPuzzleType(type) {
    const types = {
      cipher: 'Cipher', contradiction: 'Contradiction',
      cross_reference: 'Cross-Reference', timeline: 'Timeline',
      word_search: 'Hidden Message', map_analysis: 'Map Analysis',
      logic_grid: 'Logic Puzzle'
    };
    return types[type] || 'Puzzle';
  }

  // ---- Suspects ----
  function renderSuspects() {
    if (!gameState || !gameState.caseData || !gameState.caseData.suspects) return;
    const list = $('suspect-list');
    list.innerHTML = gameState.caseData.suspects.map(s => {
      const markers = gameState.suspicionMarkers || {};
      const myMarker = markers[socket.id] && markers[socket.id][s.id];
      return '<div class="suspect-card">' +
        '<div class="suspect-card-inner">' +
        '<div class="suspect-header">' +
        '<span class="suspect-name">' + esc(s.name) + '</span>' +
        '<span class="suspect-occupation">' + esc(s.occupation) + '</span>' +
        '</div>' +
        '<div class="suspect-details">' +
        '<div class="suspect-field"><span class="suspect-label">RELATIONSHIP:</span> ' + esc(s.relationship) + '</div>' +
        '<div class="suspect-field"><span class="suspect-label">ALIBI:</span> ' + esc(s.alibi) + '</div>' +
        '</div>' +
        '<div class="suspicion-flags">' +
        '<button class="flag-btn ' + (myMarker === 'green' ? 'active' : '') + '" data-suspect="' + s.id + '" data-marker="green" title="Cleared">Clear</button>' +
        '<button class="flag-btn flag-yellow ' + (myMarker === 'yellow' ? 'active' : '') + '" data-suspect="' + s.id + '" data-marker="yellow" title="Suspicious">Maybe</button>' +
        '<button class="flag-btn flag-red ' + (myMarker === 'red' ? 'active' : '') + '" data-suspect="' + s.id + '" data-marker="red" title="Prime Suspect">Suspect</button>' +
        '</div>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.flag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        socket.emit('update-suspicion', { suspectId: btn.dataset.suspect, marker: btn.dataset.marker });
      });
    });
  }

  function onSuspicionUpdated(data) {
    if (!gameState) return;
    if (!gameState.suspicionMarkers) gameState.suspicionMarkers = {};
    if (!gameState.suspicionMarkers[data.playerId]) gameState.suspicionMarkers[data.playerId] = {};
    gameState.suspicionMarkers[data.playerId][data.suspectId] = data.marker;
    renderSuspects();
  }

  // ---- Notes ----
  function onSharedNotesUpdated(data) {
    if (!gameState) return;
    gameState.sharedNotes = data.content;
    if (document.activeElement !== $('shared-notes')) {
      $('shared-notes').value = data.content;
    }
  }

  // ---- Acts ----
  function onActCompleted(data) {
    if (!gameState) return;
    $('act-transition-title').textContent = 'Act ' + data.actNumber + ' Complete';
    $('act-transition-text').textContent = 'New evidence has been uncovered. Continue your investigation.';

    if (data.allActsComplete) {
      $('btn-next-act').textContent = 'Make Your Accusation';
      $('btn-next-act').onclick = () => {
        $('screen-act-transition').classList.add('hidden');
        showAccusation();
      };
    } else {
      const next = data.nextAct || data.actNumber + 1;
      $('btn-next-act').textContent = 'Continue to Act ' + next;
      $('btn-next-act').onclick = () => {
        $('screen-act-transition').classList.add('hidden');
        socket.emit('proceed-to-act', { actNumber: next });
      };
    }
    $('screen-act-transition').classList.remove('hidden');
    toast('Act ' + data.actNumber + ' complete!', 'gold');
  }

  function onActStarted(data) {
    if (!gameState) return;
    gameState.currentAct = data.actNumber;

    // Add new documents and puzzles to case data
    if (data.documents) {
      const act = gameState.caseData.acts[data.actNumber - 1];
      if (act) act.documents = data.documents;
    }
    if (data.puzzles) {
      const act = gameState.caseData.acts[data.actNumber - 1];
      if (act) {
        act.puzzles = data.puzzles;
        data.puzzles.forEach(p => {
          if (!gameState.puzzleState[p.id]) {
            gameState.puzzleState[p.id] = { attempts: 0, hintsUsed: 0, solved: false, solvedBy: null };
          }
        });
      }
    }

    renderDocuments();
    renderPuzzles();
    updateStats();
    switchTab('documents');
    toast('Act ' + data.actNumber + ' -- New evidence available!', 'gold');
    addSystemChat('--- ACT ' + data.actNumber + ' UNLOCKED ---');
  }

  // ---- Accusation ----
  function showAccusation() {
    if (!gameState || !gameState.caseData) return;
    const suspectSelect = $('accuse-suspect');
    suspectSelect.innerHTML = '<option value="">Select suspect...</option>' +
      gameState.caseData.suspects.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('');

    const motives = ['Inheritance', 'Revenge', 'Blackmail', 'Jealousy', 'Cover-up', 'Financial gain', 'Self-defense', 'Betrayal'];
    const motiveSelect = $('accuse-motive');
    motiveSelect.innerHTML = '<option value="">Select motive...</option>' +
      motives.map(m => '<option value="' + m.toLowerCase() + '">' + m + '</option>').join('');

    showScreen('accusation');
  }

  function submitAccusation() {
    const suspectId = $('accuse-suspect').value;
    const motive = $('accuse-motive').value;
    if (!suspectId || !motive) return toast('Select both a suspect and a motive', 'red');
    socket.emit('submit-accusation', { suspectId, motive });
  }

  function onAccusationResult(data) {
    // Handled by game-over event
  }

  // ---- Game Over ----
  function onGameOver(data) {
    clearInterval(elapsedInterval);
    const stamp = $('gameover-stamp');
    const title = $('gameover-title');

    if (data.correctSuspect) {
      stamp.textContent = 'CASE CLOSED';
      stamp.className = 'gameover-stamp solved';
      title.textContent = 'Case Solved!';
      title.style.color = 'var(--teal)';
      spawnConfetti();
    } else {
      stamp.textContent = 'CASE CLOSED';
      stamp.className = 'gameover-stamp unsolved';
      title.textContent = 'Close, But Not Quite';
      title.style.color = 'var(--crimson)';
    }

    $('gameover-subtitle').textContent = data.explanation || '';

    // Stars
    const stars = data.stars || 3;
    $('gameover-stars').innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('span');
      star.className = 'star ' + (i < stars ? 'active' : '');
      star.textContent = '*';
      $('gameover-stars').appendChild(star);
    }

    // Find suspect name from ID
    let killerName = data.actualCulpritId || '';
    if (gameState && gameState.caseData && gameState.caseData.suspects) {
      const s = gameState.caseData.suspects.find(s => s.id === data.actualCulpritId);
      if (s) killerName = s.name;
    }

    // Solution
    $('gameover-solution').innerHTML =
      '<h3 class="solution-title">The Truth</h3>' +
      '<p><strong>The Killer:</strong> ' + esc(killerName) + '</p>' +
      '<p><strong>The Motive:</strong> ' + esc(data.actualMotive || '') + '</p>';

    // Stats
    const elapsed = data.elapsed ? Math.floor(data.elapsed / 60000) : 0;
    $('gameover-stats').innerHTML =
      '<div class="stat-row"><span>Time:</span><span>' + elapsed + ' minutes</span></div>' +
      '<div class="stat-row"><span>Hints Used:</span><span>' + (data.hintsUsed || 0) + '</span></div>' +
      '<div class="stat-row"><span>Wrong Answers:</span><span>' + (data.wrongAttempts || 0) + '</span></div>';

    showScreen('gameover');
  }

  // ---- Chat ----
  function onChatMessage(data) {
    const msgs = $('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const time = new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = '<span class="chat-name">' + esc(data.name) + ':</span> ' + esc(data.message) + ' <span class="chat-time">' + time + '</span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;

    const chatTab = document.querySelector('[data-tab="chat"]');
    if (!chatTab.classList.contains('active')) {
      unreadChat++;
      $('chat-badge').textContent = unreadChat;
      $('chat-badge').classList.remove('hidden');
    }
  }

  function addSystemChat(text) {
    const msgs = $('chat-messages');
    const el = document.createElement('div');
    el.className = 'system-msg';
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendChat() {
    const input = $('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit('chat', { message: msg });
    input.value = '';
  }

  // ---- Stats ----
  function updateStats() {
    if (!gameState) return;
    $('stat-act').textContent = gameState.currentAct + '/3';
    $('stat-stars').textContent = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star-sm ' + (i < (gameState.stars || 5) ? 'active' : '');
      s.textContent = '*';
      $('stat-stars').appendChild(s);
    }

    // Progress: puzzles solved in current act
    let total = 0, solved = 0;
    if (gameState.caseData && gameState.caseData.acts) {
      const act = gameState.caseData.acts[gameState.currentAct - 1];
      if (act && act.puzzles) {
        total = act.puzzles.length;
        act.puzzles.forEach(p => { if (gameState.puzzleState[p.id] && gameState.puzzleState[p.id].solved) solved++; });
      }
    }
    $('stat-progress').textContent = solved + '/' + total;
  }

  // ---- Tabs ----
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'chat') { unreadChat = 0; $('chat-badge').classList.add('hidden'); }
  }

  // ---- Timer ----
  function startElapsedTimer() {
    clearInterval(elapsedInterval);
    const start = gameState ? gameState.startTime : Date.now();
    function update() {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      $('elapsed-timer').textContent = m + ':' + s.toString().padStart(2, '0');
    }
    update();
    elapsedInterval = setInterval(update, 1000);
  }

  // ---- Helpers ----
  function $(id) { return document.getElementById(id); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function toast(msg, color) {
    color = color || 'gold';
    const el = document.createElement('div');
    el.className = 'toast toast-' + color;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function spawnConfetti() {
    const c = document.createElement('div');
    c.className = 'confetti-container';
    const cols = ['#c0392b','#2980b9','#27ae60','#d4a040','#8e44ad','#16a085'];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 2 + 's';
      p.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      p.style.background = cols[Math.floor(Math.random() * cols.length)];
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = p.style.width;
      c.appendChild(p);
    }
    $('gameover-particles').appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }

  document.addEventListener('DOMContentLoaded', init);
  return { joinPublic };
})();
