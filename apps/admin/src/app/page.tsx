'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Fast redirect based on cached role. AuthGuard will verify cookie validity.
    const role = localStorage.getItem('userRole');
    if (role === 'ADMIN') {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
