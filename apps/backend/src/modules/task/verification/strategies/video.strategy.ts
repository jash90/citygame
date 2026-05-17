import { Injectable } from '@nestjs/common';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * VIDEO verification: accept any submission carrying a non-empty videoUrl.
 * No AI evaluation — the player uploads a recording and the task is done.
 *
 * verifyConfig shape: (none required)
 * submission shape:   { videoUrl: string }
 */
@Injectable()
export class VideoStrategy implements VerificationStrategy {
  async verify(
    _config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const videoUrl = submission['videoUrl'];

    if (typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
      return {
        status: 'INCORRECT',
        score: 0,
        feedback: 'Nie odebrano nagrania wideo',
      };
    }

    return {
      status: 'CORRECT',
      score: 1,
      feedback: 'Nagranie odebrane',
    };
  }
}
