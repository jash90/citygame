import { Injectable } from '@nestjs/common';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * PHOTO verification: accept any submission carrying a non-empty imageUrl.
 * No AI evaluation — the player uploads a photo and the task is done.
 *
 * verifyConfig shape: (none required)
 * submission shape:   { imageUrl: string }
 */
@Injectable()
export class PhotoStrategy implements VerificationStrategy {
  async verify(
    _config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const imageUrl = submission['imageUrl'];

    if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      return {
        status: 'INCORRECT',
        score: 0,
        feedback: 'Nie odebrano zdjęcia',
      };
    }

    return {
      status: 'CORRECT',
      score: 1,
      feedback: 'Zdjęcie odebrane',
    };
  }
}
