'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Lightbulb, UserPlus, Trophy, Filter } from 'lucide-react';
import type { ActivityEntry } from '@/features/monitor/hooks/useMonitor';

interface PlayerActivityFeedProps {
  entries: ActivityEntry[];
}

type ActionFilter = 'all' | ActivityEntry['action'];

const ACTION_CONFIG: Record<
  ActivityEntry['action'],
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  task_completed: {
    label: 'Ukończono',
    colorClass: 'text-green-700 bg-green-50 border-green-200',
    icon: <CheckCircle2 size={12} />,
  },
  hint_used: {
    label: 'Podpowiedź',
    colorClass: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    icon: <Lightbulb size={12} />,
  },
  game_joined: {
    label: 'Dołączył(a)',
    colorClass: 'text-[#FF6B35] bg-orange-50 border-orange-200',
    icon: <UserPlus size={12} />,
  },
  game_completed: {
    label: 'Ukończono grę',
    colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
    icon: <Trophy size={12} />,
  },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function PlayerActivityFeed({ entries }: PlayerActivityFeedProps) {
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [playerFilter, setPlayerFilter] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to newest entry when autoScroll is on
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [entries, autoScroll]);

  const handleScroll = () => {
    if (!listRef.current) return;
    // If user scrolled away from top, disable auto-scroll
    setAutoScroll(listRef.current.scrollTop < 40);
  };

  const filtered = entries.filter((e) => {
    const matchesAction = filter === 'all' || e.action === filter;
    const matchesPlayer =
      playerFilter === '' ||
      e.playerName.toLowerCase().includes(playerFilter.toLowerCase());
    return matchesAction && matchesPlayer;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          placeholder="Filtruj gracza..."
          className="text-xs px-2 py-1 border border-gray-200 rounded-md w-32 outline-none focus:border-[#FF6B35]"
        />
        <div className="flex items-center gap-1 ml-auto">
          {(['all', 'task_completed', 'hint_used', 'game_joined', 'game_completed'] as ActionFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  filter === f
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                    : 'border-gray-200 text-gray-500 hover:border-[#FF6B35] hover:text-[#FF6B35]'
                }`}
              >
                {f === 'all' ? 'Wszystkie' : ACTION_CONFIG[f as ActivityEntry['action']].label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Auto-scroll toggle hint */}
      {!autoScroll && (
        <button
          onClick={() => setAutoScroll(true)}
          className="mx-4 mt-2 text-xs text-[#FF6B35] bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-orange-100 transition-colors"
        >
          <Activity size={12} />
          Kliknij, aby wrócić do automatycznego przewijania
        </button>
      )}

      {/* Feed list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-2">
          <Activity size={28} className="opacity-30" />
          <p className="text-sm">Brak aktywności</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto divide-y divide-gray-50 p-2"
        >
          {filtered.map((entry) => {
            const config = ACTION_CONFIG[entry.action];
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`flex items-center gap-1 flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${config.colorClass}`}
                >
                  {config.icon}
                  {config.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{entry.playerName}</p>
                  <p className="text-xs text-gray-500 truncate">{entry.details}</p>
                  {entry.points !== undefined && (
                    <p className="text-xs font-medium text-[#FF6B35] mt-0.5">+{entry.points} pkt</p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-gray-400 font-mono mt-0.5">
                  {formatTime(entry.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
