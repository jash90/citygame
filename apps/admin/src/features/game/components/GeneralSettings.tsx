'use client';

import type { Control, UseFormRegister } from 'react-hook-form';
import { inputClass } from './GameSettingsEditor.utils';

interface GeneralSettingsProps {
  register: UseFormRegister<any>;
  errors: any;
}

export function GeneralSettings({ register, errors }: GeneralSettingsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Maks. gracze
        </label>
        <input
          {...register('maxPlayers')}
          type="number"
          min={1}
          placeholder="Brak limitu"
          className={inputClass(errors.maxPlayers?.message)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Limit czasu (min)
        </label>
        <input
          {...register('timeLimitMinutes')}
          type="number"
          min={1}
          placeholder="Brak limitu"
          className={inputClass(errors.timeLimitMinutes?.message)}
        />
      </div>
      <div className="flex flex-col gap-1 col-span-2">
        <label className="text-xs font-medium text-gray-600">
          Odległość ujawnienia pinezki (m)
        </label>
        <input
          {...register('pinRevealDistanceMeters')}
          type="number"
          min={20}
          max={1000}
          placeholder="Domyślnie 100"
          className={inputClass(errors.pinRevealDistanceMeters?.message)}
        />
        {errors.pinRevealDistanceMeters?.message ? (
          <p className="text-xs text-red-600 mt-1">
            {String(errors.pinRevealDistanceMeters.message)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">
            W tej odległości od lokalizacji kolejne zadanie pojawi się na mapie.
            Zakres: 20–1000 m.
          </p>
        )}
      </div>
    </div>
  );
}
