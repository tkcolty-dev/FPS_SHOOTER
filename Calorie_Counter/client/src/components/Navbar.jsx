import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/', label: 'Dashboard', icon: '□' },
  { to: '/log', label: 'Log', icon: '+' },
  { to: '/chat', label: 'Chat', icon: '◯' },
  { to: '/profile', label: 'Profile', icon: '⚙' },
];

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Desktop top nav */}
      <nav className="desktop-nav">
        <div className="desktop-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span className="brand">CalorieCounter</span>
            <div className="desktop-links">
              {tabs.map(t => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.to === '/'}
                  className={({ isActive }) => `desktop-link${isActive ? ' active' : ''}`}
                >
                  {t.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {user?.username}
            </span>
            <button onClick={logout} className="desktop-link" style={{ background: 'none', border: 'none', color: 'var(--color-danger)' }}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="container app-main">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="mobile-tabs">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}
          >
            <span className="mobile-tab-icon">{t.icon}</span>
            <span className="mobile-tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
