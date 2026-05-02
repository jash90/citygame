'use client';

import { useState, useEffect } from 'react';
import { LogOut, Menu, User } from 'lucide-react';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useAuth';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const logout = useLogout();
  const { user } = useCurrentUser();
  const [userName, setUserName] = useState('Admin');

  useEffect(() => {
    if (user?.email) setUserName(user.email);
  }, [user]);

  const handleLogout = () => {
    void logout();
  };

  return (
    <header className="flex items-center justify-between gap-3 px-3 md:px-6 py-3 md:py-4 bg-white border-b border-gray-200 h-14 md:h-16">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Otwórz menu"
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            <Menu size={22} />
          </button>
        )}
        <h1 className="text-base md:text-xl font-semibold text-gray-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FF6B35] text-white shrink-0">
            <User size={16} />
          </div>
          <span className="hidden sm:inline font-medium max-w-[160px] truncate">{userName}</span>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Wyloguj"
          className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </div>
    </header>
  );
}
