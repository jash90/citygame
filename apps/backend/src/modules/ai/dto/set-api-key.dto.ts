import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetApiKeyDto {
  /** Raw OpenRouter key (typically `sk-or-...`). Stored plaintext in DB. */
  @ApiProperty({ description: 'Full OpenRouter API key' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  apiKey!: string;
}
