'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2, MapPin } from 'lucide-react';
import { mentorApi } from '@/shared/lib/admin-api';

export default function MentorDashboardPage() {
  const { data: games, isLoading, error } = useQuery({
    queryKey: ['mentor-games'],
    queryFn: () => mentorApi.getMyGames(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 size={24} className="animate-spin mr-2" />
        Ładowanie…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-red-600 text-sm text-center">
        Nie udało się załadować przypisanych gier.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Moje gry</h2>
        <p className="text-sm text-gray-500">
          Gry, w których jesteś przypisany jako mentor — kliknij, aby ocenić
          zgłoszenia oczekujące na recenzję.
        </p>
      </div>

      {games?.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">
          Nie jesteś jeszcze przypisany do żadnej gry. Skontaktuj się z adminem
          jeśli to się powinno zmienić.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {games?.map((game) => (
          <Link
            key={game.id}
            href={`/mentor/games/${game.id}/queue`}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-[#FF6B35] hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {game.title}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={12} /> {game.city}
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-gray-300 group-hover:text-[#FF6B35] transition-colors"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  game.pendingCount > 0
                    ? 'bg-orange-100 text-[#FF6B35]'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {game.pendingCount} do oceny
              </span>
              <span className="text-xs text-gray-400">
                {game.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
