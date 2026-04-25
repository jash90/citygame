import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

export interface OfflineHashPair {
  /** bcrypt of the normalized plaintext — primary check used by backend strategies. */
  answerHash: string;
  /** sha256(normalized + salt) — fast offline verification, never leaks plaintext. */
  offlineHash: string;
  /** 16-byte random salt unique to this task. */
  offlineSalt: string;
}

/** Trim + lowercase, matching the normalization performed by every text strategy. */
export function normalizeAnswer(plaintext: string): string {
  return plaintext.trim().toLowerCase();
}

/**
 * Compute the offline-friendly hash for a given plaintext answer.
 * Used at task creation/update time and by seeders.
 */
export async function buildAnswerHashes(plaintext: string): Promise<OfflineHashPair> {
  const normalized = normalizeAnswer(plaintext);
  const offlineSalt = randomBytes(16).toString('hex');
  const offlineHash = createHash('sha256')
    .update(normalized + offlineSalt)
    .digest('hex');
  const answerHash = await bcrypt.hash(normalized, 10);
  return { answerHash, offlineHash, offlineSalt };
}
