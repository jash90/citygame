'use client';

import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import type { BlueprintInput, GameBlueprint } from '@citygame/shared';
import { GameFlowDiagram } from './GameFlowDiagram';
import { useRefineBlueprint } from '../hooks/useAiGameBlueprint';

interface BlueprintFlowStepProps {
  blueprint: GameBlueprint;
  input: BlueprintInput;
  onChange: (next: GameBlueprint) => void;
  onBack: () => void;
  onContinue: () => void;
  /** Stage-by-stage flow: false until transitions+endings have landed. */
  canContinue?: boolean;
}

export function BlueprintFlowStep({
  blueprint,
  input,
  onChange,
  onBack,
  onContinue,
  canContinue = true,
}: BlueprintFlowStepProps) {
  const refine = useRefineBlueprint();
  const tasksReady = blueprint.tasks.length > 0;
  const transitionsReady = blueprint.transitions.length > 0;
  const endingsReady = blueprint.endings.length > 0;
  const ready = tasksReady && transitionsReady && endingsReady;

  const tasks = blueprint.tasks.map((t) => ({
    id: `task-${t.index}`,
    label: t.title,
    index: t.index,
    type: t.type,
  }));

  const transitions = blueprint.transitions.map((tr) => ({
    fromTaskId: tr.fromTaskIndex !== null ? `task-${tr.fromTaskIndex}` : null,
    toTaskId: `task-${tr.toTaskIndex}`,
    label: tr.label,
  }));

  const endings = blueprint.endings.map((e) => ({
    id: `ending-${e.slug}`,
    slug: e.slug,
    title: e.title,
    isDefault: e.isDefault,
    condition: mapCondition(e.condition, blueprint),
  }));

  const handleRegenerate = () => {
    refine.mutate(
      { stage: 'endings', blueprint, input },
      { onSuccess: (next) => onChange(next) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Diagram przepływu</h2>
          <p className="text-sm text-gray-500 mt-1">
            Pomarańczowe strzałki — przejścia między zadaniami. Zielone
            przerywane — warunki zakończeń.
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={refine.isPending || !ready}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {refine.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Wygeneruj zakończenia ponownie
        </button>
      </header>

      {ready ? (
        <GameFlowDiagram tasks={tasks} transitions={transitions} endings={endings} />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 flex flex-col items-center justify-center gap-2 text-sm text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          <p>Czekam na zadania, połączenia i zakończenia…</p>
          <p className="text-xs text-gray-400 max-w-md text-center">
            Diagram pojawi się, gdy AI zakończy etapy zadań, połączeń i
            końcówek. Pasek u góry pokazuje, co dzieje się aktualnie.
          </p>
        </div>
      )}

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Zakończenia
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {blueprint.endings.map((e) => (
            <li
              key={e.slug}
              className={`rounded-lg border p-3 ${
                e.isDefault
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-sky-200 bg-sky-50'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">
                {e.title}{' '}
                {e.isDefault && (
                  <span className="text-[10px] uppercase font-medium text-emerald-700">
                    domyślne
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-600 mt-1">{e.description}</p>
              <p className="text-[10px] text-gray-500 mt-2 font-mono">
                {describeCondition(e.condition)}
              </p>
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
          disabled={refine.isPending || !canContinue}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Dalej: zapis
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function mapCondition(
  condition: GameBlueprint['endings'][number]['condition'],
  blueprint: GameBlueprint,
):
  | { type: 'ALL_OF'; taskIds: string[] }
  | { type: 'ANY_OF'; taskIds: string[] }
  | { type: 'SCORE_GTE'; minScore: number }
  | { type: 'ITEM_COLLECTED'; slug: string }
  | { type: 'TIMEOUT' }
  | { type: 'DEFAULT' } {
  if (condition.type === 'ALL_OF' || condition.type === 'ANY_OF') {
    return {
      type: condition.type,
      taskIds: condition.taskIndices
        .filter((i) => blueprint.tasks.some((t) => t.index === i))
        .map((i) => `task-${i}`),
    };
  }
  return condition;
}

function describeCondition(c: GameBlueprint['endings'][number]['condition']): string {
  switch (c.type) {
    case 'ALL_OF':
      return `ALL_OF [${c.taskIndices.join(', ')}]`;
    case 'ANY_OF':
      return `ANY_OF [${c.taskIndices.join(', ')}]`;
    case 'SCORE_GTE':
      return `SCORE_GTE ${c.minScore}`;
    case 'ITEM_COLLECTED':
      return `ITEM_COLLECTED ${c.slug}`;
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'DEFAULT':
      return 'DEFAULT';
  }
}
