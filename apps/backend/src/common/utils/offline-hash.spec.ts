import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  buildAnswerHashes,
  normalizeAnswer,
  type OfflineHashPair,
} from './offline-hash';

/**
 * These tests pin the exact wire format the mobile `verifyOffline.ts` relies on.
 * If you change the hashing convention, the offline client will silently drift —
 * update both sides together.
 */
describe('buildAnswerHashes', () => {
  it('produces a bcrypt answerHash that validates the original plaintext', async () => {
    const result = await buildAnswerHashes('Wisłok');
    expect(await bcrypt.compare('wisłok', result.answerHash)).toBe(true);
    // case + trim are normalized away
    expect(await bcrypt.compare('  WISŁOK ', result.answerHash)).toBe(false); // bcrypt sees normalized only
  });

  it('produces an offlineHash equal to sha256(normalize(plaintext) + offlineSalt)', async () => {
    const result: OfflineHashPair = await buildAnswerHashes('  Synagoga  ');
    const expected = createHash('sha256')
      .update('synagoga' + result.offlineSalt)
      .digest('hex');
    expect(result.offlineHash).toBe(expected);
  });

  it('uses a fresh, sufficiently random salt each call', async () => {
    const a = await buildAnswerHashes('zygmunt');
    const b = await buildAnswerHashes('zygmunt');
    expect(a.offlineSalt).not.toBe(b.offlineSalt);
    // 16 bytes hex = 32 chars
    expect(a.offlineSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(a.offlineHash).not.toBe(b.offlineHash); // identical input + different salt → different hash
  });

  it('verification round-trip works with any normalised variant of the plaintext', async () => {
    const { offlineHash, offlineSalt } = await buildAnswerHashes('Zapiekanka');

    const verify = (input: string): boolean => {
      const normalised = normalizeAnswer(input);
      const actual = createHash('sha256').update(normalised + offlineSalt).digest('hex');
      return actual === offlineHash;
    };

    expect(verify('zapiekanka')).toBe(true);
    expect(verify('  ZAPIEKANKA ')).toBe(true);
    expect(verify('zapiekane')).toBe(false);
  });
});
