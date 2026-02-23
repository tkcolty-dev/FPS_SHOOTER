import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const today = new Date().toISOString().split('T')[0];

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/reports/leaderboard', { params: { today } }).then(r => r.data),
  });

  if (isLoading || leaderboard.length === 0) return null;

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Leaderboard</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {leaderboard.map((entry, i) => (
          <div key={entry.username} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0' }}>
            <span style={{ width: 24, textAlign: 'center', fontSize: '0.9rem' }}>
              {i < 3 ? medals[i] : `${i + 1}.`}
            </span>
            <span style={{ flex: 1, fontWeight: 500, fontSize: '0.85rem' }}>{entry.username}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {entry.currentStreak > 0 ? `${entry.currentStreak}d streak` : ''} &middot; {entry.daysLast30}/30
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
