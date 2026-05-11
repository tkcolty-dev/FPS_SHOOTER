# Scholar — research chatbot with cited sources

AI search engine for school research. Web search via DuckDuckGo + Wikipedia,
answers always cite numbered sources, prefers trusted domains you control.

## Local

```bash
npm install
npm start            # http://localhost:8080
```

Optional env vars:
- `ANTHROPIC_API_KEY` — use Claude (preferred). Set `LLM_MODEL` to override.
- `OPENAI_API_KEY` — use OpenAI.
- `DATABASE_URL` — Postgres for persisting trusted sources & chats.
- If none set, falls back to the free Pollinations text API + in-memory storage.

## Deploy to Cloud Foundry

```bash
# 1. point the CLI at the foundation (already done in this env)
cf api --skip-ssl-validation https://api.sys.tas-ndc.kuhn-labs.com

# 2. create a Postgres service from the marketplace
cf marketplace                                # see what's available
cf create-service postgresql small scholar-db # or whatever plan exists
                                              # (manifest expects the name `scholar-db`)

# 3. (optional) supply an LLM key as a user-provided service
cf cups scholar-llm -p '{"anthropic_api_key":"sk-ant-..."}'
# then add `- scholar-llm` under `services:` in manifest.yml

# 4. push
cf push
```

The app reads `VCAP_SERVICES` for Postgres and LLM creds and binds them
automatically. If no LLM key is bound it uses Pollinations (free, no key).

## How it works

1. User asks a question.
2. Backend hits DuckDuckGo HTML + Wikipedia in parallel.
3. Results are re-ranked: trusted domains first, then `.edu`/`.gov`, then rest.
4. Top ~6 pages get fetched and summarized into the LLM prompt.
5. LLM is told to cite every claim with `[n]` referring to the numbered list.
6. Frontend converts `[n]` into clickable pills and shows a sources card.

## Trusted sources

Manage from the sidebar. Add a domain like `nature.com` — answers will prefer
it and tag its citations as **trusted**. Toggle "Trusted sources only" to
filter out everything else.
