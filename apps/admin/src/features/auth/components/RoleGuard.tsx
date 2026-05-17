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

  // Send authenticated users with a still-valid cookie to their correct
  // shell without forcing a re-login (e.g. when admin promoted them to
  // MENTOR while they were viewing the player panel).
  const redirectToRoleHome = useCallback(
    (role: string) => {
      const target =
        role === 'MENTOR'
          ? '/mentor/dashboard'
          : role === 'ADMIN'
            ? '/dashboard'
            : '/login';
      router.replace(target);
    },
    [router],
  );

  useEffect(() => {
    if (!checked) return;
    if (!user) {
      clearAndRedirect();
      return;
    }
    const role = user.role as 'ADMIN' | 'MENTOR' | 'PLAYER';
    if (!allowedRoles.includes(role)) {
      // Cookie still valid but role no longer permits this shell — bounce
      // to their proper home instead of /login.
      localStorage.setItem('userRole', role);
      redirectToRoleHome(role);
      return;
    }
    localStorage.setItem('userRole', role);
  }, [checked, user, allowedRoles, clearAndRedirect, redirectToRoleHome]);

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
