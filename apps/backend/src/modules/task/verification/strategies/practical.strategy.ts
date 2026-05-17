import { Injectable } from '@nestjs/common';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * PRACTICAL verification: always defers to a human mentor.
 *
 * The player completes a physical activity at a mentor station (push-ups,
 * shooting range, etc.) and the app just registers an approval request.
 * No submission payload is required — the act of submitting is the request.
 *
 * verifyConfig shape: { criteria?: string }   // human-readable rubric shown to mentor
 * submission shape:   { } | { requestedAt?: string }
 */
@Injectable()
export class PracticalStrategy implements VerificationStrategy {
  async verify(
    _config: Record<string, unknown>,
    _submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    return {
      status: 'PENDING',
      score: 0,
      feedback: 'Oczekuje na zatwierdzenie przez mentora',
    };
  }
}

/**
 * Normalise the submission payload before persistence so the database always
 * stores `{ requestedAt: <ISO> }` regardless of what the client sent. Called
 * from player-task.service for PRACTICAL tasks (no other type needs this).
 */
export function normalisePracticalSubmission(): { requestedAt: string } {
  return { requestedAt: new Date().toISOString() };
}
