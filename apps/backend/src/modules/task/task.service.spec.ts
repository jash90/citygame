import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskType, UnlockMethod } from '@prisma/client';
import { TaskService } from './task.service';
import { PrismaService } from '../../prisma/prisma.service';

const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('task'),
    gameId: 'game-1',
    title: 'Task 1',
    description: 'Do something',
    type: TaskType.TEXT_EXACT,
    unlockMethod: UnlockMethod.GPS,
    orderIndex: 0,
    latitude: 52.23,
    longitude: 21.01,
    unlockConfig: {},
    verifyConfig: {},
    maxPoints: 100,
    timeLimitSec: null,
    storyContext: null,
    hints: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const mockPrisma = {
  game: { findUnique: jest.fn() },
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((arr: unknown[]) => Promise.all(arr as Promise<unknown>[])),
};

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TaskService);
  });

  describe('findByGame', () => {
    it('returns tasks ordered by orderIndex', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1' });
      const tasks = [makeTask({ orderIndex: 0 }), makeTask({ orderIndex: 1 })];
      mockPrisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.findByGame('game-1');
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundException if game does not exist', async () => {
      mockPrisma.game.findUnique.mockResolvedValue(null);

      await expect(service.findByGame('no-game')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a task with correct data', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1', creatorId: 'user-1' });
      const task = makeTask();
      mockPrisma.task.create.mockResolvedValue(task);

      const result = await service.create(
        'game-1',
        {
          title: 'Task 1',
          description: 'Do something',
          type: TaskType.TEXT_EXACT,
          unlockMethod: UnlockMethod.GPS,
          orderIndex: 0,
          latitude: 52.23,
          longitude: 21.01,
          unlockConfig: {},
          verifyConfig: {},
          maxPoints: 100,
        },
        'user-1',
        false,
      );

      expect(mockPrisma.task.create).toHaveBeenCalled();
      expect(result).toEqual(task);
    });

    it('throws ForbiddenException if not owner and not admin', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1', creatorId: 'user-1' });

      await expect(
        service.create(
          'game-1',
          { title: 'T', description: 'D', type: TaskType.TEXT_EXACT, unlockMethod: UnlockMethod.GPS, orderIndex: 0, latitude: 0, longitude: 0, unlockConfig: {}, verifyConfig: {}, maxPoints: 10 },
          'other-user',
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates task fields', async () => {
      const task = makeTask({ gameId: 'game-1' });
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1', creatorId: 'user-1' });
      mockPrisma.task.update.mockResolvedValue({ ...task, title: 'Updated' });

      const result = await service.update(task.id, { title: 'Updated' }, 'user-1', false);
      expect(result.title).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('deletes a task', async () => {
      const task = makeTask({ gameId: 'game-1' });
      mockPrisma.task.findUnique.mockResolvedValue(task);
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1', creatorId: 'user-1' });
      mockPrisma.task.delete.mockResolvedValue(task);

      await expect(service.delete(task.id, 'user-1', false)).resolves.not.toThrow();
    });
  });

  describe('reorder', () => {
    it('updates orderIndex for all tasks in batch', async () => {
      mockPrisma.game.findUnique.mockResolvedValue({ id: 'game-1', creatorId: 'user-1' });
      mockPrisma.task.findMany.mockResolvedValue([]);
      // $transaction receives array of promises from task.update calls
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.reorder(
        'game-1',
        { tasks: [{ id: 't1', orderIndex: 0 }, { id: 't2', orderIndex: 1 }] },
        'user-1',
        false,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
