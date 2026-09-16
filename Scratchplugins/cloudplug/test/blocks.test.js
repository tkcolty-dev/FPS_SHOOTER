// Registers the CloudPlug block core into a headless scratch-vm exactly like the browser plugin does,
// loads a project that USES the blocks (cloudplug_* opcodes), runs it, and checks results against a live server.
const { spawn } = require('child_process');
const path = require('path'); const fs = require('fs');
const WebSocket = require('ws');
const VM = require('scratch-vm');
const CloudPlugBlocks = require('../src/cloudplug-core');

const PORT = 6000 + Math.floor(Math.random() * 300);
fs.rmSync(path.join(__dirname, 'tmp'), { recursive: true, force: true }); fs.mkdirSync(path.join(__dirname, 'tmp'));
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: path.join(__dirname, 'tmp') } });
srv.stderr.on('data', (d) => process.stdout.write(d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a project.json builder for straight-line scripts of extension blocks
let n = 0; const id = () => 'b' + (++n);
function script(blocks) {
  const out = {}; let prev = null; let first = null;
  for (const [opcode, args, saveTo] of blocks) {
    const bid = id(); const b = { opcode, next: null, parent: prev, inputs: {}, fields: {}, shadow: false, topLevel: !prev };
    if (saveTo) { // wrap reporter: set variable saveTo to (reporter)
      const rid = id(); const rep = { opcode, next: null, parent: bid, inputs: {}, fields: {}, shadow: false, topLevel: false };
      for (const [k, v] of Object.entries(args)) rep.inputs[k] = [1, [10, String(v)]];
      out[rid] = rep;
      b.opcode = 'data_setvariableto'; b.inputs = { VALUE: [3, rid, [10, '']] }; b.fields = { VARIABLE: [saveTo, 'v_' + saveTo] };
    } else for (const [k, v] of Object.entries(args)) b.inputs[k] = [1, [10, String(v)]];
    out[bid] = b; if (prev) out[prev].next = bid; else first = bid; prev = bid;
  }
  out[first].x = 0; out[first].y = 0; return out;
}
async function main() {
  await sleep(900);
  const vm = new VM();
  const ext = new CloudPlugBlocks({ runtime: vm.runtime, server: `http://localhost:${PORT}`, WebSocket, getProject: () => 'blocksproj', getUser: () => 'colton' });
  const serviceName = vm.extensionManager._registerInternalExtension(ext);
  vm.extensionManager._loadedExtensions.set('cloudplug', serviceName);
  const vars = ['r_ping', 'r_load', 'r_add', 'r_rank', 'r_top', 'r_place', 'r_my', 'r_cget', 'r_list', 'r_chat', 'r_time'];
  const blocks = script([
    ['event_whenflagclicked', {}],
    ['cloudplug_raw', { REQ: 'ping' }, 'r_ping'],
    ['cloudplug_save', { KEY: 'greeting', VALUE: 'Hi There! 100% & more' }],
    ['cloudplug_load', { KEY: 'greeting' }, 'r_load'],
    ['cloudplug_addTo', { N: 5, KEY: 'plays' }, 'r_add'],
    ['cloudplug_score', { SCORE: 42, BOARD: 'hi' }, 'r_rank'],
    ['cloudplug_top', { N: 3, BOARD: 'hi' }, 'r_top'],
    ['cloudplug_topItem', { I: 1, BOARD: 'hi' }, 'r_place'],
    ['cloudplug_userSave', { KEY: 'level', VALUE: '9' }],
    ['cloudplug_userLoad', { KEY: 'level' }, 'r_my'],
    ['cloudplug_cset', { NAME: 'motd', VALUE: 'welcome' }],
    ['cloudplug_cget', { NAME: 'motd' }, 'r_cget'],
    ['cloudplug_listAdd', { ITEM: 'apple', LIST: 'fruit' }],
    ['cloudplug_listAdd', { ITEM: 'pear', LIST: 'fruit' }],
    ['cloudplug_listText', { LIST: 'fruit' }, 'r_list'],
    ['cloudplug_chat', { TEXT: 'hello world' }],
    ['cloudplug_chatlog', { N: 5 }, 'r_chat'],
    ['cloudplug_serverTime', {}, 'r_time'],
    ['data_setvariableto', { VALUE: 'done' }, null],
  ]);
  // the last block sets 'status' — patch its field
  const last = Object.values(blocks).find((b) => b.opcode === 'data_setvariableto' && b.inputs.VALUE[1] && b.inputs.VALUE[1][1] === 'done'); last.fields = { VARIABLE: ['status', 'v_status'] };
  const variables = Object.fromEntries([...vars, 'status'].map((v) => ['v_' + v, [v, '']]));
  const project = { targets: [{ isStage: true, name: 'Stage', variables, lists: {}, broadcasts: {}, blocks, comments: {}, currentCostume: 0, costumes: [{ name: 'b', dataFormat: 'svg', assetId: 'cd21514d0531fdffb22204e0ec5ed84a', md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg', rotationCenterX: 0, rotationCenterY: 0 }], sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off' }], monitors: [], extensions: ['cloudplug'], meta: { semver: '3.0.0', vm: '5.0.300', agent: 't' } };
  await vm.loadProject(JSON.stringify(project));
  vm.start(); vm.greenFlag();
  const stage = vm.runtime.getTargetForStage();
  const get = (name) => Object.values(stage.variables).find((v) => v.name === name).value;
  const t0 = Date.now();
  while (get('status') !== 'done' && Date.now() - t0 < 20000) await sleep(50);
  let fails = 0;
  const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` → got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };
  check('script finished', get('status'), 'done'); console.log(`   (${Date.now() - t0} ms for 17 cloud blocks)`);
  check('ping', get('r_ping'), 'pong');
  check('save/load', get('r_load'), 'Hi There! 100% & more');
  check('add', get('r_add'), '5');
  check('score → rank', get('r_rank'), '1');
  check('top', get('r_top'), 'colton: 42');
  check('place 1', get('r_place'), 'colton: 42');
  check('my save', get('r_my'), '9');
  check('super cloud', get('r_cget'), 'welcome');
  check('cloud list', get('r_list'), 'apple\npear');
  check('chat', get('r_chat'), 'colton: hello world');
  check('server time looks right', /^\d{13}$/.test(get('r_time')), true);
  console.log(fails ? `\n${fails} FAILED` : '\nall block tests passed');
  vm.stopAll(); srv.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
