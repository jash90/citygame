'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Star,
  Timer,
  Loader2,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

import { useAnalytics, type AnalyticsPeriod } from '@/hooks/useAnalytics';
import { MetricCard } from '@/components/analytics/MetricCard';
import { PlayerActivityChart } from '@/components/analytics/PlayerActivityChart';
import { TaskFunnelChart } from '@/components/analytics/TaskFunnelChart';
import { ScoreDistributionChart } from '@/components/analytics/ScoreDistributionChart';
import { TaskDifficultyChart } from '@/components/analytics/TaskDifficultyChart';

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 dni' },
  { value: '30d', label: '30 dni' },
  { value: 'all', label: 'Wszystko' },
];

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');

  const analytics = useAnalytics(gameId, period);
  const { data, game, isLoading, error } = analytics;

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
        <p className="text-sm">Nie udało się załadować danych analitycznych.</p>
        <Link
          href={`/games/${gameId}`}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Wróć do gry
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      {/* Header */}
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
                Analityka — {game?.title ?? 'Gra'}
              </h2>
              <p className="text-sm text-gray-500">
                Statystyki i wykresy wydajności gry
              </p>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
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

      {analytics.isSimulated && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-medium">Dane demonstracyjne</span>
          <span className="text-amber-600">— wykresy i statystyki są generowane na podstawie szacunków, nie rzeczywistych danych.</span>
        </div>
      )}

      {/* Row 1 — Key metrics */}
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

      {/* Row 2 — Activity + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Aktywność graczy w czasie">
          <PlayerActivityChart data={data.playerActivity} />
        </ChartCard>
        <ChartCard title="Lejek ukończenia zadań">
          <TaskFunnelChart data={data.taskFunnel} />
        </ChartCard>
      </div>

      {/* Row 3 — Score distribution + Task difficulty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Rozkład wyników graczy">
          <ScoreDistributionChart data={data.scoreDistribution} />
        </ChartCard>
        <ChartCard title="Trudność zadań (średnia liczba prób)">
          <TaskDifficultyChart data={data.taskDifficulty} />
        </ChartCard>
      </div>

      {/* Row 4 — Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top players */}
        <TableCard title="Najlepsi gracze">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Gracz
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Wynik
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Zadania
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Czas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Aktywność
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Brak danych graczy
                    </td>
                  </tr>
                ) : (
                  data.topPlayers.map((player) => (
                    <tr key={player.rank} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            player.rank === 1
                              ? 'bg-amber-100 text-amber-600'
                              : player.rank === 2
                                ? 'bg-gray-100 text-gray-600'
                                : player.rank === 3
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          {player.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{player.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#FF6B35]">
                        {player.score}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {player.tasksCompleted}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {player.timeMinutes > 0 ? `${player.timeMinutes} min` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {player.lastActive}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TableCard>

        {/* AI verification stats */}
        <TableCard title="Statystyki weryfikacji AI">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Zadanie
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Ewaluacje
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Śr. wynik
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Błędy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.aiVerificationStats.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                      Brak danych weryfikacji
                    </td>
                  </tr>
                ) : (
                  data.aiVerificationStats.map((stat, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{stat.taskName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{stat.evaluations}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${
                            stat.avgScore >= 80
                              ? 'text-green-600'
                              : stat.avgScore >= 60
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {stat.avgScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stat.errorRate > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                            {stat.errorRate}%
                          </span>
                        ) : (
                          <span className="text-green-500 font-medium">0%</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TableCard>
      </div>
    </div>
  );
}
