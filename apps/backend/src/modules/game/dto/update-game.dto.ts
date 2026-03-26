import { IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
