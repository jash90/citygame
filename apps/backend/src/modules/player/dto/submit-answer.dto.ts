import { IsObject } from 'class-validator';

export class SubmitAnswerDto {
  @IsObject()
  submission!: Record<string, unknown>;
}
