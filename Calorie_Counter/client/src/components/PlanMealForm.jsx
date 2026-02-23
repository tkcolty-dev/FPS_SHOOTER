import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export default function PlanMealForm({ date, onClose, onSuccess }) {
  const [mealType, setMealType] = useState('lunch');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [calorieHints, setCalorieHints] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (name.length < 2) {
      setCalorieHints([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/foods', { params: { q: name } });
        setCalorieHints(res.data.slice(0, 3));
      } catch {
        setCalorieHints([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name]);

  const createPlanned = useMutation({
    mutationFn: (data) => api.post('/planned-meals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      onSuccess();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to plan meal');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !calories) {
      setError('Name and calories are required');
      return;
    }
    createPlanned.mutate({
      meal_type: mealType,
      name: name.trim(),
      calories: parseInt(calories),
      notes: notes.trim() || undefined,
      planned_date: date,
    });
  };

  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Plan a Meal</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{label}</span>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="planMealType">Meal type</label>
            <select id="planMealType" value={mealType} onChange={(e) => setMealType(e.target.value)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="planName">Food name</label>
            <input
              id="planName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grilled chicken salad"
              autoComplete="off"
              required
            />
            {calorieHints.length > 0 && (
              <div className="calorie-hint">
                {calorieHints.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    className="calorie-hint-item"
                    onClick={() => {
                      setName(food.name);
                      setCalories(String(food.calories_per_serving));
                      setCalorieHints([]);
                    }}
                  >
                    {food.name}: ~{food.calories_per_serving} cal ({food.serving_size})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="planCalories">Calories</label>
            <input
              id="planCalories"
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="e.g. 450"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="planNotes">Notes (optional)</label>
            <textarea
              id="planNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. With extra avocado"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createPlanned.isPending}
              style={{ flex: 1, padding: '0.625rem' }}
            >
              {createPlanned.isPending ? 'Saving...' : 'Plan Meal'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.625rem 1.5rem' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
