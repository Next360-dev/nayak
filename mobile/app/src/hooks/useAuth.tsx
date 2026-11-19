import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import { me, logout as apiLogout } from '../api/client';
import { getAccessToken, clearTokens } from '../lib/storage';
import { unregisterDevice } from '../api/devices';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (u: User) => void;
  signOut: (deviceToken?: string | null) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) { setUser(null); setLoading(false); return; }
      const data = await me();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
      await clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [refreshUser]);

  const signIn = (u: User) => setUser(u);

  const signOut = useCallback(async (deviceToken?: string | null) => {
    if (deviceToken) {
      try { await unregisterDevice(deviceToken); } catch {}
    }
    try { await apiLogout(); } catch {}
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}