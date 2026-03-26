import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * CIPHER verification: compare a bcrypt-hashed answer against the player's input.
 * Optionally returns a cipher hint in the feedback when the answer is incorrect.
 *
 * verifyConfig shape: { answerHash: string; cipherHint?: string }
 * submission shape:   { answer: string }
 */
@Injectable()
export class CipherStrategy implements VerificationStrategy {
  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const answerHash = config['answerHash'] as string | undefined;
    const cipherHint = config['cipherHint'] as string | undefined;
    const rawAnswer = submission['answer'] as string | undefined;

    if (!answerHash || !rawAnswer) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: 'Brak odpowiedzi lub konfiguracji',
      };
    }

    const normalised = rawAnswer.trim().toLowerCase();
    const isCorrect = await bcrypt.compare(normalised, answerHash);

    if (isCorrect) {
      return { status: 'CORRECT', score: 1.0, feedback: 'Szyfr rozszyfrowany!' };
    }

    const feedback = cipherHint
      ? `Nieprawidłowa odpowiedź. Wskazówka: ${cipherHint}`
      : 'Nieprawidłowa odpowiedź, spróbuj ponownie';

    return { status: 'INCORRECT', score: 0, feedback };
  }
}
