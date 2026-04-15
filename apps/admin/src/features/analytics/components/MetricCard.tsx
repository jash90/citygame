'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number; // percentage change, positive = up, negative = down
  icon: React.ReactNode;
}

export function MetricCard({ label, value, change, icon }: MetricCardProps) {
  const hasTrend = change !== undefined && change !== null;
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-50 text-[#FF6B35]">
          {icon}
        </div>
        {hasTrend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              isPositive
                ? 'bg-green-50 text-green-600'
                : isNegative
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isPositive && <TrendingUp size={12} />}
            {isNegative && <TrendingDown size={12} />}
            {isNeutral && <Minus size={12} />}
            <span>
              {isPositive ? '+' : ''}
              {change}%
            </span>
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
