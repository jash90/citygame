'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import type { BlueprintInput, GameBlueprint } from '@citygame/shared';
import { BlueprintTaskCard } from './BlueprintTaskCard';
import { useRefineBlueprint } from '../hooks/useAiGameBlueprint';
import type { StageStatus } from '../hooks/useAiBlueprintOrchestrator';

// Leaflet touches `window` at module load; client-only.
const BlueprintTasksMap = dynamic(
  () =>
    import('./BlueprintTasksMap').then((m) => m.BlueprintTasksMap),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400"
      style={{ height: 380 }}
    >
      <Loader2 size={18} className="animate-spin mr-2" />
      Ładowanie mapy…
    </div>
  );
}

interface BlueprintTasksListProps {
  blueprint: GameBlueprint;
  input: BlueprintInput;
  onChange: (next: GameBlueprint) => void;
  onBack: () => void;
  onContinue: () => void;
  /**
   * Stage-by-stage flow only. Per-POI status keyed by 1-based POI index.
   * Undefined → legacy single-shot mode (every task already loaded).
   */
  taskStatuses?: Record<number, StageStatus>;
  /** Stage-by-stage flow: re-fire the orchestrator for one POI. */
  onRetryTask?: (poiIndex: number) => void;
  canContinue?: boolean;
}

export function BlueprintTasksList({
  blueprint,
  input,
  onChange,
  onBack,
  onContinue,
  taskStatuses,
  onRetryTask,
  canContinue = true,
}: BlueprintTasksListProps) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [pendingStage, setPendingStage] = useState<'tasks' | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const refine = useRefineBlueprint();

  const handleRegenerateOne = (taskIndex: number) => {
    setPendingIndex(taskIndex);
    refine.mutate(
      { stage: 'task', taskIndex, blueprint, input },
      {
        onSuccess: (next) => onChange(next),
        onSettled: () => setPendingIndex(null),
      },
    );
  };

  const handleRegenerateAll = () => {
    setPendingStage('tasks');
    refine.mutate(
      { stage: 'tasks', blueprint, input },
      {
        onSuccess: (next) => onChange(next),
        onSettled: () => setPendingStage(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Zadania</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sprawdź zadania i ewentualnie wygeneruj wybrane jeszcze raz.
          </p>
        </div>
        <button
          onClick={handleRegenerateAll}
          disabled={
            pendingStage !== null ||
            pendingIndex !== null ||
            // Stage-by-stage flow: refine endpoint expects a complete
            // blueprint, so the button only enables once every task is `ok`.
            (taskStatuses !== undefined &&
              Object.values(taskStatuses).some((s) => s !== 'ok'))
          }
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pendingStage === 'tasks' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Wygeneruj wszystkie
        </button>
      </header>

      {refine.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {refine.error.message}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-500">
          Przeciągnij znacznik na mapie, aby poprawić współrzędne wybranego zadania —
          zmiany są zapisywane natychmiast w wersji roboczej gry.
        </p>
        <BlueprintTasksMap
          blueprint={blueprint}
          onChange={onChange}
          highlightedIndex={hoveredIndex}
        />
      </div>

      <div className="grid gap-3">
        {renderTaskRows({
          blueprint,
          taskStatuses,
          pendingIndex,
          hoveredIndex,
          setHoveredIndex,
          onRegenerate: handleRegenerateOne,
          onRetryTask,
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Wstecz
        </button>
        <button
          onClick={onContinue}
          disabled={pendingIndex !== null || pendingStage !== null || !canContinue}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Dalej: diagram
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function renderTaskRows({
  blueprint,
  taskStatuses,
  pendingIndex,
  hoveredIndex,
  setHoveredIndex,
  onRegenerate,
  onRetryTask,
}: {
  blueprint: GameBlueprint;
  taskStatuses: Record<number, StageStatus> | undefined;
  pendingIndex: number | null;
  hoveredIndex: number | null;
  setHoveredIndex: (
    next: number | null | ((current: number | null) => number | null),
  ) => void;
  onRegenerate: (poiIndex: number) => void;
  onRetryTask?: (poiIndex: number) => void;
}) {
  // Stage-by-stage flow: iterate over the orchestrator's per-POI status map
  // so skeletons show for POIs whose generation is still pending or queued,
  // and error cards show for POIs whose call failed (with a one-click retry).
  if (taskStatuses) {
    const indices = Object.keys(taskStatuses).map(Number).sort((a, b) => a - b);
    if (indices.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-400">
          Czekam na zarys gry — POI pojawią się tu, gdy AI ustali listę
          lokalizacji.
        </div>
      );
    }
    return indices.map((i) => {
      const status = taskStatuses[i] ?? 'idle';
      const task = blueprint.tasks.find((t) => t.index === i);
      if (status === 'ok' && task) {
        return (
          <div
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() =>
              setHoveredIndex((current) => (current === i ? null : current))
            }
          >
            <BlueprintTaskCard
              task={task}
              isRegenerating={pendingIndex === i}
              onRegenerate={() => onRegenerate(i)}
            />
          </div>
        );
      }
      if (status === 'error') {
        return (
          <div
            key={i}
            className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-3"
          >
            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900">
                Zadanie #{i} nie powiodło się
              </p>
              <p className="text-xs text-red-700">
                Najczęściej winny jest rate-limit OpenRouter lub odrzucony
                schemat odpowiedzi. Spróbuj ponownie — pozostałe zadania
                pozostaną nietknięte.
              </p>
              {onRetryTask && (
                <button
                  type="button"
                  onClick={() => onRetryTask(i)}
                  className="self-start mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-red-300 bg-white hover:bg-red-100 text-red-800"
                >
                  <RefreshCw size={12} /> Spróbuj ponownie
                </button>
              )}
            </div>
          </div>
        );
      }
      // pending or idle → skeleton card
      return (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center gap-3"
        >
          {status === 'pending' ? (
            <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />
          ) : (
            <span className="inline-block w-4 h-4 rounded-full bg-gray-300" />
          )}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="h-3 w-32 rounded bg-gray-200" />
            <span className="h-2.5 w-48 rounded bg-gray-200/70" />
          </div>
          <span className="text-[11px] text-gray-400">
            #{i} ·{' '}
            {status === 'pending'
              ? 'generuję'
              : 'w kolejce'}
          </span>
        </div>
      );
    });
  }

  // Legacy mode (no orchestrator) — original behaviour.
  return blueprint.tasks.map((task) => (
    <div
      key={task.index}
      onMouseEnter={() => setHoveredIndex(task.index)}
      onMouseLeave={() =>
        setHoveredIndex((current) =>
          current === task.index ? null : current,
        )
      }
    >
      <BlueprintTaskCard
        task={task}
        isRegenerating={pendingIndex === task.index}
        onRegenerate={() => onRegenerate(task.index)}
      />
    </div>
  ));
}
