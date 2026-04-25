import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RankingService } from '../ranking/ranking.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SyncRequestDto } from './dto/sync-request.dto';
import { UnlockTaskDto } from './dto/unlock-task.dto';
import { PlayerQueryService } from './player-query.service';
import { PlayerService } from './player.service';
import { PlayerTaskService } from './player-task.service';
import { SyncService } from './sync.service';

@ApiTags('Player')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly playerTaskService: PlayerTaskService,
    private readonly playerQueryService: PlayerQueryService,
    private readonly rankingService: RankingService,
    private readonly syncService: SyncService,
  ) {}

  @ApiOperation({ summary: 'Get active session for session restoration' })
  @ApiResponse({ status: 200, description: 'Active session or null' })
  @Get('api/player/active-session')
  getActiveSession(@CurrentUser() user: CurrentUserPayload) {
    return this.playerQueryService.getMyActiveSession(user.id);
  }

  @ApiOperation({ summary: 'Get answers for a specific past run' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiParam({ name: 'runNumber', description: 'Run number (1-based)' })
  @ApiResponse({ status: 200, description: 'Attempts with task details' })
  @Get('api/games/:gameId/runs/:runNumber/answers')
  getRunAnswers(
    @Param('gameId') gameId: string,
    @Param('runNumber', ParseIntPipe) runNumber: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerQueryService.getRunAnswers(gameId, runNumber, user.id);
  }

  @ApiOperation({ summary: 'Get leaderboard for the active run' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiResponse({ status: 200, description: 'Enriched ranking entries' })
  @Get('api/games/:gameId/ranking')
  async getRanking(
    @Param('gameId') gameId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const runId = await this.rankingService.getActiveRunId(gameId);
    if (!runId) {
      return [];
    }
    return this.rankingService.getRankingWithNames(runId, Math.min(limit, 200));
  }

  @ApiOperation({ summary: 'Start a game session' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiResponse({ status: 201, description: 'Game session created' })
  @ApiResponse({ status: 403, description: 'Game not available or no active run' })
  @ApiResponse({ status: 409, description: 'Already playing this game run' })
  @Post('api/games/:gameId/start')
  startGame(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.startGame(gameId, user.id);
  }

  @ApiOperation({ summary: 'Get current game progress' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiResponse({ status: 200, description: 'Session progress with completed tasks' })
  @Get('api/games/:gameId/progress')
  getProgress(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerQueryService.getProgress(gameId, user.id);
  }

  @ApiOperation({ summary: 'Unlock a task via GPS or QR' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Unlock result with message' })
  @Post('api/games/:gameId/tasks/:taskId/unlock')
  unlockTask(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnlockTaskDto,
  ) {
    return this.playerTaskService.unlockTask(gameId, taskId, user.id, dto.unlockData);
  }

  @ApiOperation({ summary: 'Submit an answer for a task' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 201, description: 'Attempt result with score and feedback' })
  @ApiResponse({ status: 409, description: 'Task already completed' })
  @Post('api/games/:gameId/tasks/:taskId/submit')
  submitAnswer(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.playerTaskService.submitAnswer(
      gameId,
      taskId,
      user.id,
      dto.submission,
      dto.clientSubmissionId,
    );
  }

  @ApiOperation({
    summary: 'Bulk-replay queued offline mutations',
    description:
      'Accepts a batch of submit/hint/unlock items captured while the client was offline. ' +
      'Each item carries a `clientSubmissionId` for idempotent replay. Items are processed ' +
      'sequentially; per-item failures do not abort the rest.',
  })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiResponse({ status: 200, description: 'Per-item sync results' })
  @Post('api/games/:gameId/sync')
  sync(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SyncRequestDto,
  ) {
    return this.syncService.sync(gameId, user.id, dto);
  }

  @ApiOperation({ summary: 'Use a hint for a task' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Hint content and point penalty' })
  @ApiResponse({ status: 400, description: 'No hints available or all used' })
  @Post('api/games/:gameId/tasks/:taskId/hint')
  useHint(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerTaskService.useHint(gameId, taskId, user.id);
  }
}
