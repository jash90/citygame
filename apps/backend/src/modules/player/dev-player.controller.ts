import {
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlayerService } from './player.service';

/**
 * Development-only controller for bypassing task verification.
 * This controller is NOT registered in production builds — see PlayerModule.
 */
@ApiTags('Player (Dev)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class DevPlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('api/games/:gameId/tasks/:taskId/dev-complete')
  devCompleteTask(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerService.devCompleteTask(gameId, taskId, user.id);
  }
}
