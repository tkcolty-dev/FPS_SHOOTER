const express = require('express');
const auth = require('../middleware/auth');
const { searchFoods } = require('../services/foodSearch');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }
    const results = await searchFoods(q);
    res.json(results);
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
