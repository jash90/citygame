import { ApiProperty } from '@nestjs/swagger';
import { Allow, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class GenerateEndingsDto {
  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;

  // Nested complex JSON validated by Zod inside the controller — see
  // generate-transitions.dto.ts for why these are `@Allow()` + unknown.
  @ApiProperty({ description: 'BlueprintOutline (object).' })
  @Allow()
  outline!: unknown;

  @ApiProperty({ description: 'Array of finalised BlueprintTask objects.' })
  @Allow()
  tasks!: unknown;

  @ApiProperty({ description: 'StoryBible (object).' })
  @Allow()
  bible!: unknown;
}
