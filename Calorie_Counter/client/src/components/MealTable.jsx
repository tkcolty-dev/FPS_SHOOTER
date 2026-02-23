import { useState } from 'react';

const typeColors = {
  breakfast: '#f59e0b',
  lunch: '#3b82f6',
  dinner: '#8b5cf6',
  snack: '#10b981',
};

const typeOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealTable({ meals, onDelete }) {
  const [collapsed, setCollapsed] = useState({});

  const mealsByType = {};
  for (const type of typeOrder) {
    const items = meals.filter(m => m.meal_type === type);
    if (items.length > 0) mealsByType[type] = items;
  }

  const toggle = (type) => {
    setCollapsed(prev => ({ ...prev, [type]: !prev[type] }));
  };

  if (Object.keys(mealsByType).length === 0) {
    return null;
  }

  return (
    <div>
      {typeOrder.map(type => {
        const items = mealsByType[type];
        if (!items) return null;
        const subtotal = items.reduce((s, m) => s + m.calories, 0);
        const isCollapsed = collapsed[type];

        return (
          <div key={type} className="meal-table-section">
            <div className="meal-table-header" onClick={() => toggle(type)}>
              <div className="meal-table-header-left">
                <span className="meal-type-dot" style={{ background: typeColors[type] }} />
                <span className="meal-table-header-label">{type}</span>
                <span className="meal-table-header-count">({items.length})</span>
              </div>
              <span className="meal-table-header-cal">{subtotal} cal</span>
            </div>
            {!isCollapsed && (
              <div className="meal-table-rows">
                {items.map(meal => (
                  <div key={meal.id} className="meal-table-row">
                    <span className="meal-table-row-name">{meal.name}</span>
                    <span className="meal-table-row-cal">{meal.calories} cal</span>
                    <span className="meal-table-row-time">
                      {new Date(meal.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {onDelete && (
                      <button className="meal-table-row-delete" onClick={() => onDelete(meal.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
