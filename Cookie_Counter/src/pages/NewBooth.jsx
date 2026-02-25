import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { COOKIE_TYPES, BOXES_PER_CASE, getEmptyInventory } from '../data/cookies';

export default function NewBooth() {
  const navigate = useNavigate();
  const { createBooth } = useBooth();
  const [name, setName] = useState('');
  const [startingCash, setStartingCash] = useState('');
  const [cases, setCases] = useState(getEmptyInventory(0));
  const [boxes, setBoxes] = useState(getEmptyInventory(0));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateCases(cookieId, value) {
    const num = value === '' ? 0 : parseInt(value) || 0;
    setCases(prev => ({ ...prev, [cookieId]: Math.max(0, num) }));
  }

  function updateBoxes(cookieId, value) {
    const num = value === '' ? 0 : parseInt(value) || 0;
    setBoxes(prev => ({ ...prev, [cookieId]: Math.max(0, num) }));
  }

  function getTotalBoxes(cookieId) {
    return (cases[cookieId] || 0) * BOXES_PER_CASE + (boxes[cookieId] || 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter a booth name');
      return;
    }
    const inventory = {};
    COOKIE_TYPES.forEach(c => {
      inventory[c.id] = getTotalBoxes(c.id);
    });
    setSubmitting(true);
    try {
      const booth = await createBooth(name.trim(), startingCash, inventory);
      if (booth) navigate(`/booth/${booth.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create booth');
    }
    setSubmitting(false);
  }

  const totalAllBoxes = COOKIE_TYPES.reduce((sum, c) => sum + getTotalBoxes(c.id), 0);

  return (
    <div className="app-main" style={{ paddingBottom: 32 }}>
      <div className="container">
        <Link to="/booths" className="back-btn">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </Link>

        <div className="page-header">
          <h1>New Booth</h1>
          <p>Set up your cookie booth</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginBottom: '16px',
            }}>{error}</div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Booth Name</label>
              <input
                type="text"
                className="form-input"
                placeholder='e.g. "Walmart Saturday" or "Spring Sale"'
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Starting Cash <span className="form-hint">(money in the cash box)</span>
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={startingCash}
                onChange={e => setStartingCash(e.target.value)}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Starting Inventory</span>
              <span className="badge badge-primary">{totalAllBoxes} boxes</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              1 case = {BOXES_PER_CASE} boxes
            </div>
            <div className="inv-setup-list">
              {COOKIE_TYPES.map(cookie => {
                const total = getTotalBoxes(cookie.id);
                return (
                  <div className="inv-setup-row" key={cookie.id}>
                    <div className="inv-setup-label">
                      <span className="inventory-dot" style={{ background: cookie.color }} />
                      <span className="inv-setup-name">{cookie.name}</span>
                      {total > 0 && (
                        <span className="inv-setup-total">= {total}</span>
                      )}
                    </div>
                    <div className="inv-setup-inputs">
                      <div className="inv-setup-field">
                        <input
                          type="number"
                          className="inventory-input"
                          inputMode="numeric"
                          min="0"
                          value={cases[cookie.id] || ''}
                          placeholder="0"
                          onChange={e => updateCases(cookie.id, e.target.value)}
                        />
                        <span className="inv-setup-unit">cs</span>
                      </div>
                      <div className="inv-setup-field">
                        <input
                          type="number"
                          className="inventory-input"
                          inputMode="numeric"
                          min="0"
                          value={boxes[cookie.id] || ''}
                          placeholder="0"
                          onChange={e => updateBoxes(cookie.id, e.target.value)}
                        />
                        <span className="inv-setup-unit">bx</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Booth'}
          </button>
        </form>
      </div>
    </div>
  );
}
