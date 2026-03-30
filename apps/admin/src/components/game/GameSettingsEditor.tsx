'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, X, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { GameSettings } from '@citygame/shared';

const gameSettingsSchema = z.object({
  maxPlayers: z.coerce.number().min(1).optional().or(z.literal('')),
  timeLimitMinutes: z.coerce.number().min(1).optional().or(z.literal('')),
  allowLateJoin: z.boolean().optional(),
  allowHints: z.boolean().optional(),
  teamMode: z.boolean().optional(),
  minTeamSize: z.coerce.number().min(2).optional().or(z.literal('')),
  maxTeamSize: z.coerce.number().min(2).optional().or(z.literal('')),
  narrative: z.object({
    isNarrative: z.boolean().optional(),
    theme: z.string().optional(),
    prologue: z.string().optional(),
    epilogue: z.string().optional(),
  }).optional(),
}).refine(
  (data) => {
    if (!data.teamMode) return true;
    if (typeof data.minTeamSize === 'number' && typeof data.maxTeamSize === 'number') {
      return data.minTeamSize <= data.maxTeamSize;
    }
    // When teamMode is on, at least one size should be set
    return true;
  },
  { message: 'Min. rozmiar drużyny nie może być większy niż maks.', path: ['minTeamSize'] },
).refine(
  (data) => {
    if (!data.teamMode) return true;
    // Require team sizes when team mode is enabled
    return data.minTeamSize !== '' && data.maxTeamSize !== '';
  },
  { message: 'Rozmiary drużyny są wymagane w trybie drużynowym', path: ['maxTeamSize'] },
);

type SettingsFormValues = z.infer<typeof gameSettingsSchema>;

interface GameSettingsEditorProps {
  gameId: string;
  settings: GameSettings;
}

function inputClass(error?: string) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

export function GameSettingsEditor({ gameId, settings }: GameSettingsEditorProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(gameSettingsSchema),
    defaultValues: {
      maxPlayers: settings.maxPlayers ?? '',
      timeLimitMinutes: settings.timeLimitMinutes ?? '',
      allowLateJoin: settings.allowLateJoin ?? false,
      allowHints: settings.allowHints ?? true,
      teamMode: settings.teamMode ?? false,
      minTeamSize: settings.minTeamSize ?? '',
      maxTeamSize: settings.maxTeamSize ?? '',
      narrative: {
        isNarrative: (settings as any).narrative?.isNarrative ?? false,
        theme: (settings as any).narrative?.theme ?? '',
        prologue: (settings as any).narrative?.prologue ?? '',
        epilogue: (settings as any).narrative?.epilogue ?? '',
      },
    },
  });

  // Sync form with external settings changes
  useEffect(() => {
    if (!editing) {
      reset({
        maxPlayers: settings.maxPlayers ?? '',
        timeLimitMinutes: settings.timeLimitMinutes ?? '',
        allowLateJoin: settings.allowLateJoin ?? false,
        allowHints: settings.allowHints ?? true,
        teamMode: settings.teamMode ?? false,
        minTeamSize: settings.minTeamSize ?? '',
        maxTeamSize: settings.maxTeamSize ?? '',
        narrative: {
          isNarrative: (settings as any).narrative?.isNarrative ?? false,
          theme: (settings as any).narrative?.theme ?? '',
          prologue: (settings as any).narrative?.prologue ?? '',
          epilogue: (settings as any).narrative?.epilogue ?? '',
        },
      });
    }
  }, [settings, editing, reset]);

  const teamMode = watch('teamMode');
  const isNarrative = watch('narrative.isNarrative');

  const mutation = useMutation({
    mutationFn: (data: SettingsFormValues) => {
      const cleaned: GameSettings & { narrative?: { isNarrative?: boolean; theme?: string; prologue?: string; epilogue?: string } } = {
        maxPlayers: data.maxPlayers === '' ? undefined : Number(data.maxPlayers),
        timeLimitMinutes: data.timeLimitMinutes === '' ? undefined : Number(data.timeLimitMinutes),
        allowLateJoin: data.allowLateJoin,
        allowHints: data.allowHints,
        teamMode: data.teamMode,
        minTeamSize: data.teamMode && data.minTeamSize !== '' ? Number(data.minTeamSize) : undefined,
        maxTeamSize: data.teamMode && data.maxTeamSize !== '' ? Number(data.maxTeamSize) : undefined,
        narrative: data.narrative?.isNarrative
          ? {
              isNarrative: true,
              theme: data.narrative.theme || undefined,
              prologue: data.narrative.prologue || undefined,
              epilogue: data.narrative.epilogue || undefined,
            }
          : { isNarrative: false },
      };
      return api.patch(`/api/admin/games/${gameId}`, { settings: cleaned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', gameId] });
      queryClient.invalidateQueries({ queryKey: ['admin-game', gameId] });
      setEditing(false);
    },
  });

  const onCancel = () => {
    reset();
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Ustawienia
          </h3>
          <button
            onClick={() => setEditing(true)}
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
              {(settings as any).narrative?.isNarrative ? 'Tak' : 'Nie'}
            </dd>
          </div>
          {(settings as any).narrative?.isNarrative && (settings as any).narrative?.theme && (
            <div>
              <dt className="text-gray-500">Temat</dt>
              <dd className="font-medium text-gray-800 mt-0.5">
                {(settings as any).narrative.theme}
              </dd>
            </div>
          )}
        </dl>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="bg-white rounded-xl border border-[#FF6B35]/30 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide">
          Edycja ustawień
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <X size={13} />
            Anuluj
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            Zapisz
          </button>
        </div>
      </div>

      {mutation.error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Błąd zapisu'}
        </div>
      )}

      <fieldset disabled={mutation.isPending}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Maks. gracze</label>
            <input
              {...register('maxPlayers')}
              type="number"
              min={1}
              placeholder="Brak limitu"
              className={inputClass(errors.maxPlayers?.message)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Limit czasu (min)</label>
            <input
              {...register('timeLimitMinutes')}
              type="number"
              min={1}
              placeholder="Brak limitu"
              className={inputClass(errors.timeLimitMinutes?.message)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              {...register('allowLateJoin')}
              type="checkbox"
              className="w-4 h-4 accent-[#FF6B35]"
            />
            <span className="text-sm text-gray-700">Dołączanie po starcie gry</span>
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

        {teamMode && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Min. rozmiar drużyny</label>
              <input
                {...register('minTeamSize')}
                type="number"
                min={2}
                placeholder="2"
                className={inputClass(errors.minTeamSize?.message)}
              />
              {errors.minTeamSize && (
                <span className="text-xs text-red-500">{errors.minTeamSize.message}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Maks. rozmiar drużyny</label>
              <input
                {...register('maxTeamSize')}
                type="number"
                min={2}
                placeholder="4"
                className={inputClass(errors.maxTeamSize?.message)}
              />
            </div>
          </div>
        )}

        {/* Narrative mode */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              {...register('narrative.isNarrative')}
              type="checkbox"
              className="w-4 h-4 accent-[#FF6B35]"
            />
            <span className="text-sm text-gray-700">Tryb narracyjny</span>
          </label>

          {isNarrative && (
            <div className="flex flex-col gap-3 mt-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Temat</label>
                <input
                  {...register('narrative.theme')}
                  type="text"
                  placeholder="np. Średniowieczna zagadka"
                  className={inputClass()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Prolog</label>
                <textarea
                  {...register('narrative.prologue')}
                  rows={3}
                  placeholder="Tekst wprowadzający do gry..."
                  className={`${inputClass()} resize-none`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Epilog</label>
                <textarea
                  {...register('narrative.epilogue')}
                  rows={3}
                  placeholder="Tekst kończący grę..."
                  className={`${inputClass()} resize-none`}
                />
              </div>
            </div>
          )}
        </div>
      </fieldset>
    </form>
  );
}
