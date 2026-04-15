'use client';

import { TableCard } from './Cards';

interface AiVerificationStat {
  taskName: string;
  evaluations: number;
  avgScore: number;
  errorRate: number;
}

export function AiVerificationTable({
  stats,
}: {
  stats: AiVerificationStat[];
}) {
  return (
    <TableCard title="Statystyki weryfikacji AI">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Zadanie
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ewaluacje
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Śr. wynik
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Błędy
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  Brak danych weryfikacji
                </td>
              </tr>
            ) : (
              stats.map((stat, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {stat.taskName}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {stat.evaluations}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        stat.avgScore >= 80
                          ? 'text-green-600'
                          : stat.avgScore >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}
                    >
                      {stat.avgScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {stat.errorRate > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                        {stat.errorRate}%
                      </span>
                    ) : (
                      <span className="text-green-500 font-medium">0%</span>
                    )}
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
