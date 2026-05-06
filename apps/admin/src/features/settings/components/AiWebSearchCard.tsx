'use client';

import { Globe, Loader2 } from 'lucide-react';
import {
  useAiConfig,
  useSetAiUseWebSearch,
} from '@/features/settings/hooks/useAdminSettings';

export function AiWebSearchCard() {
  const { data: config, isLoading } = useAiConfig();
  const setUseWebSearch = useSetAiUseWebSearch();

  const enabled = !!config?.useWebSearch;

  const toggle = () => {
    if (setUseWebSearch.isPending) return;
    setUseWebSearch.mutate(!enabled);
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <header className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-600 text-white shrink-0">
          <Globe size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900">
            Wyszukiwanie w sieci
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Przełącza generator zadań/gier na wariant <span className="font-mono">:online</span> w
            OpenRouter — model uruchamia wtyczkę wyszukiwania, dzięki czemu może
            opierać legendy, POI i współrzędne na rzeczywistych źródłach.
            Wolniejsze i droższe (więcej tokenów wejściowych za pobrane wycinki).
          </p>
        </div>
      </header>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-gray-900">
            Globalne wyszukiwanie w sieci dla AI
          </span>
          <span className="text-xs text-gray-500">
            Stan: {' '}
            <span
              className={`font-semibold ${
                enabled ? 'text-emerald-600' : 'text-gray-500'
              }`}
            >
              {enabled ? 'Włączone' : 'Wyłączone'}
            </span>
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isLoading || setUseWebSearch.isPending}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/40 disabled:opacity-60 ${
            enabled ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          {setUseWebSearch.isPending ? (
            <Loader2
              size={14}
              className="absolute left-1/2 -translate-x-1/2 text-white animate-spin"
            />
          ) : (
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          )}
        </button>
      </label>

      {setUseWebSearch.isError && (
        <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {setUseWebSearch.error?.message ?? 'Nie udało się zapisać zmiany.'}
        </p>
      )}
    </section>
  );
}
