const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getSuggestions } = require('../services/claude');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { meal_type } = req.query;
    if (!meal_type) {
      return res.status(400).json({ error: 'meal_type query parameter is required' });
    }

    // Get user's calorie goals
    const goalsResult = await pool.query(
      'SELECT * FROM calorie_goals WHERE user_id = $1',
      [req.userId]
    );
    const goals = goalsResult.rows[0] || { daily_total: 2000 };

    // Get today's meals
    const mealsResult = await pool.query(
      `SELECT meal_type, name, calories FROM meals
       WHERE user_id = $1 AND logged_at::date = CURRENT_DATE`,
      [req.userId]
    );
    const todaysMeals = mealsResult.rows;
    const caloriesConsumed = todaysMeals.reduce((sum, m) => sum + m.calories, 0);
    const remainingCalories = goals.daily_total - caloriesConsumed;

    // Get meal-specific budget
    const mealBudgetMap = {
      breakfast: goals.breakfast,
      lunch: goals.lunch,
      dinner: goals.dinner,
      snack: goals.snacks,
    };
    const mealBudget = mealBudgetMap[meal_type] || Math.round(remainingCalories * 0.4);

    // Get user preferences
    const prefsResult = await pool.query(
      'SELECT preference_type, value FROM food_preferences WHERE user_id = $1',
      [req.userId]
    );
    const preferences = prefsResult.rows;

    const suggestions = await getSuggestions({
      meal_type,
      remainingCalories,
      mealBudget,
      preferences,
      todaysMeals,
    });

    res.json({ suggestions, remainingCalories, mealBudget });
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

module.exports = router;
