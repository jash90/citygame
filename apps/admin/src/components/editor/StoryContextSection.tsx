'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { inputClass, Field } from './taskEditor.utils';

interface StoryContextSectionProps {
  register: any;
  storyContextOpen: boolean;
  onToggle: () => void;
}

export function StoryContextSection({
  register,
  storyContextOpen,
  onToggle,
}: StoryContextSectionProps) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-[#FF6B35] transition-colors"
      >
        <ChevronDown
          size={14}
          className={`transition-transform ${storyContextOpen ? 'rotate-0' : '-rotate-90'}`}
        />
        Kontekst fabularny
      </button>

      {storyContextOpen && (
        <div className="flex flex-col gap-3">
          <Field label="Nazwa postaci">
            <input {...register('characterName')} placeholder="np. Stary Kronikarz" className={inputClass()} />
          </Field>
          <Field label="Wprowadzenie do lokacji">
            <textarea {...register('locationIntro')} rows={2} placeholder="Narracja gdy gracz dociera do lokacji..." className={`${inputClass()} resize-none`} />
          </Field>
          <Field label="Narracja zadania">
            <textarea {...register('taskNarrative')} rows={2} placeholder="Kontekst fabularny przed zadaniem..." className={`${inputClass()} resize-none`} />
          </Field>
          <Field label="Odkryta wskazówka">
            <textarea {...register('clueRevealed')} rows={2} placeholder="Wskazówka odkryta po wykonaniu zadania..." className={`${inputClass()} resize-none`} />
          </Field>
        </div>
      )}
    </div>
  );
}
