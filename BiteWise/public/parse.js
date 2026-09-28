// Offline natural-language food parser. Turns things like
//   "two eggs and toast with butter for breakfast", "chipotle bowl 900", "three fifty calories", "a large fries"
// into [{ name, calories, known }] using the offline food list (foods.js). No internet needed.
(function () {
  const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const SPECIAL = { half: .5, quarter: .25, couple: 2, few: 3, dozen: 12 };

  // "two hundred and fifty" -> 250, "three fifty" -> 350, "1 1/2" -> 1.5, "½" -> 0.5
  function wordsToNumbers(text) {
    text = text.replace(/½/g, ' 0.5').replace(/¼/g, ' 0.25').replace(/¾/g, ' 0.75')
      .replace(/(\d+)\s+(\d+)\/(\d+)/g, (m, w, a, b) => String(+w + a / b))
      .replace(/\b(\d+)\/(\d+)\b/g, (m, a, b) => String(+(a / b).toFixed(3)))
      .replace(/(\d),(\d{3})\b/g, '$1$2');
    const toks = text.split(/\s+/), out = [];
    let i = 0;
    while (i < toks.length) {
      const t = toks[i].replace(/-/g, ' ');
      const isNum = w => w in ONES || w in TENS || w === 'hundred' || w === 'thousand';
      const parts = t.split(' ');
      if (!parts.every(isNum)) { out.push(toks[i]); i++; continue; }
      let total = 0, cur = 0, lastWasOne = false, sawHundred = false;
      while (i < toks.length) {
        const ws = toks[i].replace(/-/g, ' ').split(' ');
        const nextIsAndNum = toks[i] === 'and' && sawHundred && toks[i + 1] && isNum(toks[i + 1].split('-')[0]);
        if (nextIsAndNum) { i++; continue; }
        if (!ws.every(isNum)) break;
        for (const w of ws) {
          if (w in ONES) {
            const v = ONES[w];
            // "three fifteen" / "four twenty" style
            if (lastWasOne && cur > 0 && cur < 10 && !sawHundred && v >= 10) cur = cur * 100 + v; else cur += v;
            lastWasOne = v < 10;
          } else if (w in TENS) {
            if (lastWasOne && cur > 0 && cur < 10 && !sawHundred) cur = cur * 100 + TENS[w]; else cur += TENS[w];
            lastWasOne = false;
          } else if (w === 'hundred') { cur = (cur || 1) * 100; sawHundred = true; lastWasOne = false; }
          else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; lastWasOne = false; }
        }
        i++;
      }
      out.push(String(total + cur));
    }
    return out.join(' ');
  }

  const norm = s => s.toLowerCase().replace(/&/g, ' and ').replace(/[’']/g, '').replace(/[^\w\s.,;\/½¼¾-]/g, ' ').replace(/,/g, ' , ').replace(/\s+/g, ' ').trim();
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = [];
    for (const f of window.BW_FOODS || []) for (const a of f.aliases) {
      const n = norm(a); if (!n) continue;
      INDEX.push({ alias: n, food: f, re: new RegExp('(^|\\s)' + esc(n) + '(e?s)?(?=\\s|$)') });
    }
    INDEX.sort((a, b) => b.alias.length - a.alias.length);
    return INDEX;
  }

  const MEALS = [['breakfast', 'breakfast'], ['brunch', 'lunch'], ['lunch', 'lunch'], ['dinner', 'dinner'], ['supper', 'dinner'], ['snack', 'snack'], ['dessert', 'snack']];
  const FILLER = new Set('i id ive we had have ate eat eaten eating drank drink drinking just some for my the today tonight this morning afternoon evening got get was were like um uh about around approximately roughly maybe log add also then of at in on me please ok okay so yeah'.split(' '));
  const SIZES = { small: .75, little: .75, medium: 1, regular: 1, large: 1.35, big: 1.35, huge: 1.6, 'extra large': 1.6, double: 2, triple: 3 };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const FR = { .5: '½', .25: '¼', .75: '¾' };
  const fmtQty = q => { const w = Math.floor(q), f = +(q - w).toFixed(2); return FR[f] ? (w ? w : '') + FR[f] : String(+q.toFixed(2)); };
  const plural = w => /(s|sh|ch|x)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's';
  const UNITS = /^(\d+ )?(\d\/\d )?(slice|cup|piece|tbsp|tsp|oz|bowl|can|bottle|glass|serving|bag|box|bar|patty|link|stick|roll|pack|plate|fillet|stalks|pouch|shake|grande|medium|small|large|3 oz|1 oz bag|2 tbsp|1\/4 cup|1\/2 cup|3 cups|2 cups|small box|6 inch)$/;

  function parseChunk(raw) {
    let c = raw.trim(); if (!c) return null;
    // 1) explicit calories: "350 cal", "burrito 700 calories"
    const cal = c.match(/(\d+(?:\.\d+)?)\s*(?:k?cals?|kcals?|calories|calorie|cals)\b/);
    if (cal) {
      const name = c.replace(cal[0], ' ').split(' ').filter(w => w && !FILLER.has(w) && !MEALS.some(m => m[0] === w)).join(' ').trim();
      return { name: name ? cap(name) : 'Quick add', calories: Math.round(+cal[1]), known: true };
    }
    // 2) known food
    let hit = null;
    for (const e of index()) { const m = c.match(e.re); if (m) { hit = { ...e, at: m.index + m[1].length, end: m.index + m[0].length }; break; } }
    const before = hit ? c.slice(0, hit.at) : c, after = hit ? c.slice(hit.end) : '';
    if (hit) {
      const after20 = after.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
      const label = hit.alias.length >= 4 && !/_/.test(hit.alias) ? hit.alias : hit.food.name;
      if (after20 && +after20[1] >= 20) return { name: cap(label), calories: Math.round(+after20[1]), known: true, allergens: hit.food.allergens || [] };
      let qty = after20 ? +after20[1] : 1;
      const n = before.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
      const words = before.split(' ');
      if (n) qty = +n[1];
      else if (words.some(w => w in SPECIAL)) qty = SPECIAL[words.find(w => w in SPECIAL)];
      if (words.includes('half') && n) qty = +n[1] + .5;
      let mult = 1;
      for (const [s, m] of Object.entries(SIZES)) if (new RegExp('(^|\\s)' + s + '(\\s|$)').test(before) && !hit.alias.includes(s)) mult = m;
      const kcal = Math.round(hit.food.kcal * qty * mult / 5) * 5;
      const sizeWord = mult !== 1 ? Object.keys(SIZES).find(s => SIZES[s] === mult && before.includes(s)) + ' ' : '';
      const u = hit.food.unit, unitWord = UNITS.test(u) && !['medium', 'small', 'large', 'grande'].includes(u) ? u.replace(/^[\d\/ ]+/, '') : null;
      const name = qty === 1 ? cap(sizeWord + label)
        : unitWord && unitWord !== label ? `${fmtQty(qty)} ${qty > 1 ? plural(unitWord) : unitWord} ${sizeWord}${label}`
        : `${fmtQty(qty)} ${sizeWord}${qty > 1 && !label.endsWith('s') ? plural(label) : label}`;
      return { name, calories: kcal, known: true, detail: `${fmtQty(qty)} × ${hit.food.unit}`, allergens: hit.food.allergens || [] };
    }
    // 3) unknown food with a number: "chipotle 900", "snack 200"
    const num = c.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
    const nameWords = c.split(' ').filter(w => w && !/^\d/.test(w) && !FILLER.has(w) && !MEALS.some(m => m[0] === w) && w !== 'a' && w !== 'an');
    if (num && +num[1] >= 20) return { name: nameWords.length ? cap(nameWords.join(' ')) : 'Quick add', calories: Math.round(+num[1]), known: true };
    if (!nameWords.length) return null;
    const u = USDA && usdaFind(nameWords.join(' '), 1)[0];
    if (u) {
      const q = num ? +num[1] : 1;
      return { name: cap(u.name), calories: Math.round(portionKcal(u) * q / 5) * 5, known: true, detail: `${fmtQty(q)} × ${u.portions[0][0].toLowerCase()} (USDA)`, allergens: u.allergens, usda: true };
    }
    return { name: cap(nameWords.join(' ')), calories: null, known: false };
  }

  function parseLog(text) {
    let t = ' ' + norm(wordsToNumbers(norm(text))) + ' ';
    let meal = null;
    for (const [w, m] of MEALS) if (new RegExp('\\s' + w + '\\s').test(t)) { meal = m; break; }
    // protect multi-word foods that contain "and"/"with" before splitting ("mac and cheese", "coffee with milk")
    for (const e of index()) if (/ (and|with) /.test(e.alias) && t.includes(' ' + e.alias)) t = t.split(' ' + e.alias).join(' ' + e.alias.replace(/ /g, '_'));
    const chunks = t.split(/,|;|\n|\s(?:and|with|plus|also|then|n)\s/).map(s => s.replace(/_/g, ' ').trim()).filter(Boolean);
    const items = chunks.map(parseChunk).filter(Boolean);
    return { items, meal, total: items.reduce((a, i) => a + (i.calories || 0), 0), allKnown: items.length > 0 && items.every(i => i.known) };
  }

  // ---------- USDA database (5,000+ foods, loaded in the background, cached for offline) ----------
  let USDA = null, usdaLoading = null;
  const AL = () => window.BW_ALLERGENS || {};
  function loadUSDA() {
    if (USDA || usdaLoading) return usdaLoading || Promise.resolve(USDA);
    usdaLoading = fetch('/usda-foods.json').then(r => r.json()).then(j => {
      USDA = j.foods.map(([name, kcal100, portions, al, cat]) => {
        const l = norm(name);
        return { name, l, words: l.split(' '), kcal100, portions, allergens: [...(al || '')].map(c => AL()[c]).filter(Boolean), cat };
      });
      return USDA;
    }).catch(() => { usdaLoading = null; return null; });
    return usdaLoading;
  }
  const portionKcal = (f, i = 0) => Math.round(f.kcal100 * f.portions[i][1] / 100 / 5) * 5;
  // every typed word must start one of the food's words; shorter, simpler names rank first
  function usdaFind(q, limit = 20) {
    if (!USDA) return [];
    const qs = norm(q).split(' ').filter(w => w && !FILLER.has(w) && w.length > 1);
    if (!qs.length) return [];
    const hits = [];
    for (const f of USDA) {
      let ok = true, score = 0;
      for (const w of qs) { const i = f.words.findIndex(x => x.startsWith(w) || (w.length > 3 && x.startsWith(w.replace(/e?s$/, '')))); if (i < 0) { ok = false; break; } score += i; }
      if (ok) hits.push([score * 3 + f.words.length + (f.l.startsWith(qs[0]) ? 0 : 4), f]);
    }
    return hits.sort((a, b) => a[0] - b[0]).slice(0, limit).map(h => h[1]);
  }

  // Search the food list for suggestions while typing: prefix matches first, then word matches.
  function search(q, limit = 8) {
    q = norm(q); if (q.length < 2) return [];
    const seen = new Set(), starts = [], contains = [];
    for (const e of index()) {
      if (seen.has(e.food.name)) continue;
      if (e.alias.startsWith(q)) { starts.push(e); seen.add(e.food.name); }
      else if (e.alias.includes(' ' + q) || (q.length >= 3 && e.alias.includes(q))) { contains.push(e); seen.add(e.food.name); }
    }
    return [...starts.sort((a, b) => a.alias.length - b.alias.length), ...contains].slice(0, limit)
      .map(e => ({ name: cap(e.alias.length >= 4 && e.alias !== e.food.name ? e.alias : e.food.name), calories: e.food.kcal, unit: e.food.unit, allergens: e.food.allergens || [] }));
  }

  // Full search for the Search screen: BiteWise's own list first, then the USDA database.
  function searchAll(q, limit = 30) {
    const mine = search(q, 8).map(f => ({ ...f, portions: [[f.unit, null]], source: 'bitewise' }));
    const seen = new Set(mine.map(f => f.name.toLowerCase()));
    const usda = usdaFind(q, limit).filter(f => !seen.has(f.name.toLowerCase())).map(f => ({ name: f.name, calories: portionKcal(f), kcal100: f.kcal100, portions: f.portions, allergens: f.allergens, cat: f.cat, source: 'usda' }));
    return [...mine, ...usda].slice(0, limit);
  }

  window.BW_PARSE = { parseLog, wordsToNumbers, search, searchAll, loadUSDA, get usdaReady() { return !!USDA; }, get usdaCount() { return USDA ? USDA.length : 0; } };
})();
