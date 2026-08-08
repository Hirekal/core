import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import {
  AUTH_EXPIRED_EVENT,
  clearExpiredSession,
  readSession,
  refreshSessionIfNeeded,
} from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = readSession();
      if (!session?.accessToken && !session?.refreshToken) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const sessionReady = await refreshSessionIfNeeded();
      if (!sessionReady) {
        clearExpiredSession();
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await authService.getProfile();
        if (!cancelled) {
          setUser(profile);
        }
      } catch {
        clearExpiredSession();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await authService.login(email, password);
    setUser(session.user);
    return session;
  }, []);

  /**
   * Registers an account. Does not sign the user in until email is verified.
   */
  const signUp = useCallback(async (name, email, password) => {
    return authService.signUp(name, email, password);
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signUp,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * @returns {{
 *   user: { id: string, email: string, name?: string | null } | null,
 *   loading: boolean,
 *   login: (email: string, password: string) => Promise<unknown>,
 *   signUp: (name: string, email: string, password: string) => Promise<unknown>,
 *   logout: () => Promise<void>,
 *   updateUser: (data: Record<string, unknown>) => Promise<unknown>,
 *   isAuthenticated: boolean
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
