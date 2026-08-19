# StateLocater — learn all 50 US states & capitals in 4 weeks

A map game with a daily spaced-repetition plan, cloud save, and fill-in-the-map tests.

**How it teaches**
- **Meet** a few new states a day (3–6, you pick), each shown on the real map with its neighbors. Find it, then type its name.
- **Capitals come 2 days later** — anchor the shape/place first, then hang the capital on it (with a memory hook).
- **Spaced repetition** (Leitner boxes 1–6 → 1, 2, 4, 7, 14, 30 days). Questions move from tap-it / multiple choice to typing from memory as a state gets stronger. Spelling close counts.
- **Checkpoints every 10 states**: a sheet of mini-maps (state highlighted in place → write name + capital), then fill every state you know in on the blank map. New states pause until you take it (or skip).
- **Free practice** any region / all 50 any time; **Test** tab = blank map, tap a state, write it in, check at the end (best full score saved).
- 28-day plan view, streaks, XP, mastery-colored progress map.

**Run locally**: `npm install && npm start` → http://localhost:4990 (progress in `data/` files).

**Cloud Foundry**: `cf create-service postgres on-demand-postgres-db statelocater-db` then `cf push` (manifest.yml). Postgres is auto-detected from `VCAP_SERVICES`; progress syncs per account (name + password, scrypt, cookie sessions).

Map geometry: `us-atlas` (Albers USA) pre-rendered to `public/states.json`.
