import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * TEXT_EXACT verification: compare normalised answer against a bcrypt hash
 * stored in verifyConfig to avoid leaking answers in the database.
 *
 * verifyConfig shape: { answerHash: string } — bcrypt hash of the lowercased, trimmed answer
 * submission shape:   { answer: string }
 */
@Injectable()
export class TextExactStrategy implements VerificationStrategy {
  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const answerHash = config['answerHash'] as string | undefined;
    const rawAnswer = submission['answer'] as string | undefined;

    if (!answerHash || !rawAnswer) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: 'Missing answer or configuration',
      };
    }

    const normalised = rawAnswer.trim().toLowerCase();
    const isCorrect = await bcrypt.compare(normalised, answerHash);

    if (isCorrect) {
      return { status: 'CORRECT', score: 1.0, feedback: 'Correct answer!' };
    }

    return { status: 'INCORRECT', score: 0, feedback: 'Incorrect answer, try again' };
  }
}
