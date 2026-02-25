import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(data => setUser(data.user))
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name, username, password) => {
    try {
      const data = await api.register(name, username, password);
      api.setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const data = await api.login(username, password);
      api.setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    api.setToken(null);
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="auth-logo">
            <span role="img" aria-label="cookie">&#127850;</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
