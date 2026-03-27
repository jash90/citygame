'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, ShieldCheck, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { parseJwtPayload } from '@/lib/jwt';
import { UserRole } from '@citygame/shared';
import type { UserListItem } from '@citygame/shared';

interface UsersResponse {
  items: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const roleBadge: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'Admin', cls: 'bg-purple-100 text-purple-700' },
  PLAYER: { label: 'Gracz', cls: 'bg-blue-100 text-blue-700' },
};

export function UserManagementTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setCurrentUserId(null); return; }
    setCurrentUserId((parseJwtPayload(token)?.sub as string) ?? null);
  }, []);

  // Debounce search input — 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset confirmation state when filters change
  useEffect(() => {
    setConfirmingId(null);
  }, [debouncedSearch, roleFilter, page]);

  // Auto-reset confirmation after 5 seconds
  useEffect(() => {
    if (!confirmingId) return;
    const timer = setTimeout(() => setConfirmingId(null), 5000);
    return () => clearTimeout(timer);
  }, [confirmingId]);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (debouncedSearch) {
    // Strip SQL LIKE wildcards to prevent unexpected matching
    const sanitized = debouncedSearch.replace(/[%_]/g, '');
    if (sanitized) params.set('search', sanitized);
  }
  if (roleFilter) params.set('role', roleFilter);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin-users', page, debouncedSearch, roleFilter],
    queryFn: () => api.get(`/api/admin/users?${params.toString()}`),
  });

  // Auto-correct page if current page is empty (e.g. users deleted by another admin)
  useEffect(() => {
    if (data && data.items.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [data, page]);

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.patch(`/api/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmingId(null);
    },
  });

  const handleRoleToggle = (user: UserListItem) => {
    if (user.id === currentUserId) return;

    const newRole = user.role === UserRole.ADMIN ? UserRole.PLAYER : UserRole.ADMIN;
    if (confirmingId === user.id) {
      roleMutation.mutate({ userId: user.id, role: newRole });
    } else {
      setConfirmingId(user.id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Szukaj po email lub nazwie..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
        >
          <option value="">Wszystkie role</option>
          <option value="ADMIN">Admin</option>
          <option value="PLAYER">Gracz</option>
        </select>
      </div>

      {/* Error */}
      {roleMutation.error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {roleMutation.error instanceof Error ? roleMutation.error.message : 'Błąd zmiany roli'}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            Ładowanie...
          </div>
        ) : !data?.items.length ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Brak użytkowników
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Użytkownik</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rola</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rejestracja</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((user) => {
                const badge = roleBadge[user.role] ?? roleBadge.PLAYER;
                const isConfirming = confirmingId === user.id;
                const newRole = user.role === UserRole.ADMIN ? UserRole.PLAYER : UserRole.ADMIN;

                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 relative overflow-hidden">
                          <UserIcon size={14} />
                          {user.avatarUrl && /^https?:\/\//.test(user.avatarUrl) && (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="absolute inset-0 w-8 h-8 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <span className="font-medium text-gray-800">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {user.role === 'ADMIN' && <ShieldCheck size={11} />}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.id === currentUserId ? (
                        <span className="text-xs text-gray-400 italic">Ty</span>
                      ) : (
                        <button
                          onClick={() => handleRoleToggle(user)}
                          disabled={roleMutation.isPending && roleMutation.variables?.userId === user.id}
                          aria-label={`Zmień rolę użytkownika ${user.displayName} na ${newRole === 'ADMIN' ? 'Admin' : 'Gracz'}`}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                            isConfirming
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                          } disabled:opacity-50`}
                        >
                          {roleMutation.isPending && roleMutation.variables?.userId === user.id ? (
                            <Loader2 size={12} className="animate-spin inline" />
                          ) : isConfirming ? (
                            `Potwierdź → ${newRole === 'ADMIN' ? 'Admin' : 'Gracz'}`
                          ) : (
                            `Zmień na ${newRole === 'ADMIN' ? 'Admin' : 'Gracz'}`
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Strona {data.page} z {data.totalPages} ({data.total} użytkowników)
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
