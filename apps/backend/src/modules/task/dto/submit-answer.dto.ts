import { IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @IsObject()
  submission!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
