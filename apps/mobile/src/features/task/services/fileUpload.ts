import { storageApi } from '@/shared/services/storage.api';

type AiStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface UploadState {
  aiStatus: AiStatus;
  uploadProgress: number;
  setAiStatus: (s: AiStatus) => void;
  setUploadProgress: (p: number) => void;
}

/**
 * Upload a file to R2 storage via pre-signed URL.
 * Encapsulates all fetch logic — components call this instead of raw fetch.
 */
export async function uploadFileToR2(
  uri: string,
  contentType: string,
  filename: string,
  uploadState: UploadState,
): Promise<string> {
  const { setAiStatus, setUploadProgress } = uploadState;
  setAiStatus('uploading');
  setUploadProgress(0);

  const { uploadUrl, fileUrl } = await storageApi.presign(contentType, filename);

  // Use platform fetch for file blob creation (React Native specific)
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();

  setUploadProgress(40);

  // Direct PUT to pre-signed URL — this is a raw storage upload, not an API call
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });

  setUploadProgress(100);
  setAiStatus('processing');
  return fileUrl;
}
