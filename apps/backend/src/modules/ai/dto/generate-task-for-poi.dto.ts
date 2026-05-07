import { ApiProperty } from '@nestjs/swagger';
import {
  Allow,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class GenerateTaskForPoiDto {
  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;

  // Nested complex JSON validated by Zod inside the controller — see
  // generate-transitions.dto.ts for why these are `@Allow()` + unknown.
  @ApiProperty({ description: 'BlueprintOutline (object).' })
  @Allow()
  outline!: unknown;

  @ApiProperty({ description: 'StoryBible (object).' })
  @Allow()
  bible!: unknown;

  @ApiProperty({ description: '1-based POI index from the outline.' })
  @IsInt()
  @Min(1)
  poiIndex!: number;

  @ApiProperty({
    required: false,
    description: 'Optional CipherAssignment from `planCipherChains`.',
  })
  @Allow()
  cipherAssignment?: unknown;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  researchPack?: string | null;
}
