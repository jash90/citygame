export interface VerificationResult {
  /**
   * Terminal states (CORRECT, INCORRECT, PARTIAL, ERROR) are recorded immediately
   * with their corresponding AttemptStatus and points. `PENDING` defers scoring
   * to a human reviewer (e.g. mentor for PRACTICAL tasks).
   */
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'ERROR' | 'PENDING';
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
