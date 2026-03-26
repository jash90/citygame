import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { JoinTeamDto } from './dto/join-team.dto';
import { TeamService } from './team.service';

@UseGuards(JwtAuthGuard)
@Controller('api/games/:gameId/teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * POST /api/games/:gameId/teams
   * Create a new team for the given game.
   */
  @Post()
  create(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.createTeam(gameId, user.id, dto);
  }

  /**
   * POST /api/games/:gameId/teams/join
   * Join an existing team using a join code.
   */
  @Post('join')
  join(
    @Param('gameId') _gameId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: JoinTeamDto,
  ) {
    return this.teamService.joinTeam(dto.code, user.id);
  }

  /**
   * GET /api/games/:gameId/teams
   * List all teams in a game.
   */
  @Get()
  list(@Param('gameId') gameId: string) {
    return this.teamService.getTeamsByGame(gameId);
  }

  /**
   * GET /api/games/:gameId/teams/my
   * Get the authenticated user's team in this game.
   */
  @Get('my')
  getMyTeam(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.getMyTeam(gameId, user.id);
  }

  /**
   * DELETE /api/games/:gameId/teams/:teamId/leave
   * Leave the specified team.
   */
  @Delete(':teamId/leave')
  leave(
    @Param('teamId') teamId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.leaveTeam(teamId, user.id);
  }
}
