import { createContext, useContext, useState, useCallback } from 'react';
import { storage } from '../utils/storage';
import { generateId } from '../utils/helpers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => storage.getAuth());

  const register = useCallback((name, username, password) => {
    if (storage.findUser(username)) {
      return { error: 'That username is already taken' };
    }
    const newUser = { id: generateId(), name, username, password };
    storage.addUser(newUser);
    const auth = { id: newUser.id, name: newUser.name, username: newUser.username };
    storage.setAuth(auth);
    setUser(auth);
    return { success: true };
  }, []);

  const login = useCallback((username, password) => {
    const found = storage.findUser(username);
    if (!found || found.password !== password) {
      return { error: 'Invalid username or password' };
    }
    const auth = { id: found.id, name: found.name, username: found.username };
    storage.setAuth(auth);
    setUser(auth);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    storage.clearAuth();
    setUser(null);
  }, []);

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
