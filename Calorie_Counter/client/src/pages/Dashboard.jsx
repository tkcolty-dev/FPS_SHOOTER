import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CalorieBudgetBar from '../components/CalorieBudgetBar';
import MealTable from '../components/MealTable';

export default function Dashboard() {
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

  const { data: historyMeals = [] } = useQuery({
    queryKey: ['meals-history'],
    queryFn: () => api.get('/meals/history', { params: { days: 7 } }).then(r => r.data),
  });

  const { data: topFoods = [] } = useQuery({
    queryKey: ['top-foods'],
    queryFn: () => api.get('/meals/top-foods', { params: { days: 30 } }).then(r => r.data),
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => api.delete(`/meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const clearToday = useMutation({
    mutationFn: () => api.delete('/meals/today'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const dailyGoal = goals?.daily_total || 2000;

  // Group history meals by date
  const historyByDate = historyMeals.reduce((acc, meal) => {
    const date = new Date(meal.logged_at).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(meal);
    return acc;
  }, {});

  const maxFoodCount = topFoods.length > 0 ? topFoods[0].count : 1;

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {meals.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
              onClick={() => {
                if (confirm('Clear all meals for today?')) clearToday.mutate();
              }}
              disabled={clearToday.isPending}
            >
              Clear All
            </button>
          )}
          <Link to="/log" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            + Log Meal
          </Link>
        </div>
      </div>

      {mealsLoading ? (
        <div className="loading">Loading meals...</div>
      ) : meals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <p>No meals logged today.</p>
          <Link to="/log" style={{ fontSize: '0.9rem' }}>Log your first meal</Link>
        </div>
      ) : (
        <MealTable meals={meals} onDelete={(id) => deleteMeal.mutate(id)} />
      )}

      {topFoods.length > 0 && (
        <div className="history-section">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Your Top Foods</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>Last 30 days</p>
          <div className="top-foods-list">
            {topFoods.map((food, i) => (
              <div key={food.name} className="top-food-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    {i + 1}. {food.name}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {food.count}x · ~{food.avg_calories} cal
                  </span>
                </div>
                <div className="top-food-bar-track">
                  <div
                    className="top-food-bar"
                    style={{ width: `${(food.count / maxFoodCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(historyByDate).length > 0 && (
        <div className="history-section">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recent History</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>Last 7 days</p>
          {Object.entries(historyByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateMeals]) => (
              <HistoryDateSection key={date} date={date} meals={dateMeals} />
            ))}
        </div>
      )}
    </div>
  );
}

function HistoryDateSection({ date, meals }) {
  const [open, setOpen] = useState(false);
  const total = meals.reduce((sum, m) => sum + m.calories, 0);
  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div className="history-date-group">
      <button className="history-date-header" onClick={() => setOpen(!open)}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>{total} cal</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            {meals.length} meal{meals.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
          </span>
        </span>
      </button>
      {open && (
        <div className="history-rows">
          {meals.map((m) => (
            <div key={m.id} className="history-row">
              <span className="history-row-name">{m.name}</span>
              <span className="history-row-cal">{m.calories} cal</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
