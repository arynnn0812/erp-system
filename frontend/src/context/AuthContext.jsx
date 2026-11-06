// Global auth state via React Context: { user, login, logout, hasRole }.
// On app load we ask /auth/me who we are; the session cookie answers for us.
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // block routes until we know

  useEffect(() => {
    localStorage.removeItem('token'); // left behind by versions that stored the JWT
    api.get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.data.user); // the token itself stays in the httpOnly cookie
    return res.data.data.user;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {}); // clears the cookie server-side
    setUser(null);
  }

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
