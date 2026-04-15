'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Star,
  Timer,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { useAnalytics, type AnalyticsPeriod } from '@/features/analytics/hooks/useAnalytics';
import { MetricCard } from '@/features/analytics/components/MetricCard';
import { PlayerActivityChart } from '@/features/analytics/components/PlayerActivityChart';
import { TaskFunnelChart } from '@/features/analytics/components/TaskFunnelChart';
import { ScoreDistributionChart } from '@/features/analytics/components/ScoreDistributionChart';
import { TaskDifficultyChart } from '@/features/analytics/components/TaskDifficultyChart';
import { ChartCard } from '@/features/analytics/components/Cards';
import { AnalyticsHeader } from '@/features/analytics/components/AnalyticsHeader';
import { TopPlayersTable } from '@/features/analytics/components/TopPlayersTable';
import { AiVerificationTable } from '@/features/analytics/components/AiVerificationTable';

export default function AnalyticsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(
    undefined,
  );

  const { data, game, runs, isLoading, error } = useAnalytics(
    gameId,
    period,
    selectedRunId,
  );

  const selectedRun = selectedRunId
    ? runs.find((r) => r.id === selectedRunId)
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Ładowanie analityki...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-600">
        <AlertCircle size={32} />
        <p className="text-sm">
          Nie udało się załadować danych analitycznych.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <AnalyticsHeader
        gameId={gameId}
        gameTitle={game?.title ?? 'Gra'}
        runs={runs}
        selectedRunId={selectedRunId}
        period={period}
        onRunChange={setSelectedRunId}
        onPeriodChange={setPeriod}
      />

      {selectedRun && (
        <div className="px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
          <span>
            Filtrowanie po:{' '}
            <span className="font-medium">
              Sesja #{selectedRun.runNumber}
            </span>{' '}
            ({selectedRun.sessionCount} graczy)
          </span>
          <button
            onClick={() => setSelectedRunId(undefined)}
            className="text-blue-600 hover:text-blue-800 font-medium underline text-xs"
          >
            Wyczyść filtr
          </button>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Łączna liczba graczy"
          value={data.totalPlayers}
          change={data.playersTrend}
          icon={<Users size={20} />}
        />
        <MetricCard
          label="Wskaźnik ukończenia"
          value={`${data.completionRate}%`}
          change={data.completionRateTrend}
          icon={<CheckCircle2 size={20} />}
        />
        <MetricCard
          label="Średni wynik"
          value={data.averageScore}
          icon={<Star size={20} />}
        />
        <MetricCard
          label="Średni czas"
          value={
            data.averageTimeMinutes > 0
              ? `${data.averageTimeMinutes} min`
              : '—'
          }
          icon={<Timer size={20} />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Aktywność graczy w czasie">
          <PlayerActivityChart data={data.playerActivity} />
        </ChartCard>
        <ChartCard title="Lejek ukończenia zadań">
          <TaskFunnelChart data={data.taskFunnel} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Rozkład wyników graczy">
          <ScoreDistributionChart data={data.scoreDistribution} />
        </ChartCard>
        <ChartCard title="Trudność zadań (średnia liczba prób)">
          <TaskDifficultyChart data={data.taskDifficulty} />
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPlayersTable players={data.topPlayers} />
        <AiVerificationTable stats={data.aiVerificationStats} />
      </div>
    </div>
  );
}
