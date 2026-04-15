import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS } from '@/shared/lib/constants';
import type { User } from '@/shared/types/api.types';
import type { UserProfile } from '@citygame/shared';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: UserProfile | null;
  // Actions
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: User) => void;
  setProfile: (profile: UserProfile) => Promise<void>;
  login: (user: User, tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  profile: null,
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

  setProfile: async (profile) => {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.PROFILE,
      JSON.stringify(profile),
    );
    set({ profile });
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
    // Save user data as initial profile so email/name are available immediately
    const initialProfile: UserProfile = {
      ...user,
      stats: { gamesPlayed: 0, totalPoints: 0, completedTasks: 0, rank: 0 },
    };
    await SecureStore.setItemAsync(
      SECURE_STORE_KEYS.PROFILE,
      JSON.stringify(initialProfile),
    );
    set({ user, tokens, profile: initialProfile, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER);
    await SecureStore.deleteItemAsync(SECURE_STORE_KEYS.PROFILE);
    set({ user: null, tokens: null, profile: null, isAuthenticated: false });
  },

  init: async () => {
    try {
      const [accessToken, refreshToken, userJson, profileJson] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.USER),
        SecureStore.getItemAsync(SECURE_STORE_KEYS.PROFILE),
      ]);

      if (accessToken && refreshToken && userJson) {
        const user = JSON.parse(userJson) as User;
        const profile = profileJson ? JSON.parse(profileJson) as UserProfile : null;
        set({
          user,
          tokens: { accessToken, refreshToken },
          profile,
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
