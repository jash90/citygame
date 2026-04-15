'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Square, Clock, AlertTriangle } from 'lucide-react';
import { adminApi } from '@/shared/lib/admin-api';
import type { GameRun } from '@citygame/shared';

interface GameRunControlProps {
  gameId: string;
  activeRun?: {
    runNumber: number;
    startedAt: string;
    endsAt?: string | null;
  } | null;
  timeLimitMinutes?: number;
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Zakończona';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
}

export function GameRunControl({ gameId, activeRun, timeLimitMinutes }: GameRunControlProps) {
  const queryClient = useQueryClient();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['games', gameId] });
    void queryClient.invalidateQueries({ queryKey: ['games', gameId, 'runs'] });
  };

  const startRunMutation = useMutation({
    mutationFn: () => adminApi.startRun(gameId),
    onSuccess: invalidate,
  });

  const endRunMutation = useMutation({
    mutationFn: () => adminApi.endRun(gameId),
    onSuccess: () => {
      setConfirmEnd(false);
      invalidate();
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Play size={18} className="text-[#FF6B35]" />
        Sesja gry
      </h3>

      {activeRun ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Aktywna
            </span>
            <span className="text-sm text-gray-500">
              Sesja #{activeRun.runNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Rozpoczęto</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(activeRun.startedAt).toLocaleString('pl-PL')}
              </p>
            </div>
            {activeRun.endsAt && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Pozostało</p>
                <p className="text-sm font-bold text-[#FF6B35]">
                  <Clock size={14} className="inline mr-1" />
                  {formatCountdown(activeRun.endsAt)}
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
          {timeLimitMinutes && (
            <p className="text-sm text-gray-600">
              <Clock size={14} className="inline mr-1" />
              Limit czasu: <strong>{timeLimitMinutes} min</strong>
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
  );
}
