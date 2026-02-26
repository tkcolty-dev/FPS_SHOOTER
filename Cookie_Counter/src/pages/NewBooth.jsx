import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { COOKIE_TYPES, BOXES_PER_CASE, getEmptyInventory } from '../data/cookies';

function resizeImage(file, maxSize = 256) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { h = (h / w) * maxSize; w = maxSize; }
        else { w = (w / h) * maxSize; h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function NewBooth() {
  const navigate = useNavigate();
  const { createBooth } = useBooth();
  const [name, setName] = useState('');
  const [startingCash, setStartingCash] = useState('');
  const [cases, setCases] = useState(getEmptyInventory(0));
  const [boxes, setBoxes] = useState(getEmptyInventory(0));
  const [thumbnail, setThumbnail] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

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

  async function handleThumbnail(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setThumbnail(dataUrl);
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
      const booth = await createBooth(name.trim(), startingCash, inventory, thumbnail);
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

            <div className="form-group">
              <label className="form-label">
                Thumbnail <span className="form-hint">(optional photo for this booth)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnail}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {thumbnail ? (
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: 14,
                      overflow: 'hidden', flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}
                  >
                    <img src={thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: 14,
                      background: 'var(--bg)', border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'var(--text-secondary)', fontSize: '1.5rem',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    {thumbnail ? 'Change Photo' : 'Add Photo'}
                  </button>
                  {thumbnail && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setThumbnail(null)}
                      style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '2px 8px', minHeight: 0 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
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
                      {cookie.image
                        ? <img src={cookie.image} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain', flexShrink: 0 }} />
                        : <span className="inventory-dot" style={{ background: cookie.color }} />
                      }
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
