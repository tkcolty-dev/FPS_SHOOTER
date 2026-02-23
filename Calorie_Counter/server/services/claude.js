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

Use full or half servings only (e.g. "1 cup rice", "2 eggs", "1/2 avocado"). Never suggest odd fractions like 0.7 cups.

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

async function chatWithAI({ message, history, goals, todaysMeals, remainingCalories, preferences, plannedMeals, clientDate, foodReference }) {
  const cuisinePrefs = preferences.filter(p => p.preference_type === 'cuisine').map(p => p.value);
  const dietaryPrefs = preferences.filter(p => p.preference_type === 'dietary').map(p => p.value);
  const favorites = preferences.filter(p => p.preference_type === 'favorite').map(p => p.value);
  const dislikes = preferences.filter(p => p.preference_type === 'dislike').map(p => p.value);

  const mealsDescription = todaysMeals.length > 0
    ? todaysMeals.map(m => `${m.name} (${m.calories} cal) for ${m.meal_type}`).join(', ')
    : 'nothing yet';

  const plannedDescription = plannedMeals && plannedMeals.length > 0
    ? plannedMeals.map(m => {
        const date = typeof m.planned_date === 'string' ? m.planned_date.split('T')[0] : m.planned_date;
        return `${m.name} (${m.calories} cal) for ${m.meal_type} on ${date}`;
      }).join(', ')
    : 'none';

  const systemPrompt = `You are a friendly nutrition assistant inside a calorie tracking app.
Today's date: ${clientDate || new Date().toISOString().split('T')[0]}

User context:
- Daily calorie goal: ${goals.daily_total} cal${goals.breakfast ? ` (breakfast: ${goals.breakfast}, lunch: ${goals.lunch}, dinner: ${goals.dinner}, snacks: ${goals.snacks})` : ''}
- Calories remaining today: ${remainingCalories} cal
- Already ate today: ${mealsDescription}
- Planned meals (upcoming): ${plannedDescription}
${cuisinePrefs.length > 0 ? `- Cuisine preferences: ${cuisinePrefs.join(', ')}` : ''}
${dietaryPrefs.length > 0 ? `- Dietary requirements: ${dietaryPrefs.join(', ')}` : ''}
${favorites.length > 0 ? `- Favorite foods: ${favorites.join(', ')}` : ''}
${dislikes.length > 0 ? `- Dislikes (avoid these): ${dislikes.join(', ')}` : ''}

You can suggest meals in two ways:

1. To log a meal NOW (for today), use a "meal" block:
\`\`\`meal
{"name": "Grilled Chicken Salad", "calories": 420, "meal_type": "lunch", "protein_g": 35, "carbs_g": 12, "fat_g": 18}
\`\`\`

2. To PLAN a meal for a specific date (today or future), use a "planned_meal" block. The planned_date must be YYYY-MM-DD format:
\`\`\`planned_meal
{"name": "Grilled Chicken Salad", "calories": 420, "meal_type": "lunch", "planned_date": "2026-02-24", "protein_g": 35, "carbs_g": 12, "fat_g": 18}
\`\`\`

CRITICAL: When the user asks to "plan meals for tomorrow", "plan my day", "plan meals for [date]", or anything about planning ahead, you MUST include planned_meal blocks for EVERY meal you suggest. Each meal needs its own planned_meal block. Without these blocks the meals won't be saved. Do NOT skip the blocks. Do NOT use meal blocks for future dates.

When planning a full day, plan breakfast, lunch, dinner, and optionally a snack, keeping the total within the daily calorie goal of ${goals.daily_total} cal. Output a planned_meal block for each one. Skip any meal_type that already has a planned meal for that date.

When the user tells you they like or dislike a food (e.g. "I like Cheerios", "I love tacos", "I hate mushrooms"), save it by outputting a preference block:

\`\`\`preference
{"type": "favorite", "value": "Cheerios"}
\`\`\`

Use type "favorite" for likes and "dislike" for dislikes. Acknowledge that you've remembered it. Use the simple food name as the value (e.g. "Cheerios" not "Cheerios cereal for breakfast").

Keep responses concise and conversational. You can suggest multiple meals in one response. Always respect the user's calorie budget and preferences.

IMPORTANT: When suggesting serving sizes, always use full servings or half servings (e.g. "1 cup", "2 eggs", "1/2 cup", "1.5 servings"). Never suggest odd fractions like 0.7 cups or 1.3 servings. Keep portions practical and realistic.
${foodReference && foodReference.length > 0 ? `
CALORIE REFERENCE (use these exact values when suggesting these foods):
${foodReference.map(f => {
  let line = `- ${f.name}: ${f.calories_per_serving} cal per ${f.serving_size}`;
  if (f.protein_g != null || f.carbs_g != null || f.fat_g != null) {
    const parts = [];
    if (f.protein_g != null) parts.push(`P:${f.protein_g}g`);
    if (f.carbs_g != null) parts.push(`C:${f.carbs_g}g`);
    if (f.fat_g != null) parts.push(`F:${f.fat_g}g`);
    line += ` (${parts.join(', ')})`;
  }
  return line;
}).join('\n')}

IMPORTANT: Always use the calorie values from this reference when available. These are from our verified food database. If a food is not listed above, use your best estimate but be accurate.` : ''}`;

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  return await callLLM({ messages, systemPrompt, maxTokens: 4096 });
}

async function analyzePhoto(base64Image) {
  const config = getGenAIConfig();
  const prompt = `Look at this photo of food. Identify each food item visible and estimate the calories and macros.

Return ONLY a JSON array of items. Each item: {"name": "food name", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}

Be practical with portions — estimate realistic serving sizes from what's visible. If unsure, give your best estimate. No other text.`;

  if (config.provider === 'genai') {
    const res = await fetch(`${config.apiBase}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GenAI vision error ${res.status}: ${err}`);
    }
    const data = await res.json();
    const text = data.choices[0].message.content;
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Failed to parse photo analysis');
    return JSON.parse(match[0]);
  }

  // Anthropic SDK fallback
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Failed to parse photo analysis');
  return JSON.parse(match[0]);
}

module.exports = { getSuggestions, chatWithAI, analyzePhoto };
