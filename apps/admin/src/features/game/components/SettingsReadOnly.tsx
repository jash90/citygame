'use client';

import { Pencil } from 'lucide-react';
import type { GameSettings } from '@citygame/shared';

interface SettingsReadOnlyProps {
  settings: GameSettings;
  onEdit: () => void;
}

export function SettingsReadOnly({ settings, onEdit }: SettingsReadOnlyProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Ustawienia
        </h3>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#FF6B35] transition-colors"
        >
          <Pencil size={13} />
          Edytuj
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <dt className="text-gray-500">Maks. gracze</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.maxPlayers ?? 'Brak limitu'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Limit czasu</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.timeLimitMinutes
              ? `${settings.timeLimitMinutes} min`
              : 'Brak limitu'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Odległość ujawnienia pinezki</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.pinRevealDistanceMeters
              ? `${settings.pinRevealDistanceMeters} m`
              : '100 m (domyślnie)'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Dołączanie po starcie</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.allowLateJoin ? 'Tak' : 'Nie'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Podpowiedzi</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.allowHints !== false ? 'Tak' : 'Nie'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Tryb drużynowy</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.teamMode ? 'Tak' : 'Nie'}
          </dd>
        </div>
        {settings.teamMode && (
          <div>
            <dt className="text-gray-500">Rozmiar drużyny</dt>
            <dd className="font-medium text-gray-800 mt-0.5">
              {settings.minTeamSize ?? 2}–{settings.maxTeamSize ?? 4}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">Tryb narracyjny</dt>
          <dd className="font-medium text-gray-800 mt-0.5">
            {settings.narrative?.isNarrative ? 'Tak' : 'Nie'}
          </dd>
        </div>
        {settings.narrative?.isNarrative && settings.narrative?.theme && (
          <div>
            <dt className="text-gray-500">Temat</dt>
            <dd className="font-medium text-gray-800 mt-0.5">
              {settings.narrative.theme}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
