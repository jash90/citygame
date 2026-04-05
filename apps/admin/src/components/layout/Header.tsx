'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { disconnectRankingSocket } from '@/lib/ws';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [userName, setUserName] = useState('Admin');

  useEffect(() => {
    // Fetch current user email from the cookie-authenticated API
    api.get<{ email: string }>('/api/auth/me')
      .then((me) => {
        if (me?.email) setUserName(me.email);
      })
      .catch(() => {
        // Non-critical — fall back to "Admin"
      });
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore — clean up locally regardless
    }
    localStorage.removeItem('userRole');
    disconnectRankingSocket();
    queryClient.clear();
    router.replace('/login');
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
