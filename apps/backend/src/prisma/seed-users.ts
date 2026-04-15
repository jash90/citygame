import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
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
  return { admin, jan, anna, marek };
}
