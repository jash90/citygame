'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Auth guard that validates the httpOnly cookie session by calling /api/auth/me.
 * No tokens are read from localStorage — only the cached `userRole` for fast UI gating.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { user, checked, recheck } = useCurrentUser();

  const clearAndRedirect = useCallback(() => {
    localStorage.removeItem('userRole');
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (checked && (!user || user.role !== 'ADMIN')) {
      clearAndRedirect();
    } else if (user?.role === 'ADMIN') {
      localStorage.setItem('userRole', user.role);
    }
  }, [checked, user, clearAndRedirect]);

  // Re-validate every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      recheck();
    }, 60_000);
    return () => clearInterval(interval);
  }, [recheck]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 size={24} className="animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return <>{children}</>;
}
