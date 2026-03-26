import { IsJSON, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsObject()
  settings!: Record<string, unknown>;
}
