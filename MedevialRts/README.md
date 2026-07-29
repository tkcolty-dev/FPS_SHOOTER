# ⚔ Medieval RTS

A 2-D top-down real-time strategy game inspired by Roblox's *Medieval RTS*.
Playable with **mouse/keyboard or Xbox controllers** (works in the Xbox Edge
browser). Online multiplayer with room codes.

## Run it

```bash
npm install
npm start        # → http://localhost:4720
```

Other devices on your network (including an Xbox) open
`http://<your-computer's-LAN-IP>:4720` and join with the 4-letter room code.

## Game modes
| Mode | Devices | Screens |
|---|---|---|
| 🌍 **Online Battle** | 1–4 devices | Free-for-all, add bots to fill |
| 🤝 **2v2 Team War** | 2 devices | 2 players share each screen (2 controllers, or mouse + controller); teammates spawn side by side |
| ⚔ **1v1 Split Screen** | 1 device | Left half vs right half, small map |

## How to play
- Start at your **Castle** with 2 builders. Build **Windmills** next to wheat
  **Farms** for income.
- **Barracks**: swordsmen & archers · **Stables**: knights · **Siege
  Workshop**: catapults & 🎈 hot air balloons (flying — only archers, towers,
  and balloons can hit them) · **Towers** defend.
- Destroy every enemy **Castle** to win (in 2v2, the whole enemy team's).
- Pick a **kingdom skin** in the lobby: Kingdom, Royal, Dark Keep, Forest.

## Controls
| | Mouse/Keyboard | Xbox controller |
|---|---|---|
| Select | left-drag | A (tap or hold+move for a box) |
| Command | right-click | A on ground/enemy |
| Build menu | B | X |
| Cancel | Esc | B |
| Select army / builders | — | Y / RB |
| Camera / zoom | WASD, edges, wheel | right stick, LB = castle, triggers = zoom |

## Project layout
- `server/server.js` — lobby, rooms, modes, multi-local connections
- `server/game.js` — authoritative simulation (15 Hz), teams, anti-air, bots
- `shared/gamedata.js` — every balance number, modes, maps
- `client/js/render.js` — 2D renderer (PNG sprites, split-screen viewports)
- `client/js/render3d.js` + `models.js` — **saved 3D renderer** (Three.js);
  flip `USE_3D` in `client/js/renderer.js` to switch back
- `client/assets/README-ART.md` — art drop-in contract (PNGs, skin variants,
  walk frames)
- `art/` — sprite generator scripts (Codex's workshop)
