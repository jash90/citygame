import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { JoinTeamDto } from './dto/join-team.dto';
import { TeamService } from './team.service';

@ApiTags('Teams')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('api/games/:gameId/teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ApiOperation({ summary: 'Create a new team for a game' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Post()
  create(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.createTeam(gameId, user.id, dto);
  }

  @ApiOperation({ summary: 'Join an existing team using a join code' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('join')
  join(
    @Param('gameId') _gameId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: JoinTeamDto,
  ) {
    return this.teamService.joinTeam(dto.code, user.id);
  }

  @ApiOperation({ summary: 'List all teams in a game' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Get()
  list(@Param('gameId') gameId: string) {
    return this.teamService.getTeamsByGame(gameId);
  }

  @ApiOperation({ summary: "Get the current user's team" })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Get('my')
  getMyTeam(
    @Param('gameId') gameId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.getMyTeam(gameId, user.id);
  }

  @ApiOperation({ summary: 'Leave a team' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @Delete(':teamId/leave')
  leave(
    @Param('teamId') teamId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.teamService.leaveTeam(teamId, user.id);
  }
}
