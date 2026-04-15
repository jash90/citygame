'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, tryRefreshToken } from '@/lib/api';
import { disconnectRankingSocket } from '@/lib/ws';

interface MeResponse {
  id: string;
  email: string;
  role: string;
}

/**
 * Fetches the current authenticated user via /api/auth/me.
 * Returns user info + logout helper. Used by AuthGuard and Header.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [checked, setChecked] = useState(false);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const me = await api.get<MeResponse>('/api/auth/me');
      setUser(me);
      return true;
    } catch {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        try {
          const me = await api.get<MeResponse>('/api/auth/me');
          setUser(me);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }, []);

  useEffect(() => {
    checkAuth().then((ok) => {
      if (ok) setChecked(true);
    });
  }, [checkAuth]);

  return { user, checked, recheck: checkAuth };
}

/**
 * Logout hook — clears session and redirects to /login.
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore — clean up locally regardless
    }
    localStorage.removeItem('userRole');
    disconnectRankingSocket();
    queryClient.clear();
    router.replace('/login');
  }, [router, queryClient]);
}
