'use client';

import { AlertTriangle, RefreshCw, Bot } from 'lucide-react';
import type { AIErrorEntry } from '@/features/monitor/hooks/useMonitor';

interface AIErrorPanelProps {
  errors: AIErrorEntry[];
  onRetry: (errorId: string) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function AIErrorPanel({ errors, onRetry }: AIErrorPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Error count badge */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-gray-500" />
          <span className="text-xs text-gray-500">Błędy weryfikacji AI</span>
        </div>
        {errors.length > 0 && (
          <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {errors.length}
          </span>
        )}
      </div>

      {errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2 p-4">
          <Bot size={24} className="opacity-30" />
          <p className="text-xs text-center">Brak błędów AI</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-50 p-2">
          {errors.map((error) => (
            <li
              key={error.id}
              className="flex items-start gap-2 py-2.5 px-2 rounded-lg hover:bg-red-50/50 transition-colors"
            >
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {error.taskName}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500 truncate">{error.playerName}</span>
                </div>
                <p className="text-xs text-red-600 line-clamp-2">{error.errorMessage}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatTime(error.timestamp)}</p>
              </div>
              <button
                onClick={() => onRetry(error.id)}
                title="Ponów weryfikację"
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#FF6B35] hover:bg-orange-50 transition-colors"
              >
                <RefreshCw size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
