'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Activity, BarChart3, Loader2, Calendar, MapPin, Users, ListChecks } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { adminApi } from '@/shared/lib/admin-api';
import type { Game, GameEnding, TaskTransition } from '@citygame/shared';
import { GameStatusBadge } from '@/features/dashboard/components/GameStatusBadge';
import { GameSettingsEditor } from '@/features/game/components/GameSettingsEditor';
import { GameRunControl } from '@/features/game/components/GameRunControl';
import { GameRunHistory } from '@/features/game/components/GameRunHistory';
import { GameFlowDiagram } from '@/features/ai-game/components/GameFlowDiagram';

interface GameDetailTask {
  id: string;
  title: string;
  type: string;
  orderIndex: number;
}

interface GameDetailResponse extends Game {
  tasks?: GameDetailTask[];
  transitions?: TaskTransition[];
  endings?: GameEnding[];
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();

  const { data: game, isLoading, error } = useQuery<GameDetailResponse>({
    queryKey: ['games', gameId],
    queryFn: () => api.get<GameDetailResponse>(`/api/admin/games/${gameId}`),
  });

  const { data: runs } = useQuery({
    queryKey: ['games', gameId, 'runs'],
    queryFn: () => adminApi.getGameRuns(gameId),
    enabled: !!game,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Ładowanie gry...</span>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="py-12 text-center text-red-600 text-sm">
        Nie znaleziono gry lub błąd ładowania.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/games"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Powrót do gier
      </Link>

      {/* Title + actions */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{game.title}</h2>
            <GameStatusBadge status={game.status} />
          </div>
          {game.description && <p className="text-gray-500 text-sm">{game.description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:flex-shrink-0">
          <Link
            href={`/games/${game.id}/tasks`}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edytor zadań
          </Link>
          <Link
            href={`/games/${game.id}/analytics`}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 size={15} />
            Analityka
          </Link>
          <Link
            href={`/games/${game.id}/monitor`}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors"
          >
            <Activity size={15} />
            Monitoring
          </Link>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <MapPin size={18} />, label: 'Miasto', value: game.city },
          { icon: <ListChecks size={18} />, label: 'Zadania', value: game.taskCount ?? 0 },
          { icon: <Users size={18} />, label: 'Gracze', value: game.playerCount ?? 0 },
          { icon: <Calendar size={18} />, label: 'Utworzono', value: new Date(game.createdAt).toLocaleDateString('pl-PL') },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 shadow-sm"
          >
            <div className="text-[#FF6B35]">{item.icon}</div>
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-lg font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Run Control */}
      {game.status === 'PUBLISHED' && (
        <GameRunControl
          gameId={game.id}
          activeRun={game.activeRun}
          timeLimitMinutes={game.settings?.timeLimitMinutes}
        />
      )}

      {/* Run History */}
      {runs && runs.length > 0 && <GameRunHistory runs={runs} />}

      {/* Flow diagram */}
      {game.tasks && game.tasks.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <header className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Diagram przepływu
            </h3>
            <span className="text-xs text-gray-500">
              {game.flowType ?? 'LINEAR'}
            </span>
          </header>
          <GameFlowDiagram
            tasks={(game.tasks ?? []).map((t) => ({
              id: t.id,
              label: t.title,
              index: t.orderIndex + 1,
              type: t.type,
            }))}
            transitions={(game.transitions ?? []).map((tr) => ({
              fromTaskId: tr.fromTaskId,
              toTaskId: tr.toTaskId,
              label: tr.label,
            }))}
            endings={(game.endings ?? []).map((e) => ({
              id: e.id,
              slug: e.slug,
              title: e.title,
              isDefault: e.isDefault,
              condition: e.condition,
            }))}
            height={420}
          />
        </section>
      )}

      {/* Settings */}
      <GameSettingsEditor gameId={game.id} settings={game.settings ?? {}} />
    </div>
  );
}
