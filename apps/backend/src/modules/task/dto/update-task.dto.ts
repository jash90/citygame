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

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(UnlockMethod)
  unlockMethod?: UnlockMethod;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsObject()
  unlockConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  verifyConfig?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  maxPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  timeLimitSec?: number;

  @IsOptional()
  @IsString()
  storyContext?: string;
}
