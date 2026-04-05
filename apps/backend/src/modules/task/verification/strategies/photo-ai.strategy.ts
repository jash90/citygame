import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { StorageService } from '../../../storage/storage.service';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * PHOTO_AI verification: evaluate a player-submitted photo using Claude Vision.
 *
 * verifyConfig shape: { prompt: string; threshold?: number }
 * submission shape:   { imageUrl: string }
 */
@Injectable()
export class PhotoAiStrategy implements VerificationStrategy {
  constructor(
    private readonly aiService: AiService,
    private readonly storageService: StorageService,
  ) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const imageUrl = submission['imageUrl'] as string | undefined;
    const prompt = (config['prompt'] as string | undefined) ?? 'Evaluate the submitted photo';
    const threshold = (config['threshold'] as number | undefined) ?? 0.7;

    if (!imageUrl) {
      return { status: 'INCORRECT', score: 0, feedback: 'No photo provided' };
    }

    const result = await this.aiService.evaluatePhoto(imageUrl, prompt, threshold);

    return {
      status: result.score >= threshold ? 'CORRECT' : result.score > 0 ? 'PARTIAL' : 'INCORRECT',
      score: result.score,
      feedback: result.feedback,
      aiResult: result,
    };
  }
}
