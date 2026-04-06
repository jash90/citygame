import { IsEnum, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class TestPromptDto {
  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsString()
  @MinLength(1)
  testAnswer!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  threshold!: number;

  @IsString()
  @MinLength(2)
  taskType!: string;
}
