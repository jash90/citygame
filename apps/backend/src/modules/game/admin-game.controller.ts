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
import { GameRunActivityService } from './game-run-activity.service';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';
import { GameStatusService } from './game-status.service';

@ApiTags('Games — Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class AdminGameController {
  constructor(
    private readonly gameService: GameService,
    private readonly gameStatusService: GameStatusService,
    private readonly gameRunService: GameRunService,
    private readonly gameRunActivityService: GameRunActivityService,
    private readonly gameAnalyticsService: GameAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Create a new game draft' })
  @ApiResponse({ status: 201, description: 'Game created' })
  @Post('api/admin/games')
  create(
    @Body() dto: CreateGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'List all games (admin view)' })
  @Get('api/admin/games')
  list(@Query() query: ListGamesQueryDto) {
    return this.gameService.findAll(query, true);
  }

  @ApiOperation({ summary: 'Get game details with tasks (admin)' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @Get('api/admin/games/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameService.findOne(id);
  }

  @Patch('api/admin/games/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.update(id, dto, user.id, true);
  }

  @Delete('api/admin/games/:id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameService.delete(id, user.id, true);
  }

  @Patch('api/admin/games/:id/publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameStatusService.publish(id, user.id, true);
  }

  @Patch('api/admin/games/:id/unpublish')
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameStatusService.unpublish(id, user.id, true);
  }

  @Patch('api/admin/games/:id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameStatusService.archive(id, user.id, true);
  }

  @ApiOperation({ summary: 'Start a new game run' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @Post('api/admin/games/:id/start-run')
  startRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.startRun(id, user.id, true);
  }

  @ApiOperation({ summary: 'End the active game run' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @Patch('api/admin/games/:id/end-run')
  endRun(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.endRun(id, user.id, true);
  }

  @Patch('api/admin/games/:id/restart')
  restart(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gameRunService.restartGame(id, user.id, true);
  }

  @Get('api/admin/games/:id/runs')
  getRuns(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameRunService.getRunHistory(id);
  }

  @Get('api/admin/games/:id/run-activity')
  getRunActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameRunActivityService.getRunActivity(id, runId);
  }

  @Get('api/admin/games/:id/run-completions')
  getRunCompletions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameRunService.getRunTaskCompletions(id, runId);
  }

  @Get('api/admin/games/:id/sessions')
  getSessions(
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

  @Get('api/admin/games/:id/stats')
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getGameStats(id, runId);
  }

  @Get('api/admin/games/:id/analytics/activity')
  getActivityTimeSeries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getPlayerActivityTimeSeries(id, Number(days) || 30, runId);
  }

  @Get('api/admin/games/:id/analytics/task-difficulty')
  getTaskDifficulty(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getTaskDifficultyStats(id, runId);
  }

  @Get('api/admin/games/:id/analytics/ai-verification')
  getAiVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('runId') runId?: string,
  ) {
    return this.gameAnalyticsService.getAiVerificationStats(id, runId);
  }

  @Get('api/admin/running-games')
  runningGames() {
    return this.gameRunService.getRunningGames();
  }
}
