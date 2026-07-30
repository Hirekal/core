import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getCurrentUser().then((session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await authService.login(email, password);
    setUser(session.user);
    return session;
  }, []);

  const signUp = useCallback(async (name, email, password) => {
    const session = await authService.signUp(name, email, password);
    setUser(session.user);
    return session;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data) => {
    const updated = await authService.updateProfile(user?.id, data);
    setUser(updated);
    return updated;
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
