import type { ReactNode } from 'react';
import { RoleGuard } from '@/features/auth/components/RoleGuard';
import { MentorShell } from '@/features/mentor/components/MentorShell';

interface MentorLayoutProps {
  children: ReactNode;
}

export default function MentorLayout({ children }: MentorLayoutProps) {
  return (
    <RoleGuard allowedRoles={['MENTOR', 'ADMIN']}>
      <MentorShell>{children}</MentorShell>
    </RoleGuard>
  );
}
