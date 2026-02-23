const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function getSuggestions({ meal_type, remainingCalories, mealBudget, preferences, todaysMeals }) {
  const cuisinePrefs = preferences.filter(p => p.preference_type === 'cuisine').map(p => p.value);
  const dietaryPrefs = preferences.filter(p => p.preference_type === 'dietary').map(p => p.value);
  const favorites = preferences.filter(p => p.preference_type === 'favorite').map(p => p.value);
  const dislikes = preferences.filter(p => p.preference_type === 'dislike').map(p => p.value);

  const mealsDescription = todaysMeals.length > 0
    ? todaysMeals.map(m => `${m.name} (${m.calories} cal) for ${m.meal_type}`).join(', ')
    : 'nothing yet';

  const prompt = `Suggest 3 meal options for ${meal_type}.
Budget: ${mealBudget} calories for this meal, ${remainingCalories} calories remaining for the day.
${cuisinePrefs.length > 0 ? `Cuisine preferences: ${cuisinePrefs.join(', ')}` : ''}
${dietaryPrefs.length > 0 ? `Dietary requirements: ${dietaryPrefs.join(', ')}` : ''}
${favorites.length > 0 ? `Favorite foods: ${favorites.join(', ')}` : ''}
${dislikes.length > 0 ? `Dislikes (avoid these): ${dislikes.join(', ')}` : ''}
Already ate today: ${mealsDescription}.

Return ONLY a JSON array with exactly 3 objects, each having: name (string), description (string, 1 sentence), calories (number), ingredients (array of strings). No other text.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse suggestions from AI response');
  }

  return JSON.parse(jsonMatch[0]);
}

async function chatWithAI({ message, history, goals, todaysMeals, remainingCalories, preferences }) {
  const cuisinePrefs = preferences.filter(p => p.preference_type === 'cuisine').map(p => p.value);
  const dietaryPrefs = preferences.filter(p => p.preference_type === 'dietary').map(p => p.value);
  const favorites = preferences.filter(p => p.preference_type === 'favorite').map(p => p.value);
  const dislikes = preferences.filter(p => p.preference_type === 'dislike').map(p => p.value);

  const mealsDescription = todaysMeals.length > 0
    ? todaysMeals.map(m => `${m.name} (${m.calories} cal) for ${m.meal_type}`).join(', ')
    : 'nothing yet';

  const systemPrompt = `You are a friendly nutrition assistant inside a calorie tracking app.

User context:
- Daily calorie goal: ${goals.daily_total} cal${goals.breakfast ? ` (breakfast: ${goals.breakfast}, lunch: ${goals.lunch}, dinner: ${goals.dinner}, snacks: ${goals.snacks})` : ''}
- Calories remaining today: ${remainingCalories} cal
- Already ate today: ${mealsDescription}
${cuisinePrefs.length > 0 ? `- Cuisine preferences: ${cuisinePrefs.join(', ')}` : ''}
${dietaryPrefs.length > 0 ? `- Dietary requirements: ${dietaryPrefs.join(', ')}` : ''}
${favorites.length > 0 ? `- Favorite foods: ${favorites.join(', ')}` : ''}
${dislikes.length > 0 ? `- Dislikes (avoid these): ${dislikes.join(', ')}` : ''}

When suggesting meals the user can log, wrap each meal in a fenced code block tagged "meal" like this:

\`\`\`meal
{"name": "Grilled Chicken Salad", "calories": 420, "meal_type": "lunch"}
\`\`\`

Keep responses concise and conversational. You can suggest multiple meals in one response. Always respect the user's calorie budget and preferences.`;

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  return response.content[0].text;
}

module.exports = { getSuggestions, chatWithAI };
