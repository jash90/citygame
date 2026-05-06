'use client';

import { Check } from 'lucide-react';

export const WIZARD_STEPS = [
  { id: 1, label: 'Ustawienia' },
  { id: 2, label: 'Zarys' },
  { id: 3, label: 'Zadania' },
  { id: 4, label: 'Diagram' },
  { id: 5, label: 'Zapis' },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]['id'];

interface WizardLayoutProps {
  currentStep: WizardStep;
  children: React.ReactNode;
}

export function WizardLayout({ currentStep, children }: WizardLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2 text-xs sm:text-sm shrink-0"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isCurrent
                    ? 'border-[#FF6B35] bg-[#FF6B35] text-white'
                    : isCompleted
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 bg-white text-gray-500'
                }`}
              >
                {isCompleted ? <Check size={14} /> : step.id}
              </span>
              <span
                className={`whitespace-nowrap ${
                  isCurrent
                    ? 'text-gray-900 font-semibold'
                    : isCompleted
                    ? 'text-emerald-600'
                    : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {step.id < WIZARD_STEPS.length && (
                <span className="hidden sm:inline-block w-8 h-px bg-gray-300" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}
