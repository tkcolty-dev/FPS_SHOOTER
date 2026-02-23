const barContainerStyle = {
  background: '#f1f5f9',
  borderRadius: 12,
  height: 24,
  overflow: 'hidden',
  position: 'relative',
};

export default function CalorieBudgetBar({ consumed, goal }) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const remaining = Math.max(goal - consumed, 0);
  const isOver = consumed > goal;

  const barColor = isOver
    ? 'var(--color-danger)'
    : pct > 80
      ? 'var(--color-warning)'
      : 'var(--color-success)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.875rem' }}>
        <span style={{ fontWeight: 600 }}>{consumed.toLocaleString()} cal consumed</span>
        <span style={{ color: isOver ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
          {isOver ? `${(consumed - goal).toLocaleString()} over` : `${remaining.toLocaleString()} remaining`}
        </span>
      </div>
      <div style={barContainerStyle}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 12,
            transition: 'width 0.4s ease, background 0.3s',
          }}
        />
      </div>
      <div style={{ textAlign: 'right', marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
        Goal: {goal.toLocaleString()} cal
      </div>
    </div>
  );
}
