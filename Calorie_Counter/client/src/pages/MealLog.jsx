import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import FoodSearch from '../components/FoodSearch';

export default function MealLog() {
  const [mealType, setMealType] = useState('lunch');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMeal = useMutation({
    mutationFn: (data) => api.post('/meals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      navigate('/');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to log meal');
    },
  });

  const handleFoodSelect = (food) => {
    setName(food.name);
    setCalories(String(food.calories_per_serving));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !calories) {
      setError('Name and calories are required');
      return;
    }
    createMeal.mutate({
      meal_type: mealType,
      name: name.trim(),
      calories: parseInt(calories),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Log a Meal</h1>
        <p>Search for a food or enter details manually</p>
      </div>

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
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="calories">Calories</label>
          <input
            id="calories"
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
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
