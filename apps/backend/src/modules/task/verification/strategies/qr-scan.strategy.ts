import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * QR_SCAN verification: compare the SHA-256 hash of the scanned code
 * against the expected hash stored in verifyConfig.
 *
 * verifyConfig shape: { expectedHash: string } — "sha256:<hex>"
 * submission shape:   { code: string }
 */
@Injectable()
export class QrScanStrategy implements VerificationStrategy {
  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const expectedHash = config['expectedHash'] as string | undefined;
    const code = submission['code'] as string | undefined;

    if (!expectedHash || !code) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: 'Missing QR code or expected hash configuration',
      };
    }

    const actualHash = `sha256:${createHash('sha256').update(code).digest('hex')}`;

    if (actualHash === expectedHash) {
      return { status: 'CORRECT', score: 1.0, feedback: 'QR code verified!' };
    }

    return { status: 'INCORRECT', score: 0, feedback: 'QR code does not match' };
  }
}
