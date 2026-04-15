'use client';

import type { UseFormRegister } from 'react-hook-form';
import { inputClass } from './GameSettingsEditor.utils';

interface NarrativeSettingsProps {
  register: UseFormRegister<any>;
}

export function NarrativeSettings({ register }: NarrativeSettingsProps) {
  return (
    <div className="flex flex-col gap-3 mt-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Temat
        </label>
        <input
          {...register('narrative.theme')}
          type="text"
          placeholder="np. Średniowieczna zagadka"
          className={inputClass()}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Prolog
        </label>
        <textarea
          {...register('narrative.prologue')}
          rows={3}
          placeholder="Tekst wprowadzający do gry..."
          className={`${inputClass()} resize-none`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Epilog
        </label>
        <textarea
          {...register('narrative.epilogue')}
          rows={3}
          placeholder="Tekst kończący grę..."
          className={`${inputClass()} resize-none`}
        />
      </div>
    </div>
  );
}
