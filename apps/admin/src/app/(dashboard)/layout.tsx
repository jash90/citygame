import type { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { DashboardShell } from '@/shared/components/DashboardShell';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
