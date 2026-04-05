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
} from 'recharts';

interface TaskFunnelDataPoint {
  taskTitle: string;
  completions: number;
  totalPlayers: number;
}

interface TaskFunnelChartProps {
  data: TaskFunnelDataPoint[];
}

/** Interpolates from green → yellow → red based on position in list (funnel drop-off) */
function getBarColor(index: number, total: number): string {
  if (total <= 1) return '#22c55e';
  const ratio = index / (total - 1);
  if (ratio < 0.5) {
    // green → yellow
    const r = Math.round(34 + (234 - 34) * (ratio * 2));
    const g = Math.round(197 + (179 - 197) * (ratio * 2));
    const b = Math.round(94 + (8 - 94) * (ratio * 2));
    return `rgb(${r},${g},${b})`;
  }
  // yellow → red
  const r2 = (ratio - 0.5) * 2;
  const r = Math.round(234 + (239 - 234) * r2);
  const g = Math.round(179 + (68 - 179) * r2);
  const b = Math.round(8 + (68 - 8) * r2);
  return `rgb(${r},${g},${b})`;
}

function _formatLabel(value: number, entry: { payload?: TaskFunnelDataPoint }) {
  const total = entry?.payload?.totalPlayers ?? 0;
  if (total === 0) return `${value}`;
  const pct = Math.round((value / total) * 100);
  return `${pct}%`;
}

export function TaskFunnelChart({ data }: TaskFunnelChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Brak danych zadań
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 20, right: 24, left: 0, bottom: 60 }}>
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
          width={28}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
          formatter={(value, _name, props) => {
            const num = typeof value === 'number' ? value : Number(value ?? 0);
            const total = (props as { payload?: TaskFunnelDataPoint })?.payload?.totalPlayers ?? 0;
            const pct = total > 0 ? Math.round((num / total) * 100) : 0;
            return [`${num} (${pct}%)`, 'Ukończenia'];
          }}
        />
        <Bar dataKey="completions" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((_, index) => (
            <Cell key={index} fill={getBarColor(index, data.length)} />
          ))}
          <LabelList dataKey="completions" position="top" content={(props) => {
            const { x, y, width, value, index } = props as {
              x: number; y: number; width: number; value: number; index: number;
            };
            const entry = data[index];
            const total = entry?.totalPlayers ?? 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <text
                x={x + width / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={10}
              >
                {pct}%
              </text>
            );
          }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
