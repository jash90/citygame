'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useAiConfig,
  useClearOpenaiApiKey,
  useSetAiProvider,
  useSetOpenaiApiKey,
  type AiProvider,
} from '@/features/settings/hooks/useAdminSettings';

/**
 * Provider toggle + OpenAI key card. Two providers are supported:
 *
 * - OpenRouter: cloud aggregator with `:online` web-search and Anthropic /
 *   OpenAI / etc. models behind a single key. Configured via the existing
 *   `AiApiKeyCard` component (which sits below this one in the tab).
 * - OpenAI: direct api.openai.com endpoint with first-class structured
 *   outputs (`response_format: json_schema` enforced wire-side). Requires
 *   an `sk-...` key from platform.openai.com/api-keys; the URL is fixed.
 */
export function AiProviderCard() {
  const { data, isLoading } = useAiConfig();
  const setProvider = useSetAiProvider();
  const setOpenaiKey = useSetOpenaiApiKey();
  const clearOpenaiKey = useClearOpenaiApiKey();

  const provider = data?.provider ?? 'openrouter';
  const openaiKeyConfigured = data?.openaiApiKeyConfigured ?? false;
  const openaiKeyMasked = data?.openaiApiKeyMasked ?? null;

  const [draftKey, setDraftKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);

  const handleProviderChange = (next: AiProvider) => {
    if (next === provider) return;
    setProvider.mutate(next);
  };

  const handleKeySave = () => {
    const trimmed = draftKey.trim();
    if (!trimmed) return;
    setOpenaiKey.mutate(trimmed, {
      onSuccess: () => {
        setDraftKey('');
        setKeyVisible(false);
      },
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Dostawca AI</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          OpenRouter (chmura, agregator z opcją web-search) lub OpenAI
          (api.openai.com — natywne structured outputs, bez `:online`).
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <ProviderRadio
          checked={provider === 'openrouter'}
          disabled={setProvider.isPending || isLoading}
          onChange={() => handleProviderChange('openrouter')}
          icon={<Cloud size={16} />}
          label="OpenRouter"
          hint="Cloud — Anthropic / OpenAI / inni przez jednolite API."
        />
        <ProviderRadio
          checked={provider === 'openai'}
          disabled={setProvider.isPending || isLoading}
          onChange={() => handleProviderChange('openai')}
          icon={<Sparkles size={16} />}
          label="OpenAI"
          hint="api.openai.com — strict json_schema, bez `:online`."
        />
      </div>

      {provider === 'openai' && (
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">
              Klucz API OpenAI
              <span className="ml-2 text-[10px] uppercase font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                Wymagany
              </span>
            </label>
            {openaiKeyConfigured && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <CheckCircle2 size={12} />
                Ustawiony · {openaiKeyMasked}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder={
                  openaiKeyConfigured
                    ? '(zostaw pusty, aby zachować obecny klucz)'
                    : 'sk-proj-...'
                }
                className="w-full pl-3 pr-9 py-2 text-sm font-mono border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
              />
              <button
                type="button"
                onClick={() => setKeyVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label={keyVisible ? 'Ukryj klucz' : 'Pokaż klucz'}
              >
                {keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleKeySave}
              disabled={!draftKey.trim() || setOpenaiKey.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#FF6B35] text-white hover:bg-[#e55a26] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setOpenaiKey.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Zapisz klucz
            </button>
            {openaiKeyConfigured && (
              <button
                type="button"
                onClick={() => clearOpenaiKey.mutate()}
                disabled={clearOpenaiKey.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                title="Usuń klucz OpenAI"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Wygeneruj klucz na{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-gray-700"
            >
              platform.openai.com/api-keys
            </a>
            . Endpoint to api.openai.com/v1; modele wyciągamy z `/v1/models`.
          </p>
          {!openaiKeyConfigured && (
            <p className="text-[11px] text-amber-700">
              Bez klucza OpenAI zwróci 401 na każde zapytanie.
            </p>
          )}
          {setOpenaiKey.isError && (
            <p className="text-xs text-red-600">
              {setOpenaiKey.error?.message ?? 'Nie udało się zapisać klucza.'}
            </p>
          )}
        </div>
      )}

      {setProvider.isError && (
        <p className="text-xs text-red-600">
          {setProvider.error?.message ?? 'Nie udało się zmienić dostawcy.'}
        </p>
      )}
    </div>
  );
}

interface ProviderRadioProps {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}

function ProviderRadio({
  checked,
  disabled,
  onChange,
  icon,
  label,
  hint,
}: ProviderRadioProps) {
  return (
    <label
      className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? 'border-[#FF6B35] bg-orange-50'
          : 'border-gray-200 hover:border-gray-300'
      } ${disabled ? 'opacity-60 cursor-wait' : ''}`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 accent-[#FF6B35]"
      />
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          {icon}
          {label}
        </span>
        <span className="text-[11px] text-gray-500">{hint}</span>
      </span>
    </label>
  );
}
