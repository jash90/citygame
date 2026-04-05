import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Refresh token JWT. Required for mobile clients (body).
   * Optional for admin panel (token is sent via httpOnly cookie).
   */
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
