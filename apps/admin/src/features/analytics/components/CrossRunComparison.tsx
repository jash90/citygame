'use client';

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RunTimelinePoint } from '../hooks/useAnalytics.types';

interface CrossRunComparisonProps {
  timeline: RunTimelinePoint[];
}

type MetricKey = 'totalPlayers' | 'completionRate' | 'avgScore' | 'avgTimeMinutes';

interface Metric {
  key: MetricKey;
  label: string;
  formatter: (v: number) => string;
}

const METRICS: Metric[] = [
  { key: 'totalPlayers',   label: 'Liczba graczy',   formatter: (v) => `${v}` },
  { key: 'completionRate', label: 'Ukończenie',       formatter: (v) => `${v}%` },
  { key: 'avgScore',       label: 'Średni wynik',     formatter: (v) => `${v}` },
  { key: 'avgTimeMinutes', label: 'Średni czas',      formatter: (v) => `${v} min` },
];

const ACCENT = '#FF6B35';
const MUTED = '#cbd5e1';

export function CrossRunComparison({ timeline }: CrossRunComparisonProps) {
  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Brak danych historycznych do porównania.
      </div>
    );
  }

  const sorted = [...timeline].sort((a, b) => a.runNumber - b.runNumber);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {METRICS.map((metric) => {
        const data = sorted.map((r) => ({
          name: `#${r.runNumber}`,
          value: r[metric.key],
          isCurrent: r.isCurrent,
          runNumber: r.runNumber,
        }));

        return (
          <div key={metric.key} className="flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">
                {metric.label}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 107, 53, 0.06)' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value ?? 0);
                    return [metric.formatter(n), metric.label];
                  }}
                  labelFormatter={(label) => `Sesja ${label}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.isCurrent ? ACCENT : MUTED} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value: unknown) => metric.formatter(Number(value ?? 0))}
                    style={{ fontSize: 10, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}

      <div className="sm:col-span-2 flex items-center gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: ACCENT }} />
          Bieżąca sesja
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: MUTED }} />
          Poprzednie sesje
        </span>
      </div>
    </div>
  );
}
