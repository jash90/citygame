import { TaskType, UnlockMethod } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(TaskType)
  type!: TaskType;

  @IsEnum(UnlockMethod)
  unlockMethod!: UnlockMethod;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsObject()
  unlockConfig!: Record<string, unknown>;

  @IsObject()
  verifyConfig!: Record<string, unknown>;

  @IsInt()
  @Min(1)
  @Max(10000)
  maxPoints!: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  timeLimitSec?: number;

  @IsOptional()
  @IsString()
  storyContext?: string;
}
