'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { pluralizePl } from '@/shared/lib/pluralize';
import type { Game } from '@citygame/shared';
import { GameStatusBadge } from '@/features/dashboard/components/GameStatusBadge';

interface GamesResponse {
  items: Game[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function GamesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery<GamesResponse>({
    queryKey: ['games', page],
    queryFn: () => api.get(`/api/admin/games?page=${page}&limit=20`),
  });

  const games = data?.items ?? [];

  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [data, page]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gry</h2>
          <p className="text-gray-500 text-sm mt-1">Zarządzaj wszystkimi grami miejskimi</p>
        </div>
        <Link
          href="/games/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nowa gra
        </Link>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span>Ładowanie gier...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-600 text-sm">
            Błąd ładowania gier. Spróbuj ponownie.
          </div>
        ) : !games.length ? (
          <div className="py-16 text-center text-gray-500">
            <p className="text-sm">Brak gier. Utwórz pierwszą.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Nazwa</th>
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Miasto</th>
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Zadania</th>
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Gracze</th>
                  <th className="text-left py-3 px-5 font-medium text-gray-500">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-gray-900">{game.title}</td>
                    <td className="py-3.5 px-5 text-gray-600">{game.city}</td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <GameStatusBadge status={game.status} />
                        {game.activeRun && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            Aktywna
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-gray-600">{game.taskCount ?? 0}</td>
                    <td className="py-3.5 px-5 text-gray-600">{game.playerCount ?? 0}</td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/games/${game.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Eye size={13} />
                          Szczegóły
                        </Link>
                        <Link
                          href={`/games/${game.id}/tasks`}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-[#FF6B35] bg-orange-50 hover:bg-orange-100 transition-colors"
                        >
                          <Edit size={13} />
                          Zadania
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Strona {data.page} z {data.totalPages} ({pluralizePl(data.total, 'gra', 'gry', 'gier')})
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Poprzednia
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Następna
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
