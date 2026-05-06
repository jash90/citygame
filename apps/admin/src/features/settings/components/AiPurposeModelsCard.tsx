'use client';

import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import {
  AI_PURPOSES,
  useAiConfig,
  useAiModels,
  useSetAiModelByPurpose,
  type AiPurpose,
} from '@/features/settings/hooks/useAdminSettings';

const PURPOSE_LABELS: Record<AiPurpose, { label: string; hint: string }> = {
  blueprint: {
    label: 'Generowanie gry (blueprint)',
    hint:
      'Outline + per-task + transitions + endings podczas generowania nowej gry przez kreator AI.',
  },
  photoAi: {
    label: 'Weryfikacja zdjęć (PHOTO_AI)',
    hint:
      'Ocena zdjęć przesyłanych przez graczy w zadaniach typu "Zdjęcie AI". Wymaga modelu z obsługą wizji.',
  },
  textAi: {
    label: 'Weryfikacja tekstu (TEXT_AI)',
    hint:
      'Ocena otwartych odpowiedzi tekstowych w zadaniach typu "Tekst AI".',
  },
  audioAi: {
    label: 'Weryfikacja audio (AUDIO_AI)',
    hint:
      'Ocena nagrań audio (transkrybowanych przez klienta) w zadaniach typu "Audio AI".',
  },
  editorHelpers: {
    label: 'Pomoc edytora (opisy / podpowiedzi / prompty)',
    hint:
      'Przyciski "Generuj z AI" w edytorze zadań — opisy, podpowiedzi, prompty weryfikacyjne.',
  },
};

export function AiPurposeModelsCard() {
  const { data: config, isLoading: configLoading } = useAiConfig();
  const { data: modelsData, isLoading: modelsLoading } = useAiModels();
  const setModel = useSetAiModelByPurpose();
  const [pending, setPending] = useState<AiPurpose | null>(null);

  const models = modelsData?.models ?? [];
  const fallbackModel = config?.activeModel ?? '';
  const overrides = config?.modelsByPurpose ?? {};

  const handleChange = (purpose: AiPurpose, model: string) => {
    setPending(purpose);
    setModel.mutate(
      { purpose, model },
      { onSettled: () => setPending(null) },
    );
  };

  const loading = configLoading || modelsLoading;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600 text-white shrink-0">
          <Layers size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900">
            Modele dla poszczególnych zadań AI
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Każde zadanie AI może używać innego modelu. Wybierz „Domyślny", aby
            korzystać z globalnego modelu z karty wyżej (
            <span className="font-mono">{fallbackModel || '—'}</span>).
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin mr-2" />
          Ładowanie modeli…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {AI_PURPOSES.map((purpose) => {
            const meta = PURPOSE_LABELS[purpose];
            const current = overrides[purpose] ?? '';
            const isPending = pending === purpose;
            return (
              <div
                key={purpose}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-500">{meta.hint}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={current}
                    disabled={isPending}
                    onChange={(e) => handleChange(purpose, e.target.value)}
                    className="px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] min-w-[260px] disabled:opacity-60"
                  >
                    <option value="">
                      Domyślny ({fallbackModel || '—'})
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                  {isPending && (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {setModel.isError && (
        <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {setModel.error?.message ?? 'Nie udało się zapisać zmiany.'}
        </p>
      )}
    </section>
  );
}
