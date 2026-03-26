import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GenerateHintsDto {
  @IsString()
  @MinLength(10)
  taskDescription!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number;
}
