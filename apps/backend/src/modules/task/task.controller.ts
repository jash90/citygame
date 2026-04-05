import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/games/:gameId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @ApiOperation({ summary: 'List all tasks for a game' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Get()
  findAll(@Param('gameId') gameId: string) {
    return this.taskService.findByGame(gameId);
  }

  @ApiOperation({ summary: 'Create a new task' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Post()
  create(
    @Param('gameId') gameId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.create(gameId, dto, user.id, user.role === UserRole.ADMIN);
  }

  @ApiOperation({ summary: 'Reorder tasks within a game' })
  @ApiParam({ name: 'gameId', description: 'Game UUID' })
  @Patch('reorder')
  reorder(
    @Param('gameId') gameId: string,
    @Body() dto: ReorderTasksDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.reorder(gameId, dto, user.id, user.role === UserRole.ADMIN);
  }

  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.update(id, dto, user.id, user.role === UserRole.ADMIN);
  }

  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.taskService.delete(id, user.id, user.role === UserRole.ADMIN);
  }
}
