import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100)
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Display name must be at least 2 characters' })
  @MaxLength(50)
  displayName!: string;
}
