import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CalorieBudgetBar from '../components/CalorieBudgetBar';
import MealCard from '../components/MealCard';
import SuggestionCard from '../components/SuggestionCard';

export default function Dashboard() {
  const [suggestType, setSuggestType] = useState('lunch');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: meals = [], isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', today],
    queryFn: () => api.get('/meals', { params: { date: today } }).then(r => r.data),
  });

  const { data: goals } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  });

  const { data: suggestionsData, isFetching: suggestionsLoading } = useQuery({
    queryKey: ['suggestions', suggestType],
    queryFn: () => api.get('/suggestions', { params: { meal_type: suggestType } }).then(r => r.data),
    enabled: showSuggestions,
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => api.delete(`/meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const logSuggestion = useMutation({
    mutationFn: (suggestion) =>
      api.post('/meals', {
        meal_type: suggestType,
        name: suggestion.name,
        calories: suggestion.calories,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      setShowSuggestions(false);
    },
  });

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const dailyGoal = goals?.daily_total || 2000;

  const mealsByType = {
    breakfast: meals.filter(m => m.meal_type === 'breakfast'),
    lunch: meals.filter(m => m.meal_type === 'lunch'),
    dinner: meals.filter(m => m.meal_type === 'dinner'),
    snack: meals.filter(m => m.meal_type === 'snack'),
  };

  return (
    <div>
      <div className="page-header">
        <h1>Today's Summary</h1>
        <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <CalorieBudgetBar consumed={totalCalories} goal={dailyGoal} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Meals</h2>
        <Link to="/log" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
          + Log Meal
        </Link>
      </div>

      {mealsLoading ? (
        <div className="loading">Loading meals...</div>
      ) : meals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <p>No meals logged today.</p>
          <Link to="/log" style={{ fontSize: '0.9rem' }}>Log your first meal</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {['breakfast', 'lunch', 'dinner', 'snack'].map(type => {
            const typeMeals = mealsByType[type];
            if (typeMeals.length === 0) return null;
            return (
              <div key={type}>
                {typeMeals.map(meal => (
                  <MealCard key={meal.id} meal={meal} onDelete={(id) => deleteMeal.mutate(id)} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>AI Meal Suggestions</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={suggestType}
              onChange={(e) => {
                setSuggestType(e.target.value);
                setShowSuggestions(false);
              }}
              style={{
                padding: '0.375rem 0.5rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
              }}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
              onClick={() => {
                setShowSuggestions(true);
                queryClient.invalidateQueries({ queryKey: ['suggestions', suggestType] });
              }}
            >
              Get Suggestions
            </button>
          </div>
        </div>

        {suggestionsLoading && <div className="loading">Getting AI suggestions...</div>}

        {showSuggestions && suggestionsData?.suggestions && !suggestionsLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {suggestionsData.suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                onLog={(suggestion) => logSuggestion.mutate(suggestion)}
              />
            ))}
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              Budget: {suggestionsData.mealBudget} cal for this meal · {suggestionsData.remainingCalories} cal remaining today
            </div>
          </div>
        )}

        {!showSuggestions && !suggestionsLoading && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
            Click "Get Suggestions" for AI-powered meal ideas based on your goals and preferences.
          </p>
        )}
      </div>
    </div>
  );
}
