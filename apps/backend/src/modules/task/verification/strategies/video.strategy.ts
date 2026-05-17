import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { verifyMediaQuizAnswer } from './media-quiz.shared';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * VIDEO verification: media-quiz format. Admin attaches a video clip
 * (config.videoUrl) and the player watches then types a text answer.
 *
 * Verification mode is chosen per-task in config.mode:
 *   - EXACT (default): compare against config.expectedAnswer
 *   - AI:              evaluate against config.prompt with config.threshold
 *
 * verifyConfig shape: {
 *   videoUrl: string,
 *   mode: 'EXACT' | 'AI',
 *   expectedAnswer?: string,
 *   prompt?: string,
 *   threshold?: number
 * }
 * submission shape:   { answer: string }
 */
@Injectable()
export class VideoStrategy implements VerificationStrategy {
  constructor(private readonly aiService: AiService) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    return verifyMediaQuizAnswer(config, submission, this.aiService);
  }
}
