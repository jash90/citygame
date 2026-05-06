import { createHash } from 'crypto';
import { buildAnswerHashes } from '../../common/utils/offline-hash';

type ConfigRecord = Record<string, unknown>;

const TEXT_TYPES = new Set(['TEXT_EXACT', 'CIPHER']);
const PASSTHROUGH_KEYS = ['radiusMeters', 'latitude', 'longitude', 'prompt', 'threshold', 'cipherHint'] as const;

/**
 * Hashes plaintext answer fields submitted by the admin form into the storage
 * shape the verifier strategies expect. Mirrors the blueprint persistence
 * flow so plaintext never leaves the request boundary:
 *
 * - QR_SCAN: `expectedAnswer` (plaintext QR content) → `expectedHash` ("sha256:<hex>")
 * - TEXT_EXACT / CIPHER: `expectedAnswer` (plaintext, normalized) → `answerHash` (bcrypt)
 * - MIXED: recurses into every step, aligning by index with the previous
 *   config so an empty `expectedAnswer` on update preserves the old hash.
 *
 * Other verify types (GPS_REACH, *_AI) pass through unchanged.
 */
export async function transformVerifyConfig(
  next: ConfigRecord,
  previous?: ConfigRecord,
): Promise<ConfigRecord> {
  const type = next.type;

  if (type === 'MIXED') {
    const newSteps = (next.steps as ConfigRecord[] | undefined) ?? [];
    const oldSteps =
      previous?.type === 'MIXED'
        ? ((previous.steps as ConfigRecord[] | undefined) ?? [])
        : [];
    const transformed = await Promise.all(
      newSteps.map((step, i) => transformVerifyConfig(step, oldSteps[i])),
    );
    return { type: 'MIXED', steps: transformed };
  }

  if (type === 'QR_SCAN') {
    const plaintext = stringValue(next.expectedAnswer)?.trim();
    if (plaintext) {
      const hex = createHash('sha256').update(plaintext).digest('hex');
      // Persist the plaintext alongside the hash so admins can see/print the
      // QR sticker text. The offline-bundle sanitizer uses an explicit
      // allow-list and never copies `expectedAnswer` into the player bundle,
      // so this stays admin-only.
      return {
        type: 'QR_SCAN',
        expectedHash: `sha256:${hex}`,
        expectedAnswer: plaintext,
      };
    }
    if (previous?.type === 'QR_SCAN') {
      const previousHash = stringValue(previous.expectedHash);
      const previousPlaintext = stringValue(previous.expectedAnswer);
      if (previousHash) {
        return {
          type: 'QR_SCAN',
          expectedHash: previousHash,
          ...(previousPlaintext ? { expectedAnswer: previousPlaintext } : {}),
        };
      }
    }
    // Fallback: caller may have sent the hash directly (legacy / blueprint path).
    return { type: 'QR_SCAN', expectedHash: stringValue(next.expectedHash) ?? '' };
  }

  if (typeof type === 'string' && TEXT_TYPES.has(type)) {
    const plaintext = stringValue(next.expectedAnswer)?.trim();
    const out: ConfigRecord = { type };
    if (plaintext) {
      // Use the shared helper so manual-editor tasks get the same triple
      // (answerHash + offlineHash + offlineSalt) as blueprint-generated ones,
      // which is what the offline mobile bundle expects.
      const hashes = await buildAnswerHashes(plaintext);
      out.answerHash = hashes.answerHash;
      out.offlineHash = hashes.offlineHash;
      out.offlineSalt = hashes.offlineSalt;
      // Plaintext kept for admin-only reads; stripped from the offline bundle.
      out.expectedAnswer = plaintext;
    } else if (previous?.type === type) {
      // Preserve the existing triple + plaintext verbatim so we don't break
      // offline verification by losing the previously-paired salt.
      const previousAnswerHash = stringValue(previous.answerHash);
      if (previousAnswerHash) out.answerHash = previousAnswerHash;
      const previousOfflineHash = stringValue(previous.offlineHash);
      if (previousOfflineHash) out.offlineHash = previousOfflineHash;
      const previousOfflineSalt = stringValue(previous.offlineSalt);
      if (previousOfflineSalt) out.offlineSalt = previousOfflineSalt;
      const previousPlaintext = stringValue(previous.expectedAnswer);
      if (previousPlaintext) out.expectedAnswer = previousPlaintext;
    } else {
      out.answerHash = stringValue(next.answerHash) ?? '';
    }
    if (type === 'CIPHER') {
      const hint = stringValue(next.cipherHint);
      if (hint) out.cipherHint = hint;
    }
    return out;
  }

  // GPS_REACH, PHOTO_AI, TEXT_AI, AUDIO_AI — copy through with the keys
  // those strategies expect. Drops accidental `expectedAnswer` if present.
  const passthrough: ConfigRecord = { type };
  for (const key of PASSTHROUGH_KEYS) {
    if (next[key] !== undefined) passthrough[key] = next[key];
  }
  return passthrough;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
