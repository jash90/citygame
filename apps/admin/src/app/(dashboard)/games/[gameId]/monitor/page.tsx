'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronUp, Activity, CheckCircle, MapPin, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { Game, Task } from '@citygame/shared';
import { useMonitor } from '@/hooks/useMonitor';
import { GameTimer } from '@/components/monitor/GameTimer';
import { PlayerActivityFeed } from '@/components/monitor/PlayerActivityFeed';
import { TaskProgressBars } from '@/components/monitor/TaskProgressBars';
import { AIErrorPanel } from '@/components/monitor/AIErrorPanel';
import dynamic from 'next/dynamic';

const LiveMapMonitor = dynamic(
  () => import('@/components/monitor/LiveMapMonitor').then((m) => m.LiveMapMonitor),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-gray-400 text-sm">Ładowanie mapy…</div> },
);

export default function MonitorPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [mapExpanded, setMapExpanded] = useState(true);

  // Fetch base game info with tasks
  const { data: game, isLoading: gameLoading } = useQuery<Game & { tasks: Task[] }>({
    queryKey: ['games', gameId],
    queryFn: () => adminApi.getGame(gameId),
  });

  const activeRunId = game?.activeRun?.id as string | undefined;

  // Fetch sessions for player count baseline — filtered to active run
  const { data: sessionsPage } = useQuery({
    queryKey: ['game-sessions', gameId, activeRunId],
    queryFn: () => adminApi.getGameSessions(gameId, activeRunId),
    enabled: !!gameId && !!activeRunId,
  });
  const sessions = sessionsPage?.items ?? [];

  // Fetch per-task completions for initial progress
  const { data: runCompletions } = useQuery({
    queryKey: ['run-completions', gameId, activeRunId],
    queryFn: () => adminApi.getRunCompletions(gameId, activeRunId),
    enabled: !!gameId,
  });

  // Fetch historical activity for the active run
  const { data: runActivity } = useQuery({
    queryKey: ['run-activity', gameId, activeRunId],
    queryFn: () => adminApi.getRunActivity(gameId, activeRunId),
    enabled: !!gameId,
  });

  // Real-time monitor hook
  const {
    activities,
    taskProgress,
    aiErrors,
    playerLocations,
    stats,
    connectionStatus,
    retryAIError,
    setTaskProgress,
    setActivities,
  } = useMonitor({
    gameId,
    startedAt: game?.activeRun?.startedAt ?? game?.createdAt,
    initialPlayerCount: sessions.filter((s: { status: string }) => s.status === 'ACTIVE').length,
    initialCompletions: (runCompletions?.completions ?? []).reduce((sum, c) => sum + c.count, 0),
  });

  // Seed historical activities from database
  useEffect(() => {
    if (!runActivity?.length) return;
    setActivities(
      runActivity.map((a) => ({
        id: a.id,
        timestamp: new Date(a.timestamp),
        playerName: a.playerName,
        action: a.action,
        details: a.details,
        points: a.points,
      })),
    );
  }, [runActivity, setActivities]);

  // Seed task progress from real game tasks + initial completion data
  useEffect(() => {
    if (!game?.tasks?.length) return;
    const totalPlayers = Math.max(sessions.length, 1);
    const completionMap = new Map(
      (runCompletions?.completions ?? []).map((c) => [c.taskId, c.count]),
    );
    setTaskProgress(
      game.tasks.map((t) => ({
        taskId: t.id,
        title: t.title,
        type: t.type,
        completions: completionMap.get(t.id) ?? 0,
        total: totalPlayers,
      })),
    );
  }, [game, sessions.length, runCompletions, setTaskProgress]);

  // Task locations derived from real task coordinates
  const taskLocations = (game?.tasks ?? [])
    .filter((t) => t.latitude !== 0 || t.longitude !== 0)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      latitude: t.latitude,
      longitude: t.longitude,
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

      {/* Collapsible live map section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setMapExpanded((v) => !v)}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 w-full text-left hover:bg-gray-50 transition-colors"
        >
          <MapPin size={15} className="text-[#FF6B35]" />
          <span className="text-sm font-semibold text-gray-700">Mapa live</span>
          {playerLocations.length > 0 && (
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {playerLocations.length} graczy
            </span>
          )}
          <span className="ml-auto text-gray-400">
            {mapExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>
        {mapExpanded && (
          <div style={{ height: '360px' }}>
            <LiveMapMonitor tasks={taskLocations} players={playerLocations} />
          </div>
        )}
      </div>
    </div>
  );
}
