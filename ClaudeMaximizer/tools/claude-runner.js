// Runs Claude Code on a game from inside the app. One run per game at a time; progress is streamed back as
// simple events: start, text, tool, result, error, end. Uses the claude CLI in --print mode with stream-json.
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const runs = new Map();       // project id → { proc, session }
const sessions = new Map();   // project id → last session id (so "continue" keeps the conversation)
const SESSIONS_FILE = path.join(ROOT, 'data', 'claude-sessions.json');
try { Object.entries(JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'))).forEach(([k, v]) => sessions.set(k, v)); } catch {}
const saveSessions = () => { try { fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true }); fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions))); } catch {} };

const ALLOWED = ['Edit', 'Write', 'Read', 'Glob', 'Grep', 'MultiEdit', 'Bash(node tools/notes.js*)', 'Bash(node tools/*)', 'Bash(npm test*)', 'Bash(ls*)', 'Bash(cat*)', 'Bash(mkdir*)'];

function promptFor(pid, game, kind, text) {
  const head = `You are working inside Claude Maximizer on the game "${game.name || pid}" (projects/${pid}, ${game.mode === '3d' ? '3D' : '2D'}). Read CLAUDE.md and docs/ENGINE.md first if you have not in this session. Edit only projects/${pid}/ unless asked otherwise. The page hot-reloads on save, so keep scripts valid at every save. Keep tunable numbers in props.`;
  if (kind === 'notes') return `${head}\n\nColton left playtest notes. Run \`node tools/notes.js --project ${pid}\` to read them (pictures are at projects/${pid}/notes/<n>.png, Read one if the words aren't enough). Fix every open note in the scripts. After each fix run \`node tools/notes.js done <n> "one short sentence saying what changed" --project ${pid}\`. If a note is unclear, use \`reply\` with a question instead of guessing. Finish with a two-sentence summary for Colton.`;
  return `${head}\n\nColton says: ${text}\n\nDo it in the game's scripts. When done, give Colton a two-sentence summary of what changed and how to try it.`;
}

function start(pid, game, { kind, text, resume }, emit) {
  if (runs.has(pid)) return { error: 'Claude is already working on this game. Stop it first or wait.' };
  const prompt = promptFor(pid, game, kind, text);
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', ALLOWED.join(',')];
  if (resume && sessions.get(pid)) args.push('--resume', sessions.get(pid));
  const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; // allowed to run even if the server was started from inside Claude Code
  let proc;
  try { proc = spawn('claude', args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return { error: 'Could not start the claude command: ' + e.message }; }
  const run = { proc, started: Date.now(), kind, text, session: resume ? sessions.get(pid) : null, log: [] };
  runs.set(pid, run);
  const send = ev => { run.log.push(ev); if (run.log.length > 400) run.log.shift(); emit(ev); };
  send({ type: 'start', kind, text: kind === 'notes' ? 'Fixing the open notes' : text, resumed: !!(resume && sessions.get(pid)) });
  let buf = '', errBuf = '';
  proc.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(line); } });
  proc.stderr.on('data', d => { errBuf += d; if (errBuf.length > 4000) errBuf = errBuf.slice(-4000); });
  proc.on('error', e => { send({ type: 'error', text: e.code === 'ENOENT' ? 'The claude command is not installed on this computer, so this copy can only take notes. Run Claude Maximizer on a Mac with Claude Code to let Claude build here.' : 'claude could not run: ' + e.message }); });
  proc.on('close', code => { runs.delete(pid); if (code && code !== 0 && !run.gotResult) send({ type: 'error', text: `Claude stopped (exit ${code}). ${errBuf.trim().split('\n').slice(-3).join(' ')}`.trim() }); send({ type: 'end', code, ms: Date.now() - run.started }); });
  function handle(line) {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.session_id) { sessions.set(pid, m.session_id); run.session = m.session_id; saveSessions(); }
    if (m.type === 'assistant' && m.message && Array.isArray(m.message.content)) {
      for (const c of m.message.content) {
        if (c.type === 'text' && c.text && c.text.trim()) send({ type: 'text', text: c.text });
        else if (c.type === 'tool_use') send({ type: 'tool', name: c.name, detail: toolDetail(c.name, c.input || {}) });
      }
    } else if (m.type === 'result') { run.gotResult = true; send({ type: 'result', text: m.result || '', ok: m.subtype === 'success', ms: m.duration_ms, cost: m.total_cost_usd, turns: m.num_turns }); }
    else if (m.type === 'system' && m.subtype === 'init') send({ type: 'init', model: m.model });
  }
  return { ok: true };
}
function toolDetail(name, input) {
  const rel = f => String(f || '').replace(ROOT + '/', '');
  if (name === 'Edit' || name === 'MultiEdit' || name === 'Write') return rel(input.file_path);
  if (name === 'Read') return rel(input.file_path);
  if (name === 'Bash') return String(input.command || '').slice(0, 120);
  if (name === 'Glob' || name === 'Grep') return String(input.pattern || '');
  return '';
}
function stop(pid) { const r = runs.get(pid); if (!r) return false; try { r.proc.kill('SIGTERM'); } catch {} return true; }
function status(pid) { const r = runs.get(pid); return { running: !!r, since: r ? r.started : null, kind: r ? r.kind : null, session: sessions.get(pid) || null, log: r ? r.log : [] }; }
function forget(pid) { sessions.delete(pid); saveSessions(); }
module.exports = { start, stop, status, forget };
