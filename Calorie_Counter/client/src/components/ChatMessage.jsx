import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

function parseMealBlocks(text) {
  const parts = [];
  const regex = /```meal\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    try {
      const meal = JSON.parse(match[1].trim());
      parts.push({ type: 'meal', content: meal });
    } catch {
      parts.push({ type: 'text', content: match[0] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
}

function MealCard({ meal }) {
  const queryClient = useQueryClient();

  const logMeal = useMutation({
    mutationFn: () => api.post('/meals', {
      meal_type: meal.meal_type || 'lunch',
      name: meal.name,
      calories: meal.calories,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  return (
    <div className="chat-meal-card">
      <div className="chat-meal-card-info">
        <div className="chat-meal-card-name">{meal.name}</div>
        <div className="chat-meal-card-cal">{meal.calories} cal &middot; {meal.meal_type || 'lunch'}</div>
      </div>
      <button
        className="btn btn-primary"
        style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        onClick={() => logMeal.mutate()}
        disabled={logMeal.isPending || logMeal.isSuccess}
      >
        {logMeal.isSuccess ? 'Logged' : logMeal.isPending ? '...' : 'Log this'}
      </button>
    </div>
  );
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return <div className="chat-bubble user">{message.content}</div>;
  }

  const parts = parseMealBlocks(message.content);

  return (
    <div className="chat-bubble assistant">
      {parts.map((part, i) =>
        part.type === 'meal' ? (
          <MealCard key={i} meal={part.content} />
        ) : (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part.content.trim()}</span>
        )
      )}
    </div>
  );
}
