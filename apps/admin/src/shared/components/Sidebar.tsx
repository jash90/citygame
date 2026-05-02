'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Gamepad2,
  Settings,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { href: '/games', label: 'Gry', icon: <Gamepad2 size={20} /> },
  { href: '/settings', label: 'Ustawienia', icon: <Settings size={20} /> },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : href !== '#' && (pathname === href || pathname.startsWith(href + '/'));

  const navContent = (
    <nav className="flex-1 px-2 py-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
            isActive(item.href)
              ? 'bg-[#FF6B35] text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
          title={collapsed ? item.label : undefined}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!collapsed && <span>{item.label}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-gray-900 text-white transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        } min-h-screen flex-shrink-0`}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF6B35] flex-shrink-0">
            <MapPin size={16} className="text-white" />
          </div>
          {!collapsed && <span className="font-bold text-lg tracking-tight">CityGame</span>}
        </div>

        {navContent}

        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex items-center justify-center p-4 border-t border-gray-700 text-gray-400 hover:text-white transition-colors"
          aria-label={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="ml-2 text-sm">Zwiń</span>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 text-white flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label="Menu nawigacji"
        inert={!open}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF6B35]">
              <MapPin size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">CityGame</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij menu"
            className="text-gray-400 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>

        {navContent}
      </aside>
    </>
  );
}
