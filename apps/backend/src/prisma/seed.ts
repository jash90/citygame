import {
  AttemptStatus,
  GameStatus,
  PrismaClient,
  RunStatus,
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
    update: { passwordHash: adminPassword },
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

  const [zygmuntHash, zapiekankaHash, wislokHash, synagogaHash, rekopisHash] = await Promise.all([
    bcrypt.hash('zygmunt', 10),
    bcrypt.hash('zapiekanka', 10),
    bcrypt.hash('wisłok', 10),
    bcrypt.hash('synagoga', 10),
    bcrypt.hash('wisłok', 10), // cipher answer for narrative game
  ]);

  // ── Demo Game ────────────────────────────────────────────────────────────────

  // Delete existing game data to allow idempotent re-seeding
  const existingGames = await prisma.game.findMany({ where: { title: 'Śladami Historii Krakowa' }, select: { id: true } });
  if (existingGames.length > 0) {
    const gameIds = existingGames.map(g => g.id);
    await prisma.taskAttempt.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
    await prisma.hintUsage.deleteMany({ where: { session: { gameId: { in: gameIds } } } });
    await prisma.gameSession.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.gameRun.deleteMany({ where: { gameId: { in: gameIds } } });
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
          // 2 — Tajemnica katedry
          {
            title: 'Tajemnica katedry wawelskiej',
            description:
              'Stojąc przed katedrą wawelską, odpowiedz na pytanie: jak nazywa się największy dzwon w Polsce, wiszący na wieży katedry? Wpisz samo imię (małymi literami).',
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

  // ── Demo Game Run ────────────────────────────────────────────────────────────

  const gameRun = await prisma.gameRun.create({
    data: {
      gameId: game.id,
      runNumber: 1,
      status: RunStatus.ACTIVE,
      endsAt: new Date(Date.now() + 120 * 60_000), // 2 hours from now
    },
  });

  await prisma.game.update({
    where: { id: game.id },
    data: { currentRun: 1 },
  });

  // ── Demo Sessions & Attempts ─────────────────────────────────────────────────

  // Jan — 5 tasks completed, ACTIVE
  const janSession = await prisma.gameSession.create({
    data: {
      gameId: game.id,
      userId: jan.id,
      gameRunId: gameRun.id,
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
      gameRunId: gameRun.id,
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
      gameRunId: gameRun.id,
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

  // ── Strzyżów Game ───────────────────────────────────────────────────────────

  // Delete existing Strzyżów game data to allow idempotent re-seeding
  const existingStrzyzowGames = await prisma.game.findMany({
    where: { title: 'Tajemnice Strzyżowa' },
    select: { id: true },
  });
  if (existingStrzyzowGames.length > 0) {
    const sGameIds = existingStrzyzowGames.map((g) => g.id);
    await prisma.taskAttempt.deleteMany({ where: { session: { gameId: { in: sGameIds } } } });
    await prisma.hintUsage.deleteMany({ where: { session: { gameId: { in: sGameIds } } } });
    await prisma.gameSession.deleteMany({ where: { gameId: { in: sGameIds } } });
    await prisma.gameRun.deleteMany({ where: { gameId: { in: sGameIds } } });
    await prisma.hint.deleteMany({ where: { task: { gameId: { in: sGameIds } } } });
    await prisma.task.deleteMany({ where: { gameId: { in: sGameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: sGameIds } } });
  }

  const strzyzowGame = await prisma.game.create({
    data: {
      title: 'Tajemnice Strzyżowa',
      description:
        'Wyrusz na wyprawę po malowniczym Strzyżowie — odkryj historię, zabytki i tajemnice tego urokliwego miasteczka na Podkarpaciu.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: { maxPlayers: 100, allowHints: true, timeLimitMinutes: 150 },
      creatorId: admin.id,
      tasks: {
        create: [
          // 1 — Pomnik Niepodległości (Rynek)
          {
            title: 'Pomnik Niepodległości',
            description:
              'Rozpocznij swoją przygodę na strzyżowskim Rynku! Podejdź do Pomnika Niepodległości, który upamiętnia odzyskanie wolności w 1918 roku. To serce miasta — tutaj od wieków toczyło się życie mieszkańców Strzyżowa.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 49.8685,
            longitude: 21.7877,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 60,
            timeLimitSec: null,
          },
          // 2 — Kościół Niepokalanego Poczęcia NMP
          {
            title: 'Kościół Niepokalanego Poczęcia NMP',
            description:
              'Zrób zdjęcie kościoła parafialnego pw. Niepokalanego Poczęcia NMP. Ta świątynia z XVIII wieku to duchowe centrum Strzyżowa. Zwróć uwagę na charakterystyczną wieżę i barokowe elementy fasady.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 49.8678,
            longitude: 21.7851,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8678, targetLng: 21.7851 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia kościół katolicki z wieżą i barokową fasadą. Powinien być widoczny budynek sakralny.',
              threshold: 0.6,
            },
            maxPoints: 120,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Kościół znajduje się przy południowej stronie Rynku', pointPenalty: 10 },
                { orderIndex: 1, content: 'Szukaj budynku z charakterystyczną wieżą kościelną', pointPenalty: 20 },
              ],
            },
          },
          // 3 — Zespół dworski Wołkowickich
          {
            title: 'Zespół dworski Wołkowickich',
            description:
              'Stoisz przed zabytkowym zespołem dworskim Wołkowickich, który dziś pełni funkcję ośrodka kultury. Odpowiedz na pytanie: jaką rolę pełnił dwór szlachecki w życiu małego polskiego miasteczka w XVIII i XIX wieku?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 49.8731,
            longitude: 21.7698,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8731, targetLng: 21.7698 },
            verifyConfig: {
              prompt:
                'Oceń odpowiedź na pytanie o rolę dworu szlacheckiego w życiu małego polskiego miasteczka. Poprawna odpowiedź powinna wspomnieć o co najmniej jednym z: centrum administracyjne, patronat kulturalny, ośrodek gospodarczy, siedziba właściciela ziemskiego, życie społeczne.',
              threshold: 0.6,
            },
            maxPoints: 130,
            timeLimitSec: 300,
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomyśl o funkcjach: administracja, kultura, gospodarka', pointPenalty: 15 },
              ],
            },
          },
          // 4 — Park Miejski nad rzeką
          {
            title: 'Park Miejski nad rzeką',
            description:
              'Spaceruj do parku miejskiego nad rzeką. Zrób zdjęcie alejki parkowej z widokiem na rzekę lub mostkiem. Rzeka przepływająca przez miasto to jego prawdziwe bogactwo — towarzyszy Strzyżowowi od samego początku istnienia.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 3,
            latitude: 49.8644,
            longitude: 21.8005,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8644, targetLng: 21.8005 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia park miejski — szukaj alejek, zieleni, ławek, drzew lub widoku na rzekę albo mostek w otoczeniu parkowym.',
              threshold: 0.55,
            },
            maxPoints: 100,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj zielonego terenu z alejkami nad rzeką', pointPenalty: 10 },
                { orderIndex: 1, content: 'Skieruj się w stronę rzeki, na południe od Rynku', pointPenalty: 20 },
              ],
            },
          },
          // 5 — Most nad rzeką
          {
            title: 'Zagadka na moście',
            description:
              'Stoisz na moście nad rzeką, która przepływa przez Strzyżów. Jak nazywa się ta rzeka, towarzysząca miastu od wieków? Wpisz jej nazwę (małymi literami, z polskimi znakami).',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 49.8672,
            longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { answerHash: wislokHash },
            maxPoints: 70,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Ta rzeka jest dopływem Sanu', pointPenalty: 10 },
              ],
            },
          },
          // 6 — Cmentarz Wojenny z I Wojny Światowej
          {
            title: 'Cmentarz Wojenny z I Wojny Światowej',
            description:
              'Odwiedź cmentarz wojenny z I wojny światowej — miejsce pamięci żołnierzy poległych na froncie galicyjskim. Zrób zdjęcie nagrobków lub pomnika centralnego. To ważne miejsce przypominające o tragicznej historii tych ziem.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 5,
            latitude: 49.8722,
            longitude: 21.7833,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8722, targetLng: 21.7833 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia cmentarz wojenny — szukaj nagrobków wojskowych, krzyży cmentarnych lub pomnika pamiątkowego w otoczeniu zieleni.',
              threshold: 0.55,
            },
            maxPoints: 150,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Cmentarz znajduje się na północny wschód od centrum miasta', pointPenalty: 15 },
                { orderIndex: 1, content: 'Szukaj miejsca z wojskowymi nagrobkami i krzyżami', pointPenalty: 25 },
              ],
            },
          },
          // 7 — Dawna Synagoga
          {
            title: 'Wielokulturowe dziedzictwo',
            description:
              'Przed Tobą zabytkowy budynek — świadectwo wielokulturowej przeszłości Strzyżowa. Przed II wojną światową żydowska społeczność stanowiła znaczną część mieszkańców i miała tu swój dom modlitwy. Jak nazywa się typ budynku, w którym modlili się wyznawcy judaizmu? (jedno słowo, małymi literami)',
            type: TaskType.TEXT_EXACT,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 49.8693,
            longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: { answerHash: synagogaHash },
            maxPoints: 80,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Odpowiedź to nazwa tego typu budynku sakralnego', pointPenalty: 10 },
                { orderIndex: 1, content: 'Nazwa pochodzi od greckiego słowa', pointPenalty: 15 },
              ],
            },
          },
          // 8 — Wzgórza Strzyżowskie — Panorama
          {
            title: 'Wzgórza Strzyżowskie — Panorama',
            description:
              'Na koniec wyprawy wejdź na jedno ze wzgórz otaczających Strzyżów, by podziwiać panoramę miasta i okolicznych Pogórzy. Zrób zdjęcie rozległej panoramy — postaraj się uchwycić widok na miasto w dolinie. Miasto leży w malowniczej dolinie rzecznej, otoczone wzgórzami Pogórza Strzyżowskiego.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 49.8807,
            longitude: 21.8021,
            unlockConfig: { radiusMeters: 150, targetLat: 49.8807, targetLng: 21.8021 },
            verifyConfig: {
              prompt:
                'Oceń czy zdjęcie przedstawia panoramę małego miasta lub miasteczka widzianego ze wzgórza. Szukaj widoku z góry na zabudowę w dolinie, otoczoną wzgórzami lub zielenią.',
              threshold: 0.5,
            },
            maxPoints: 200,
            timeLimitSec: null,
            hints: {
              create: [
                { orderIndex: 0, content: 'Punkt widokowy jest na wzgórzach na północny zachód od centrum', pointPenalty: 20 },
                { orderIndex: 1, content: 'Zrób zdjęcie z wysokiego miejsca — panorama powinna obejmować całe miasto', pointPenalty: 30 },
              ],
            },
          },
        ],
      },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' } },
    },
  });

  console.log(`Game "${strzyzowGame.title}" created with ${strzyzowGame.tasks.length} tasks.`);

  const strzyzowTasks = strzyzowGame.tasks;

  // ── Strzyżów Demo Game Run ──────────────────────────────────────────────────

  const strzyzowRun = await prisma.gameRun.create({
    data: {
      gameId: strzyzowGame.id,
      runNumber: 1,
      status: RunStatus.ACTIVE,
      endsAt: new Date(Date.now() + 120 * 60_000),
    },
  });

  await prisma.game.update({
    where: { id: strzyzowGame.id },
    data: { currentRun: 1 },
  });

  // ── Strzyżów Demo Sessions & Attempts ──────────────────────────────────────

  // Jan — 4 tasks completed, ACTIVE
  const janStrzyzowSession = await prisma.gameSession.create({
    data: {
      gameId: strzyzowGame.id,
      userId: jan.id,
      gameRunId: strzyzowRun.id,
      status: SessionStatus.ACTIVE,
      totalPoints: 330,
      currentTaskId: strzyzowTasks[4]?.id ?? null,
    },
  });

  const janStrzyzowCompleted = strzyzowTasks.slice(0, 4);
  const janStrzyzowPoints = [60, 110, 100, 60];

  for (let i = 0; i < janStrzyzowCompleted.length; i++) {
    const task = janStrzyzowCompleted[i];
    const points = janStrzyzowPoints[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: janStrzyzowSession.id,
        taskId: task.id,
        userId: jan.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  // Anna — 2 tasks completed, ACTIVE
  const annaStrzyzowSession = await prisma.gameSession.create({
    data: {
      gameId: strzyzowGame.id,
      userId: anna.id,
      gameRunId: strzyzowRun.id,
      status: SessionStatus.ACTIVE,
      totalPoints: 170,
      currentTaskId: strzyzowTasks[2]?.id ?? null,
    },
  });

  const annaStrzyzowCompleted = strzyzowTasks.slice(0, 2);
  const annaStrzyzowPoints = [55, 115];

  for (let i = 0; i < annaStrzyzowCompleted.length; i++) {
    const task = annaStrzyzowCompleted[i];
    const points = annaStrzyzowPoints[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: annaStrzyzowSession.id,
        taskId: task.id,
        userId: anna.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  // Marek — all 8 tasks completed, COMPLETED (perfect score)
  const marekStrzyzowSession = await prisma.gameSession.create({
    data: {
      gameId: strzyzowGame.id,
      userId: marek.id,
      gameRunId: strzyzowRun.id,
      status: SessionStatus.COMPLETED,
      totalPoints: 910,
      currentTaskId: null,
      completedAt: new Date(),
    },
  });

  const marekStrzyzowPoints = [60, 120, 130, 100, 70, 150, 80, 200];

  for (let i = 0; i < strzyzowTasks.length; i++) {
    const task = strzyzowTasks[i];
    const points = marekStrzyzowPoints[i] ?? task.maxPoints;
    await prisma.taskAttempt.create({
      data: {
        sessionId: marekStrzyzowSession.id,
        taskId: task.id,
        userId: marek.id,
        status: AttemptStatus.CORRECT,
        attemptNumber: 1,
        submission: { answer: 'demo_submission' },
        pointsAwarded: points,
      },
    });
  }

  console.log('Strzyżów sessions seeded:', {
    jan: `${janStrzyzowCompleted.length} tasks, ${janStrzyzowSession.totalPoints} pts`,
    anna: `${annaStrzyzowCompleted.length} tasks, ${annaStrzyzowSession.totalPoints} pts`,
    marek: `${strzyzowTasks.length} tasks, ${marekStrzyzowSession.totalPoints} pts`,
  });

  // ── Narrative Game: "Zagubiony Rękopis Kronikarza" ────────────────────────────

  const existingNarrativeGames = await prisma.game.findMany({
    where: { title: 'Zagubiony Rękopis Kronikarza' },
  });
  if (existingNarrativeGames.length > 0) {
    const nGameIds = existingNarrativeGames.map((g) => g.id);
    await prisma.taskAttempt.deleteMany({ where: { session: { gameId: { in: nGameIds } } } });
    await prisma.hintUsage.deleteMany({ where: { session: { gameId: { in: nGameIds } } } });
    await prisma.gameSession.deleteMany({ where: { gameId: { in: nGameIds } } });
    await prisma.gameRun.deleteMany({ where: { gameId: { in: nGameIds } } });
    await prisma.hint.deleteMany({ where: { task: { gameId: { in: nGameIds } } } });
    await prisma.task.deleteMany({ where: { gameId: { in: nGameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: nGameIds } } });
  }

  const sc = (ctx: Record<string, string>) => JSON.stringify(ctx);

  const narrativeGame = await prisma.game.create({
    data: {
      title: 'Zagubiony Rękopis Kronikarza',
      description:
        'Rok 1782. Kronikarz Maciej Bielicki ukrył w Strzyżowie rękopis z tajemnicą założenia miasta. Podążaj jego śladami, zbieraj fragmenty i rozwiąż zagadkę sprzed wieków.',
      city: 'Strzyżów',
      status: GameStatus.PUBLISHED,
      settings: {
        maxPlayers: 100,
        allowHints: true,
        timeLimitMinutes: 180,
        narrative: {
          isNarrative: true,
          theme: 'Tajemnica literacka',
          prologue:
            'Strzyżów, rok 1782. Miejski kronikarz Maciej Bielicki spisywał dzieje miasteczka od lat. Pewnej jesiennej nocy, przerażony czymś co odkrył w starych dokumentach, podzielił swój najważniejszy rękopis na osiem fragmentów i ukrył je w różnych zakątkach miasta.\n\nNa łożu śmierci wyszeptał jedynie: „Kto zbierze wszystkie fragmenty, pozna prawdziwą historię Strzyżowa. Niech szuka tam, gdzie bije serce miasta..."\n\nMinęły wieki. Dziś w Twoich rękach spoczywa szansa odkrycia tego, co kronikarz tak desperacko próbował ochronić — i jednocześnie przekazać potomnym.',
          epilogue:
            'Zebrałeś wszystkie fragmenty rękopisu Bielickiego. Kronikarz odkrył, że Strzyżów nie powstał przypadkiem — to miejsce od zarania dziejów było punktem spotkań kultur, szlaków i ludzi. Wisłok łączył, nie dzielił. Kościelne dzwony biły dla wszystkich. Szlachta, mieszczanie, żydowska gmina — razem tworzyli tkankę tego miasta.\n\nBielicki ukrył tę prawdę, bo w czasach rozbiorów jedność była niebezpieczna. Ale wiedział, że kiedyś ktoś ją odkryje. I właśnie to zrobiłeś.',
        },
      },
      creatorId: admin.id,
      tasks: {
        create: [
          // 1 — Rynek: Początek śladu
          {
            title: 'Serce miasta',
            description:
              'Podejdź do centrum Rynku w Strzyżowie. Tu zaczyna się Twoja podróż śladami kronikarza Bielickiego.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 0,
            latitude: 49.8685,
            longitude: 21.7877,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8685, targetLng: 21.7877 },
            verifyConfig: { targetLat: 49.8685, targetLng: 21.7877, radiusMeters: 30 },
            maxPoints: 50,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Stoisz na Rynku — od wieków sercu Strzyżowa. Tu Maciej Bielicki rozpoczynał każdy ze swoich spacerów, obserwując życie miasteczka i notując je skrupulatnie w swoim dzienniku.',
              taskNarrative: 'W pierwszym fragmencie rękopisu Bielicki napisał: „Serce miasta bije tu, na Rynku, od momentu gdy pierwszy osadnik wbił kołek w tę ziemię..."',
              clueRevealed: 'Prawda leży tam, gdzie dzwony biją od wieków',
            }),
          },
          // 2 — Kościół: Fragment o duchowości
          {
            title: 'Duchowe centrum',
            description:
              'Zrób zdjęcie kościoła parafialnego pw. Niepokalanego Poczęcia NMP. Zwróć uwagę na barokową fasadę.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 1,
            latitude: 49.8678,
            longitude: 21.7851,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8678, targetLng: 21.7851 },
            verifyConfig: {
              prompt: 'Oceń czy zdjęcie przedstawia kościół katolicki z wieżą i barokową fasadą. Powinien być widoczny budynek sakralny.',
              threshold: 0.6,
            },
            maxPoints: 100,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Kolegiata wznosi się nad miastem od XVIII wieku. Bielicki pisał, że to właśnie dzwony kościelne wyznaczały rytm życia — budziły, zwoływały na modlitwę, ostrzegały przed niebezpieczeństwem.',
              taskNarrative: 'Drugi fragment rękopisu schowano pomiędzy stronicami kroniki parafialnej. Bielicki wiedział, że księża strzegą słowa pisanego lepiej niż jakikolwiek zamek.',
              clueRevealed: 'Woda, która dzieli, również łączy',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Kościół stoi przy południowej stronie Rynku', pointPenalty: 10 },
              ],
            },
          },
          // 3 — Most: Fragment o Wisłoku
          {
            title: 'Strażnik przeprawy',
            description:
              'Podejdź do mostu na Wisłoku. Kronikarz wierzył, że rzeka jest kluczem do zrozumienia miasta.',
            type: TaskType.GPS_REACH,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 2,
            latitude: 49.8672,
            longitude: 21.7926,
            unlockConfig: { radiusMeters: 70, targetLat: 49.8672, targetLng: 21.7926 },
            verifyConfig: { targetLat: 49.8672, targetLng: 21.7926, radiusMeters: 30 },
            maxPoints: 50,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Wisłok — rzeka, która od zawsze towarzyszyła Strzyżowowi. Bielicki opisywał ją jako „srebrną nić łączącą przeszłość z przyszłością".',
              taskNarrative: 'Trzeci fragment rękopisu ukryto pod kamieniem przy moście. Kronikarz pisał: „Kto stoi na moście, widzi dwa brzegi jednocześnie. Tak jak ja widzę dwie prawdy o tym mieście..."',
              clueRevealed: 'Gdzie spoczywają odeszli, prawda wykuta w kamieniu',
            }),
          },
          // 4 — Cmentarz: Fragment o pamięci
          {
            title: 'Pamięć pokoleń',
            description:
              'Stoisz przy kwaterach wojennych. Opisz w kilku zdaniach, co czujesz w tym miejscu pamięci i dlaczego warto pamiętać o poległych.',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 3,
            latitude: 49.8722,
            longitude: 21.7833,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8722, targetLng: 21.7833 },
            verifyConfig: {
              prompt: 'Oceń czy odpowiedź jest przemyślaną refleksją na temat pamięci o poległych żołnierzach i znaczenia miejsc pamięci. Powinna zawierać osobiste przemyślenia, nie encyklopedyczny opis.',
              threshold: 0.5,
            },
            maxPoints: 120,
            timeLimitSec: 300,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Tu spoczywają ci, którzy oddali życie za tę ziemię. Bielicki w swoim rękopisie poświęcił cały rozdział ludziom, którzy kształtowali Strzyżów — nie tylko żywym.',
              taskNarrative: 'Czwarty fragment znaleziono wyrytym na odwrocie jednego z nagrobków. Kronikarz wiedział, że cmentarz to jedyne miejsce, gdzie nikt nie szuka sekretów — a właśnie dlatego jest idealną kryjówką.',
              clueRevealed: 'Dom modlitwy, co stał tu niegdyś, ma ściany co szepczą',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Napisz o swoich osobistych uczuciach, nie fakty historyczne', pointPenalty: 15 },
              ],
            },
          },
          // 5 — Synagoga: Fragment o wielokulturowości
          {
            title: 'Głosy przeszłości',
            description:
              'Przed II wojną światową społeczność żydowska stanowiła ważną część Strzyżowa. Napisz, dlaczego pamięć o wielokulturowej przeszłości miasta jest ważna.',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 4,
            latitude: 49.8693,
            longitude: 21.7866,
            unlockConfig: { radiusMeters: 60, targetLat: 49.8693, targetLng: 21.7866 },
            verifyConfig: {
              prompt: 'Oceń czy odpowiedź zawiera refleksję na temat wielokulturowości i pamięci o społeczności żydowskiej w małym polskim mieście. Powinna wspomnieć o współistnieniu kultur lub utraconym dziedzictwie.',
              threshold: 0.5,
            },
            maxPoints: 120,
            timeLimitSec: 300,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Tu stała synagoga — dom modlitwy społeczności, która przez wieki współtworzyła Strzyżów. Bielicki opisał żydowskich kupców, rzemieślników i uczonych jako „drugą połowę serca miasta".',
              taskNarrative: 'Piąty fragment rękopisu przechowywał żydowski aptekarz, przyjaciel Bielickiego. Kronikarz powierzył mu go ze słowami: „Ty rozumiesz, że to miasto należy do nas wszystkich."',
              clueRevealed: 'Szlacheckie mury kryją szlacheckie sekrety',
            }),
          },
          // 6 — Dwór: Fragment o władzy
          {
            title: 'Szlacheckie sekrety',
            description:
              'Zrób zdjęcie Pałacu Wołkowickich-Konopków. Ten zabytkowy budynek był świadkiem wielu ważnych decyzji.',
            type: TaskType.PHOTO_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 5,
            latitude: 49.8731,
            longitude: 21.7698,
            unlockConfig: { radiusMeters: 80, targetLat: 49.8731, targetLng: 21.7698 },
            verifyConfig: {
              prompt: 'Oceń czy zdjęcie przedstawia zabytkowy budynek — dwór, pałac lub ośrodek kultury. Powinien być widoczny budynek o historycznej architekturze.',
              threshold: 0.55,
            },
            maxPoints: 100,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Pałac Wołkowickich — niegdyś siedziba rodu, który patronował Strzyżowowi. To tu Bielicki był zatrudniony jako kronikarz i tu odkrył dokumenty, które zmieniły jego rozumienie historii miasta.',
              taskNarrative: 'Szósty fragment ukryto w tajnej skrytce w bibliotece dworu. Bielicki zapisał na marginesie: „Pan Wołkowicki kazał mi milczeć. Ale prawda nie lubi ciemności."',
              clueRevealed: 'W ogrodzie spokoju natura zdradza wzór',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Szukaj budynku o historycznej architekturze przy ul. Sobieskiego', pointPenalty: 15 },
              ],
            },
          },
          // 7 — Park: Szyfr kronikarza
          {
            title: 'Szyfr kronikarza',
            description:
              'Bielicki zostawił zaszyfrowaną wiadomość. Pierwsze litery zebranych wskazówek tworzą słowo-klucz. Odczytaj je z zebranych fragmentów i wpisz odpowiedź (małymi literami, z polskimi znakami).',
            type: TaskType.CIPHER,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 6,
            latitude: 49.8644,
            longitude: 21.8005,
            unlockConfig: { radiusMeters: 100, targetLat: 49.8644, targetLng: 21.8005 },
            verifyConfig: { answerHash: rekopisHash, cipherHint: 'Przeczytaj pierwsze litery każdej wskazówki...' },
            maxPoints: 150,
            timeLimitSec: null,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Park nad rzeką — ulubione miejsce Bielickiego. Tu spacerował wieczorami, układając myśli i szyfrując swoje zapiski. Mówił, że „natura podpowiada rozwiązania, jeśli się jej uważnie słucha".',
              taskNarrative: 'Siódmy fragment to sam szyfr. Bielicki zakodował kluczowe słowo w zebranych wskazówkach. Złóż je w całość — odpowiedź kryje się w pierwszych literach fragmentów, które zebrałeś dotąd.',
              clueRevealed: 'Z wysokości wszystko się objawia',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Weź pierwsze litery każdej z 6 dotychczasowych wskazówek', pointPenalty: 20 },
                { orderIndex: 1, content: 'Odpowiedź to nazwa rzeki przepływającej przez Strzyżów', pointPenalty: 40 },
              ],
            },
          },
          // 8 — Wzgórza: Wielka zagadka
          {
            title: 'Objawienie kronikarza',
            description:
              'Wejdź na wzgórze i podziwiaj panoramę Strzyżowa. Mając wszystkie zebrane wskazówki, odpowiedz na wielką zagadkę: Co odkrył kronikarz Bielicki o prawdziwym znaczeniu Strzyżowa? Dlaczego tak desperacko chciał to ukryć — i jednocześnie przekazać?',
            type: TaskType.TEXT_AI,
            unlockMethod: UnlockMethod.GPS,
            orderIndex: 7,
            latitude: 49.8807,
            longitude: 21.8021,
            unlockConfig: { radiusMeters: 150, targetLat: 49.8807, targetLng: 21.8021 },
            verifyConfig: {
              prompt: 'Gracz odpowiada na finalne pytanie gry narracyjnej. Zebrał 7 wskazówek: (1) „Prawda leży tam, gdzie dzwony biją od wieków", (2) „Woda, która dzieli, również łączy", (3) „Gdzie spoczywają odeszli, prawda wykuta w kamieniu", (4) „Dom modlitwy, co stał tu niegdyś, ma ściany co szepczą", (5) „Szlacheckie mury kryją szlacheckie sekrety", (6) „W ogrodzie spokoju natura zdradza wzór", (7) „Z wysokości wszystko się objawia". Poprawna odpowiedź powinna łączyć te wskazówki w spójną narrację o tym, że Strzyżów był miejscem spotkania wielu kultur i tradycji (kościół, synagoga, dwór szlachecki, rzeka jako łącznik). Kronikarz Bielicki odkrył i chciał uchronić prawdę o wielokulturowej, zjednoczonej tożsamości miasta w czasach rozbiorów, gdy jedność była niebezpieczna. Oceń na 0.7+ jeśli odpowiedź sensownie syntetyzuje wskazówki i nawiązuje do wielokulturowości / jedności / ukrytej prawdy.',
              threshold: 0.5,
              maxTokens: 1000,
            },
            maxPoints: 250,
            timeLimitSec: 600,
            storyContext: sc({
              characterName: 'Stary Kronikarz',
              locationIntro: 'Ze wzgórza widzisz całe miasto — kościół, Rynek, miejsce synagogi, dwór, most na Wisłoku, park, cmentarz. Wszystkie miejsca, które odwiedziłeś, tworzą jedną opowieść.',
              taskNarrative: 'Ósmy i ostatni fragment to puste miejsce — Bielicki zostawił je celowo. To TY musisz napisać zakończenie jego rękopisu. Mając wszystkie wskazówki, odpowiedz: co kronikarz odkrył o Strzyżowie i dlaczego to ukrył?',
              clueRevealed: 'Rękopis jest kompletny. Prawda o Strzyżowie żyje dalej.',
            }),
            hints: {
              create: [
                { orderIndex: 0, content: 'Pomyśl o tym, co łączy wszystkie odwiedzone miejsca — kościół, synagogę, dwór, most...', pointPenalty: 25 },
                { orderIndex: 1, content: 'Kronikarz żył w czasach rozbiorów. Dlaczego jedność mogła być niebezpieczna?', pointPenalty: 40 },
              ],
            },
          },
        ],
      },
    },
    include: {
      tasks: { orderBy: { orderIndex: 'asc' } },
    },
  });

  console.log(`Game "${narrativeGame.title}" created with ${narrativeGame.tasks.length} tasks.`);

  // ── Redis Ranking ─────────────────────────────────────────────────────────────

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380');

  // Kraków ranking
  const rankingKey = `ranking:game:${game.id}`;
  await redis.zadd(rankingKey, 870, marek.id);
  await redis.zadd(rankingKey, 450, jan.id);
  await redis.zadd(rankingKey, 280, anna.id);

  // Strzyżów ranking
  const strzyzowRankingKey = `ranking:game:${strzyzowGame.id}`;
  await redis.zadd(strzyzowRankingKey, 910, marek.id);
  await redis.zadd(strzyzowRankingKey, 330, jan.id);
  await redis.zadd(strzyzowRankingKey, 170, anna.id);

  await redis.quit();

  console.log('Redis ranking seeded for both games');
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
