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
} from 'recharts';

interface TaskDifficultyDataPoint {
  taskTitle: string;
  avgAttempts: number;
  avgTimeSec: number;
}

interface TaskDifficultyChartProps {
  data: TaskDifficultyDataPoint[];
}

function getDifficultyColor(avgAttempts: number): string {
  if (avgAttempts <= 1.5) return '#22c55e'; // easy — green
  if (avgAttempts <= 2.5) return '#f59e0b'; // medium — yellow
  return '#ef4444'; // hard — red
}

function getDifficultyLabel(avgAttempts: number): string {
  if (avgAttempts <= 1.5) return 'łatwe';
  if (avgAttempts <= 2.5) return 'średnie';
  return 'trudne';
}

export function TaskDifficultyChart({ data }: TaskDifficultyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Brak danych trudności
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.avgAttempts - a.avgAttempts);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 44)}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            label={{ value: 'śr. prób', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#9ca3af' }}
          />
          <YAxis
            type="category"
            dataKey="taskTitle"
            tick={{ fontSize: 11, fill: '#374151' }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '12px',
            }}
            formatter={(value, name) => {
              const num = typeof value === 'number' ? value : Number(value ?? 0);
              if (name === 'avgAttempts') {
                return [`${num.toFixed(1)} prób (${getDifficultyLabel(num)})`, 'Średnia prób'];
              }
              return [value ?? 0, name];
            }}
          />
          <Bar dataKey="avgAttempts" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {sorted.map((entry, index) => (
              <Cell key={index} fill={getDifficultyColor(entry.avgAttempts)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-end text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          Łatwe (≤1.5 prób)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
          Średnie (≤2.5)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
          Trudne (&gt;2.5)
        </span>
      </div>
    </div>
  );
}
