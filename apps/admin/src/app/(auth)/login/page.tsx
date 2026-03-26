'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuthTokens } from '@citygame/shared';

const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  password: z.string().min(1, 'Hasło jest wymagane'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const { accessToken } = await api.post<AuthTokens>('/api/auth/login', data);
      localStorage.setItem('accessToken', accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Błąd logowania',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF6B35] mb-4 shadow-lg">
            <MapPin size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CityGame Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Zaloguj się do panelu</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Root error */}
            {errors.root && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {errors.root.message}
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@citygame.pl"
                {...register('email')}
                className={`w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
                  errors.email ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Hasło
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className={`w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
                  errors.password ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6B35] text-white text-sm font-semibold rounded-xl hover:bg-[#e55a26] disabled:opacity-60 transition-colors shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Logowanie...
                </>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
