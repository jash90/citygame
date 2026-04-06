import { IsString, MinLength } from 'class-validator';

export class SetModelDto {
  @IsString()
  @MinLength(3)
  model!: string;
}
