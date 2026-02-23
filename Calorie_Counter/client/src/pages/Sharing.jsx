import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import MealCard from '../components/MealCard';
import CalorieBudgetBar from '../components/CalorieBudgetBar';

export default function Sharing() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: sharingData, isLoading } = useQuery({
    queryKey: ['sharing'],
    queryFn: () => api.get('/sharing').then(r => r.data),
  });

  const { data: sharedMeals } = useQuery({
    queryKey: ['shared-meals', viewingUser?.owner_id, today],
    queryFn: () => api.get(`/sharing/${viewingUser.owner_id}/meals`, { params: { date: today } }).then(r => r.data),
    enabled: !!viewingUser,
  });

  const addShare = useMutation({
    mutationFn: (viewer_username) => api.post('/sharing', { viewer_username }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharing'] });
      setUsername('');
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to share'),
  });

  const removeShare = useMutation({
    mutationFn: (id) => api.delete(`/sharing/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sharing'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    addShare.mutate(username.trim());
  };

  if (isLoading) return <div className="loading">Loading sharing settings...</div>;

  const { sharing = [], sharedWithMe = [] } = sharingData || {};

  return (
    <div>
      <div className="page-header">
        <h1>Sharing</h1>
        <p>Share your progress or view friends' data</p>
      </div>

      {/* Grant access */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Share Your Data</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username to share with"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem',
              }}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={addShare.isPending}>
            Share
          </button>
        </form>
        {error && <div className="error-message" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{error}</div>}
      </div>

      {/* People you share with */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>People You Share With</h2>
        {sharing.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            You haven't shared your data with anyone yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sharing.map(share => (
              <div
                key={share.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500 }}>{share.viewer_username}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                    {share.viewer_email}
                  </span>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => removeShare.mutate(share.id)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shared with me */}
      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Shared With Me</h2>
        {sharedWithMe.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Nobody has shared their data with you yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sharedWithMe.map(share => (
              <button
                key={share.id}
                onClick={() => setViewingUser(viewingUser?.owner_id === share.owner_id ? null : share)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: viewingUser?.owner_id === share.owner_id ? 'rgba(37, 99, 235, 0.05)' : '#f8fafc',
                  border: viewingUser?.owner_id === share.owner_id ? '1px solid var(--color-primary)' : '1px solid transparent',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
              >
                <span style={{ fontWeight: 500 }}>{share.owner_username}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                  {viewingUser?.owner_id === share.owner_id ? 'Hide' : 'View meals'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Viewing shared user's meals */}
        {viewingUser && sharedMeals && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              {viewingUser.owner_username}'s meals today
            </h3>
            <CalorieBudgetBar
              consumed={sharedMeals.meals.reduce((s, m) => s + m.calories, 0)}
              goal={sharedMeals.goals.daily_total}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {sharedMeals.meals.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No meals logged today.</p>
              ) : (
                sharedMeals.meals.map(meal => <MealCard key={meal.id} meal={meal} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
