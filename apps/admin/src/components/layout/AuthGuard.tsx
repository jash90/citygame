'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { isTokenExpired } from '@/lib/jwt';
import { tryRefreshToken } from '@/lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const clearAndRedirect = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    router.replace('/login');
  }, [router]);

  const checkAuth = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken && !isTokenExpired(accessToken)) {
      const role = localStorage.getItem('userRole');
      if (role && role !== 'ADMIN') {
        clearAndRedirect();
        return false;
      }
      return true;
    }

    // Access token expired or missing — try refresh
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Re-check role after refresh — tryRefreshToken updates userRole from JWT
        const updatedRole = localStorage.getItem('userRole');
        if (updatedRole && updatedRole !== 'ADMIN') {
          clearAndRedirect();
          return false;
        }
        return true;
      }
    }

    clearAndRedirect();
    return false;
  }, [clearAndRedirect]);

  useEffect(() => {
    checkAuth().then((valid) => {
      if (valid) setChecked(true);
    });

    const interval = setInterval(() => {
      checkAuth();
    }, 30_000);

    return () => clearInterval(interval);
  }, [checkAuth]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 size={24} className="animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return <>{children}</>;
}
