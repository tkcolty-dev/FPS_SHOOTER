# ☁🔌 CloudPlug

Plug a Scratch game into the cloud. A browser plugin adds a **CloudPlug** block category to scratch.mit.edu that works while a project runs; the blocks talk to this server (Cloud Foundry, Postgres) for saves, per-player saves, leaderboards, unlimited-length "super cloud variables", cloud lists, chat, mail, server push, web fetch / JSON / weather, and an AI helper.

```
npm install
npm start          # http://localhost:4960  (dashboard)
npm test           # protocol + headless scratch-vm tests
npm run build      # regenerates public/CloudPlug.sprite3 and CloudPlug-template.sb3
node tools/build-extensions.js   # rebuilds public/extension.js + browser-extension/inject.js from src/
```

## Pieces

| Piece | What it is |
|---|---|
| `browser-extension/` | Chrome plugin (Manifest V3). Injects `inject.js` into scratch.mit.edu, grabs the running VM, registers the CloudPlug extension (`extensionManager._registerInternalExtension`) so the category shows in the palette and runs in the editor and player. Zip served at `/browser-extension.zip`. |
| `src/cloudplug-core.js` | The block definitions + WebSocket client, shared by the plugin, the TurboWarp extension and the tests. |
| `public/extension.js` | Same blocks as a TurboWarp custom extension. |
| `server.js` + `handlers.js` | The server. Three doors in: the plugin/TurboWarp socket (`/plug`, JSON), the Scratch cloud-variable protocol (`?cloud_host=`), and a bridge into real scratch.mit.edu cloud data. |
| `protocol.js` | scratchattach-compatible "cloud requests" wire format (TO_HOST / FROM_HOST_1..9, 2-digit char codes, packet splitting). |
| `tools/build-sprite.js` | Generates `CloudPlug.sprite3` / `CloudPlug-template.sb3`: plain Scratch blocks that do the whole encoding dance, so a game can use the server with **no plugin at all** (works for every player on scratch.mit.edu). Case-sensitive character lookup uses the costume-name trick. |
| `public/index.html` | Dashboard: Scratch login, projects, live request log, browse/edit all stored data, push a message to every running copy, try any request. |

## Deploy (Cloud Foundry)

```
cf create-service <postgres offering> <plan> cloudplug-db    # once
cf push                                                     # manifest binds cloudplug-db + blockbuddy-ai (AI)
```

## Request list
Every request (`name&arg1&arg2…`) is listed on the dashboard; the plugin blocks are friendly wrappers around them.
