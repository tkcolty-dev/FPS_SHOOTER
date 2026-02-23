export default function SuggestionCard({ suggestion, onLog }) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{suggestion.name}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          {suggestion.description}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          {suggestion.ingredients?.join(', ')}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>
          {suggestion.calories} cal
        </div>
        {onLog && (
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            onClick={() => onLog(suggestion)}
          >
            Log this
          </button>
        )}
      </div>
    </div>
  );
}
