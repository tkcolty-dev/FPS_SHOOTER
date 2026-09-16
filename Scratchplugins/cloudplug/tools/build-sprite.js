// Generates the Scratch-side half of CloudPlug:
//   public/CloudPlug.sprite3          — upload into any project ("Upload Sprite")
//   public/CloudPlug-template.sb3     — a whole project with the cloud variables + demo already set up
// The sprite talks the scratchattach cloud-requests protocol (see ../protocol.js) using only normal Scratch blocks.
// Case-sensitive character lookup uses the costume trick: costume names are matched exactly by Scratch,
// so costume #N is named with the character whose code is N → `switch costume to (letter)` + `costume number` = the code.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { LETTERS } = require('../protocol');

// ---------- a tiny block builder ----------
let counter = 0;
const uid = (p = 'b') => `${p}${(++counter).toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

class Sprite {
  constructor(name) {
    this.name = name; this.blocks = {}; this.variables = {}; this.lists = {}; this.procs = {};
    this.globals = null; // set by project
  }
  // literal/expr → Scratch input array
  input(v, kind = 'text') {
    if (v && v.__block) { const id = this.emit(v, null); this.blocks[id].parent = null; return { id, arr: v.__bool ? [2, id] : [3, id, kind === 'num' ? [4, ''] : [10, '']] }; }
    if (v && v.__var) return { arr: [3, [12, v.__var, this.varId(v.__var)], [10, '']] };
    if (v && v.__list) return { arr: [3, [13, v.__list, this.listId(v.__list)], [10, '']] };
    if (v && v.__arg) { const id = uid('arg'); this.blocks[id] = { opcode: 'argument_reporter_string_number', next: null, parent: null, inputs: {}, fields: { VALUE: [v.__arg, null] }, shadow: false, topLevel: false }; return { id, arr: [3, id, [10, '']] }; }
    if (v && v.__bcast) return { arr: [1, [11, v.__bcast, this.globals.broadcastId(v.__bcast)]] };
    if (kind === 'num') return { arr: [1, [4, String(v)]] };
    return { arr: [1, [10, String(v)]] };
  }
  varId(name) { return this.variables[name] ? this.variables[name].id : this.globals.varId(name); }
  listId(name) { return this.lists[name] ? this.lists[name].id : this.globals.listId(name); }
  // emit a node (and its children) → block id
  emit(node, parent) {
    const id = uid();
    const b = { opcode: node.op, next: null, parent, inputs: {}, fields: {}, shadow: false, topLevel: false };
    this.blocks[id] = b;
    if (node.menus) for (const [k, m] of Object.entries(node.menus)) { const mid = uid('m'); this.blocks[mid] = { opcode: m.op, next: null, parent: id, inputs: {}, fields: { [m.field]: [m.value, null] }, shadow: true, topLevel: false }; b.inputs[k] = [1, mid]; }
    for (const [k, v] of Object.entries(node.inputs || {})) {
      const kind = node.numInputs && node.numInputs.includes(k) ? 'num' : 'text';
      const r = this.input(v, kind); if (r.id) this.blocks[r.id].parent = id;
      if (r.id && b.inputs[k] && b.inputs[k][0] === 1) b.inputs[k] = [3, r.id, b.inputs[k][1]]; else b.inputs[k] = r.arr;
    }
    for (const [k, v] of Object.entries(node.fields || {})) {
      if (v[1] === '__var__') b.fields[k] = [v[0], this.varId(v[0])];
      else if (v[1] === '__list__') b.fields[k] = [v[0], this.listId(v[0])];
      else if (v[1] === '__bcast__') b.fields[k] = [v[0], this.globals.broadcastId(v[0])];
      else b.fields[k] = v;
    }
    for (const [k, v] of Object.entries(node.subs || {})) { const sid = this.chain(v, id); if (sid) b.inputs[k] = [2, sid]; }
    if (node.mutation) b.mutation = node.mutation;
    return id;
  }
  chain(nodes, parent) {
    let first = null; let prev = null;
    for (const n of nodes) {
      if (!n) continue;
      const id = this.emit(n, prev || parent);
      if (prev) this.blocks[prev].next = id; else first = id;
      prev = id;
    }
    return first;
  }
  script(hat, body, x = 0, y = 0) {
    const hid = this.emit(hat, null); this.blocks[hid].topLevel = true; this.blocks[hid].x = x; this.blocks[hid].y = y;
    const first = this.chain(body, hid); if (first) this.blocks[hid].next = first;
    return hid;
  }
  // custom block definition. args: names. Returns a call() helper.
  define(name, args, body, { warp = true, x = 0, y = 0 } = {}) {
    const argIds = args.map(() => uid('a'));
    const proccode = [name, ...args.map(() => '%s')].join(' ');
    const defId = uid('def'); const protoId = uid('proto');
    this.blocks[defId] = { opcode: 'procedures_definition', next: null, parent: null, inputs: { custom_block: [1, protoId] }, fields: {}, shadow: false, topLevel: true, x, y };
    const proto = { opcode: 'procedures_prototype', next: null, parent: defId, inputs: {}, fields: {}, shadow: true, topLevel: false,
      mutation: { tagName: 'mutation', children: [], proccode, argumentids: JSON.stringify(argIds), argumentnames: JSON.stringify(args), argumentdefaults: JSON.stringify(args.map(() => '')), warp: String(warp) } };
    args.forEach((a, i) => { const aid = uid('ap'); this.blocks[aid] = { opcode: 'argument_reporter_string_number', next: null, parent: protoId, inputs: {}, fields: { VALUE: [a, null] }, shadow: true, topLevel: false }; proto.inputs[argIds[i]] = [1, aid]; });
    this.blocks[protoId] = proto;
    const first = this.chain(body, defId); if (first) this.blocks[defId].next = first;
    const call = (...vals) => ({ __block: true, op: 'procedures_call', inputs: Object.fromEntries(argIds.map((id, i) => [id, vals[i] ?? ''])), mutation: { tagName: 'mutation', children: [], proccode, argumentids: JSON.stringify(argIds), warp: String(warp) } });
    this.procs[name] = call;
    return call;
  }
  addVar(name, value = '') { this.variables[name] = { id: uid('v'), value }; }
  addList(name, value = []) { this.lists[name] = { id: uid('l'), value }; }
  toJSON(costumes, extra) {
    return {
      isStage: false, name: this.name,
      variables: Object.fromEntries(Object.values(this.variables).map((v) => [v.id, [nameOf(this.variables, v.id), v.value]])),
      lists: Object.fromEntries(Object.values(this.lists).map((v) => [v.id, [nameOf(this.lists, v.id), v.value]])),
      broadcasts: {}, blocks: this.blocks, comments: {}, currentCostume: 0, costumes, sounds: [], volume: 100, layerOrder: 1,
      visible: false, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around', ...extra,
    };
  }
}
const nameOf = (bag, id) => Object.entries(bag).find(([, v]) => v.id === id)[0];

class Globals {
  constructor() { this.vars = {}; this.lists = {}; this.broadcasts = {}; }
  varId(name, opts) { if (!this.vars[name]) this.vars[name] = { id: uid('g'), value: '', ...(opts || {}) }; return this.vars[name].id; }
  listId(name) { if (!this.lists[name]) this.lists[name] = { id: uid('gl'), value: [] }; return this.lists[name].id; }
  broadcastId(name) { if (!this.broadcasts[name]) this.broadcasts[name] = uid('bc'); return this.broadcasts[name]; }
}

// ---------- block vocabulary (just the ones we use) ----------
const V = (n) => ({ __var: n });
const L = (n) => ({ __list: n });
const A = (n) => ({ __arg: n });
const B = (n) => ({ __bcast: n });
const R = (op, inputs, fields, extra) => ({ __block: true, op, inputs, fields, ...(extra || {}) });
const BOOL = (op, inputs, fields, extra) => ({ __block: true, __bool: true, op, inputs, fields, ...(extra || {}) });
const S = (op, inputs, fields, subs, extra) => ({ op, inputs, fields, subs, ...(extra || {}) });

const join = (a, b) => R('operator_join', { STRING1: a, STRING2: b });
const join3 = (a, b, c) => join(a, join(b, c));
const letterOf = (i, s) => R('operator_letter_of', { LETTER: i, STRING: s }, null, { numInputs: ['LETTER'] });
const length = (s) => R('operator_length', { STRING: s });
const add = (a, b) => R('operator_add', { NUM1: a, NUM2: b }, null, { numInputs: ['NUM1', 'NUM2'] });
const sub = (a, b) => R('operator_subtract', { NUM1: a, NUM2: b }, null, { numInputs: ['NUM1', 'NUM2'] });
const mul = (a, b) => R('operator_multiply', { NUM1: a, NUM2: b }, null, { numInputs: ['NUM1', 'NUM2'] });
const mod = (a, b) => R('operator_mod', { NUM1: a, NUM2: b }, null, { numInputs: ['NUM1', 'NUM2'] });
const mathop = (op, n) => R('operator_mathop', { NUM: n }, { OPERATOR: [op, null] }, { numInputs: ['NUM'] });
const rand = (a, b) => R('operator_random', { FROM: a, TO: b }, null, { numInputs: ['FROM', 'TO'] });
const eq = (a, b) => BOOL('operator_equals', { OPERAND1: a, OPERAND2: b });
const lt = (a, b) => BOOL('operator_lt', { OPERAND1: a, OPERAND2: b });
const gt = (a, b) => BOOL('operator_gt', { OPERAND1: a, OPERAND2: b });
const and = (a, b) => BOOL('operator_and', { OPERAND1: a, OPERAND2: b });
const or = (a, b) => BOOL('operator_or', { OPERAND1: a, OPERAND2: b });
const not = (a) => BOOL('operator_not', { OPERAND: a });
const contains = (s, t) => BOOL('operator_contains', { STRING1: s, STRING2: t });
const timer = () => R('sensing_timer', {});
const costumeNumber = () => R('looks_costumenumbername', {}, { NUMBER_NAME: ['number', null] });
const item = (i, list) => R('data_itemoflist', { INDEX: i }, { LIST: [list, '__list__'] }, { numInputs: ['INDEX'] });
const listLen = (list) => R('data_lengthoflist', {}, { LIST: [list, '__list__'] });
const itemNum = (thing, list) => R('data_itemnumoflist', { ITEM: thing }, { LIST: [list, '__list__'] });

const setVar = (n, v) => S('data_setvariableto', { VALUE: v }, { VARIABLE: [n, '__var__'] });
const changeVar = (n, v) => S('data_changevariableby', { VALUE: v }, { VARIABLE: [n, '__var__'] }, null, { numInputs: ['VALUE'] });
const addToList = (v, list) => S('data_addtolist', { ITEM: v }, { LIST: [list, '__list__'] });
const deleteAll = (list) => S('data_deletealloflist', {}, { LIST: [list, '__list__'] });
const replaceItem = (i, list, v) => S('data_replaceitemoflist', { INDEX: i, ITEM: v }, { LIST: [list, '__list__'] }, null, { numInputs: ['INDEX'] });
const ifThen = (cond, body) => S('control_if', { CONDITION: cond }, {}, { SUBSTACK: body });
const ifElse = (cond, a, b) => S('control_if_else', { CONDITION: cond }, {}, { SUBSTACK: a, SUBSTACK2: b });
const repeat = (n, body) => S('control_repeat', { TIMES: n }, {}, { SUBSTACK: body }, { numInputs: ['TIMES'] });
const repeatUntil = (cond, body) => S('control_repeat_until', { CONDITION: cond }, {}, { SUBSTACK: body });
const forever = (body) => S('control_forever', {}, {}, { SUBSTACK: body });
const wait = (secs) => S('control_wait', { DURATION: secs }, null, null, { numInputs: ['DURATION'] });
const waitUntil = (cond) => S('control_wait_until', { CONDITION: cond });
const switchCostume = (v) => (v && v.__block ? S('looks_switchcostumeto', { COSTUME: v }, {}, {}, { menus: { COSTUME: { op: 'looks_costume', field: 'COSTUME', value: ' ' } } }) : S('looks_switchcostumeto', {}, {}, {}, { menus: { COSTUME: { op: 'looks_costume', field: 'COSTUME', value: String(v) } } }));
const broadcast = (name) => S('event_broadcast', { BROADCAST_INPUT: B(name) });
const broadcastWait = (name) => S('event_broadcastandwait', { BROADCAST_INPUT: B(name) });
const resetTimer = () => S('sensing_resettimer', {});
const say = (v) => S('looks_say', { MESSAGE: v });
const hide = () => S('looks_hide', {});
const whenFlag = () => S('event_whenflagclicked', {});
const whenReceive = (name) => S('event_whenbroadcastreceived', {}, { BROADCAST_OPTION: [name, '__bcast__'] });
const whenKey = (key) => S('event_whenkeypressed', {}, { KEY_OPTION: [key, null] });

// ---------- the CloudPlug sprite ----------
function buildCloudPlugSprite(globals) {
  const sp = new Sprite('CloudPlug'); sp.globals = globals;
  // global (stage) variables players and other sprites use
  for (const n of ['plug request', 'plug response', 'plug status', 'plug message', 'plug error']) globals.varId(n);
  globals.listId('plug response list');
  // cloud variables (stage)
  globals.varId('☁ TO_HOST', { cloud: true }); for (let i = 1; i <= 9; i++) globals.varId(`☁ FROM_HOST_${i}`, { cloud: true });
  // sprite-local scratch space
  for (const n of ['_i', '_id', '_id_waiting', '_save', '_encoded', '_part', '_limit', '_char', '_code', '_tail', '_iter', '_n', '_value', '_item', '_text', '_kind', '_pushed']) sp.addVar(n);
  sp.addList('_charset', LETTERS.slice(10)); // item k = character with code k+9  → item (code - 9)
  sp.addList('_seen', Array(9).fill(''));
  sp.addList('_parts', []);

  const fromHost = (i) => V(`☁ FROM_HOST_${i}`);
  const setBcastMsg = (v) => setVar('plug message', v);

  // ---- encode (text) → _encoded  (warp) ----
  sp.define('encode', ['text'], [
    setVar('_encoded', ''), setVar('_i', 1),
    repeat(length(A('text')), [
      switchCostume(' '), // fallback for characters we don't know
      switchCostume(letterOf(V('_i'), A('text'))),
      setVar('_encoded', join(V('_encoded'), costumeNumber())),
      changeVar('_i', 1),
    ]),
  ], { x: 0, y: 0 });

  // ---- decode (digits) → plug response + plug response list  (warp) ----
  sp.define('decode', ['digits'], [
    setVar('_text', ''), setVar('_item', ''), deleteAll('plug response list'), setVar('_kind', 'text'), setVar('_i', 1),
    repeat(mathop('floor', mul(length(A('digits')), 0.5)), [
      setVar('_code', join(letterOf(V('_i'), A('digits')), letterOf(add(V('_i'), 1), A('digits')))),
      ifElse(eq(V('_code'), 89), [
        addToList(V('_item'), 'plug response list'), setVar('_kind', 'list'), setVar('_item', ''),
      ], [
        setVar('_char', item(sub(V('_code'), 9), '_charset')),
        setVar('_item', join(V('_item'), V('_char'))),
      ]),
      changeVar('_i', 2),
    ]),
    ifElse(eq(V('_kind'), 'list'), [
      // a list: response text = items joined with new lines
      setVar('_text', ''), setVar('_i', 1),
      repeat(listLen('plug response list'), [
        ifElse(eq(V('_i'), 1), [setVar('_text', item(1, 'plug response list'))], [setVar('_text', join3(V('_text'), '\n', item(V('_i'), 'plug response list')))]),
        changeVar('_i', 1),
      ]),
      ifThen(and(eq(listLen('plug response list'), 1), eq(length(item(1, 'plug response list')), 0)), [deleteAll('plug response list')]),
      setVar('plug response', V('_text')),
    ], [
      ifElse(eq(V('_item'), '-'), [setVar('plug response', '')], [setVar('plug response', V('_item'))]),
      addToList(V('plug response'), 'plug response list'),
    ]),
  ], { x: 600, y: 0 });

  // ---- handle one FROM_HOST value (warp) ----
  // value = payload.<id><packet>;  packet: 3 digits + "1" (more coming) | 2222 (last) | 3222 (last, plain number)
  sp.define('handle packet', ['value'], [
    setVar('_i', length(A('value'))),
    repeatUntil(or(eq(letterOf(V('_i'), A('value')), '.'), lt(V('_i'), 1)), [changeVar('_i', -1)]),
    ifThen(gt(V('_i'), 0), [
      setVar('_tail', ''), setVar('_n', add(V('_i'), 1)),
      repeat(sub(length(A('value')), V('_i')), [setVar('_tail', join(V('_tail'), letterOf(V('_n'), A('value')))), changeVar('_n', 1)]),
      // _id = tail minus last 4 chars; _iter = last 4 chars
      setVar('_id', ''), setVar('_n', 1),
      repeat(sub(length(V('_tail')), 4), [setVar('_id', join(V('_id'), letterOf(V('_n'), V('_tail')))), changeVar('_n', 1)]),
      setVar('_iter', ''),
      repeat(4, [setVar('_iter', join(V('_iter'), letterOf(V('_n'), V('_tail')))), changeVar('_n', 1)]),
      // payload = value before the dot
      setVar('_value', ''), setVar('_n', 1),
      repeat(sub(V('_i'), 1), [setVar('_value', join(V('_value'), letterOf(V('_n'), A('value')))), changeVar('_n', 1)]),
      ifThen(or(eq(V('_id'), V('_id_waiting')), eq(letterOf(1, V('_id')), '1')), [
        setVar('_pushed', '0'),
        ifThen(and(eq(length(V('_id')), 13), eq(letterOf(1, V('_id')), '1')), [setVar('_pushed', '1')]),
        ifThen(or(eq(V('_pushed'), '1'), eq(V('_id'), V('_id_waiting'))), [
          ifElse(or(eq(V('_iter'), '2222'), eq(V('_iter'), '3222')), [
            // final packet: glue stored parts + this payload
            setVar('_text', ''), setVar('_n', 1),
            repeat(listLen('_parts'), [setVar('_text', join(V('_text'), item(V('_n'), '_parts'))), changeVar('_n', 1)]),
            setVar('_text', join(V('_text'), V('_value'))), deleteAll('_parts'),
            ifElse(eq(V('_pushed'), '1'), [
              ifElse(eq(V('_iter'), '3222'), [setBcastMsg(V('_text'))], [
                setVar('_save', V('plug response')), sp.procs.decode(V('_text')), setBcastMsg(V('plug response')), setVar('plug response', V('_save')),
              ]),
              broadcast('cloud plug message'),
            ], [
              ifElse(eq(V('_iter'), '3222'), [setVar('plug response', V('_text')), deleteAll('plug response list'), addToList(V('_text'), 'plug response list')], [sp.procs.decode(V('_text'))]),
              setVar('plug status', 'done'),
            ]),
          ], [
            // a middle packet: "NNN1" → store as part NNN
            setVar('_n', join3(letterOf(1, V('_iter')), letterOf(2, V('_iter')), letterOf(3, V('_iter')))),
            repeatUntil(not(lt(listLen('_parts'), V('_n'))), [addToList('', '_parts')]),
            replaceItem(V('_n'), '_parts', V('_value')),
          ]),
        ]),
      ]),
    ]),
  ], { x: 1200, y: 0 });

  // ---- receiver loop: watch the 9 FROM_HOST variables ----
  const checkVar = (i) => ifThen(not(eq(fromHost(i), item(i, '_seen'))), [replaceItem(i, '_seen', fromHost(i)), sp.procs['handle packet'](fromHost(i))]);
  sp.script(whenFlag(), [
    hide(), setVar('plug status', 'idle'), setVar('plug error', ''), setVar('_id_waiting', '-'),
    deleteAll('_seen'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => addToList(fromHost(i), '_seen')),
    forever([1, 2, 3, 4, 5, 6, 7, 8, 9].map(checkVar)),
  ], 0, 900);

  // ---- send request (text): the main block. Non-warp so it can wait. ----
  sp.define('send request', ['request'], [
    setVar('plug status', 'sending'), setVar('plug error', ''), setVar('plug response', ''), deleteAll('plug response list'), deleteAll('_parts'),
    setVar('_id', join(rand(1, 9), join(rand(0, 9), join(rand(0, 9), join(rand(0, 9), join(rand(0, 9), rand(1, 9))))))), // 6 digits, never ends in 0 (always encoded reply)
    sp.procs.encode(A('request')),
    setVar('_limit', sub(256, add(length(V('_id')), 2))),
    setVar('_id_waiting', V('_id')),
    // split into parts of _limit digits; all but the last get a "-" in front
    repeatUntil(not(gt(length(V('_encoded')), V('_limit'))), [
      setVar('_part', ''), setVar('_i', 1),
      repeat(V('_limit'), [setVar('_part', join(V('_part'), letterOf(V('_i'), V('_encoded')))), changeVar('_i', 1)]),
      setVar('_text', ''),
      repeat(sub(length(V('_encoded')), V('_limit')), [setVar('_text', join(V('_text'), letterOf(V('_i'), V('_encoded')))), changeVar('_i', 1)]),
      setVar('_encoded', V('_text')),
      setVar('☁ TO_HOST', join3('-', V('_part'), join('.', V('_id')))),
      wait(0.1),
    ]),
    setVar('☁ TO_HOST', join(V('_encoded'), join('.', V('_id')))),
    setVar('plug status', 'waiting'), resetTimer(),
    waitUntil(or(eq(V('plug status'), 'done'), gt(timer(), 12))),
    ifThen(not(eq(V('plug status'), 'done')), [setVar('plug status', 'error'), setVar('plug error', 'no reply from the server (is CloudPlug running for this project?)')]),
    setVar('_id_waiting', '-'),
  ], { warp: false, x: 0, y: 1400 });

  // ---- friendly wrappers (each builds a request string) ----
  const req = (...parts) => parts.reduce((acc, p) => (acc === null ? p : join3(acc, '&', p)), null);
  const wrap = (name, args, ...parts) => sp.define(name, args, [sp.procs['send request'](req(...parts))], { warp: false });
  let y = 2200;
  const W = (name, args, ...parts) => { const c = wrap(name, args, ...parts); const def = Object.values(sp.blocks).find((b) => b.opcode === 'procedures_definition' && sp.blocks[b.inputs.custom_block[1]].mutation.proccode.startsWith(name + ' ')); if (def) { def.x = 0; def.y = y; y += 160; } return c; };
  W('cloud save', ['key', 'value'], 'save', A('key'), A('value'));
  W('cloud load', ['key'], 'load', A('key'));
  W('cloud add', ['amount', 'key'], 'add', A('key'), A('amount'));
  W('save for player', ['player', 'key', 'value'], 'usersave', A('player'), A('key'), A('value'));
  W('load for player', ['player', 'key'], 'userload', A('player'), A('key'));
  W('submit score', ['score', 'player', 'board'], 'score', A('board'), A('player'), A('score'));
  W('get top', ['n', 'board'], 'top', A('board'), A('n'));
  W('cloud list add', ['item', 'list'], 'listadd', A('list'), A('item'));
  W('cloud list get', ['list'], 'listget', A('list'));
  W('super cloud set', ['name', 'value'], 'cset', A('name'), A('value'));
  W('super cloud get', ['name'], 'cget', A('name'));
  W('chat send', ['player', 'text'], 'chat', A('player'), A('text'));
  W('chat get last', ['n'], 'chatlog', A('n'));
  W('fetch web', ['url'], 'fetch', A('url'));
  W('ask ai', ['question'], 'ai', A('question'));

  // ---- broadcast entry point: any sprite sets `plug request` then broadcasts "cloud plug" (and wait) ----
  sp.script(whenReceive('cloud plug'), [sp.procs['send request'](V('plug request'))], 600, 900);
  globals.broadcastId('cloud plug'); globals.broadcastId('cloud plug message');
  return sp;
}

// ---------- demo sprite for the template ----------
function buildDemoSprite(globals) {
  const sp = new Sprite('Demo'); sp.globals = globals;
  sp.script(whenFlag(), [
    say('Press SPACE to test CloudPlug. Press 1 to save, 2 to load, 3 for the leaderboard, 4 to ask the AI.'),
  ], 0, 0);
  const run = (request, sayWhat) => [setVar('plug request', request), broadcastWait('cloud plug'), say(sayWhat || V('plug response'))];
  sp.script(whenKey('space'), [say('pinging the server…'), ...run('ping', join('server says: ', V('plug response')))], 0, 250);
  sp.script(whenKey('1'), [...run(join('save&favorite&', join(R('sensing_username', {}), ' was here!')), join('saved! server says: ', V('plug response')))], 0, 450);
  sp.script(whenKey('2'), [...run('load&favorite', join('loaded: ', V('plug response')))], 0, 650);
  sp.script(whenKey('3'), [
    ...run(join3('score&demo board&', R('sensing_username', {}), join('&', rand(1, 100))), join('your rank: ', V('plug response'))),
    wait(2), ...run('top&demo board&5', join('top 5: ', V('plug response'))),
  ], 0, 850);
  sp.script(whenKey('4'), [say('asking the AI…'), ...run('ai&tell me a fun fact about cats in one sentence')]);
  sp.script(whenReceive('cloud plug message'), [say(join('📣 ', V('plug message')))], 0, 1250);
  return sp;
}

// ---------- assets ----------
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72"><path d="M28 56h44a16 16 0 0 0 2-31.9A22 22 0 0 0 32 20a14 14 0 0 0-4 36z" fill="#4c97ff" stroke="#2f5fae" stroke-width="3" stroke-linejoin="round"/><rect x="40" y="36" width="16" height="16" rx="3" fill="#fff"/><rect x="43" y="28" width="3" height="10" fill="#fff"/><rect x="50" y="28" width="3" height="10" fill="#fff"/></svg>`;
const DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4"><circle cx="2" cy="2" r="1" fill="#4c97ff"/></svg>`;
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const BACKDROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#f0f6ff"/><text x="240" y="60" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="bold" text-anchor="middle" fill="#4c97ff">☁🔌 CloudPlug</text><text x="240" y="100" font-family="Helvetica, Arial, sans-serif" font-size="15" text-anchor="middle" fill="#3b5f8a">your game, plugged into the cloud</text></svg>`;

function costumesFor() {
  // costume #N is named with the character whose code is N (codes 10..99); costumes 1-9 are fillers.
  const logo = { name: 'CloudPlug', dataFormat: 'svg', assetId: md5(LOGO_SVG), md5ext: md5(LOGO_SVG) + '.svg', rotationCenterX: 48, rotationCenterY: 36 };
  const dot = (name) => ({ name, dataFormat: 'svg', assetId: md5(DOT_SVG), md5ext: md5(DOT_SVG) + '.svg', rotationCenterX: 2, rotationCenterY: 2 });
  const list = [logo];
  for (let i = 2; i <= 9; i++) list.push(dot(`(${i})`));
  for (let code = 10; code <= 99; code++) list.push(dot(LETTERS[code]));
  return list;
}

function stageJSON(globals) {
  const variables = {}; const lists = {};
  for (const [name, v] of Object.entries(globals.vars)) variables[v.id] = v.cloud ? [name, v.value, true] : [name, v.value];
  for (const [name, l] of Object.entries(globals.lists)) lists[l.id] = [name, l.value];
  return {
    isStage: true, name: 'Stage', variables, lists,
    broadcasts: Object.fromEntries(Object.entries(globals.broadcasts).map(([n, id]) => [id, n])),
    blocks: {}, comments: {}, currentCostume: 0,
    costumes: [{ name: 'backdrop1', dataFormat: 'svg', assetId: md5(BACKDROP_SVG), md5ext: md5(BACKDROP_SVG) + '.svg', rotationCenterX: 240, rotationCenterY: 180 }],
    sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off', textToSpeechLanguage: null,
  };
}

async function build() {
  const outDir = path.join(__dirname, '..', 'public');
  const meta = { semver: '3.0.0', vm: '5.0.300', agent: 'CloudPlug builder' };

  // --- sprite3 ---
  {
    counter = 0;
    const globals = new Globals();
    const sp = buildCloudPlugSprite(globals);
    // a sprite3 carries the stage variables it references as its own entries so Scratch links them by NAME on upload
    // (Scratch merges references to missing variables with same-named globals — so create ☁ TO_HOST / ☁ FROM_HOST_1..9 first).
    const json = sp.toJSON(costumesFor(), {});
    // shared variables (plug request/response/…) are left OUT on purpose: Scratch then creates them as stage
    // globals on upload, and links ☁ TO_HOST / ☁ FROM_HOST_n to the stage's cloud variables by name.
    const zip = new JSZip();
    zip.file('sprite.json', JSON.stringify(json));
    zip.file(md5(LOGO_SVG) + '.svg', LOGO_SVG); zip.file(md5(DOT_SVG) + '.svg', DOT_SVG);
    fs.writeFileSync(path.join(outDir, 'CloudPlug.sprite3'), await zip.generateAsync({ type: 'nodebuffer' }));
  }
  // --- template sb3 ---
  {
    counter = 0;
    const globals = new Globals();
    const plug = buildCloudPlugSprite(globals);
    const demo = buildDemoSprite(globals);
    const project = { targets: [stageJSON(globals), plug.toJSON(costumesFor(), { layerOrder: 1 }), demo.toJSON([{ name: 'CloudPlug', dataFormat: 'svg', assetId: md5(LOGO_SVG), md5ext: md5(LOGO_SVG) + '.svg', rotationCenterX: 48, rotationCenterY: 36 }], { visible: true, layerOrder: 2, x: 0, y: -40, size: 150 })], monitors: [], extensions: [], meta };
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(project));
    zip.file(md5(LOGO_SVG) + '.svg', LOGO_SVG); zip.file(md5(DOT_SVG) + '.svg', DOT_SVG); zip.file(md5(BACKDROP_SVG) + '.svg', BACKDROP_SVG);
    fs.writeFileSync(path.join(outDir, 'CloudPlug-template.sb3'), await zip.generateAsync({ type: 'nodebuffer' }));
    fs.writeFileSync(path.join(__dirname, '..', 'test', 'tmp-project.json'), JSON.stringify(project, null, 1));
  }
  console.log('built public/CloudPlug.sprite3 and public/CloudPlug-template.sb3');
}
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });
module.exports = { build };
