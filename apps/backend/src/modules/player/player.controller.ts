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
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RankingService } from '../ranking/ranking.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UnlockTaskDto } from './dto/unlock-task.dto';
import { PlayerService } from './player.service';

@UseGuards(JwtAuthGuard)
@Controller('api/games/:gameId')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly rankingService: RankingService,
  ) {}

  /**
   * GET /api/games/:gameId/ranking
   * Returns the enriched leaderboard for a game.
   * Accessible to any authenticated user — no active session required.
   */
  @Get('ranking')
  getRanking(
    @Param('gameId') gameId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.rankingService.getRankingWithNames(gameId, limit);
  }

  @Post('start')
  startGame(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.startGame(gameId, user.id);
  }

  @Get('progress')
  getProgress(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.getProgress(gameId, user.id);
  }

  @Post('tasks/:taskId/unlock')
  unlockTask(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnlockTaskDto,
  ) {
    return this.playerService.unlockTask(gameId, taskId, user.id, dto.unlockData);
  }

  @Post('tasks/:taskId/submit')
  submitAnswer(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.playerService.submitAnswer(gameId, taskId, user.id, dto.submission);
  }

  @Post('tasks/:taskId/hint')
  useHint(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.useHint(gameId, taskId, user.id);
  }
}
