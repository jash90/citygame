'use client';

import { useState, useMemo } from 'react';
import { Bot, Search, Loader2, Sparkles, Eye } from 'lucide-react';
import { useAiModels, useSetAiModel } from '@/hooks/useAdminApi';
import { ModelCard, getProvider } from './ModelCard';

type SortKey = 'name' | 'context' | 'price';

export function AiModelTab() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterVision, setFilterVision] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const { data, isLoading, error } = useAiModels();
  const mutation = useSetAiModel();

  const models = data?.models ?? [];
  const activeModel = data?.activeModel ?? '';

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => getProvider(m.id)));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    let result = models;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q),
      );
    }

    if (filterProvider !== 'all') {
      result = result.filter((m) => getProvider(m.id) === filterProvider);
    }

    if (filterVision) {
      result = result.filter((m) =>
        m.architecture?.input_modalities?.includes('image'),
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.id.localeCompare(b.id);
      if (sortBy === 'context')
        return (b.context_length ?? 0) - (a.context_length ?? 0);
      if (sortBy === 'price') {
        return (
          parseFloat(a.pricing?.prompt ?? '999') -
          parseFloat(b.pricing?.prompt ?? '999')
        );
      }
      return 0;
    });

    return result;
  }, [models, search, filterProvider, filterVision, sortBy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Ładowanie modeli AI...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-red-600">
        Nie udało się pobrać listy modeli.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Active model banner */}
      <div className="bg-gradient-to-r from-[#FF6B35]/10 to-orange-50 rounded-xl border border-[#FF6B35]/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#FF6B35] text-white">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Aktywny model</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {activeModel}
            </p>
          </div>
          {mutation.isPending && (
            <Loader2 size={16} className="animate-spin text-[#FF6B35]" />
          )}
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Szukaj modelu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
        </div>

        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] bg-white"
        >
          <option value="all">Wszyscy dostawcy ({providers.length})</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={() => setFilterVision((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
            filterVision
              ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Eye size={14} />
          Vision
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] bg-white"
        >
          <option value="name">Nazwa</option>
          <option value="context">Kontekst ↓</option>
          <option value="price">Cena ↑</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        {filtered.length} z {models.length} modeli
      </p>

      {/* Model list */}
      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isActive={model.id === activeModel}
            isExpanded={expandedModel === model.id}
            isPending={mutation.isPending}
            onSelect={(id) => mutation.mutate(id)}
            onToggleExpand={(id) =>
              setExpandedModel(expandedModel === id ? null : id)
            }
          />
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Bot size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              Nie znaleziono modeli pasujących do filtrów.
            </p>
          </div>
        )}
      </div>

      {/* Mutation error */}
      {mutation.isError && (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {mutation.error.message}
        </div>
      )}
    </div>
  );
}
