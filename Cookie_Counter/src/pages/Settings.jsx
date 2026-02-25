import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { useAuth } from '../context/AuthContext';
import { COOKIE_TYPES } from '../data/cookies';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Navbar from '../components/Navbar';

export default function Settings() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { getBooth, deleteBooth, getBoothStats } = useBooth();
  const { user, logout } = useAuth();
  const booth = getBooth(boothId);
  const stats = getBoothStats(boothId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!booth) return null;

  function handleDelete() {
    deleteBooth(boothId);
    navigate('/booths');
  }

  return (
    <div className="app-main">
      <div className="container animate-in">
        <div className="page-header">
          <h1>Settings</h1>
          <p>{booth.name}</p>
        </div>

        {/* Booth info */}
        <div className="settings-section">
          <div className="settings-section-title">Booth Info</div>
          <div className="settings-item">
            <span className="settings-item-label">Name</span>
            <span className="settings-item-value">{booth.name}</span>
          </div>
          <div className="settings-item">
            <span className="settings-item-label">Created</span>
            <span className="settings-item-value">{formatDateTime(booth.createdAt)}</span>
          </div>
          <div className="settings-item">
            <span className="settings-item-label">Starting Cash</span>
            <span className="settings-item-value">{formatCurrency(booth.startingCash)}</span>
          </div>
        </div>

        {/* Starting inventory */}
        <div className="settings-section">
          <div className="settings-section-title">Starting Inventory</div>
          {COOKIE_TYPES.map(cookie => {
            const starting = booth.inventory[cookie.id] || 0;
            if (starting === 0) return null;
            return (
              <div key={cookie.id} className="settings-item">
                <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: cookie.color,
                    flexShrink: 0,
                  }} />
                  {cookie.name}
                </span>
                <span className="settings-item-value">{starting} boxes</span>
              </div>
            );
          })}
        </div>

        {/* Account */}
        <div className="settings-section">
          <div className="settings-section-title">Account</div>
          <div className="settings-item">
            <span className="settings-item-label">Name</span>
            <span className="settings-item-value">{user?.name}</span>
          </div>
          <div className="settings-item">
            <span className="settings-item-label">Username</span>
            <span className="settings-item-value">{user?.username}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-section">
          <div className="settings-section-title">Actions</div>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/booths')}
            style={{ marginBottom: 10 }}
          >
            Switch Booth
          </button>
          <button
            className="btn btn-danger btn-block"
            onClick={() => setShowDeleteConfirm(true)}
            style={{ marginBottom: 10 }}
          >
            Delete This Booth
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={logout}
            style={{ color: 'var(--text-secondary)' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delete "{booth.name}"?</h3>
            <p>This will permanently delete this booth and all its orders. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}
