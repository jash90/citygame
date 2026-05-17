'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3, Users, Clock } from 'lucide-react';
import type { GameRun } from '@citygame/shared';

interface RunAnalyticsHeaderProps {
  gameId: string;
  gameTitle: string;
  run: GameRun & { _count: { sessions: number } };
}

const dateFmt: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function formatDuration(startedAt: Date, endedAt: Date | null): string {
  const end = endedAt ?? new Date();
  const totalMinutes = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export function RunAnalyticsHeader({ gameId, gameTitle, run }: RunAnalyticsHeaderProps) {
  const startedAt = new Date(run.startedAt);
  const endedAt = run.endedAt ? new Date(run.endedAt) : null;
  const isActive = run.status === 'ACTIVE';
  const sessionCount = run._count?.sessions ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/games/${gameId}`}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Wróć do gry
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#FF6B35] text-white">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Sesja #{run.runNumber} — {gameTitle}
            </h2>
            <p className="text-sm text-gray-500">
              Analityka pojedynczej sesji gry
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isActive ? 'Aktywna' : 'Zakończona'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
        <span className="flex items-center gap-1.5">
          <Clock size={14} className="text-gray-400" />
          {startedAt.toLocaleString('pl-PL', dateFmt)}
          {' → '}
          {endedAt ? endedAt.toLocaleString('pl-PL', dateFmt) : 'teraz'}
        </span>
        <span className="text-gray-300">·</span>
        <span className="font-medium">{formatDuration(startedAt, endedAt)}</span>
        <span className="text-gray-300">·</span>
        <span className="flex items-center gap-1.5">
          <Users size={14} className="text-gray-400" />
          {sessionCount} graczy
        </span>
      </div>
    </div>
  );
}
