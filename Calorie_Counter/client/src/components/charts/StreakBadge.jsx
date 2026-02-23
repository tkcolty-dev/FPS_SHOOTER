export default function StreakBadge({ currentStreak, longestStreak, totalDaysLogged }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ fontSize: '1.8rem' }}>{currentStreak > 0 ? '\uD83D\uDD25' : '\u2744\uFE0F'}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{currentStreak}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Current streak</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ fontSize: '1.8rem' }}>{'\uD83C\uDFC6'}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{longestStreak}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Best streak</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ fontSize: '1.8rem' }}>{'\uD83D\uDCC5'}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totalDaysLogged}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Days logged</div>
      </div>
    </div>
  );
}
