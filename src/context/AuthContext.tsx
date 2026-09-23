/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { api, getStoredToken, removeStoredToken } from '../api';

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  setError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user);
      setPermissions(data.permissions);
    } catch {
      setUser(null);
      setPermissions([]);
      removeStoredToken();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleAuthExpired = () => {
      setUser(null);
      setPermissions([]);
      setError('Your session has expired. Please log in again.');
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      setPermissions(res.permissions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setPermissions([]);
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return permissions.includes(permission);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        error,
        isAdmin,
        isAuthenticated,
        login,
        logout,
        refreshUser,
        hasPermission,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
