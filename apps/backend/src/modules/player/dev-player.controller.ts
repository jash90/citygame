import {
  Controller,
  Param,
  Post,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { DevEndpointsGuard, IS_DEV_ENDPOINT } from '../../common/guards/dev-endpoints.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlayerDevService } from './player-dev.service';

/**
 * Development-only controller for bypassing task verification.
 * Blocked by DevEndpointsGuard unless ENABLE_DEV_ENDPOINTS=true.
 */
@ApiTags('Player (Dev)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, DevEndpointsGuard)
@SetMetadata(IS_DEV_ENDPOINT, true)
@Controller()
export class DevPlayerController {
  constructor(private readonly playerDevService: PlayerDevService) {}

  @Post('api/games/:gameId/tasks/:taskId/dev-complete')
  devCompleteTask(
    @Param('gameId') gameId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.playerDevService.devCompleteTask(gameId, taskId, user.id);
  }
}
