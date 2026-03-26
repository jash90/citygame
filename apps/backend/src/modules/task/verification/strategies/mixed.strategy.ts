import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { VerificationService } from '../verification.service';
import {
  VerificationResult,
  VerificationStrategy,
} from './verification-strategy.interface';

/**
 * MIXED verification: sequential sub-steps each with their own verification type.
 * The player must submit answers for every step; all steps are evaluated independently.
 *
 * verifyConfig shape:
 *   { steps: Array<{ type: string; [key: string]: unknown }> }
 *
 * submission shape:
 *   { steps: Array<Record<string, unknown>> }
 */
@Injectable()
export class MixedStrategy implements VerificationStrategy {
  constructor(
    @Inject(forwardRef(() => VerificationService))
    private readonly verificationService: VerificationService,
  ) {}

  async verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const steps = config['steps'] as Array<Record<string, unknown>> | undefined;
    const stepSubmissions = submission['steps'] as
      | Array<Record<string, unknown>>
      | undefined;

    if (!steps || !stepSubmissions) {
      return {
        status: 'ERROR',
        score: 0,
        feedback: 'Invalid mixed task configuration',
      };
    }

    let totalScore = 0;
    const stepResults: Array<{
      stepIndex: number;
      status: string;
      score: number;
      feedback: string;
    }> = [];

    for (let i = 0; i < steps.length; i++) {
      const stepConfig = steps[i];
      const stepSubmission = stepSubmissions[i];

      if (!stepSubmission) {
        stepResults.push({
          stepIndex: i,
          status: 'INCORRECT',
          score: 0,
          feedback: 'Brak odpowiedzi na ten krok',
        });
        continue;
      }

      const stepType = stepConfig['type'] as string;
      const result = await this.verificationService.verifyStep(
        stepType,
        stepConfig,
        stepSubmission,
      );
      totalScore += result.score;
      stepResults.push({ stepIndex: i, ...result });
    }

    const avgScore = steps.length > 0 ? totalScore / steps.length : 0;
    const allCorrect = stepResults.every((r) => r.status === 'CORRECT');
    const anyCorrect = stepResults.some((r) => r.status === 'CORRECT');

    return {
      status: allCorrect ? 'CORRECT' : anyCorrect ? 'PARTIAL' : 'INCORRECT',
      score: avgScore,
      feedback: stepResults
        .map((r, i) => `Krok ${i + 1}: ${r.feedback}`)
        .join('\n'),
      aiResult: { stepResults },
    };
  }
}
