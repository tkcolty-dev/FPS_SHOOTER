// 🧩 BlockBuddy — AI coach for Scratch coding.
// Uses the Cloud Foundry GenAI service (OpenAI-compatible) when deployed,
// falls back to ANTHROPIC_API_KEY locally.

const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 4965;

function getAI() {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      for (const list of Object.values(vcap)) {
        for (const svc of list || []) {
          const c = svc.credentials || {};
          const ep = (c.endpoint && c.endpoint.api_base) ? c.endpoint : c;
          if (ep.api_base && ep.api_key) return { provider: 'genai', apiBase: ep.api_base, apiKey: ep.api_key };
        }
      }
    } catch {}
  }
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY };
  return null;
}

let MODEL = process.env.MODEL || null;
async function pickModel(ai) {
  if (MODEL || ai.provider !== 'genai') return;
  try {
    const res = await fetch(`${ai.apiBase}/openai/v1/models`, { headers: { Authorization: `Bearer ${ai.apiKey}` } });
    const j = await res.json();
    const names = (j.data || []).map((m) => m.id);
    MODEL = names.find((n) => /claude/i.test(n)) || names.find((n) => /gpt-oss-120b/.test(n)) || names[0];
    console.log('  models available:', names.join(', ') || '(none)');
  } catch (e) {
    console.log('  model list failed:', e.message);
  }
  MODEL = MODEL || 'openai/gpt-oss-120b';
  console.log('  using model:', MODEL);
}

const SYSTEM = `You are BlockBuddy, a friendly and fun Scratch coding coach for kids. You help them build games and fix bugs in Scratch (scratch.mit.edu).

How to answer:
- Be short, cheerful, and clear. Simple words, no lectures. One idea at a time.
- When showing Scratch code, ALWAYS put it in a fenced code block with the language "scratch", written in scratchblocks notation. It gets rendered as real Scratch blocks, so the notation must be exact.
- Prefer showing blocks over describing them in words.
- For big builds, go step by step and offer to continue ("Want the next part?").
- If they paste broken logic, find the bug and show the fixed script.
- Only use blocks that really exist in Scratch 3. If something needs TurboWarp or extensions, say so.

scratchblocks notation reference:
\`\`\`scratch
when green flag clicked
set [score v] to (0)
show variable [score v]
forever
    move (10) steps
    if <touching [edge v]?> then
        turn cw (180) degrees
    end
end
\`\`\`
- Hat blocks: "when green flag clicked", "when [space v] key pressed", "when this sprite clicked", "when I receive [message1 v]", "when I start as a clone"
- Dropdowns end with " v" inside [ ]: [score v], [space v], [edge v]
- Number/text inputs in ( ): move (10) steps, say [Hello!] for (2) seconds — text literals use [ ] without v
- Booleans in < >: <touching [edge v]?>, <(score) > (10)>, <key [space v] pressed?>, <<a> and <b>>
- Reporters in ( ): (x position), (pick random (1) to (10)), (join [a] [b]), ((score) * (2))
- C-blocks (forever, repeat (10), if <> then, if <> then / else, repeat until <>) each close with "end"
- Custom blocks: "define jump (height)" and use "jump (10)"
- Cloud variables: [☁ high score v]

The kid you're helping also runs CloudLift, their own cloud-variable server that syncs with Scratch — if they ask about cloud variables, normal Scratch cloud blocks work with it.`;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  const ai = getAI();
  if (!ai) return res.status(500).json({ error: 'No AI configured — bind the blockbuddy-ai service or set ANTHROPIC_API_KEY.' });
  await pickModel(ai);

  const history = (req.body.messages || []).slice(-24).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content).slice(0, 8000),
  }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    if (ai.provider === 'genai') {
      const upstream = await fetch(`${ai.apiBase}/openai/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          max_tokens: 2000,
          messages: [{ role: 'system', content: SYSTEM }, ...history],
        }),
      });
      if (!upstream.ok) throw new Error(`AI error ${upstream.status}: ${(await upstream.text()).slice(0, 300)}`);
      const reader = upstream.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta;
            if (delta && delta.content) send({ text: delta.content });
          } catch {}
        }
      }
    } else {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2000, system: SYSTEM, messages: history }),
      });
      if (!upstream.ok) throw new Error(`AI error ${upstream.status}: ${(await upstream.text()).slice(0, 300)}`);
      const j = await upstream.json();
      send({ text: j.content.map((c) => c.text || '').join('') });
    }
    send({ done: true });
  } catch (e) {
    console.log('chat error:', e.message);
    send({ error: e.message });
  }
  res.end();
});

app.listen(PORT, () => {
  console.log('');
  console.log('  🧩 BlockBuddy is running!');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  const ai = getAI();
  console.log('  AI:', ai ? ai.provider : 'NOT CONFIGURED');
  if (ai) pickModel(ai);
});
