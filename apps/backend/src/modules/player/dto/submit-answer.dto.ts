import { IsObject, IsOptional, IsUUID } from 'class-validator';

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
}
