import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvZustandStorage } from '@/shared/lib/storage/mmkv';
import type { RankingEntry } from '@/shared/types/api.types';

interface RankingState {
  entries: RankingEntry[];
  isLive: boolean;
  lastUpdatedAt: Date | null;
  // Actions
  setRanking: (entries: RankingEntry[]) => void;
  updateRanking: (updatedEntries: RankingEntry[]) => void;
  setLive: (live: boolean) => void;
  reset: () => void;
}

export const useRankingStore = create<RankingState>()(
  persist(
    (set) => ({
      entries: [],
      isLive: false,
      lastUpdatedAt: null,

  setRanking: (entries) =>
    set({ entries, lastUpdatedAt: new Date() }),

  // Merge incoming updates preserving entries not in update
  updateRanking: (updatedEntries) =>
    set((state) => {
      if (!Array.isArray(updatedEntries)) return state;
      const updatedMap = new Map(
        updatedEntries.map((e) => [e.userId, e]),
      );
      const merged = state.entries.map((entry) =>
        updatedMap.has(entry.userId)
          ? (updatedMap.get(entry.userId) as RankingEntry)
          : entry,
      );
      // Add any new entries not previously in the list
      updatedEntries.forEach((entry) => {
        if (!state.entries.find((e) => e.userId === entry.userId)) {
          merged.push(entry);
        }
      });
      // Re-sort by points descending
      merged.sort((a, b) => b.totalPoints - a.totalPoints);
      // Re-assign ranks
      merged.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      return { entries: merged, lastUpdatedAt: new Date() };
    }),

  setLive: (live) => set({ isLive: live }),

  reset: () => set({ entries: [], isLive: false, lastUpdatedAt: null }),
    }),
    {
      name: 'citygame.ranking-store',
      version: 1,
      storage: createJSONStorage(() => mmkvZustandStorage),
      // `isLive` reflects current socket connectivity — never persist it.
      partialize: (state) => ({
        entries: state.entries,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.lastUpdatedAt && typeof state.lastUpdatedAt === 'string') {
          state.lastUpdatedAt = new Date(state.lastUpdatedAt);
        }
      },
    },
  ),
);
