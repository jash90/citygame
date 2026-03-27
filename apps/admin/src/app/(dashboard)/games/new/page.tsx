'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { CreateGameDto, Game } from '@citygame/shared';

const createGameSchema = z.object({
  title: z.string().min(3, 'Tytuł musi mieć min. 3 znaki').max(120, 'Tytuł może mieć maks. 120 znaków'),
  description: z.string().min(10, 'Opis musi mieć min. 10 znaków'),
  city: z.string().min(2, 'Miasto musi mieć min. 2 znaki').max(80, 'Miasto może mieć maks. 80 znaków'),
  coverImageUrl: z.string().url('Nieprawidłowy URL').optional().or(z.literal('')),
  settings: z.object({
    maxPlayers: z.coerce.number().min(1, 'Min. 1 gracz').max(200, 'Maks. 200 graczy').optional(),
    timeLimitMinutes: z.coerce.number().min(5, 'Min. 5 minut').max(1440, 'Maks. 1440 minut (24h)').optional(),
    allowLateJoin: z.boolean().optional(),
  }),
});

type CreateGameFormValues = z.infer<typeof createGameSchema>;

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

export default function NewGamePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGameFormValues>({
    resolver: zodResolver(createGameSchema),
    defaultValues: {
      settings: { allowLateJoin: true },
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateGameDto) => api.post<Game>('/api/admin/games', data),
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['admin-games'] });
      router.push(`/games/${game.id}`);
    },
  });

  const onSubmit = (data: CreateGameFormValues) => {
    const dto: CreateGameDto = {
      title: data.title,
      description: data.description,
      city: data.city,
      coverImageUrl: data.coverImageUrl || undefined,
      settings: {
        maxPlayers: data.settings.maxPlayers,
        timeLimitMinutes: data.settings.timeLimitMinutes,
        allowLateJoin: data.settings.allowLateJoin,
      },
    };
    createMutation.mutate(dto);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/games"
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Powrót do gier
      </Link>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Nowa gra</h2>
        <p className="text-gray-500 text-sm mt-1">Utwórz nową grę miejską</p>
      </div>

      {createMutation.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : 'Błąd tworzenia gry'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Podstawowe informacje
          </h3>

          <Field label="Tytuł gry" error={errors.title?.message}>
            <input
              {...register('title')}
              placeholder="np. Śladami historii Krakowa"
              className={inputClass(errors.title?.message)}
            />
          </Field>

          <Field label="Opis" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Opisz grę dla graczy..."
              className={`${inputClass(errors.description?.message)} resize-none`}
            />
          </Field>

          <Field label="Miasto" error={errors.city?.message}>
            <input
              {...register('city')}
              placeholder="np. Kraków"
              className={inputClass(errors.city?.message)}
            />
          </Field>

          <Field
            label="URL okładki"
            error={errors.coverImageUrl?.message}
            hint="Opcjonalny link do zdjęcia okładki gry"
          >
            <input
              {...register('coverImageUrl')}
              type="url"
              placeholder="https://..."
              className={inputClass(errors.coverImageUrl?.message)}
            />
          </Field>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Ustawienia gry
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Maks. gracze"
              error={errors.settings?.maxPlayers?.message}
              hint="Pozostaw puste = bez limitu"
            >
              <input
                {...register('settings.maxPlayers')}
                type="number"
                min={1}
                placeholder="Brak limitu"
                className={inputClass(errors.settings?.maxPlayers?.message)}
              />
            </Field>

            <Field
              label="Limit czasu (min)"
              error={errors.settings?.timeLimitMinutes?.message}
              hint="Pozostaw puste = bez limitu"
            >
              <input
                {...register('settings.timeLimitMinutes')}
                type="number"
                min={1}
                placeholder="Brak limitu"
                className={inputClass(errors.settings?.timeLimitMinutes?.message)}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <input
              {...register('settings.allowLateJoin')}
              id="allowLateJoin"
              type="checkbox"
              className="w-4 h-4 accent-[#FF6B35] cursor-pointer"
            />
            <label
              htmlFor="allowLateJoin"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Zezwól na dołączanie po starcie gry
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 justify-end">
          <Link
            href="/games"
            className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-lg hover:bg-[#e55a26] disabled:opacity-60 transition-colors shadow-sm"
          >
            {createMutation.isPending && (
              <Loader2 size={16} className="animate-spin" />
            )}
            Utwórz grę
          </button>
        </div>
      </form>
    </div>
  );
}
