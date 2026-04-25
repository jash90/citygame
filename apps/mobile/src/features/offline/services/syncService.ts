import { storageApi } from '@/shared/services/storage.api';
import {
  selectPending,
  useMutationQueue,
  type MutationItem,
} from '@/shared/services/mutationQueue';
import { syncApi, type SyncRequestItem, type SyncResult } from './sync.api';

/**
 * Drive the offline mutation queue. Called when the app foregrounds with a
 * connection, after a successful login, and after every individual mutation
 * that landed online. Idempotent — safe to call concurrently (the in_flight
 * status acts as a cheap lock).
 */
export class SyncRunner {
  private static running = false;

  static async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.flushInner();
    } finally {
      this.running = false;
    }
  }

  private static async flushInner(): Promise<void> {
    const queue = useMutationQueue.getState();
    const pending = selectPending(queue).filter((it) => it.status !== 'in_flight');
    if (pending.length === 0) return;

    // Phase 1: media uploads. Each upload, on success, propagates fileUrl to
    // any dependent submit item still in the queue.
    const uploads = pending.filter((it) => it.kind === 'mediaUpload');
    for (const item of uploads) {
      try {
        useMutationQueue.getState().markInFlight(item.clientSubmissionId);
        const fileUrl = await uploadMedia(item);
        useMutationQueue.getState().setMediaUploaded(item.clientSubmissionId, fileUrl);
        // Look at all queue items right now (state may have changed).
        const fresh = useMutationQueue.getState().items;
        for (const dep of fresh) {
          if (dep.dependsOn === item.clientSubmissionId) {
            useMutationQueue.getState().resolveDependency(dep.clientSubmissionId, fileUrl);
          }
        }
      } catch (err) {
        useMutationQueue.getState().markFailed(
          item.clientSubmissionId,
          err instanceof Error ? err.message : 'Upload failed',
        );
      }
    }

    // Phase 2: per-game bulk sync of submit/hint/unlock items.
    const remaining = useMutationQueue.getState().items.filter(
      (it) =>
        it.kind !== 'mediaUpload' &&
        (it.status === 'pending' || it.status === 'failed') &&
        // Skip items still waiting on an unfinished media upload.
        (!it.dependsOn || isDependencyResolved(it)),
    );

    const groupedByGame = groupBy(remaining, (it) => it.gameId);

    for (const [gameId, items] of groupedByGame) {
      const requestItems: SyncRequestItem[] = items.map(toRequestItem);
      // Mark in_flight so concurrent flush() calls don't double-submit.
      for (const it of items) useMutationQueue.getState().markInFlight(it.clientSubmissionId);

      try {
        const { results } = await syncApi.flush(gameId, requestItems);
        for (const result of results) reconcileResult(result);
      } catch (err) {
        // Whole-batch failure (network, 500, etc.) — flag every item and let
        // the next flush retry. The DTO is already in the persisted queue.
        const message = err instanceof Error ? err.message : 'Sync request failed';
        for (const it of items) {
          useMutationQueue.getState().markFailed(it.clientSubmissionId, message);
        }
      }
    }

    // Phase 3: trim completed items to keep the queue bounded.
    useMutationQueue.getState().removeDone();
  }
}

function toRequestItem(item: MutationItem): SyncRequestItem {
  if (item.kind === 'mediaUpload') {
    throw new Error('mediaUpload items must not reach the bulk sync endpoint');
  }
  return {
    clientSubmissionId: item.clientSubmissionId,
    type: item.kind,
    taskId: item.taskId ?? '',
    payload: item.payload,
    capturedAt: item.capturedAt,
  };
}

function reconcileResult(result: SyncResult): void {
  if (result.ok) {
    useMutationQueue.getState().markDone(result.clientSubmissionId);
    return;
  }
  // 409 typically means the task was already completed online — treat as success.
  if (result.statusCode === 409) {
    useMutationQueue.getState().markDone(result.clientSubmissionId);
    return;
  }
  useMutationQueue.getState().markFailed(result.clientSubmissionId, result.error);
}

function isDependencyResolved(item: MutationItem): boolean {
  if (!item.dependsOn) return true;
  const queue = useMutationQueue.getState().items;
  const dep = queue.find((d) => d.clientSubmissionId === item.dependsOn);
  // If the dependency is gone (already done + trimmed) or done, we're free.
  return !dep || dep.status === 'done' || Boolean(dep.fileUrl);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

async function uploadMedia(item: MutationItem): Promise<string> {
  const path = item.mediaPath;
  if (!path) throw new Error('mediaUpload item missing mediaPath');

  const contentType = (item.payload.contentType as string | undefined) ?? 'application/octet-stream';
  const filename = (item.payload.filename as string | undefined) ?? `upload-${Date.now()}`;

  const { uploadUrl, fileUrl } = await storageApi.presign(contentType, filename);

  const fileResponse = await fetch(path);
  const blob = await fileResponse.blob();

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!putResponse.ok) {
    throw new Error(`R2 upload returned HTTP ${putResponse.status}`);
  }
  return fileUrl;
}
