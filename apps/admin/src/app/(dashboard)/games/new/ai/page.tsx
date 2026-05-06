'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
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
import {
  useCreateGameFromBlueprint,
  useGenerateBlueprint,
} from '@/features/ai-game/hooks/useAiGameBlueprint';

export default function AiGameWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [input, setInput] = useState<BlueprintInput | null>(null);
  const [blueprint, setBlueprint] = useState<GameBlueprint | null>(null);

  const generate = useGenerateBlueprint();
  const create = useCreateGameFromBlueprint();

  const handleGenerate = (next: BlueprintInput) => {
    setInput(next);
    generate.mutate(next, {
      onSuccess: (bp) => {
        setBlueprint(bp);
        setStep(2);
      },
    });
  };

  const handleSave = () => {
    if (!blueprint || !input) return;
    create.mutate(
      { blueprint, input },
      {
        onSuccess: (game) => router.push(`/games/${game.id}`),
      },
    );
  };

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
          Krok {step} z {WIZARD_STEPS.length} — AI wygeneruje całą grę z zadaniami,
          przepływem i zakończeniami.
        </p>
      </header>

      <WizardLayout currentStep={step}>
        {step === 1 && (
          <>
            {generate.isPending && (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">
                  AI tworzy grę. To może potrwać do minuty.
                </span>
              </div>
            )}
            {!generate.isPending && (
              <BlueprintInputForm
                defaultValues={input ?? undefined}
                onSubmit={handleGenerate}
                isSubmitting={generate.isPending}
                errorMessage={
                  generate.error instanceof Error ? generate.error.message : null
                }
              />
            )}
          </>
        )}

        {step === 2 && blueprint && (
          <BlueprintOutlineView
            blueprint={blueprint}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && blueprint && input && (
          <BlueprintTasksList
            blueprint={blueprint}
            input={input}
            onChange={(next) => setBlueprint(next)}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
          />
        )}

        {step === 4 && blueprint && input && (
          <BlueprintFlowStep
            blueprint={blueprint}
            input={input}
            onChange={(next) => setBlueprint(next)}
            onBack={() => setStep(3)}
            onContinue={() => setStep(5)}
          />
        )}

        {step === 5 && blueprint && input && (
          <BlueprintConfirmView
            blueprint={blueprint}
            input={input}
            onBack={() => setStep(4)}
            onSave={handleSave}
            isSaving={create.isPending}
            errorMessage={
              create.error instanceof Error ? create.error.message : null
            }
          />
        )}
      </WizardLayout>
    </div>
  );
}
