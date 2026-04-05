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
import { UnlockTaskDto } from './dto/unlock-task.dto';
import { PlayerService } from './player.service';

@ApiTags('Player')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly rankingService: RankingService,
  ) {}

  @ApiOperation({ summary: 'Get active session for session restoration' })
  @ApiResponse({ status: 200, description: 'Active session or null' })
  @Get('api/player/active-session')
  getActiveSession(@CurrentUser() user: CurrentUserPayload) {
    return this.playerService.getMyActiveSession(user.id);
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
    return this.playerService.getRunAnswers(gameId, runNumber, user.id);
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
    return this.playerService.getProgress(gameId, user.id);
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
    return this.playerService.unlockTask(gameId, taskId, user.id, dto.unlockData);
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
    return this.playerService.submitAnswer(gameId, taskId, user.id, dto.submission);
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
    return this.playerService.useHint(gameId, taskId, user.id);
  }
}
