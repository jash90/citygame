'use client';

import { Clock, Users, CheckCircle } from 'lucide-react';
import type { ConnectionStatus } from '@/hooks/useWebSocket';

interface GameTimerProps {
  elapsedSeconds: number;
  activePlayers: number;
  totalCompletions: number;
  gameTitle?: string;
  connectionStatus: ConnectionStatus;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; dotClass: string; textClass: string }> = {
  connected: { label: 'Połączono', dotClass: 'bg-green-500 animate-pulse', textClass: 'text-green-700' },
  connecting: { label: 'Łączenie...', dotClass: 'bg-yellow-400 animate-pulse', textClass: 'text-yellow-700' },
  disconnected: { label: 'Rozłączono', dotClass: 'bg-gray-400', textClass: 'text-gray-500' },
};

export function GameTimer({
  elapsedSeconds,
  activePlayers,
  totalCompletions,
  gameTitle,
  connectionStatus,
}: GameTimerProps) {
  const statusConf = STATUS_CONFIG[connectionStatus];

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between gap-4 shadow-sm flex-wrap">
      {/* Game info + timer */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-orange-50 text-[#FF6B35]">
          <Clock size={22} />
        </div>
        <div>
          {gameTitle && (
            <p className="text-xs text-gray-400 font-medium truncate max-w-48">{gameTitle}</p>
          )}
          <span className="font-mono text-2xl font-bold text-[#FF6B35] tabular-nums">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <div className="text-center min-w-12">
          <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-0.5">
            <Users size={14} />
            <span className="text-xs">Gracze</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activePlayers}</p>
        </div>

        <div className="w-px h-10 bg-gray-100" />

        <div className="text-center min-w-12">
          <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-0.5">
            <CheckCircle size={14} />
            <span className="text-xs">Ukończono</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCompletions}</p>
        </div>
      </div>

      {/* Connection status */}
      <div className={`flex items-center gap-1.5 text-xs font-medium ${statusConf.textClass}`}>
        <span className={`w-2 h-2 rounded-full ${statusConf.dotClass}`} />
        {statusConf.label}
      </div>
    </div>
  );
}
