const pool = require('../config/db');

const OFF_BASE = 'https://world.openfoodfacts.org/cgi/search.pl';

function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
}

async function searchOpenFoodFacts(query) {
  try {
    const params = new URLSearchParams({
      search_terms: query,
      json: '1',
      page_size: '15',
      search_simple: '1',
      action: 'process',
      fields: 'product_name,brands,nutriments,serving_size,code',
    });
    const resp = await fetch(`${OFF_BASE}?${params}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'CalorieCounter/1.0' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data.products) return [];

    return data.products
      .map((p) => {
        if (!p.product_name) return null;
        const calServing = p.nutriments?.['energy-kcal_serving'];
        const cal100g = p.nutriments?.['energy-kcal_100g'];
        const calories = calServing ? Math.round(calServing) : cal100g ? Math.round(cal100g) : null;
        if (!calories || calories <= 0 || calories > 3000) return null;
        const servingLabel = calServing && p.serving_size
          ? p.serving_size
          : cal100g ? 'per 100g' : '1 serving';
        return {
          id: `off-${p.code}`,
          name: titleCase(p.product_name),
          brand: p.brands || null,
          category: 'food',
          calories_per_serving: calories,
          serving_size: servingLabel,
          source: 'off',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function searchLocalDB(query) {
  const result = await pool.query(
    `SELECT DISTINCT ON (LOWER(name)) id, name, category, calories_per_serving, serving_size
     FROM food_database
     WHERE name ILIKE $1
     ORDER BY LOWER(name),
       CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
       length(name)
     LIMIT 10`,
    [`%${query}%`, `${query}%`]
  );
  if (result.rows.length > 0) return result.rows;

  const fallback = await pool.query(
    `SELECT DISTINCT ON (LOWER(name)) id, name, category, calories_per_serving, serving_size
     FROM food_database
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY LOWER(name), ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
     LIMIT 10`,
    [query]
  );
  return fallback.rows;
}

async function searchFoods(query) {
  const [localRows, offResults] = await Promise.all([
    searchLocalDB(query),
    searchOpenFoodFacts(query),
  ]);

  const local = localRows.map((r) => ({ ...r, source: 'local' }));
  const localNames = new Set(local.map((r) => r.name.toLowerCase()));
  const seen = new Set();
  const merged = [...local];

  for (const item of offResults) {
    if (item.brand) {
      const key = `${item.name.toLowerCase()}|${item.brand.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    } else if (!localNames.has(item.name.toLowerCase())) {
      merged.push(item);
    }
  }

  return merged.slice(0, 25);
}

module.exports = { searchFoods, searchLocalDB, searchOpenFoodFacts, titleCase };
