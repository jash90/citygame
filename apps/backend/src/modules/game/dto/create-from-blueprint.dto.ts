import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { GenerateGameBlueprintDto } from '../../ai/dto/generate-game-blueprint.dto';

export class CreateGameFromBlueprintDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  blueprint!: Record<string, unknown>;

  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;
}
