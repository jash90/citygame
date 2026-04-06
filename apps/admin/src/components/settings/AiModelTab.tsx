'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Search,
  Check,
  Loader2,
  Eye,
  Image,
  Mic,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
  top_provider: { context_length: number; max_completion_tokens: number };
}

interface ModelsResponse {
  models: OpenRouterModel[];
  activeModel: string;
}

interface ConfigResponse {
  activeModel: string;
}

type SortKey = 'name' | 'context' | 'price';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-700',
  openai: 'bg-green-100 text-green-700',
  google: 'bg-blue-100 text-blue-700',
  meta: 'bg-indigo-100 text-indigo-700',
  'meta-llama': 'bg-indigo-100 text-indigo-700',
  mistralai: 'bg-purple-100 text-purple-700',
  deepseek: 'bg-cyan-100 text-cyan-700',
  cohere: 'bg-teal-100 text-teal-700',
  amazon: 'bg-yellow-100 text-yellow-700',
};

function formatPrice(pricePerToken: string): string {
  const p = parseFloat(pricePerToken);
  if (p === 0) return 'Free';
  // Show price per 1M tokens
  const perMillion = p * 1_000_000;
  if (perMillion < 0.01) return '<$0.01/M';
  if (perMillion < 1) return `$${perMillion.toFixed(2)}/M`;
  return `$${perMillion.toFixed(1)}/M`;
}

function formatContext(ctx: number): string {
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
  return String(ctx);
}

function getProvider(modelId: string): string {
  return modelId.split('/')[0] ?? 'unknown';
}

function getCapabilities(model: OpenRouterModel): string[] {
  const caps: string[] = [];
  const inputs = model.architecture?.input_modalities ?? [];
  if (inputs.includes('image')) caps.push('vision');
  if (inputs.includes('audio')) caps.push('audio');
  if (inputs.includes('video')) caps.push('video');
  if (inputs.includes('file')) caps.push('file');
  return caps;
}

export function AiModelTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterVision, setFilterVision] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ModelsResponse>({
    queryKey: ['ai-models'],
    queryFn: () => api.get('/api/admin/ai/models'),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation<ConfigResponse, Error, string>({
    mutationFn: (model: string) =>
      api.patch('/api/admin/ai/config', { model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });

  const models = data?.models ?? [];
  const activeModel = data?.activeModel ?? '';

  // Extract unique providers
  const providers = useMemo(() => {
    const set = new Set(models.map((m) => getProvider(m.id)));
    return Array.from(set).sort();
  }, [models]);

  // Filter & sort
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
        {filtered.map((model) => {
          const isActive = model.id === activeModel;
          const provider = getProvider(model.id);
          const caps = getCapabilities(model);
          const isExpanded = expandedModel === model.id;
          const colorClass =
            PROVIDER_COLORS[provider] ?? 'bg-gray-100 text-gray-600';

          return (
            <div
              key={model.id}
              className={`rounded-xl border transition-all ${
                isActive
                  ? 'border-[#FF6B35] bg-[#FF6B35]/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Select button */}
                <button
                  onClick={() => {
                    if (!isActive) mutation.mutate(model.id);
                  }}
                  disabled={isActive || mutation.isPending}
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-[#FF6B35] text-white'
                      : 'bg-gray-100 text-gray-400 hover:bg-[#FF6B35]/10 hover:text-[#FF6B35]'
                  }`}
                  title={isActive ? 'Aktywny' : 'Wybierz model'}
                >
                  {isActive ? <Check size={16} /> : <Zap size={14} />}
                </button>

                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {model.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${colorClass}`}
                    >
                      {provider}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {model.name}
                  </p>
                </div>

                {/* Capabilities */}
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                  {caps.includes('vision') && (
                    <span
                      title="Vision"
                      className="w-6 h-6 rounded flex items-center justify-center bg-blue-50 text-blue-500"
                    >
                      <Image size={12} />
                    </span>
                  )}
                  {caps.includes('audio') && (
                    <span
                      title="Audio"
                      className="w-6 h-6 rounded flex items-center justify-center bg-purple-50 text-purple-500"
                    >
                      <Mic size={12} />
                    </span>
                  )}
                </div>

                {/* Pricing */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right">
                  <span className="text-xs font-medium text-gray-700">
                    {formatPrice(model.pricing?.prompt ?? '0')}
                  </span>
                  <span className="text-[10px] text-gray-400">prompt</span>
                </div>

                {/* Context */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right w-14">
                  <span className="text-xs font-medium text-gray-700">
                    {formatContext(model.context_length ?? 0)}
                  </span>
                  <span className="text-[10px] text-gray-400">kontekst</span>
                </div>

                {/* Expand */}
                <button
                  onClick={() =>
                    setExpandedModel(isExpanded ? null : model.id)
                  }
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed mb-3">
                    {model.description || 'Brak opisu.'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block">Kontekst</span>
                      <span className="font-medium text-gray-800">
                        {(model.context_length ?? 0).toLocaleString()} tokenów
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Cena prompt</span>
                      <span className="font-medium text-gray-800">
                        {formatPrice(model.pricing?.prompt ?? '0')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">
                        Cena completion
                      </span>
                      <span className="font-medium text-gray-800">
                        {formatPrice(model.pricing?.completion ?? '0')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Modalność</span>
                      <span className="font-medium text-gray-800">
                        {model.architecture?.modality ?? '—'}
                      </span>
                    </div>
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => mutation.mutate(model.id)}
                      disabled={mutation.isPending}
                      className="mt-3 px-4 py-1.5 bg-[#FF6B35] text-white text-xs font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 transition-colors"
                    >
                      {mutation.isPending ? 'Zmieniam...' : 'Użyj tego modelu'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

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
