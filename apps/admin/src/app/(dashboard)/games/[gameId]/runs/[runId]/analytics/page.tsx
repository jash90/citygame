'use client';

import { useParams } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Star,
  Timer,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { useRunAnalytics } from '@/features/analytics/hooks/useRunAnalytics';
import { MetricCard } from '@/features/analytics/components/MetricCard';
import { PlayerActivityChart } from '@/features/analytics/components/PlayerActivityChart';
import { TaskFunnelChart } from '@/features/analytics/components/TaskFunnelChart';
import { ScoreDistributionChart } from '@/features/analytics/components/ScoreDistributionChart';
import { TaskDifficultyChart } from '@/features/analytics/components/TaskDifficultyChart';
import { ChartCard } from '@/features/analytics/components/Cards';
import { CrossRunComparison } from '@/features/analytics/components/CrossRunComparison';
import { RunAnalyticsHeader } from '@/features/analytics/components/RunAnalyticsHeader';
import { TopPlayersTable } from '@/features/analytics/components/TopPlayersTable';
import { AiVerificationTable } from '@/features/analytics/components/AiVerificationTable';

export default function RunAnalyticsPage() {
  const { gameId, runId } = useParams<{ gameId: string; runId: string }>();

  const { data, game, run, baseline, timeline, isLoading, error } =
    useRunAnalytics(gameId, runId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Ładowanie analityki sesji...</span>
      </div>
    );
  }

  if (error || !data || !run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-600">
        <AlertCircle size={32} />
        <p className="text-sm">
          Nie udało się załadować danych analitycznych dla tej sesji.
        </p>
      </div>
    );
  }

  const hasBaseline = (baseline?.runsCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <RunAnalyticsHeader
        gameId={gameId}
        gameTitle={game?.title ?? 'Gra'}
        run={run}
      />

      {!hasBaseline && (
        <div className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          To pierwsza zakończona sesja tej gry — brak danych historycznych do porównań.
        </div>
      )}

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

      {timeline.length > 1 && (
        <ChartCard title="Porównanie sesji">
          <CrossRunComparison timeline={timeline} />
        </ChartCard>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPlayersTable players={data.topPlayers} />
        <AiVerificationTable stats={data.aiVerificationStats} />
      </div>
    </div>
  );
}
