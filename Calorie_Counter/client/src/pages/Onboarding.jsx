import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FoodSearch from '../components/FoodSearch';

const SUGGESTIONS = [
  'Pizza', 'Sushi', 'Tacos', 'Pasta', 'Burgers', 'Salad',
  'Steak', 'Chicken', 'Rice', 'Salmon', 'Soup', 'Sandwich',
  'Curry', 'Ramen', 'Stir Fry', 'Oatmeal', 'Eggs', 'Smoothie',
  'Avocado Toast', 'Grilled Cheese', 'Wings', 'Shrimp', 'Tofu', 'Yogurt',
];

export default function Onboarding() {
  const [favorites, setFavorites] = useState([]);
  const [customFood, setCustomFood] = useState('');
  const { completeOnboarding, user } = useAuth();
  const navigate = useNavigate();

  const saveFavorites = useMutation({
    mutationFn: async () => {
      // Save all favorites as preferences
      await Promise.all(
        favorites.map(food =>
          api.post('/preferences', { preference_type: 'favorite', value: food })
        )
      );
      await completeOnboarding();
    },
    onSuccess: () => navigate('/'),
  });

  const toggleFavorite = (food) => {
    setFavorites(prev =>
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
  };

  const addCustom = () => {
    const trimmed = customFood.trim();
    if (trimmed && !favorites.includes(trimmed)) {
      setFavorites(prev => [...prev, trimmed]);
      setCustomFood('');
    }
  };

  const handleFoodSelect = (food) => {
    if (!favorites.includes(food.name)) {
      setFavorites(prev => [...prev, food.name]);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            Welcome, {user?.username}!
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, fontSize: '1rem' }}>
            What are your favorite foods? This helps us give you better meal suggestions.
          </p>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>
            Tap to select your favorites
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {SUGGESTIONS.map(food => {
              const selected = favorites.includes(food);
              return (
                <button
                  key={food}
                  onClick={() => toggleFavorite(food)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: 20,
                    border: selected ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                    background: selected ? 'rgba(37, 99, 235, 0.1)' : 'white',
                    color: selected ? 'var(--color-primary)' : 'var(--color-text)',
                    fontWeight: selected ? 600 : 400,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {food}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>
            Search for more or add your own
          </label>
          <FoodSearch onSelect={handleFoodSelect} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              value={customFood}
              onChange={(e) => setCustomFood(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder="Type a food and press Enter..."
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem',
              }}
            />
            <button className="btn btn-secondary" onClick={addCustom}>Add</button>
          </div>
        </div>

        {favorites.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>
              Your favorites ({favorites.length})
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {favorites.map(food => (
                <span
                  key={food}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.3rem 0.75rem',
                    background: 'rgba(37, 99, 235, 0.1)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    borderRadius: 20,
                    fontSize: '0.85rem',
                    color: 'var(--color-primary)',
                    fontWeight: 500,
                  }}
                >
                  {food}
                  <button
                    onClick={() => toggleFavorite(food)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-secondary)', fontSize: '1rem', lineHeight: 1, padding: 0,
                    }}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-primary"
            onClick={() => saveFavorites.mutate()}
            disabled={saveFavorites.isPending || favorites.length === 0}
            style={{ flex: 1, padding: '0.75rem', fontSize: '1rem' }}
          >
            {saveFavorites.isPending ? 'Saving...' : `Continue with ${favorites.length} favorite${favorites.length !== 1 ? 's' : ''}`}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSkip}
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
