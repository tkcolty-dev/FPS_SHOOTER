import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

function parseBlocks(text) {
  const parts = [];
  // Match meal blocks and planned summary blocks
  const regex = /```meal\s*\n([\s\S]*?)```|---PLANNED:(.*?):(.*?):([\s\S]*?)(?=\n\n|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      // meal block
      try {
        const meal = JSON.parse(match[1].trim());
        parts.push({ type: 'meal', content: meal });
      } catch {
        parts.push({ type: 'text', content: match[0] });
      }
    } else if (match[2] !== undefined) {
      // planned summary
      parts.push({
        type: 'planned',
        content: {
          date: match[2],
          totalCal: match[3],
          items: match[4].trim(),
        },
      });
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
    mutationFn: () => {
      const n = new Date();
      const localISO = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:00`;
      return api.post('/meals', {
        meal_type: meal.meal_type || 'lunch',
        name: meal.name,
        calories: meal.calories,
        logged_at: localISO,
      });
    },
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

function PlannedCard({ plan }) {
  return (
    <div className="chat-planned-card">
      <div className="chat-planned-card-header">
        <span className="chat-planned-badge">Planned</span>
        <span className="chat-planned-date">{plan.date}</span>
        <span className="chat-planned-total">{plan.totalCal} cal</span>
      </div>
      <div className="chat-planned-card-items">
        {plan.items.split('\n').map((item, i) => (
          <div key={i} className="chat-planned-card-item">{item}</div>
        ))}
      </div>
    </div>
  );
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return <div className="chat-bubble user">{message.content}</div>;
  }

  const parts = parseBlocks(message.content);

  return (
    <div className="chat-bubble assistant">
      {parts.map((part, i) =>
        part.type === 'meal' ? (
          <MealCard key={i} meal={part.content} />
        ) : part.type === 'planned' ? (
          <PlannedCard key={i} plan={part.content} />
        ) : (
          <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part.content.trim()}</span>
        )
      )}
    </div>
  );
}
