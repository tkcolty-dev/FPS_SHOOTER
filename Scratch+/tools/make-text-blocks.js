// Generates public/CloudLift-Text-Blocks.sb3 — a real Scratch project with
// custom blocks that encode text into numbers (cloud-safe) and back.
// Encoding: each character -> 2 digits (position in alphabet + 10, unknown = 99).
// Must match ALPHA in public/index.html exactly.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ' +
  '.,!?\'"()+-*/=<>:;@#%&_~^$[';
if (ALPHA.length !== 89) throw new Error('alphabet must be 89 chars, got ' + ALPHA.length);

const VARS = {
  encoded: 'v_encoded', decoded: 'v_decoded', i: 'v_i', code: 'v_code',
};
const LIST = ['CL chars', 'l_chars'];

let n = 0;
const blocks = {};
function B(opcode, extra) {
  const id = 'b' + (++n);
  blocks[id] = { opcode, next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false, ...extra };
  return id;
}
function chain(ids) {
  for (let i = 0; i < ids.length - 1; i++) {
    blocks[ids[i]].next = ids[i + 1];
    blocks[ids[i + 1]].parent = ids[i];
  }
  return ids[0];
}
const txt = (s) => [1, [10, String(s)]];
const num = (v) => [1, [4, String(v)]];
const ref = (id) => [3, id, [10, '']];       // reporter plugged into a slot
const boolref = (id) => [2, id];
const stack = (id) => [2, id];
const varRef = (name) => [3, [12, name, VARS[name]], [10, '']];

const setVar = (name, input) => B('data_setvariableto', { inputs: { VALUE: input }, fields: { VARIABLE: [name, VARS[name]] } });
const changeVar = (name, input) => B('data_changevariableby', { inputs: { VALUE: input }, fields: { VARIABLE: [name, VARS[name]] } });
const join = (a, b) => B('operator_join', { inputs: { STRING1: a, STRING2: b } });
const letterOf = (idx, str) => B('operator_letter_of', { inputs: { LETTER: idx, STRING: str } });
const lengthOf = (str) => B('operator_length', { inputs: { STRING: str } });
const add = (a, b) => B('operator_add', { inputs: { NUM1: a, NUM2: b } });
const sub = (a, b) => B('operator_subtract', { inputs: { NUM1: a, NUM2: b } });
const div = (a, b) => B('operator_divide', { inputs: { NUM1: a, NUM2: b } });
const equals = (a, b) => B('operator_equals', { inputs: { OPERAND1: a, OPERAND2: b } });
const lessThan = (a, b) => B('operator_lt', { inputs: { OPERAND1: a, OPERAND2: b } });
const repeat = (times, first) => B('control_repeat', { inputs: { TIMES: times, SUBSTACK: stack(first) } });
const ifThen = (cond, first) => B('control_if', { inputs: { CONDITION: boolref(cond), SUBSTACK: stack(first) } });
const argT = (name) => B('argument_reporter_string_number', { fields: { VALUE: [name, null] } });

function defineProc(proccode, argName, argId, x, y) {
  const def = B('procedures_definition', { topLevel: true, x, y });
  const arg = B('argument_reporter_string_number', { shadow: true, fields: { VALUE: [argName, null] } });
  const proto = B('procedures_prototype', {
    shadow: true, parent: def,
    inputs: argName ? { [argId]: [1, arg] } : {},
    mutation: {
      tagName: 'mutation', children: [],
      proccode, warp: 'true',
      argumentids: JSON.stringify(argName ? [argId] : []),
      argumentnames: JSON.stringify(argName ? [argName] : []),
      argumentdefaults: JSON.stringify(argName ? [''] : []),
    },
  });
  blocks[arg].parent = proto;
  blocks[def].inputs.custom_block = [1, proto];
  return def;
}
function callProc(proccode, argId, input) {
  return B('procedures_call', {
    inputs: argId ? { [argId]: input } : {},
    mutation: {
      tagName: 'mutation', children: [], proccode, warp: 'true',
      argumentids: JSON.stringify(argId ? [argId] : []),
    },
  });
}
function attachBody(defId, firstBodyId) {
  blocks[defId].next = firstBodyId;
  blocks[firstBodyId].parent = defId;
}

/* ---- CL setup: rebuild the character list (survives dragging into your game) ---- */
const setupDef = defineProc('CL setup', null, null, 40, 40);
{
  const del = B('data_deletealloflist', { fields: { LIST } });
  const s1 = setVar('i', num(1));
  const addCh = B('data_addtolist', { inputs: { ITEM: ref(letterOf(varRef('i'), txt(ALPHA))) }, fields: { LIST } });
  const inc = changeVar('i', num(1));
  const loop = repeat(num(89), chain([addCh, inc]));
  const addQ = B('data_addtolist', { inputs: { ITEM: txt('?') }, fields: { LIST } });
  attachBody(setupDef, chain([del, s1, loop, addQ]));
}
const ensureSetup = () =>
  ifThen(lessThan(ref(B('data_lengthoflist', { fields: { LIST } })), num(90)), callProc('CL setup', null, null));

/* ---- CL encode [TEXT] -> sets "encoded" ---- */
const encDef = defineProc('CL encode %s', 'TEXT', 'argT', 40, 320);
{
  const guard = ensureSetup();
  const s1 = setVar('encoded', txt(''));
  const s2 = setVar('i', num(1));
  const itemNum = B('data_itemnumoflist', { inputs: { ITEM: ref(letterOf(varRef('i'), ref(argT('TEXT')))) }, fields: { LIST } });
  const s3 = setVar('code', ref(add(ref(itemNum), num(9))));
  const fix = ifThen(equals(varRef('code'), num(9)), setVar('code', num(99)));
  const s4 = setVar('encoded', ref(join(varRef('encoded'), varRef('code'))));
  const s5 = changeVar('i', num(1));
  const loop = repeat(ref(lengthOf(ref(argT('TEXT')))), chain([s3, fix, s4, s5]));
  attachBody(encDef, chain([guard, s1, s2, loop]));
}

/* ---- CL decode [CODE] -> sets "decoded" ---- */
const decDef = defineProc('CL decode %s', 'CODE', 'argC');
blocks[decDef].x = 40; blocks[decDef].y = 760;
{
  const guard = ensureSetup();
  const s1 = setVar('decoded', txt(''));
  const s2 = setVar('i', num(1));
  const pair = join(ref(letterOf(varRef('i'), ref(argT('CODE')))), ref(letterOf(ref(add(varRef('i'), num(1))), ref(argT('CODE')))));
  const s3 = setVar('code', ref(pair));
  const item = B('data_itemoflist', { inputs: { INDEX: ref(sub(varRef('code'), num(9))) }, fields: { LIST } });
  const s4 = setVar('decoded', ref(join(varRef('decoded'), ref(item))));
  const s5 = changeVar('i', num(2));
  const loop = repeat(ref(div(ref(lengthOf(ref(argT('CODE')))), num(2))), chain([s3, s4, s5]));
  attachBody(decDef, chain([guard, s1, s2, loop]));
}

/* ---- demo: green flag shows it working ---- */
{
  const flag = B('event_whenflagclicked', { topLevel: true, x: 480, y: 40 });
  const c1 = callProc('CL encode %s', 'argT', txt('hello scratch!'));
  const say1 = B('looks_sayforsecs', { inputs: { MESSAGE: ref(join(txt('encoded: '), varRef('encoded'))), SECS: num(2) } });
  const c2 = callProc('CL decode %s', 'argC', varRef('encoded'));
  const say2 = B('looks_sayforsecs', { inputs: { MESSAGE: ref(join(txt('decoded: '), varRef('decoded'))), SECS: num(2) } });
  chain([flag, c1, say1, c2, say2]);
}

/* ---- assets + project.json ---- */
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
  '<circle cx="24" cy="24" r="20" fill="#4dd8ff"/><text x="24" y="31" font-size="20" text-anchor="middle" font-family="sans-serif" fill="#0b1b33">Aa</text></svg>';
const md5 = crypto.createHash('md5').update(svg).digest('hex');
const costume = { name: 'icon', dataFormat: 'svg', assetId: md5, md5ext: md5 + '.svg', rotationCenterX: 24, rotationCenterY: 24 };

const project = {
  targets: [
    {
      isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
      currentCostume: 0, costumes: [{ ...costume, name: 'backdrop' }], sounds: [], volume: 100,
      layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off', textToSpeechLanguage: null,
    },
    {
      isStage: false, name: 'CloudLift Text Blocks',
      variables: {
        [VARS.encoded]: ['encoded', ''], [VARS.decoded]: ['decoded', ''],
        [VARS.i]: ['CL i', 0], [VARS.code]: ['CL code', 0],
      },
      lists: { [LIST[1]]: [LIST[0], []] },
      broadcasts: {}, blocks, comments: {},
      currentCostume: 0, costumes: [costume], sounds: [], volume: 100,
      layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around',
    },
  ],
  monitors: [], extensions: [],
  meta: { semver: '3.0.0', vm: '2.3.0', agent: 'CloudLift' },
};

// fix: fields LIST needs fresh arrays (shared const is fine in JSON but be safe)
const out = path.join(__dirname, 'build');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'project.json'), JSON.stringify(project));
fs.writeFileSync(path.join(out, md5 + '.svg'), svg);
const target = path.join(__dirname, '..', 'public', 'CloudLift-Text-Blocks.sb3');
fs.rmSync(target, { force: true });
execSync(`cd ${JSON.stringify(out)} && zip -X -q ${JSON.stringify(target)} project.json ${md5}.svg`);
console.log('wrote', target, fs.statSync(target).size, 'bytes,', Object.keys(blocks).length, 'blocks');
