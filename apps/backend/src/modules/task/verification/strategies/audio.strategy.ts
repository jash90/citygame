import { Injectable } from '@nestjs/common';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * AUDIO verification: accept any submission carrying a non-empty audioUrl.
 * No AI evaluation — the player uploads a recording and the task is done.
 *
 * verifyConfig shape: (none required)
 * submission shape:   { audioUrl: string }
 */
@Injectable()
export class AudioStrategy implements VerificationStrategy {
  async verify(
    _config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const audioUrl = submission['audioUrl'];

    if (typeof audioUrl !== 'string' || audioUrl.trim().length === 0) {
      return {
        status: 'INCORRECT',
        score: 0,
        feedback: 'Nie odebrano nagrania audio',
      };
    }

    return {
      status: 'CORRECT',
      score: 1,
      feedback: 'Nagranie odebrane',
    };
  }
}
