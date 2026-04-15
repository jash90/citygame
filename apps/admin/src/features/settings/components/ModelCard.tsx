'use client';

import {
  Check,
  Image,
  Mic,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import type { OpenRouterModel } from '@/features/settings/hooks/useAdminSettings';

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

export function formatPrice(pricePerToken: string): string {
  const p = parseFloat(pricePerToken);
  if (p === 0) return 'Free';
  const perMillion = p * 1_000_000;
  if (perMillion < 0.01) return '<$0.01/M';
  if (perMillion < 1) return `$${perMillion.toFixed(2)}/M`;
  return `$${perMillion.toFixed(1)}/M`;
}

export function formatContext(ctx: number): string {
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1000) return `${Math.round(ctx / 1000)}K`;
  return String(ctx);
}

export function getProvider(modelId: string): string {
  return modelId.split('/')[0] ?? 'unknown';
}

export function getCapabilities(model: OpenRouterModel): string[] {
  const caps: string[] = [];
  const inputs = model.architecture?.input_modalities ?? [];
  if (inputs.includes('image')) caps.push('vision');
  if (inputs.includes('audio')) caps.push('audio');
  if (inputs.includes('video')) caps.push('video');
  if (inputs.includes('file')) caps.push('file');
  return caps;
}

interface ModelCardProps {
  model: OpenRouterModel;
  isActive: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onSelect: (modelId: string) => void;
  onToggleExpand: (modelId: string) => void;
}

export function ModelCard({
  model,
  isActive,
  isExpanded,
  isPending,
  onSelect,
  onToggleExpand,
}: ModelCardProps) {
  const provider = getProvider(model.id);
  const caps = getCapabilities(model);
  const colorClass = PROVIDER_COLORS[provider] ?? 'bg-gray-100 text-gray-600';

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? 'border-[#FF6B35] bg-[#FF6B35]/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => {
            if (!isActive) onSelect(model.id);
          }}
          disabled={isActive || isPending}
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isActive
              ? 'bg-[#FF6B35] text-white'
              : 'bg-gray-100 text-gray-400 hover:bg-[#FF6B35]/10 hover:text-[#FF6B35]'
          }`}
          title={isActive ? 'Aktywny' : 'Wybierz model'}
        >
          {isActive ? <Check size={16} /> : <Zap size={14} />}
        </button>

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

        <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right">
          <span className="text-xs font-medium text-gray-700">
            {formatPrice(model.pricing?.prompt ?? '0')}
          </span>
          <span className="text-[10px] text-gray-400">prompt</span>
        </div>

        <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right w-14">
          <span className="text-xs font-medium text-gray-700">
            {formatContext(model.context_length ?? 0)}
          </span>
          <span className="text-[10px] text-gray-400">kontekst</span>
        </div>

        <button
          onClick={() => onToggleExpand(model.id)}
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
              <span className="text-gray-400 block">Cena completion</span>
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
              onClick={() => onSelect(model.id)}
              disabled={isPending}
              className="mt-3 px-4 py-1.5 bg-[#FF6B35] text-white text-xs font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Zmieniam...' : 'Użyj tego modelu'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
