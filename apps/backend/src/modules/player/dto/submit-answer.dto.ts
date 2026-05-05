import { IsISO8601, IsObject, IsOptional, IsUUID } from 'class-validator';

export class SubmitAnswerDto {
  @IsObject()
  submission!: Record<string, unknown>;

  /**
   * Client-generated UUID enabling idempotent retransmission of attempts
   * captured while offline. Optional to keep the contract backwards-compatible.
   */
  @IsOptional()
  @IsUUID()
  clientSubmissionId?: string;

  /**
   * Wall-clock on the device at the moment the player submitted the answer.
   * For online submits this is essentially `now`; for offline submits replayed
   * via `/sync` this can be much earlier than the server's insert time and is
   * used as the leaderboard tie-breaker.
   */
  @IsOptional()
  @IsISO8601()
  clientCapturedAt?: string;
}
