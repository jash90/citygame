/**
 * One-shot seed: append 3 extra ENDED runs to "Tajemnice Strzyżowa"
 * with varied player counts, durations, points and completion rates,
 * so the per-run analytics page has real comparison data and trends.
 *
 * Run: bun run --filter=@citygame/backend exec scripts/seed-multi-runs.ts
 */
import {
  AttemptStatus,
  PrismaClient,
  RunStatus,
  SessionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const GAME_ID = '285d6314-6625-47a8-9a52-1183343c0dd6';

const USERS = {
  jan: 'a7351c31-2f7a-4b75-bd5d-86380a41ef60',
  anna: '5b2f1486-ef69-48aa-acbe-ed8533aea67b',
  marek: '9c5c6c8d-a74b-46d5-b284-b80d90025d13',
  admin: '1fe97a75-eb9a-4fb6-94be-f817e4281b41',
};

// Ordered by orderIndex 0..7 — matches Task.orderIndex in DB.
const TASKS = [
  { id: 'bc6f00ab-2f55-4579-93a4-e8a9ea39d74e', maxPoints: 60 },
  { id: 'f9ca6d24-cda4-4477-a9ce-7b1dcb6690ba', maxPoints: 120 },
  { id: '339bd587-f86e-4c90-af1f-28e8e8687780', maxPoints: 130 },
  { id: '431771a4-d66a-4ce3-a6b2-a866a167e034', maxPoints: 100 },
  { id: '0dc6cb54-8f1b-4efe-8eee-2d3e2040dfd0', maxPoints: 70 },
  { id: 'ef7b4ca5-c6b2-4ebb-9797-ba181de5e3ac', maxPoints: 150 },
  { id: '4769538c-c3f8-4a63-a220-070d8fd9ec8b', maxPoints: 80 },
  { id: '95d37674-e540-4468-8973-5d7345f1e0bc', maxPoints: 200 },
];

interface SessionSpec {
  userId: string;
  tasksCompleted: number; // 0..8 — how many tasks (in order) the player solved
  /** Optional per-task multiplier (0..1) for points scored on each completed task. */
  scoreMultiplier?: number;
  /** Extra wrong attempts before each correct one, to skew difficulty chart. */
  wrongAttemptsPerTask?: number;
  durationMin: number; // total session duration
  status: SessionStatus;
}

interface RunSpec {
  runNumber: number;
  startedAt: Date;
  durationMin: number;
  sessions: SessionSpec[];
}

const RUNS: RunSpec[] = [
  {
    // Krótki sprint — najszybsza sesja, wysoka completion rate
    runNumber: 2,
    startedAt: new Date('2026-05-10T09:00:00Z'),
    durationMin: 60,
    sessions: [
      { userId: USERS.marek, tasksCompleted: 8, scoreMultiplier: 0.95, durationMin: 38, status: SessionStatus.COMPLETED },
      { userId: USERS.jan,   tasksCompleted: 7, scoreMultiplier: 0.85, durationMin: 42, status: SessionStatus.COMPLETED },
      { userId: USERS.anna,  tasksCompleted: 6, scoreMultiplier: 0.80, wrongAttemptsPerTask: 1, durationMin: 47, status: SessionStatus.COMPLETED },
      { userId: USERS.admin, tasksCompleted: 3, scoreMultiplier: 0.60, durationMin: 25, status: SessionStatus.ABANDONED },
    ],
  },
  {
    // Trudna sesja — długie czasy, niska completion rate
    runNumber: 3,
    startedAt: new Date('2026-05-12T11:00:00Z'),
    durationMin: 180,
    sessions: [
      { userId: USERS.jan,   tasksCompleted: 8, scoreMultiplier: 0.90, wrongAttemptsPerTask: 2, durationMin: 145, status: SessionStatus.COMPLETED },
      { userId: USERS.marek, tasksCompleted: 5, scoreMultiplier: 0.70, wrongAttemptsPerTask: 1, durationMin: 178, status: SessionStatus.TIMED_OUT },
      { userId: USERS.anna,  tasksCompleted: 3, scoreMultiplier: 0.55, wrongAttemptsPerTask: 2, durationMin: 175, status: SessionStatus.TIMED_OUT },
    ],
  },
  {
    // Średnia sesja — solidna, mieszane wyniki
    runNumber: 4,
    startedAt: new Date('2026-05-14T14:00:00Z'),
    durationMin: 120,
    sessions: [
      { userId: USERS.marek, tasksCompleted: 8, scoreMultiplier: 0.88, durationMin: 85,  status: SessionStatus.COMPLETED },
      { userId: USERS.anna,  tasksCompleted: 7, scoreMultiplier: 0.82, durationMin: 92,  status: SessionStatus.COMPLETED },
      { userId: USERS.jan,   tasksCompleted: 2, scoreMultiplier: 0.50, durationMin: 35,  status: SessionStatus.ABANDONED },
    ],
  },
];

async function seedRun(run: RunSpec) {
  const endedAt = new Date(run.startedAt.getTime() + run.durationMin * 60_000);

  // Idempotency: skip if this runNumber already exists for this game.
  const existing = await prisma.gameRun.findFirst({
    where: { gameId: GAME_ID, runNumber: run.runNumber },
  });
  if (existing) {
    console.log(`  Run #${run.runNumber} already exists — skipping.`);
    return;
  }

  const gameRun = await prisma.gameRun.create({
    data: {
      gameId: GAME_ID,
      runNumber: run.runNumber,
      status: RunStatus.ENDED,
      startedAt: run.startedAt,
      endsAt: endedAt,
      endedAt,
    },
  });

  let sessionsCreated = 0;
  let attemptsCreated = 0;

  for (const spec of run.sessions) {
    const sessionStart = run.startedAt;
    const sessionEnd = new Date(sessionStart.getTime() + spec.durationMin * 60_000);
    const isCompleted = spec.status === SessionStatus.COMPLETED;

    const scoreMul = spec.scoreMultiplier ?? 0.8;
    const wrongPer = spec.wrongAttemptsPerTask ?? 0;

    let totalPoints = 0;
    const attempts: Parameters<typeof prisma.taskAttempt.create>[0]['data'][] = [];

    for (let i = 0; i < spec.tasksCompleted; i++) {
      const task = TASKS[i];
      const pointsAwarded = Math.round(task.maxPoints * scoreMul);
      totalPoints += pointsAwarded;

      // Wrong attempts first (skew difficulty chart).
      for (let w = 0; w < wrongPer; w++) {
        attempts.push({
          sessionId: '', // filled after session create
          taskId: task.id,
          userId: spec.userId,
          status: AttemptStatus.INCORRECT,
          attemptNumber: w + 1,
          submission: { value: `wrong-${w + 1}` },
          pointsAwarded: 0,
          timeTakenSec: 30 + w * 10,
          createdAt: new Date(sessionStart.getTime() + i * 5 * 60_000 + w * 30_000),
        });
      }

      // The successful attempt
      attempts.push({
        sessionId: '',
        taskId: task.id,
        userId: spec.userId,
        status: AttemptStatus.CORRECT,
        attemptNumber: wrongPer + 1,
        submission: { value: `correct-${i}` },
        pointsAwarded,
        timeTakenSec: 45 + i * 5,
        createdAt: new Date(sessionStart.getTime() + i * 5 * 60_000 + wrongPer * 30_000),
        clientCapturedAt: new Date(sessionStart.getTime() + i * 5 * 60_000),
      });
    }

    const session = await prisma.gameSession.create({
      data: {
        gameId: GAME_ID,
        userId: spec.userId,
        gameRunId: gameRun.id,
        status: spec.status,
        totalPoints,
        startedAt: sessionStart,
        completedAt: isCompleted || spec.status !== SessionStatus.ACTIVE ? sessionEnd : null,
      },
    });
    sessionsCreated++;

    for (const a of attempts) {
      a.sessionId = session.id;
      await prisma.taskAttempt.create({ data: a });
      attemptsCreated++;
    }
  }

  console.log(
    `  Run #${run.runNumber}: ${sessionsCreated} sessions, ${attemptsCreated} attempts, ${run.durationMin} min window.`,
  );
}

async function main() {
  console.log('Seeding additional runs for "Tajemnice Strzyżowa"...');

  for (const run of RUNS) {
    await seedRun(run);
  }

  // Bump currentRun on the game so admin UI reflects latest.
  await prisma.game.update({
    where: { id: GAME_ID },
    data: { currentRun: Math.max(...RUNS.map((r) => r.runNumber)) },
  });

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
