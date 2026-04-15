import { apiClient } from './apiClient';
import type { PresignResult } from '@citygame/shared';

export const storageApi = {
  presign: (contentType: string, filename: string) =>
    apiClient.post<PresignResult>('/storage/presign', { contentType, key: filename }),
};
