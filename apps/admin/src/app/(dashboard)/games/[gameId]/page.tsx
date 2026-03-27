'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Activity, BarChart3, Loader2, Calendar, MapPin, Users, ListChecks } from 'lucide-react';
import { api } from '@/lib/api';
import type { Game } from '@citygame/shared';
import { GameStatusBadge } from '@/components/dashboard/GameStatusBadge';
import { GameSettingsEditor } from '@/components/game/GameSettingsEditor';

// The admin endpoint returns _count.tasks instead of a top-level taskCount field.
interface GameDetailResponse extends Game {
  _count?: { tasks?: number; sessions?: number };
}

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>();

  const { data: game, isLoading, error } = useQuery<GameDetailResponse>({
    queryKey: ['games', gameId],
    queryFn: () => api.get<GameDetailResponse>(`/api/admin/games/${gameId}`),
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{game.title}</h2>
            <GameStatusBadge status={game.status} />
          </div>
          <p className="text-gray-500 text-sm">{game.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/games/${game.id}/tasks`}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} />
            Edytor zadań
          </Link>
          <Link
            href={`/games/${game.id}/analytics`}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <BarChart3 size={15} />
            Analityka
          </Link>
          <Link
            href={`/games/${game.id}/monitor`}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors"
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
          {
            icon: <ListChecks size={18} />,
            label: 'Zadania',
            value: game.taskCount ?? game._count?.tasks ?? 0,
          },
          {
            icon: <Users size={18} />,
            label: 'Gracze',
            value: game.playerCount ?? game._count?.sessions ?? 0,
          },
          {
            icon: <Calendar size={18} />,
            label: 'Utworzono',
            value: new Date(game.createdAt).toLocaleDateString('pl-PL'),
          },
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

      {/* Settings */}
      <GameSettingsEditor gameId={game.id} settings={game.settings ?? {}} />
    </div>
  );
}
