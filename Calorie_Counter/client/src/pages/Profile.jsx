import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/goals', label: 'Calorie Goals', desc: 'Set daily calorie targets' },
  { to: '/preferences', label: 'Food Preferences', desc: 'Cuisines, dietary needs, favorites' },
  { to: '/sharing', label: 'Sharing', desc: 'Share your log with others' },
];

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
        <p>{user?.username}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {links.map(l => (
          <Link key={l.to} to={l.to} className="card profile-link">
            <div>
              <div style={{ fontWeight: 600 }}>{l.label}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{l.desc}</div>
            </div>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem' }}>&rsaquo;</span>
          </Link>
        ))}
      </div>

      <button onClick={logout} className="btn btn-danger" style={{ width: '100%', padding: '0.75rem' }}>
        Logout
      </button>
    </div>
  );
}
