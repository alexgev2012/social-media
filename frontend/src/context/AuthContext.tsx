import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  unreadMessages: number;
  unreadNotifications: number;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string; first_name?: string; last_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshBadges: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const refreshBadges = async () => {
    if (!user) return;
    try {
      const [msgRes, notifRes] = await Promise.all([
        api.chat.getUnreadCount(),
        api.notifications.getUnreadCount(),
      ]);
      setUnreadMessages(msgRes.unread_count || 0);
      setUnreadNotifications(notifRes.unread_count || 0);
    } catch {
      // ignore badge error
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.auth.me();
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (user) {
      refreshBadges();
      const interval = setInterval(refreshBadges, 15000);
      return () => clearInterval(interval);
    } else {
      setUnreadMessages(0);
      setUnreadNotifications(0);
    }
  }, [user]);

  const login = async (credentials: { username: string; password: string }) => {
    const loggedUser = await api.auth.login(credentials);
    setUser(loggedUser);
    setIsAuthModalOpen(false);
  };

  const register = async (data: { username: string; email: string; password: string; first_name?: string; last_name?: string }) => {
    const newUser = await api.auth.register(data);
    setUser(newUser);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadMessages,
        unreadNotifications,
        login,
        register,
        logout,
        refreshUser,
        refreshBadges,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
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
