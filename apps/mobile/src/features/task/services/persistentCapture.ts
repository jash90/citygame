import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';

const CAPTURES_DIR = `${FileSystem.documentDirectory}captures/`;

async function ensureCapturesDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CAPTURES_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CAPTURES_DIR, { intermediates: true });
  }
}

/**
 * Move a freshly captured file out of the camera/audio temp dir into the
 * persistent app-private directory. expo-camera and expo-av both write to
 * paths the OS may purge under storage pressure or app kills; copying here
 * guarantees we still have the bytes when the network returns.
 *
 * Returns the new local file URI.
 */
export async function persistCapture(
  sourceUri: string,
  extension: string,
): Promise<string> {
  await ensureCapturesDir();
  const filename = `${randomUUID()}.${extension}`;
  const target = `${CAPTURES_DIR}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  // Best-effort cleanup of the temp source — failure here is fine.
  await FileSystem.deleteAsync(sourceUri, { idempotent: true }).catch(() => undefined);
  return target;
}

export const persistentCapturesDir = CAPTURES_DIR;
