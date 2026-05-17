import { Injectable } from '@nestjs/common';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

const MIN_DESCRIPTION_LENGTH = 10;

/**
 * PRACTICAL verification: defers scoring to a human mentor.
 *
 * Returns PENDING so the caller records a TaskAttempt in PENDING state without
 * awarding points or advancing the session. The mentor later reviews the
 * submission via the mentor module and finalises the attempt.
 *
 * verifyConfig shape: { criteria?: string }   // human-readable rubric, shown to mentor
 * submission shape:   { description: string } // player's free-text account of what they did
 */
@Injectable()
export class PracticalStrategy implements VerificationStrategy {
  async verify(
    _config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const description = submission['description'];

    if (
      typeof description !== 'string' ||
      description.trim().length < MIN_DESCRIPTION_LENGTH
    ) {
      return {
        status: 'INCORRECT',
        score: 0,
        feedback: `Opis wykonania musi mieć co najmniej ${MIN_DESCRIPTION_LENGTH} znaków`,
      };
    }

    return {
      status: 'PENDING',
      score: 0,
      feedback: 'Oczekuje na akceptację mentora',
    };
  }
}
