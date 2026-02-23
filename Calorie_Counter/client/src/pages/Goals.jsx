import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export default function Goals() {
  const [dailyTotal, setDailyTotal] = useState(2000);
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [snacks, setSnacks] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  });

  useEffect(() => {
    if (goals) {
      setDailyTotal(goals.daily_total || 2000);
      setBreakfast(goals.breakfast || '');
      setLunch(goals.lunch || '');
      setDinner(goals.dinner || '');
      setSnacks(goals.snacks || '');
    }
  }, [goals]);

  const updateGoals = useMutation({
    mutationFn: (data) => api.put('/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setSuccess('Goals updated!');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to update goals');
      setSuccess('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateGoals.mutate({
      daily_total: parseInt(dailyTotal),
      breakfast: breakfast ? parseInt(breakfast) : null,
      lunch: lunch ? parseInt(lunch) : null,
      dinner: dinner ? parseInt(dinner) : null,
      snacks: snacks ? parseInt(snacks) : null,
    });
  };

  if (isLoading) return <div className="loading">Loading goals...</div>;

  const mealTotal = (parseInt(breakfast) || 0) + (parseInt(lunch) || 0) + (parseInt(dinner) || 0) + (parseInt(snacks) || 0);

  return (
    <div>
      <div className="page-header">
        <h1>Calorie Goals</h1>
        <p>Set your daily calorie targets</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {error && <div className="error-message">{error}</div>}
        {success && (
          <div style={{
            background: '#f0fdf4', color: 'var(--color-success)', padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)', fontSize: '0.875rem', marginBottom: '1rem',
            border: '1px solid #bbf7d0',
          }}>
            {success}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="dailyTotal">Daily calorie goal</label>
          <input
            id="dailyTotal"
            type="number"
            value={dailyTotal}
            onChange={(e) => setDailyTotal(e.target.value)}
            min="500"
            max="10000"
            required
          />
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
          Optionally set per-meal budgets (used for AI suggestions):
        </p>

        <div className="goals-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label htmlFor="breakfast">Breakfast</label>
            <input id="breakfast" type="number" value={breakfast} onChange={(e) => setBreakfast(e.target.value)} placeholder="e.g. 400" min="0" />
          </div>
          <div className="form-group">
            <label htmlFor="lunch">Lunch</label>
            <input id="lunch" type="number" value={lunch} onChange={(e) => setLunch(e.target.value)} placeholder="e.g. 600" min="0" />
          </div>
          <div className="form-group">
            <label htmlFor="dinner">Dinner</label>
            <input id="dinner" type="number" value={dinner} onChange={(e) => setDinner(e.target.value)} placeholder="e.g. 700" min="0" />
          </div>
          <div className="form-group">
            <label htmlFor="snacks">Snacks</label>
            <input id="snacks" type="number" value={snacks} onChange={(e) => setSnacks(e.target.value)} placeholder="e.g. 300" min="0" />
          </div>
        </div>

        {mealTotal > 0 && (
          <p style={{
            fontSize: '0.85rem',
            color: mealTotal > parseInt(dailyTotal) ? 'var(--color-danger)' : 'var(--color-text-secondary)',
            marginBottom: '1rem',
          }}>
            Meal budgets total: {mealTotal} / {dailyTotal} cal
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={updateGoals.isPending}
          style={{ width: '100%', padding: '0.625rem' }}
        >
          {updateGoals.isPending ? 'Saving...' : 'Save Goals'}
        </button>
      </form>
    </div>
  );
}
