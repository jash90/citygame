'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Activity, BarChart3, Loader2, Calendar, MapPin, Users, ListChecks, Play, Square, Clock, History, AlertTriangle } from 'lucide-react';
import { api, adminApi } from '@/lib/api';
import type { Game, GameRun } from '@citygame/shared';
import { GameStatusBadge } from '@/components/dashboard/GameStatusBadge';
import { GameSettingsEditor } from '@/components/game/GameSettingsEditor';

interface GameDetailResponse extends Game {
  tasks?: unknown[];
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Zakończona';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const queryClient = useQueryClient();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const { data: game, isLoading, error } = useQuery<GameDetailResponse>({
    queryKey: ['games', gameId],
    queryFn: () => api.get<GameDetailResponse>(`/api/admin/games/${gameId}`),
  });

  const { data: runs } = useQuery({
    queryKey: ['games', gameId, 'runs'],
    queryFn: () => adminApi.getGameRuns(gameId),
    enabled: !!game,
  });

  const invalidateGame = () => {
    void queryClient.invalidateQueries({ queryKey: ['games', gameId] });
    void queryClient.invalidateQueries({ queryKey: ['games', gameId, 'runs'] });
  };

  const startRunMutation = useMutation({
    mutationFn: () => adminApi.startRun(gameId),
    onSuccess: invalidateGame,
  });

  const endRunMutation = useMutation({
    mutationFn: () => adminApi.endRun(gameId),
    onSuccess: () => {
      setConfirmEnd(false);
      invalidateGame();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Ładowanie gry...</span>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="py-12 text-center text-red-600 text-sm">
        Nie znaleziono gry lub błąd ładowania.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/games"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Powrót do gier
      </Link>

      {/* Title + actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{game.title}</h2>
            <GameStatusBadge status={game.status} />
          </div>
          <p className="text-gray-500 text-sm">{game.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/games/${game.id}/tasks`}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edytor zadań
          </Link>
          <Link
            href={`/games/${game.id}/analytics`}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 size={15} />
            Analityka
          </Link>
          <Link
            href={`/games/${game.id}/monitor`}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors"
          >
            <Activity size={15} />
            Monitoring
          </Link>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <MapPin size={18} />, label: 'Miasto', value: game.city },
          {
            icon: <ListChecks size={18} />,
            label: 'Zadania',
            value: game.taskCount ?? 0,
          },
          {
            icon: <Users size={18} />,
            label: 'Gracze',
            value: game.playerCount ?? 0,
          },
          {
            icon: <Calendar size={18} />,
            label: 'Utworzono',
            value: new Date(game.createdAt).toLocaleDateString('pl-PL'),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 shadow-sm"
          >
            <div className="text-[#FF6B35]">{item.icon}</div>
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-lg font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Run Control */}
      {game.status === 'PUBLISHED' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Play size={18} className="text-[#FF6B35]" />
            Sesja gry
          </h3>

          {game.activeRun ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Aktywna
                </span>
                <span className="text-sm text-gray-500">
                  Sesja #{game.activeRun.runNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Rozpoczęto</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(game.activeRun.startedAt).toLocaleString('pl-PL')}
                  </p>
                </div>
                {game.activeRun.endsAt && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Pozostało</p>
                    <p className="text-sm font-bold text-[#FF6B35]">
                      <Clock size={14} className="inline mr-1" />
                      {formatCountdown(game.activeRun.endsAt)}
                    </p>
                  </div>
                )}
              </div>

              {!confirmEnd ? (
                <button
                  onClick={() => setConfirmEnd(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Square size={15} />
                  Zakończ sesję
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 flex-1">
                    Wszystkie aktywne sesje graczy zostaną zakończone.
                  </p>
                  <button
                    onClick={() => endRunMutation.mutate()}
                    disabled={endRunMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {endRunMutation.isPending ? 'Kończenie...' : 'Potwierdź'}
                  </button>
                  <button
                    onClick={() => setConfirmEnd(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    Anuluj
                  </button>
                </div>
              )}

              {endRunMutation.isError && (
                <p className="text-sm text-red-600">
                  {(endRunMutation.error as Error).message}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Gra jest opublikowana, ale nie ma aktywnej sesji.
                Gracze nie mogą jeszcze dołączyć.
              </p>
              {game.settings?.timeLimitMinutes && (
                <p className="text-sm text-gray-600">
                  <Clock size={14} className="inline mr-1" />
                  Limit czasu: <strong>{game.settings.timeLimitMinutes} min</strong>
                </p>
              )}
              <button
                onClick={() => startRunMutation.mutate()}
                disabled={startRunMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors disabled:opacity-50 font-medium"
              >
                {startRunMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Play size={15} />
                )}
                {startRunMutation.isPending ? 'Uruchamianie...' : 'Rozpocznij sesję gry'}
              </button>
              {startRunMutation.isError && (
                <p className="text-sm text-red-600">
                  {(startRunMutation.error as Error).message}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Run History */}
      {runs && runs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <History size={18} className="text-gray-400" />
            Historia sesji
          </h3>
          <div className="divide-y divide-gray-100">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    Sesja #{run.runNumber}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      run.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {run.status === 'ACTIVE' ? 'Aktywna' : 'Zakończona'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{run._count.sessions} graczy</span>
                  <span>
                    {new Date(run.startedAt).toLocaleDateString('pl-PL')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      <GameSettingsEditor gameId={game.id} settings={game.settings ?? {}} />
    </div>
  );
}
