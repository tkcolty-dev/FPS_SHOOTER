# StateLocater — learn all 50 US states & capitals (1-week sprint or 2/4-week plan)

A map game with a daily spaced-repetition plan, cloud save, and fill-in-the-map tests.

**How it teaches**
- **Pick your plan**: 1-week sprint (6–10 states/day, compressed review intervals), 2 weeks, or 4 weeks. Review intervals scale to the plan.
- **Meet gently** — each new state: see it on the map → warm-up find (zoomed to its region, neighbors labeled, hint) → pick its name (multiple choice) → a few minutes later find it again + type it. Recognition first, spelling last; misses re-teach with a neighbor hint and require typing the answer.
- **Capitals come 2 days later** — anchor the shape/place first, then hang the capital on it (with a memory hook).
- **Spaced repetition** (Leitner boxes 1–6 → 1, 2, 4, 7, 14, 30 days). Questions move from tap-it / multiple choice to typing from memory as a state gets stronger. Spelling close counts.
- **Checkpoints every 10 states**: a sheet of mini-maps (state highlighted in place → write name + capital), then fill every state you know in on the blank map. New states pause until you take it (or skip).
- **Capitals mode**: choose when capitals arrive (same day / 1 / 2 / 4 days later). Every capital is pinned as a ★ on the map at the real city location; new capitals must be typed once to lock in; misses require typing the right answer before moving on; each has a short hook + a vivid "picture this" image. **Capitals drill** on the Map tab: match game (state ↔ capital, pairs light up on the map), capital → state, type-the-capitals, all 50.
- **Play tab** gathers every game in one place:
  - **⚔️ Multiplayer rooms** (WebSockets, 4-letter code, up to 8 players): **🗺️ Land grab** — one shared map on every device; tap an open state, pick its name (or capital) from 4 choices; correct = claimed in your color live on everyone's screen; map full → standings. Or **⚡ Round race** — same prompt for all, first correct tap wins.
  - **🃏 Flashcards** — capitals decks (state→capital, capital→state, mixed, all 50, tricky-only), flip cards with mnemonics + a mini-map, "Again" recycles misses.
  - **🧲 Drag the tiles** — pile of name tiles, drag each onto the map (states or capitals-onto-states), instant-feedback practice.
  - **🎯 Tricky ones** — auto-tracked most-missed states with focused practice + flashcards.
  - **⚡ Blitz** — 60-second solo speed run with combo multipliers and a saved best score.
  - **🎯 Free practice** any region / all 50; **🏛️ Capitals drill** (match game, capital→state, typed).
- **Test** tab = blank map with two answer styles: ⌨️ type them in (tap a state, write name+capital) or 🧲 drag the tiles (state names or capital names dragged onto the map); check at the end or as you go; best full score saved.
- **The science** card on the Plan tab explains the method (retrieval practice + spacing — the two "high-utility" techniques — plus keyword mnemonics and on-map spatial learning).
- 28-day plan view, streaks, XP, mastery-colored progress map.

**Run locally**: `npm install && npm start` → http://localhost:4990 (progress in `data/` files).

**Cloud Foundry**: `cf create-service postgres on-demand-postgres-db statelocater-db` then `cf push` (manifest.yml). Postgres is auto-detected from `VCAP_SERVICES`; progress syncs per account (name + password, scrypt, cookie sessions).

Map geometry: `us-atlas` (Albers USA) pre-rendered to `public/states.json`.
