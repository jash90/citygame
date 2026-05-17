import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class ReviewAttemptDto {
  /** Score in 0-100 (% of task.maxPoints). 0 → INCORRECT, 100 → CORRECT, 1-99 → PARTIAL. */
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsString()
  @MaxLength(2000)
  feedback!: string;
}
