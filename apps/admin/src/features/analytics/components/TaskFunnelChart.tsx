'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
  Legend,
} from 'recharts';

interface TaskFunnelDataPoint {
  taskTitle: string;
  completions: number;
  totalPlayers: number;
  priorCompletionRate?: number;
}

interface TaskFunnelChartProps {
  data: TaskFunnelDataPoint[];
}

/** Interpolates from green → yellow → red based on position in list (funnel drop-off) */
function getBarColor(index: number, total: number): string {
  if (total <= 1) return '#22c55e';
  const ratio = index / (total - 1);
  if (ratio < 0.5) {
    const r = Math.round(34 + (234 - 34) * (ratio * 2));
    const g = Math.round(197 + (179 - 197) * (ratio * 2));
    const b = Math.round(94 + (8 - 94) * (ratio * 2));
    return `rgb(${r},${g},${b})`;
  }
  const r2 = (ratio - 0.5) * 2;
  const r = Math.round(234 + (239 - 234) * r2);
  const g = Math.round(179 + (68 - 179) * r2);
  const b = Math.round(8 + (68 - 8) * r2);
  return `rgb(${r},${g},${b})`;
}

export function TaskFunnelChart({ data }: TaskFunnelChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Brak danych zadań
      </div>
    );
  }

  const hasPrior = data.some((d) => d.priorCompletionRate !== undefined);

  // Compute current run completion percentage per task so both series live
  // on the same scale (0-100 %).
  const chartData = data.map((d) => ({
    taskTitle: d.taskTitle,
    currentPct:
      d.totalPlayers > 0 ? Math.round((d.completions / d.totalPlayers) * 100) : 0,
    priorPct: d.priorCompletionRate ?? null,
    completions: d.completions,
    totalPlayers: d.totalPlayers,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="taskTitle"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={32}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : Number(value ?? 0);
            if (name === 'priorPct') return [`${num}%`, 'Średnia poprzednich sesji'];
            return [`${num}%`, 'Bieżąca sesja'];
          }}
        />
        {hasPrior && <Legend wrapperStyle={{ fontSize: 11 }} iconType="rect" />}
        {hasPrior && (
          <Bar
            dataKey="priorPct"
            name="Średnia poprzednich sesji"
            fill="#cbd5e1"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        )}
        <Bar
          dataKey="currentPct"
          name="Bieżąca sesja"
          radius={[4, 4, 0, 0]}
          maxBarSize={hasPrior ? 32 : 48}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={getBarColor(index, chartData.length)} />
          ))}
          <LabelList
            dataKey="currentPct"
            position="top"
            formatter={(value: unknown) => `${Number(value ?? 0)}%`}
            style={{ fontSize: 10, fill: '#6b7280' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
