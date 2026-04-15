'use client';

import type { UseFormRegister } from 'react-hook-form';
import { inputClass } from './GameSettingsEditor.utils';

interface TeamSettingsProps {
  register: UseFormRegister<any>;
  errors: any;
}

export function TeamSettings({ register, errors }: TeamSettingsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Min. rozmiar drużyny
        </label>
        <input
          {...register('minTeamSize')}
          type="number"
          min={2}
          placeholder="2"
          className={inputClass(errors.minTeamSize?.message)}
        />
        {errors.minTeamSize && (
          <span className="text-xs text-red-500">
            {errors.minTeamSize.message}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Maks. rozmiar drużyny
        </label>
        <input
          {...register('maxTeamSize')}
          type="number"
          min={2}
          placeholder="4"
          className={inputClass(errors.maxTeamSize?.message)}
        />
      </div>
    </div>
  );
}
