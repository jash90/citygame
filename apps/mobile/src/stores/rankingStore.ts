import { create } from 'zustand';
import type { RankingEntry } from '@/services/api';

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

export const useRankingStore = create<RankingState>((set) => ({
  entries: [],
  isLive: false,
  lastUpdatedAt: null,

  setRanking: (entries) =>
    set({ entries, lastUpdatedAt: new Date() }),

  // Merge incoming updates preserving entries not in update
  updateRanking: (updatedEntries) =>
    set((state) => {
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
      merged.sort((a, b) => b.points - a.points);
      // Re-assign ranks
      merged.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      return { entries: merged, lastUpdatedAt: new Date() };
    }),

  setLive: (live) => set({ isLive: live }),

  reset: () => set({ entries: [], isLive: false, lastUpdatedAt: null }),
}));
