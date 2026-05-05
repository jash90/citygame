import { useMemo } from 'react';
import {
  useMutationQueue,
  type MutationItem,
} from '@/shared/services/mutationQueue';

/**
 * Returns the set of task IDs (within the given gameId) that have a `submit`
 * mutation still waiting in the offline queue — i.e. the player has answered
 * the task locally but the server hasn't acknowledged the answer yet.
 *
 * Used by the Zadania list to render those tasks with a distinct
 * "completed-but-not-synced" style instead of the regular green checkmark,
 * so the player can tell which of their completions still need an internet
 * connection to count toward the leaderboard.
 */
export const usePendingTaskIds = (gameId: string | undefined): Set<string> => {
  const items = useMutationQueue((s) => s.items);

  return useMemo(() => {
    if (!gameId) return new Set<string>();
    const pending = new Set<string>();
    for (const item of items) {
      if (!isPendingSubmit(item, gameId)) continue;
      if (item.taskId) pending.add(item.taskId);
    }
    return pending;
  }, [items, gameId]);
};

function isPendingSubmit(item: MutationItem, gameId: string): boolean {
  if (item.kind !== 'submit') return false;
  if (item.gameId !== gameId) return false;
  // `done` items have already reconciled with the server — not pending.
  return (
    item.status === 'pending' ||
    item.status === 'in_flight' ||
    item.status === 'failed'
  );
}
