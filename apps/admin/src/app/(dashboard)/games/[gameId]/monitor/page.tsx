'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronUp, Activity, CheckCircle, MapPin, Loader2 } from 'lucide-react';
import { api, adminApi } from '@/lib/api';
import type { Game } from '@citygame/shared';
import { useMonitor } from '@/hooks/useMonitor';
import { GameTimer } from '@/components/monitor/GameTimer';
import { PlayerActivityFeed } from '@/components/monitor/PlayerActivityFeed';
import { TaskProgressBars } from '@/components/monitor/TaskProgressBars';
import { AIErrorPanel } from '@/components/monitor/AIErrorPanel';
import { MiniMapMonitor } from '@/components/monitor/MiniMapMonitor';

export default function MonitorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [mapExpanded, setMapExpanded] = useState(true);

  // Fetch base game info
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ['games', gameId],
    queryFn: () => api.get<Game>(`/api/games/${gameId}`),
  });

  // Fetch sessions for player count baseline
  const { data: sessions = [] } = useQuery({
    queryKey: ['game-sessions', gameId],
    queryFn: () => adminApi.getGameSessions(gameId),
    enabled: !!gameId,
  });

  // Real-time monitor hook
  const {
    activities,
    taskProgress,
    aiErrors,
    stats,
    connectionStatus,
    retryAIError,
    setTaskProgress,
  } = useMonitor({
    gameId,
    startedAt: game?.createdAt,
    initialPlayerCount: sessions.length,
  });

  // Seed task progress from game data when available
  useEffect(() => {
    if (!game || taskProgress.length > 0) return;
    // If we have real task data from adminApi we'd use it; seed with game.taskCount placeholder
    const count = game.taskCount ?? 0;
    if (count === 0) return;
    setTaskProgress(
      Array.from({ length: count }, (_, i) => ({
        taskId: `task-placeholder-${i}`,
        title: `Zadanie ${i + 1}`,
        type: 'QR_SCAN',
        completions: 0,
        total: Math.max(game.playerCount ?? 1, 1),
      })),
    );
  }, [game, taskProgress.length, setTaskProgress]);

  // Task locations derived from sessions or empty for MVP
  const taskLocations = taskProgress
    .filter((t) => !t.taskId.startsWith('task-placeholder'))
    .map((t) => ({
      taskId: t.taskId,
      title: t.title,
      latitude: 0,
      longitude: 0,
      activePlayerCount: 0,
    }));

  if (gameLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        Ładowanie...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/games/${gameId}`}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Wróć do gry
          </Link>
          <span className="text-gray-300">/</span>
          <h2 className="text-lg font-bold text-gray-900">Monitoring live</h2>
        </div>
      </div>

      {/* Game timer bar */}
      <GameTimer
        elapsedSeconds={stats.elapsedSeconds}
        activePlayers={stats.activePlayers}
        totalCompletions={stats.totalCompletions}
        gameTitle={game?.title}
        connectionStatus={connectionStatus}
      />

      {/* Main content: 60/40 split */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left — Activity feed (60%) */}
        <div className="flex-[3] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <Activity size={15} className="text-[#FF6B35]" />
            <span className="text-sm font-semibold text-gray-700">Aktywność graczy</span>
            {activities.length > 0 && (
              <span className="ml-auto text-xs text-gray-400">{activities.length} zdarzeń</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <PlayerActivityFeed entries={activities} />
          </div>
        </div>

        {/* Right column (40%) — Task progress + AI errors */}
        <div className="flex-[2] flex flex-col gap-4 min-w-0">
          {/* Task progress bars */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
              <CheckCircle size={15} className="text-[#FF6B35]" />
              <span className="text-sm font-semibold text-gray-700">Postęp zadań</span>
              <span className="ml-auto text-xs text-gray-400">najtrudniejsze pierwsze</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TaskProgressBars tasks={taskProgress} />
            </div>
          </div>

          {/* AI error panel */}
          <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden"
            style={{ maxHeight: '280px' }}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700">Błędy AI</span>
              {aiErrors.length > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {aiErrors.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <AIErrorPanel errors={aiErrors} onRetry={retryAIError} />
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible map section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setMapExpanded((v) => !v)}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 w-full text-left hover:bg-gray-50 transition-colors"
        >
          <MapPin size={15} className="text-[#FF6B35]" />
          <span className="text-sm font-semibold text-gray-700">Mini Mapa</span>
          <span className="ml-auto text-gray-400">
            {mapExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>
        {mapExpanded && (
          <div style={{ height: '240px' }}>
            <MiniMapMonitor tasks={taskLocations} />
          </div>
        )}
      </div>
    </div>
  );
}
