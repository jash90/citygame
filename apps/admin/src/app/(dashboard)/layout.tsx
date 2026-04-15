import type { ReactNode } from 'react';
import { Sidebar } from '@/shared/components/Sidebar';
import { Header } from '@/shared/components/Header';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AuthGuard } from '@/features/auth/components/AuthGuard';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0">
          <Header title="CityGame Admin" />

          <main className="flex-1 p-6 overflow-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
