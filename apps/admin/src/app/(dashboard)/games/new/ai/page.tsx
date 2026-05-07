'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import type { BlueprintInput, GameBlueprint } from '@citygame/shared';
import {
  WizardLayout,
  WIZARD_STEPS,
  type WizardStep,
} from '@/features/ai-game/components/WizardLayout';
import { BlueprintInputForm } from '@/features/ai-game/components/BlueprintInputForm';
import { BlueprintOutlineView } from '@/features/ai-game/components/BlueprintOutlineView';
import { BlueprintTasksList } from '@/features/ai-game/components/BlueprintTasksList';
import { BlueprintFlowStep } from '@/features/ai-game/components/BlueprintFlowStep';
import { BlueprintConfirmView } from '@/features/ai-game/components/BlueprintConfirmView';
import { GenerationStatusBanner } from '@/features/ai-game/components/GenerationStatusBanner';
import { useCreateGameFromBlueprint } from '@/features/ai-game/hooks/useAiGameBlueprint';
import { useAiBlueprintOrchestrator } from '@/features/ai-game/hooks/useAiBlueprintOrchestrator';
import { useAiConfig } from '@/features/settings/hooks/useAdminSettings';
import { clearPersisted } from '@/features/ai-game/hooks/useBlueprintPersistence';

export default function AiGameWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [draftInput, setDraftInput] = useState<BlueprintInput | null>(null);

  const aiConfig = useAiConfig();
  const orchestrator = useAiBlueprintOrchestrator(draftInput, {
    useWebSearch: aiConfig.data?.useWebSearch ?? false,
  });
  const create = useCreateGameFromBlueprint();

  // Auto-advance to step 2 the moment the user submits the form. The step
  // content renders skeletons for whatever isn't ready yet, so the wizard
  // immediately shows live progress instead of a blocking spinner.
  const handleGenerate = (next: BlueprintInput) => {
    setDraftInput(next);
    orchestrator.start(next);
    setStep(2);
  };

  // After a successful save, drop the cached run so a fresh visit doesn't
  // offer to resume a finished pipeline.
  const handleSave = () => {
    if (!orchestrator.composedBlueprint || !orchestrator.state) return;
    create.mutate(
      {
        blueprint: orchestrator.composedBlueprint,
        input: orchestrator.state.input,
      },
      {
        onSuccess: (game) => {
          if (orchestrator.state) {
            clearPersisted(orchestrator.state.inputHash);
          }
          router.push(`/games/${game.id}`);
        },
      },
    );
  };

  // Resume modal — surfaced when localStorage has a non-expired run for the
  // CURRENT draft input (i.e. the user filled the form again with the same
  // settings). Click "Wznów" → hydrate state, jump to the matching wizard
  // step. Click "Zacznij od nowa" → wipe the entry, start fresh.
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const showResumeModal =
    !!orchestrator.pendingResume && !orchestrator.state && !resumeDismissed;

  // When the orchestrator hydrates a persisted run, infer which step to land
  // on from how far the pipeline got — outline ok → step 2; tasks ok → 3;
  // transitions ok → 4; everything ok → 5.
  useEffect(() => {
    const s = orchestrator.state;
    if (!s) return;
    let target: WizardStep = 1;
    if (s.stages.outline === 'ok') target = 2;
    if (s.stages.tasksOverall === 'ok') target = 3;
    if (s.stages.transitions === 'ok' && s.stages.endings === 'ok') target = 4;
    if (orchestrator.composedBlueprint) target = 5;
    setStep((current) => (target > current ? target : current));
    // Only trigger when the high-level milestones flip — not on every
    // per-POI status change, which would constantly hop the user around.
  }, [
    orchestrator.state?.stages.outline,
    orchestrator.state?.stages.tasksOverall,
    orchestrator.state?.stages.transitions,
    orchestrator.state?.stages.endings,
    orchestrator.composedBlueprint,
    orchestrator.state,
  ]);

  // Step gating — keeps "Dalej" buttons disabled until the underlying data
  // for the next step has actually arrived.
  const canAdvanceFrom = (from: WizardStep): boolean => {
    const s = orchestrator.state;
    if (!s) return false;
    if (from === 2) return s.stages.outline === 'ok';
    if (from === 3) return s.stages.tasksOverall === 'ok';
    if (from === 4) return s.stages.transitions === 'ok' && s.stages.endings === 'ok';
    return true;
  };

  // The step components were originally typed for a fully-assembled
  // GameBlueprint. We feed them `partialBlueprint` so they can render as data
  // streams in; per-component skeleton guards (BlueprintOutlineView etc.)
  // tolerate the missing fields. The cast is safe because every consumer
  // either checks for emptiness or only reads fields once their stage is ok.
  const partialAsBlueprint = orchestrator.partialBlueprint as GameBlueprint;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <Link
        href="/games"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 w-fit"
      >
        <ArrowLeft size={16} />
        Powrót do gier
      </Link>

      <header>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={20} className="text-[#FF6B35]" />
          Nowa gra z pomocą AI
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Krok {step} z {WIZARD_STEPS.length} — etapy generacji wypełniają
          kolejne kroki na żywo, możesz przeglądać zarys zanim AI skończy
          zadania.
        </p>
      </header>

      {showResumeModal && (
        <ResumeModal
          city={orchestrator.pendingResume!.inputSummary.city}
          theme={orchestrator.pendingResume!.inputSummary.theme}
          savedAt={orchestrator.pendingResume!.savedAt}
          onResume={() => {
            orchestrator.resume();
            setResumeDismissed(true);
          }}
          onDiscard={() => {
            if (orchestrator.pendingResume) {
              clearPersisted(orchestrator.pendingResume.inputHash);
            }
            setResumeDismissed(true);
          }}
        />
      )}

      {orchestrator.state && (
        <GenerationStatusBanner
          state={orchestrator.state}
          onRetryStage={orchestrator.retryStage}
          onRetryTask={orchestrator.retryTask}
        />
      )}

      <WizardLayout currentStep={step}>
        {step === 1 && (
          <BlueprintInputForm
            defaultValues={draftInput ?? undefined}
            onSubmit={handleGenerate}
            isSubmitting={false}
            errorMessage={null}
          />
        )}

        {step === 2 && orchestrator.state && (
          <BlueprintOutlineView
            blueprint={partialAsBlueprint}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
            canContinue={canAdvanceFrom(2)}
          />
        )}

        {step === 3 && orchestrator.state && (
          <BlueprintTasksList
            blueprint={partialAsBlueprint}
            input={orchestrator.state.input}
            onChange={() => {
              // Stage-by-stage flow: editing happens in-place via the manual
              // task editor after save. Refine buttons inside this step still
              // work via `useRefineBlueprint` (untouched).
            }}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
            canContinue={canAdvanceFrom(3)}
            taskStatuses={orchestrator.state.stages.tasks}
            onRetryTask={orchestrator.retryTask}
          />
        )}

        {step === 4 && orchestrator.state && (
          <BlueprintFlowStep
            blueprint={partialAsBlueprint}
            input={orchestrator.state.input}
            onChange={() => {
              // No-op for the same reason as step 3.
            }}
            onBack={() => setStep(3)}
            onContinue={() => setStep(5)}
            canContinue={canAdvanceFrom(4)}
          />
        )}

        {step === 5 && orchestrator.state && (
          <BlueprintConfirmView
            blueprint={partialAsBlueprint}
            input={orchestrator.state.input}
            onBack={() => setStep(4)}
            onSave={handleSave}
            isSaving={create.isPending}
            canSave={!!orchestrator.composedBlueprint}
            errorMessage={
              create.error instanceof Error ? create.error.message : null
            }
          />
        )}
      </WizardLayout>
    </div>
  );
}

interface ResumeModalProps {
  city: string;
  theme: string;
  savedAt: number;
  onResume: () => void;
  onDiscard: () => void;
}

function ResumeModal({ city, theme, savedAt, onResume, onDiscard }: ResumeModalProps) {
  const minutesAgo = Math.max(1, Math.floor((Date.now() - savedAt) / 60_000));
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <RefreshCw size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Niedokończona generacja
          </p>
          <p className="text-xs text-amber-800">
            {minutesAgo} {minutesAgo === 1 ? 'minutę' : minutesAgo < 5 ? 'minuty' : 'minut'} temu uruchomiłeś
            generację dla „{city} · {theme}". Wznawiamy z miejsca, w którym
            była ostatnio gotowa odpowiedź — etapy w trakcie zostaną
            powtórzone.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
        >
          Zacznij od nowa
        </button>
        <button
          type="button"
          onClick={onResume}
          className="px-3 py-1.5 text-xs rounded-lg bg-amber-900 text-white hover:bg-amber-800"
        >
          Wznów
        </button>
      </div>
    </div>
  );
}
