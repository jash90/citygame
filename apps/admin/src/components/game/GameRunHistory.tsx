'use client';

import { History } from 'lucide-react';
import type { GameRun } from '@citygame/shared';

interface GameRunHistoryProps {
  runs: (GameRun & { _count: { sessions: number } })[];
}

export function GameRunHistory({ runs }: GameRunHistoryProps) {
  if (runs.length === 0) return null;

  return (
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
  );
}
