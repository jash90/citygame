import { AiService } from '../../../ai/ai.service';
import { VerificationResult } from './verification-strategy.interface';

/**
 * Shared verifier for AUDIO / PHOTO / VIDEO tasks:
 * - Admin attaches a media file (audioUrl / imageUrl / videoUrl in config).
 * - Player consumes the media, types a text answer.
 * - Backend verifies the answer in one of two modes:
 *
 *   • EXACT — plain-string compare against config.expectedAnswer
 *     (trim+lowercase normalised). No bcrypt: media-quiz answers aren't
 *     secrets, and round-tripping them through hashing complicates the
 *     admin UX (admin would need to re-type the answer on every edit).
 *
 *   • AI    — config.prompt + threshold are forwarded to AiService.evaluateText,
 *     same shape as TEXT_AI.
 */
export async function verifyMediaQuizAnswer(
  config: Record<string, unknown>,
  submission: Record<string, unknown>,
  aiService: AiService,
): Promise<VerificationResult> {
  const answer = submission['answer'];
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    return {
      status: 'INCORRECT',
      score: 0,
      feedback: 'Brak odpowiedzi',
    };
  }

  const mode = (config['mode'] as string | undefined) ?? 'EXACT';

  if (mode === 'AI') {
    const prompt =
      (config['prompt'] as string | undefined) ?? 'Evaluate the answer';
    const threshold = (config['threshold'] as number | undefined) ?? 0.7;
    const result = await aiService.evaluateText(answer, prompt, threshold);
    if (result.unavailable) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: result.feedback,
        aiResult: result,
      };
    }
    return {
      status:
        result.score >= threshold
          ? 'CORRECT'
          : result.score > 0
            ? 'PARTIAL'
            : 'INCORRECT',
      score: result.score,
      feedback: result.feedback,
      aiResult: result,
    };
  }

  // EXACT mode
  const expected = config['expectedAnswer'];
  if (typeof expected !== 'string' || expected.trim().length === 0) {
    return {
      status: 'ERROR',
      score: 0,
      feedback: 'Zadanie nie ma skonfigurowanej odpowiedzi',
    };
  }

  const normalisedAnswer = answer.trim().toLowerCase();
  const normalisedExpected = expected.trim().toLowerCase();

  if (normalisedAnswer === normalisedExpected) {
    return { status: 'CORRECT', score: 1, feedback: 'Poprawna odpowiedź!' };
  }

  return {
    status: 'INCORRECT',
    score: 0,
    feedback: 'Błędna odpowiedź — spróbuj ponownie',
  };
}
