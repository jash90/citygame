'use client';

import type { GameBlueprint } from '@citygame/shared';
import { ArrowRight, Loader2, MapPin } from 'lucide-react';

interface BlueprintOutlineViewProps {
  blueprint: GameBlueprint;
  onBack: () => void;
  onContinue: () => void;
  /**
   * Stage-by-stage flow: false while the outline is still pending. Renders
   * an "outline still loading" placeholder + disables the Dalej button.
   */
  canContinue?: boolean;
}

export function BlueprintOutlineView({
  blueprint,
  onBack,
  onContinue,
  canContinue = true,
}: BlueprintOutlineViewProps) {
  const outlineReady = !!blueprint.title;

  if (!outlineReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Ładuję zarys gry…</p>
        <p className="text-xs text-gray-400 max-w-md text-center">
          AI ustala tytuł, miasto-anchor i listę POI. Pasek u góry pokazuje
          aktualny etap; gdy zarys będzie gotowy, ten widok wypełni się
          automatycznie.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold text-gray-900">{blueprint.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{blueprint.city} · {blueprint.flowType}</p>
      </header>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Opis
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          {blueprint.description}
        </p>
      </section>

      {blueprint.prologue && (
        <section className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
            Prolog
          </h3>
          <p className="text-sm text-amber-900 leading-relaxed">
            {blueprint.prologue}
          </p>
        </section>
      )}

      <section className="grid grid-cols-3 gap-4">
        <Stat label="Zadania" value={blueprint.tasks.length} />
        <Stat label="Połączenia" value={blueprint.transitions.length} />
        <Stat label="Zakończenia" value={blueprint.endings.length} />
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Lokalizacje ({blueprint.tasks.length})
        </h3>
        <ol className="flex flex-col gap-2">
          {blueprint.tasks.map((t) => (
            <li
              key={t.index}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-white text-xs font-semibold">
                {t.index}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {t.title}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin size={12} />
                  {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)} · {t.type}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Zakończenia
        </h3>
        <ul className="flex flex-col gap-2">
          {blueprint.endings.map((e) => (
            <li
              key={e.slug}
              className="rounded-lg border border-gray-200 p-3 flex flex-col gap-1"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {e.title}
                {e.isDefault && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-medium text-gray-600">
                    domyślne
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500">{e.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Wstecz
        </button>
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Dalej: zadania
          <ArrowRight size={16} />
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
