import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class RefineBlueprintDto {
  @ApiProperty({ enum: ['tasks', 'endings', 'task'] })
  @IsEnum(['tasks', 'endings', 'task'] as const)
  stage!: 'tasks' | 'endings' | 'task';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  taskIndex?: number;

  /** Full GameBlueprint (validated by Zod inside the service). */
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  blueprint!: Record<string, unknown>;

  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;
}
