import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';
import { Loading, Notice } from './ui';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { api('/auth/me').then(data => setUser(data.user)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <AuthContext.Provider value={{ user, setUser, loading, error }}>{children}</AuthContext.Provider>;
}
// The hook intentionally shares a module with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
export function Protected({ children, organizer = false }) {
  const { user, loading, error } = useAuth(); const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <Notice>{error} Reload the page to reconnect.</Notice>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (organizer && user.role !== 'ORGANIZER') return <div className="page"><Notice>Organizer access required.</Notice></div>;
  return children;
}
