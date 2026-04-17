import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'aa_jwt_token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMe() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch('/api/auth/me', { token });
        setUser(data.user);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMe();
  }, [token]);

  const persist = (nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const login = async (email, password) => {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
    persist(data.token, data.user);
    return data.user;
  };

  const register = async ({ email, password, role, university_name }) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { email, password, role, university_name }
    });
    persist(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, loading, login, register, logout }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
