'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import type { BlueprintInput, GameBlueprint } from '@citygame/shared';
import { BlueprintTaskCard } from './BlueprintTaskCard';
import { useRefineBlueprint } from '../hooks/useAiGameBlueprint';

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
}

export function BlueprintTasksList({
  blueprint,
  input,
  onChange,
  onBack,
  onContinue,
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
          disabled={pendingStage !== null || pendingIndex !== null}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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
        {blueprint.tasks.map((task) => (
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
              onRegenerate={() => handleRegenerateOne(task.index)}
            />
          </div>
        ))}
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
          disabled={pendingIndex !== null || pendingStage !== null}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60"
        >
          Dalej: diagram
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
