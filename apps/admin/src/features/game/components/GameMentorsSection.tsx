'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserCheck, X } from 'lucide-react';
import { adminApi } from '@/shared/lib/admin-api';

interface GameMentorsSectionProps {
  gameId: string;
}

export function GameMentorsSection({ gameId }: GameMentorsSectionProps) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const mentorsQuery = useQuery({
    queryKey: ['admin-game', gameId, 'mentors'],
    queryFn: () => adminApi.getGameMentors(gameId),
    staleTime: 30_000,
  });

  const availableQuery = useQuery({
    queryKey: ['admin-users', { role: 'MENTOR' }],
    queryFn: () => adminApi.getUsers({ role: 'MENTOR', limit: 100 }),
    enabled: pickerOpen,
    staleTime: 60_000,
  });

  const assignMutation = useMutation({
    mutationFn: (mentorId: string) => adminApi.assignMentor(gameId, mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-game', gameId, 'mentors'] });
      setPickerOpen(false);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (mentorId: string) => adminApi.unassignMentor(gameId, mentorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-game', gameId, 'mentors'] });
    },
  });

  const assignedIds = new Set((mentorsQuery.data ?? []).map((m) => m.mentor.id));
  const unassignedAvailable =
    availableQuery.data?.items.filter((u) => !assignedIds.has(u.id)) ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UserCheck size={18} className="text-gray-400" />
          Mentorzy
        </h3>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Plus size={14} />
          Dodaj mentora
        </button>
      </div>

      {mentorsQuery.isLoading && (
        <p className="text-sm text-gray-400">Ładowanie…</p>
      )}

      {mentorsQuery.data?.length === 0 && !mentorsQuery.isLoading && (
        <p className="text-sm text-gray-500 italic">
          Brak przypisanych mentorów. Bez mentora zadania typu PRACTICAL nie zostaną ocenione.
        </p>
      )}

      <div className="divide-y divide-gray-100">
        {mentorsQuery.data?.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6B35] flex items-center justify-center text-sm font-semibold">
                {entry.mentor.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {entry.mentor.displayName}
                </p>
                <p className="text-xs text-gray-500">{entry.mentor.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => unassignMutation.mutate(entry.mentor.id)}
              disabled={unassignMutation.isPending}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              aria-label="Usuń mentora"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">
                Wybierz mentora
              </h4>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {availableQuery.isLoading && (
                <p className="text-sm text-gray-400 p-4">Ładowanie…</p>
              )}
              {unassignedAvailable.length === 0 && !availableQuery.isLoading && (
                <p className="text-sm text-gray-500 p-4">
                  Brak dostępnych mentorów. Najpierw nadaj rolę MENTOR komuś w
                  ustawieniach użytkowników.
                </p>
              )}
              {unassignedAvailable.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => assignMutation.mutate(user.id)}
                  disabled={assignMutation.isPending}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6B35] flex items-center justify-center text-sm font-semibold">
                    {user.displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
