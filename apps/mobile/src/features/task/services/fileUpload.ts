import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { storageApi } from '@/shared/services/storage.api';
import { useMutationQueue } from '@/shared/services/mutationQueue';
import { NetworkError } from '@/shared/services/apiClient';
import { persistCapture } from '@/features/task/services/persistentCapture';

type AiStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error' | 'queued';

export interface UploadState {
  aiStatus: AiStatus;
  uploadProgress: number;
  setAiStatus: (s: AiStatus) => void;
  setUploadProgress: (p: number) => void;
}

export type UploadOutcome =
  | { kind: 'uploaded'; fileUrl: string }
  /** Offline at capture time — file persisted, mediaUpload enqueued for sync. */
  | { kind: 'queued'; mediaClientId: string; localPath: string };

/**
 * Upload a captured asset to R2 via a presigned URL, with graceful fallback
 * to the offline mutation queue when there's no connection.
 *
 * The temp `uri` from expo-camera/expo-av is first copied into the persistent
 * `captures/` dir so a backgrounding/kill doesn't erase the user's work; the
 * returned `localPath` (in the `queued` case) is what the sync runner will
 * later open and PUT to R2.
 */
export async function uploadFileToR2(
  uri: string,
  contentType: string,
  filename: string,
  uploadState: UploadState,
): Promise<UploadOutcome> {
  const { setAiStatus, setUploadProgress } = uploadState;

  // First, copy out of the volatile temp dir. This must happen even online
  // so a slow upload that's interrupted can be retried.
  const extension = filename.split('.').pop() ?? 'bin';
  const localPath = await persistCapture(uri, extension);

  setAiStatus('uploading');
  setUploadProgress(0);

  // Quick connectivity probe before we burn the presign roundtrip.
  const net = await NetInfo.fetch();
  const probablyOffline = net.isConnected === false || net.isInternetReachable === false;

  if (probablyOffline) {
    return enqueueMediaUpload(localPath, contentType, filename, setAiStatus);
  }

  try {
    const { uploadUrl, fileUrl } = await storageApi.presign(contentType, filename);

    setUploadProgress(40);

    const fileResponse = await fetch(localPath);
    const blob = await fileResponse.blob();

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });
    if (!putResponse.ok) {
      throw new Error(`R2 upload returned HTTP ${putResponse.status}`);
    }

    setUploadProgress(100);
    setAiStatus('processing');
    return { kind: 'uploaded', fileUrl };
  } catch (err) {
    // Either the presign call failed or the PUT failed. If it looks like a
    // network problem, fall back to the queue so we don't lose the capture.
    const looksOffline =
      err instanceof NetworkError ||
      (err instanceof TypeError && /network/i.test(err.message));
    if (looksOffline) {
      return enqueueMediaUpload(localPath, contentType, filename, setAiStatus);
    }
    setAiStatus('error');
    throw err;
  }
}

function enqueueMediaUpload(
  localPath: string,
  contentType: string,
  filename: string,
  setAiStatus: (s: AiStatus) => void,
): UploadOutcome {
  const mediaClientId = randomUUID();
  // The submit that depends on this upload is enqueued by `useSubmitTask`
  // (via the `_dependsOn` smuggle field on the submission). Here we record
  // only the upload itself.
  useMutationQueue.getState().enqueue({
    kind: 'mediaUpload',
    gameId: '__media__', // not bound to a single game; surface info only
    payload: { contentType, filename },
    mediaPath: localPath,
    clientSubmissionId: mediaClientId,
  });
  setAiStatus('queued');
  return { kind: 'queued', mediaClientId, localPath };
}
