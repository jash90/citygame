import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import { verifyMediaQuizAnswer } from './media-quiz.shared';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * AUDIO verification: media-quiz format. Admin attaches an audio clip
 * (config.audioUrl) and the player listens then types a text answer.
 *
 * Verification mode is chosen per-task in config.mode:
 *   - EXACT (default): compare against config.expectedAnswer
 *   - AI:              evaluate against config.prompt with config.threshold
 *
 * verifyConfig shape: {
 *   audioUrl: string,
 *   mode: 'EXACT' | 'AI',
 *   expectedAnswer?: string,
 *   prompt?: string,
 *   threshold?: number
 * }
 * submission shape:   { answer: string }
 */
@Injectable()
export class AudioStrategy implements VerificationStrategy {
  constructor(private readonly aiService: AiService) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    return verifyMediaQuizAnswer(config, submission, this.aiService);
  }
}
