import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import FoodSearch from '../components/FoodSearch';

export default function MealLog() {
  const [mealType, setMealType] = useState('lunch');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [error, setError] = useState('');
  const [calorieHints, setCalorieHints] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [baseCal, setBaseCal] = useState(null);
  const [servingSize, setServingSize] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounced calorie lookup on name input
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

  const { data: customMeals = [] } = useQuery({
    queryKey: ['custom-meals'],
    queryFn: () => api.get('/custom-meals').then(r => r.data),
  });

  const createMeal = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/meals', data);
      if (saveAsFavorite) {
        await api.post('/custom-meals', {
          name: data.name,
          meal_type: data.meal_type,
          calories: data.calories,
          notes: data.notes,
        });
        queryClient.invalidateQueries({ queryKey: ['custom-meals'] });
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      navigate('/');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to log meal');
    },
  });

  const quickLog = useMutation({
    mutationFn: (meal) => {
      const n = new Date();
      const localISO = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:00`;
      return api.post('/meals', {
        meal_type: meal.meal_type,
        name: meal.name,
        calories: meal.calories,
        logged_at: localISO,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      navigate('/');
    },
  });

  const handleFoodSelect = (food) => {
    setName(food.name);
    setBaseCal(food.calories_per_serving);
    setServingSize(food.serving_size || '1 serving');
    setQuantity(1);
    setCalories(String(food.calories_per_serving));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !calories) {
      setError('Name and calories are required');
      return;
    }
    // Send local datetime so logged_at::date matches user's local date
    const now = new Date();
    const localISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    createMeal.mutate({
      meal_type: mealType,
      name: name.trim(),
      calories: parseInt(calories),
      notes: notes.trim() || undefined,
      logged_at: localISO,
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Log a Meal</h1>
        <p>Search for a food or enter details manually</p>
      </div>

      {customMeals.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6 }}>
            My Saved Meals
          </label>
          <div className="saved-meals-bar">
            {customMeals.map(m => (
              <button
                key={m.id}
                className="saved-meal-chip"
                onClick={() => quickLog.mutate(m)}
                disabled={quickLog.isPending}
              >
                {m.name}
                <span className="saved-meal-chip-cal">{m.calories} cal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6 }}>
          Quick search from food database
        </label>
        <FoodSearch onSelect={handleFoodSelect} />
      </div>

      <form onSubmit={handleSubmit} className="card">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="mealType">Meal type</label>
          <select
            id="mealType"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="name">Food name</label>
          <input
            id="name"
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
                    setBaseCal(food.calories_per_serving);
                    setServingSize(food.serving_size || '1 serving');
                    setQuantity(1);
                    setCalories(String(food.calories_per_serving));
                    setCalorieHints([]);
                  }}
                >
                  {food.name}{food.brand ? ` (${food.brand})` : ''}: ~{food.calories_per_serving} cal ({food.serving_size})
                </button>
              ))}
            </div>
          )}
        </div>

        {baseCal !== null && (
          <div className="form-group">
            <label htmlFor="quantity">Quantity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  const q = parseFloat(e.target.value) || 0;
                  setQuantity(q);
                  setCalories(String(Math.round(baseCal * q)));
                }}
                min="0.5"
                step="0.5"
                style={{ width: '5rem' }}
                required
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                x {servingSize} ({baseCal} cal each)
              </span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="calories">Calories{baseCal !== null ? ' (auto-calculated)' : ''}</label>
          <input
            id="calories"
            type="number"
            value={calories}
            onChange={(e) => {
              setCalories(e.target.value);
              if (baseCal !== null && parseFloat(e.target.value) > 0) {
                setQuantity(parseFloat((parseFloat(e.target.value) / baseCal).toFixed(1)));
              }
            }}
            placeholder="e.g. 450"
            min="0"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. With extra avocado"
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={saveAsFavorite}
              onChange={(e) => setSaveAsFavorite(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Save as favorite meal
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMeal.isPending}
            style={{ flex: 1, padding: '0.625rem' }}
          >
            {createMeal.isPending ? 'Logging...' : 'Log Meal'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ padding: '0.625rem 1.5rem' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
