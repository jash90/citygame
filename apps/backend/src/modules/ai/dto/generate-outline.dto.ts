import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class GenerateOutlineDto {
  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;

  // Nested complex JSON validated by Zod inside the controller — see
  // generate-transitions.dto.ts for why this is `@Allow()` + unknown.
  @ApiProperty({ description: 'StoryBible (object).' })
  @Allow()
  bible!: unknown;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  researchPack?: string | null;
}
