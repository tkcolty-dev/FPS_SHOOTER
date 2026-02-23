// GenAI service via VCAP_SERVICES (OpenAI-compatible proxy)
// Falls back to ANTHROPIC_API_KEY + Anthropic SDK for local dev

function getGenAIConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const genai = vcap.genai && vcap.genai[0];
    if (genai) {
      return {
        apiBase: genai.credentials.endpoint.api_base,
        apiKey: genai.credentials.endpoint.api_key,
        model: 'openai/gpt-oss-120b',
        provider: 'genai',
      };
    }
  }
  // Local dev fallback
  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    provider: 'anthropic',
  };
}

async function callLLM({ messages, systemPrompt, maxTokens = 1024 }) {
  const config = getGenAIConfig();

  if (config.provider === 'genai') {
    // OpenAI-compatible API
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages);

    const res = await fetch(`${config.apiBase}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: allMessages,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GenAI API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // Anthropic SDK fallback for local dev
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt || undefined,
    messages,
  });
  return response.content[0].text;
}

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

  const text = await callLLM({
    messages: [{ role: 'user', content: prompt }],
  });

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

When the user tells you they like or dislike a food (e.g. "I like Cheerios", "I love tacos", "I hate mushrooms"), save it by outputting a preference block:

\`\`\`preference
{"type": "favorite", "value": "Cheerios"}
\`\`\`

Use type "favorite" for likes and "dislike" for dislikes. Acknowledge that you've remembered it. Use the simple food name as the value (e.g. "Cheerios" not "Cheerios cereal for breakfast").

Keep responses concise and conversational. You can suggest multiple meals in one response. Always respect the user's calorie budget and preferences.`;

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  return await callLLM({ messages, systemPrompt });
}

module.exports = { getSuggestions, chatWithAI };
