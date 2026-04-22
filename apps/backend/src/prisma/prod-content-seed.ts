import { PrismaClient } from '@prisma/client';
import { seedKrakowGame } from './seed-krakow';
import { seedStrzyzowGame } from './seed-strzyzow';
import { seedNarrativeGame } from './seed-narrative';

/**
 * Content-only seed for production.
 *
 * Rewrites the three real games (Tajemnice Strzyżowa, Zagubiony Rękopis
 * Kronikarza, Śladami Historii Krakowa) with the Polish-literary-motif
 * content — and nothing else.
 *
 * Explicitly does NOT do:
 *   - create/upsert test users
 *   - start game runs
 *   - seed fake player sessions
 *   - write to Redis (no ranking cache pollution)
 *
 * `cleanGames` inside each game seed still wipes tasks/hints/sessions/runs
 * for the three matching games. Real player history on those games is
 * destroyed. This script should only be run when content refresh is
 * authorised.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm ts-node src/prisma/prod-content-seed.ts
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Prod content seed — games only (no sessions, no Redis).');

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    throw new Error(
      'No ADMIN user in database. A creator is required to own the games.',
    );
  }
  console.log(`Using admin as creator: ${admin.email} (${admin.id})`);

  await seedKrakowGame(prisma, admin.id, '', '', '');
  await seedStrzyzowGame(prisma, admin.id);
  await seedNarrativeGame(prisma, admin.id);

  console.log('Done. Content rewritten on 3 games. Start runs via admin UI as needed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
