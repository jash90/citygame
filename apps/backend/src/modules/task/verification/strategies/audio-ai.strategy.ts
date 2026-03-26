import { Injectable } from '@nestjs/common';
import { AiService } from '../../../ai/ai.service';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * AUDIO_AI verification: evaluate an audio submission (via transcription) using Claude.
 *
 * verifyConfig shape: { prompt: string; threshold?: number }
 * submission shape:   { transcription: string } (audioUrl reserved for future direct evaluation)
 */
@Injectable()
export class AudioAiStrategy implements VerificationStrategy {
  constructor(private readonly aiService: AiService) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const transcription = submission['transcription'] as string | undefined;
    const prompt = (config['prompt'] as string | undefined) ?? 'Evaluate the audio response';
    const threshold = (config['threshold'] as number | undefined) ?? 0.7;

    if (!transcription) {
      return { status: 'INCORRECT', score: 0, feedback: 'Brak transkrypcji nagrania' };
    }

    const result = await this.aiService.evaluateAudio(transcription, prompt, threshold);

    return {
      status: result.score >= threshold ? 'CORRECT' : result.score > 0 ? 'PARTIAL' : 'INCORRECT',
      score: result.score,
      feedback: result.feedback,
      aiResult: result,
    };
  }
}
