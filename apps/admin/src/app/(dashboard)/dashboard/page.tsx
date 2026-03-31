'use client';

import Link from 'next/link';
import { Gamepad2, Users, ListChecks, Activity, Clock, CheckCircle2, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, adminApi } from '@/lib/api';
import type { Game } from '@citygame/shared';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { GameTable } from '@/components/dashboard/GameTable';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

interface DashboardStats {
  activeGames: number;
  totalPlayers: number;
  totalTasks: number;
  activeSessions: number;
}

interface RecentActivity {
  id: string;
  type: 'game_created' | 'game_published' | 'game_archived' | 'session_completed' | 'session_abandoned' | 'session_timed_out' | 'player_joined';
  label: string;
  detail: string;
  timestamp: string;
}

const ACTIVITY_COLORS: Record<RecentActivity['type'], string> = {
  game_created: 'bg-blue-100 text-blue-700',
  game_published: 'bg-green-100 text-green-700',
  game_archived: 'bg-gray-100 text-gray-700',
  session_completed: 'bg-purple-100 text-purple-700',
  session_abandoned: 'bg-yellow-100 text-yellow-700',
  session_timed_out: 'bg-red-100 text-red-600',
  player_joined: 'bg-orange-100 text-[#FF6B35]',
};

const ACTIVITY_LABELS: Record<RecentActivity['type'], string> = {
  game_created: 'Nowa gra',
  game_published: 'Opublikowano',
  game_archived: 'Zarchiwizowano',
  session_completed: 'Ukończono',
  session_abandoned: 'Porzucono',
  session_timed_out: 'Czas minął',
  player_joined: 'Nowy gracz',
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 0) return 'przed chwilą';
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  return new Date(timestamp).toLocaleDateString('pl-PL');
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/api/admin/stats'),
  });

  const { data: runningGames = [] } = useQuery<Game[]>({
    queryKey: ['running-games'],
    queryFn: () => adminApi.getRunningGames(),
    refetchInterval: 30_000,
  });

  const { data: recentActivity = [] } = useQuery<RecentActivity[]>({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get<RecentActivity[]>('/api/admin/activity'),
    retry: false,
    refetchInterval: 30_000,
  });

  const isLoading = statsLoading;

  const displayStats = {
    activeGames: stats?.activeGames ?? 0,
    totalPlayers: stats?.totalPlayers ?? 0,
    totalTasks: stats?.totalTasks ?? 0,
    activeSessions: stats?.activeSessions ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Przegląd platformy CityGame</p>
      </div>

      {/* Stats error */}
      {statsError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          Nie udało się załadować statystyk
        </div>
      )}

      {/* Stats grid */}
      <ErrorBoundary>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          icon={<Gamepad2 size={20} />}
          label="Aktywne gry"
          value={isLoading ? '—' : displayStats.activeGames}
          trend={0}
          trendLabel="opublikowane"
        />
        <StatsCard
          icon={<Users size={20} />}
          label="Gracze"
          value={isLoading ? '—' : displayStats.totalPlayers}
          trend={0}
          trendLabel="zarejestrowani"
        />
        <StatsCard
          icon={<ListChecks size={20} />}
          label="Zadania"
          value={isLoading ? '—' : displayStats.totalTasks}
          trend={0}
          trendLabel="we wszystkich grach"
        />
        <StatsCard
          icon={<Activity size={20} />}
          label="Aktywne sesje"
          value={isLoading ? '—' : displayStats.activeSessions}
          trend={0}
          trendLabel={displayStats.activeSessions > 0 ? 'trwa teraz' : 'brak sesji'}
        />
      </div>
      </ErrorBoundary>

      {/* Running Games */}
      {runningGames.length > 0 && (
        <ErrorBoundary>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Play size={16} className="text-green-600" />
            <h3 className="text-base font-semibold text-gray-800">Aktywne sesje gier</h3>
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {runningGames.length} {runningGames.length === 1 ? 'gra' : 'gier'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {runningGames.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{game.title}</p>
                  <p className="text-xs text-gray-500">{game.city}</p>
                </div>
                {game.activeRun?.endsAt && (
                  <span className="text-xs text-[#FF6B35] font-medium flex-shrink-0">
                    <Clock size={12} className="inline mr-0.5" />
                    {(() => {
                      const diff = new Date(game.activeRun.endsAt).getTime() - Date.now();
                      if (diff <= 0) return 'Kończy się';
                      const m = Math.floor(diff / 60_000);
                      return `${m} min`;
                    })()}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
        </ErrorBoundary>
      )}

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
