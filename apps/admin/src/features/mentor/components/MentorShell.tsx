'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { ClipboardCheck, LogOut, Map } from 'lucide-react';
import { useCurrentUser, useLogout } from '@/features/auth/hooks/useAuth';

interface MentorShellProps {
  children: ReactNode;
}

export function MentorShell({ children }: MentorShellProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const logout = useLogout();

  const isActive = (href: string) =>
    href === '/mentor'
      ? pathname === '/mentor' || pathname === '/mentor/dashboard'
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] text-white flex items-center justify-center">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">CityGame</p>
            <p className="text-xs text-gray-500">Panel mentora</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link
            href="/mentor/dashboard"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
              isActive('/mentor')
                ? 'bg-[#FF6B35] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Map size={20} />
            Moje gry
          </Link>
        </nav>
        <div className="border-t border-gray-100 px-3 py-3">
          {user && (
            <p className="text-xs text-gray-500 mb-2 px-1">{user.email}</p>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full"
          >
            <LogOut size={16} />
            Wyloguj
          </button>
        </div>
      </aside>

      <main className="flex-1 p-3 md:p-6 overflow-auto">{children}</main>
    </div>
  );
}
