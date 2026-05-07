import { ApiProperty } from '@nestjs/swagger';
import { Allow, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateGameBlueprintDto } from './generate-game-blueprint.dto';

export class GenerateTransitionsDto {
  @ApiProperty({ type: GenerateGameBlueprintDto })
  @ValidateNested()
  @Type(() => GenerateGameBlueprintDto)
  input!: GenerateGameBlueprintDto;

  /**
   * Nested complex JSON validated by Zod inside the controller. `@Allow()`
   * keeps the property under the global ValidationPipe's `whitelist` while
   * skipping all class-validator checks. Typing as `unknown` avoids
   * class-transformer's coercion (with `enableImplicitConversion: true`,
   * a `Record<string, unknown>[]` type triggers Object.entries-style
   * round-tripping that turns each task into an array).
   */
  @ApiProperty({ description: 'BlueprintOutline (object).' })
  @Allow()
  outline!: unknown;

  @ApiProperty({ description: 'Array of finalised BlueprintTask objects.' })
  @Allow()
  tasks!: unknown;
}
