'use client';

import { TableCard } from './Cards';

interface TopPlayer {
  rank: number;
  name: string;
  score: number;
  tasksCompleted: number;
  timeMinutes: number;
  lastActive: string;
}

export function TopPlayersTable({ players }: { players: TopPlayer[] }) {
  return (
    <TableCard title="Najlepsi gracze">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Gracz
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Wynik
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Zadania
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Czas
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Aktywność
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {players.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  Brak danych graczy
                </td>
              </tr>
            ) : (
              players.map((player) => (
                <tr
                  key={player.rank}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        player.rank === 1
                          ? 'bg-amber-100 text-amber-600'
                          : player.rank === 2
                            ? 'bg-gray-100 text-gray-600'
                            : player.rank === 3
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {player.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {player.name}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#FF6B35]">
                    {player.score}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {player.tasksCompleted}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {player.timeMinutes > 0
                      ? `${player.timeMinutes} min`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {player.lastActive}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}
