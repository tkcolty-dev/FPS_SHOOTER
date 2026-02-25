import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    const result = await login(username.trim().toLowerCase(), password);
    if (result.error) setError(result.error);
    setSubmitting(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        <div className="auth-header">
          <div className="auth-logo">
            <span role="img" aria-label="cookie">&#127850;</span>
          </div>
          <h1>Cookie Counter</h1>
          <p>Girl Scout Cookie Booth Tracker</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="card">
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
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
