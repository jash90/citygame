import { IsString, MinLength } from 'class-validator';

export class GeneratePromptDto {
  @IsString()
  @MinLength(2)
  taskType!: string;

  @IsString()
  @MinLength(10)
  taskDescription!: string;
}
