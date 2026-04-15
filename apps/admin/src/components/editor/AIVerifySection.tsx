'use client';

import { TaskType } from '@citygame/shared';
import { inputClass, Field } from './taskEditor.utils';
import { AIPromptEditor } from './AIPromptEditor';

interface AIVerifySectionProps {
  type: TaskType.PHOTO_AI | TaskType.TEXT_AI | TaskType.AUDIO_AI;
  prompt: string;
  threshold: number;
  description: string;
  onPromptChange: (v: string) => void;
  onThresholdChange: (v: number) => void;
}

export function AIVerifySection({
  type,
  prompt,
  threshold,
  description,
  onPromptChange,
  onThresholdChange,
}: AIVerifySectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Prompt weryfikacyjny AI">
        <AIPromptEditor
          value={prompt}
          onChange={onPromptChange}
          taskType={type}
          taskDescription={description}
          threshold={threshold}
        />
      </Field>
      <Field label="Próg akceptacji (0.0–1.0)" hint="Np. 0.7 = 70% pewności wymagane do zaliczenia">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="flex-1 accent-[#FF6B35]"
          />
          <span className="text-sm font-bold text-[#FF6B35] w-10 text-right tabular-nums">
            {threshold.toFixed(2)}
          </span>
        </div>
      </Field>
    </div>
  );
}
