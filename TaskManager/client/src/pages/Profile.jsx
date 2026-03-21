import React, { useState, useEffect } from 'react';
import { API, useAuth, useToast } from '../App';
import { IconEdit, IconLock, IconBell, IconSun, IconMoon, IconLogOut, IconChevronRight, IconStar, IconTrash, IconX, IconProfile } from '../icons';

export default function Profile() {
  const { user, logout, login } = useAuth();
  const showToast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyUpcoming, setNotifyUpcoming] = useState(true);
  const [notifyBefore, setNotifyBefore] = useState(30);
  const [notifyShared, setNotifyShared] = useState(true);

  useEffect(() => {
    API('/auth/me').then(p => {
      setProfile(p);
      setDisplayName(p.displayName || '');
      setNotifyOverdue(p.notifyOverdue);
      setNotifyUpcoming(p.notifyUpcoming);
      setNotifyBefore(p.notifyBeforeMinutes);
      setNotifyShared(p.notifyShared !== false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    API('/auth/me', { method: 'PUT', body: { theme: next } }).catch(() => {});
    showToast('Theme Changed', `Switched to ${next} mode`);
  };

  const saveProfile = async () => {
    try {
      await API('/auth/me', { method: 'PUT', body: { displayName } });
      const u = { ...user, displayName };
      localStorage.setItem('user', JSON.stringify(u));
      login(localStorage.getItem('token'), u);
      setProfile(p => ({ ...p, displayName }));
      showToast('Saved', 'Profile updated');
      setSection(null);
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const changePassword = async () => {
    try {
      await API('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
      showToast('Saved', 'Password changed');
      setCurrentPassword(''); setNewPassword('');
      setSection(null);
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const saveNotifications = async () => {
    try {
      await API('/auth/me', { method: 'PUT', body: { notifyOverdue, notifyUpcoming, notifyBeforeMinutes: notifyBefore, notifyShared } });
      setProfile(p => ({ ...p, notifyOverdue, notifyUpcoming, notifyBeforeMinutes: notifyBefore, notifyShared }));
      showToast('Saved', 'Notification settings updated');
      setSection(null);
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('compact') === 'true');

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const toggleCompact = () => {
    const next = !compactMode;
    setCompactMode(next);
    localStorage.setItem('compact', next ? 'true' : 'false');
    document.documentElement.setAttribute('data-compact', next ? 'true' : 'false');
    showToast('Display', next ? 'Compact mode on' : 'Compact mode off');
  };

  const initial = (profile?.displayName || profile?.username || '?')[0].toUpperCase();
  const isDark = theme === 'dark';
  const isCompact = compactMode;

  return (
    <div>
      <div className="page-header"><h1>Profile</h1></div>

      <div className="card text-center">
        <div className="profile-avatar">{initial}</div>
        <div className="fw-600" style={{ fontSize: '1.1rem' }}>{profile?.displayName || profile?.username}</div>
        <div className="text-sm text-secondary">@{profile?.username}</div>
        <div className="text-sm text-secondary" style={{ marginTop: '0.25rem' }}>
          Member since {new Date(profile?.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="card" style={{ padding: '0.25rem' }}>
        <MenuItem
          icon={<IconEdit size={18} />}
          bg="var(--color-primary-light)" color="var(--color-primary)"
          label="Edit Profile"
          onClick={() => setSection(section === 'edit' ? null : 'edit')}
        />
        {section === 'edit' && (
          <div className="menu-expand">
            <div className="form-group">
              <label>Display Name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveProfile}>Save</button>
          </div>
        )}

        <MenuItem
          icon={<IconLock size={18} />}
          bg="var(--color-warning-light)" color="var(--color-warning)"
          label="Change Password"
          onClick={() => setSection(section === 'password' ? null : 'password')}
        />
        {section === 'password' && (
          <div className="menu-expand">
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={changePassword} disabled={!currentPassword || !newPassword}>Save</button>
          </div>
        )}

        <MenuItem
          icon={<IconBell size={18} />}
          bg="var(--color-danger-light)" color="var(--color-danger)"
          label="Notifications"
          onClick={() => setSection(section === 'notif' ? null : 'notif')}
        />
        {section === 'notif' && (
          <div className="menu-expand">
            <div className="toggle-wrap">
              <div>
                <div className="toggle-label">Overdue Alerts</div>
                <div className="toggle-desc">Get notified when tasks are past due</div>
              </div>
              <button className={`toggle ${notifyOverdue ? 'on' : ''}`} onClick={() => setNotifyOverdue(!notifyOverdue)} />
            </div>
            <div className="toggle-wrap">
              <div>
                <div className="toggle-label">Upcoming Reminders</div>
                <div className="toggle-desc">Get reminded before tasks are due</div>
              </div>
              <button className={`toggle ${notifyUpcoming ? 'on' : ''}`} onClick={() => setNotifyUpcoming(!notifyUpcoming)} />
            </div>
            <div className="toggle-wrap">
              <div>
                <div className="toggle-label">Shared Task Notifications</div>
                <div className="toggle-desc">Get notified when shared tasks are completed or unchecked</div>
              </div>
              <button className={`toggle ${notifyShared ? 'on' : ''}`} onClick={() => setNotifyShared(!notifyShared)} />
            </div>
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label>Remind me (minutes before)</label>
              <select value={notifyBefore} onChange={e => setNotifyBefore(parseInt(e.target.value))}>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="1440">1 day</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveNotifications}>Save</button>
          </div>
        )}

        <MenuItem
          icon={isDark ? <IconMoon size={18} /> : <IconSun size={18} />}
          bg="var(--color-success-light)" color="var(--color-success)"
          label={isDark ? 'Dark Mode' : 'Light Mode'}
          onClick={toggleTheme}
          chevron={false}
        />

        <MenuItem
          icon={<IconProfile size={18} />}
          bg="color-mix(in srgb, #0891b2 10%, transparent)" color="#0891b2"
          label={isCompact ? 'Compact Mode: On' : 'Compact Mode: Off'}
          onClick={toggleCompact}
          chevron={false}
        />

        <MenuItem
          icon={<IconStar size={18} />}
          bg="color-mix(in srgb, #7c3aed 10%, transparent)" color="#7c3aed"
          label="AI Preferences"
          onClick={() => setSection(section === 'notes' ? null : 'notes')}
        />
        {section === 'notes' && <NotesSection />}

        <MenuItem
          icon={<IconBell size={18} />}
          bg="color-mix(in srgb, #16a34a 10%, transparent)" color="#16a34a"
          label="Push Notifications"
          onClick={() => setSection(section === 'push' ? null : 'push')}
        />
        {section === 'push' && <PushSection showToast={showToast} />}
      </div>

      <div className="card" style={{ padding: '0.25rem' }}>
        <MenuItem
          icon={<IconLogOut size={18} />}
          bg="var(--color-danger-light)" color="var(--color-danger)"
          label="Log Out"
          onClick={logout}
          chevron={false}
          danger
        />
      </div>
    </div>
  );
}

function NotesSection() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    API('/chat/notes').then(setNotes).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const deleteNote = async (id) => {
    await API(`/chat/notes/${id}`, { method: 'DELETE' });
    setNotes(ns => ns.filter(n => n.id !== id));
    showToast('Removed', 'Preference deleted');
  };

  if (loading) return <div className="menu-expand"><div className="loading-center"><div className="spinner" /></div></div>;

  return (
    <div className="menu-expand">
      <div className="text-sm text-secondary" style={{ marginBottom: '0.5rem' }}>
        Things the AI has learned about you from conversations. These help personalize your plans.
      </div>
      {notes.length === 0 ? (
        <div className="text-sm text-secondary text-center" style={{ padding: '1rem 0' }}>
          No preferences learned yet. Chat with the AI and tell it what you like!
        </div>
      ) : notes.map(n => (
        <div key={n.id} className="note-item">
          <span className="note-category">{n.category}</span>
          <span className="note-text">{n.note}</span>
          <button className="note-delete" onClick={() => deleteNote(n.id)}><IconX size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function PushSection({ showToast }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setLoading(false); return; }
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setEnabled(!!sub);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const toggle = async () => {
    try {
      if (enabled) {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) await sub.unsubscribe();
        await API('/push/unsubscribe', { method: 'DELETE' });
        setEnabled(false);
        showToast('Disabled', 'Push notifications turned off');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { showToast('Blocked', 'Allow notifications in browser settings', 'error'); return; }
        const reg = await navigator.serviceWorker.register('/sw.js');
        const { key } = await API('/push/vapid-key');
        if (!key) { showToast('Error', 'Push not configured on server', 'error'); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await API('/push/subscribe', { method: 'POST', body: sub.toJSON() });
        setEnabled(true);
        showToast('Enabled', 'You\'ll get push notifications for due tasks');
      }
    } catch (err) { showToast('Error', err.message, 'error'); }
  };

  if (loading) return <div className="menu-expand"><div className="loading-center"><div className="spinner" /></div></div>;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return <div className="menu-expand"><div className="text-sm text-secondary">Push notifications are not supported in this browser.</div></div>;
  }

  return (
    <div className="menu-expand">
      <div className="text-sm text-secondary" style={{ marginBottom: '0.5rem' }}>
        Get browser push notifications when tasks are overdue or coming up.
      </div>
      <div className="toggle-wrap">
        <div><div className="toggle-label">Push Notifications</div><div className="toggle-desc">Alerts even when the app is closed</div></div>
        <button className={`toggle ${enabled ? 'on' : ''}`} onClick={toggle} />
      </div>
    </div>
  );
}

function MenuItem({ icon, bg, color, label, onClick, chevron = true, danger }) {
  return (
    <button className="profile-menu-item" onClick={onClick} style={danger ? { color: 'var(--color-danger)' } : {}}>
      <div className="profile-menu-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="profile-menu-label">{label}</div>
      {chevron && <span className="profile-menu-chevron"><IconChevronRight size={16} /></span>}
    </button>
  );
}
