const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { chatWithAI } = require('../services/claude');

const router = express.Router();
router.use(auth);

router.post('/', async (req, res) => {
  try {
    const { message, history, today } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const clientDate = today || new Date().toISOString().split('T')[0];

    // Gather user context
    const [goalsResult, mealsResult, prefsResult] = await Promise.all([
      pool.query('SELECT * FROM calorie_goals WHERE user_id = $1', [req.userId]),
      pool.query(
        `SELECT meal_type, name, calories FROM meals
         WHERE user_id = $1 AND logged_at::date = $2::date`,
        [req.userId, clientDate]
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

    let reply = await chatWithAI({
      message,
      history: history || [],
      goals,
      todaysMeals,
      remainingCalories,
      preferences,
    });

    // Parse and save any preference blocks from the AI response
    const prefRegex = /```preference\s*\n([\s\S]*?)```/g;
    let prefMatch;
    const learnedPrefs = [];
    while ((prefMatch = prefRegex.exec(reply)) !== null) {
      try {
        const pref = JSON.parse(prefMatch[1].trim());
        if (pref.type && pref.value && ['favorite', 'dislike'].includes(pref.type)) {
          // Check if already exists
          const existing = await pool.query(
            'SELECT id FROM food_preferences WHERE user_id = $1 AND preference_type = $2 AND LOWER(value) = LOWER($3)',
            [req.userId, pref.type, pref.value]
          );
          if (existing.rows.length === 0) {
            await pool.query(
              'INSERT INTO food_preferences (user_id, preference_type, value) VALUES ($1, $2, $3)',
              [req.userId, pref.type, pref.value]
            );
            learnedPrefs.push(pref);
          }
        }
      } catch {}
    }

    // Strip preference blocks from the visible reply
    reply = reply.replace(/```preference\s*\n[\s\S]*?```\s*/g, '').trim();

    res.json({ reply, learnedPreferences: learnedPrefs });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
