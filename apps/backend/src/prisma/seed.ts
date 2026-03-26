import {
  AttemptStatus,
  GameStatus,
  PrismaClient,
  SessionStatus,
  TaskType,
  UnlockMethod,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ────────────────────────────────────────────────────────────────────

  const [adminPassword, playerPassword] = await Promise.all([
    bcrypt.hash('Admin123!', 10),
    bcrypt.hash('Test123!', 10),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@citygame.pl' },
    update: {},
    create: {
      email: 'admin@citygame.pl',
      passwordHash: adminPassword,
      displayName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  const jan = await prisma.user.upsert({
    where: { email: 'jan@test.pl' },
    update: {},
    create: {
      email: 'jan@test.pl',
      passwordHash: playerPassword,
      displayName: 'Jan Kowalski',
      role: UserRole.PLAYER,
    },
  });

  const anna = await prisma.user.upsert({
    where: { email: 'anna@test.pl' },
    update: {},
    create: {
      email: 'anna@test.pl',
      passwordHash: playerPassword,
      displayName: 'Anna Nowak',
      role: UserRole.PLAYER,
    },
  });

  const marek = await prisma.user.upsert({
    where: { email: 'marek@test.pl' },
    update: {},
    create: {
      email: 'marek@test.pl',
      passwordHash: playerPassword,
      displayName: 'Marek Wiśniewski',
      role: UserRole.PLAYER,
    },
  });

  console.log('Users seeded:', admin.email, jan.email, anna.email, marek.email);

  // ── Hashed answers for TEXT_EXACT tasks ─────────────────────────────────────

  const [zygmuntHash, zapiekankaHash] = await Promise.all([
    bcrypt.hash('zygmunt', 10),
    bcrypt.hash('zapiekanka', 10),
  ]);

  // ── Demo Game ────────────────────────────────────────────────────────────────

  // Delete existing game data to allow idempotent re-seeding
  const existingGames = await prisma.game.findMany({ where: { title: 'Śladami Historii Krakowa' }, select: { id: true } });
  if (existingGames.length > 0) {
    const gameIds = existingGames.map(g => g.id);
    await prisma.taskAttempt.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
    await prisma.hintUsage.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
    await prisma.gameSession.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.hint.deleteMany({ where: { task: { gameId: { in: gameIds } } } });
    await prisma.task.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  }

  const game = await prisma.game.create({
    data: {
      title: 'Śladami Historii Krakowa',
      description:
        'Wyrusz na niezapomnianą podróż śladami historii Krakowa. Odkrywaj legendy, zabytki i tajemnice królewskiego miasta.',
      city: 'Kraków',
      status: GameStatus.PUBLISHED,
      settings: { maxPlayers: 200, allowHints: true, timeLimitMinutes: 180 },
      creatorId: admin.id,
      tasks: {
        create: [
          // 1 — Smok Wawelski
          {
            title: 'Smok Wawelski',
            description:
              'Odszukaj legendarną jaskinię Smoka Wawelskiego u podnóża Wawelu. Zeskanuj kod QR ukryty przy wejściu do jaskini.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 50.054,
            longitude: 19.9352,
            unlockConfig: { radiusMeters: 80, targetLat: 50.054, targetLng: 19.9352 },
            verifyConfig: { expectedHash: 'sha256:smok_wawelski_2024' },
            maxPoints: 100,
            timeLimitSec: 600,
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj przy jaskini smoka', pointPenalty: 10 },
                { orderIndex: 1, content: 'Pod Wawelem, nad Wisłą', pointPenalty: 20 },
              ],
            },
          },
          // 2 — Dzwon Zygmunta
          {
            title: 'Dzwon Zygmunta',
            description:
              'Stojąc przed katedrą wawelską, odpowiedz na pytanie: jak nazywa się największy dzwon w Polsce, wiszący na wieży katedry?',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 50.0543,
            longitude: 19.9356,
            unlockConfig: { radiusMeters: 60, targetLat: 50.0543, targetLng: 19.9356 },
            verifyConfig: { answerHash: zygmuntHash },
            maxPoints: 80,
            timeLimitSec: null,
          },
          // 3 — Sukiennice
          {
            title: 'Sukiennice — Zrób zdjęcie',
            description:
              'Zrób zdjęcie Sukiennic na Rynku Głównym w Krakowie. Upewnij się, że na zdjęciu widoczna jest charakterystyczna renesansowa attyka.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 50.0617,
            longitude: 19.9373,
            unlockConfig: { radiusMeters: 100, targetLat: 50.0617, targetLng: 19.9373 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia Sukiennice na Rynku Głównym w Krakowie. Szukaj charakterystycznej renesansowej attyki.',
              threshold: 0.6,
            },
            maxPoints: 150,
            timeLimitSec: null,
          },
          // 4 — Kościół Mariacki
          {
            title: 'Kościół Mariacki — Hejnał',
            description:
              'Przy kościele Mariackim odpowiedz na pytanie: dlaczego hejnał mariacki urywa się nagle w połowie melodii?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 3,
            latitude: 50.0617,
            longitude: 19.9394,
            unlockConfig: { qrCode: 'KOSCIOL_MARIACKI_HEJNAL' },
            verifyConfig: {
              prompt:
                'Oceń odpowiedź na pytanie: Dlaczego hejnał mariacki urywa się w połowie? Poprawna odpowiedź powinna wspomnieć o tatarskim łuczniku.',
              threshold: 0.65,
            },
            maxPoints: 120,
            timeLimitSec: 300,
          },
          // 5 — Barbakan
          {
            title: 'Barbakan',
            description:
              'Podejdź do Barbakanu — gotyckiej fortecy broniącej niegdyś wjazdu do Krakowa. System zweryfikuje Twoje położenie GPS.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 50.0653,
            longitude: 19.9418,
            unlockConfig: { radiusMeters: 80, targetLat: 50.0653, targetLng: 19.9418 },
            verifyConfig: {
              targetLat: 50.0653,
              targetLng: 19.9418,
              radiusMeters: 30,
            },
            maxPoints: 60,
            timeLimitSec: null,
          },
          // 6 — Collegium Maius
          {
            title: 'Collegium Maius',
            description:
              'Odszukaj wejście do Collegium Maius — najstarszego budynku Uniwersytetu Jagiellońskiego. Zeskanuj kod QR przy bramie.',
            type: TaskType.QR_SCAN,
            unlockMethod: UnlockMethod.QR,
            orderIndex: 5,
            latitude: 50.0618,
            longitude: 19.9332,
            unlockConfig: { qrCode: 'COLLEGIUM_MAIUS_BRAMA' },
            verifyConfig: { expectedHash: 'sha256:collegium_maius_2024' },
            maxPoints: 90,
            timeLimitSec: null,
          },
          // 7 — Kazimierz — Plac Nowy
          {
            title: 'Kazimierz — Plac Nowy',
            description:
              'Stoisz na Placu Nowym w Kazimierzu, słynącym z ulicznego jedzenia. Jak nazywa się kultowe krakowskie danie serwowane tutaj przez całą dobę?',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 50.051,
            longitude: 19.9455,
            unlockConfig: { radiusMeters: 70, targetLat: 50.051, targetLng: 19.9455 },
            verifyConfig: { answerHash: zapiekankaHash },
            maxPoints: 70,
            timeLimitSec: null,
          },
          // 8 — Kopiec Kościuszki
          {
            title: 'Kopiec Kościuszki',
            description:
              'Zrób zdjęcie Kopca Kościuszki widocznego na wzgórzu. Uwiecznij ten wyjątkowy pomnik usypany z ziemi z pól bitewnych, gdzie walczył Tadeusz Kościuszko.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 50.0545,
            longitude: 19.8932,
            unlockConfig: { radiusMeters: 150, targetLat: 50.0545, targetLng: 19.8932 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia Kopiec Kościuszki w Krakowie, widoczny z daleka na wzgórzu.',
              threshold: 0.6,
            },
            maxPoints: 200,
            timeLimitSec: null,
          },
        ],
      },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' } },
    },
  });

  console.log(`Game "${game.title}" created with ${game.tasks.length} tasks.`);

  const tasks = game.tasks;

  // ── Demo Sessions & Attempts ─────────────────────────────────────────────────

  // Jan — 5 tasks completed, ACTIVE
  const janSession = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      userId: jan.id,
      status: SessionStatus.ACTIVE,
      totalPoints: 450,
      currentTaskId: tasks[5]?.id ?? null,
    },
  });

  const janCompletedTasks = tasks.slice(0, 5);
  const janPointsPerTask = [100, 80, 140, 90, 40]; // some partial

  for (let i = 0; i < janCompletedTasks.length; i++) {
    const task = janCompletedTasks[i];
    const points = janPointsPerTask[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: janSession.id,
        taskId: task.id,
        userId: jan.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  // Anna — 3 tasks completed, ACTIVE
  const annaSession = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      userId: anna.id,
      status: SessionStatus.ACTIVE,
      totalPoints: 280,
      currentTaskId: tasks[3]?.id ?? null,
    },
  });

  const annaCompletedTasks = tasks.slice(0, 3);
  const annaPointsPerTask = [95, 75, 110];

  for (let i = 0; i < annaCompletedTasks.length; i++) {
    const task = annaCompletedTasks[i];
    const points = annaPointsPerTask[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: annaSession.id,
        taskId: task.id,
        userId: anna.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  // Marek — all 8 tasks completed, COMPLETED
  const marekSession = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      userId: marek.id,
      status: SessionStatus.COMPLETED,
      totalPoints: 870,
      currentTaskId: null,
      completedAt: new Date(),
    },
  });

  const marekPointsPerTask = [100, 80, 150, 120, 60, 90, 70, 200];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const points = marekPointsPerTask[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: marekSession.id,
        taskId: task.id,
        userId: marek.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  console.log('Sessions seeded:', {
    jan: `${janCompletedTasks.length} tasks, ${janSession.totalPoints} pts`,
    anna: `${annaCompletedTasks.length} tasks, ${annaSession.totalPoints} pts`,
    marek: `${tasks.length} tasks, ${marekSession.totalPoints} pts`,
  });

  // ── Redis Ranking ─────────────────────────────────────────────────────────────

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');
  const rankingKey = `ranking:game:${game.id}`;

  await redis.zadd(rankingKey, 870, marek.id);
  await redis.zadd(rankingKey, 450, jan.id);
  await redis.zadd(rankingKey, 280, anna.id);
  await redis.quit();

  console.log(`Redis ranking seeded for game ${game.id}`);
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
