# BlockForge ⚡ Claude Bridge

The bridge works **like the Roblox Studio MCP**: you keep the editor open, tell Claude
what you want, and it builds it **live in your editor** — sprites, costumes and block
scripts appear in seconds. Claude also reads your live edits, so each request builds on
what you changed. You then refine everything by hand.

```
  ┌─ you run once ─────────────────────────────────────────┐
  │  node bridge/server.js   →   open http://localhost:4321 │
  └────────────────────────────────────────────────────────┘
   badge top-right turns ● live

  You: "add an enemy that chases the player and a score"
   │
   ▼  Claude runs a node script that POSTs commands to the bridge
   ▼  server pushes them over SSE to your open editor
   ▼  sprites + blocks appear LIVE                ◄── like Roblox Studio
   │
  You: drag blocks, tweak costumes, hit ▶ to play
   │
  You: "make the enemy faster"   ──►  Claude reads your live state, edits again
```

## Fastest path: write code, compile to blocks ⚙️

Don't hand-write Blockly JSON — it's slow and brittle. Instead write **BlockForge-Script**
(`.bfs`), a compact indentation-based language, and compile it straight into live blocks:

```bash
node bridge/compile.js projects/mygame.bfs      # compiles + pushes + runs
```

```text
@name Catch Game
@show score

stage backdrop=grass:

sprite Player costume=square color=#4C97FF x=0 y=-140:
  on flag:
    score = 0
    forever:
      if keyPressed("left arrow"):  changeX(-6)
      if keyPressed("right arrow"): changeX(6)

sprite Apple costume=ball color=#ff5470:
  on flag:
    forever:
      goto(random(-200,200), 170)
      until ypos() < -170:
        changeY(-5)
        if touching("Player"):
          score += 1
          sety(-200)
```

Language summary:
- **Hats** (per sprite): `on flag:` · `on key "space":` · `on clicked:` · `on receive "msg":`
- **Blocks** (indent the body): `forever:` · `repeat N:` · `until COND:` · `if COND:` / `else:`
- **Commands**: `move(n) turnRight(n) turnLeft(n) point(n) goto(x,y) glide(s,x,y) changeX(n) setx(n)
  changeY(n) sety(n) ifEdgeBounce() say(msg[,secs]) think(msg) costume("name") nextCostume()
  changeSize(n) setSize(n) setEffect("ghost",n) clearEffects() show() hide() goToFront()
  wait(n) stopAll() stopScript() broadcast("m") waitUntil(cond) resetTimer() ask("q")
  showVar(name) hideVar(name)`
- **Assignments** (variables): `name = expr` · `name += expr` · `name -= expr`
- **Reporters** (in expressions): `xpos() ypos() direction() size() timer() answer() mousex()
  mousey() random(a,b) round(x) join(a,b) distance("name")`
- **Booleans**: `keyPressed("x") touching("name") mouseDown()` and `> < == != >= <= && || !`
- **Operators**: `+ - * / %` with normal precedence; parentheses group.
- **Sprite header**: `sprite Name costume=<lib> color=#hex x= y= dir= size= visible=false:`
- **Costume library**: `ball square paddle star triangle bullet coin rocket alien rock` ·
  **backdrops**: `space grass night`
- **Directives**: `@name <title>` · `@show <var ...>` (on-stage monitors) · `# comment`

Variables are auto-declared on first use; ids are stable (`v_<name>`) so they match across sprites.
Compiler source: `bridge/compile.js`. Example: `projects/space.bfs`.

## Live bridge API (lower-level)

Claude authors with `bridge/forge.js` (block builders + HTTP helpers) and pushes commands:

```js
const F = require('./bridge/forge');
const { B, chain, sub, rep, sNum, sTxt, vref, scripts, sprite, shapes } = F;

// build a "when flag → forever → if touching Player, change score" script
const hat = chain(
  B('event_whenflag'),
  B('control_forever', { inputs:{ DO: sub(
    B('control_if', { inputs:{
      COND: rep(B('sensing_touching', { fields:{ TARGET:'Player' } })),
      DO:   sub(B('data_changevariableby', { fields:{ VAR: vref('scoreVar') }, inputs:{ VALUE: sNum(1) } }))
    }})
  )}})
);

await F.addVariable('score', { visible:true });
await F.addSprite(F.sprite('Coin', { x:100, y:60, shape:shapes.star, color:'#FFBF00',
  blocks: scripts(hat, [{ name:'score', id:'scoreVar' }]) }));
await F.run();
const live = await F.getState();   // the user's current project, including their hand edits
```

### Commands (POST `/push`, or the `F.*` helpers)

| helper | action | effect in the live editor |
|---|---|---|
| `F.load(project)` | `loadProject` | replace the whole project |
| `F.addSprite(spr)` | `addSprite` | add a sprite (auto-unique name) + select it |
| `F.updateSprite(name, props)` | `updateSprite` | patch x/y/direction/size/visible/costumes |
| `F.deleteSprite(name)` | `deleteSprite` | remove a sprite |
| `F.setScript(target, blocks)` | `setScript` | replace a target's scripts |
| `F.addScript(target, hat, vars?)` | `addScript` | append one hat-script |
| `F.addVariable(name, {value,visible})` | `addVariable` | create a variable (+ stage monitor) |
| `F.select(target)` | `select` | switch the edited target |
| `F.run()` / `F.stop()` | `run`/`stop` | green-flag / stop |
| `F.toast(msg)` | `toast` | show a message in the editor |

`target` is a sprite name or `"Stage"`. `getState()` returns `{ connected, ageMs, project }`.

## Without the server (fallback file mode)

Everything also works offline as files:
- **Open Project** button → choose a `.bfproject.json` (works even from `file://`).
- Deep link over http: `index.html?project=<name>` loads `projects/<name>.bfproject.json`.
- **Save Project** exports the current project (including your edits) back to a `.json`.

---

## Project format (`.bfproject.json`)

```jsonc
{
  "name": "My Game",
  "variables": [ { "name": "score", "value": 0, "visible": true } ],
  "stage":   { "name": "Stage", "isStage": true, "costumes": [], "blocks": null },
  "sprites": [
    {
      "name": "Player",
      "x": 0, "y": -120, "direction": 90, "size": 100, "visible": true,
      "costumes": [ { "name": "body", "src": "data:image/svg+xml;utf8,..." } ],
      "currentCostume": 0,
      "blocks": { "blocks": { "languageVersion": 0, "blocks": [ /* hat trees */ ] } }
    }
  ]
}
```

- **Coordinates** are Scratch-style: center of stage is `(0,0)`, x ∈ [-240,240], y ∈ [-180,180]. Direction `90` = facing right.
- **costumes[].src** can be a `data:` URL (inline SVG/PNG) or any image URL. Inline SVG is recommended so the project is self-contained — wrap with `encodeURIComponent`.
- **blocks** uses Blockly's serialization. Each entry in the array is a *hat* block; chain statements with `next`, nest with `inputs`.

### Block JSON shape

```jsonc
{
  "type": "motion_move",
  "fields": { "KEY": "space" },                         // dropdowns / variable refs
  "inputs": {
    "STEPS": { "shadow": { "type": "math_number_bf", "fields": { "NUM": 10 } } },
    "COND":  { "block":  { "type": "sensing_keypressed", "fields": { "KEY": "left arrow" } } }
  },
  "next": { "block": { /* the next statement in the stack */ } }
}
```

- Use **`shadow`** for the default editable literal in a slot (`math_number_bf` for numbers, `text_bf` for text).
- Use **`block`** for a real reporter/boolean plugged into a slot, or for the body of a C-block (`DO` / `ELSE`).
- Variable fields serialize by id: `"fields": { "VAR": { "id": "scoreVar" } }`, and the sprite's `blocks` object lists `"variables": [ { "name": "score", "id": "scoreVar" } ]`.

---

## Block reference

**Hats (start a script)**
`event_whenflag` · `event_whenkey`(field `KEY`) · `event_whenclicked` · `event_whenbroadcast`(field `MSG`)

**Motion**
`motion_move`(STEPS) · `motion_turnright`/`motion_turnleft`(DEG) · `motion_pointindirection`(DIR) ·
`motion_goto`(X,Y) · `motion_glide`(SECS,X,Y) · `motion_changexby`(DX) · `motion_setx`(X) ·
`motion_changeyby`(DY) · `motion_sety`(Y) · `motion_ifonedge`
*reporters:* `motion_xposition` · `motion_yposition` · `motion_directionrep`

**Looks**
`looks_sayforsecs`(MSG,SECS) · `looks_say`(MSG) · `looks_think`(MSG) · `looks_switchcostume`(field COSTUME) ·
`looks_nextcostume` · `looks_changesize`(DSIZE) · `looks_setsize`(SIZE) · `looks_seteffect`/`looks_changeeffect`(field EFFECT, VAL) ·
`looks_cleareffects` · `looks_show` · `looks_hide` · `looks_gotofront`  *reporter:* `looks_size`

**Control**
`control_wait`(SECS) · `control_repeat`(TIMES,DO) · `control_forever`(DO) · `control_if`(COND,DO) ·
`control_if_else`(COND,DO,ELSE) · `control_repeat_until`(COND,DO) · `control_wait_until`(COND) ·
`control_stop`(field WHAT = `all` | `this script`)

**Sensing**
`sensing_touching`(field TARGET = `edge`|`mouse-pointer`|spriteName) · `sensing_keypressed`(field KEY) ·
`sensing_mousedown` · `sensing_mousex` · `sensing_mousey` · `sensing_distanceto`(field TARGET) ·
`sensing_timer` · `sensing_resettimer` · `sensing_askandwait`(Q) · `sensing_answer`

**Operators**
`operator_add`/`subtract`/`multiply`/`divide`(A,B) · `operator_random`(FROM,TO) ·
`operator_lt`/`equals`/`gt`(A,B) · `operator_and`/`or`(A,B) · `operator_not`(A) ·
`operator_join`(A,B) · `operator_mod`(A,B) · `operator_round`(A)

**Variables**
`data_setvariableto`(field VAR, VALUE) · `data_changevariableby`(field VAR, VALUE) ·
`data_variable`(field VAR) · `data_showvariable`/`data_hidevariable`(field VAR)

**Literal shadows** `math_number_bf`(field NUM) · `text_bf`(field TEXT)

---

## Authoring tips for Claude

1. **Build the JSON with a small generator**, not by hand — deep nesting is brittle. A helper that
   chains blocks via `next` and wraps reporters/substacks avoids brace-counting mistakes:
   ```js
   const B = (type, o={}) => ({ type, id:nid(), ...o });            // o: {fields, inputs}
   const chain = (...bs) => { bs.forEach((b,i)=> i && (bs[i-1].next={block:b})); return bs[0]; };
   const sub = b => ({ block:b });        // C-block body / reporter slot
   const sNum = v => ({ shadow:{ type:'math_number_bf', fields:{NUM:v} } });
   ```
   See `BlockForge/projects/` build scripts for a full Pong example.
2. **Give every sprite a `when green flag clicked` hat** so the game does something on Run.
3. **Keep self-contained costumes** as inline SVG `data:` URLs.
4. **Use a `forever` loop** for per-frame game logic (movement, collision, input polling).
5. After the user edits and re-exports, **diff against your last version** to see their hand changes before making the next one.
