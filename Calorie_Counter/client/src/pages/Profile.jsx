import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNewShares } from '../hooks/useNewShares';

const ICON_COLOR = '#2563eb';

const links = [
  { to: '/goals', label: 'Calorie Goals', desc: 'Set daily calorie targets', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  )},
  { to: '/preferences', label: 'Food Preferences', desc: 'Cuisines, dietary needs, favorites', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  )},
  { to: '/sharing', label: 'Sharing', desc: 'Share your log with others', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { to: '/messages', label: 'Messages', desc: 'Chat with shared friends', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  )},
  { to: '/weight', label: 'Weight Log', desc: 'Track your weight over time', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/><path d="M16 7l-4-4-4 4"/><path d="M8 17l4 4 4-4"/></svg>
  )},
  { to: '/reports', label: 'Reports', desc: 'Charts, streaks, and insights', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
  )},
  { to: '/challenges', label: 'Challenges', desc: 'Compete with friends', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
  )},
];

export default function Profile() {
  const { user, logout } = useAuth();
  const { newCount } = useNewShares();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto');

  const changeTheme = (t) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
        <p>{user?.username}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {links.map(l => (
          <Link key={l.to} to={l.to} className="card profile-link">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `color-mix(in srgb, ${ICON_COLOR} 12%, transparent)`,
                color: ICON_COLOR,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {l.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {l.label}
                  {l.to === '/sharing' && newCount > 0 && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: 'var(--color-danger)',
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}>
                      {newCount} new
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{l.desc}</div>
              </div>
            </div>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem' }}>&rsaquo;</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Appearance</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Choose your theme</div>
          </div>
          <div className="theme-toggle">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')}>Light</button>
            <button className={theme === 'auto' ? 'active' : ''} onClick={() => changeTheme('auto')}>Auto</button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')}>Dark</button>
          </div>
        </div>
      </div>

      <button onClick={logout} className="btn btn-danger" style={{ width: '100%', padding: '0.75rem' }}>
        Logout
      </button>
    </div>
  );
}
