import { IsString, MinLength } from 'class-validator';

export class GenerateDescriptionDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  type!: string;

  @IsString()
  @MinLength(2)
  city!: string;
}
