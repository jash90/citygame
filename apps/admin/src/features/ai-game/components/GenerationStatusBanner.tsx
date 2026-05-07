'use client';

import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  SkipForward,
} from 'lucide-react';
import type {
  OrchestratorState,
  StageKey,
  StageStatus,
} from '../hooks/useAiBlueprintOrchestrator';
import { isCreditsError } from '../lib/errorClassification';

interface GenerationStatusBannerProps {
  state: OrchestratorState | null;
  onRetryStage: (stage: StageKey) => void;
  onRetryTask: (poiIndex: number) => void;
}

/** Polish label for each stage key, used inside the error message header. */
const STAGE_LABEL: Record<string, string> = {
  research: 'Web research',
  bible: 'Story Bible',
  outline: 'Zarys',
  transitions: 'Przejścia',
  endings: 'Zakończenia',
};

interface StageRow {
  key: StageKey | 'tasks';
  label: string;
  status: StageStatus | 'partial';
  hint?: string;
  retry?: () => void;
}

/**
 * Sticky-ish status banner shown above the wizard step content during AI
 * generation. Renders one chip per pipeline stage so the admin sees what's
 * pending, what's done, what failed, and gets a one-click retry on any
 * stage that errored.
 */
export function GenerationStatusBanner({
  state,
  onRetryStage,
  onRetryTask,
}: GenerationStatusBannerProps) {
  if (!state) return null;

  const totalTasks = state.data.outline?.pois.length ?? state.input.taskCount;
  const okTasks = Object.values(state.stages.tasks).filter(
    (s) => s === 'ok',
  ).length;
  const failingTasks = Object.entries(state.stages.tasks).filter(
    ([, s]) => s === 'error',
  );

  const taskStatus: StageStatus | 'partial' =
    state.stages.tasksOverall === 'idle'
      ? 'idle'
      : state.stages.tasksOverall === 'ok'
        ? 'ok'
        : state.stages.tasksOverall === 'error'
          ? 'error'
          : okTasks > 0
            ? 'partial'
            : 'pending';

  const rows: StageRow[] = [
    {
      key: 'research',
      label: 'Web research',
      status: state.stages.research,
      hint: state.stages.research === 'skipped' ? 'wyłączone w ustawieniach' : undefined,
      retry:
        state.stages.research === 'error'
          ? () => onRetryStage('research')
          : undefined,
    },
    {
      key: 'bible',
      label: 'Story Bible',
      status: state.stages.bible,
      retry:
        state.stages.bible === 'error' ? () => onRetryStage('bible') : undefined,
    },
    {
      key: 'outline',
      label: 'Zarys',
      status: state.stages.outline,
      retry:
        state.stages.outline === 'error'
          ? () => onRetryStage('outline')
          : undefined,
    },
    {
      key: 'tasks',
      label: `Zadania ${okTasks}/${totalTasks}`,
      status: taskStatus,
      hint: failingTasks.length
        ? `${failingTasks.length} błąd${failingTasks.length === 1 ? '' : 'y'}`
        : undefined,
    },
    {
      key: 'transitions',
      label: 'Przejścia',
      status: state.stages.transitions,
      retry:
        state.stages.transitions === 'error'
          ? () => onRetryStage('transitions')
          : undefined,
    },
    {
      key: 'endings',
      label: 'Zakończenia',
      status: state.stages.endings,
      retry:
        state.stages.endings === 'error'
          ? () => onRetryStage('endings')
          : undefined,
    },
  ];

  // Pick the most relevant error to surface as a full-width card. Credits
  // errors ALWAYS take precedence (the user has to top up before anything
  // else can recover) regardless of which stage they happened on.
  const allErrors = Object.entries(state.errors).filter(
    (entry): entry is [string, { message: string }] => !!entry[1],
  );
  const creditsEntry = allErrors.find(([, e]) => isCreditsError(e.message));
  const otherEntry = allErrors.find(([, e]) => !isCreditsError(e.message));
  const featuredError = creditsEntry ?? otherEntry ?? null;

  return (
    <div className="flex flex-col gap-2">
      {featuredError && (
        <ErrorCard
          stageKey={featuredError[0]}
          message={featuredError[1].message}
          onRetry={() => {
            const stage = featuredError[0];
            if (stage.startsWith('task#')) {
              onRetryTask(Number(stage.slice('task#'.length)));
            } else {
              onRetryStage(stage as StageKey);
            }
          }}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 sm:p-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {rows.map((row) => (
            <StageChip key={row.key} row={row} />
          ))}
        </div>

        {failingTasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-red-700 border-t border-red-100">
            <AlertTriangle size={14} className="text-red-500" />
            <span>Błędne zadania:</span>
            {failingTasks.map(([poiIndexStr]) => {
              const poiIndex = Number(poiIndexStr);
              return (
                <button
                  key={poiIndex}
                  type="button"
                  onClick={() => onRetryTask(poiIndex)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-300 bg-red-50 hover:bg-red-100 text-red-800"
                >
                  <RefreshCw size={11} />#{poiIndex}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface ErrorCardProps {
  stageKey: string;
  message: string;
  onRetry: () => void;
}

function ErrorCard({ stageKey, message, onRetry }: ErrorCardProps) {
  const stageLabel = stageKey.startsWith('task#')
    ? `Zadanie #${stageKey.slice('task#'.length)}`
    : STAGE_LABEL[stageKey] ?? stageKey;

  if (isCreditsError(message)) {
    return (
      <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-3">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-700" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="font-semibold">
            Brak kredytów na koncie OpenRouter — {stageLabel} nie może
            pobrać odpowiedzi
          </p>
          <p className="text-amber-800">
            Generator zatrzymał się na etapie „{stageLabel}", ponieważ konto
            OpenRouter nie ma wystarczających środków na pokrycie tokenów
            modelu. Doładuj konto, a następnie kliknij „Spróbuj ponownie" —
            wszystkie ukończone etapy zostaną zachowane.
          </p>
          <p className="text-[11px] text-amber-700 font-mono break-words">
            {message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <a
              href="https://openrouter.ai/settings/credits"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800"
            >
              Doładuj konto OpenRouter
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw size={12} /> Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-3">
      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="font-semibold">
          Etap „{stageLabel}" nie powiódł się
        </p>
        <p className="text-red-700 break-words">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-300 bg-white text-xs font-semibold text-red-800 hover:bg-red-100 mt-1"
        >
          <RefreshCw size={12} /> Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}

function StageChip({ row }: { row: StageRow }) {
  const { label, status, hint, retry } = row;
  const tone =
    status === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'partial'
        ? 'border-orange-200 bg-orange-50 text-orange-700'
        : status === 'pending'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : status === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : status === 'skipped'
              ? 'border-gray-200 bg-gray-50 text-gray-500'
              : 'border-gray-200 bg-gray-50 text-gray-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${tone}`}
    >
      <StatusIcon status={status} />
      <span>{label}</span>
      {hint && <span className="text-[10px] opacity-70">· {hint}</span>}
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-current text-[10px] hover:bg-white/60"
        >
          <RefreshCw size={10} /> ponów
        </button>
      )}
    </span>
  );
}

function StatusIcon({ status }: { status: StageStatus | 'partial' }) {
  switch (status) {
    case 'ok':
      return <Check size={12} />;
    case 'pending':
    case 'partial':
      return <Loader2 size={12} className="animate-spin" />;
    case 'error':
      return <AlertTriangle size={12} />;
    case 'skipped':
      return <SkipForward size={12} />;
    case 'idle':
    default:
      return <span className="inline-block w-2 h-2 rounded-full bg-current opacity-30" />;
  }
}
