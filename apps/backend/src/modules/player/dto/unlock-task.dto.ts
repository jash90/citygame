import { IsObject } from 'class-validator';

export class UnlockTaskDto {
  @IsObject()
  unlockData!: Record<string, unknown>;
}
