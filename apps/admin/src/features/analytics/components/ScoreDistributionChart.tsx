'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ScoreDistributionDataPoint {
  range: string;
  count: number;
}

interface ScoreDistributionChartProps {
  data: ScoreDistributionDataPoint[];
}

export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Brak danych wyników
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
          formatter={(value) => [value ?? 0, 'Liczba graczy']}
          labelFormatter={(label) => `Zakres: ${label} pkt`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.count === maxCount ? '#FF6B35' : '#fed7aa'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
