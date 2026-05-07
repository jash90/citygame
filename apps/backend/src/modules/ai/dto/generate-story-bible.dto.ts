import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class GenerateStoryBibleDto {
  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Output of `gatherResearchPack` to inject as factual ground truth.',
  })
  @IsOptional()
  @IsString()
  researchPack?: string | null;
}
