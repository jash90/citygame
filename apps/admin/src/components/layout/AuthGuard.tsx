'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, tryRefreshToken } from '@/lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
}

interface MeResponse {
  id: string;
  role: string;
}

/**
 * Auth guard that validates the httpOnly cookie session by calling /api/auth/me.
 * No tokens are read from localStorage — only the cached `userRole` for fast UI gating.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const clearAndRedirect = useCallback(() => {
    localStorage.removeItem('userRole');
    router.replace('/login');
  }, [router]);

  const checkAuth = useCallback(async () => {
    try {
      // Verify cookie session by calling the backend
      const me = await api.get<MeResponse>('/api/auth/me');

      if (me.role !== 'ADMIN') {
        clearAndRedirect();
        return false;
      }

      // Keep cached role in sync
      localStorage.setItem('userRole', me.role);
      return true;
    } catch {
      // Session expired or invalid — try refresh
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        try {
          const me = await api.get<MeResponse>('/api/auth/me');
          if (me.role === 'ADMIN') {
            localStorage.setItem('userRole', me.role);
            return true;
          }
        } catch {
          // Refresh succeeded but /me failed — bail
        }
      }

      clearAndRedirect();
      return false;
    }
  }, [clearAndRedirect]);

  useEffect(() => {
    // Always verify the session cookie against the backend
    checkAuth().then((valid) => {
      if (valid) setChecked(true);
    });

    // Re-validate every 60 seconds
    const interval = setInterval(() => {
      checkAuth();
    }, 60_000);

    return () => clearInterval(interval);
  }, [checkAuth, clearAndRedirect]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 size={24} className="animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return <>{children}</>;
}
