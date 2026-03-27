'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { api } from '@/lib/api';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('Admin');

  useEffect(() => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.email) setUserName(payload.email);
        }
      }
    } catch {
      // keep default
    }
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignoruj błąd — wyloguj lokalnie niezależnie
    }
    localStorage.removeItem('accessToken');
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 h-16">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FF6B35] text-white">
            <User size={16} />
          </div>
          <span className="hidden sm:inline font-medium">{userName}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </div>
    </header>
  );
}
