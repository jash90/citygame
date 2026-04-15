'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Check } from 'lucide-react';
import { useUpdateGameSettings } from '@/features/game/hooks/useGameSettings';
import type { GameSettings } from '@citygame/shared';
import { SettingsReadOnly } from './SettingsReadOnly';
import { GeneralSettings } from './GeneralSettings';
import { ToggleSettings } from './ToggleSettings';
import { TeamSettings } from './TeamSettings';
import { NarrativeSettings } from './NarrativeSettings';

const gameSettingsSchema = z
  .object({
    maxPlayers: z.coerce
      .number()
      .min(1)
      .optional()
      .or(z.literal('')),
    timeLimitMinutes: z.coerce
      .number()
      .min(1)
      .optional()
      .or(z.literal('')),
    allowLateJoin: z.boolean().optional(),
    allowHints: z.boolean().optional(),
    teamMode: z.boolean().optional(),
    minTeamSize: z.coerce
      .number()
      .min(2)
      .optional()
      .or(z.literal('')),
    maxTeamSize: z.coerce
      .number()
      .min(2)
      .optional()
      .or(z.literal('')),
    narrative: z
      .object({
        isNarrative: z.boolean().optional(),
        theme: z.string().optional(),
        prologue: z.string().optional(),
        epilogue: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.teamMode) return true;
      if (
        typeof data.minTeamSize === 'number' &&
        typeof data.maxTeamSize === 'number'
      ) {
        return data.minTeamSize <= data.maxTeamSize;
      }
      return true;
    },
    {
      message: 'Min. rozmiar drużyny nie może być większy niż maks.',
      path: ['minTeamSize'],
    },
  )
  .refine(
    (data) => {
      if (!data.teamMode) return true;
      return data.minTeamSize !== '' && data.maxTeamSize !== '';
    },
    {
      message: 'Rozmiary drużyny są wymagane w trybie drużynowym',
      path: ['maxTeamSize'],
    },
  );

type SettingsFormValues = z.infer<typeof gameSettingsSchema>;

interface GameSettingsEditorProps {
  gameId: string;
  settings: GameSettings;
}

export function GameSettingsEditor({
  gameId,
  settings,
}: GameSettingsEditorProps) {
  const [editing, setEditing] = useState(false);
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
        isNarrative: settings.narrative?.isNarrative ?? false,
        theme: settings.narrative?.theme ?? '',
        prologue: settings.narrative?.prologue ?? '',
        epilogue: settings.narrative?.epilogue ?? '',
      },
    },
  });

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
          isNarrative: settings.narrative?.isNarrative ?? false,
          theme: settings.narrative?.theme ?? '',
          prologue: settings.narrative?.prologue ?? '',
          epilogue: settings.narrative?.epilogue ?? '',
        },
      });
    }
  }, [settings, editing, reset]);

  const teamMode = watch('teamMode');
  const isNarrative = watch('narrative.isNarrative');

  const mutation = useUpdateGameSettings(gameId);

  const onSubmit = (data: SettingsFormValues) => {
    const cleaned: GameSettings = {
      maxPlayers:
        data.maxPlayers === '' ? undefined : Number(data.maxPlayers),
      timeLimitMinutes:
        data.timeLimitMinutes === ''
          ? undefined
          : Number(data.timeLimitMinutes),
      allowLateJoin: data.allowLateJoin,
      allowHints: data.allowHints,
      teamMode: data.teamMode,
      minTeamSize:
        data.teamMode && data.minTeamSize !== ''
          ? Number(data.minTeamSize)
          : undefined,
      maxTeamSize:
        data.teamMode && data.maxTeamSize !== ''
          ? Number(data.maxTeamSize)
          : undefined,
      narrative: data.narrative?.isNarrative
        ? {
            isNarrative: true,
            theme: data.narrative.theme || undefined,
            prologue: data.narrative.prologue || undefined,
            epilogue: data.narrative.epilogue || undefined,
          }
        : { isNarrative: false },
    };
    mutation.mutate(cleaned as Record<string, unknown>, {
      onSuccess: () => setEditing(false),
    });
  };

  if (!editing) {
    return (
      <SettingsReadOnly
        settings={settings}
        onEdit={() => setEditing(true)}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl border border-[#FF6B35]/30 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#FF6B35] uppercase tracking-wide">
          Edycja ustawień
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setEditing(false);
            }}
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
          {mutation.error instanceof Error
            ? mutation.error.message
            : 'Błąd zapisu'}
        </div>
      )}

      <fieldset disabled={mutation.isPending}>
        <GeneralSettings register={register} errors={errors} />
        <ToggleSettings register={register} />
        {teamMode && <TeamSettings register={register} errors={errors} />}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              {...register('narrative.isNarrative')}
              type="checkbox"
              className="w-4 h-4 accent-[#FF6B35]"
            />
            <span className="text-sm text-gray-700">Tryb narracyjny</span>
          </label>
          {isNarrative && <NarrativeSettings register={register} />}
        </div>
      </fieldset>
    </form>
  );
}
