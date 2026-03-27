import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GameSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  timeLimitMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowLateJoin?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  minTeamSize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxTeamSize?: number;
}

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

  @ValidateNested()
  @Type(() => GameSettingsDto)
  settings!: GameSettingsDto;
}
