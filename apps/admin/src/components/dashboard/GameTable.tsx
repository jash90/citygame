'use client';

import Link from 'next/link';
import { Eye, Edit, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Game } from '@citygame/shared';
import { GameStatusBadge } from './GameStatusBadge';

export function GameTable() {
  const { data: games, isLoading, error } = useQuery<Game[]>({
    queryKey: ['admin-games', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ items: Game[] }>('/api/admin/games?limit=5');
      return Array.isArray(res) ? res : res?.items ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Ładowanie gier...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-red-600 text-sm">
        Błąd ładowania gier. Spróbuj ponownie.
      </div>
    );
  }

  if (!games?.length) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p className="text-sm">Brak gier. Utwórz pierwszą grę.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Nazwa</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Miasto</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Zadania</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Akcje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {games.map((game) => (
            <tr key={game.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 font-medium text-gray-900">{game.title}</td>
              <td className="py-3 px-4 text-gray-600">{game.city}</td>
              <td className="py-3 px-4">
                <GameStatusBadge status={game.status} />
              </td>
              <td className="py-3 px-4 text-gray-600">
                {game.taskCount ?? 0}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/games/${game.id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <Eye size={14} />
                    Szczegóły
                  </Link>
                  <Link
                    href={`/games/${game.id}/tasks`}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-[#FF6B35] hover:bg-orange-50 transition-colors"
                  >
                    <Edit size={14} />
                    Edytuj
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
