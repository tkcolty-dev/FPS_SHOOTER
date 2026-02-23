const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

async function searchUSDA(query) {
  try {
    const params = new URLSearchParams({
      api_key: USDA_API_KEY,
      query,
      pageSize: '15',
      dataType: 'Branded,Survey (FNDDS)',
    });
    const resp = await fetch(`${USDA_BASE}?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data.foods) return [];

    return data.foods
      .map((f) => {
        const energyNutrient = f.foodNutrients?.find(
          (n) => n.nutrientId === 1008 || n.nutrientName === 'Energy'
        );
        if (!energyNutrient) return null;
        const cal = Math.round(energyNutrient.value);
        // USDA branded serving sizes are per 100g by default; use householdServingFullText if available
        const serving = f.householdServingFullText || f.servingSize
          ? `${f.servingSize || ''}${f.servingSizeUnit ? ' ' + f.servingSizeUnit.toLowerCase() : ''}`
          : '1 serving';
        const servingLabel = f.householdServingFullText || serving || '1 serving';
        // Scale calories to household serving if possible
        let calories = cal;
        if (f.servingSize && f.householdServingFullText) {
          // cal is per 100g; scale to actual serving size
          calories = Math.round((cal * f.servingSize) / 100);
        }
        // Filter out unreasonable entries
        if (calories <= 0 || calories > 5000) return null;
        return {
          id: `usda-${f.fdcId}`,
          name: titleCase(f.description),
          brand: f.brandName || null,
          category: f.foodCategory || 'food',
          calories_per_serving: calories,
          serving_size: servingLabel,
          source: 'usda',
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

    // Search local DB and USDA API in parallel
    const [localResult, usdaResults] = await Promise.all([
      pool.query(
        `SELECT id, name, category, calories_per_serving, serving_size
         FROM food_database
         WHERE name ILIKE $1
         ORDER BY
           CASE WHEN name ILIKE $2 THEN 0 ELSE 1 END,
           length(name),
           name
         LIMIT 10`,
        [`%${q}%`, `${q}%`]
      ),
      searchUSDA(q),
    ]);

    let localRows = localResult.rows.map((r) => ({ ...r, source: 'local' }));

    // If ILIKE found nothing locally, try full-text search
    if (localRows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, name, category, calories_per_serving, serving_size
         FROM food_database
         WHERE search_vector @@ plainto_tsquery('english', $1)
         ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
         LIMIT 10`,
        [q]
      );
      localRows = fallback.rows.map((r) => ({ ...r, source: 'local' }));
    }

    // Merge: local results first, then USDA (deduped by name)
    const seen = new Set(localRows.map((r) => r.name.toLowerCase()));
    const merged = [...localRows];
    for (const item of usdaResults) {
      if (!seen.has(item.name.toLowerCase())) {
        seen.add(item.name.toLowerCase());
        merged.push(item);
      }
    }

    res.json(merged.slice(0, 25));
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
