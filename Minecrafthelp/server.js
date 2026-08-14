const express = require('express');
const fs = require('fs');
// Minimal .env loader (no dependency): put ANTHROPIC_API_KEY=... in ./.env.
// Falls back to the Calorie Counter's .env so the same local dev key is shared.
for (const envPath of [__dirname + '/.env', __dirname + '/../Calorie_Counter/server/.env']) {
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  if (process.env.ANTHROPIC_API_KEY) break;
}
// With no API key, chat falls back to the local Claude Code CLI (subscription login).
const { spawn } = require('child_process');
const os = require('os');
const CLAUDE_BIN = [os.homedir() + '/.local/bin/claude', 'claude'].find(p => {
  try { return p === 'claude' || fs.existsSync(p); } catch { return false; }
});
const USE_CLI = !process.env.ANTHROPIC_API_KEY;
if (USE_CLI) console.log('No ANTHROPIC_API_KEY — Ask AI will use the local Claude Code CLI (' + CLAUDE_BIN + ')');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = new Anthropic();

const SYSTEM = `You are "Minecraft Help", a friendly Minecraft expert built into a Minecraft guide app.
The user is a young player who mostly plays BEDROCK EDITION (phone/console/Windows), but sometimes Java.
Rules:
- Default to Bedrock edition behavior. If Java is different, add a short "Java:" note.
- Be accurate about current Minecraft (version 26.1+, the new year-based versions after 1.21). Give exact recipes, exact block placements, exact numbers.
- Keep answers short and clear. Use markdown: **bold** key items, bullet lists, numbered steps for builds.
- For crafting recipes, show the 3x3 grid as a small ascii layout, e.g.:
  [plank][plank]
  [plank][plank]  -> Crafting Table
- COMMANDS: when the player asks how to do something with commands or command blocks, give the EXACT
  Bedrock edition syntax. Put every command in a fenced code block, ONE command per line, ready to
  paste into Minecraft chat. Bedrock has NO NBT in commands (no curly braces) — never give Java NBT
  syntax unless they ask for Java. Use current /execute syntax (execute as @a at @s run ...).
  For command blocks, always say which type (impulse/chain/repeat), the condition setting
  (conditional or not), and redstone setting (needs redstone / always active), plus how to wire it.
- Stay on Minecraft topics. Be encouraging and fun, never use bad language.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const recent = messages.slice(-12); // keep the AI fast: only recent history
  if (USE_CLI) return chatViaCli(recent, send, res);
  try {
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: recent.map(m => ({ role: m.role, content: m.content })),
    });
    stream.on('text', (t) => send({ t }));
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      send({ t: "Sorry, I can't help with that one — ask me anything about Minecraft!" });
    }
    send({ done: true });
  } catch (err) {
    console.error('chat error:', err.message);
    send({ error: 'AI error: ' + err.message });
    send({ done: true });
  }
  res.end();
});

// Chat via the local Claude Code CLI: stream-json output, text deltas relayed as SSE.
function chatViaCli(messages, send, res) {
  const transcript = messages
    .map(m => (m.role === 'user' ? 'Player: ' : 'Minecraft Help: ') + m.content)
    .join('\n\n');
  const prompt = SYSTEM +
    '\n\nAnswer directly in this single reply from your own knowledge. Do not use any tools.' +
    '\n\n--- Conversation so far ---\n' + transcript +
    '\n\nReply to the Player\'s last message now.';
  const child = spawn(CLAUDE_BIN, [
    '-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    '--max-turns', '1', '--model', 'sonnet',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
  ], { cwd: os.tmpdir(), env: process.env });

  let sentText = false;
  let buf = '';
  const killer = setTimeout(() => child.kill(), 120000);
  res.on('close', () => child.kill()); // user hit Stop / closed the tab
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      if (obj.type === 'stream_event' && obj.event?.type === 'content_block_delta' && obj.event.delta?.type === 'text_delta') {
        sentText = true;
        send({ t: obj.event.delta.text });
      } else if (obj.type === 'result' && !sentText && typeof obj.result === 'string') {
        send({ t: obj.result });
      }
    }
  });
  child.on('close', (code) => {
    clearTimeout(killer);
    if (!sentText && code !== 0) send({ error: 'AI error (claude CLI exited with code ' + code + ')' });
    send({ done: true });
    res.end();
  });
  child.on('error', (err) => {
    clearTimeout(killer);
    send({ error: 'Could not start claude CLI: ' + err.message });
    send({ done: true });
    res.end();
  });
  child.stdin.write(prompt);
  child.stdin.end();
}

const PORT = 4950;
app.listen(PORT, () => console.log(`Minecraft Help running at http://localhost:${PORT}`));
