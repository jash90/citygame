import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS } from '@/lib/constants';
import type { User } from '@/services/api';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Actions
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: User) => void;
  login: (user: User, tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (tokens) => {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.ACCESS_TOKEN,
      tokens.accessToken,
    );
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.REFRESH_TOKEN,
      tokens.refreshToken,
    );
    set({ tokens });
  },

  setUser: (user) => {
    set({ user });
  },

  login: async (user, tokens) => {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.ACCESS_TOKEN,
      tokens.accessToken,
    );
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.REFRESH_TOKEN,
      tokens.refreshToken,
    );
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.USER,
      JSON.stringify(user),
    );
    set({ user, tokens, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  init: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.USER),
      ]);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson) as User;
        set({
          user,
          tokens: { accessToken, refreshToken },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      // If SecureStore read fails, treat as unauthenticated
      set({ isLoading: false });
    }
  },
}));
