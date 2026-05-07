import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GameFlowType, TaskType } from '@citygame/shared';

export class GenerateGameBlueprintDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  theme!: string;

  @ApiProperty({ enum: GameFlowType })
  @IsEnum(GameFlowType)
  flowType!: GameFlowType;

  @ApiProperty({ minimum: 3, maximum: 20 })
  @IsInt()
  @Min(3)
  @Max(20)
  taskCount!: number;

  @ApiProperty({ minimum: 15, maximum: 360 })
  @IsInt()
  @Min(15)
  @Max(360)
  durationMinutes!: number;

  @ApiProperty({ enum: ['EASY', 'MEDIUM', 'HARD'] })
  @IsEnum(['EASY', 'MEDIUM', 'HARD'] as const)
  difficulty!: 'EASY' | 'MEDIUM' | 'HARD';

  @ApiProperty({ default: 'pl' })
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  language!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  audience?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false, enum: TaskType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsEnum(TaskType, { each: true })
  allowedTaskTypes?: TaskType[];

  @ApiProperty({ required: false, enum: TaskType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(7)
  @IsEnum(TaskType, { each: true })
  mixedComponentTypes?: TaskType[];

  @ApiProperty({ required: false, minimum: 2, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  endingCount?: number;

  @ApiProperty({
    required: false,
    description:
      'When true the model runs through OpenRouter\'s :online variant so it can web-search for legends, POIs, and coordinates while generating the blueprint.',
  })
  @IsOptional()
  @IsBoolean()
  useWebSearch?: boolean;

  @ApiProperty({
    required: false,
    enum: ['NONE', 'FLAVOR', 'FULL_NARRATIVE'],
    description:
      'Narrative mode: NONE = no characters (legacy), FLAVOR = character entities with npcId on tasks, FULL_NARRATIVE = future.',
  })
  @IsOptional()
  @IsEnum(['NONE', 'FLAVOR', 'FULL_NARRATIVE'] as const)
  storyMode?: 'NONE' | 'FLAVOR' | 'FULL_NARRATIVE';
}
