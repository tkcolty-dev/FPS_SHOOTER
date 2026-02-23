import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navStyle = {
  background: '#ffffff',
  borderBottom: '1px solid var(--color-border)',
  padding: '0 1rem',
  position: 'sticky',
  top: 0,
  zIndex: 100,
};

const innerStyle = {
  maxWidth: 960,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 56,
};

const linksStyle = {
  display: 'flex',
  gap: '0.25rem',
  alignItems: 'center',
};

const linkStyle = {
  padding: '0.375rem 0.75rem',
  borderRadius: 'var(--radius)',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  transition: 'background 0.15s, color 0.15s',
};

const activeLinkStyle = {
  ...linkStyle,
  background: 'rgba(37, 99, 235, 0.1)',
  color: 'var(--color-primary)',
};

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <>
      <nav style={navStyle}>
        <div style={innerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
              CalorieCounter
            </span>
            <div style={linksStyle}>
              <NavLink to="/" end style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
                Dashboard
              </NavLink>
              <NavLink to="/log" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
                Log Meal
              </NavLink>
              <NavLink to="/goals" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
                Goals
              </NavLink>
              <NavLink to="/preferences" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
                Preferences
              </NavLink>
              <NavLink to="/sharing" style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}>
                Sharing
              </NavLink>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              {user?.username}
            </span>
            <button
              onClick={logout}
              style={{
                ...linkStyle,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-danger)',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="container" style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}>
        <Outlet />
      </main>
    </>
  );
}
