// Online food + recipe search, proxied and cached by the server.
//   Brand-name foods: Open Food Facts (open data, ODbL — credited in the app).
//   Recipes + YouTube links: TheMealDB free API (credited in the app).
const cache = new Map(); // key -> { at, data }
const TTL = 12 * 3600e3;
async function cached(key, fn) {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await fn(); cache.set(key, { at: Date.now(), data });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return data;
}
const UA = { 'User-Agent': 'BiteWise/1.4 (calorie counter; https://bitewise.apps.tas-ndc.kuhn-labs.com)' };
const get = (url, ms = 9000) => fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) }).then(r => { if (!r.ok) throw new Error('lookup failed (' + r.status + ')'); return r.json(); });

// Open Food Facts allergen tags → BiteWise allergen names
const OFF_AL = { 'en:milk': 'dairy', 'en:gluten': 'gluten', 'en:eggs': 'egg', 'en:soybeans': 'soy', 'en:peanuts': 'peanut', 'en:nuts': 'tree nut', 'en:fish': 'fish', 'en:crustaceans': 'shellfish', 'en:molluscs': 'shellfish', 'en:sesame-seeds': 'sesame' };
// ingredient words → allergens (for recipes)
const ING_AL = [[/milk|cheese|butter|cream|yogurt|parmesan|mozzarella|cheddar|feta|ricotta|ghee/i, 'dairy'], [/\begg/i, 'egg'], [/flour|bread|pasta|spaghetti|noodle|breadcrumb|tortilla|soy sauce|puff pastry|couscous|wheat/i, 'gluten'], [/soy|tofu|miso/i, 'soy'], [/peanut/i, 'peanut'], [/almond|cashew|walnut|pecan|pistachio|hazelnut|pine nut/i, 'tree nut'], [/fish|salmon|tuna|cod|anchov|haddock|mackerel|sardine/i, 'fish'], [/prawn|shrimp|crab|lobster|mussel|clam|oyster|squid|scallop/i, 'shellfish'], [/sesame|tahini/i, 'sesame']];

function mapProduct(p) {
  const n = p.nutriments || {};
  const per100 = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
  const servingG = parseFloat(p.serving_quantity) || null;
  const perServing = n['energy-kcal_serving'] ?? (per100 != null && servingG ? per100 * servingG / 100 : null);
  const brand = p.brands?.split(',')[0]?.trim(), prod = p.product_name?.trim() || '';
  const name = brand && !prod.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${prod}` : prod;
  if (!p.product_name || (per100 == null && perServing == null)) return null;
  const portions = [];
  if (perServing != null) portions.push([p.serving_size || '1 serving', servingG || null, Math.round(perServing)]);
  if (per100 != null) portions.push(['100 g', 100, Math.round(per100)]);
  return { name: name.slice(0, 80), calories: portions[0][2], portions, allergens: [...new Set((p.allergens_tags || []).map(t => OFF_AL[t]).filter(Boolean))], source: 'off', code: p.code };
}

function mapMeal(m) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) { const it = (m['strIngredient' + i] || '').trim(); if (it) ingredients.push({ item: it, measure: (m['strMeasure' + i] || '').trim() }); }
  const text = ingredients.map(x => x.item).join(' ');
  return {
    id: m.idMeal, name: m.strMeal, category: m.strCategory, area: m.strArea, thumb: m.strMealThumb, youtube: m.strYoutube || null, source: m.strSource || null,
    ingredients, steps: (m.strInstructions || '').split(/\r?\n+/).map(s => s.replace(/^(step\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim()).filter(s => s.length > 2),
    allergens: ING_AL.filter(([re]) => re.test(text)).map(([, a]) => a),
  };
}

module.exports = function mountOnline(app, { limit }) {
  app.get('/api/foods/search', limit(60, 60e3), async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q.length < 2) return res.json({ foods: [] });
    try {
      const foods = await cached('off:' + q.toLowerCase(), async () => {
        const base = { search_terms: q, search_simple: 1, action: 'process', json: 1, page_size: 24, sort_by: 'unique_scans_n', fields: 'code,product_name,brands,nutriments,serving_size,serving_quantity,allergens_tags' };
        // US products first (what people here actually buy), then the rest of the world
        const us = await get('https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({ ...base, tagtype_0: 'countries', tag_contains_0: 'contains', tag_0: 'united-states' })).catch(() => ({ products: [] }));
        let products = us.products || [];
        if (products.length < 6) products = products.concat((await get('https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams(base)).catch(() => ({ products: [] }))).products || []);
        const seen = new Set();
        return products.map(mapProduct).filter(f => f && !seen.has(f.name.toLowerCase()) && seen.add(f.name.toLowerCase())).slice(0, 15);
      });
      res.json({ foods });
    } catch (e) { res.status(502).json({ error: 'Brand search isn’t answering right now. Try again in a bit.', foods: [] }); }
  });

  app.get('/api/recipes', limit(60, 60e3), async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 40), cat = String(req.query.c || '').trim().slice(0, 30);
    try {
      const meals = await cached('meal:' + q.toLowerCase() + '|' + cat, async () => {
        if (cat) {
          const list = await get('https://www.themealdb.com/api/json/v1/1/filter.php?c=' + encodeURIComponent(cat));
          const ids = (list.meals || []).slice(0, 12).map(m => m.idMeal);
          const full = await Promise.all(ids.map(id => get('https://www.themealdb.com/api/json/v1/1/lookup.php?i=' + id).then(j => j.meals?.[0]).catch(() => null)));
          return full.filter(Boolean).map(mapMeal);
        }
        if (!q) { const r = await Promise.all(Array.from({ length: 6 }, () => get('https://www.themealdb.com/api/json/v1/1/random.php').then(j => j.meals?.[0]).catch(() => null))); const seen = new Set(); return r.filter(m => m && !seen.has(m.idMeal) && seen.add(m.idMeal)).map(mapMeal); }
        const j = await get('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(q));
        return (j.meals || []).slice(0, 16).map(mapMeal);
      });
      if (!q && !cat) cache.delete('meal:|'); // random picks stay fresh
      res.json({ recipes: meals });
    } catch (e) { res.status(502).json({ error: 'Recipes aren’t answering right now. Try again in a bit.', recipes: [] }); }
  });
};
