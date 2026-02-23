import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

const typeLabels = {
  cuisine: 'Cuisine',
  dietary: 'Dietary',
  favorite: 'Favorite Foods',
  dislike: 'Dislikes',
};

const typeColors = {
  cuisine: '#3b82f6',
  dietary: '#16a34a',
  favorite: '#f59e0b',
  dislike: '#dc2626',
};

export default function Preferences() {
  const [type, setType] = useState('cuisine');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => api.get('/preferences').then(r => r.data),
  });

  const addPref = useMutation({
    mutationFn: (data) => api.post('/preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      setValue('');
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to add'),
  });

  const deletePref = useMutation({
    mutationFn: (id) => api.delete(`/preferences/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    addPref.mutate({ preference_type: type, value: value.trim() });
  };

  const grouped = {};
  for (const pref of preferences) {
    if (!grouped[pref.preference_type]) grouped[pref.preference_type] = [];
    grouped[pref.preference_type].push(pref);
  }

  if (isLoading) return <div className="loading">Loading preferences...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Food Preferences</h1>
        <p>Help the AI give you better meal suggestions</p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
        {error && <div className="error-message">{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label htmlFor="prefType">Type</label>
            <select id="prefType" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="cuisine">Cuisine</option>
              <option value="dietary">Dietary</option>
              <option value="favorite">Favorite Food</option>
              <option value="dislike">Dislike</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="prefValue">Value</label>
            <input
              id="prefValue"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'cuisine' ? 'e.g. Italian, Mexican' : type === 'dietary' ? 'e.g. vegetarian, gluten-free' : type === 'favorite' ? 'e.g. sushi, pizza' : 'e.g. mushrooms, liver'}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={addPref.isPending}
            style={{ padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}
          >
            Add
          </button>
        </div>
      </form>

      {Object.keys(grouped).length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No preferences set yet. Add some to improve your AI suggestions!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(typeLabels).map(([key, label]) => {
            const items = grouped[key];
            if (!items) return null;
            return (
              <div key={key} className="card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: typeColors[key] }}>
                  {label}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {items.map(pref => (
                    <span
                      key={pref.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.75rem',
                        background: `${typeColors[key]}10`,
                        border: `1px solid ${typeColors[key]}30`,
                        borderRadius: 20,
                        fontSize: '0.85rem',
                      }}
                    >
                      {pref.value}
                      <button
                        onClick={() => deletePref.mutate(pref.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary)',
                          fontSize: '1rem',
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
