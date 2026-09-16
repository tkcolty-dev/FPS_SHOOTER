// CloudPlug wire protocol — compatible with scratchattach's "cloud requests":
//   Scratch → server:  ☁ TO_HOST      = "<encoded request>.<request id>"   ("-" prefix = more parts follow)
//   server → Scratch:  ☁ FROM_HOST_n  = "<payload>.<request id><packet>"   packet = "0011" (part 1, more follow) … "2222" (last, encoded) / "3222" (last, plain number)
// Text is encoded as 2 digits per character using the table below (index = code). "89" (new line) separates list items.

const LETTERS = [
  null, null, null, null, null, null, null, null, null, null,
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ' ',
  'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D', 'e', 'E', 'f', 'F', 'g', 'G', 'h', 'H', 'i', 'I', 'j', 'J',
  'k', 'K', 'l', 'L', 'm', 'M', 'n', 'N', 'o', 'O', 'p', 'P', 'q', 'Q', 'r', 'R', 's', 'S', 't', 'T',
  'u', 'U', 'v', 'V', 'w', 'W', 'x', 'X', 'y', 'Y', 'z', 'Z',
  '*', '/', '.', ',', '!', '"', '§', '$', '%', '_', '-', '(', '´', ')', '`', '?', '\n', '@', '#', '~', ';', ':', '+', '&', '|', '^', "'",
];
const CODE = new Map();
LETTERS.forEach((ch, i) => { if (ch !== null) CODE.set(ch, String(i)); });
const SPACE = CODE.get(' ');
const NEWLINE = CODE.get('\n'); // "89" — list separator

function encode(text) {
  let out = '';
  for (const ch of String(text)) out += CODE.get(ch) || SPACE;
  return out;
}
function decode(digits) {
  digits = String(digits);
  let out = '';
  for (let i = 0; i + 1 < digits.length; i += 2) {
    const ch = LETTERS[Number(digits.slice(i, i + 2))];
    if (ch) out += ch;
  }
  return out;
}

const MAX_LEN = 256;

// ----- server → Scratch -----
// Turn a handler result into the list of FROM_HOST values to send, in order.
function buildResponse(requestId, output) {
  requestId = String(requestId);
  let payload;
  let validation = '2222';
  if (output === null || output === undefined) output = '';
  if (Array.isArray(output)) {
    payload = output.map((item) => encode(item) + NEWLINE).join('');
    if (!payload) payload = NEWLINE; // empty list still decodes as a list
  } else if (requestId.endsWith('0') && /^\d+$/.test(String(output))) {
    payload = String(output); // scratchattach rule: ids ending in 0 may get raw integers back (faster)
    validation = '3222';
  } else {
    payload = encode(String(output) === '' ? '-' : String(output));
  }
  const limit = MAX_LEN - (requestId.length + 6);
  const packets = [];
  let i = 0;
  while (payload.length > limit) {
    i += 1;
    packets.push(payload.slice(0, limit) + '.' + requestId + String(i).padStart(3, '0') + '1');
    payload = payload.slice(limit);
  }
  packets.push(payload + '.' + requestId + validation);
  return packets;
}

// ----- Scratch → server -----
// Build the TO_HOST values a Scratch project sends for one request (used by tests / the TurboWarp path).
function buildRequest(requestId, name, args = []) {
  requestId = String(requestId);
  const encoded = encode([name, ...args].join('&'));
  const limit = MAX_LEN - (requestId.length + 2);
  const parts = [];
  let rest = encoded;
  while (rest.length > limit) {
    parts.push('-' + rest.slice(0, limit) + '.' + requestId);
    rest = rest.slice(limit);
  }
  parts.push(rest + '.' + requestId);
  return parts;
}

// Incremental parser for TO_HOST values. Returns a completed request or null.
class RequestAssembler {
  constructor() { this.parts = new Map(); this.done = []; }
  feed(value) {
    value = String(value);
    if (!value.includes('.')) return null;
    const dot = value.lastIndexOf('.');
    let raw = value.slice(0, dot);
    const requestId = value.slice(dot + 1);
    if (!/^\d+$/.test(requestId)) return null;
    if (requestId.length === 7 && requestId.endsWith('9')) {
      return { resend: { requestId: requestId.slice(0, -1), packet: Number(raw) + 1 } };
    }
    if (raw.startsWith('-')) {
      if (!this.parts.has(requestId)) this.parts.set(requestId, []);
      this.parts.get(requestId).push(raw.slice(1));
      return null;
    }
    if (this.done.includes(requestId)) return null; // duplicate delivery
    this.done.unshift(requestId); this.done = this.done.slice(0, 40);
    if (this.parts.has(requestId)) { raw = this.parts.get(requestId).join('') + raw; this.parts.delete(requestId); }
    const text = decode(raw);
    const args = text.split('&');
    const name = args.shift();
    return { requestId, name, args, raw: value };
  }
}

// Parse one FROM_HOST value (used by the test harness that plays the Scratch side).
function parsePacket(value) {
  value = String(value);
  const dot = value.lastIndexOf('.');
  if (dot < 0) return null;
  return { payload: value.slice(0, dot), tail: value.slice(dot + 1) };
}
class ResponseAssembler {
  constructor(requestId) { this.id = String(requestId); this.parts = []; }
  feed(value) {
    const p = parsePacket(value);
    if (!p || !p.tail.startsWith(this.id)) return null;
    const rest = p.tail.slice(this.id.length);
    if (rest === '2222' || rest === '3222') {
      const all = this.parts.join('') + p.payload;
      if (rest === '3222') return { value: all, list: null };
      if (all === NEWLINE) return { value: '', list: [] };
      if (all.endsWith(NEWLINE) && all.length % 2 === 0) {
        const items = [];
        let cur = '';
        for (let i = 0; i + 1 < all.length; i += 2) {
          const code = all.slice(i, i + 2);
          if (code === NEWLINE) { items.push(cur); cur = ''; } else cur += LETTERS[Number(code)] || '';
        }
        return { value: items.join('\n'), list: items };
      }
      const text = decode(all);
      return { value: text === '-' ? '' : text, list: null };
    }
    if (rest.length === 4 && rest.endsWith('1')) { this.parts[Number(rest.slice(0, 3)) - 1] = p.payload; return null; }
    return null;
  }
}

module.exports = { LETTERS, encode, decode, buildResponse, buildRequest, RequestAssembler, ResponseAssembler, parsePacket, NEWLINE, MAX_LEN };
