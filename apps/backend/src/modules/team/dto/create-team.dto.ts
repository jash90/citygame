import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  maxMembers?: number;
}
