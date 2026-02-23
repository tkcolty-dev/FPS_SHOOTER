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

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search foods (e.g. chicken, pizza, Big Mac)..."
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
            <button
              key={food.id}
              onClick={() => handleSelect(food)}
              className="food-search-item"
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{food.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {food.brand && (
                    <span className="food-brand-badge">{food.brand}</span>
                  )}
                  <span>{food.serving_size}</span>
                  {food.source === 'usda' && !food.brand && (
                    <span style={{ color: '#8b5cf6' }}>USDA</span>
                  )}
                </div>
              </div>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center', fontSize: '0.85rem' }}>
                {food.calories_per_serving} cal
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
