const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const OFF_BASE = 'https://world.openfoodfacts.org/cgi/search.pl';

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
        // Prefer per-serving calories, fall back to per-100g
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

function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
}

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    // Search local DB and Open Food Facts in parallel
    const [localResult, usdaResults] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ON (LOWER(name)) id, name, category, calories_per_serving, serving_size
         FROM food_database
         WHERE name ILIKE $1
         ORDER BY LOWER(name),
           CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
           length(name)
         LIMIT 10`,
        [`%${q}%`, `${q}%`]
      ),
      searchOpenFoodFacts(q),
    ]);

    let localRows = localResult.rows.map((r) => ({ ...r, source: 'local' }));

    // If ILIKE found nothing locally, try full-text search
    if (localRows.length === 0) {
      const fallback = await pool.query(
        `SELECT DISTINCT ON (LOWER(name)) id, name, category, calories_per_serving, serving_size
         FROM food_database
         WHERE search_vector @@ plainto_tsquery('english', $1)
         ORDER BY LOWER(name), ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
         LIMIT 10`,
        [q]
      );
      localRows = fallback.rows.map((r) => ({ ...r, source: 'local' }));
    }

    // Merge: local results first, then USDA
    // Branded items always show (different brands = different products)
    // Non-branded USDA items are deduped against local by name
    const localNames = new Set(localRows.map((r) => r.name.toLowerCase()));
    const seen = new Set();
    const merged = [...localRows];
    for (const item of usdaResults) {
      if (item.brand) {
        // Branded: dedup by name+brand combo only
        const key = `${item.name.toLowerCase()}|${item.brand.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      } else {
        // Non-branded USDA: skip if local already has this name
        if (!localNames.has(item.name.toLowerCase())) {
          merged.push(item);
        }
      }
    }

    res.json(merged.slice(0, 25));
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
