const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database ---------------------------------------------------------
// Cloud Foundry binds Postgres via VCAP_SERVICES. We try the common keys:
// elephantsql, postgresql, p.postgres, aws-rds, credhub-passthrough...
function findPostgresUri() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;
  try {
    const services = JSON.parse(vcap);
    for (const key of Object.keys(services)) {
      for (const inst of services[key]) {
        const c = inst.credentials || {};
        if (c.uri && c.uri.startsWith('postgres')) return c.uri;
        if (c.url && c.url.startsWith('postgres')) return c.url;
        if (c.jdbcUrl && c.jdbcUrl.includes('postgres')) {
          // jdbc:postgresql://host:port/db?user=u&password=p
          const m = c.jdbcUrl.match(/postgresql:\/\/([^:]+):(\d+)\/([^?]+)/);
          if (m && c.username && c.password) {
            return `postgres://${encodeURIComponent(c.username)}:${encodeURIComponent(c.password)}@${m[1]}:${m[2]}/${m[3]}`;
          }
        }
      }
    }
  } catch (e) {
    console.error('VCAP_SERVICES parse error', e);
  }
  return null;
}

const dbUri = findPostgresUri();
let pool = null;
let useMemory = !dbUri;
const memoryStore = { sources: [], chats: [] };

if (dbUri) {
  // Default SSL off; many CF-bound internal Postgres instances don't speak TLS.
  // Opt in with DB_SSL=true if the bound DB requires it.
  const useSsl = (process.env.DB_SSL || '').toLowerCase() === 'true';
  pool = new Pool({
    connectionString: dbUri,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5
  });
}

async function initDb() {
  if (!pool) {
    console.log('No Postgres bound — using in-memory store');
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trusted_sources (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        label TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    // Seed default trusted sources if empty
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM trusted_sources');
    if (rows[0].c === 0) {
      const defaults = [
        ['wikipedia.org', 'Wikipedia', 'Crowd-sourced encyclopedia, cross-check primary sources'],
        ['britannica.com', 'Encyclopaedia Britannica', 'Edited reference works'],
        ['nature.com', 'Nature', 'Peer-reviewed science journal'],
        ['science.org', 'Science (AAAS)', 'Peer-reviewed science journal'],
        ['nasa.gov', 'NASA', 'US space agency'],
        ['nih.gov', 'NIH', 'US National Institutes of Health'],
        ['cdc.gov', 'CDC', 'US Centers for Disease Control'],
        ['who.int', 'World Health Organization', 'UN public-health body'],
        ['bbc.com', 'BBC News', 'British public broadcaster'],
        ['reuters.com', 'Reuters', 'Wire-service news'],
        ['apnews.com', 'Associated Press', 'Wire-service news'],
        ['nytimes.com', 'New York Times', 'US newspaper of record'],
        ['scholar.google.com', 'Google Scholar', 'Academic literature search'],
        ['arxiv.org', 'arXiv', 'Open-access scientific preprints'],
        ['jstor.org', 'JSTOR', 'Academic journal archive'],
        ['stanford.edu', 'Stanford University', 'University domain']
      ];
      for (const [d, l, n] of defaults) {
        await pool.query(
          'INSERT INTO trusted_sources(domain, label, notes) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [d, l, n]
        );
      }
    }
    console.log('Postgres ready');
  } catch (e) {
    console.error('DB init failed, falling back to memory store:', e.message);
    useMemory = true;
    pool = null;
  }
}

// ---------- Trusted-source store --------------------------------------------
async function listSources() {
  if (useMemory) return memoryStore.sources.slice().sort((a, b) => a.domain.localeCompare(b.domain));
  const { rows } = await pool.query('SELECT id, domain, label, notes FROM trusted_sources ORDER BY domain');
  return rows;
}
async function addSource(domain, label, notes) {
  domain = (domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
  if (!domain) throw new Error('domain required');
  if (useMemory) {
    if (memoryStore.sources.some(s => s.domain === domain)) return null;
    const row = { id: Date.now(), domain, label: label || domain, notes: notes || '' };
    memoryStore.sources.push(row);
    return row;
  }
  const { rows } = await pool.query(
    'INSERT INTO trusted_sources(domain, label, notes) VALUES($1,$2,$3) ON CONFLICT(domain) DO UPDATE SET label=EXCLUDED.label, notes=EXCLUDED.notes RETURNING id, domain, label, notes',
    [domain, label || domain, notes || '']
  );
  return rows[0];
}
async function removeSource(id) {
  if (useMemory) {
    const i = memoryStore.sources.findIndex(s => String(s.id) === String(id));
    if (i >= 0) memoryStore.sources.splice(i, 1);
    return;
  }
  await pool.query('DELETE FROM trusted_sources WHERE id=$1', [id]);
}

// Seed default sources for memory mode
if (useMemory) {
  const defaults = [
    ['wikipedia.org', 'Wikipedia'],
    ['britannica.com', 'Encyclopaedia Britannica'],
    ['nature.com', 'Nature'],
    ['science.org', 'Science (AAAS)'],
    ['nasa.gov', 'NASA'],
    ['nih.gov', 'NIH'],
    ['cdc.gov', 'CDC'],
    ['who.int', 'World Health Organization'],
    ['bbc.com', 'BBC News'],
    ['reuters.com', 'Reuters'],
    ['apnews.com', 'Associated Press'],
    ['nytimes.com', 'New York Times'],
    ['scholar.google.com', 'Google Scholar'],
    ['arxiv.org', 'arXiv'],
    ['jstor.org', 'JSTOR']
  ];
  defaults.forEach(([d, l], i) => memoryStore.sources.push({ id: i + 1, domain: d, label: l, notes: '' }));
}

// ---------- Search ----------------------------------------------------------
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36';

async function ddgSearch(query, opts = {}) {
  // DuckDuckGo HTML — no API key needed
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }, timeout: 12000 });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    $('.result').each((_, el) => {
      const title = $(el).find('.result__title').text().trim();
      let link = $(el).find('.result__a').attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();
      if (link.startsWith('//duckduckgo.com/l/?uddg=')) {
        try {
          const u = new URL('https:' + link);
          link = decodeURIComponent(u.searchParams.get('uddg') || '');
        } catch {}
      } else if (link.startsWith('/l/?uddg=')) {
        try {
          const u = new URL('https://duckduckgo.com' + link);
          link = decodeURIComponent(u.searchParams.get('uddg') || '');
        } catch {}
      }
      if (link && title) results.push({ title, url: link, snippet });
    });
    return results.slice(0, opts.limit || 10);
  } catch (e) {
    console.error('ddg failed', e.message);
    return [];
  }
}

async function wikiSearch(query, limit = 3) {
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }, timeout: 10000 });
    const j = await r.json();
    const out = [];
    for (const hit of (j.query && j.query.search) || []) {
      out.push({
        title: hit.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        snippet: cheerio.load('<div>' + hit.snippet + '</div>')('div').text()
      });
    }
    return out;
  } catch (e) {
    console.error('wiki failed', e.message);
    return [];
  }
}

async function fetchPageText(url, maxChars = 4000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 12000, redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return '';
    const html = await r.text();
    const $ = cheerio.load(html);
    $('script,style,noscript,svg,iframe,header,footer,nav,aside,form').remove();
    const main = $('main').text() || $('article').text() || $('body').text();
    return main.replace(/\s+/g, ' ').trim().slice(0, maxChars);
  } catch (e) {
    return '';
  }
}

function rankByTrust(results, trustedDomains) {
  const trust = new Set(trustedDomains.map(d => d.toLowerCase()));
  return results
    .map(r => {
      let host = '';
      try { host = new URL(r.url).hostname.toLowerCase().replace(/^www\./, ''); } catch {}
      let bonus = 0;
      for (const td of trust) {
        if (host === td || host.endsWith('.' + td)) { bonus = 1000; break; }
      }
      // Always lightly favor .edu/.gov even if not in trusted list
      if (!bonus && (host.endsWith('.edu') || host.endsWith('.gov'))) bonus = 50;
      return { ...r, host, trusted: bonus >= 1000, _score: bonus };
    })
    .sort((a, b) => b._score - a._score);
}

// ---------- LLM call --------------------------------------------------------
function findLlmCreds() {
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', key: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', key: process.env.OPENAI_API_KEY };
  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) {
    return { provider: 'openai-compatible', key: process.env.LLM_API_KEY, baseUrl: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL };
  }
  const vcap = process.env.VCAP_SERVICES;
  if (vcap) {
    try {
      const s = JSON.parse(vcap);
      for (const key of Object.keys(s)) {
        for (const inst of s[key]) {
          const c = inst.credentials || {};
          if (c.anthropic_api_key) return { provider: 'anthropic', key: c.anthropic_api_key };
          if (c.ANTHROPIC_API_KEY) return { provider: 'anthropic', key: c.ANTHROPIC_API_KEY };
          if (c.openai_api_key) return { provider: 'openai', key: c.openai_api_key };
          if (c.OPENAI_API_KEY) return { provider: 'openai', key: c.OPENAI_API_KEY };
          if (c.apiKey && /openai/i.test(inst.name || '')) return { provider: 'openai', key: c.apiKey };
          if (c.apiKey && /anthropic|claude/i.test(inst.name || '')) return { provider: 'anthropic', key: c.apiKey };
          if (c.api_base && c.api_key) return { provider: 'openai-compatible', key: c.api_key, baseUrl: c.api_base, model: c.model_name || c.model };
        }
      }
    } catch {}
  }
  return { provider: 'none' };
}

async function llmComplete(systemPrompt, messages) {
  const creds = findLlmCreds();
  if (creds.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error('anthropic: ' + JSON.stringify(j));
    return j.content.map(c => c.text).join('');
  }
  if (creds.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + creds.key },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error('openai: ' + JSON.stringify(j));
    return j.choices[0].message.content;
  }
  if (creds.provider === 'openai-compatible') {
    const url = creds.baseUrl.replace(/\/$/, '') + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + creds.key },
      body: JSON.stringify({
        model: creds.model || process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error('llm: ' + JSON.stringify(j));
    return j.choices[0].message.content;
  }
  throw new Error('No LLM credentials configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY env var, or bind a user-provided service: `cf cups scholar-llm -p \'{"anthropic_api_key":"sk-ant-..."}\'` then `cf bind-service scholar-search scholar-llm && cf restage scholar-search`.');
}

// ---------- Routes ----------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    storage: useMemory ? 'memory' : 'postgres',
    llm: findLlmCreds().provider
  });
});

app.get('/api/sources', async (req, res) => {
  try { res.json(await listSources()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/sources', async (req, res) => {
  try {
    const { domain, label, notes } = req.body || {};
    const row = await addSource(domain, label, notes);
    res.json(row);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/sources/:id', async (req, res) => {
  try { await removeSource(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], trustedOnly = false } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages required' });
    }
    const last = messages[messages.length - 1];
    const query = (last.content || '').toString().slice(0, 500);

    // 1. Search
    const [ddg, wiki] = await Promise.all([ddgSearch(query, { limit: 10 }), wikiSearch(query, 3)]);
    let all = [...wiki, ...ddg];
    // de-dupe by URL
    const seen = new Set();
    all = all.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; });

    const sources = await listSources();
    const trustedDomains = sources.map(s => s.domain);
    let ranked = rankByTrust(all, trustedDomains);
    if (trustedOnly) ranked = ranked.filter(r => r.trusted);
    const topK = ranked.slice(0, 6);

    // 2. Fetch snippets for top results
    await Promise.all(topK.map(async (r) => {
      if (!r.snippet || r.snippet.length < 200) {
        const body = await fetchPageText(r.url, 1800);
        if (body) r.snippet = body;
      }
    }));

    // 3. Build prompt
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `You are Scholar, a research assistant for students. Today is ${today}.

How to answer:
- ANSWER THE QUESTION DIRECTLY AND FULLY. Open with the answer itself — never with "Here are some sources" or "According to source [1]…".
- Write like a knowledgeable tutor explaining the topic in their own words. Use the sources to ground specific facts; rely on well-known background knowledge for context. Do NOT refuse just because the sources are thin — answer from general knowledge and flag what is unverified.
- Be substantive: a good answer is usually 3–8 short paragraphs or a structured explanation with subheadings. Define jargon. Give examples. Be neutral.

Citations (light touch, not citation-spam):
- Use ASCII square brackets like [1], [2]. Combine like [1, 3] when needed. Never use CJK brackets 【】.
- Cite ONLY for specific facts a reader might want to verify: dates, statistics, direct quotes, named studies, contested claims, recent events. Do NOT cite common knowledge or every sentence.
- A typical paragraph has 0–2 citations, not one after every clause.
- Prefer TRUSTED-tagged sources when they conflict with untrusted ones; call out the disagreement.
- If you state something the sources don't cover, just say so naturally (e.g. "more broadly, …") — no citation needed.
- Never invent URLs or citation numbers outside the provided list.

Close with a single line: \`Confidence: high|medium|low — <one phrase on what would strengthen this>\``;

    const sourceBlock = topK.map((r, i) => {
      const tag = r.trusted ? 'TRUSTED' : 'web';
      return `[${i + 1}] (${tag}) ${r.title}\nURL: ${r.url}\nExcerpt: ${(r.snippet || '').slice(0, 1500)}`;
    }).join('\n\n');

    const userPrompt = `Question: ${query}\n\nSOURCES:\n${sourceBlock || '(no search results)'}\n\nAnswer the question using the sources above. Cite with [n].`;

    const llmMessages = [
      ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userPrompt }
    ];

    const answer = await llmComplete(systemPrompt, llmMessages);

    res.json({
      answer,
      sources: topK.map((r, i) => ({ n: i + 1, title: r.title, url: r.url, host: r.host, trusted: r.trusted })),
      searchedCount: all.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => {
  app.listen(PORT, () => console.log('Scholar running on :' + PORT));
});
