import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { useAuth } from '../context/AuthContext';
import { COOKIE_TYPES } from '../data/cookies';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Navbar from '../components/Navbar';

export default function Settings() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { fetchBooth, deleteBooth, fetchMembers, addMember, removeMember } = useBooth();
  const { user, logout } = useAuth();
  const [booth, setBooth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Members state
  const [membersData, setMembersData] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    fetchBooth(boothId)
      .then(setBooth)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boothId, fetchBooth]);

  useEffect(() => {
    if (booth) {
      fetchMembers(boothId)
        .then(setMembersData)
        .catch(() => {});
    }
  }, [boothId, booth, fetchMembers]);

  if (loading) {
    return (
      <div className="app-main">
        <div className="container" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        </div>
        <Navbar />
      </div>
    );
  }

  if (!booth) return null;

  const isOwner = booth.isOwner !== false;

  async function handleDelete() {
    await deleteBooth(boothId);
    navigate('/booths');
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setMemberError('');
    setAddingMember(true);
    try {
      await addMember(boothId, newUsername.trim());
      setNewUsername('');
      const data = await fetchMembers(boothId);
      setMembersData(data);
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(memberId) {
    try {
      await removeMember(boothId, memberId);
      const data = await fetchMembers(boothId);
      setMembersData(data);
    } catch (err) {
      setMemberError(err.message);
    }
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

        {/* Members */}
        <div className="settings-section">
          <div className="settings-section-title">Members</div>
          {membersData && (
            <>
              {/* Owner */}
              <div className="settings-item">
                <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {membersData.owner.name}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    @{membersData.owner.username}
                  </span>
                </span>
                <span className="settings-item-value" style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Owner
                </span>
              </div>

              {/* Members list */}
              {membersData.members.map(member => (
                <div key={member.id} className="settings-item">
                  <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {member.name}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      @{member.username}
                    </span>
                  </span>
                  {isOwner && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleRemoveMember(member.id)}
                      style={{
                        color: 'var(--danger)',
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        minHeight: 0,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              {membersData.members.length === 0 && (
                <div style={{ padding: '8px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  No shared members yet
                </div>
              )}

              {/* Add member form (owner only) */}
              {isOwner && (
                <form onSubmit={handleAddMember} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Username to add..."
                    value={newUsername}
                    onChange={e => { setNewUsername(e.target.value); setMemberError(''); }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={addingMember || !newUsername.trim()}
                  >
                    {addingMember ? '...' : 'Add'}
                  </button>
                </form>
              )}
              {memberError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 6 }}>
                  {memberError}
                </div>
              )}
            </>
          )}
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
          {isOwner && (
            <button
              className="btn btn-danger btn-block"
              onClick={() => setShowDeleteConfirm(true)}
              style={{ marginBottom: 10 }}
            >
              Delete This Booth
            </button>
          )}
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
