'use client';

import { useState } from 'react';
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';
import {
  useAiConfig,
  useAiModels,
  useSetAiModel,
} from '@/features/settings/hooks/useAdminSettings';
import { AiApiKeyCard } from './AiApiKeyCard';
import { AiPurposeModelsCard } from './AiPurposeModelsCard';
import { AiWebSearchCard } from './AiWebSearchCard';
import { OpenRouterModelPickerModal } from './OpenRouterModelPickerModal';

export function AiModelTab() {
  const { data: config, isLoading: configLoading } = useAiConfig();
  const { isLoading: modelsLoading, error: modelsError } = useAiModels();
  const mutation = useSetAiModel();
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeModel = config?.activeModel ?? '';

  return (
    <div className="flex flex-col gap-5">
      <AiApiKeyCard />
      <AiWebSearchCard />

      {/* Active model banner — clickable to open the picker */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="bg-gradient-to-r from-[#FF6B35]/10 to-orange-50 rounded-xl border border-[#FF6B35]/20 p-5 text-left hover:border-[#FF6B35]/40 transition-colors disabled:opacity-60"
        disabled={configLoading || mutation.isPending}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#FF6B35] text-white">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">
              Aktywny model (globalny domyślny)
            </p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {configLoading ? '…' : activeModel || '— nie ustawiony —'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Kliknij, aby wybrać inny model z listy OpenRouter.
            </p>
          </div>
          {mutation.isPending ? (
            <Loader2 size={18} className="animate-spin text-[#FF6B35]" />
          ) : (
            <ChevronRight size={18} className="text-[#FF6B35]" />
          )}
        </div>
      </button>

      {modelsError && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          Nie udało się pobrać listy modeli — sprawdź klucz API powyżej.
        </div>
      )}

      <AiPurposeModelsCard />

      {mutation.isError && (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {mutation.error?.message ?? 'Nie udało się zapisać modelu.'}
        </div>
      )}

      <OpenRouterModelPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(modelId) => {
          if (modelId) mutation.mutate(modelId);
        }}
        currentValue={activeModel}
        title="Wybierz globalny aktywny model"
        description="Ten model będzie używany wszędzie tam, gdzie nie ustawiono dedykowanego modelu dla danego zadania AI."
      />

      {modelsLoading && !config && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" />
          Ładowanie modeli AI...
        </div>
      )}
    </div>
  );
}
