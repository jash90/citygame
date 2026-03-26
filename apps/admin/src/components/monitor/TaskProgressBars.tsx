'use client';

import { useMemo } from 'react';
import {
  QrCode,
  MapPin,
  Camera,
  Mic,
  Type,
  Brain,
  Lock,
  Layers,
} from 'lucide-react';
import type { TaskProgressEntry } from '@/hooks/useMonitor';

interface TaskProgressBarsProps {
  tasks: TaskProgressEntry[];
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; colorClass: string }
> = {
  QR_SCAN: { label: 'QR', icon: <QrCode size={11} />, colorClass: 'bg-blue-100 text-blue-700' },
  GPS_REACH: { label: 'GPS', icon: <MapPin size={11} />, colorClass: 'bg-emerald-100 text-emerald-700' },
  PHOTO_AI: { label: 'Foto AI', icon: <Camera size={11} />, colorClass: 'bg-violet-100 text-violet-700' },
  AUDIO_AI: { label: 'Audio AI', icon: <Mic size={11} />, colorClass: 'bg-pink-100 text-pink-700' },
  TEXT_EXACT: { label: 'Tekst', icon: <Type size={11} />, colorClass: 'bg-gray-100 text-gray-600' },
  TEXT_AI: { label: 'Tekst AI', icon: <Brain size={11} />, colorClass: 'bg-orange-100 text-orange-700' },
  CIPHER: { label: 'Szyfr', icon: <Lock size={11} />, colorClass: 'bg-red-100 text-red-700' },
  MIXED: { label: 'Mix', icon: <Layers size={11} />, colorClass: 'bg-teal-100 text-teal-700' },
};

function getBarColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-[#FF6B35]';
  if (pct >= 20) return 'bg-yellow-500';
  return 'bg-red-400';
}

export function TaskProgressBars({ tasks }: TaskProgressBarsProps) {
  // Sort ascending by completion rate — hardest (lowest pct) first
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const pctA = a.total > 0 ? a.completions / a.total : 0;
        const pctB = b.total > 0 ? b.completions / b.total : 0;
        return pctA - pctB;
      }),
    [tasks],
  );

  if (!sorted.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
        Brak danych o zadaniach
      </div>
    );
  }

  return (
    <ul className="space-y-3 p-4">
      {sorted.map((task) => {
        const pct = task.total > 0 ? Math.round((task.completions / task.total) * 100) : 0;
        const typeConf = TYPE_CONFIG[task.type] ?? TYPE_CONFIG['TEXT_EXACT'];

        return (
          <li key={task.taskId}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${typeConf.colorClass}`}
              >
                {typeConf.icon}
                {typeConf.label}
              </span>
              <span className="text-sm font-medium text-gray-700 truncate flex-1">
                {task.title}
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0 font-mono">
                {task.completions}/{task.total}
              </span>
              <span className="text-xs font-bold text-gray-700 flex-shrink-0 w-9 text-right">
                {pct}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${getBarColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
