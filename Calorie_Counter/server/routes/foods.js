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
      pageSize: '20',
      dataType: 'Branded,Survey (FNDDS)',
    });
    const resp = await fetch(`${USDA_BASE}?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data.foods) return [];

    const results = [];
    for (const f of data.foods) {
      const energyNutrient = f.foodNutrients?.find(
        (n) => n.nutrientId === 1008 || n.nutrientName === 'Energy'
      );
      if (!energyNutrient) continue;
      const calPer100g = energyNutrient.value;

      if (f.dataType === 'Branded') {
        // Branded: scale per 100g to actual serving
        const servingGrams = f.servingSize || 100;
        const calories = Math.round((calPer100g * servingGrams) / 100);
        const servingLabel = f.householdServingFullText
          || `${Math.round(servingGrams)}${(f.servingSizeUnit || 'g').toLowerCase() === 'ml' ? ' ml' : 'g'}`;
        if (calories <= 0 || calories > 3000) continue;
        results.push({
          id: `usda-${f.fdcId}`,
          name: titleCase(f.description),
          brand: f.brandName || f.brandOwner || null,
          category: f.foodCategory || 'food',
          calories_per_serving: calories,
          serving_size: servingLabel,
          source: 'usda',
        });
      } else if (f.dataType === 'Survey (FNDDS)' && f.foodMeasures?.length > 0) {
        // FNDDS: use foodMeasures to get per-item calories
        // Pick the most useful measure (skip "Quantity not specified")
        const measure = f.foodMeasures.find(
          (m) => m.disseminationText && !m.disseminationText.includes('not specified')
        ) || f.foodMeasures[0];
        const grams = measure.gramWeight || 100;
        const calories = Math.round((calPer100g * grams) / 100);
        if (calories <= 0 || calories > 3000) continue;
        results.push({
          id: `usda-${f.fdcId}`,
          name: titleCase(f.description),
          brand: null,
          category: f.foodCategory || 'food',
          calories_per_serving: calories,
          serving_size: measure.disseminationText || '1 serving',
          source: 'usda',
        });
      }
    }
    return results;
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
