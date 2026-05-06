'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import {
  useAiConfig,
  useClearAiApiKey,
  useSetAiApiKey,
} from '@/features/settings/hooks/useAdminSettings';

export function AiApiKeyCard() {
  const { data: config, isLoading } = useAiConfig();
  const setKey = useSetAiApiKey();
  const clearKey = useClearAiApiKey();

  const [draft, setDraft] = useState('');
  const [revealInput, setRevealInput] = useState(false);

  const isConfigured = !!config?.apiKeyConfigured;
  const masked = config?.apiKeyMasked ?? null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setKey.mutate(draft.trim(), {
      onSuccess: () => setDraft(''),
    });
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white shrink-0">
            <Key size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">
              Klucz OpenRouter
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Klucz API używany przez generator zadań i gier. Nadpisuje wartość
              z pliku <span className="font-mono">.env</span> backendu i jest
              zapisany w bazie danych.
            </p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 size={16} className="animate-spin text-gray-400" />
        ) : isConfigured ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={12} />
            Aktywny
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
            <AlertTriangle size={12} />
            Brak klucza
          </span>
        )}
      </header>

      {/* Current key display */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">
            Aktualny klucz
          </p>
          <p className="text-sm font-mono text-gray-800 truncate">
            {masked ?? '— nie ustawiony —'}
          </p>
        </div>
        {isConfigured && (
          <button
            type="button"
            onClick={() => clearKey.mutate()}
            disabled={clearKey.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-60"
          >
            {clearKey.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Usuń
          </button>
        )}
      </div>

      {/* Submit form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label
          htmlFor="ai-api-key"
          className="text-xs font-medium text-gray-700"
        >
          Nowy klucz API
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="ai-api-key"
              type={revealInput ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full pl-3 pr-10 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
            />
            <button
              type="button"
              onClick={() => setRevealInput((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              aria-label={revealInput ? 'Ukryj klucz' : 'Pokaż klucz'}
            >
              {revealInput ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={setKey.isPending || draft.trim().length < 10}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] disabled:opacity-60"
          >
            {setKey.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Zapisz
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          Klucz znajdziesz na{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-[#FF6B35] underline"
          >
            openrouter.ai/keys
          </a>
          . Po zapisie generator zostanie natychmiast przepiętny na nowy klucz.
        </p>
      </form>

      {(setKey.isError || clearKey.isError) && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {(setKey.error ?? clearKey.error)?.message ??
            'Nie udało się zapisać zmian.'}
        </div>
      )}
    </section>
  );
}
