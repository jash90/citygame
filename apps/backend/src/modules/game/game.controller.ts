import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameService } from './game.service';

@Controller()
export class GameController {
  constructor(private readonly gameService: GameService) {}

  // ── Admin routes ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/admin/games')
  adminCreate(
    @Body() dto: CreateGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games')
  adminList(@Query() query: ListGamesQueryDto) {
    return this.gameService.findAll(query, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id')
  adminFindOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id')
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.update(id, dto, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('api/admin/games/:id')
  adminDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.delete(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id/publish')
  adminPublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.publish(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id/unpublish')
  adminUnpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.unpublish(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id/archive')
  adminArchive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.archive(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/sessions')
  adminGetSessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.getGameSessions(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/stats')
  adminGetStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.getGameStats(id);
  }

  // ── Player routes ────────────────────────────────────────────────────────────

  @Get('api/games')
  listPublished(@Query() query: ListGamesQueryDto) {
    return this.gameService.findAll(query, false);
  }

  @Get('api/games/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.findOnePublic(id);
  }
}
