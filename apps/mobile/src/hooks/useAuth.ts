import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/api';

interface UseAuthReturn {
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login: storeLogin, logout: storeLogout } = useAuthStore();

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      await storeLogin(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Logowanie nie powiodło się.',
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.register(email, password, displayName);
      await storeLogin(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Rejestracja nie powiodła się.',
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout().catch(() => {
        // Ignore server errors on logout — still clear local state
      });
      await storeLogout();
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, error, login, register, logout };
};
