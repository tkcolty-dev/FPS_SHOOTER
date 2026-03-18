import React, { useState } from 'react';
import { useAuth, API } from '../App';
import { IconClipboard } from '../icons';

export default function Login() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister
        ? { username, password, displayName: displayName || username }
        : { username, password };
      const data = await API(endpoint, { method: 'POST', body });
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <IconClipboard size={28} />
            </div>
          </div>
          <h1>TaskManager</h1>
          <p>AI-powered day planner & task manager</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>Display Name</label>
              <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>Username</label>
            <input type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <a onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? 'Sign In' : 'Create Account'}
          </a>
        </div>
      </div>
    </div>
  );
}
