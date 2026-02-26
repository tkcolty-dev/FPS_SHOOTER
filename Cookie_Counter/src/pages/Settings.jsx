import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBooth } from '../context/BoothContext';
import { useAuth } from '../context/AuthContext';
import { COOKIE_TYPES, BOXES_PER_CASE, getEmptyInventory } from '../data/cookies';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Navbar from '../components/Navbar';

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

export default function Settings() {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { fetchBooth, updateBooth, deleteBooth, fetchMembers, addMember, removeMember, restockBooth } = useBooth();
  const { user, logout } = useAuth();
  const [booth, setBooth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileRef = useRef(null);

  // Members state
  const [membersData, setMembersData] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [restockCases, setRestockCases] = useState(getEmptyInventory(0));
  const [restockBoxes, setRestockBoxes] = useState(getEmptyInventory(0));
  const [restocking, setRestocking] = useState(false);

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

  async function handleThumbnailChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    await updateBooth(boothId, { thumbnail: dataUrl });
    setBooth(prev => ({ ...prev, thumbnail: dataUrl }));
  }

  async function handleRemoveThumbnail() {
    await updateBooth(boothId, { thumbnail: null });
    setBooth(prev => ({ ...prev, thumbnail: null }));
  }

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

  const getRestockTotal = (cookieId) =>
    (restockCases[cookieId] || 0) * BOXES_PER_CASE + (restockBoxes[cookieId] || 0);

  const totalRestockBoxes = COOKIE_TYPES.reduce((sum, c) => sum + getRestockTotal(c.id), 0);

  function openRestock() {
    setRestockCases(getEmptyInventory(0));
    setRestockBoxes(getEmptyInventory(0));
    setShowRestock(true);
  }

  async function handleRestock() {
    const inventory = {};
    COOKIE_TYPES.forEach(c => {
      const total = getRestockTotal(c.id);
      if (total > 0) inventory[c.id] = total;
    });
    if (Object.keys(inventory).length === 0) return;
    setRestocking(true);
    try {
      const updated = await restockBooth(boothId, inventory);
      setBooth(updated);
      setShowRestock(false);
    } catch (err) {
      alert(err.message || 'Failed to restock');
    } finally {
      setRestocking(false);
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            style={{ display: 'none' }}
          />
          <div className="settings-item" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Thumbnail
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {booth.thumbnail ? (
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  overflow: 'hidden', flexShrink: 0,
                  border: '1px solid var(--border)',
                }}>
                  <img src={booth.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--bg)', border: '1px dashed var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                }}>
                  None
                </div>
              )}
              {isOwner && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => fileRef.current?.click()}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', minHeight: 0 }}
                  >
                    {booth.thumbnail ? 'Change' : 'Add'}
                  </button>
                  {booth.thumbnail && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleRemoveThumbnail}
                      style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '4px 10px', minHeight: 0 }}
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="settings-section-title" style={{ marginBottom: 0 }}>Inventory</div>
            <button
              onClick={openRestock}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '5px 14px', minHeight: 0 }}
            >
              + Restock
            </button>
          </div>
          {COOKIE_TYPES.map(cookie => {
            const starting = booth.inventory[cookie.id] || 0;
            if (starting === 0) return null;
            return (
              <div key={cookie.id} className="settings-item">
                <span className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cookie.image
                    ? <img src={cookie.image} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain', flexShrink: 0 }} />
                    : <span style={{ width: 8, height: 8, borderRadius: '50%', background: cookie.color, flexShrink: 0 }} />
                  }
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

      {/* Restock modal */}
      {showRestock && (
        <div className="modal-overlay" onClick={() => setShowRestock(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="card-header" style={{ marginBottom: 8 }}>
              <span className="card-title">Restock Inventory</span>
              {totalRestockBoxes > 0 && (
                <span className="badge badge-primary">+{totalRestockBoxes} boxes</span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              1 case = {BOXES_PER_CASE} boxes
            </div>
            <div className="inv-setup-list">
              {COOKIE_TYPES.map(cookie => {
                const total = getRestockTotal(cookie.id);
                return (
                  <div className="inv-setup-row" key={cookie.id}>
                    <div className="inv-setup-label">
                      {cookie.image
                        ? <img src={cookie.image} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain', flexShrink: 0 }} />
                        : <span className="inventory-dot" style={{ background: cookie.color }} />
                      }
                      <span className="inv-setup-name">{cookie.name}</span>
                      {total > 0 && (
                        <span className="inv-setup-total">= +{total}</span>
                      )}
                    </div>
                    <div className="inv-setup-inputs">
                      <div className="inv-setup-field">
                        <input
                          type="number"
                          className="inventory-input"
                          inputMode="numeric"
                          min="0"
                          value={restockCases[cookie.id] || ''}
                          placeholder="0"
                          onChange={e => setRestockCases(prev => ({ ...prev, [cookie.id]: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="inv-setup-unit">cs</span>
                      </div>
                      <div className="inv-setup-field">
                        <input
                          type="number"
                          className="inventory-input"
                          inputMode="numeric"
                          min="0"
                          value={restockBoxes[cookie.id] || ''}
                          placeholder="0"
                          onChange={e => setRestockBoxes(prev => ({ ...prev, [cookie.id]: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="inv-setup-unit">bx</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="btn btn-block"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                onClick={() => setShowRestock(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-block"
                disabled={totalRestockBoxes === 0 || restocking}
                onClick={handleRestock}
              >
                {restocking ? 'Adding...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  );
}
