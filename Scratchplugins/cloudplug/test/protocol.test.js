// Plays the Scratch side over the cloud-variable protocol against a live server (room transport).
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');
const proto = require('../protocol');

const PORT = 4999 + Math.floor(Math.random() * 500);
require('fs').rmSync(path.join(__dirname, 'tmp'), { recursive: true, force: true }); require('fs').mkdirSync(path.join(__dirname, 'tmp'));
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: path.join(__dirname, 'tmp') } });
srv.stdout.on('data', (d) => process.env.VERBOSE && process.stdout.write(d));
srv.stderr.on('data', (d) => process.stdout.write(d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  await sleep(900);
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ method: 'handshake', user: 'tester', project_id: 'testproj' }) + '\n');
  const vars = {};
  const waiting = [];
  ws.on('message', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.method === 'set') { vars[m.name] = m.value; for (const w of waiting) w(m.name, m.value); }
    }
  });
  let nextId = 111111;
  async function request(name, ...args) {
    const id = String(nextId++);
    const asm = new proto.ResponseAssembler(id);
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout on ' + name)), 8000);
      waiting.push((n, v) => { if (!n.startsWith('☁ FROM_HOST_')) return; const r = asm.feed(v); if (r) { clearTimeout(timer); resolve(r); } });
    });
    for (const part of proto.buildRequest(id, name, args)) { ws.send(JSON.stringify({ method: 'set', name: '☁ TO_HOST', value: part }) + '\n'); await sleep(30); }
    return done;
  }
  let fails = 0;
  const check = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` → got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

  check('ping', (await request('ping')).value, 'pong');
  check('save', (await request('save', 'greeting', 'Hello, World! (Case Matters) 100%')).value, 'saved');
  check('load', (await request('load', 'greeting')).value, 'Hello, World! (Case Matters) 100%');
  check('load missing', (await request('load', 'nope')).value, '');
  const long = 'The quick brown fox jumps over the lazy dog. '.repeat(20);
  await request('save', 'long', long);
  check('long round trip (multi-packet both ways)', (await request('load', 'long')).value, long);
  check('add counter', (await request('add', 'plays', '1')).value, '1');
  check('add counter again', (await request('add', 'plays', '5')).value, '6');
  check('keys list', (await request('keys')).list, ['greeting', 'long', 'plays']);
  await request('score', 'hi', 'alice', '50'); await request('score', 'hi', 'bob', '80'); await request('score', 'hi', 'alice', '30');
  check('top', (await request('top', 'hi', '10')).list, ['bob: 80', 'alice: 50']);
  check('rank', (await request('rank', 'hi', 'alice')).value, '2');
  await request('listadd', 'todo', 'first'); await request('listadd', 'todo', 'second');
  check('listget', (await request('listget', 'todo')).list, ['first', 'second']);
  check('empty list', (await request('listget', 'empty')).list, []);
  await request('chat', 'alice', 'hi everyone');
  check('chatlog', (await request('chatlog', '5')).list, ['alice: hi everyone']);
  await request('usersave', 'alice', 'level', '7');
  check('userload', (await request('userload', 'alice', 'level')).value, '7');
  check('whoami (room user)', (await request('whoami')).value, 'tester');
  check('cset/cget', (await request('cset', 'motd', 'Welcome & enjoy!')).value, 'ok');
  check('cget', (await request('cget', 'motd')).value, 'Welcome & enjoy!');
  check('unknown', (await request('nothing')).value, 'unknown request: nothing');
  check('integer shortcut (id ends in 0)', (await (async () => { nextId = 222220; return request('add', 'plays', '0'); })()).value, '6');
  console.log(fails ? `\n${fails} FAILED` : '\nall protocol tests passed');
  ws.close(); srv.kill(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
