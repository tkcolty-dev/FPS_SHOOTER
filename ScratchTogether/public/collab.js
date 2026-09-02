/* Scratch Together — live sync layer for the real Scratch 3 editor.
 *
 * How it works
 *  - Block edits: scratch-blocks fires workspace events; we forward them (keyed by sprite name) and
 *    replay them on every other editor, both in the VM and — if they're looking at that sprite — in
 *    their Blockly workspace. Nobody's editor reloads, so it feels like Google Docs.
 *  - Everything else (sprites, costumes, sounds, positions, names, order): each editor diffs a
 *    lightweight description of its targets after every change and sends what changed.
 *  - Assets (costume/sound bytes) are uploaded to the server once and fetched through scratch-storage.
 *  - The oldest connected editor is "host" and keeps a project snapshot on the server for newcomers.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const ROOM = (params.get('room') || '').toUpperCase();
    if (!ROOM) { location.href = '/'; return; }

    let NAME = localStorage.getItem('st_name') || '';
    if (!NAME) {
        NAME = (prompt('What should we call you?') || '').trim() || 'Someone';
        localStorage.setItem('st_name', NAME);
    }

    // scratch-gui's backpack reads ?username=&token= from the URL; token is just "present" for us.
    if (params.get('username') !== NAME || !params.get('token')) {
        params.set('username', NAME); params.set('token', 'together');
        history.replaceState(null, '', `${location.pathname}?${params}`);
    }

    const API = `/api/rooms/${ROOM}`;
    let CLOUD_HOST = null;
    // Cloud variables: numeric project id derived from the room code (Scratch cloud servers expect a number).
    const CLOUD_PROJECT_ID = String(9000000000 + [...ROOM].reduce((n, ch) => n * 32 + 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(ch), 0));
    const SYNC_EVENTS = new Set(['create', 'delete', 'change', 'move', 'var_create', 'var_rename', 'var_delete',
        'comment_create', 'comment_change', 'comment_move', 'comment_delete']);
    const EXTRA_FIELDS = ['commentId', 'blockId', 'varId', 'xy', 'width', 'height', 'text', 'minimized',
        'newContents_', 'newCoordinate_', 'oldParentId', 'oldInputName', 'isLocal', 'isCloud', 'varType',
        'varName', 'newName', 'oldName', 'element', 'name', 'newValue'];
    const STAGE_KEY = '__stage__';

    // ---------------- state ----------------
    let vm = null;
    let ws = null;
    let SB = null;          // ScratchBlocks namespace
    let workspace = null;   // main Blockly workspace
    let ready = false;
    let isHost = false;
    let title = 'Untitled project';
    let users = [];
    let myId = null;

    let ignoreWorkspaceEvents = false; // true while Blockly reloads a workspace (switching sprites)
    let remoteBusy = 0;                // >0 while applying a remote structural change
    let remoteLoading = false;         // true while vm.loadProject runs for a remote project
    const remoteExtensions = new Set();

    const known = new Map();      // targetId -> {name, structSig, poseSig}
    let knownOrder = '';
    const pendingBlocks = new Map(); // sprite name -> [{msg, at}]
    const inbox = [];             // messages received before we're ready
    let firstLoadResolve;
    const firstLoad = new Promise(r => { firstLoadResolve = r; });
    let chain = Promise.resolve(); // serializes async remote applications

    const log = (...a) => console.log('%c[together]', 'color:#4c97ff', ...a);
    window.addEventListener('unhandledrejection', e => console.warn('[together] unhandled', e.reason && (e.reason.stack || e.reason)));

    // ---------------- helpers ----------------
    const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
    const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);
    const stage = () => vm.runtime.getTargetForStage();
    const keyOf = t => (t.isStage ? STAGE_KEY : t.sprite.name);
    const findTarget = key => (key === STAGE_KEY ? stage() :
        vm.runtime.targets.find(t => t.isOriginal && !t.isStage && t.sprite.name === key));
    const originals = () => vm.runtime.targets.filter(t => t.isOriginal);
    const isRunning = () => vm.runtime.threads.length > 0;

    function send (msg) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
    }

    function withEditingTarget (target, fn) {
        const rt = vm.runtime;
        const saved = rt._editingTarget;
        rt._editingTarget = target;
        try { return fn(); } finally { rt._editingTarget = saved; }
    }

    // ---------------- assets ----------------
    const md5extOf = a => `${a.assetId}.${a.dataFormat}`;

    function allAssets () {
        const out = new Map();
        originals().forEach(t => {
            t.getCostumes().forEach(c => { if (c.asset && c.asset.data) out.set(md5extOf(c), c.asset); });
            t.getSounds().forEach(s => { if (s.asset && s.asset.data) out.set(md5extOf(s), s.asset); });
        });
        return out;
    }

    async function syncAssets (targets) {
        let assets;
        if (targets) {
            assets = new Map();
            targets.forEach(t => {
                t.getCostumes().forEach(c => { if (c.asset && c.asset.data) assets.set(md5extOf(c), c.asset); });
                t.getSounds().forEach(s => { if (s.asset && s.asset.data) assets.set(md5extOf(s), s.asset); });
            });
        } else {
            assets = allAssets();
        }
        if (!assets.size) return;
        let missing;
        try {
            const r = await fetch(`${API}/assets-check`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({files: [...assets.keys()]})
            });
            missing = (await r.json()).missing || [];
        } catch (e) { return; }
        await Promise.all(missing.map(async name => {
            const asset = assets.get(name);
            try {
                await fetch(`${API}/assets/${name}`, {method: 'POST', body: asset.data,
                    headers: {'Content-Type': 'application/octet-stream'}});
            } catch (e) { console.warn('upload failed', name, e); }
        }));
    }

    function installAssetStore () {
        const storage = vm.runtime.storage;
        if (!storage || storage.__togetherStore) return false;
        storage.__togetherStore = true;
        const T = storage.AssetType;
        const urlFor = asset => `${location.origin}${API}/assets/${asset.assetId}.${asset.dataFormat}`;
        storage.addWebStore([T.ImageVector, T.ImageBitmap, T.Sound], urlFor, urlFor, urlFor);
        // Try our room first, fall back to Scratch's CDN for library assets.
        const stores = storage.webHelper && storage.webHelper.stores;
        if (stores && stores.length > 1) stores.unshift(stores.pop());
        // scratch-storage's worker-based fetcher never answers in this bundle (its worker chunk isn't
        // shipped), which would hang every asset load forever. Keep only the plain fetch tool.
        ['assetTool', 'projectTool'].forEach(k => {
            const tool = storage.webHelper && storage.webHelper[k];
            if (tool && Array.isArray(tool.tools) && tool.tools.length > 1) {
                const plain = tool.tools.filter(t => !('inner' in t) && !('worker' in t) && !('_worker' in t) && !('jobs' in t));
                tool.tools = plain.length ? plain : [tool.tools[tool.tools.length - 1]];
            }
        });
        return true;
    }

    // ---------------- describe targets (structure diff) ----------------
    function describe (t) {
        const costumes = t.getCostumes().map(c => ({
            name: c.name, assetId: c.assetId, dataFormat: c.dataFormat, md5ext: md5extOf(c),
            bitmapResolution: c.bitmapResolution, rotationCenterX: c.rotationCenterX, rotationCenterY: c.rotationCenterY
        }));
        const sounds = t.getSounds().map(s => ({
            name: s.name, assetId: s.assetId, dataFormat: s.dataFormat, md5ext: md5extOf(s),
            format: s.format, rate: s.rate, sampleCount: s.sampleCount
        }));
        const variables = {};
        for (const id in t.variables) {
            const v = t.variables[id];
            variables[id] = [v.name, v.type, !!v.isCloud];
        }
        return {
            name: keyOf(t), isStage: t.isStage,
            x: t.x, y: t.y, size: t.size, direction: t.direction, visible: t.visible,
            draggable: t.draggable, rotationStyle: t.rotationStyle, currentCostume: t.currentCostume,
            volume: t.volume, tempo: t.tempo, videoState: t.videoState, videoTransparency: t.videoTransparency,
            textToSpeechLanguage: t.textToSpeechLanguage,
            costumes, sounds, variables
        };
    }
    const structSigOf = d => JSON.stringify([d.name, d.costumes, d.sounds, d.variables, d.draggable,
        d.rotationStyle, d.volume, d.tempo, d.videoState, d.videoTransparency, d.textToSpeechLanguage]);
    const poseSigOf = d => JSON.stringify([d.x, d.y, d.size, d.direction, d.visible, d.currentCostume]);

    function snapshotKnown () {
        known.clear();
        originals().forEach(t => {
            const d = describe(t);
            known.set(t.id, {name: keyOf(t), structSig: structSigOf(d), poseSig: poseSigOf(d)});
        });
        knownOrder = JSON.stringify(originals().filter(t => !t.isStage).map(keyOf));
    }

    const checkTargets = debounce(() => {
        if (!ready) return;
        if (remoteBusy > 0) { checkTargets(); return; }
        const running = isRunning();
        const seen = new Set();
        originals().forEach(t => {
            seen.add(t.id);
            const d = describe(t);
            const structSig = structSigOf(d);
            const poseSig = poseSigOf(d);
            const prev = known.get(t.id);
            if (!prev) {
                known.set(t.id, {name: keyOf(t), structSig, poseSig});
                if (!t.isStage) sendSpriteAdd(t);
                return;
            }
            const rename = prev.name !== keyOf(t) ? keyOf(t) : null;
            if (rename || prev.structSig !== structSig || (!running && prev.poseSig !== poseSig)) {
                const msg = {type: 'sprite', sprite: prev.name, data: d, pose: !running};
                if (rename) msg.rename = rename;
                const oldName = prev.name;
                prev.name = keyOf(t);
                prev.structSig = structSig;
                if (!running) prev.poseSig = poseSig;
                syncAssets([t]).then(() => send(msg));
                log('sprite changed', oldName, rename ? '→ ' + rename : '');
            }
        });
        for (const [id, k] of known) {
            if (!seen.has(id)) {
                known.delete(id);
                if (k.name !== STAGE_KEY) send({type: 'deleteSprite', sprite: k.name});
            }
        }
        const order = JSON.stringify(originals().filter(t => !t.isStage).map(keyOf));
        if (order !== knownOrder) {
            knownOrder = order;
            send({type: 'reorder', order: JSON.parse(order)});
        }
    }, 350);

    async function sendSpriteAdd (t) {
        await syncAssets([t]);
        if (!vm.runtime.getTargetById(t.id)) return; // deleted again already
        send({type: 'sprite', add: true, sprite: keyOf(t), json: vm.toJSON(t.id), data: describe(t)});
        log('sent new sprite', keyOf(t));
    }

    // ---------------- host snapshot ----------------
    async function sendSnapshot () {
        if (!isHost || !ready || !vm.runtime.targets.some(t => t.isStage)) return;
        await syncAssets();
        send({type: 'snapshot', project: vm.toJSON(), title});
    }
    const scheduleSnapshot = debounce(() => { sendSnapshot(); }, 1500);

    // ---------------- outgoing block events ----------------
    function onLocalBlockEvent (e) {
        if (!ready || ignoreWorkspaceEvents || remoteBusy > 0) return;
        if (!SYNC_EVENTS.has(e.type)) return;
        if (workspace && e.workspaceId && e.workspaceId !== workspace.id) return;
        const t = vm.editingTarget;
        if (!t) return;
        let json;
        try { json = e.toJson(); } catch (err) { return; }
        EXTRA_FIELDS.forEach(k => {
            if (json[k] === undefined && e[k] !== undefined) {
                const v = e[k];
                json[k] = (v && typeof v === 'object' && 'x' in v && 'y' in v) ? {x: v.x, y: v.y} : v;
            }
        });
        send({type: 'blocks', sprite: keyOf(t), event: json});
    }

    // ---------------- incoming block events ----------------
    function eventFromJson (json) {
        let ev = null;
        try { ev = SB.Events.fromJson(json, workspace || {id: 'none'}); } catch (err) { ev = null; }
        if (!ev) ev = Object.assign({}, json);
        EXTRA_FIELDS.forEach(k => { if (ev[k] === undefined && json[k] !== undefined) ev[k] = json[k]; });
        if (ev.xy && typeof ev.xy === 'object') ev.xy = {x: ev.xy.x, y: ev.xy.y};
        if (json.newCoordinate_ && !ev.newCoordinate_) ev.newCoordinate_ = json.newCoordinate_;
        if (json.newContents_ && !ev.newContents_) ev.newContents_ = json.newContents_;
        return ev;
    }

    function applyBlocks (msg) {
        const t = findTarget(msg.sprite);
        if (!t) {
            if (!pendingBlocks.has(msg.sprite)) pendingBlocks.set(msg.sprite, []);
            pendingBlocks.get(msg.sprite).push({msg, at: Date.now()});
            return;
        }
        const json = msg.event;
        const editing = !!workspace && vm.editingTarget === t;
        const ev = eventFromJson(json);
        const isVar = json.type.indexOf('var_') === 0;
        let global = false;
        if (isVar) {
            global = json.type === 'var_create' ? !json.isLocal : !!stage().variables[json.varId];
        }
        let needsRefresh = false;
        remoteBusy++;
        try {
            if (workspace && SB && (editing || (isVar && global))) {
                SB.Events.disable();
                try {
                    if (json.type === 'var_delete') {
                        const v = workspace.getVariableById(json.varId);
                        const map = workspace.getVariableMap ? workspace.getVariableMap() : workspace.variableMap_;
                        if (v && map && map.deleteVariable) map.deleteVariable(v);
                        if (workspace.refreshToolboxSelection_) workspace.refreshToolboxSelection_();
                    } else if (typeof ev.run === 'function') {
                        ev.run(true);
                    }
                } catch (err) {
                    console.warn('[together] workspace apply failed, refreshing', json.type, err);
                    needsRefresh = true;
                } finally {
                    SB.Events.enable();
                }
            }
            try {
                withEditingTarget(t, () => t.blocks.blocklyListen(ev));
            } catch (err) {
                console.warn('[together] vm apply failed', json.type, err);
            }
            if (needsRefresh && editing) vm.emitWorkspaceUpdate();
        } finally {
            remoteBusy--;
        }
    }

    function replayPending (name) {
        const list = pendingBlocks.get(name);
        pendingBlocks.delete(name);
        if (!list) return;
        const cutoff = Date.now() - 20000;
        list.filter(p => p.at > cutoff).forEach(p => applyBlocks(p.msg));
    }

    // ---------------- incoming structure ----------------
    function skinCleanup (t, removed) {
        const renderer = vm.runtime.renderer;
        if (!renderer) return;
        removed.forEach(c => { try { if (c.skinId !== undefined) renderer.destroySkin(c.skinId); } catch (e) { /* ignore */ } });
    }

    async function applyCostumes (t, d) {
        const current = t.getCostumes();
        const have = new Map(current.map(c => [md5extOf(c), c]));
        const wantKeys = new Set(d.costumes.map(c => c.md5ext));
        for (const c of d.costumes) {
            if (have.has(c.md5ext)) continue;
            const obj = {name: c.name, assetId: c.assetId, dataFormat: c.dataFormat, bitmapResolution: c.bitmapResolution,
                rotationCenterX: c.rotationCenterX, rotationCenterY: c.rotationCenterY};
            try {
                await withTimeout(vm.addCostume(c.md5ext, obj, t.id), 20000, 'costume ' + c.md5ext);
                have.set(c.md5ext, obj);
            } catch (e) { console.warn('[together] costume load failed', c.md5ext, e); }
        }
        const used = new Set();
        const ordered = [];
        d.costumes.forEach(c => {
            let obj = have.get(c.md5ext);
            if (!obj) return;
            if (used.has(obj)) obj = Object.assign({}, obj);
            used.add(obj);
            obj.name = c.name;
            obj.rotationCenterX = c.rotationCenterX;
            obj.rotationCenterY = c.rotationCenterY;
            ordered.push(obj);
        });
        if (!ordered.length) return;
        const before = t.getCostumes().slice();
        const same = before.length === ordered.length && before.every((c, i) => c === ordered[i]);
        if (!same) {
            t.sprite.costumes = ordered;
            skinCleanup(t, before.filter(c => !wantKeys.has(md5extOf(c))));
        }
        const idx = Math.min(Math.max(0, d.currentCostume), ordered.length - 1);
        if (t.currentCostume !== idx || !same) t.setCostume(idx);
    }

    async function applySounds (t, d) {
        const have = new Map(t.getSounds().map(s => [md5extOf(s), s]));
        for (const s of d.sounds) {
            if (have.has(s.md5ext)) continue;
            const obj = {name: s.name, assetId: s.assetId, dataFormat: s.dataFormat, md5: s.md5ext,
                format: s.format, rate: s.rate, sampleCount: s.sampleCount};
            try {
                await withTimeout(vm.addSound(obj, t.id), 20000, 'sound ' + s.md5ext);
                have.set(s.md5ext, obj);
            } catch (e) { console.warn('[together] sound load failed', s.md5ext, e); }
        }
        const used = new Set();
        const ordered = [];
        d.sounds.forEach(s => {
            let obj = have.get(s.md5ext);
            if (!obj) return;
            if (used.has(obj)) obj = Object.assign({}, obj);
            used.add(obj);
            obj.name = s.name;
            ordered.push(obj);
        });
        t.sprite.sounds = ordered;
    }

    function applyVariables (t, d) {
        for (const id in d.variables) {
            if (t.variables[id]) continue;
            const [name, type, isCloud] = d.variables[id];
            if (t.lookupVariableByNameAndType && t.lookupVariableByNameAndType(name, type, true)) continue;
            try { t.createVariable(id, name, type, isCloud); } catch (e) { /* ignore */ }
        }
    }

    async function applySpriteUpdate (msg) {
        const t = findTarget(msg.sprite);
        if (!t) return;
        remoteBusy++;
        try {
            if (msg.rename && msg.rename !== keyOf(t) && !t.isStage) vm.renameSprite(t.id, msg.rename);
            const d = msg.data;
            if (d) {
                await applyCostumes(t, d);
                await applySounds(t, d);
                applyVariables(t, d);
                if (!t.isStage) {
                    if (t.rotationStyle !== d.rotationStyle) t.setRotationStyle(d.rotationStyle);
                    if (t.draggable !== d.draggable) t.setDraggable(d.draggable);
                    if (msg.pose) {
                        if (t.x !== d.x || t.y !== d.y) t.setXY(d.x, d.y, true);
                        if (t.direction !== d.direction) t.setDirection(d.direction);
                        if (t.size !== d.size) t.setSize(d.size);
                        if (t.visible !== d.visible) t.setVisible(d.visible);
                    }
                } else {
                    if (typeof d.tempo === 'number') t.tempo = d.tempo;
                    if (d.videoState) t.videoState = d.videoState;
                    if (typeof d.videoTransparency === 'number') t.videoTransparency = d.videoTransparency;
                    if (d.textToSpeechLanguage !== undefined) t.textToSpeechLanguage = d.textToSpeechLanguage;
                }
                if (typeof d.volume === 'number') t.volume = d.volume;
            }
            vm.emitTargetsUpdate(false);
            vm.runtime.emitProjectChanged();
        } finally {
            remoteBusy--;
            snapshotKnown();
        }
    }

    async function applySpriteAdd (msg) {
        if (findTarget(msg.sprite)) return applySpriteUpdate(msg);
        const prevEditing = vm.editingTarget;
        remoteBusy++;
        try {
            await withTimeout(vm.addSprite(msg.json), 30000, 'sprite ' + msg.sprite);
            log('added sprite', msg.sprite);
        } catch (e) {
            console.warn('[together] addSprite failed', e);
        } finally {
            remoteBusy--;
        }
        if (prevEditing && vm.runtime.getTargetById(prevEditing.id)) vm.setEditingTarget(prevEditing.id);
        snapshotKnown();
        replayPending(msg.sprite);
    }

    function applyDeleteSprite (msg) {
        const t = findTarget(msg.sprite);
        if (!t || t.isStage) return;
        remoteBusy++;
        try { vm.deleteSprite(t.id); } catch (e) { console.warn(e); } finally { remoteBusy--; snapshotKnown(); }
    }

    function applyReorder (msg) {
        remoteBusy++;
        try {
            msg.order.forEach((name, i) => {
                const t = findTarget(name);
                if (!t) return;
                const cur = vm.runtime.targets.indexOf(t);
                const want = i + 1; // stage is index 0
                if (cur !== want && cur >= 0) vm.reorderTarget(cur, want);
            });
        } finally { remoteBusy--; snapshotKnown(); }
    }

    async function loadDefaultProject () {
        const storage = vm.runtime.storage;
        const asset = await storage.load(storage.AssetType.Project, '0', storage.DataFormat.JSON);
        await vm.loadProject(asset.decodeText ? asset.decodeText() : asset.data);
    }

    async function applyProject (json) {
        remoteBusy++;
        remoteLoading = true;
        try {
            await withTimeout(vm.loadProject(json), 60000, 'project');
        } catch (e) {
            console.warn('[together] loadProject failed', e);
            if (!vm.runtime.targets.some(t => t.isStage)) {
                try { await loadDefaultProject(); } catch (e2) { console.warn('[together] default project failed', e2); }
            }
        } finally {
            remoteLoading = false;
            remoteBusy--;
            snapshotKnown();
            ensureCloud();
        }
    }

    function applyExtension (msg) {
        const em = vm.extensionManager;
        if (em.isExtensionLoaded(msg.id)) return;
        remoteExtensions.add(msg.id);
        em.loadExtensionURL(msg.id).catch(() => {}).finally(() => remoteExtensions.delete(msg.id));
    }

    const CORE_PREFIXES = new Set(['motion', 'looks', 'sound', 'event', 'control', 'sensing', 'operator', 'data',
        'procedures', 'argument', 'math', 'text', 'colour', 'note']);
    async function applyBlocksAdd (msg) {
        const t = findTarget(msg.sprite);
        if (!t || !msg.blocks) return;
        const em = vm.extensionManager;
        const needed = new Set(Object.values(msg.blocks).map(b => String(b.opcode || '').split('_')[0])
            .filter(p => p && !CORE_PREFIXES.has(p) && !em.isExtensionLoaded(p)));
        for (const id of needed) {
            remoteExtensions.add(id);
            try { await em.loadExtensionURL(id); } catch (e) { /* unknown prefix */ } finally { remoteExtensions.delete(id); }
        }
        remoteBusy++;
        try {
            let added = 0;
            for (const id in msg.blocks) {
                if (t.blocks._blocks[id]) continue;
                t.blocks.createBlock(JSON.parse(JSON.stringify(msg.blocks[id])));
                added++;
            }
            if (added) {
                t.blocks.updateTargetSpecificBlocks(t.isStage);
                vm.runtime.emitProjectChanged();
                if (vm.editingTarget === t) vm.emitWorkspaceUpdate();
            }
        } finally { remoteBusy--; }
    }

    // ---------------- cloud variables (CloudLift speaks Scratch's cloud protocol) ----------------
    let cloud = null;
    class CloudProvider {
        constructor (host, projectId, username) {
            this.host = host; this.projectId = projectId; this.username = username;
            this.attempts = 0; this.queue = []; this.closed = false;
            this.open();
        }
        open () {
            this.attempts++;
            // Relayed through our own server (browsers are picky about third-party sockets).
            const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
            try { this.ws = new WebSocket(`${proto}${location.host}/cloud?room=${encodeURIComponent(ROOM)}`); } catch (e) { this.ws = null; return; }
            this.ws.onopen = () => {
                this.attempts = 1;
                this.write('handshake');
                this.queue.splice(0).forEach(d => this.ws.send(d));
            };
            this.ws.onmessage = ev => String(ev.data).split('\n').forEach(line => {
                if (!line) return;
                let m; try { m = JSON.parse(line); } catch (e) { return; }
                if (m.method === 'set') vm.postIOData('cloud', {varUpdate: {name: m.name, value: m.value}});
            });
            this.ws.onclose = () => {
                if (this.closed) return;
                const wait = Math.random() * (Math.pow(2, Math.min(this.attempts, 5)) - 1) * 1000 + 500;
                this.timer = setTimeout(() => this.open(), wait);
            };
            this.ws.onerror = () => {};
        }
        write (method, name, value, newName) {
            const msg = {method, user: this.username, project_id: this.projectId};
            if (name) msg.name = name;
            if (newName) msg.new_name = newName;
            if (value !== undefined && value !== null) msg.value = value;
            const data = `${JSON.stringify(msg)}\n`;
            if (this.ws && this.ws.readyState === 1) this.ws.send(data);
            else if (method !== 'set') this.queue.push(data);
        }
        createVariable (name, value) { this.write('create', name, value); }
        updateVariable (name, value) { this.write('set', name, value); }
        renameVariable (oldName, newName) { this.write('rename', oldName, null, newName); }
        deleteVariable (name) { this.write('delete', name); }
        requestCloseConnection () { this.closed = true; clearTimeout(this.timer); if (this.ws) this.ws.close(); }
    }
    function ensureCloud () {
        if (!CLOUD_HOST || !vm || !ready) return;
        const has = vm.runtime.hasCloudData();
        if (has && !cloud) {
            cloud = new CloudProvider(CLOUD_HOST, CLOUD_PROJECT_ID, NAME);
            vm.setCloudProvider(cloud);
            log('cloud variables connected to', CLOUD_HOST);
        } else if (!has && cloud) {
            cloud.requestCloseConnection();
            cloud = null;
            vm.setCloudProvider(null);
        }
    }

    // ---------------- message dispatch ----------------
    function handle (msg) {
        switch (msg.type) {
        case 'blocks': applyBlocks(msg); break;
        case 'sprite':
            chain = chain.then(() => (msg.add ? applySpriteAdd(msg) : applySpriteUpdate(msg))).catch(e => console.warn(e));
            break;
        case 'deleteSprite': chain = chain.then(() => applyDeleteSprite(msg)); break;
        case 'reorder': chain = chain.then(() => applyReorder(msg)); break;
        case 'project': chain = chain.then(() => applyProject(msg.project)); break;
        case 'extension': applyExtension(msg); break;
        case 'blocksAdd': chain = chain.then(() => applyBlocksAdd(msg)).catch(e => console.warn(e)); break;
        default: break;
        }
    }

    async function applyInit (msg) {
        myId = msg.you;
        isHost = !!msg.host;
        users = msg.users || [];
        if (msg.title) setTitle(msg.title, false);
        renderUsers();
        if (msg.project) {
            await applyProject(msg.project);
        } else {
            snapshotKnown();
        }
        ready = true;
        log('ready', isHost ? '(host)' : '');
        ensureCloud();
        if (isHost) sendSnapshot();
        sendPresence(true);
        const queued = inbox.splice(0);
        queued.forEach(handle);
        setStatus('');
    }

    // ---------------- websocket ----------------
    let retry = 0;
    function connect () {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(ROOM)}&name=${encodeURIComponent(NAME)}`);
        ws.onopen = () => { retry = 0; setStatus('Joining…'); };
        ws.onmessage = ev => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            switch (msg.type) {
            case 'init':
                if (ready) { // reconnect: just refresh presence, keep our project
                    isHost = !!msg.host; users = msg.users || []; renderUsers(); sendPresence(true);
                    if (isHost) sendSnapshot();
                    setStatus('');
                } else {
                    firstLoad.then(() => applyInit(msg));
                }
                return;
            case 'users': users = msg.users || []; renderUsers(); return;
            case 'host': isHost = true; renderUsers(); sendSnapshot(); return;
            case 'requestSnapshot': if (ready) sendSnapshot(); return;
            case 'title': setTitle(msg.title, false); return;
            default:
                if (!ready) inbox.push(msg); else handle(msg);
            }
        };
        ws.onclose = e => {
            if (e.code === 4004) { setStatus('That room does not exist.'); return; }
            setStatus('Reconnecting…');
            setTimeout(connect, Math.min(8000, 500 * Math.pow(2, retry++)));
        };
    }

    // ---------------- presence / UI ----------------
    let lastPresence;
    function sendPresence (force) {
        if (!vm || !ready) return;
        const s = vm.editingTarget ? (vm.editingTarget.isStage ? 'Stage' : vm.editingTarget.sprite.name) : null;
        if (force || s !== lastPresence) { lastPresence = s; send({type: 'presence', sprite: s}); }
    }

    let guiRender = null;
    function setTitle (t, broadcast) {
        title = t || 'Untitled project';
        document.title = `${title} · Scratch Together`;
        if (guiRender) guiRender();
        if (broadcast) send({type: 'title', title});
    }

    const pill = document.createElement('div');
    pill.id = 'together-pill';
    document.body.appendChild(pill);
    let statusText = 'Loading…';
    function setStatus (s) { statusText = s; renderUsers(); }

    function renderUsers () {
        const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
        const list = users.map(u => `<div class="tg-user"><span class="tg-dot" style="background:${u.color}"></span>` +
            `<span class="tg-name">${esc(u.name)}${u.id === myId ? ' (you)' : ''}</span>` +
            `${u.sprite ? `<span class="tg-sprite">${esc(u.sprite)}</span>` : ''}</div>`).join('');
        pill.innerHTML = `<div class="tg-head"><span class="tg-code">${ROOM}</span>` +
            `<button class="tg-copy" title="Copy invite link">Copy link</button>` +
            `<span class="tg-count">👥 ${users.length}</span>` +
            `${statusText ? `<span class="tg-status">${esc(statusText)}</span>` : ''}</div>` +
            `<div class="tg-list">${list}</div>`;
        pill.querySelector('.tg-copy').onclick = () => {
            const link = `${location.origin}/r/${ROOM}`;
            navigator.clipboard.writeText(link).then(() => {
                pill.querySelector('.tg-copy').textContent = 'Copied!';
                setTimeout(renderUsers, 1500);
            }).catch(() => prompt('Invite link', link));
        };
    }
    renderUsers();

    // ---------------- Blockly workspace discovery ----------------
    function findBlocksComponent () {
        const divs = document.querySelectorAll('.injectionDiv');
        for (const inj of divs) {
            const node = inj.parentElement;
            if (!node) continue;
            const key = Object.keys(node).find(k => k.indexOf('__reactInternalInstance$') === 0 || k.indexOf('__reactFiber$') === 0);
            if (!key) continue;
            let fiber = node[key];
            let hops = 0;
            while (fiber && hops++ < 12) {
                const s = fiber.stateNode;
                if (s && s.workspace && s.ScratchBlocks && s.props && s.props.vm === vm &&
                    s.workspace.getFlyout && s.workspace.getFlyout()) return s;
                fiber = fiber.return;
            }
        }
        return null;
    }

    function attachWorkspace () {
        const comp = findBlocksComponent();
        if (!comp || comp.workspace === workspace) return;
        if (workspace) { try { workspace.removeChangeListener(onLocalBlockEvent); } catch (e) { /* gone */ } }
        workspace = comp.workspace;
        SB = comp.ScratchBlocks;
        workspace.addChangeListener(onLocalBlockEvent);
        if (!SB.Xml.__togetherWrapped) {
            SB.Xml.__togetherWrapped = true;
            const orig = SB.Xml.clearWorkspaceAndLoadFromXml;
            SB.Xml.clearWorkspaceAndLoadFromXml = function (...args) {
                ignoreWorkspaceEvents = true;
                try { return orig.apply(this, args); } finally {
                    setTimeout(() => { ignoreWorkspaceEvents = false; }, 0);
                }
            };
        }
        log('workspace attached');
    }

    // ---------------- VM hookup ----------------
    function onVmInit (theVm) {
        vm = theVm;
        window.togetherVM = vm;
        window.together = {
            get workspace () { return workspace; }, get SB () { return SB; }, get known () { return known; },
            describe, syncAssets, sendSpriteAdd, checkTargets, send, get ready () { return ready; }, get remoteBusy () { return remoteBusy; }, get ws () { return ws; }
        };

        const origLoad = vm.loadProject.bind(vm);
        let loaded = false;
        vm.loadProject = function (input) {
            const remote = remoteLoading;
            const p = origLoad(input);
            p.then(() => {
                if (!loaded) { loaded = true; firstLoadResolve(); }
                if (ready && !remote) {
                    remoteBusy++;
                    syncAssets().then(() => {
                        send({type: 'project', project: vm.toJSON()});
                        log('sent whole project');
                    }).finally(() => { remoteBusy--; snapshotKnown(); });
                }
            }).catch(() => {});
            return p;
        };

        const origShare = vm.shareBlocksToTarget.bind(vm);
        vm.shareBlocksToTarget = function (blocks, targetId, optFromTargetId) {
            const target = vm.runtime.getTargetById(targetId);
            const before = target ? new Set(Object.keys(target.blocks._blocks)) : null;
            const p = origShare(blocks, targetId, optFromTargetId);
            if (target && ready) {
                p.then(() => {
                    const added = {};
                    for (const id in target.blocks._blocks) if (!before.has(id)) added[id] = target.blocks._blocks[id];
                    if (Object.keys(added).length) send({type: 'blocksAdd', sprite: keyOf(target), blocks: added});
                }).catch(() => {});
            }
            return p;
        };

        const em = vm.extensionManager;
        const origExt = em.loadExtensionURL.bind(em);
        em.loadExtensionURL = function (id) {
            const p = origExt(id);
            if (ready && !remoteExtensions.has(id)) p.then(() => send({type: 'extension', id})).catch(() => {});
            return p;
        };

        vm.on('targetsUpdate', () => { checkTargets(); sendPresence(false); });
        vm.on('PROJECT_CHANGED', () => { checkTargets(); ensureCloud(); if (isHost) scheduleSnapshot(); });
        vm.on('PROJECT_RUN_STOP', () => checkTargets());

        const storageTimer = setInterval(() => { if (installAssetStore()) clearInterval(storageTimer); }, 100);
        setInterval(attachWorkspace, 750);
        setInterval(() => { if (window.onbeforeunload) window.onbeforeunload = null; }, 1000);
        connect();
    }

    // ---------------- render the real Scratch editor ----------------
    function boot () {
        const React = window.React;
        const ReactDOM = window.ReactDOM;
        const lib = window.GUI;
        const GUIComponent = lib.default;
        const AppStateHOC = lib.AppStateHOC;
        const app = document.getElementById('app');
        (lib.setAppElement || (() => {}))(app);
        const Wrapped = AppStateHOC(GUIComponent);
        guiRender = () => {
            ReactDOM.render(React.createElement(Wrapped, {
                projectId: '0',
                canEditTitle: true,
                canSave: false,
                canCreateNew: false,
                canRemix: false,
                canCreateCopy: false,
                canShare: false,
                enableCommunity: false,
                showComingSoon: false,
                backpackVisible: true,
                backpackHost: `${location.origin}/backpack`,
                username: NAME,
                cloudHost: CLOUD_HOST || undefined,
                hasCloudPermission: !!CLOUD_HOST,
                projectTitle: title,
                onUpdateProjectTitle: t => { if (ready && t && t !== title) setTitle(t, true); },
                onClickLogo: () => { location.href = '/'; },
                onVmInit
            }), app);
        };
        guiRender();
    }

    fetch('/api/config').then(r => r.json()).then(c => { CLOUD_HOST = c.cloudHost || null; }).catch(() => {})
        .then(() => { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); });
})();
