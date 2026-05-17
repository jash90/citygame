'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';

interface RoleGuardProps {
  allowedRoles: ('ADMIN' | 'MENTOR' | 'PLAYER')[];
  redirectTo?: string;
  children: React.ReactNode;
}

/**
 * Generalised version of AuthGuard — allows multiple roles into a route group.
 * Used by /mentor/* (MENTOR only) and /games/* (ADMIN only).
 */
export function RoleGuard({
  allowedRoles,
  redirectTo = '/login',
  children,
}: RoleGuardProps) {
  const router = useRouter();
  const { user, checked, recheck } = useCurrentUser();

  const clearAndRedirect = useCallback(() => {
    localStorage.removeItem('userRole');
    router.replace(redirectTo);
  }, [router, redirectTo]);

  useEffect(() => {
    if (!checked) return;
    if (!user || !allowedRoles.includes(user.role as 'ADMIN' | 'MENTOR' | 'PLAYER')) {
      clearAndRedirect();
    } else {
      localStorage.setItem('userRole', user.role);
    }
  }, [checked, user, allowedRoles, clearAndRedirect]);

  useEffect(() => {
    const interval = setInterval(() => recheck(), 60_000);
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
