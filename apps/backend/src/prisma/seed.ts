import { PrismaClient, RunStatus } from '@prisma/client';
import Redis from 'ioredis';
import { seedUsers } from './seed-users';
import { seedKrakowGame } from './seed-krakow';
import { seedStrzyzowGame } from './seed-strzyzow';
import { seedNarrativeGame } from './seed-narrative';
import { seedSessions, seedStrzyzowSessions } from './seed-sessions';

const prisma = new PrismaClient();

async function createGameRun(prisma: PrismaClient, gameId: string) {
  const gameRun = await prisma.gameRun.create({
    data: {
      gameId,
      runNumber: 1,
      status: RunStatus.ACTIVE,
      endsAt: new Date(Date.now() + 120 * 60_000),
    },
  });
  await prisma.game.update({ where: { id: gameId }, data: { currentRun: 1 } });
  return gameRun;
}

async function seedRanking(redisUrl: string, gameRunId: string, scores: Record<string, number>) {
  const redis = new Redis(redisUrl);
  const key = `ranking:run:${gameRunId}`;
  for (const [userId, score] of Object.entries(scores)) {
    await redis.zadd(key, score, userId);
  }
  await redis.quit();
}

async function main() {
  console.log('Seeding database...');

  const { admin, jan, anna, marek } = await seedUsers(prisma);
  const players = { janId: jan.id, annaId: anna.id, marekId: marek.id };
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';

  // ── Kraków Game ──────────────────────────────────────────────────────────
  const krakowGame = await seedKrakowGame(prisma, admin.id, jan.id, anna.id, marek.id);
  const krakowRun = await createGameRun(prisma, krakowGame.id);
  await seedSessions(prisma, krakowGame.id, krakowRun.id, krakowGame.tasks, players);
  await seedRanking(redisUrl, krakowRun.id, {
    [marek.id]: 870,
    [jan.id]: 450,
    [anna.id]: 280,
  });

  // ── Strzyżów Game ───────────────────────────────────────────────────────
  const strzyzowGame = await seedStrzyzowGame(prisma, admin.id);
  const strzyzowRun = await createGameRun(prisma, strzyzowGame.id);
  await seedStrzyzowSessions(prisma, strzyzowGame.id, strzyzowRun.id, strzyzowGame.tasks, players);
  await seedRanking(redisUrl, strzyzowRun.id, {
    [marek.id]: 910,
    [jan.id]: 330,
    [anna.id]: 170,
  });

  // ── Narrative Game ──────────────────────────────────────────────────────
  await seedNarrativeGame(prisma, admin.id);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
