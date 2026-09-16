// Runs the generated template project headlessly in scratch-vm against a live CloudPlug server,
// with a cloud provider that speaks the cloud-variable protocol to the server's room transport.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const VM = require('scratch-vm');

const PORT = 5600 + Math.floor(Math.random() * 300);
fs.rmSync(path.join(__dirname, 'tmp'), { recursive: true, force: true }); fs.mkdirSync(path.join(__dirname, 'tmp'));
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: path.join(__dirname, 'tmp') } });
srv.stderr.on('data', (d) => process.stdout.write(d));
if (process.env.VERBOSE) srv.stdout.on('data', (d) => process.stdout.write(d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await sleep(900);
  const vm = new VM();
  vm.setCompatibilityMode(false); vm.setTurboMode(false);
  await vm.loadProject(fs.readFileSync(path.join(__dirname, '..', 'public', 'CloudPlug-template.sb3')));
  const stage = vm.runtime.getTargetForStage();
  const cloudVars = Object.values(stage.variables).filter((v) => v.isCloud).map((v) => v.name);
  console.log('cloud vars:', cloudVars.length, cloudVars.includes('☁ TO_HOST') ? 'ok' : 'MISSING TO_HOST');

  // cloud provider → server room
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ method: 'handshake', user: 'vmtester', project_id: 'vmproj' }) + '\n');
  ws.on('message', (buf) => { for (const line of buf.toString().split('\n')) { if (!line.trim()) continue; const m = JSON.parse(line); if (m.method === 'set') vm.postIOData('cloud', { varUpdate: { name: m.name, value: m.value } }); } });
  const sent = [];
  vm.setCloudProvider({
    updateVariable: (name, value) => { sent.push([name, String(value)]); ws.send(JSON.stringify({ method: 'set', name, value: String(value) }) + '\n'); },
    createVariable: () => {}, renameVariable: () => {}, deleteVariable: () => {}, requestCloseConnection: () => {},
  });
  vm.start();
  vm.greenFlag();
  await sleep(300);
  const getVar = (name) => { const v = Object.values(stage.variables).find((x) => x.name === name); return v ? v.value : undefined; };
  const setVar = (name, value) => { Object.values(stage.variables).find((x) => x.name === name).value = value; };
  async function request(text, timeout = 15000) {
    setVar('plug request', text);
    vm.runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: 'cloud plug' });
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { await sleep(50); const s = getVar('plug status'); if (s === 'done' || s === 'error') break; }
    const list = getVar('plug response list');
    return { status: getVar('plug status'), value: getVar('plug response'), list: Array.isArray(list) ? list.slice() : list, ms: Date.now() - t0, error: getVar('plug error') };
  }
  let fails = 0;
  const check = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` → got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

  let r = await request('ping'); check('ping', [r.status, r.value], ['done', 'pong']); console.log(`   (${r.ms} ms)`);
  r = await request('save&greeting&Hello, World! MiXeD CaSe & 100% "quotes" (ok)'); check('save', r.value, 'saved');
  r = await request('load&greeting'); check('load exact text back', r.value, 'Hello, World! MiXeD CaSe & 100% "quotes" (ok)');
  r = await request('load&nothing'); check('load missing = empty', r.value, '');
  const long = 'Scratch cats are the best pets in the whole wide world! '.repeat(12); // ~670 chars → multi-packet both ways
  r = await request('save&long&' + long); check('save long', r.value, 'saved');
  r = await request('load&long'); check('load long (multi-packet)', r.value, long); console.log(`   (${r.ms} ms, ${long.length} chars)`);
  r = await request('add&plays&1'); check('add', r.value, '1');
  r = await request('score&hi&alice&50'); await request('score&hi&bob&90');
  r = await request('top&hi&5'); check('top as list', r.list, ['bob: 90', 'alice: 50']); check('top as text', r.value, 'bob: 90\nalice: 50');
  r = await request('listget&empty'); check('empty list', r.list, []);
  r = await request('keys'); check('keys', r.list, ['greeting', 'long', 'plays']);
  r = await request('unknownthing'); check('unknown request text', r.value, 'unknown request: unknownthing');
  // server push → "cloud plug message" broadcast
  let gotMsg = null;
  const res = await fetch(`http://localhost:${PORT}/api/projects/vmproj/push`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Hello from the dashboard!' }) });
  for (let i = 0; i < 60; i++) { await sleep(100); if (getVar('plug message')) { gotMsg = getVar('plug message'); break; } }
  check('push message received', gotMsg, 'Hello from the dashboard!');
  check('TO_HOST values ≤ 256 chars', sent.every(([n, v]) => n !== '☁ TO_HOST' || v.length <= 256), true);
  check('TO_HOST values numeric-looking', sent.every(([n, v]) => n !== '☁ TO_HOST' || /^-?\d+(\.\d+)?$/.test(v)), true);
  if (!(await spriteUploadTest())) fails++;
  console.log(fails ? `\n${fails} FAILED` : '\nall sprite tests passed');
  vm.stopAll(); ws.close(); srv.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); srv.kill(); process.exit(1); });

// ---- standalone sprite upload path: a project that already has the 10 ☁ variables gets CloudPlug.sprite3 added ----
async function spriteUploadTest() {
  const vm = new VM();
  const stageVars = {}; const names = ['☁ TO_HOST', ...Array.from({ length: 9 }, (_, i) => `☁ FROM_HOST_${i + 1}`)];
  names.forEach((n, i) => { stageVars['cv' + i] = [n, '', true]; });
  const project = { targets: [{ isStage: true, name: 'Stage', variables: stageVars, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0, costumes: [{ name: 'b', dataFormat: 'svg', assetId: 'cd21514d0531fdffb22204e0ec5ed84a', md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg', rotationCenterX: 0, rotationCenterY: 0 }], sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off' }], monitors: [], extensions: [], meta: { semver: '3.0.0', vm: '5.0.300', agent: 'test' } };
  await vm.loadProject(JSON.stringify(project));
  await vm.addSprite(fs.readFileSync(path.join(__dirname, '..', 'public', 'CloudPlug.sprite3')));
  const stage = vm.runtime.getTargetForStage();
  const sprite = vm.runtime.targets.find((t) => t.sprite && t.sprite.name === 'CloudPlug');
  const stageNames = Object.values(stage.variables).map((v) => v.name);
  const cloudCount = Object.values(stage.variables).filter((v) => v.isCloud).length;
  const globalsOk = ['plug request', 'plug response', 'plug status', 'plug message', 'plug response list'].every((n) => stageNames.includes(n));
  const dangling = Object.values(sprite.blocks._blocks).some((b) => b.fields && b.fields.VARIABLE && !stage.variables[b.fields.VARIABLE.id] && !sprite.variables[b.fields.VARIABLE.id]);
  console.log(`${cloudCount === 10 && globalsOk && !dangling ? 'PASS' : 'FAIL'} sprite3 upload links cloud vars by name (cloud=${cloudCount}) and creates shared globals on stage (${globalsOk}), dangling=${dangling}`);
  return cloudCount === 10 && globalsOk && !dangling;
}
module.exports = { spriteUploadTest };
