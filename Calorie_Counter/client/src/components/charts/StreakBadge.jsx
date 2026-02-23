const iconColor = 'var(--color-primary)';

function FlameIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" fill={iconColor} stroke="none" opacity="0.15" />
      <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" />
    </svg>
  );
}

function SnowflakeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <line x1="12" y1="2" x2="9" y2="5" />
      <line x1="12" y1="2" x2="15" y2="5" />
      <line x1="12" y1="22" x2="9" y2="19" />
      <line x1="12" y1="22" x2="15" y2="19" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
      <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" />
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" fill={iconColor} stroke="none" opacity="0.15" />
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" />
      <path d="M10 16h4v4H10z" />
      <path d="M8 20h8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" fill={iconColor} opacity="0.15" stroke="none" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  );
}

export default function StreakBadge({ currentStreak, longestStreak, totalDaysLogged }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          {currentStreak > 0 ? <FlameIcon /> : <SnowflakeIcon />}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{currentStreak}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Current streak</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <TrophyIcon />
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{longestStreak}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Best streak</div>
      </div>
      <div style={{ textAlign: 'center', flex: 1, minWidth: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <CalendarIcon />
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{totalDaysLogged}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Days logged</div>
      </div>
    </div>
  );
}
