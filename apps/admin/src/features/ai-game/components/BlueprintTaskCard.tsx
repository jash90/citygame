'use client';

import { Loader2, RefreshCw, Key, Lock } from 'lucide-react';
import type { BlueprintTask } from '@citygame/shared';

interface BlueprintTaskCardProps {
  task: BlueprintTask;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

export function BlueprintTaskCard({
  task,
  isRegenerating,
  onRegenerate,
}: BlueprintTaskCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3 bg-white">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-white text-xs font-bold">
            {task.index}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {task.title}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {task.type} · {task.unlockMethod} · {task.maxPoints} pkt
            </p>
          </div>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {isRegenerating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Wygeneruj ponownie
        </button>
      </header>

      <p className="text-sm text-gray-700 leading-relaxed">{task.description}</p>

      {task.expectedAnswer && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
          Oczekiwana odpowiedź: <span className="font-mono">{task.expectedAnswer}</span>
        </p>
      )}

      {task.aiPrompt && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-blue-900">
          <span className="font-semibold">Prompt AI:</span> {task.aiPrompt}
        </div>
      )}

      {task.revealsItem && (
        <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 text-emerald-900">
          <Key size={13} />
          <span>
            <span className="font-semibold">Odkrywa:</span> {task.revealsItem.label} ={' '}
            <span className="font-mono">{task.revealsItem.value}</span> (
            {task.revealsItem.slug})
          </span>
        </div>
      )}

      {task.unlockRequirements && (
        <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-amber-900">
          <Lock size={13} />
          <span>
            <span className="font-semibold">Wymaga:</span>{' '}
            {task.unlockRequirements.requiresItem} (kod:{' '}
            <span className="font-mono">{task.unlockRequirements.expectedAnswer}</span>)
          </span>
        </div>
      )}

      {task.hints.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500">
            Wskazówki ({task.hints.length})
          </summary>
          <ol className="mt-2 flex flex-col gap-1 pl-4">
            {task.hints.map((h, i) => (
              <li key={i} className="text-gray-700">
                {i + 1}. {h.content}{' '}
                <span className="text-gray-400">
                  (-{h.pointPenalty} pkt)
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}
