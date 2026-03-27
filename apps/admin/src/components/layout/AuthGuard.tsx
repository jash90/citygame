'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Add 10s buffer to avoid edge-case race with API calls
    return payload.exp * 1000 > Date.now() + 10_000;
  } catch {
    return false;
  }
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !isTokenValid(token)) {
      localStorage.removeItem('accessToken');
      router.replace('/login');
      return false;
    }
    return true;
  }, [router]);

  useEffect(() => {
    if (checkAuth()) {
      setChecked(true);
    }

    // Re-check token validity every 30 seconds
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
