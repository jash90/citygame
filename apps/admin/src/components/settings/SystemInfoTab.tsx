'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, Gamepad2, Play, Activity, Database, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { SystemInfo } from '@citygame/shared';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2 shadow-sm">
      <div className={accent ? 'text-[#FF6B35]' : 'text-gray-400'}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export function SystemInfoTab() {
  const { data, isLoading, error } = useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: () => api.get('/api/admin/system/info'),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Ładowanie informacji systemowych...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-sm text-red-600">
        Nie udało się pobrać informacji systemowych.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users size={20} />}
          label="Użytkownicy"
          value={data.userCount}
          accent
        />
        <StatCard
          icon={<Gamepad2 size={20} />}
          label="Gry"
          value={data.gameCount}
          accent
        />
        <StatCard
          icon={<Play size={20} />}
          label="Sesje (łącznie)"
          value={data.sessionCount}
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Aktywne sesje"
          value={data.activeSessionCount}
          accent
        />
        <StatCard
          icon={<Database size={20} />}
          label="Baza danych"
          value={data.dbHealthy ? 'OK' : 'Błąd'}
          accent={data.dbHealthy}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Szczegóły
        </h4>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">Wersja</dt>
          <dd className="font-medium text-gray-800">{data.version}</dd>
          <dt className="text-gray-500">Status bazy</dt>
          <dd className={`font-medium ${data.dbHealthy ? 'text-green-600' : 'text-red-600'}`}>
            {data.dbHealthy ? 'Połączono' : 'Błąd połączenia'}
          </dd>
        </dl>
      </div>
    </div>
  );
}
