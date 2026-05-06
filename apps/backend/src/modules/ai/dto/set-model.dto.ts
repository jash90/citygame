import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Per-purpose model overrides. Empty string clears an override and falls
 * back to the global `model` setting. All fields optional.
 */
export class AiModelsByPurposeDto {
  @IsOptional() @IsString() blueprint?: string;
  @IsOptional() @IsString() photoAi?: string;
  @IsOptional() @IsString() textAi?: string;
  @IsOptional() @IsString() audioAi?: string;
  @IsOptional() @IsString() editorHelpers?: string;
}

export class SetModelDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  model?: string;

  @IsOptional()
  @IsBoolean()
  useWebSearch?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AiModelsByPurposeDto)
  modelsByPurpose?: AiModelsByPurposeDto;
}
