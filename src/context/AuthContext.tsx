import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, StoreSettings } from '../types/index.ts';
import { apiRequest, setApiToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  settings: StoreSettings | null;
  isLoading: boolean;
  theme: 'light' | 'dark';
  priceOverrideToken: string | null;
  setPriceOverrideToken: (token: string | null) => void;
  toggleTheme: () => void;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  hasRole: (roles: Array<'founder' | 'admin' | 'user'>) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });
  const [priceOverrideToken, setPriceOverrideToken] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      const data = await apiRequest<{ authenticated: boolean; user: User | null; settings: StoreSettings }>('/api/auth/me');
      if (data.authenticated && data.user) {
        setUser(data.user);
        if (data.settings) {
          setSettings(data.settings);
          const savedTheme = localStorage.getItem('app_theme');
          if (!savedTheme && (data.settings.theme === 'dark' || data.settings.theme === 'light')) {
            setTheme(data.settings.theme as 'light' | 'dark');
          }
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('app_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('app_theme', next);
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {}
      return next;
    });
  };

  const login = (token: string, loggedInUser: User) => {
    setApiToken(token);
    setUser(loggedInUser);
    refreshUser();
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setApiToken(null);
    setUser(null);
    setPriceOverrideToken(null);
  };

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
  };

  const hasRole = (roles: Array<'founder' | 'admin' | 'user'>) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        isLoading,
        theme,
        priceOverrideToken,
        setPriceOverrideToken,
        toggleTheme,
        login,
        logout,
        refreshUser,
        updateSettings,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
