// Safe lookups for Bitey. Only free, open sources, no API keys:
//   Wikipedia (facts, food + brand info, pictures) · DuckDuckGo Instant Answers · OpenStreetMap Nominatim (places, like a donut shop)
// Queries are filtered first; results are short summaries with their source links.
const UA = { 'User-Agent': 'BiteWise/1.7 (food coach; https://bitewise.apps.tas-ndc.kuhn-labs.com)' };
const cache = new Map();
const TTL = 24 * 3600e3;
async function cached(key, fn) {
  const h = cache.get(key); if (h && Date.now() - h.at < TTL) return h.v;
  const v = await fn(); cache.set(key, { at: Date.now(), v }); if (cache.size > 3000) cache.delete(cache.keys().next().value); return v;
}
const getJSON = (url, ms = 6000) => fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) }).then(r => r.ok ? r.json() : null).catch(() => null);

// Keep lookups to safe, food/fitness-adjacent topics. Anything matching these is refused.
const BLOCK = /\b(porn|sex|nude|nsfw|hentai|drugs?|cocaine|heroin|meth|weed|vape|nicotine|alcohol poisoning|gun|weapon|bomb|suicide|self[- ]?harm|kill|pro[- ]?ana|pro[- ]?mia|thinspo|purg(e|ing)|laxative|diet pills?|fat burner pills?|steroids?|sarms|dnp|clenbuterol|starv(e|ing|ation) (diet|myself)|how to (vomit|throw up))\b/i;
const isSafe = q => q && q.length <= 120 && !BLOCK.test(q);

async function wikipedia(q, n = 2) {
  const s = await getJSON('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', list: 'search', srsearch: q, srlimit: n, format: 'json', origin: '*' }));
  const titles = (s?.query?.search || []).map(x => x.title);
  const pages = await Promise.all(titles.map(t => getJSON('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')))));
  return pages.filter(p => p && p.type !== 'disambiguation' && p.extract).map(p => ({ kind: 'wikipedia', title: p.title, text: p.extract.slice(0, 600), url: p.content_urls?.desktop?.page, image: p.thumbnail?.source || null }));
}
async function duckduckgo(q) {
  const j = await getJSON('https://api.duckduckgo.com/?' + new URLSearchParams({ q, format: 'json', no_html: 1, skip_disambig: 1, t: 'bitewise' }));
  if (!j || !j.AbstractText) return [];
  return [{ kind: 'duckduckgo', title: j.Heading || q, text: j.AbstractText.slice(0, 600), url: j.AbstractURL || null, image: j.Image ? (j.Image.startsWith('http') ? j.Image : 'https://duckduckgo.com' + j.Image) : null }];
}
async function places(q) {
  const j = await getJSON('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q, format: 'jsonv2', limit: 3, addressdetails: 1, extratags: 1, countrycodes: 'us' }));
  return (j || []).filter(p => p.name).map(p => {
    const a = p.address || {};
    const address = [[a.house_number, a.road].filter(Boolean).join(' '), a.city || a.town || a.village || a.suburb, a.state].filter(Boolean).join(', ');
    return { kind: 'place', title: p.name, text: [p.type ? p.type.replace(/_/g, ' ') : '', address].filter(Boolean).join(' · '), address, hours: p.extratags?.opening_hours || null, website: p.extratags?.website || p.extratags?.['contact:website'] || null, phone: p.extratags?.phone || null, lat: +p.lat, lon: +p.lon, url: `https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}` };
  });
}

const STOP = new Set('the a an of and or for with in on at to is what whats who where how does do near me my best'.split(' '));
const words = q => String(q).toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const relevant = (q, r) => { const ws = words(q); if (!ws.length) return true; const hay = ((r.title || '') + ' ' + (r.text || '').slice(0, 160)).toLowerCase().replace(/[’']/g, ''); return ws.some(w => hay.includes(w.replace(/s$/, ''))); };

async function search(q) {
  q = String(q || '').trim().slice(0, 120);
  if (!isSafe(q)) return { refused: true, results: [] };
  return cached('s:' + q.toLowerCase(), async () => {
    const [w, d, pl] = await Promise.all([wikipedia(q), duckduckgo(q), places(q)]);
    const seen = new Set(), results = [];
    for (const r of [...d, ...w, ...pl].filter(r => relevant(q, r))) { const k = (r.title || '').toLowerCase(); if (seen.has(k + r.kind)) continue; seen.add(k + r.kind); results.push(r); }
    return { refused: false, results: results.slice(0, 7) };
  });
}

// A picture for a food or dish (Wikipedia page image). Returns a URL or null.
async function imageFor(term) {
  term = String(term || '').trim().slice(0, 60); if (!term || !isSafe(term)) return null;
  return cached('img:' + term.toLowerCase(), async () => {
    // 1) a real dish photo from TheMealDB
    const m = await getJSON('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(term), 4000);
    const ws = words(term);
    const meal = (m?.meals || []).find(x => ws.some(w => x.strMeal.toLowerCase().includes(w.replace(/s$/, ''))));
    if (meal?.strMealThumb) return meal.strMealThumb + '/medium';
    // 2) the Wikipedia picture for a page whose title actually matches the food
    const s = await getJSON('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: term, gsrlimit: 6, prop: 'pageimages', piprop: 'thumbnail', pithumbsize: 480, format: 'json', origin: '*' }), 4000);
    const pages = Object.values(s?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const hit = pages.find(p => p.thumbnail?.source && ws.some(w => p.title.toLowerCase().includes(w.replace(/s$/, ''))));
    if (hit?.thumbnail.source) return hit.thumbnail.source;
    // 3) the main dish word on its own ("greek yogurt parfait" → "Parfait", "turkey avocado wrap" → "Wrap (food)")
    const tail = ws[ws.length - 1];
    for (const t of tail ? [tail + ' (food)', tail] : []) {
      const p = await getJSON('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.charAt(0).toUpperCase() + t.slice(1).replace(/ /g, '_')), 4000);
      if (p?.type === 'standard' && p.thumbnail?.source) return p.thumbnail.source;
    }
    return null;
  });
}

module.exports = { search, imageFor, isSafe };
