'use client';

import type { UseFormRegister } from 'react-hook-form';

interface ToggleSettingsProps {
  register: UseFormRegister<any>;
}

export function ToggleSettings({ register }: ToggleSettingsProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          {...register('allowLateJoin')}
          type="checkbox"
          className="w-4 h-4 accent-[#FF6B35]"
        />
        <span className="text-sm text-gray-700">
          Dołączanie po starcie gry
        </span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          {...register('allowHints')}
          type="checkbox"
          className="w-4 h-4 accent-[#FF6B35]"
        />
        <span className="text-sm text-gray-700">Podpowiedzi</span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          {...register('teamMode')}
          type="checkbox"
          className="w-4 h-4 accent-[#FF6B35]"
        />
        <span className="text-sm text-gray-700">Tryb drużynowy</span>
      </label>
    </div>
  );
}
