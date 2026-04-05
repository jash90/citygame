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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameAnalyticsService } from './game-analytics.service';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';

@ApiTags('Games')
@Controller()
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly gameRunService: GameRunService,
    private readonly gameAnalyticsService: GameAnalyticsService,
  ) {}

  // ── Admin routes ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new game draft' })
  @ApiResponse({ status: 201, description: 'Game created' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/admin/games')
  adminCreate(
    @Body() dto: CreateGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'List all games (admin view)' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games')
  adminList(@Query() query: ListGamesQueryDto) {
    return this.gameService.findAll(query, true);
  }

  @ApiOperation({ summary: 'Get game details with tasks (admin)' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @ApiBearerAuth('access-token')
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

  @ApiOperation({ summary: 'Start a new game run' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/admin/games/:id/start-run')
  adminStartRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.startRun(id, user.id, true);
  }

  @ApiOperation({ summary: 'End the active game run' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id/end-run')
  adminEndRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.endRun(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/games/:id/restart')
  adminRestart(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.restartGame(id, user.id, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/runs')
  adminGetRuns(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameRunService.getRunHistory(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/run-activity')
  adminGetRunActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameRunService.getRunActivity(id, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/run-completions')
  adminGetRunCompletions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameRunService.getRunTaskCompletions(id, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/sessions')
  adminGetSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gameService.getGameSessions(
      id,
      runId,
      Number(page) || 1,
      Math.min(Number(limit) || 50, 100),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/stats')
  adminGetStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getGameStats(id, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/analytics/activity')
  adminGetActivityTimeSeries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getPlayerActivityTimeSeries(id, Number(days) || 30, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/analytics/task-difficulty')
  adminGetTaskDifficulty(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getTaskDifficultyStats(id, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/games/:id/analytics/ai-verification')
  adminGetAiVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getAiVerificationStats(id, runId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('api/admin/running-games')
  adminRunningGames() {
    return this.gameRunService.getRunningGames();
  }

  // ── Player routes ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List published games (player view)' })
  @ApiResponse({ status: 200, description: 'Paginated list of published games' })
  @Get('api/games')
  listPublished(@Query() query: ListGamesQueryDto) {
    return this.gameService.findAll(query, false);
  }

  @ApiOperation({ summary: 'Get a published game (player view)' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @ApiResponse({ status: 200, description: 'Game details without sensitive task data' })
  @Get('api/games/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.findOnePublic(id);
  }
}
