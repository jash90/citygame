import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { AuthCookieService } from './auth-cookie.service';
import { LoginDto } from './dto/login.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

interface RequestWithUser extends ExpressRequest {
  user: CurrentUserPayload;
}

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @ApiOperation({ summary: 'Register a new player account' })
  @ApiResponse({ status: 201, description: 'Account created, tokens returned' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.authCookieService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Tokens and user profile returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.authCookieService.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New token pair returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refreshTokens(
    @Request() req: RequestWithUser & { cookies?: Record<string, string> },
    @Body() dto: Partial<RefreshTokenDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Resolve the raw refresh token from body (mobile) or cookie (admin)
    const rawRefreshToken =
      dto.refreshToken ?? req.cookies?.refreshToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokens = await this.authService.refreshTokens(req.user.id, rawRefreshToken);
    this.authCookieService.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    this.authCookieService.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.id);
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated profile returned' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateMe(user.id, dto);
  }

  @ApiOperation({ summary: 'Register or update push notification token' })
  @ApiResponse({ status: 200, description: 'Push token saved' })
  @UseGuards(JwtAuthGuard)
  @Put('push-token')
  updatePushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PushTokenDto,
  ) {
    return this.authService.updatePushToken(user.id, dto.pushToken);
  }
}
