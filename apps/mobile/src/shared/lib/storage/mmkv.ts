import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';
import type { Persister } from '@tanstack/react-query-persist-client';

/**
 * Single shared MMKV instance for non-secret persistent state.
 * Auth tokens stay in expo-secure-store; everything else (game state,
 * mutation queue, offline bundles, query cache) goes here.
 */
export const storage = createMMKV({ id: 'citygame.default' });

/** zustand-compatible storage adapter (sync MMKV → StateStorage shape). */
export const mmkvZustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};

/**
 * JSON replacer/reviver pair for zustand persist `createJSONStorage`.
 * Preserves Set and Map values used in `gameStore` (completedTaskIds,
 * revealedHints) — without these, persisted state would round-trip as
 * plain objects/arrays and break the store's selectors.
 */
export const richReplacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Set) return { __t: 'Set', v: Array.from(value) };
  if (value instanceof Map) return { __t: 'Map', v: Array.from(value.entries()) };
  return value;
};

export const richReviver = (_key: string, value: unknown): unknown => {
  if (
    value !== null &&
    typeof value === 'object' &&
    '__t' in (value as Record<string, unknown>)
  ) {
    const tagged = value as { __t: string; v: unknown };
    if (tagged.__t === 'Set' && Array.isArray(tagged.v)) return new Set(tagged.v);
    if (tagged.__t === 'Map' && Array.isArray(tagged.v))
      return new Map(tagged.v as [unknown, unknown][]);
  }
  return value;
};

/** React Query persister backed by MMKV. */
export const createMmkvQueryPersister = (key = 'citygame.query-cache'): Persister => ({
  persistClient: async (client) => {
    storage.set(key, JSON.stringify(client));
  },
  restoreClient: async () => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      storage.remove(key);
      return undefined;
    }
  },
  removeClient: async () => {
    storage.remove(key);
  },
});
