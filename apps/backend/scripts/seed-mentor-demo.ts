/**
 * Minimal demo seed for the mentor-tasks branch:
 *  - 1 admin (admin@citygame.pl / Admin123!)
 *  - 1 mentor (mentor@citygame.pl / Mentor123!)
 *  - 2 players (jan@test.pl / Test123!, anna@test.pl / Test123!)
 *  - 1 PUBLISHED game with one task of each new type
 *  - mentor assigned to the game
 *  - active run started so the player can submit
 *
 * Run via: bun run scripts/seed-mentor-demo.ts (from apps/backend)
 */
import {
  GameStatus,
  PrismaClient,
  RunStatus,
  SessionStatus,
  TaskType,
  UnlockMethod,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mentor demo…');

  const [adminPwd, mentorPwd, playerPwd] = await Promise.all([
    bcrypt.hash('Admin123!', 10),
    bcrypt.hash('Mentor123!', 10),
    bcrypt.hash('Test123!', 10),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@citygame.pl' },
    update: { passwordHash: adminPwd, role: UserRole.ADMIN },
    create: {
      email: 'admin@citygame.pl',
      passwordHash: adminPwd,
      displayName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@citygame.pl' },
    update: { passwordHash: mentorPwd, role: UserRole.MENTOR },
    create: {
      email: 'mentor@citygame.pl',
      passwordHash: mentorPwd,
      displayName: 'Mentor Marta',
      role: UserRole.MENTOR,
    },
  });

  const jan = await prisma.user.upsert({
    where: { email: 'jan@test.pl' },
    update: { passwordHash: playerPwd },
    create: {
      email: 'jan@test.pl',
      passwordHash: playerPwd,
      displayName: 'Jan Kowalski',
      role: UserRole.PLAYER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'anna@test.pl' },
    update: { passwordHash: playerPwd },
    create: {
      email: 'anna@test.pl',
      passwordHash: playerPwd,
      displayName: 'Anna Nowak',
      role: UserRole.PLAYER,
    },
  });

  const existing = await prisma.game.findFirst({
    where: { title: 'Demo nowych typów zadań' },
  });

  let gameId = existing?.id;

  if (!existing) {
    const game = await prisma.game.create({
      data: {
        title: 'Demo nowych typów zadań',
        description:
          'Spróbuj zadań AUDIO, PHOTO, VIDEO i PRACTICAL — ostatnie czeka na ocenę mentora.',
        city: 'Strzyżów',
        status: GameStatus.PUBLISHED,
        creatorId: admin.id,
        settings: {
          timeLimitMinutes: 120,
          pinRevealDistanceMeters: 100,
          maxPlayers: 50,
          joinAfterStart: true,
          hintsEnabled: true,
          teamMode: false,
          narrativeMode: false,
        },
        tasks: {
          create: [
            {
              title: 'Co to za zwierzę?',
              description: 'Posłuchaj nagrania i odgadnij, jakie to zwierzę.',
              type: TaskType.AUDIO,
              unlockMethod: UnlockMethod.NONE,
              orderIndex: 0,
              latitude: 49.8689,
              longitude: 21.7942,
              unlockConfig: { method: 'NONE' },
              verifyConfig: {
                type: 'AUDIO',
                audioUrl: 'https://www.soundjay.com/animal/sounds/dog-bark-3.mp3',
                mode: 'EXACT',
                expectedAnswer: 'pies',
              },
              maxPoints: 100,
            },
            {
              title: 'Rozpoznaj zabytek',
              description: 'Zobacz zdjęcie i wpisz nazwę tego zabytku.',
              type: TaskType.PHOTO,
              unlockMethod: UnlockMethod.NONE,
              orderIndex: 1,
              latitude: 49.8689,
              longitude: 21.7942,
              unlockConfig: { method: 'NONE' },
              verifyConfig: {
                type: 'PHOTO',
                imageUrl:
                  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Wawel_Royal_Castle_Sandomierska_Tower%2C_Krak%C3%B3w%2C_Poland.jpg/640px-Wawel_Royal_Castle_Sandomierska_Tower%2C_Krak%C3%B3w%2C_Poland.jpg',
                mode: 'EXACT',
                expectedAnswer: 'Wawel',
              },
              maxPoints: 100,
            },
            {
              title: 'Jaka to muzyka?',
              description: 'Obejrzyj krótkie wideo i odpowiedz, czyj to utwór.',
              type: TaskType.VIDEO,
              unlockMethod: UnlockMethod.NONE,
              orderIndex: 2,
              latitude: 49.8689,
              longitude: 21.7942,
              unlockConfig: { method: 'NONE' },
              verifyConfig: {
                type: 'VIDEO',
                videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
                mode: 'AI',
                prompt:
                  'Czy odpowiedź ucznia zawiera nazwisko Bach lub mówi o muzyce barokowej? Zwróć score 1.0 jeśli zawiera, 0.5 jeśli częściowo, 0.0 jeśli nie.',
                threshold: 0.7,
              },
              maxPoints: 100,
            },
            {
              title: 'Pompki — stanowisko mentora',
              description:
                'Zrób 20 pompek na stanowisku mentora. Mentor obserwuje i zatwierdza wykonanie.',
              type: TaskType.PRACTICAL,
              unlockMethod: UnlockMethod.NONE,
              orderIndex: 3,
              latitude: 49.8689,
              longitude: 21.7942,
              unlockConfig: { method: 'NONE' },
              verifyConfig: {
                type: 'PRACTICAL',
                criteria:
                  'Gracz wykonał co najmniej 20 prawidłowych pompek (klatka opuszczana do podłogi, ręce na szerokość barków). Mentor liczy na żywo.',
              },
              maxPoints: 200,
            },
          ],
        },
      },
    });
    gameId = game.id;
    console.log(`  Created game ${game.id} with 4 tasks`);
  } else {
    console.log(`  Reusing existing game ${existing.id}`);
  }

  // Assign mentor to the game
  await prisma.gameMentor.upsert({
    where: { gameId_mentorId: { gameId: gameId!, mentorId: mentor.id } },
    update: {},
    create: { gameId: gameId!, mentorId: mentor.id },
  });

  // Start a run if none active, so the player can submit
  let activeRun = await prisma.gameRun.findFirst({
    where: { gameId, status: RunStatus.ACTIVE },
  });
  if (!activeRun) {
    activeRun = await prisma.gameRun.create({
      data: {
        gameId: gameId!,
        runNumber: 1,
        status: RunStatus.ACTIVE,
        endsAt: new Date(Date.now() + 120 * 60_000),
      },
    });
    await prisma.game.update({
      where: { id: gameId! },
      data: { currentRun: 1 },
    });
    console.log(`  Started run #${activeRun.runNumber}`);
  }

  // Create a session for Jan so he can submit a PRACTICAL right away
  const firstTask = await prisma.task.findFirst({
    where: { gameId, orderIndex: 0 },
  });
  const practicalTask = await prisma.task.findFirst({
    where: { gameId, type: TaskType.PRACTICAL },
  });

  await prisma.gameSession.upsert({
    where: {
      gameRunId_userId: { gameRunId: activeRun.id, userId: jan.id },
    },
    update: {},
    create: {
      gameId: gameId!,
      gameRunId: activeRun.id,
      userId: jan.id,
      status: SessionStatus.ACTIVE,
      currentTaskId: firstTask?.id ?? null,
    },
  });

  // Pre-submit a PRACTICAL attempt as Jan so the mentor queue is non-empty.
  if (practicalTask) {
    const session = await prisma.gameSession.findFirst({
      where: { gameRunId: activeRun.id, userId: jan.id },
    });
    const existingAttempt = await prisma.taskAttempt.findFirst({
      where: { sessionId: session!.id, taskId: practicalTask.id },
    });
    if (!existingAttempt) {
      await prisma.taskAttempt.create({
        data: {
          sessionId: session!.id,
          taskId: practicalTask.id,
          userId: jan.id,
          status: 'PENDING',
          attemptNumber: 1,
          submission: { requestedAt: new Date().toISOString() },
          pointsAwarded: 0,
        },
      });
      console.log('  Created sample PENDING attempt for Jan on PRACTICAL task');
    }
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
