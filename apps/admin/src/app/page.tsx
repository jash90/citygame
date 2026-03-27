'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenExpired } from '@/lib/jwt';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !isTokenExpired(token)) {
      const role = localStorage.getItem('userRole');
      if (role === 'ADMIN') {
        router.replace('/dashboard');
        return;
      }
    }
    router.replace('/login');
  }, [router]);

  return null;
}
