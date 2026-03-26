import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * TEXT_AI verification: evaluate a free-text player answer using Claude.
 *
 * verifyConfig shape: { prompt: string; threshold?: number }
 * submission shape:   { answer: string }
 */
@Injectable()
export class TextAiStrategy implements VerificationStrategy {
  constructor(private readonly aiService: AiService) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const answer = submission['answer'] as string | undefined;
    const prompt = (config['prompt'] as string | undefined) ?? 'Evaluate the answer';
    const threshold = (config['threshold'] as number | undefined) ?? 0.7;

    if (!answer) {
      return { status: 'INCORRECT', score: 0, feedback: 'Brak odpowiedzi' };
    }

    const result = await this.aiService.evaluateText(answer, prompt, threshold);

    return {
      status: result.score >= threshold ? 'CORRECT' : result.score > 0 ? 'PARTIAL' : 'INCORRECT',
      score: result.score,
      feedback: result.feedback,
      aiResult: result,
    };
  }
}
