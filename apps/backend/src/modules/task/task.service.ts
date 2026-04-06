import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all tasks for a game ordered by orderIndex.
   */
  async findByGame(gameId: string): Promise<Task[]> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    return this.prisma.task.findMany({
      where: { gameId },
      orderBy: { orderIndex: 'asc' },
      include: {
        hints: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { attempts: true } },
      },
    });
  }

  /**
   * Find a single task by id, with ownership check.
   */
  async findOne(taskId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { hints: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    return task;
  }

  /**
   * Create a task for a game. Validates game ownership.
   */
  async create(
    gameId: string,
    dto: CreateTaskDto,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<Task> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    return this.prisma.task.create({
      data: {
        gameId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        unlockMethod: dto.unlockMethod,
        orderIndex: dto.orderIndex,
        latitude: dto.latitude,
        longitude: dto.longitude,
        unlockConfig: dto.unlockConfig as Prisma.InputJsonValue,
        verifyConfig: dto.verifyConfig as Prisma.InputJsonValue,
        maxPoints: dto.maxPoints,
        timeLimitSec: dto.timeLimitSec,
        storyContext: dto.storyContext,
      },
    });
  }

  /**
   * Update a task. Validates game ownership.
   */
  async update(
    taskId: string,
    dto: UpdateTaskDto,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<Task> {
    const task = await this.findOne(taskId);
    const game = await this.prisma.game.findUnique({ where: { id: task.gameId } });

    if (!game) {
      throw new NotFoundException(`Game not found for task ${taskId}`);
    }

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.unlockMethod !== undefined) data.unlockMethod = dto.unlockMethod;
    if (dto.orderIndex !== undefined) data.orderIndex = dto.orderIndex;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.unlockConfig !== undefined) data.unlockConfig = dto.unlockConfig as Prisma.InputJsonValue;
    if (dto.verifyConfig !== undefined) data.verifyConfig = dto.verifyConfig as Prisma.InputJsonValue;
    if (dto.maxPoints !== undefined) data.maxPoints = dto.maxPoints;
    if (dto.timeLimitSec !== undefined) data.timeLimitSec = dto.timeLimitSec;
    if (dto.storyContext !== undefined) data.storyContext = dto.storyContext;

    return this.prisma.task.update({ where: { id: taskId }, data });
  }

  /**
   * Delete a task.
   */
  async delete(
    taskId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const task = await this.findOne(taskId);
    const game = await this.prisma.game.findUnique({ where: { id: task.gameId } });

    if (!game) {
      throw new NotFoundException(`Game not found for task ${taskId}`);
    }

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    await this.prisma.task.delete({ where: { id: taskId } });
  }

  /**
   * Reorder tasks within a game using a batch update inside a transaction.
   */
  async reorder(
    gameId: string,
    dto: ReorderTasksDto,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<Task[]> {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    if (!isAdmin && game.creatorId !== requesterId) {
      throw new ForbiddenException('You do not own this game');
    }

    await this.prisma.$transaction(
      dto.tasks.map(({ id, orderIndex }) =>
        this.prisma.task.update({
          where: { id },
          data: { orderIndex },
        }),
      ),
    );

    return this.findByGame(gameId);
  }
}
