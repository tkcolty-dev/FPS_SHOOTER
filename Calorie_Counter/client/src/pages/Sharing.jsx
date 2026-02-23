import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import MealCard from '../components/MealCard';
import CalorieBudgetBar from '../components/CalorieBudgetBar';
import { markSharesSeen } from '../hooks/useNewShares';
import Leaderboard from '../components/Leaderboard';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function Sharing() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [commentText, setCommentText] = useState('');
  const commentsEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: sharingData, isLoading } = useQuery({
    queryKey: ['sharing'],
    queryFn: () => api.get('/sharing').then(r => r.data),
  });

  // Mark all shares as seen when page loads
  useEffect(() => {
    if (sharingData?.sharedWithMe) {
      markSharesSeen(sharingData.sharedWithMe.map(s => s.id));
    }
  }, [sharingData?.sharedWithMe]);

  const { data: sharedMeals } = useQuery({
    queryKey: ['shared-meals', viewingUser?.owner_id, viewDate],
    queryFn: () => api.get(`/sharing/${viewingUser.owner_id}/meals`, { params: { date: viewDate } }).then(r => r.data),
    enabled: !!viewingUser,
  });

  const { data: sharedPlanned } = useQuery({
    queryKey: ['shared-planned', viewingUser?.owner_id, viewDate],
    queryFn: () => api.get(`/sharing/${viewingUser.owner_id}/planned-meals`, { params: { from: viewDate } }).then(r => r.data),
    enabled: !!viewingUser && !!viewingUser.share_planned,
  });

  const activeShareId = viewingUser
    ? (sharingData?.sharedWithMe?.find(s => s.owner_id === viewingUser.owner_id)?.id)
    : null;

  const { data: commentsData } = useQuery({
    queryKey: ['share-comments', activeShareId],
    queryFn: () => api.get(`/sharing/${activeShareId}/comments`).then(r => r.data),
    enabled: !!activeShareId,
    refetchInterval: 15000,
  });

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commentsData?.comments?.length]);

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

  const togglePlanned = useMutation({
    mutationFn: ({ id, share_planned }) => api.patch(`/sharing/${id}`, { share_planned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sharing'] }),
  });

  const postComment = useMutation({
    mutationFn: (text) => api.post(`/sharing/${activeShareId}/comments`, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-comments', activeShareId] });
      setCommentText('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    addShare.mutate(username.trim());
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    postComment.mutate(commentText.trim());
  };

  if (isLoading) return <div className="loading">Loading sharing settings...</div>;

  const { sharing = [], sharedWithMe = [] } = sharingData || {};
  const plannedMeals = sharedPlanned?.plannedMeals || [];

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
                  padding: '0.5rem 0.75rem',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{share.viewer_username}</span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => removeShare.mutate(share.id)}
                  >
                    Revoke
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!share.share_planned}
                    onChange={() => togglePlanned.mutate({ id: share.id, share_planned: !share.share_planned })}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  Share planned meals
                </label>
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
                onClick={() => {
                  if (viewingUser?.owner_id === share.owner_id) {
                    setViewingUser(null);
                  } else {
                    setViewingUser(share);
                    setViewDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: viewingUser?.owner_id === share.owner_id ? 'rgba(37, 99, 235, 0.05)' : 'var(--color-bg)',
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

        {/* Viewing shared user's data */}
        {sharedWithMe.length > 0 && <Leaderboard />}

        {viewingUser && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            {/* Date navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <button
                className="btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                onClick={() => setViewDate(addDays(viewDate, -1))}
              >
                &larr; Prev
              </button>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {isToday(viewDate) ? 'Today' : formatDate(viewDate)}
              </span>
              <button
                className="btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                onClick={() => setViewDate(addDays(viewDate, 1))}
              >
                Next &rarr;
              </button>
            </div>

            {/* Logged meals */}
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {viewingUser.owner_username}'s Logged Meals
            </h3>
            {sharedMeals && (
              <>
                <CalorieBudgetBar
                  consumed={sharedMeals.meals.reduce((s, m) => s + m.calories, 0)}
                  goal={sharedMeals.goals.daily_total}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {sharedMeals.meals.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No meals logged.</p>
                  ) : (
                    sharedMeals.meals.map(meal => <MealCard key={meal.id} meal={meal} />)
                  )}
                </div>
              </>
            )}

            {/* Planned meals */}
            {viewingUser.share_planned && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Planned Meals</h3>
                  {plannedMeals.length > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {plannedMeals.reduce((s, m) => s + m.calories, 0)} cal planned
                    </span>
                  )}
                </div>
                {plannedMeals.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No planned meals for this day.</p>
                ) : (
                  plannedMeals.map(meal => (
                    <div key={meal.id} className="planned-meal-item" style={{ cursor: 'default' }}>
                      <span className="planned-meal-pending" title="Planned">&#x25CB;</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meal.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {meal.meal_type} &middot; {meal.calories} cal
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Comments */}
            {activeShareId && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Comments</h3>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  minHeight: '60px',
                }}>
                  {(!commentsData?.comments || commentsData.comments.length === 0) ? (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 'auto', textAlign: 'center' }}>
                      No comments yet. Send some encouragement!
                    </p>
                  ) : (
                    commentsData.comments.map(c => (
                      <div key={c.id} style={{ fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{c.sender_username}</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', marginLeft: '0.4rem' }}>
                          {new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{ marginTop: '0.1rem' }}>{c.text}</div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>
                <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.6rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.85rem',
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} disabled={postComment.isPending}>
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
