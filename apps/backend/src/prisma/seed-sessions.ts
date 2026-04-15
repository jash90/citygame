import { PrismaClient, SessionStatus, AttemptStatus } from '@prisma/client';

export async function seedSessions(
  prisma: PrismaClient,
  gameId: string,
  gameRunId: string,
  tasks: { id: string; maxPoints: number }[],
  players: { janId: string; annaId: string; marekId: string },
) {
  // Jan — partial completion, ACTIVE
  const janSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.janId, gameRunId,
      status: SessionStatus.ACTIVE, totalPoints: 450,
      currentTaskId: tasks[5]?.id ?? null,
    },
  });
  const janPoints = [100, 80, 140, 90, 40];
  await seedAttempts(prisma, janSession.id, tasks.slice(0, 5), players.janId, janPoints);

  // Anna — partial, ACTIVE
  const annaSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.annaId, gameRunId,
      status: SessionStatus.ACTIVE, totalPoints: 280,
      currentTaskId: tasks[3]?.id ?? null,
    },
  });
  const annaPoints = [95, 75, 110];
  await seedAttempts(prisma, annaSession.id, tasks.slice(0, 3), players.annaId, annaPoints);

  // Marek — full completion, COMPLETED
  const marekSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.marekId, gameRunId,
      status: SessionStatus.COMPLETED, totalPoints: 870,
      currentTaskId: null, completedAt: new Date(),
    },
  });
  const marekPoints = [100, 80, 150, 120, 60, 90, 70, 200];
  await seedAttempts(prisma, marekSession.id, tasks, players.marekId, marekPoints);

  console.log('Sessions seeded:', {
    jan: `5 tasks, 450 pts`,
    anna: `3 tasks, 280 pts`,
    marek: `${tasks.length} tasks, 870 pts`,
  });
}

export async function seedStrzyzowSessions(
  prisma: PrismaClient,
  gameId: string,
  gameRunId: string,
  tasks: { id: string; maxPoints: number }[],
  players: { janId: string; annaId: string; marekId: string },
) {
  const janSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.janId, gameRunId,
      status: SessionStatus.ACTIVE, totalPoints: 330,
      currentTaskId: tasks[4]?.id ?? null,
    },
  });
  await seedAttempts(prisma, janSession.id, tasks.slice(0, 4), players.janId, [60, 110, 100, 60]);

  const annaSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.annaId, gameRunId,
      status: SessionStatus.ACTIVE, totalPoints: 170,
      currentTaskId: tasks[2]?.id ?? null,
    },
  });
  await seedAttempts(prisma, annaSession.id, tasks.slice(0, 2), players.annaId, [55, 115]);

  const marekSession = await prisma.gameSession.create({
    data: {
      gameId, userId: players.marekId, gameRunId,
      status: SessionStatus.COMPLETED, totalPoints: 910,
      currentTaskId: null, completedAt: new Date(),
    },
  });
  await seedAttempts(prisma, marekSession.id, tasks, players.marekId, [60, 120, 130, 100, 70, 150, 80, 200]);

  console.log('Strzyżów sessions seeded:', {
    jan: '4 tasks, 330 pts',
    anna: '2 tasks, 170 pts',
    marek: `${tasks.length} tasks, 910 pts`,
  });
}

async function seedAttempts(
  prisma: PrismaClient,
  sessionId: string,
  tasks: { id: string; maxPoints: number }[],
  userId: string,
  pointsPerTask: number[],
) {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const points = pointsPerTask[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId, taskId: task.id, userId,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }
}
