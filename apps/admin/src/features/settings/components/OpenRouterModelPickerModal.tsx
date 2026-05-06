'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Eye, Loader2, Search, X } from 'lucide-react';
import { useAiModels } from '@/features/settings/hooks/useAdminSettings';
import {
  formatContext,
  formatPrice,
  getCapabilities,
  getProvider,
} from './ModelCard';

interface OpenRouterModelPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (modelId: string) => void;
  /** Currently selected id (highlights its row). */
  currentValue?: string | null;
  /** When true, an extra "Domyślny" row is shown at the top that returns ''. */
  allowDefault?: boolean;
  /** Heading shown in the modal header. */
  title?: string;
  /** Help text under the heading. */
  description?: string;
  /** id of the model currently used as fallback when `currentValue` is empty
   *  (rendered next to the "Domyślny" row so admins know what they fall back to). */
  fallbackHint?: string;
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

export function OpenRouterModelPickerModal({
  open,
  onClose,
  onSelect,
  currentValue,
  allowDefault = false,
  title = 'Wybierz model AI',
  description,
  fallbackHint,
}: OpenRouterModelPickerModalProps) {
  const { data, isLoading, error } = useAiModels();
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterVision, setFilterVision] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('name');

  // Reset filters whenever the modal re-opens.
  useEffect(() => {
    if (open) {
      setSearch('');
      setFilterProvider('all');
      setFilterVision(false);
      setSortBy('name');
    }
  }, [open]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const models = data?.models ?? [];

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
    return [...result].sort((a, b) => {
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
  }, [models, search, filterProvider, filterVision, sortBy]);

  if (!open) return null;

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {description && (
              <p className="text-xs text-gray-500 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              autoFocus
              placeholder="Szukaj po id, nazwie, opisie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
            />
          </div>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          >
            <option value="all">Wszyscy dostawcy ({providers.length})</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFilterVision((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border transition-colors ${
              filterVision
                ? 'bg-[#FF6B35] text-white border-[#FF6B35]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Eye size={13} />
            Vision
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          >
            <option value="name">Sortuj: nazwa</option>
            <option value="context">Sortuj: kontekst ↓</option>
            <option value="price">Sortuj: cena ↑</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin mr-2" />
              Ładowanie modeli OpenRouter…
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-600">
              Nie udało się pobrać listy modeli — sprawdź klucz API.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {allowDefault && (
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    !currentValue
                      ? 'border-[#FF6B35] bg-[#FF6B35]/5'
                      : 'border-dashed border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500">
                    {!currentValue ? <Check size={14} /> : null}
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-900">
                      Domyślny model
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      Używa globalnego modelu
                      {fallbackHint ? (
                        <>
                          {' '}
                          (
                          <span className="font-mono">{fallbackHint}</span>)
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
              )}
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Bot size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">
                    Nie znaleziono modeli pasujących do filtrów.
                  </p>
                </div>
              ) : (
                filtered.map((m) => {
                  const provider = getProvider(m.id);
                  const caps = getCapabilities(m);
                  const isActive = m.id === currentValue;
                  const colorClass =
                    PROVIDER_COLORS[provider] ?? 'bg-gray-100 text-gray-600';
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleSelect(m.id)}
                      className={`flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-[#FF6B35] bg-[#FF6B35]/5'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                          isActive
                            ? 'bg-[#FF6B35] text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isActive ? <Check size={14} /> : null}
                      </span>
                      <span className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${colorClass}`}
                          >
                            {provider}
                          </span>
                          <span className="text-sm font-mono text-gray-900 truncate">
                            {m.id}
                          </span>
                          {caps.includes('vision') && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px]">
                              <Eye size={10} /> vision
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500 line-clamp-1">
                          {m.name}
                        </span>
                      </span>
                      <span className="flex flex-col items-end text-right text-[11px] gap-0.5 flex-shrink-0">
                        <span className="text-gray-700 font-mono">
                          {formatContext(m.context_length ?? 0)}
                        </span>
                        <span className="text-gray-500 font-mono">
                          {formatPrice(m.pricing?.prompt ?? '0')}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtered.length} z {models.length} modeli
          </span>
          <span>Esc lub kliknięcie tła zamyka okno</span>
        </div>
      </div>
    </div>
  );
}
