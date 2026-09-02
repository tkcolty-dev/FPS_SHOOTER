# Scratch Together

Real-time collaborative editing in the **real Scratch 3 editor**. One person starts a room, shares
a 5-letter code or link, and everyone edits the same project live: blocks, sprites, costumes,
sounds, backdrops, variables, custom blocks, extensions. No editor reloads while you work.

This is not a Scratch clone. It serves the official open-source `scratch-gui` bundle (the same code
scratch.mit.edu runs) and adds a small sync layer on top.

## Online

Live at **https://scratch-together.apps.tas-ndc.kuhn-labs.com** (Cloud Foundry, rooms and art stored in Postgres).
Friends anywhere can join with the room link. Redeploy with `cf push` from this folder.

## Run it locally

```
cd ScratchTogether
npm install      # first time only (downloads the Scratch editor, ~70 MB)
npm start        # or double-click start.command
```

Open http://localhost:4940, type your name, **Start a new room**. Hit **Copy link** in the top-right
pill and send it to friends on the same wifi (the terminal also prints your LAN address).

## What syncs

| Thing | How |
|---|---|
| Block edits (drag, connect, edit fields, delete, comments, variables, lists, My Blocks) | scratch-blocks workspace events, replayed live on every editor |
| Sprites added / duplicated / deleted / renamed / reordered | structural diff after each change |
| Costumes, backdrops, sounds (paint, upload, library, rename, reorder) | asset bytes uploaded once to the server, fetched by everyone else |
| Sprite position, size, direction, visibility, rotation style | synced when the project is not running |
| Extensions (Pen, Music, Video Sensing, Text to Speech, Translate, hardware) | loaded on every editor when one person adds it |
| Sprite / costume / sound / backdrop libraries, tutorials | straight from Scratch's CDN, like scratch.mit.edu |
| Backpack | our own backpack server, follows your name across rooms (sprites, costumes, sounds, scripts) |
| Cloud variables (☁) | relayed to your CloudLift server; the room is a project there, so every editor and every player shares the values |
| Dragging scripts onto another sprite, dropping backpack code | synced |
| "Show variable" checkbox (stage monitors) | synced |
| File ▸ Load from your computer | whole project replaced for everyone |
| Project title | shared |

Green flag runs are per person (everyone runs their own copy). File ▸ Save to your computer gives a
normal `.sb3` that opens on scratch.mit.edu.

## Room settings (⚙ in the top-right pill)

- **Project name** — shared with everyone in the room.
- **Cloud variables** — *Live* sends ☁ variables to your CloudLift server (the room shows up there by name, and
  players of the exported game share the same values); *Simulated* keeps them on this server, shared only inside the
  room; *Off* makes ☁ variables behave like normal variables.

## Projects page

The start page lists your projects (this device) and everything on the server, with live stage thumbnails, who is
editing right now, copy-link and delete.

## Rooms

Rooms persist in `data/<CODE>/` (project.json + assets) and survive server restarts. The oldest
connected editor is the "host" and keeps the server's snapshot fresh; newcomers get the latest state.

## Credit

Scratch Together is built on the open-source [Scratch editor](https://github.com/scratchfoundation/scratch-editor)
(`scratch-gui`, `scratch-vm`, `scratch-blocks`, `scratch-render`, `scratch-paint`, ...) developed by the
[Scratch Foundation](https://scratch.mit.edu) and the Lifelong Kindergarten Group at the MIT Media Lab, used under the
AGPL-3.0 license. Scratch is a trademark of MIT. This is a fan project and is not affiliated with or endorsed by Scratch.
Library sprites, backdrops and sounds are © Scratch and licensed CC BY-SA 2.0.
