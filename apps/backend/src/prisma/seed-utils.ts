import { PrismaClient } from '@prisma/client';

/**
 * Delete all data for games matching the given title(s).
 * Handles cascading deletions in the correct order.
 */
export async function cleanGames(prisma: PrismaClient, titles: string[]): Promise<void> {
  const existing = await prisma.game.findMany({
    where: { title: { in: titles } },
    select: { id: true },
  });
  if (existing.length === 0) return;

  const gameIds = existing.map((g) => g.id);
  await prisma.taskAttempt.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
  await prisma.hintUsage.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
  await prisma.gameSession.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.gameRun.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.teamMember.deleteMany({ where: { team: { gameId: { in: gameIds } } } });
  await prisma.team.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.hint.deleteMany({ where: { task: { gameId: { in: gameIds } } } });
  await prisma.task.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
}
