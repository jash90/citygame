import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { randomUUID } from 'expo-crypto';
import { mmkvZustandStorage } from '@/shared/lib/storage/mmkv';

export type MutationKind = 'submit' | 'unlock' | 'hint' | 'mediaUpload';

/**
 * One queued player mutation. `clientSubmissionId` is the idempotency key the
 * backend uses to dedupe replays — it must remain stable across retries and
 * across app restarts (this store is persisted to MMKV).
 */
export interface MutationItem {
  /** Idempotency key — sent to the server on submit/hint/unlock. */
  clientSubmissionId: string;
  kind: MutationKind;
  gameId: string;
  taskId?: string;
  /** Submission payload for `submit`; unlock payload for `unlock`; capture path for `mediaUpload`. */
  payload: Record<string, unknown>;
  /** Wall-clock timestamp at the moment the player completed the action. */
  capturedAt: string;
  attempts: number;
  status: 'pending' | 'in_flight' | 'failed' | 'done';
  lastError?: string;
  /** For `mediaUpload`: the persistent file URI. Once uploaded, `payload.fileUrl` is set. */
  mediaPath?: string;
  /** For `mediaUpload`: the resolved R2 URL after successful upload. */
  fileUrl?: string;
  /** clientSubmissionId of an item this one depends on (mediaUpload → submit). */
  dependsOn?: string;
}

interface MutationQueueState {
  items: MutationItem[];

  enqueue: (item: Omit<MutationItem, 'clientSubmissionId' | 'attempts' | 'status' | 'capturedAt'> & {
    clientSubmissionId?: string;
    capturedAt?: string;
  }) => MutationItem;

  markInFlight: (id: string) => void;
  markDone: (id: string) => void;
  markFailed: (id: string, error: string) => void;

  setMediaUploaded: (id: string, fileUrl: string) => void;
  /** Flip a downstream `submit` payload's media URL once the upload it depends on completed. */
  resolveDependency: (dependentId: string, fileUrl: string) => void;

  removeDone: () => void;
  reset: () => void;
}

export const useMutationQueue = create<MutationQueueState>()(
  persist(
    (set) => ({
      items: [],

      enqueue: (input) => {
        const item: MutationItem = {
          clientSubmissionId: input.clientSubmissionId ?? randomUUID(),
          capturedAt: input.capturedAt ?? new Date().toISOString(),
          attempts: 0,
          status: 'pending',
          ...input,
        } as MutationItem;
        set((state) => ({ items: [...state.items, item] }));
        return item;
      },

      markInFlight: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.clientSubmissionId === id
              ? { ...it, status: 'in_flight', attempts: it.attempts + 1 }
              : it,
          ),
        })),

      markDone: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.clientSubmissionId === id ? { ...it, status: 'done' } : it,
          ),
        })),

      markFailed: (id, error) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.clientSubmissionId === id
              ? { ...it, status: 'failed', lastError: error }
              : it,
          ),
        })),

      setMediaUploaded: (id, fileUrl) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.clientSubmissionId === id ? { ...it, fileUrl, status: 'done' } : it,
          ),
        })),

      resolveDependency: (dependentId, fileUrl) =>
        set((state) => ({
          items: state.items.map((it) => {
            if (it.clientSubmissionId !== dependentId) return it;
            // Submission payloads from PHOTO_AI/AUDIO_AI carry an `imageUrl` or `audioUrl` slot.
            const payload = { ...it.payload };
            if ('imageUrl' in payload || it.kind === 'submit') payload.imageUrl = fileUrl;
            return { ...it, payload };
          }),
        })),

      removeDone: () =>
        set((state) => ({
          items: state.items.filter((it) => it.status !== 'done'),
        })),

      reset: () => set({ items: [] }),
    }),
    {
      name: 'citygame.mutation-queue',
      version: 1,
      storage: createJSONStorage(() => mmkvZustandStorage),
    },
  ),
);

/** Selector: pending items in original capture order, ready to be flushed. */
export const selectPending = (state: MutationQueueState): MutationItem[] =>
  state.items.filter((it) => it.status === 'pending' || it.status === 'failed');

/** Selector: count of work waiting to sync. */
export const selectQueueDepth = (state: MutationQueueState): number =>
  selectPending(state).length;
