import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RankingService } from '../ranking/ranking.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UnlockTaskDto } from './dto/unlock-task.dto';
import { PlayerService } from './player.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly rankingService: RankingService,
  ) {}

  /**
   * GET /api/player/active-session
   * Returns the user's currently active session (if any) for session restoration.
   */
  @Get('api/player/active-session')
  getActiveSession(@CurrentUser() user: CurrentUserPayload) {
    return this.playerService.getMyActiveSession(user.id);
  }

  /**
   * GET /api/games/:gameId/runs/:runNumber/answers
   * Returns the user's answers for a specific past run (read-only).
   */
  @Get('api/games/:gameId/runs/:runNumber/answers')
  getRunAnswers(
    @Param('gameId') gameId: string,
    @Param('runNumber', ParseIntPipe) runNumber: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.getRunAnswers(gameId, runNumber, user.id);
  }

  /**
   * GET /api/games/:gameId/ranking
   * Returns the enriched leaderboard for the current (active) run of a game.
   * Accessible to any authenticated user — no active session required.
   */
  @Get('api/games/:gameId/ranking')
  async getRanking(
    @Param('gameId') gameId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const runId = await this.rankingService.getActiveRunId(gameId);
    if (!runId) {
      return [];
    }
    return this.rankingService.getRankingWithNames(runId, limit);
  }

  @Post('api/games/:gameId/start')
  startGame(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.startGame(gameId, user.id);
  }

  @Get('api/games/:gameId/progress')
  getProgress(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.getProgress(gameId, user.id);
  }

  @Post('api/games/:gameId/tasks/:taskId/unlock')
  unlockTask(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnlockTaskDto,
  ) {
    return this.playerService.unlockTask(gameId, taskId, user.id, dto.unlockData);
  }

  @Post('api/games/:gameId/tasks/:taskId/submit')
  submitAnswer(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.playerService.submitAnswer(gameId, taskId, user.id, dto.submission);
  }

  @Post('api/games/:gameId/tasks/:taskId/hint')
  useHint(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.useHint(gameId, taskId, user.id);
  }
}
