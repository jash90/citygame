import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, Validate, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'teamSizeRange', async: false })
class TeamSizeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const obj = args.object as GameSettingsDto;
    if (obj.minTeamSize != null && obj.maxTeamSize != null) {
      return obj.minTeamSize <= obj.maxTeamSize;
    }
    return true;
  }

  defaultMessage() {
    return 'minTeamSize must be less than or equal to maxTeamSize';
  }
}

class NarrativeSettingsDto {
  @IsOptional()
  @IsBoolean()
  isNarrative?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  prologue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  epilogue?: string;
}

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
  @Validate(TeamSizeConstraint)
  maxTeamSize?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => NarrativeSettingsDto)
  narrative?: NarrativeSettingsDto;
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
