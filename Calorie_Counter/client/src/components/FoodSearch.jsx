import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

export default function FoodSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/foods', { params: { q: query } });
        setResults(res.data);
        setOpen(true);
      } catch {
        setResults([]);
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
        placeholder="Search foods (e.g. chicken, rice, salad)..."
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: 240,
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          {results.map((food) => (
            <button
              key={food.id}
              onClick={() => handleSelect(food)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.85rem',
                borderBottom: '1px solid var(--color-border)',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{food.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {food.serving_size} · {food.category}
                </div>
              </div>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                {food.calories_per_serving} cal
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
