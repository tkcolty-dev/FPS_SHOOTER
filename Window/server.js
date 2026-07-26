#!/usr/bin/env node
/**
 * AGENT TERMINAL — multi-project rooms where real CLI agents (Claude Code,
 * Codex, Haiku) chat with each other and build things together.
 *
 * Each project = projects/<id>/ with its own workspace/, chat history,
 * agent sessions, and a MEMORY.md the agents maintain themselves.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4600;
const ROOT = __dirname;
const PROJECTS_DIR = path.join(ROOT, 'projects');
const CODEX_BIN = '/Applications/ChatGPT.app/Contents/Resources/codex';
const MAX_AUTO_TURNS = 16;     // agent-to-agent turns allowed per user message
const TURN_TIMEOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------- migration
// v1 kept a single ./workspace + ./state.json — fold it into projects/drum-machine
if (!fs.existsSync(PROJECTS_DIR) && fs.existsSync(path.join(ROOT, 'workspace'))) {
  const dir = path.join(PROJECTS_DIR, 'drum-machine');
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(path.join(ROOT, 'workspace'), path.join(dir, 'workspace'));
  try {
    const old = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
    // sessions were tied to the old cwd — reset them; MEMORY.md carries context
    old.agents = (old.agents || []).map(a => ({ id: a.id, sessionId: null, briefed: false, seenUpTo: (old.messages || []).length }));
    fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(old));
    fs.unlinkSync(path.join(ROOT, 'state.json'));
  } catch {}
  const mem = `# Team Memory — drum-machine

- Claude (Fable 5) built PD·8, a retro pocket drum machine, in index.html (step sequencer: kick/snare/hat/clap, 112 BPM, Space to play, pattern A1). Screenshots: pd8-desktop.png, pd8-mobile.png.
- Codex (GPT-5) reviewed it and recommends per-track MUTE/SOLO as the single highest-value improvement. Not built yet.
- Haiku joined the team as a fast worker. Claude suggested Haiku could take localStorage pattern saving when the user green-lights more work.
- Convention: whoever claims a file first owns it; announce claims in chat before touching shared files.
`;
  fs.writeFileSync(path.join(dir, 'workspace', 'MEMORY.md'), mem);
}
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// ---------------------------------------------------------------- agents
class AgentRunner {
  constructor(room, opts) {
    this.room = room;
    Object.assign(this, opts); // id, name, color, model, modelFlag?
    this.sessionId = null;
    this.busy = false;
    this.seenUpTo = 0;
    this.briefed = false;
    this.proc = null;
    this.status = 'idle';
  }

  setStatus(status, detail = '') {
    this.status = status;
    this.room.broadcast('status', { agent: this.id, status, detail, model: this.model });
  }
  activity(text) {
    this.room.broadcast('activity', { agent: this.id, name: this.name, text, ts: Date.now() });
  }

  briefing() {
    const others = this.room.agents.filter(a => a !== this);
    const team = others.map(a => `- ${a.name} (model: ${a.model})`).join('\n');
    return `You are ${this.name} (model: ${this.model}), one agent in a live multi-agent team room called AGENT TERMINAL. Current project: "${this.room.id}".

Your teammates in this room:
${team}

RULES OF THE ROOM:
1. Everything you output as your reply is posted to the shared chat — the user AND the other agents read it. Talk to them directly.
2. You all share this working directory. Files you create/edit are instantly visible to teammates and previewable by the user at http://localhost:${PORT}/preview/${this.room.id}/ (index.html is served).
3. TEAM MEMORY: the file MEMORY.md in your working directory is the team's long-term memory. Read it FIRST when you start. Append important decisions, conventions, and status there (short bullets) so the team never forgets — even across restarts.
4. COORDINATE, don't duplicate: claim tasks explicitly ("I'll take physics + input, you take rendering + UI"), then DO the work with your real tools (write/edit files, run commands) before replying.
5. Keep chat replies SHORT — a few sentences: what you did, what's next, what you need from teammates. No huge code dumps in chat; code goes in files.
6. If a teammate already claimed something, build on their files instead of rewriting them. Read their files before editing shared ones.
7. When you have nothing left to do and are waiting, end your reply with the exact token [IDLE]. When the task is fully done and verified, say so and end with [IDLE].
8. Disagreements: settle fast, pick the simplest path, keep momentum.`;
  }

  unseen() {
    return this.room.messages.slice(this.seenUpTo).filter(m => m.from !== this.id);
  }

  buildPrompt() {
    const fresh = this.room.messages.slice(this.seenUpTo);
    this.seenUpTo = this.room.messages.length;
    const transcript = fresh
      .filter(m => m.from !== this.id)
      .map(m => `${m.from === 'user' ? 'USER' : m.name.toUpperCase()}: ${m.text}`)
      .join('\n\n');
    let prompt = '';
    if (!this.briefed) { prompt += this.briefing() + '\n\n'; this.briefed = true; }
    prompt += `--- NEW MESSAGES IN THE ROOM ---\n${transcript}\n--- END ---\n\nDo any real work needed (files/commands in the shared workspace), then post your short reply to the room.`;
    return prompt;
  }

  async runTurn() {
    this.busy = true;
    this.setStatus('thinking');
    const prompt = this.buildPrompt();
    try {
      const reply = await this.spawnTurn(prompt);
      const text = (reply || '').trim();
      if (text) this.room.post(this.id, this.name, text);
    } catch (err) {
      this.room.sys(`⚠ ${this.name} turn failed: ${String(err).slice(0, 300)}`);
    } finally {
      this.busy = false;
      this.setStatus('idle');
      this.proc = null;
      this.room.saveState();
      this.room.scheduleTurns();
    }
  }

  kill() {
    if (this.proc) { try { this.proc.kill('SIGTERM'); } catch {} }
  }

  spawnTurn(prompt) {
    return new Promise((resolve, reject) => {
      const { cmd, args } = this.command();
      const proc = spawn(cmd, args, { cwd: this.room.workspace, env: { ...process.env } });
      this.proc = proc;
      let errTail = '';
      let finalText = null;
      const texts = [];
      const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('turn timed out')); }, TURN_TIMEOUT_MS);

      let buf = '';
      proc.stdout.on('data', chunk => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
          if (!line || line[0] !== '{') continue;
          let ev; try { ev = JSON.parse(line); } catch { continue; }
          const t = this.handleEvent(ev, texts);
          if (t != null) finalText = t;
        }
      });
      proc.stderr.on('data', c => { errTail = (errTail + c).slice(-2000); });
      proc.on('error', e => { clearTimeout(timer); reject(e); });
      proc.on('close', code => {
        clearTimeout(timer);
        if (finalText == null && texts.length) finalText = texts.join('\n\n');
        if (finalText != null) resolve(finalText);
        else if (code !== 0) reject(new Error(`exit ${code}: ${errTail.slice(-300)}`));
        else resolve('');
      });
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }
}

class ClaudeAgent extends AgentRunner {
  command() {
    const args = ['-p', '--output-format', 'stream-json', '--verbose',
      '--dangerously-skip-permissions', '--max-turns', '60'];
    if (this.modelFlag) args.push('--model', this.modelFlag);
    if (this.sessionId) args.push('--resume', this.sessionId);
    return { cmd: 'claude', args };
  }
  handleEvent(ev, texts) {
    if (ev.type === 'system' && ev.subtype === 'init') {
      this.sessionId = ev.session_id;
      if (ev.model) this.model = ev.model;
      this.setStatus('thinking');
    } else if (ev.type === 'assistant' && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === 'tool_use') {
          this.setStatus('working');
          this.activity(describeClaudeTool(block));
        }
      }
    } else if (ev.type === 'result') {
      if (ev.session_id) this.sessionId = ev.session_id;
      return typeof ev.result === 'string' ? ev.result : '';
    }
    return null;
  }
}

function describeClaudeTool(block) {
  const i = block.input || {};
  const f = p => p ? path.basename(p) : '';
  switch (block.name) {
    case 'Write': return `✏️ writing ${f(i.file_path)}`;
    case 'Edit': return `✏️ editing ${f(i.file_path)}`;
    case 'Read': return `👁 reading ${f(i.file_path)}`;
    case 'Bash': return `$ ${String(i.command || '').slice(0, 80)}`;
    case 'Glob': case 'Grep': return `🔍 searching ${i.pattern || ''}`;
    default: return `⚙ ${block.name}`;
  }
}

class CodexAgent extends AgentRunner {
  command() {
    // NOTE: `codex exec resume` rejects --sandbox; sandbox must go through -c.
    const base = ['--json', '--skip-git-repo-check', '-c', 'sandbox_mode="workspace-write"', '-c', 'notify=[]'];
    const args = this.sessionId
      ? ['exec', 'resume', this.sessionId, ...base, '-']
      : ['exec', ...base, '-'];
    return { cmd: CODEX_BIN, args };
  }
  handleEvent(ev, texts) {
    if (ev.type === 'thread.started' && ev.thread_id) {
      this.sessionId = ev.thread_id;
      this.setStatus('thinking');
    } else if (ev.type === 'item.started' || ev.type === 'item.completed') {
      const item = ev.item || {};
      if (item.type === 'command_execution' && ev.type === 'item.started') {
        this.setStatus('working');
        this.activity(`$ ${String(item.command || '').slice(0, 80)}`);
      } else if (item.type === 'file_change' && ev.type === 'item.completed') {
        this.setStatus('working');
        const files = (item.changes || []).map(c => path.basename(c.path || '')).join(', ');
        this.activity(`✏️ changed ${files || 'files'}`);
      } else if (item.type === 'reasoning' && ev.type === 'item.completed') {
        this.setStatus('thinking');
      } else if (item.type === 'agent_message' && ev.type === 'item.completed' && item.text) {
        texts.push(item.text);
      }
    } else if (ev.type === 'turn.completed') {
      return texts.length ? texts.join('\n\n') : '';
    }
    return null;
  }
}

// ---- ROSTER: add/remove agents here. Any mix of Claude models + Codex works.
function makeAgents(room) {
  return [
    new ClaudeAgent(room, { id: 'claude', name: 'Claude', color: '#ff9668', model: 'claude (loading…)' }),
    new CodexAgent(room, { id: 'codex', name: 'Codex', color: '#58c4dc', model: 'gpt-5 · codex-cli 0.145' }),
    new ClaudeAgent(room, { id: 'haiku', name: 'Haiku', color: '#d2a8ff', model: 'claude-haiku-4-5', modelFlag: 'claude-haiku-4-5-20251001' }),
  ];
}

function saidIdle(t) { return /\[IDLE\]\s*$/i.test(t.trim()); }

// ---------------------------------------------------------------- rooms
class Room {
  constructor(id) {
    this.id = id;
    this.dir = path.join(PROJECTS_DIR, id);
    this.workspace = path.join(this.dir, 'workspace');
    this.stateFile = path.join(this.dir, 'state.json');
    fs.mkdirSync(this.workspace, { recursive: true });
    const memFile = path.join(this.workspace, 'MEMORY.md');
    if (!fs.existsSync(memFile)) {
      fs.writeFileSync(memFile, `# Team Memory — ${id}\n\n(Agents: keep short bullets here — decisions, conventions, status. Read on start.)\n`);
    }
    this.messages = [];
    this.clients = new Set();
    this.agents = makeAgents(this);
    this.autoTurns = 0;
    this.running = true;
    this.capNoticeShown = false;
    this.lastTree = '';
    this.saveTimer = null;
    this.loadState();
  }

  loadState() {
    try {
      const s = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      this.messages.push(...(s.messages || []));
      for (const sa of s.agents || []) {
        const a = this.agents.find(x => x.id === sa.id);
        if (a) {
          a.sessionId = sa.sessionId || null;
          a.briefed = !!sa.briefed;
          a.seenUpTo = Math.min(sa.seenUpTo || 0, this.messages.length);
        }
      }
    } catch {}
  }

  saveState() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const state = {
        messages: this.messages,
        agents: this.agents.map(a => ({ id: a.id, sessionId: a.sessionId, briefed: a.briefed, seenUpTo: a.seenUpTo })),
      };
      fs.writeFile(this.stateFile, JSON.stringify(state), () => {});
    }, 300);
  }

  broadcast(type, data) {
    const line = `data: ${JSON.stringify({ type, ...data })}\n\n`;
    for (const res of this.clients) res.write(line);
  }

  post(from, name, text) {
    const m = { n: this.messages.length, from, name, text, ts: Date.now() };
    this.messages.push(m);
    this.broadcast('msg', m);
    this.saveState();
    return m;
  }
  sys(text) { this.post('system', 'system', text); }

  scheduleTurns() {
    if (!this.running) return;
    for (const agent of this.agents) {
      if (agent.busy) continue;
      const unseen = agent.unseen();
      if (!unseen.length) continue;
      const fromUser = unseen.some(m => m.from === 'user');
      const substantive = unseen.some(m => m.from !== 'user' && m.from !== 'system' && !saidIdle(m.text));
      if (fromUser) {
        // user messages always wake agents
      } else if (!substantive) {
        agent.seenUpTo = this.messages.length;
        continue;
      } else if (this.autoTurns >= MAX_AUTO_TURNS) {
        if (!this.capNoticeShown) {
          this.capNoticeShown = true;
          this.sys(`⏸ auto-chat paused after ${MAX_AUTO_TURNS} agent turns — send a message to keep them going.`);
        }
        continue;
      } else {
        this.autoTurns++;
      }
      agent.runTurn(); // async, agents run in parallel
    }
  }

  listTree(dir = this.workspace, prefix = '', depth = 0) {
    if (depth > 4) return [];
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    const out = [];
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...this.listTree(path.join(dir, e.name), rel, depth + 1));
      else {
        let size = 0; try { size = fs.statSync(path.join(dir, e.name)).size; } catch {}
        out.push({ path: rel, size });
      }
    }
    return out;
  }

  hello() {
    return {
      type: 'hello',
      project: this.id,
      projects: listProjects(),
      messages: this.messages,
      agents: this.agents.map(a => ({ id: a.id, name: a.name, color: a.color, model: a.model, status: a.status })),
      files: this.listTree(),
      port: PORT,
    };
  }
}

const rooms = new Map();
function getRoom(id) {
  id = slug(id);
  if (!id) return null;
  if (!rooms.has(id)) rooms.set(id, new Room(id));
  return rooms.get(id);
}
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
}
function listProjects() {
  try {
    return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort();
  } catch { return []; }
}
function broadcastAll(type, data) {
  for (const room of rooms.values()) room.broadcast(type, data);
}

// boot existing projects; guarantee at least one
for (const id of listProjects()) getRoom(id);
if (!rooms.size) getRoom('playground');

// ---------------------------------------------------------------- file watcher
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.clients.size) continue;
    const tree = room.listTree();
    const key = JSON.stringify(tree);
    if (key !== room.lastTree) { room.lastTree = key; room.broadcast('files', { files: tree }); }
  }
}, 2000);

// ---------------------------------------------------------------- http server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.md': 'text/plain' };

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/') return serveFile(res, path.join(ROOT, 'public', 'index.html'));

  if (p === '/events') {
    const room = getRoom(url.searchParams.get('project') || listProjects()[0] || 'playground');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(room.hello())}\n\n`);
    room.clients.add(res);
    req.on('close', () => room.clients.delete(res));
    return;
  }

  if (p === '/send' && req.method === 'POST') {
    const { text, project } = await readBody(req);
    const room = getRoom(project);
    if (room && text && text.trim()) {
      room.running = true; room.autoTurns = 0; room.capNoticeShown = false;
      room.post('user', 'You', text.trim());
      room.scheduleTurns();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
    return;
  }

  if (p === '/stop' && req.method === 'POST') {
    const { project } = await readBody(req);
    const room = getRoom(project);
    if (room) {
      room.running = false;
      for (const a of room.agents) a.kill();
      room.sys('⏹ stopped — agents halted. Send a message to resume.');
    }
    res.writeHead(200); res.end('{"ok":true}');
    return;
  }

  if (p === '/projects' && req.method === 'POST') {
    const { name } = await readBody(req);
    const id = slug(name);
    if (!id) { res.writeHead(400); res.end('{"error":"bad name"}'); return; }
    getRoom(id);
    broadcastAll('projects', { projects: listProjects() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, id }));
    return;
  }

  // /preview/<project>/<path...>
  let m = p.match(/^\/preview\/([^/]+)\/?(.*)$/);
  if (m) {
    const room = rooms.get(m[1]);
    if (!room) { res.writeHead(404); res.end('no such project'); return; }
    const rel = decodeURIComponent(m[2]) || 'index.html';
    const file = path.normalize(path.join(room.workspace, rel));
    if (!file.startsWith(room.workspace)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return serveFile(res, path.join(file, 'index.html'));
    return serveFile(res, file);
  }

  // /file/<project>/<path...> raw viewer
  m = p.match(/^\/file\/([^/]+)\/(.*)$/);
  if (m) {
    const room = rooms.get(m[1]);
    if (!room) { res.writeHead(404); res.end('no such project'); return; }
    const file = path.normalize(path.join(room.workspace, decodeURIComponent(m[2])));
    if (!file.startsWith(room.workspace)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return fs.readFile(file, (e, d) => res.end(e ? 'not found' : d));
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`AGENT TERMINAL → http://localhost:${PORT}`);
  console.log(`projects: ${listProjects().join(', ')}`);
});
