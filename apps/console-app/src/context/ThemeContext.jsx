import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const THEME_KEY = 'hirekal_theme';

const ThemeContext = createContext(null);

function applyThemeClass(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
}

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem(THEME_KEY) || 'light';
  });

  useEffect(() => {
    const resolved = user?.theme || localStorage.getItem(THEME_KEY) || 'light';
    setThemeState(resolved);
    applyThemeClass(resolved);
  }, [user?.theme]);

  const setTheme = useCallback(async (next) => {
    setThemeState(next);
    applyThemeClass(next);
    if (user) {
      try {
        await updateUser({ theme: next });
      } catch {
        // Theme is still applied locally
      }
    }
  }, [user, updateUser]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') {
    document.documentElement.classList.add('dark');
  }
}
