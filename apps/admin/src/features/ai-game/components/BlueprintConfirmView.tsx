'use client';

import { Loader2, Save } from 'lucide-react';
import type { BlueprintInput, GameBlueprint } from '@citygame/shared';

interface BlueprintConfirmViewProps {
  blueprint: GameBlueprint;
  input: BlueprintInput;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  errorMessage?: string | null;
}

export function BlueprintConfirmView({
  blueprint,
  input,
  onBack,
  onSave,
  isSaving,
  errorMessage,
}: BlueprintConfirmViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-xl font-bold text-gray-900">Podsumowanie</h2>
        <p className="text-sm text-gray-500 mt-1">
          Po zapisaniu gra trafi do statusu DRAFT — opublikuj ją osobno z poziomu
          szczegółów gry.
        </p>
      </header>

      {errorMessage && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 p-4 bg-gray-50">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          {input.flowType} · {input.city} · {input.language}
        </p>
        <h3 className="text-lg font-bold text-gray-900 mt-1">{blueprint.title}</h3>
        <p className="text-sm text-gray-700 mt-2">{blueprint.description}</p>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="Zadania" value={blueprint.tasks.length} />
        <Stat label="Połączenia" value={blueprint.transitions.length} />
        <Stat label="Zakończenia" value={blueprint.endings.length} />
      </section>

      <p className="text-xs text-gray-500 leading-relaxed">
        Lokalizacje, odpowiedzi na zadania tekstowe oraz hasła z łańcucha cipher
        zostaną zahashowane po stronie serwera. Punktacja: ≈ średnio{' '}
        {Math.round(
          blueprint.tasks.reduce((acc, t) => acc + t.maxPoints, 0) /
            Math.max(1, blueprint.tasks.length),
        )}{' '}
        pkt / zadanie.
      </p>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Wstecz
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Zapisz jako wersję roboczą
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
