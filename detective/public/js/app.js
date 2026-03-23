/* ============================================
   WHODUNIT CLIENT
   ============================================ */
const App = (() => {
  let socket = null;
  let sessionToken = localStorage.getItem('whodunit-session');
  let roomCode = null;
  let isHost = false;
  let myRole = null;
  let gameState = null;
  let roundTimer = null;
  let meetingTimer = null;
  let unreadChat = 0;
  let pendingShareClueId = null;

  const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e84393'];

  function init() {
    socket = io({ transports: ['polling', 'websocket'], upgrade: true });
    bindSocket();
    bindUI();

    const saved = localStorage.getItem('whodunit-name');
    if (saved) document.getElementById('player-name').value = saved;

    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) document.getElementById('room-code-input').value = params.get('room');
  }

  // ── Socket Events ──

  function bindSocket() {
    socket.on('connect', () => {
      if (sessionToken) socket.emit('register-session', { sessionToken, playerName: localStorage.getItem('whodunit-name') || '' });
    });

    // Room
    socket.on('room-created', d => { sessionToken = d.sessionToken; localStorage.setItem('whodunit-session', sessionToken); });
    socket.on('room-joined', d => {
      if (d.sessionToken) { sessionToken = d.sessionToken; localStorage.setItem('whodunit-session', sessionToken); }
      roomCode = d.code;
      isHost = d.isHost;
      document.getElementById('lobby-code').textContent = d.code;
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
    socket.on('room-left', () => { roomCode = null; showScreen('title'); });
    socket.on('public-rooms', renderPublicRooms);
    socket.on('error-msg', d => toast(d.message, 'red'));

    // Game
    socket.on('game-starting', d => {
      document.getElementById('lobby-status').textContent = d.message;
      document.getElementById('btn-start-game').style.display = 'none';
    });
    socket.on('game-started', onGameStarted);
    socket.on('game-reconnect', onGameReconnect);
    socket.on('round-started', onRoundStarted);
    socket.on('new-clues', onNewClues);
    socket.on('clue-shared', onClueShared);
    socket.on('meeting-called', onMeetingCalled);
    socket.on('meeting-ended', onMeetingEnded);
    socket.on('vote-started', onVoteStarted);
    socket.on('vote-update', onVoteUpdate);
    socket.on('vote-result', onVoteResult);
    socket.on('resume-investigation', onResumeInvestigation);
    socket.on('game-over', onGameOver);
    socket.on('game-log', d => { if (gameState) gameState.log = d.log; });
    socket.on('chat-message', onChatMessage);
    socket.on('player-disconnected', d => addSystemChat(`${d.name} disconnected`));
  }

  // ── UI Bindings ──

  function bindUI() {
    // Title
    $('btn-create-public').addEventListener('click', () => createRoom(true));
    $('btn-create-private').addEventListener('click', () => createRoom(false));
    $('btn-join-code').addEventListener('click', joinByCode);
    $('btn-browse').addEventListener('click', () => { socket.emit('browse-rooms'); showScreen('browse'); });
    $('btn-how-to-play').addEventListener('click', () => showScreen('howto'));
    $('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') joinByCode(); });
    $('player-name').addEventListener('keydown', e => { if (e.key === 'Enter') createRoom(true); });

    // How to play / Browse
    $('btn-howto-back').addEventListener('click', () => showScreen('title'));
    $('btn-browse-back').addEventListener('click', () => showScreen('title'));
    $('btn-refresh-rooms').addEventListener('click', () => socket.emit('browse-rooms'));

    // Lobby
    $('btn-start-game').addEventListener('click', () => socket.emit('start-game'));
    $('btn-leave-room').addEventListener('click', () => { socket.emit('leave-room'); clearSession(); });
    $('btn-copy-code').addEventListener('click', copyInvite);

    // Game tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Game actions
    $('btn-call-meeting').addEventListener('click', () => socket.emit('call-meeting'));
    $('btn-fabricate').addEventListener('click', () => showModal('fabricate'));
    $('btn-save-notes').addEventListener('click', () => {
      socket.emit('save-notes', { notes: $('notes-input').value });
      toast('Notes saved', 'teal');
    });

    // Chat
    $('btn-chat-send').addEventListener('click', sendChat);
    $('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

    // Modal actions
    document.querySelectorAll('.modal-cancel').forEach(b => b.addEventListener('click', closeModal));
    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));

    $('btn-vote-guilty').addEventListener('click', () => { socket.emit('cast-vote', { vote: 'guilty' }); disableVoteButtons(); });
    $('btn-vote-innocent').addEventListener('click', () => { socket.emit('cast-vote', { vote: 'innocent' }); disableVoteButtons(); });
    $('btn-submit-fake').addEventListener('click', submitFakeClue);
    $('btn-confirm-share').addEventListener('click', confirmShareClue);

    // Game over
    $('btn-play-again').addEventListener('click', () => { socket.emit('leave-room'); clearSession(); showScreen('title'); });
  }

  // ── Screens ──

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`screen-${name}`).classList.add('active');
  }

  // ── Room Logic ──

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
    navigator.clipboard.writeText(`${location.origin}?room=${roomCode}`).then(() => {
      const btn = $('btn-copy-code');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy Invite', 2000);
    });
  }

  function clearSession() {
    sessionToken = null;
    localStorage.removeItem('whodunit-session');
  }

  function renderPlayerList(players) {
    $('player-list').innerHTML = players.map((p, i) => `
      <div class="player-item">
        <div class="player-avatar" style="background:${colors[i % colors.length]}">${esc(p.name[0]).toUpperCase()}</div>
        <span class="player-name">${esc(p.name)}</span>
        ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
      </div>
    `).join('');
  }

  function updateLobbyStatus(count) {
    $('lobby-status').textContent = count < 3 ? `Waiting for detectives... (${count}/3 minimum)` : `${count} detectives ready`;
    $('btn-start-game').style.display = isHost && count >= 3 ? '' : 'none';
  }

  function renderPublicRooms(rooms) {
    const list = $('rooms-list');
    if (!rooms.length) { list.innerHTML = '<p class="empty-msg">No open cases. Create a new one.</p>'; return; }
    list.innerHTML = rooms.map(r => `
      <div class="room-item">
        <div><span class="room-host">${esc(r.host)}'s Case</span><br><span class="room-count">${r.count}/8 detectives</span></div>
        <button class="btn btn-gold btn-sm" onclick="App.joinPublic('${r.code}')">Join</button>
      </div>
    `).join('');
  }

  function joinPublic(code) {
    const name = getName();
    if (!name) { showScreen('title'); return toast('Enter your name first!', 'red'); }
    localStorage.setItem('whodunit-name', name);
    socket.emit('join-room', { code, name });
  }

  // ── Game Handlers ──

  function onGameStarted(data) {
    myRole = data.role;
    gameState = {
      players: {},
      clues: [],
      sharedClues: [],
      round: 0,
      maxRounds: data.maxRounds,
      guessesLeft: data.guessesLeft,
      caseName: data.caseName,
      log: [],
      notes: ''
    };
    data.playerOrder.forEach((p, i) => {
      gameState.players[p.id] = { ...p, colorIdx: i };
    });

    // Show intro screen
    $('intro-case-name').textContent = data.caseName;
    $('intro-case-text').textContent = data.caseIntro;
    const roleEl = $('intro-role');
    roleEl.textContent = data.role === 'murderer' ? 'THE MURDERER' : 'DETECTIVE';
    roleEl.className = `intro-role ${data.role}`;
    $('intro-role-desc').textContent = data.role === 'murderer'
      ? 'You committed the crime. Deflect suspicion, mislead the detectives, and survive the investigation. You can fabricate fake evidence to share.'
      : 'A crime has been committed. Gather clues, share findings with your team, and identify the killer. You have 3 guesses — use them wisely.';

    showScreen('intro');

    // Auto-transition to game
    setTimeout(() => {
      showScreen('game');
      setupGameUI();
    }, 7000);
  }

  function onGameReconnect(data) {
    if (!data) return;
    myRole = data.role;
    gameState = {
      players: {},
      clues: data.clues || [],
      sharedClues: data.sharedClues || [],
      round: data.round,
      maxRounds: data.maxRounds,
      guessesLeft: data.guessesLeft,
      caseName: data.caseName,
      log: data.log || [],
      notes: data.notes || ''
    };
    data.playerOrder.forEach((pid, i) => {
      gameState.players[pid] = { id: pid, name: data.players[pid].name, alive: data.players[pid].alive, colorIdx: i };
    });

    showScreen('game');
    setupGameUI();
    renderClues();
    renderShared();
    $('notes-input').value = gameState.notes;
  }

  function setupGameUI() {
    $('topbar-case-name').textContent = gameState.caseName;
    renderPlayersBar();
    updateStats();
    renderClues();
    renderShared();

    // Show/hide murderer fabricate button
    $('btn-fabricate').classList.toggle('hidden', myRole !== 'murderer');

    // Role display
    const roleEl = $('stat-role');
    roleEl.textContent = myRole === 'murderer' ? 'MURDERER' : 'DETECTIVE';
    roleEl.style.color = myRole === 'murderer' ? 'var(--crimson)' : 'var(--teal)';
  }

  function onRoundStarted(data) {
    if (gameState) {
      gameState.round = data.round;
      gameState.maxRounds = data.maxRounds;
      gameState.guessesLeft = data.guessesLeft;
    }
    updateStats();
    $('game-status').textContent = `Round ${data.round} — Investigating...`;
    $('btn-call-meeting').disabled = false;

    // Start round timer
    startTimer(data.duration);
    toast(`Round ${data.round} — New evidence available`, 'gold');
  }

  function onNewClues(data) {
    if (!gameState) return;
    gameState.clues = data.clues;
    renderClues();

    if (data.newCount > 0) {
      // Show badge on evidence tab
      const badge = $('evidence-badge');
      badge.textContent = data.newCount;
      badge.classList.remove('hidden');

      // Auto-switch to evidence tab if not already there
      const activeTab = document.querySelector('.tab.active');
      if (activeTab && activeTab.dataset.tab !== 'evidence') {
        // Just show badge, don't force switch
      }
    }
  }

  function onClueShared(data) {
    if (!gameState) return;
    gameState.sharedClues = data.allShared;
    renderShared();
    addSystemChat(`${data.sharedBy} shared evidence with the group`);
  }

  function onMeetingCalled(data) {
    closeModal();
    $('btn-call-meeting').disabled = true;
    $('game-status').textContent = 'Emergency Meeting!';
    clearInterval(roundTimer);

    $('meeting-text').innerHTML = `<strong>${esc(data.callerName)}</strong> called an emergency meeting. Discuss your findings and decide — should you accuse someone?`;

    // Render targets
    const targets = $('meeting-targets');
    const myId = socket.id;
    targets.innerHTML = Object.entries(gameState.players)
      .filter(([id, p]) => p.alive && id !== myId)
      .map(([id, p]) => `<button class="target-btn" data-id="${id}">${esc(p.name)}</button>`)
      .join('');

    targets.querySelectorAll('.target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        socket.emit('call-vote', { targetId: btn.dataset.id });
      });
    });

    // Meeting timer
    startMeetingTimer(data.duration);
    showModal('meeting');
    toast('Emergency meeting called!', 'red');
  }

  function onMeetingEnded(data) {
    closeModal();
    $('game-status').textContent = 'Investigating...';
    $('btn-call-meeting').disabled = false;
    clearInterval(meetingTimer);
  }

  function onVoteStarted(data) {
    closeModal();

    $('vote-text').innerHTML = `<strong>${esc(data.accuserName)}</strong> accuses <strong style="color:var(--crimson)">${esc(data.targetName)}</strong> of being the murderer!`;
    $('vote-guess-warning').textContent = `${data.guessesLeft} guess${data.guessesLeft !== 1 ? 'es' : ''} remaining. If wrong, this uses one.`;
    $('vote-status').textContent = 'Cast your vote...';

    $('btn-vote-guilty').disabled = false;
    $('btn-vote-innocent').disabled = false;

    showModal('vote');
  }

  function onVoteUpdate(data) {
    $('vote-status').textContent = `Votes: ${data.votesIn}/${data.votesNeeded}`;
  }

  function onVoteResult(data) {
    closeModal();
    const content = $('vote-result-content');

    if (!data.passed) {
      content.innerHTML = `
        <div class="vote-icon">&#9878;&#65039;</div>
        <h2 class="serif" style="color:var(--text-dim)">Vote Failed</h2>
        <p>Not enough votes to convict <strong>${esc(data.targetName)}</strong>.</p>
        <p class="dim" style="margin-top:0.5rem">Guilty: ${data.guilty} | Innocent: ${data.innocent}</p>
      `;
    } else if (data.correct) {
      content.innerHTML = `
        <div style="font-size:3rem">&#9878;&#65039;</div>
        <h2 class="serif" style="color:var(--teal)">CASE SOLVED!</h2>
        <p><strong style="color:var(--crimson)">${esc(data.targetName)}</strong> was the murderer!</p>
      `;
    } else {
      content.innerHTML = `
        <div style="font-size:3rem">&#10060;</div>
        <h2 class="serif" style="color:var(--crimson)">Wrong Accusation</h2>
        <p><strong>${esc(data.targetName)}</strong> was <span class="teal">innocent</span>.</p>
        <p style="margin-top:0.75rem;font-size:0.95rem"><strong>${data.guessesLeft}</strong> guess${data.guessesLeft !== 1 ? 'es' : ''} remaining.</p>
      `;
    }

    if (gameState) gameState.guessesLeft = data.guessesLeft;
    updateStats();
    showModal('vote-result');
  }

  function onResumeInvestigation(data) {
    closeModal();
    $('game-status').textContent = 'Investigating...';
    $('btn-call-meeting').disabled = false;
    startTimer(45000);
  }

  function onGameOver(data) {
    closeModal();
    clearInterval(roundTimer);
    clearInterval(meetingTimer);

    const stamp = $('gameover-stamp');
    const title = $('gameover-title');

    if (data.winner === 'detectives') {
      stamp.textContent = 'CASE CLOSED';
      stamp.className = 'gameover-stamp solved';
      title.textContent = 'Justice Prevails';
      title.style.color = 'var(--teal)';
      spawnConfetti();
    } else {
      stamp.textContent = 'COLD CASE';
      stamp.className = 'gameover-stamp unsolved';
      title.textContent = 'The Killer Escapes';
      title.style.color = 'var(--crimson)';
    }

    $('gameover-subtitle').textContent = data.reason;
    $('gameover-case').textContent = data.caseName || '';

    $('gameover-roles').innerHTML = Object.entries(data.roles).map(([id, p]) => `
      <div class="role-reveal">
        <span class="role-name">${esc(p.name)}</span>
        <span class="role-tag ${p.role}">${p.role === 'murderer' ? 'MURDERER' : 'DETECTIVE'}</span>
      </div>
    `).join('');

    showScreen('gameover');
  }

  // ── Chat ──

  function onChatMessage(data) {
    const msgs = $('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const time = new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `<span class="chat-name">${esc(data.name)}:</span> ${esc(data.message)} <span class="chat-time">${time}</span>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;

    // Badge if not on chat tab
    const chatTab = document.querySelector('[data-tab="chat"]');
    if (!chatTab.classList.contains('active')) {
      unreadChat++;
      const badge = $('chat-badge');
      badge.textContent = unreadChat;
      badge.classList.remove('hidden');
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

  // ── Rendering ──

  function renderPlayersBar() {
    if (!gameState) return;
    const bar = $('players-bar');
    const myId = socket.id;
    bar.innerHTML = Object.entries(gameState.players).map(([id, p]) => `
      <div class="player-chip ${id === myId ? 'is-you' : ''}">
        <div class="chip-dot" style="background:${colors[p.colorIdx % colors.length]}"></div>
        <span>${esc(p.name)}${id === myId ? ' (you)' : ''}</span>
      </div>
    `).join('');
  }

  function renderClues() {
    if (!gameState) return;
    const list = $('clue-list');
    if (!gameState.clues.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128270;</div><p>No evidence collected yet.</p><p class="dim">New clues will arrive each round.</p></div>';
      return;
    }
    // Reverse so newest is on top
    list.innerHTML = [...gameState.clues].reverse().map(c => renderClueCard(c, true)).join('');

    // Bind share buttons
    list.querySelectorAll('.clue-share-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingShareClueId = btn.dataset.clueId;
        const clue = gameState.clues.find(c => c.id === pendingShareClueId);
        if (clue) {
          $('share-clue-preview').innerHTML = `<strong style="font-size:0.72rem;color:var(--ink-dim)">${esc(clue.title || clue.type)}</strong><br>${esc(clue.text)}`;
          showModal('share');
        }
      });
    });
  }

  function renderShared() {
    if (!gameState) return;
    const list = $('shared-list');
    if (!gameState.sharedClues.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><p>No evidence shared yet.</p><p class="dim">Players can share their clues here for everyone to see.</p></div>';
      return;
    }
    list.innerHTML = [...gameState.sharedClues].reverse().map(c => renderClueCard(c, false, c.sharedBy)).join('');
  }

  function renderClueCard(clue, showShareBtn, sharedBy) {
    return `
      <div class="clue-card ${sharedBy ? 'shared-clue' : ''}">
        <div class="clue-card-header">
          <span class="clue-type-badge">${esc(clue.title || clue.type || 'Evidence')}</span>
          <span class="clue-round-badge">Round ${clue.round || '?'}</span>
        </div>
        <div class="clue-text">${esc(clue.text)}</div>
        ${sharedBy ? `<div class="clue-shared-by">Shared by ${esc(sharedBy)}</div>` : ''}
        ${showShareBtn ? `<div class="clue-actions"><button class="clue-share-btn" data-clue-id="${clue.id}">Share with Group</button></div>` : ''}
      </div>
    `;
  }

  function updateStats() {
    if (!gameState) return;
    $('stat-round').textContent = `${gameState.round}/${gameState.maxRounds}`;

    const dots = $('stat-guesses');
    dots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = `guess-dot ${i < gameState.guessesLeft ? 'active' : ''}`;
      dots.appendChild(dot);
    }
  }

  // ── Tabs ──

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));

    if (name === 'evidence') $('evidence-badge').classList.add('hidden');
    if (name === 'chat') { unreadChat = 0; $('chat-badge').classList.add('hidden'); }
  }

  // ── Modals ──

  function showModal(name) {
    const overlay = $('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    $(`modal-${name}`).classList.remove('hidden');
  }

  function closeModal() {
    $('modal-overlay').classList.add('hidden');
    $('modal-overlay').querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }

  function disableVoteButtons() {
    $('btn-vote-guilty').disabled = true;
    $('btn-vote-innocent').disabled = true;
    $('vote-status').textContent = 'Vote cast — waiting for others...';
  }

  function submitFakeClue() {
    const text = $('fake-text').value.trim();
    const type = $('fake-type').value;
    if (!text) return toast('Write some fake evidence first', 'red');
    socket.emit('fake-clue', { text, clueType: type });
    $('fake-text').value = '';
    closeModal();
    toast('Fake evidence planted!', 'gold');
  }

  function confirmShareClue() {
    if (pendingShareClueId) {
      socket.emit('share-clue', { clueId: pendingShareClueId });
      pendingShareClueId = null;
    }
    closeModal();
  }

  // ── Timers ──

  function startTimer(ms) {
    clearInterval(roundTimer);
    let remaining = Math.floor(ms / 1000);
    const el = $('round-timer');
    el.textContent = formatTime(remaining);
    roundTimer = setInterval(() => {
      remaining--;
      el.textContent = remaining > 0 ? formatTime(remaining) : '';
      if (remaining <= 0) clearInterval(roundTimer);
    }, 1000);
  }

  function startMeetingTimer(ms) {
    clearInterval(meetingTimer);
    let remaining = Math.floor(ms / 1000);
    const fill = $('meeting-timer-fill');
    const text = $('meeting-timer-text');
    fill.style.width = '100%';
    text.textContent = formatTime(remaining);
    meetingTimer = setInterval(() => {
      remaining--;
      fill.style.width = (remaining / (ms / 1000) * 100) + '%';
      text.textContent = remaining > 0 ? formatTime(remaining) : 'Time!';
      if (remaining <= 0) clearInterval(meetingTimer);
    }, 1000);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  // ── Helpers ──

  function $(id) { return document.getElementById(id); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function toast(msg, color = 'gold') {
    const el = document.createElement('div');
    el.className = `toast toast-${color}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function spawnConfetti() {
    const c = document.createElement('div');
    c.className = 'confetti-container';
    const confettiColors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#ffc107','#e84393'];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 2 + 's';
      p.style.animationDuration = (2.5 + Math.random() * 2) + 's';
      p.style.background = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = p.style.width;
      c.appendChild(p);
    }
    $('gameover-particles').appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { joinPublic, showError: msg => toast(msg, 'red') };
})();
