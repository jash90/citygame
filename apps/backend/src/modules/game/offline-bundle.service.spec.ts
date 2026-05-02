import { Test, TestingModule } from '@nestjs/testing';
import { GameStatus, RunStatus, TaskType, UnlockMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OfflineBundleService } from './offline-bundle.service';

/**
 * `OfflineBundleService` is the only path through which task verification config
 * leaves the server. The bcrypt `answerHash` MUST never reach the wire — these
 * tests guard that invariant per task type.
 */
describe('OfflineBundleService', () => {
  let service: OfflineBundleService;

  const mockGame = {
    id: 'game-1',
    title: 'Test',
    description: 'desc',
    city: 'Strzyzow',
    status: GameStatus.PUBLISHED,
    coverImageUrl: 'https://cdn.example.com/cover.jpg',
    settings: { narrative: { themeImage: 'https://cdn.example.com/theme.jpg' } },
    updatedAt: new Date('2026-04-25T12:00:00Z'),
    runs: [
      {
        id: 'run-1',
        runNumber: 1,
        status: RunStatus.ACTIVE,
        startedAt: new Date('2026-04-25T10:00:00Z'),
        endsAt: new Date('2026-04-25T13:00:00Z'),
      },
    ],
    tasks: [
      {
        id: 't-qr',
        gameId: 'game-1',
        title: 'QR',
        description: 'scan',
        type: TaskType.QR_SCAN,
        unlockMethod: UnlockMethod.NONE,
        orderIndex: 0,
        latitude: 49.86,
        longitude: 21.78,
        unlockConfig: {},
        verifyConfig: { expectedHash: 'sha256:abc', answerHash: 'BCRYPT-NEVER-LEAK' },
        maxPoints: 100,
        timeLimitSec: null,
        storyContext: null,
        hints: [],
      },
      {
        id: 't-text',
        gameId: 'game-1',
        title: 'Text',
        description: 'type',
        type: TaskType.TEXT_EXACT,
        unlockMethod: UnlockMethod.GPS,
        orderIndex: 1,
        latitude: 49.86,
        longitude: 21.78,
        unlockConfig: { targetLat: 49.86, targetLng: 21.78, radiusMeters: 30 },
        verifyConfig: {
          answerHash: 'BCRYPT-NEVER-LEAK',
          offlineHash: 'sha256-hex',
          offlineSalt: 'salty',
        },
        maxPoints: 50,
        timeLimitSec: 120,
        storyContext: null,
        hints: [
          { id: 'h1', orderIndex: 0, content: 'first hint', pointPenalty: 5 },
        ],
      },
      {
        id: 't-photo',
        gameId: 'game-1',
        title: 'Photo',
        description: 'snap',
        type: TaskType.PHOTO_AI,
        unlockMethod: UnlockMethod.NONE,
        orderIndex: 2,
        latitude: 49.86,
        longitude: 21.78,
        unlockConfig: {},
        verifyConfig: { aiPrompt: 'secret prompt' },
        maxPoints: 80,
        timeLimitSec: null,
        storyContext: null,
        hints: [],
      },
      {
        id: 't-cipher-no-offline',
        gameId: 'game-1',
        title: 'Legacy cipher',
        description: 'guess',
        type: TaskType.CIPHER,
        unlockMethod: UnlockMethod.NONE,
        orderIndex: 3,
        latitude: 49.86,
        longitude: 21.78,
        unlockConfig: {},
        // Older row: bcrypt only — no offlineHash backfill yet.
        verifyConfig: { answerHash: 'BCRYPT-NEVER-LEAK' },
        maxPoints: 100,
        timeLimitSec: null,
        storyContext: null,
        hints: [],
      },
    ],
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OfflineBundleService,
        {
          provide: PrismaService,
          useValue: {
            game: { findFirst: jest.fn().mockResolvedValue(mockGame) },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(OfflineBundleService);
  });

  it('strips bcrypt answerHash from every task verifyConfig', async () => {
    const bundle = await service.buildBundle('game-1');
    for (const task of bundle.tasks) {
      const serialized = JSON.stringify(task.verifyConfig);
      expect(serialized).not.toContain('BCRYPT-NEVER-LEAK');
      expect(serialized).not.toContain('answerHash');
    }
  });

  it('keeps QR_SCAN expectedHash and drops all other fields', async () => {
    const bundle = await service.buildBundle('game-1');
    const qr = bundle.tasks.find((t) => t.id === 't-qr')!;
    expect(qr.verifyConfig).toEqual({ expectedHash: 'sha256:abc' });
  });

  it('keeps TEXT_EXACT offlineHash + offlineSalt, drops bcrypt', async () => {
    const bundle = await service.buildBundle('game-1');
    const text = bundle.tasks.find((t) => t.id === 't-text')!;
    expect(text.verifyConfig).toEqual({
      offlineHash: 'sha256-hex',
      offlineSalt: 'salty',
    });
    expect(text.unsupportedOffline).toBe(false);
  });

  it('flags CIPHER tasks lacking offlineHash as unsupportedOffline', async () => {
    const bundle = await service.buildBundle('game-1');
    const legacy = bundle.tasks.find((t) => t.id === 't-cipher-no-offline')!;
    expect(legacy.unsupportedOffline).toBe(true);
    expect(legacy.verifyConfig).toEqual({});
  });

  it('flags AI tasks as requiresOnlineVerification with empty verifyConfig', async () => {
    const bundle = await service.buildBundle('game-1');
    const photo = bundle.tasks.find((t) => t.id === 't-photo')!;
    expect(photo.requiresOnlineVerification).toBe(true);
    expect(photo.verifyConfig).toEqual({});
    expect(JSON.stringify(photo.verifyConfig)).not.toContain('aiPrompt');
  });

  it('exposes hint content (offline play needs it client-side)', async () => {
    const bundle = await service.buildBundle('game-1');
    const text = bundle.tasks.find((t) => t.id === 't-text')!;
    expect(text.hints).toEqual([
      { id: 'h1', orderIndex: 0, content: 'first hint', pointPenalty: 5 },
    ]);
  });

  it('builds a media manifest from coverImage + narrative + storyContext URLs', async () => {
    const bundle = await service.buildBundle('game-1');
    expect(bundle.mediaManifest).toEqual(
      expect.arrayContaining([
        'https://cdn.example.com/cover.jpg',
        'https://cdn.example.com/theme.jpg',
      ]),
    );
  });

  it('returns the active run schedule', async () => {
    const bundle = await service.buildBundle('game-1');
    expect(bundle.activeRun).toMatchObject({
      id: 'run-1',
      runNumber: 1,
      status: 'ACTIVE',
    });
  });

  it('exposes bundleVersion derived from game.updatedAt', async () => {
    const version = await service.buildBundleVersion('game-1');
    expect(version.bundleVersion).toBe(mockGame.updatedAt.getTime());
  });

  it('throws NotFoundException for an unknown or unpublished game', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OfflineBundleService,
        {
          provide: PrismaService,
          useValue: {
            game: { findFirst: jest.fn().mockResolvedValue(null) },
          },
        },
      ],
    }).compile();
    const isolated = moduleRef.get(OfflineBundleService);

    await expect(isolated.buildBundleVersion('missing')).rejects.toThrow(
      'Game missing not found or not published',
    );
  });
});
