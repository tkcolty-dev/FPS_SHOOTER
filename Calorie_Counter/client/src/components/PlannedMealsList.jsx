export default function PlannedMealsList({ plannedMeals, onLog, onDelete }) {
  if (plannedMeals.length === 0) return null;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>Planned Meals</h3>
      {plannedMeals.map((meal) => (
        <div key={meal.id} className="planned-meal-item">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meal.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {meal.meal_type} &middot; {meal.calories} cal
            </div>
          </div>
          <div className="planned-meal-actions">
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              onClick={() => onLog(meal)}
            >
              Log
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              onClick={() => onDelete(meal.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
