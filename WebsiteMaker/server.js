const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

/* ═══════════════════════════════════════════
   GENAI CONFIG (from CF marketplace service)
   ═══════════════════════════════════════════ */
function getGenaiConfig() {
  // Try VCAP_SERVICES (CF bound service)
  try {
    const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const genai = (vcap.genai || [])[0];
    if (genai && genai.credentials) {
      const c = genai.credentials;
      // If credhub-ref wasn't resolved, fall back to env vars
      if (c.api_base && c.api_key) {
        return { apiBase: c.api_base, apiKey: c.api_key, model: c.model_name || 'openai/gpt-oss-120b' };
      }
    }
  } catch (e) {}
  // Fall back to explicit env vars
  const apiBase = process.env.GENAI_API_BASE;
  const apiKey = process.env.GENAI_API_KEY;
  const model = process.env.GENAI_MODEL || 'openai/gpt-oss-120b';
  if (apiBase && apiKey) return { apiBase, apiKey, model };
  // Fall back to Anthropic direct key
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return { anthropicKey };
  return null;
}

/* ═══════════════════════════════════════════
   ANTHROPIC ↔ OPENAI FORMAT TRANSLATION
   ═══════════════════════════════════════════ */
function anthropicToOpenAI(body, model) {
  const messages = [];

  // System prompt → system message
  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }

  // Translate messages
  for (const msg of (body.messages || [])) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        messages.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Could be text blocks or tool_result blocks
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            messages.push({ role: 'tool', tool_call_id: block.tool_use_id, content: String(block.content) });
          } else if (block.type === 'text') {
            messages.push({ role: 'user', content: block.text });
          }
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        messages.push({ role: 'assistant', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        const toolCalls = msg.content.filter(c => c.type === 'tool_use').map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) }
        }));
        const aMsg = { role: 'assistant' };
        if (textParts) aMsg.content = textParts;
        else aMsg.content = null;
        if (toolCalls.length) aMsg.tool_calls = toolCalls;
        messages.push(aMsg);
      }
    }
  }

  // Translate tools
  const tools = (body.tools || []).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema || { type: 'object', properties: {} }
    }
  }));

  const req = {
    model,
    messages,
    max_tokens: body.max_tokens || 4096
  };
  if (tools.length) req.tools = tools;
  return req;
}

function openAIToAnthropic(data) {
  const choice = (data.choices || [])[0];
  if (!choice) {
    return { content: [{ type: 'text', text: 'No response from model.' }], stop_reason: 'end_turn' };
  }

  const msg = choice.message || {};
  const content = [];

  if (msg.content) {
    content.push({ type: 'text', text: msg.content });
  }

  if (msg.tool_calls && msg.tool_calls.length) {
    for (const tc of msg.tool_calls) {
      let input = {};
      try { input = JSON.parse(tc.function.arguments); } catch (e) {}
      content.push({
        type: 'tool_use',
        id: tc.id || ('call_' + Math.random().toString(36).slice(2, 10)),
        name: tc.function.name,
        input
      });
    }
  }

  let stop_reason = 'end_turn';
  if (choice.finish_reason === 'tool_calls') stop_reason = 'tool_use';
  else if (choice.finish_reason === 'stop') stop_reason = 'end_turn';
  else if (msg.tool_calls && msg.tool_calls.length) stop_reason = 'tool_use';

  return { content, stop_reason };
}

/* ═══════════════════════════════════════════
   IN-MEMORY DATA STORE (ephemeral)
   ═══════════════════════════════════════════ */
// projectData: projectId → JSON string of project
const projectStore = new Map();
// siteVars: siteId → { varName: value }
const siteVarsStore = new Map();
// submissions: projectId → array of {name,email,message,ts}
const submissionsStore = new Map();

/* ═══════════════════════════════════════════
   API ROUTES
   ═══════════════════════════════════════════ */
app.get('/api/health', (req, res) => {
  const config = getGenaiConfig();
  res.json({ ok: true, aiConfigured: !!config, provider: config ? (config.anthropicKey ? 'anthropic' : 'genai') : null });
});

/* ── Cloud project save/load ── */
app.post('/api/data/save', (req, res) => {
  const { projectId, data } = req.body;
  if (!projectId || !data) return res.status(400).json({ ok: false, error: 'Missing projectId or data' });
  projectStore.set(projectId, JSON.stringify(data));
  res.json({ ok: true, savedAt: Date.now() });
});

app.get('/api/data/load', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });
  const raw = projectStore.get(id);
  if (!raw) return res.json({ ok: false, found: false });
  try {
    res.json({ ok: true, found: true, data: JSON.parse(raw) });
  } catch (e) {
    res.json({ ok: false, found: false, error: 'Corrupt data' });
  }
});

/* ── Runtime site variables (for published sites, shared across visitors) ── */
app.post('/api/data/vars', (req, res) => {
  const { siteId, vars } = req.body;
  if (!siteId || !vars) return res.status(400).json({ ok: false, error: 'Missing siteId or vars' });
  const existing = siteVarsStore.get(siteId) || {};
  Object.assign(existing, vars);
  siteVarsStore.set(siteId, existing);
  res.json({ ok: true });
});

app.get('/api/data/vars', (req, res) => {
  const siteId = req.query.siteId;
  if (!siteId) return res.status(400).json({ ok: false, error: 'Missing siteId' });
  res.json({ ok: true, vars: siteVarsStore.get(siteId) || {} });
});

/* ── Contact form submissions ── */
app.post('/api/data/submissions', (req, res) => {
  const { projectId, submission } = req.body;
  if (!projectId || !submission) return res.status(400).json({ ok: false, error: 'Missing projectId or submission' });
  const list = submissionsStore.get(projectId) || [];
  list.push({ ...submission, ts: Date.now() });
  submissionsStore.set(projectId, list);
  res.json({ ok: true, count: list.length });
});

app.get('/api/data/submissions', (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) return res.status(400).json({ ok: false, error: 'Missing projectId' });
  res.json({ ok: true, submissions: submissionsStore.get(projectId) || [] });
});

app.post('/api/chat', async (req, res) => {
  const config = getGenaiConfig();
  if (!config) {
    return res.status(503).json({
      type: 'error',
      error: { type: 'not_configured', message: 'Server AI not configured.' }
    });
  }

  try {
    let upstream, text;

    if (config.anthropicKey) {
      // Direct Anthropic API
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(req.body)
      });
      text = await upstream.text();
      res.status(upstream.status).type('application/json').send(text);
    } else {
      // GenAI (OpenAI-compatible) — translate request, proxy, translate response
      const openaiBody = anthropicToOpenAI(req.body, config.model);
      upstream = await fetch(config.apiBase + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify(openaiBody)
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error('GenAI error:', upstream.status, errText.slice(0, 500));
        return res.status(upstream.status).json({ type: 'error', error: { type: 'upstream_error', message: errText.slice(0, 200) } });
      }

      const openaiData = await upstream.json();
      const anthropicResp = openAIToAnthropic(openaiData);
      res.json(anthropicResp);
    }
  } catch (e) {
    console.error('Proxy error:', e.message);
    res.status(502).json({ type: 'error', error: { type: 'proxy_error', message: e.message } });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`WebForge listening on ${port}`));
