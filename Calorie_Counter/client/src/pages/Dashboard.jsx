import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import CalorieBudgetBar from '../components/CalorieBudgetBar';
import MealTable from '../components/MealTable';
import WeekStrip from '../components/WeekStrip';
import PlannedMealsList from '../components/PlannedMealsList';
import PlanMealForm from '../components/PlanMealForm';

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const now = new Date();
  const today = formatDate(now);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [dismissedWeekly, setDismissedWeekly] = useState(() => {
    const saved = localStorage.getItem('weekly-summary-dismissed');
    if (!saved) return null;
    const { weekOf } = JSON.parse(saved);
    // Allow showing again after a week
    const d = new Date(weekOf + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0] > today ? weekOf : null;
  });

  const { data: meals = [], isLoading: mealsLoading } = useQuery({
    queryKey: ['meals', today],
    queryFn: () => api.get('/meals', { params: { date: today } }).then(r => r.data),
  });

  const { data: goals } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then(r => r.data),
  });

  const { data: historyMeals = [] } = useQuery({
    queryKey: ['meals-history', today],
    queryFn: () => api.get('/meals/history', { params: { days: 7, today } }).then(r => r.data),
  });

  const { data: topFoods = [] } = useQuery({
    queryKey: ['top-foods', today],
    queryFn: () => api.get('/meals/top-foods', { params: { days: 30, today } }).then(r => r.data),
  });

  const { data: suggestionData } = useQuery({
    queryKey: ['suggestion', today],
    queryFn: () => api.get('/suggestions', { params: { today, hour: new Date().getHours() } }).then(r => r.data),
  });

  const { data: weeklySummary } = useQuery({
    queryKey: ['weekly-summary'],
    queryFn: () => api.get('/reports/weekly-summary', { params: { today } }).then(r => r.data),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Compute the visible week range for planned meals query
  const weekRange = useMemo(() => {
    const sel = new Date(selectedDate + 'T12:00:00');
    const dow = sel.getDay();
    const start = new Date(sel);
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: formatDate(start), to: formatDate(end) };
  }, [selectedDate]);

  const { data: plannedMeals = [] } = useQuery({
    queryKey: ['planned-meals', weekRange.from, weekRange.to],
    queryFn: () => api.get('/planned-meals', { params: weekRange }).then(r => r.data),
  });

  const datesWithPlans = useMemo(() => {
    const s = new Set();
    plannedMeals.forEach((m) => {
      const d = typeof m.planned_date === 'string' ? m.planned_date.split('T')[0] : m.planned_date;
      s.add(d);
    });
    return s;
  }, [plannedMeals]);

  const selectedDayPlans = plannedMeals.filter((m) => {
    const d = typeof m.planned_date === 'string' ? m.planned_date.split('T')[0] : m.planned_date;
    return d === selectedDate;
  });

  const logPlannedMeal = useMutation({
    mutationFn: (meal) => {
      const n = new Date();
      const localISO = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:00`;
      return api.post(`/planned-meals/${meal.id}/log`, { logged_at: localISO });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });

  const deletePlannedMeal = useMutation({
    mutationFn: (id) => api.delete(`/planned-meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned-meals'] }),
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => api.delete(`/meals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const clearToday = useMutation({
    mutationFn: () => api.delete('/meals/today', { params: { today } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const copyDay = useMutation({
    mutationFn: (from_date) => api.post('/meals/copy-day', { from_date, to_date: today }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meals'] }),
  });

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const macroTotals = {
    protein: meals.reduce((sum, m) => sum + (parseFloat(m.protein_g) || 0), 0),
    carbs: meals.reduce((sum, m) => sum + (parseFloat(m.carbs_g) || 0), 0),
    fat: meals.reduce((sum, m) => sum + (parseFloat(m.fat_g) || 0), 0),
  };
  const macroGoals = goals ? {
    protein: parseFloat(goals.protein_goal_g) || 0,
    carbs: parseFloat(goals.carbs_goal_g) || 0,
    fat: parseFloat(goals.fat_goal_g) || 0,
  } : null;
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

      <div className="card" style={{ marginBottom: '1rem' }}>
        <CalorieBudgetBar consumed={totalCalories} goal={dailyGoal} macros={macroTotals} macroGoals={macroGoals} />
      </div>

      {/* Quick actions grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <Link to="/log" className="quick-action-tile" style={{ '--tile-color': '#2563eb' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          <span>Log</span>
        </Link>
        <Link to="/reports" className="quick-action-tile" style={{ '--tile-color': '#16a34a' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          <span>Reports</span>
        </Link>
        <Link to="/weight" className="quick-action-tile" style={{ '--tile-color': '#06b6d4' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/><path d="M16 7l-4-4-4 4"/><path d="M8 17l4 4 4-4"/></svg>
          <span>Weight</span>
        </Link>
        <Link to="/challenges" className="quick-action-tile" style={{ '--tile-color': '#ea580c' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          <span>Challenges</span>
        </Link>
      </div>

      {/* Smart suggestion banner */}
      {suggestionData?.suggestion && !dismissedSuggestion && (
        <div className="card" style={{ marginBottom: '1rem', background: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem' }}>{suggestionData.suggestion.message}</div>
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                onClick={() => {
                  const s = suggestionData.suggestion;
                  const n = new Date();
                  const localISO = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:00`;
                  api.post('/meals', { meal_type: s.meal_type, name: s.name, calories: s.calories, logged_at: localISO })
                    .then(() => { queryClient.invalidateQueries({ queryKey: ['meals'] }); setDismissedSuggestion(true); });
                }}
              >
                Log it
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setDismissedSuggestion(true)}>
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly AI summary */}
      {weeklySummary?.summary && dismissedWeekly !== weeklySummary.summary.weekOf && (
        <div className="card" style={{ marginBottom: '1rem', background: 'color-mix(in srgb, var(--color-success) 5%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>Weekly Summary</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{weeklySummary.summary.text}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>
                {weeklySummary.summary.daysLogged}/7 days logged &middot; {weeklySummary.summary.avgCal} cal/day avg
              </div>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', flexShrink: 0 }}
              onClick={() => {
                setDismissedWeekly(weeklySummary.summary.weekOf);
                localStorage.setItem('weekly-summary-dismissed', JSON.stringify({ weekOf: weeklySummary.summary.weekOf }));
              }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem', padding: '0.75rem' }}>
        <WeekStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          datesWithPlans={datesWithPlans}
        />
      </div>

      {selectedDayPlans.length > 0 && (
        <PlannedMealsList
          plannedMeals={selectedDayPlans}
          onLog={(meal) => logPlannedMeal.mutate(meal)}
          onDelete={(id) => deletePlannedMeal.mutate(id)}
          canLog={selectedDate <= today}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Meals</h2>
        <div className="dashboard-meal-actions" style={{ display: 'flex', gap: '0.5rem' }}>
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
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setShowPlanForm(true)}
          >
            + Plan Meal
          </button>
          <Link to="/log" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            + Log Meal
          </Link>
        </div>
      </div>

      {showPlanForm && (
        <PlanMealForm
          date={selectedDate}
          onClose={() => setShowPlanForm(false)}
          onSuccess={() => setShowPlanForm(false)}
        />
      )}

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
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Your Favorites</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>Most eaten - last 30 days</p>
          <div className="top-foods-list">
            {topFoods.map((food, i) => (
              <div key={food.name} className="top-food-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <HistoryDateSection key={date} date={date} meals={dateMeals} onCopyToToday={(d) => copyDay.mutate(d)} />
            ))}
        </div>
      )}
    </div>
  );
}

function HistoryDateSection({ date, meals, onCopyToToday }) {
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
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', margin: '0.4rem 0.5rem' }}
            onClick={(e) => { e.stopPropagation(); onCopyToToday(date); }}
          >
            Copy to today
          </button>
        </div>
      )}
    </div>
  );
}
