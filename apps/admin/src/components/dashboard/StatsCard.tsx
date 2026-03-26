import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: number; // positive = up, negative = down, 0 = flat
  trendLabel?: string;
}

export function StatsCard({ icon, label, value, trend, trendLabel }: StatsCardProps) {
  const trendIcon =
    trend === undefined ? null : trend > 0 ? (
      <TrendingUp size={14} className="text-green-500" />
    ) : trend < 0 ? (
      <TrendingDown size={14} className="text-red-500" />
    ) : (
      <Minus size={14} className="text-gray-400" />
    );

  const trendColor =
    trend === undefined
      ? ''
      : trend > 0
        ? 'text-green-600'
        : trend < 0
          ? 'text-red-600'
          : 'text-gray-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-50 text-[#FF6B35]">
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            {trendIcon}
            <span>{trendLabel ?? `${Math.abs(trend)}%`}</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
