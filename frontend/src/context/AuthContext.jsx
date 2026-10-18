import { createContext, useContext, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Clear any legacy persistent localStorage auth data so old sessions are purged
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));

  const login = async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('user', JSON.stringify(res.data.user));
  };

  const signup = async (firstName, lastName, email, password) => {
    await client.post('/auth/signup', { firstName, lastName, email, password });
    // No token/user set here — signup no longer auto-logs-in; user logs in next
  };

  const loginWithGoogle = async (googleData) => {
    const res = await client.post('/auth/google', googleData);
    setToken(res.data.token);
    setUser(res.data.user);
    sessionStorage.setItem('token', res.data.token);
    sessionStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}