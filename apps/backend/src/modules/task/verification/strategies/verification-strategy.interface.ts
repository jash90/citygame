export interface VerificationResult {
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'ERROR';
  /** Score as a fraction of maxPoints, 0.0 – 1.0 */
  score: number;
  feedback: string;
  /** Raw AI evaluation result, present for AI-based task types */
  aiResult?: unknown;
}

export interface VerificationStrategy {
  verify(
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult>;
}
