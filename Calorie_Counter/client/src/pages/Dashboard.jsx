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

  const deleteMeal = useMutation({
    mutationFn: (id) => api.delete(`/meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const dailyGoal = goals?.daily_total || 2000;

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
        <MealTable meals={meals} onDelete={(id) => deleteMeal.mutate(id)} />
      )}
    </div>
  );
}
