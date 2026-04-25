import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { GameService } from './game.service';
import { OfflineBundleService } from './offline-bundle.service';

@ApiTags('Games')
@Controller()
export class PlayerGameController {
  constructor(
    private readonly gameService: GameService,
    private readonly offlineBundleService: OfflineBundleService,
  ) {}

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

  @ApiOperation({
    summary: 'Get the full offline bundle for a published game',
    description:
      'Returns everything the mobile client needs to play the game without internet: ' +
      'task definitions with sanitized verifyConfig (offline hashes only — bcrypt is never exposed), ' +
      'all hints, the active run schedule, and a media manifest for pre-download.',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @ApiResponse({ status: 200, description: 'Offline bundle for the game' })
  @ApiResponse({ status: 404, description: 'Game not found or not published' })
  @Get('api/games/:id/offline-bundle')
  getOfflineBundle(@Param('id', ParseUUIDPipe) id: string) {
    return this.offlineBundleService.buildBundle(id);
  }
}
