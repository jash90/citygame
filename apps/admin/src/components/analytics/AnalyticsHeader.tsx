'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import type { RunOption } from '@/hooks/useAnalytics';
import type { AnalyticsPeriod } from '@/hooks/useAnalytics';

interface AnalyticsHeaderProps {
  gameId: string;
  gameTitle: string;
  runs: RunOption[];
  selectedRunId: string | undefined;
  period: AnalyticsPeriod;
  onRunChange: (id: string | undefined) => void;
  onPeriodChange: (p: AnalyticsPeriod) => void;
}

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 dni' },
  { value: '30d', label: '30 dni' },
  { value: 'all', label: 'Wszystko' },
];

export function AnalyticsHeader({
  gameId,
  gameTitle,
  runs,
  selectedRunId,
  period,
  onRunChange,
  onPeriodChange,
}: AnalyticsHeaderProps) {
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
              Analityka — {gameTitle}
            </h2>
            <p className="text-sm text-gray-500">
              Statystyki i wykresy wydajności gry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {runs.length > 0 && (
            <div className="relative">
              <select
                value={selectedRunId ?? ''}
                onChange={(e) => onRunChange(e.target.value || undefined)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 cursor-pointer hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]"
              >
                <option value="">Wszystkie sesje</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    Sesja #{run.runNumber} ({run.sessionCount} graczy)
                    {run.status === 'ACTIVE' ? ' — aktywna' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          )}

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onPeriodChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
