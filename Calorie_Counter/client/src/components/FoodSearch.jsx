import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

export default function FoodSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/foods', { params: { q: query } });
        setResults(res.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (food) => {
    onSelect(food);
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  const handleFavorite = async (e, food) => {
    e.stopPropagation();
    try {
      if (food.isFavorite) {
        // Unfavorite — need to find the preference ID first
        const prefs = await api.get('/preferences');
        const match = prefs.data.find(
          (p) => p.preference_type === 'favorite' && p.value.toLowerCase() === food.name.toLowerCase()
        );
        if (match) {
          await api.delete(`/preferences/${match.id}`);
        }
      } else {
        await api.post('/preferences', {
          preference_type: 'favorite',
          value: food.name,
        });
      }
      // Update the result in place
      setResults((prev) =>
        prev.map((r) =>
          r.id === food.id ? { ...r, isFavorite: !r.isFavorite } : r
        )
      );
    } catch {}
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search foods (e.g. DiGiorno pizza, thin crust, Big Mac)..."
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
      {searching && query.length >= 2 && (
        <div style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
        }}>
          Searching...
        </div>
      )}
      {open && results.length > 0 && (
        <div className="food-search-dropdown">
          {results.map((food) => (
            <div
              key={food.id}
              className="food-search-item"
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <button
                onClick={() => handleSelect(food)}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  textAlign: 'left', font: 'inherit', color: 'inherit',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                    {food.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {food.brand && (
                      <span className="food-brand-badge">{food.brand}</span>
                    )}
                    <span>{food.serving_size}</span>
                  </div>
                </div>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center', fontSize: '0.85rem', marginRight: '0.5rem' }}>
                  {food.calories_per_serving} cal
                </span>
              </button>
              <button
                onClick={(e) => handleFavorite(e, food)}
                title={food.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`food-fav-btn${food.isFavorite ? ' active' : ''}`}
              >
                {food.isFavorite ? '\u2605' : '\u2606'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
