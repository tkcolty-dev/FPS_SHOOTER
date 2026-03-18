import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { IconDashboard, IconTasks, IconCalendar, IconChat, IconProfile, IconBell, IconX, IconClock, IconAlertCircle } from './icons';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const API = (path, opts = {}) => {
  const token = localStorage.getItem('token');
  const fetchOpts = {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers
    }
  };
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body);
  return fetch(`/api${path}`, fetchOpts).then(async r => {
    if (r.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (opts.stream) return r;
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  });
};
export { API };

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((title, message, type = 'success') => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast ${toast ? 'visible' : ''}`}>
        {toast && <>
          <div className={`toast-icon-wrap toast-${toast.type}`}>
            {toast.type === 'success' ? <IconTasks size={16} /> : <IconAlertCircle size={16} />}
          </div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.message && <div className="toast-message">{toast.message}</div>}
          </div>
        </>}
      </div>
    </ToastContext.Provider>
  );
}

function NotificationPanel({ open, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      API('/notifications').then(setNotifications).catch(() => {}).finally(() => setLoading(false));
    }
  }, [open]);

  const markRead = async (id) => {
    await API(`/notifications/${id}/read`, { method: 'PUT' });
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await API('/notifications/read-all', { method: 'PUT' });
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
  };

  const timeAgo = (date) => {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <>
      <div className={`overlay ${open ? 'visible' : ''}`} onClick={onClose} />
      <div className={`notification-panel ${open ? 'open' : ''}`}>
        <div className="notification-panel-header">
          <h2>Notifications</h2>
          <div className="flex gap-sm">
            {notifications.some(n => !n.read) && (
              <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>
            )}
            <button className="btn btn-ghost" onClick={onClose}><IconX size={18} /></button>
          </div>
        </div>
        <div className="notification-list">
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <IconBell size={40} />
              <p style={{ marginTop: '0.75rem' }}>No notifications yet</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => markRead(n.id)}>
              <div className={`notification-icon ${n.type}`}>
                {n.type === 'overdue' ? <IconAlertCircle size={18} /> : <IconClock size={18} />}
              </div>
              <div className="notification-body">
                <div className="notification-title">{n.title}</div>
                <div className="notification-message">{n.message}</div>
                <div className="notification-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = () => {
      API('/notifications/unread').then(d => setUnreadCount(d.count)).catch(() => {});
    };
    fetchUnread();
    const iv = setInterval(fetchUnread, 30000);
    return () => clearInterval(iv);
  }, []);

  const tabs = [
    { to: '/', icon: IconDashboard, label: 'Dashboard' },
    { to: '/tasks', icon: IconTasks, label: 'Tasks' },
    { to: '/calendar', icon: IconCalendar, label: 'Calendar' },
    { to: '/chat', icon: IconChat, label: 'AI Chat' },
    { to: '/profile', icon: IconProfile, label: 'Profile' }
  ];

  return (
    <div className="app-container">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <NavLink to="/" className="top-nav-logo">
            <IconClipboard size={22} />
            <span>TaskManager</span>
          </NavLink>
          <div className="top-nav-links">
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
                {t.label}
              </NavLink>
            ))}
          </div>
          <div className="top-nav-right">
            <button className="notification-bell" onClick={() => setNotifOpen(true)}>
              <IconBell size={20} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <span className="top-nav-user">{user?.displayName || user?.username}</span>
            <button className="btn btn-sm btn-ghost" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon"><Icon size={22} /></span>
                <span>{t.label.split(' ').pop()}</span>
                {t.to === '/profile' && unreadCount > 0 && <span className="nav-badge" />}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <NotificationPanel open={notifOpen} onClose={() => { setNotifOpen(false); setUnreadCount(0); }} />
    </div>
  );
}

// Need this import for the logo in top-nav
import { IconClipboard } from './icons';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const compact = localStorage.getItem('compact') === 'true';
    document.documentElement.setAttribute('data-compact', compact ? 'true' : 'false');
  }, []);

  const login = (tok, u) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(u));
    if (u.theme) {
      localStorage.setItem('theme', u.theme);
      document.documentElement.setAttribute('data-theme', u.theme);
    }
    setToken(tok);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <ToastProvider>
        <BrowserRouter>
          {token && user ? <AppShell /> : (
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          )}
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
