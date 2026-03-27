'use client';

import { Gamepad2, Users, ListChecks, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { GameTable } from '@/components/dashboard/GameTable';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import type { Game } from '@citygame/shared';

interface DashboardStats {
  activeGames: number;
  totalPlayers: number;
  totalTasks: number;
  activeSessions: number;
}

interface RecentActivity {
  id: string;
  type: 'game_created' | 'game_published' | 'session_completed' | 'player_joined';
  label: string;
  detail: string;
  timestamp: string;
}

const ACTIVITY_COLORS: Record<RecentActivity['type'], string> = {
  game_created: 'bg-blue-100 text-blue-700',
  game_published: 'bg-green-100 text-green-700',
  session_completed: 'bg-purple-100 text-purple-700',
  player_joined: 'bg-orange-100 text-[#FF6B35]',
};

const ACTIVITY_LABELS: Record<RecentActivity['type'], string> = {
  game_created: 'Nowa gra',
  game_published: 'Opublikowano',
  session_completed: 'Ukończono',
  player_joined: 'Nowy gracz',
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return 'przed chwilą';
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  return new Date(timestamp).toLocaleDateString('pl-PL');
}

export default function DashboardPage() {
  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await api.get<{ items: Game[] }>('/api/admin/games');
      return Array.isArray(res) ? res : res?.items ?? [];
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/api/admin/stats'),
    // Fallback: derive from games list if endpoint not yet available
    placeholderData: {
      activeGames: 0,
      totalPlayers: 0,
      totalTasks: 0,
      activeSessions: 0,
    },
  });

  const { data: recentActivity = [] } = useQuery<RecentActivity[]>({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get<RecentActivity[]>('/api/admin/activity'),
    // Don't throw if this endpoint doesn't exist yet
    retry: false,
  });

  // Derive stats from games data as fallback
  const derivedStats = {
    activeGames: stats?.activeGames ?? games.filter((g) => g.status === 'PUBLISHED').length,
    totalPlayers:
      stats?.totalPlayers ?? games.reduce((sum, g) => sum + (g.playerCount ?? 0), 0),
    totalTasks:
      stats?.totalTasks ?? games.reduce((sum, g) => sum + (g.taskCount ?? 0), 0),
    activeSessions: stats?.activeSessions ?? 0,
  };

  const isLoading = gamesLoading || statsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Przegląd platformy CityGame</p>
      </div>

      {/* Stats grid */}
      <ErrorBoundary>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          icon={<Gamepad2 size={20} />}
          label="Aktywne gry"
          value={isLoading ? '—' : derivedStats.activeGames}
          trend={derivedStats.activeGames > 0 ? 1 : 0}
          trendLabel={derivedStats.activeGames > 0 ? 'opublikowane' : 'brak danych'}
        />
        <StatsCard
          icon={<Users size={20} />}
          label="Gracze"
          value={isLoading ? '—' : derivedStats.totalPlayers}
          trend={derivedStats.totalPlayers > 0 ? 1 : 0}
          trendLabel={derivedStats.totalPlayers > 0 ? 'zarejestrowani' : 'brak danych'}
        />
        <StatsCard
          icon={<ListChecks size={20} />}
          label="Zadania"
          value={isLoading ? '—' : derivedStats.totalTasks}
          trend={0}
          trendLabel={derivedStats.totalTasks > 0 ? 'we wszystkich grach' : 'brak danych'}
        />
        <StatsCard
          icon={<Activity size={20} />}
          label="Aktywne sesje"
          value={isLoading ? '—' : derivedStats.activeSessions}
          trend={derivedStats.activeSessions > 0 ? 1 : 0}
          trendLabel={derivedStats.activeSessions > 0 ? 'trwa teraz' : 'brak sesji'}
        />
      </div>
      </ErrorBoundary>

      {/* Two-column lower area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Games table */}
        <ErrorBoundary>
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Ostatnie gry</h3>
          </div>
          <GameTable />
        </div>
        </ErrorBoundary>

        {/* Recent activity sidebar */}
        <ErrorBoundary>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock size={15} className="text-[#FF6B35]" />
            <h3 className="text-base font-semibold text-gray-800">Ostatnia aktywność</h3>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-gray-400 gap-2">
              <CheckCircle2 size={24} className="opacity-30" />
              <p className="text-sm text-center">Brak ostatniej aktywności</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 flex-1 overflow-y-auto">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${ACTIVITY_COLORS[item.type]}`}
                  >
                    {ACTIVITY_LABELS[item.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                    <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
