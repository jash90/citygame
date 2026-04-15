import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { GameService } from './game.service';

@ApiTags('Games')
@Controller()
export class PlayerGameController {
  constructor(private readonly gameService: GameService) {}

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
}
