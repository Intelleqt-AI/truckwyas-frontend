import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchData } from './Api';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  username?: string;
  role: string;
  status?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  refreshUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('user', JSON.stringify(u));
    } else {
      localStorage.removeItem('user');
    }
  }, []);

  const refreshUser = useCallback(() => {
    const token = localStorage.getItem('access');
    if (!token) return;
    fetchData('api/v1/auth/me/')
      .then((data: AuthUser) => setUser(data))
      .catch(() => {});
  }, [setUser]);

  // Sync fresh role from DB on every mount so role changes take effect without re-login.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
