import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
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

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refreshTokens(
    @Request() req: RequestWithUser,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(req.user.id, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.logout(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateMe(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('push-token')
  updatePushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PushTokenDto,
  ) {
    return this.authService.updatePushToken(user.id, dto.pushToken);
  }
}
