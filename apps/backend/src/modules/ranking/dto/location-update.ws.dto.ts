import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class LocationUpdateWsDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  displayName!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  heading?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number | null;
}
