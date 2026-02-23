const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { chatWithAI } = require('../services/claude');

const router = express.Router();
router.use(auth);

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Gather user context
    const [goalsResult, mealsResult, prefsResult] = await Promise.all([
      pool.query('SELECT * FROM calorie_goals WHERE user_id = $1', [req.userId]),
      pool.query(
        `SELECT meal_type, name, calories FROM meals
         WHERE user_id = $1 AND logged_at::date = CURRENT_DATE`,
        [req.userId]
      ),
      pool.query(
        'SELECT preference_type, value FROM food_preferences WHERE user_id = $1',
        [req.userId]
      ),
    ]);

    const goals = goalsResult.rows[0] || { daily_total: 2000 };
    const todaysMeals = mealsResult.rows;
    const caloriesConsumed = todaysMeals.reduce((sum, m) => sum + m.calories, 0);
    const remainingCalories = goals.daily_total - caloriesConsumed;
    const preferences = prefsResult.rows;

    const reply = await chatWithAI({
      message,
      history: history || [],
      goals,
      todaysMeals,
      remainingCalories,
      preferences,
    });

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
