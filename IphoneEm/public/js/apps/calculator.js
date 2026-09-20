/* Calculator — iOS portrait calculator (Basic + Scientific). Always dark. */
(function () {
  'use strict';

  /* ───────────────────────── pure engine (unit-testable under node) ───────────────────────── */

  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, pow: 3, root: 3 };
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', pow: '^', root: '√' };
  const MAX_DIGITS = 9;

  function r12(x) {
    if (!isFinite(x) || x === 0) return x;
    return parseFloat(x.toPrecision(12));
  }
  function applyOp(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      case 'pow': return Math.pow(a, b);
      case 'root': return b === 0 ? NaN : (a < 0 && Math.abs(b % 2) === 1 ? -Math.pow(-a, 1 / b) : Math.pow(a, 1 / b));
    }
    return b;
  }
  function gamma(z) {                       // Lanczos, for non-integer factorials
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function factorial(n) {
    if (n < 0 && Number.isInteger(n)) return NaN;
    if (Number.isInteger(n)) { if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
    return gamma(n + 1);
  }

  function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function formatEntry(entry) {
    let mant = entry, exp = null;
    const ei = entry.indexOf('e');
    if (ei >= 0) { mant = entry.slice(0, ei); exp = entry.slice(ei + 1); }
    let neg = false;
    if (mant[0] === '-') { neg = true; mant = mant.slice(1); }
    const di = mant.indexOf('.');
    let out = di >= 0 ? group(mant.slice(0, di)) + '.' + mant.slice(di + 1) : group(mant);
    if (neg) out = '-' + out;
    if (exp !== null) out += 'e' + exp;
    return out;
  }

  function formatSci(v) {
    let parts = v.toExponential(5).split('e');
    let m = parts[0];
    if (m.indexOf('.') >= 0) m = m.replace(/0+$/, '').replace(/\.$/, '');
    return m + 'e' + parts[1].replace('+', '');
  }

  function formatNumber(v) {
    if (typeof v !== 'number' || !isFinite(v)) return 'Error';
    if (v === 0) return '0';
    const abs = Math.abs(v);
    if (abs >= 1e9 || abs < 1e-8) return formatSci(v);
    const intDigits = abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1;
    let s = v.toFixed(Math.max(0, MAX_DIGITS - intDigits));
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0' || s === '0') return formatSci(v);
    const neg = s[0] === '-';
    if (neg) s = s.slice(1);
    const di = s.indexOf('.');
    const ip = di >= 0 ? s.slice(0, di) : s;
    if (ip.length > MAX_DIGITS) return formatSci(v);
    return (neg ? '-' : '') + group(ip) + (di >= 0 ? s.slice(di) : '');
  }

  function createEngine(init) {
    const S = Object.assign({
      entry: null,          // string being typed, or null when showing a computed value
      value: 0,             // computed value shown when entry === null
      stack: [],            // pending [{val, op}] / [{paren:true}] — precedence-ascending inside each paren level
      awaiting: false,      // an operator was just pressed; next digit starts a new operand
      repeat: null,         // {op, operand} for repeated "="
      error: false,
      justEq: false,
      cleared: false,
      fromParen: false,
      expr: [],
      lastExpr: '',
      deg: true,
    }, init || {});

    const top = () => S.stack[S.stack.length - 1];
    const current = () => (S.entry !== null ? parseFloat(S.entry) || 0 : S.value);
    const digitsIn = (s) => s.replace(/[^0-9]/g, '').length;

    function fail() { S.error = true; S.entry = null; S.value = 0; S.stack = []; S.awaiting = false; S.repeat = null; S.expr = []; S.fromParen = false; }
    function setValue(v) {
      v = r12(v);
      if (typeof v !== 'number' || !isFinite(v)) { fail(); return false; }
      S.value = v === 0 ? 0 : v; S.entry = null; return true;
    }
    function reduceWhile(cur, minPrec) {
      while (S.stack.length) {
        const t = top();
        if (t.paren || PREC[t.op] < minPrec) break;
        cur = r12(applyOp(t.op, t.val, cur));
        S.stack.pop();
      }
      return cur;
    }
    const minPrecFor = (op) => (PREC[op] === 3 ? 4 : PREC[op]);      // powers are right-associative

    function allClear() {
      const deg = S.deg;
      Object.assign(S, { entry: null, value: 0, stack: [], awaiting: false, repeat: null, error: false, justEq: false, cleared: false, fromParen: false, expr: [], lastExpr: '', deg });
    }
    function clearEntry() {
      S.entry = null; S.value = 0; S.cleared = true; S.fromParen = false;
      S.awaiting = S.stack.length > 0 && !top().paren;
    }

    function digit(d) {
      if (S.error) allClear();
      if (S.entry === null || S.justEq) {
        if (S.justEq) { S.repeat = null; S.lastExpr = ''; }
        if (S.fromParen) { S.fromParen = false; if (S.expr.length && S.expr[S.expr.length - 1] === ')') S.expr = []; }
        S.entry = d; S.awaiting = false; S.justEq = false; S.cleared = false;
        return;
      }
      S.cleared = false;
      const ei = S.entry.indexOf('e');
      if (ei >= 0) {                                   // typing the exponent after EE
        const ex = S.entry.slice(ei + 1).replace('-', '');
        if (ex.length >= 3) return;
        S.entry = ex === '0' ? S.entry.slice(0, -1) + d : S.entry + d;
        return;
      }
      if (S.entry === '0') { S.entry = d; return; }
      if (S.entry === '-0') { S.entry = '-' + d; return; }
      if (digitsIn(S.entry) >= MAX_DIGITS) return;
      S.entry += d;
    }
    function decimal() {
      if (S.error) allClear();
      if (S.entry === null || S.justEq) {
        if (S.justEq) { S.repeat = null; S.lastExpr = ''; }
        S.fromParen = false;
        S.entry = '0.'; S.awaiting = false; S.justEq = false; S.cleared = false; return;
      }
      if (S.entry.indexOf('.') >= 0 || S.entry.indexOf('e') >= 0 || digitsIn(S.entry) >= MAX_DIGITS) return;
      S.entry += '.';
    }
    function ee() {
      if (S.error) return;
      if (S.entry === null) { const v = S.value; if (!Number.isFinite(v) || Math.abs(v) >= 1e9 || (v !== 0 && Math.abs(v) < 1e-8)) return; S.entry = String(v === 0 ? 1 : v); S.awaiting = false; S.justEq = false; }
      if (S.entry.indexOf('e') >= 0) return;
      if (S.entry.slice(-1) === '.') S.entry = S.entry.slice(0, -1);
      if (parseFloat(S.entry) === 0) S.entry = '1';
      S.entry += 'e0';
    }
    function backspace() {
      if (S.error) { allClear(); return; }
      if (S.entry === null) return;
      let e = S.entry.slice(0, -1);
      if (e.slice(-1) === 'e') e = e.slice(0, -1);
      else if (/e-$/.test(e)) e = e.slice(0, -2);
      if (e === '' || e === '-') e = '0';
      S.entry = e;
    }
    function negate() {
      if (S.error) return;
      if (S.entry === null && (S.awaiting || S.value === 0)) { S.entry = '-0'; S.awaiting = false; S.justEq = false; return; }
      if (S.entry !== null) {
        const ei = S.entry.indexOf('e');
        if (ei >= 0) { const m = S.entry.slice(0, ei + 1); let x = S.entry.slice(ei + 1); x = x[0] === '-' ? x.slice(1) : '-' + x; S.entry = m + x; }
        else S.entry = S.entry[0] === '-' ? S.entry.slice(1) : '-' + S.entry;
      } else S.value = S.value === 0 ? 0 : -S.value;
    }
    function percent() {
      if (S.error) return;
      let cur = current();
      const t = top();
      if (t && !t.paren && (t.op === '+' || t.op === '-')) cur = (t.val * cur) / 100;
      else cur = cur / 100;
      if (setValue(cur)) { S.awaiting = false; S.justEq = false; }
    }
    function operator(op) {
      if (S.error) return;
      const t = top();
      if (S.awaiting && S.entry === null && t && !t.paren) {               // swap the pending operator
        S.stack.pop();
        const cur = reduceWhile(t.val, minPrecFor(op));
        if (!isFinite(cur)) { fail(); return; }
        S.stack.push({ val: cur, op });
        S.value = cur;
        if (S.expr.length) S.expr[S.expr.length - 1] = SYM[op];
      } else {
        const raw = current();
        const cur = reduceWhile(raw, minPrecFor(op));
        if (!isFinite(cur)) { fail(); return; }
        if (S.justEq) S.expr = [];
        if (!S.fromParen) S.expr.push(formatNumber(raw));
        S.expr.push(SYM[op]);
        S.stack.push({ val: cur, op });
        S.value = cur; S.entry = null; S.awaiting = true;
      }
      S.justEq = false; S.cleared = false; S.fromParen = false; S.lastExpr = '';
    }
    function equals() {
      if (S.error) return;
      let cur = current();
      const ops = S.stack.filter((t) => !t.paren);
      if (ops.length) {
        S.repeat = { op: ops[ops.length - 1].op, operand: cur };
        if (!S.fromParen) S.expr.push(formatNumber(cur));
        while (S.stack.length) { const t = S.stack.pop(); if (t.paren) { S.expr.push(')'); continue; } cur = r12(applyOp(t.op, t.val, cur)); }
        S.lastExpr = S.expr.join('');
      } else if (S.repeat) {
        S.lastExpr = formatNumber(cur) + SYM[S.repeat.op] + formatNumber(S.repeat.operand);
        cur = r12(applyOp(S.repeat.op, cur, S.repeat.operand));
        S.stack = [];
      } else { S.stack = []; S.lastExpr = ''; }
      S.expr = [];
      if (setValue(cur)) { S.awaiting = false; S.justEq = true; S.cleared = false; S.fromParen = false; }
    }
    function openParen() {
      if (S.error) allClear();
      if (S.justEq) { S.expr = []; S.lastExpr = ''; S.repeat = null; }
      if (!S.awaiting && !S.stack.length) S.expr = [];
      S.stack.push({ paren: true });
      S.expr.push('(');
      S.entry = null; S.value = 0; S.awaiting = true; S.justEq = false; S.fromParen = false;
    }
    function closeParen() {
      if (S.error) return;
      if (!S.stack.some((t) => t.paren)) return;
      const raw = current();
      let cur = reduceWhile(raw, 0);
      S.stack.pop();                                      // the paren marker
      if (!S.fromParen) S.expr.push(formatNumber(raw));
      S.expr.push(')');
      if (setValue(cur)) { S.awaiting = false; S.fromParen = true; S.justEq = false; }
    }
    function unary(fn) {
      if (S.error) return;
      const x = current();
      const toRad = (a) => (S.deg ? (a * Math.PI) / 180 : a);
      const fromRad = (a) => (S.deg ? (a * 180) / Math.PI : a);
      const tidy = (y) => (Math.abs(y) < 1e-13 ? 0 : y);
      let y;
      switch (fn) {
        case 'sin': y = tidy(Math.sin(toRad(x))); break;
        case 'cos': y = tidy(Math.cos(toRad(x))); break;
        case 'tan': { const c = tidy(Math.cos(toRad(x))); y = c === 0 ? NaN : tidy(Math.tan(toRad(x))); break; }
        case 'asin': y = fromRad(Math.asin(x)); break;
        case 'acos': y = fromRad(Math.acos(x)); break;
        case 'atan': y = fromRad(Math.atan(x)); break;
        case 'ln': y = x <= 0 ? NaN : Math.log(x); break;
        case 'log': y = x <= 0 ? NaN : Math.log10(x); break;
        case 'exp': y = Math.exp(x); break;
        case 'pow10': y = Math.pow(10, x); break;
        case 'sqrt': y = x < 0 ? NaN : Math.sqrt(x); break;
        case 'cbrt': y = Math.cbrt(x); break;
        case 'sq': y = x * x; break;
        case 'cube': y = x * x * x; break;
        case 'inv': y = x === 0 ? NaN : 1 / x; break;
        case 'fact': y = factorial(x); break;
        default: return;
      }
      if (setValue(y)) { S.awaiting = false; S.justEq = false; }
    }
    function constant(v) {
      if (S.error) allClear();
      if (S.justEq) { S.repeat = null; S.lastExpr = ''; }
      S.value = v; S.entry = null; S.awaiting = false; S.justEq = false; S.cleared = false; S.fromParen = false;
    }

    function press(key) {
      if (/^[0-9]$/.test(key)) return digit(key);
      switch (key) {
        case '.': return decimal();
        case '+': case '-': case '*': case '/': case 'pow': case 'root': return operator(key);
        case '=': return equals();
        case 'pct': return percent();
        case 'neg': return negate();
        case 'back': return backspace();
        case 'ac': return allClear();
        case 'c': return clearEntry();
        case 'clear': {                                  // smart key: ⌫ / C / AC
          const l = clearLabel();
          return l === 'back' ? backspace() : l === 'C' ? clearEntry() : allClear();
        }
        case '(': return openParen();
        case ')': return closeParen();
        case 'ee': return ee();
        case 'pi': return constant(r12(Math.PI));
        case 'e': return constant(r12(Math.E));
        case 'rand': return constant(r12(Math.random()));
        case 'deg': S.deg = !S.deg; return;
        default: return unary(key);
      }
    }
    function typing() { return !S.error && S.entry !== null && S.entry !== '0' && S.entry !== '-0'; }
    function clearLabel() {
      if (S.error) return 'AC';
      if (typing()) return 'back';
      if (S.stack.length && !S.cleared) return 'C';
      return 'AC';
    }
    return {
      press,
      clearLabel,
      text() { return S.error ? 'Error' : S.entry !== null ? formatEntry(S.entry) : formatNumber(S.value); },
      exprText() { return S.lastExpr; },
      selectedOp() { const t = top(); return !S.error && S.awaiting && S.entry === null && t && !t.paren ? t.op : null; },
      number() { return S.error ? NaN : current(); },
      setNumber(v) { if (S.error) allClear(); if (S.justEq) { S.repeat = null; S.lastExpr = ''; } if (setValue(v)) { S.awaiting = false; S.justEq = false; S.fromParen = false; } },
      get deg() { return S.deg; },
      get error() { return S.error; },
      snapshot() { return JSON.parse(JSON.stringify(S)); },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createEngine, formatNumber, formatEntry };
  if (typeof window === 'undefined' || !window.OS) return;
  const OS = window.OS;

  /* ───────────────────────────────────── UI ───────────────────────────────────── */

  OS.addStyle('calculator', `
    .app-calculator{background:#000;color:#fff;-webkit-user-select:none;user-select:none}
    .app-calculator .calc{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;
      padding:var(--safe-top) 0 calc(var(--safe-bottom) + 24px)}
    .app-calculator .calc-display{position:relative;flex:1 1 auto;min-height:120px;display:flex;flex-direction:column;justify-content:flex-end;
      padding:0 26px 10px;cursor:default;overflow:hidden}
    .app-calculator .calc-expr{height:30px;line-height:30px;font-size:24px;color:rgba(235,235,245,.6);text-align:right;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;letter-spacing:.2px;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .35s cubic-bezier(.32,.72,0,1)}
    .app-calculator .calc-expr.on{opacity:1;transform:none}
    .app-calculator .calc-num{height:104px;display:flex;justify-content:flex-end;align-items:flex-end;transition:height .35s cubic-bezier(.32,.72,0,1)}
    .app-calculator .calc-num span{display:inline-block;font-size:94px;line-height:104px;font-weight:300;letter-spacing:-1.5px;white-space:nowrap;
      transform-origin:100% 78%;font-variant-numeric:tabular-nums;transition:font-size .35s cubic-bezier(.32,.72,0,1),line-height .35s cubic-bezier(.32,.72,0,1)}
    .app-calculator .calc.sci .calc-num{height:78px}
    .app-calculator .calc.sci .calc-num span{font-size:68px;line-height:78px}
    .app-calculator .calc-num.pop span{animation:calc-pop .16s ease-out}
    @keyframes calc-pop{0%{opacity:.35}100%{opacity:1}}
    .app-calculator .calc-angle{position:absolute;left:28px;bottom:14px;font-size:15px;font-weight:500;color:rgba(235,235,245,.6);opacity:0;transition:opacity .2s}
    .app-calculator .calc.sci .calc-angle.on{opacity:1}

    .app-calculator .calc-sciwrap{overflow:hidden;max-height:0;opacity:0;transition:max-height .38s cubic-bezier(.32,.72,0,1),opacity .25s}
    .app-calculator .calc.sci .calc-sciwrap{max-height:176px;opacity:1}
    .app-calculator .calc-scigrid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px 8px;padding:4px 16px 12px}
    .app-calculator .calc-pad{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:0 16px}

    .app-calculator .calc-key{appearance:none;-webkit-appearance:none;border:0;margin:0;padding:0;font:inherit;color:#fff;background:#333;
      height:83.5px;border-radius:42px;font-size:39px;font-weight:400;display:flex;align-items:center;justify-content:center;cursor:pointer;
      outline:none;-webkit-tap-highlight-color:transparent;
      transition:background-color .55s ease-out,color .3s,height .38s cubic-bezier(.32,.72,0,1)}
    .app-calculator .calc.sci .calc-key{height:64px}
    .app-calculator .calc-key:active,.app-calculator .calc-key.kb{background:#737373;transition:background-color 0s,height .38s cubic-bezier(.32,.72,0,1)}
    .app-calculator .calc-key.fn{background:#A5A5A5;color:#000;font-size:33px;font-weight:500}
    .app-calculator .calc-key.fn:active,.app-calculator .calc-key.fn.kb{background:#D9D9D9}
    .app-calculator .calc-key.op{background:#FF9F0A;font-size:46px;font-weight:400;padding-bottom:4px}
    .app-calculator .calc-key.op:active,.app-calculator .calc-key.op.kb{background:#FCC78D}
    .app-calculator .calc-key.op.sel{background:#fff;color:#FF9F0A}
    .app-calculator .calc-key svg{width:36px;height:36px;display:block;pointer-events:none}
    .app-calculator .calc-key.fn svg{width:38px;height:38px}
    .app-calculator .calc-key .pm{font-size:36px;letter-spacing:-1px}

    .app-calculator .calc-skey{appearance:none;-webkit-appearance:none;border:0;margin:0;padding:0;font:inherit;color:#fff;background:#212121;
      height:44px;border-radius:22px;font-size:17px;font-weight:500;display:flex;align-items:center;justify-content:center;cursor:pointer;outline:none;
      white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:background-color .5s ease-out,color .2s}
    .app-calculator .calc-skey:active{background:#5a5a5a;transition:none}
    .app-calculator .calc-skey.on{background:#A5A5A5;color:#000}
    .app-calculator .calc-skey.sel{background:#fff;color:#000}
    .app-calculator .calc-skey sup{font-size:11px;line-height:0;position:relative;top:-6px;margin-left:1px}
    .app-calculator .calc-skey sub{font-size:10px;line-height:0;position:relative;top:4px}
    .app-calculator .calc-skey .pre{font-size:10px;position:relative;top:-5px;margin-right:-1px}
  `);

  const ICON_BACK = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 9.5h17.3a3.5 3.5 0 0 1 3.5 3.5v14a3.5 3.5 0 0 1-3.5 3.5H14.2a3.5 3.5 0 0 1-2.6-1.2L4.5 21.6a2.4 2.4 0 0 1 0-3.2l7.1-7.7a3.5 3.5 0 0 1 2.6-1.2Z"/><path d="m18.5 15.5 9 9m0-9-9 9"/></svg>';
  const ICON_MODE = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="4.5" width="23" height="31" rx="5"/><rect x="13" y="9.5" width="14" height="5.5" rx="1.6"/><g fill="currentColor" stroke="none"><circle cx="14.6" cy="21.4" r="1.9"/><circle cx="20" cy="21.4" r="1.9"/><circle cx="25.4" cy="21.4" r="1.9"/><circle cx="14.6" cy="28.6" r="1.9"/><circle cx="20" cy="28.6" r="1.9"/><circle cx="25.4" cy="28.6" r="1.9"/></g></svg>';
  const ICON_CHECK = '<svg class="sf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.6 4.8L19 7"/></svg>';

  // basic pad, row-major. iOS 18+ layout: ⌫/AC  ±  %  ÷ … and the mode key bottom-left.
  const PAD = [
    { k: 'clear', cls: 'fn', html: 'AC' }, { k: 'neg', cls: 'fn', html: '<span class="pm">⁺∕₋</span>' }, { k: 'pct', cls: 'fn', html: '%' }, { k: '/', cls: 'op', html: '÷' },
    { k: '7' }, { k: '8' }, { k: '9' }, { k: '*', cls: 'op', html: '×' },
    { k: '4' }, { k: '5' }, { k: '6' }, { k: '-', cls: 'op', html: '−' },
    { k: '1' }, { k: '2' }, { k: '3' }, { k: '+', cls: 'op', html: '+' },
    { k: 'mode', html: ICON_MODE }, { k: '0' }, { k: '.', html: '.' }, { k: '=', cls: 'op', html: '=' },
  ];
  // scientific grid: [key, html, key2nd, html2nd]
  const SCI = [
    ['(', '('], [')', ')'], ['sq', 'x<sup>2</sup>', 'cube', 'x<sup>3</sup>'], ['pow', 'x<sup>y</sup>', 'root', '<span class="pre">y</span>√x'], ['sqrt', '<span class="pre">2</span>√x', 'cbrt', '<span class="pre">3</span>√x'], ['inv', '1/x'],
    ['sin', 'sin', 'asin', 'sin<sup>-1</sup>'], ['cos', 'cos', 'acos', 'cos<sup>-1</sup>'], ['tan', 'tan', 'atan', 'tan<sup>-1</sup>'], ['ln', 'ln', 'exp', 'e<sup>x</sup>'], ['log', 'log<sub>10</sub>', 'pow10', '10<sup>x</sup>'], ['fact', 'x!'],
    ['2nd', '2<sup>nd</sup>'], ['deg', 'Rad'], ['pi', 'π'], ['e', 'e'], ['ee', 'EE'], ['rand', 'Rand'],
  ];

  let clip = '';     // in-emulator clipboard fallback
  let inst = null;   // { onKey, refresh } of the live process

  OS.registerApp({
    id: 'calculator',
    name: 'Calculator',
    system: true,
    statusBar: 'light',
    background: '#000',
    icon: {
      bg: 'linear-gradient(180deg,#3A3A3C,#1C1C1E)',
      glyph: `<svg viewBox="0 0 60 60">
        <g fill="#A5A5A5"><circle cx="13.5" cy="13.5" r="4.7"/><circle cx="24.5" cy="13.5" r="4.7"/><circle cx="35.5" cy="13.5" r="4.7"/></g>
        <g fill="#6E6E73"><circle cx="13.5" cy="24.5" r="4.7"/><circle cx="24.5" cy="24.5" r="4.7"/><circle cx="35.5" cy="24.5" r="4.7"/>
          <circle cx="13.5" cy="35.5" r="4.7"/><circle cx="24.5" cy="35.5" r="4.7"/><circle cx="35.5" cy="35.5" r="4.7"/>
          <rect x="8.8" y="41.8" width="20.4" height="9.4" rx="4.7"/><circle cx="35.5" cy="46.5" r="4.7"/></g>
        <g fill="#FF9F0A"><circle cx="46.5" cy="13.5" r="4.7"/><circle cx="46.5" cy="24.5" r="4.7"/><circle cx="46.5" cy="35.5" r="4.7"/><circle cx="46.5" cy="46.5" r="4.7"/></g>
      </svg>`,
    },

    launch(ctx) {
      const saved = OS.store.get('calculator.state', null) || {};
      const eng = createEngine({ deg: saved.deg !== false });
      if (typeof saved.value === 'number' && isFinite(saved.value)) eng.setNumber(saved.value);
      let sci = saved.mode === 'scientific';
      let second = false;

      const root = ctx.root;
      root.innerHTML = `
        <div class="calc${sci ? ' sci' : ''}">
          <div class="calc-display">
            <div class="calc-expr"></div>
            <div class="calc-num"><span>0</span></div>
            <div class="calc-angle">Rad</div>
          </div>
          <div class="calc-sciwrap"><div class="calc-scigrid"></div></div>
          <div class="calc-pad"></div>
        </div>`;
      const wrap = root.querySelector('.calc');
      const display = root.querySelector('.calc-display');
      const exprEl = root.querySelector('.calc-expr');
      const numBox = root.querySelector('.calc-num');
      const numEl = numBox.querySelector('span');
      const angleEl = root.querySelector('.calc-angle');
      const pad = root.querySelector('.calc-pad');
      const sciGrid = root.querySelector('.calc-scigrid');

      const keyEls = {};
      PAD.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'calc-key' + (d.cls ? ' ' + d.cls : '');
        b.innerHTML = d.html || d.k;
        b.dataset.k = d.k;
        if (d.k === 'mode') b.setAttribute('aria-label', 'Mode');
        pad.appendChild(b);
        keyEls[d.k] = b;
      });
      const sciEls = SCI.map((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'calc-skey';
        b.innerHTML = d[1];
        sciGrid.appendChild(b);
        b.addEventListener('click', () => pressSci(d));
        return b;
      });

      function save() {
        const n = eng.number();
        OS.store.set('calculator.state', { mode: sci ? 'scientific' : 'basic', deg: eng.deg, value: isFinite(n) ? n : 0 });
      }

      function fit() {
        numEl.style.transform = 'none';
        const avail = display.clientWidth - 52;
        const w = numEl.offsetWidth;
        const base = sci ? 68 : 94;                       // measured at the *target* font size even mid-transition
        const cur = parseFloat(getComputedStyle(numEl).fontSize) || base;
        const wTarget = (w * base) / cur;
        const s = wTarget > avail ? avail / wTarget : 1;
        numEl.style.transform = s < 1 ? 'scale(' + s.toFixed(4) + ')' : 'none';
      }

      function refresh(pop) {
        numEl.textContent = eng.text();
        fit();
        const ex = eng.exprText();
        if (ex) exprEl.textContent = ex;
        exprEl.classList.toggle('on', !!ex);
        const cl = eng.clearLabel();
        const cb = keyEls.clear;
        if (cb._label !== cl) { cb._label = cl; cb.innerHTML = cl === 'back' ? ICON_BACK : cl; }
        const sel = eng.selectedOp();
        ['+', '-', '*', '/'].forEach((o) => keyEls[o].classList.toggle('sel', sel === o));
        SCI.forEach((d, i) => {
          const el = sciEls[i];
          if (d[0] === 'pow') el.classList.toggle('sel', sel === (second ? 'root' : 'pow'));
          if (d[0] === '2nd') el.classList.toggle('on', second);
          if (d[0] === 'deg') el.textContent = eng.deg ? 'Rad' : 'Deg';
          else if (d.length > 2) { const h = second ? d[3] : d[1]; if (el._h !== h) { el._h = h; el.innerHTML = h; } }
        });
        angleEl.classList.toggle('on', !eng.deg);
        if (pop) { numBox.classList.remove('pop'); void numBox.offsetWidth; numBox.classList.add('pop'); }
      }

      function press(k) {
        OS.haptic('light');
        if (k === 'mode') { openModeMenu(); return; }
        eng.press(k);
        refresh(k === '=' || k === '+' || k === '-' || k === '*' || k === '/');
        save();
      }
      function pressSci(d) {
        OS.haptic('light');
        if (d[0] === '2nd') { second = !second; refresh(); return; }
        eng.press(second && d.length > 2 ? d[2] : d[0]);
        refresh(false);
        save();
      }

      function setMode(toSci) {
        if (sci === toSci) return;
        sci = toSci;
        wrap.classList.toggle('sci', sci);
        save();
        fit();
        setTimeout(fit, 400);
      }
      function openModeMenu() {
        OS.ui.contextMenu(keyEls.mode, [
          { label: 'Basic', icon: sci ? '' : ICON_CHECK, onTap() { setMode(false); } },
          { label: 'Scientific', icon: sci ? ICON_CHECK : '', onTap() { setMode(true); } },
        ]);
      }

      pad.addEventListener('click', (e) => {
        const b = e.target.closest('.calc-key');
        if (b) press(b.dataset.k);
      });
      // long-press ⌫ clears the whole entry, like holding delete
      OS.util.longPress(keyEls.clear, () => { if (eng.clearLabel() === 'back') { OS.haptic('medium'); eng.press('c'); refresh(true); save(); } });

      // swipe on the display deletes the last digit
      OS.util.drag(display, {
        onEnd(p) {
          if (Math.abs(p.dx) > 28 && Math.abs(p.dx) > Math.abs(p.dy) * 1.5) {
            OS.haptic('light');
            eng.press('back'); refresh(false); save();
          }
        },
      });
      // long-press the display → Copy / Paste
      OS.util.longPress(display, () => {
        OS.haptic('medium');
        OS.ui.contextMenu(numBox, [
          { label: 'Copy', onTap() { copyValue(); } },
          { label: 'Paste', onTap() { pasteValue(); } },
        ]);
      });
      function copyValue() {
        clip = eng.text().replace(/,/g, '');
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(clip).catch(() => {}); } catch (_) {}
        OS.ui.toast('Copied');
      }
      function applyPaste(t) {
        const n = parseFloat(String(t || '').replace(/[,\s]/g, '').replace('−', '-'));
        if (!isFinite(n)) { OS.ui.toast('Nothing to Paste'); return; }
        eng.setNumber(n); refresh(true); save();
      }
      function pasteValue() {
        let p = null;
        try { if (navigator.clipboard && navigator.clipboard.readText) p = navigator.clipboard.readText(); } catch (_) {}
        if (p && p.then) p.then((t) => applyPaste(t || clip), () => applyPaste(clip));
        else applyPaste(clip);
      }

      // physical keyboard
      const KEYMAP = { '+': '+', '-': '-', '*': '*', x: '*', X: '*', '×': '*', '/': '/', '÷': '/', Enter: '=', '=': '=', Backspace: 'back', Delete: 'c', Escape: 'esc',
        c: 'esc', C: 'esc', '%': 'pct', '.': '.', ',': '.', '(': '(', ')': ')', '^': 'pow', '!': 'fact' };
      const onKey = (e) => {
        if (!ctx.isActive() || e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        let k = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
        if (!k) return;
        e.preventDefault();
        if (k === 'esc') k = eng.clearLabel() === 'AC' ? 'ac' : 'c';
        const btn = keyEls[k] || (k === 'back' || k === 'c' || k === 'ac' ? keyEls.clear : null);
        if (btn) { btn.classList.add('kb'); setTimeout(() => btn.classList.remove('kb'), 110); }
        OS.haptic('light');
        eng.press(k);
        refresh(k === '=');
        save();
      };

      inst = { onKey, refresh };
      refresh(false);
    },

    onResume() {
      if (!inst) return;
      document.removeEventListener('keydown', inst.onKey);
      document.addEventListener('keydown', inst.onKey);
      requestAnimationFrame(() => inst && inst.refresh(false));
    },
    onPause() { if (inst) document.removeEventListener('keydown', inst.onKey); },
    onClose() { if (inst) document.removeEventListener('keydown', inst.onKey); inst = null; },
  });
})();
