import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ReviewAttemptDto {
  /** Score in 0-100 (% of task.maxPoints). 0 → INCORRECT, 100 → CORRECT, 1-99 → PARTIAL. */
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  /**
   * Required free-text justification shown to the player. Min length 3
   * stops empty/whitespace approvals from bypassing the frontend's
   * disabled-button guard.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  feedback!: string;
}
