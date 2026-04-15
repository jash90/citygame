import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E test suite for the CityGame backend API.
 *
 * Requirements:
 * - PostgreSQL & Redis running (use docker/docker-compose.yml)
 * - DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET env vars set
 * - Run: cd apps/backend && npx prisma migrate dev && pnpm test:e2e
 */
describe('CityGame API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Auth tokens populated during test flow
  let accessToken: string;
  let refreshToken: string;
  let adminAccessToken: string;

  const testUser = {
    email: `e2e-player-${Date.now()}@test.com`,
    password: 'TestPass123!',
    displayName: 'E2E Player',
  };

  const adminUser = {
    email: `e2e-admin-${Date.now()}@test.com`,
    password: 'AdminPass123!',
    displayName: 'E2E Admin',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { in: [testUser.email, adminUser.email] } },
    }).catch(() => {});

    await app.close();
  }, 15_000);

  // ── Health ──────────────────────────────────────────────────────────────

  describe('Health', () => {
    it('GET /health — returns ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.checks.database).toBe('ok');
        });
    });
  });

  // ── Auth Flow ───────────────────────────────────────────────────────────

  describe('Auth Flow', () => {
    it('POST /api/auth/register — creates a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
      userId = res.body.data.user.id;
    });

    it('POST /api/auth/login — authenticates existing user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('GET /api/auth/me — returns current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(testUser.email);
    });

    it('POST /api/auth/refresh — refreshes access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
    });

    it('GET /api/auth/me — rejects without token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });
  });

  // ── Game Lifecycle ──────────────────────────────────────────────────────

  describe('Game Lifecycle', () => {
    let gameId: string;

    beforeAll(async () => {
      // Register admin user and promote
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(adminUser)
        .expect(201);

      adminAccessToken = res.body.data.accessToken;
      const adminId = res.body.data.user.id;

      // Promote to admin via DB (no admin route available without being admin first)
      await prisma.user.update({
        where: { id: adminId },
        data: { role: 'ADMIN' },
      });

      // Re-login to get token with admin role
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: adminUser.email, password: adminUser.password })
        .expect(200);

      adminAccessToken = loginRes.body.data.accessToken;
    });

    it('POST /api/games — creates a draft game', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/games')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: 'E2E Test Game',
          description: 'A game for E2E tests',
          city: 'Warsaw',
          settings: { timeLimitMinutes: 60 },
        })
        .expect(201);

      expect(res.body.data.status).toBe('DRAFT');
      gameId = res.body.data.id;
    });

    it('GET /api/games/:id — retrieves the game', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.data.title).toBe('E2E Test Game');
    });

    it('PATCH /api/games/:id — updates game title', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Updated E2E Game' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated E2E Game');
    });

    it('POST /api/games/:id/publish — publishes the game', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/games/${gameId}/publish`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('PUBLISHED');
    });

    it('POST /api/admin/games/:id/start-run — starts a run', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/games/${gameId}/start-run`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(201);

      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.runNumber).toBe(1);
    });

    it('PATCH /api/admin/games/:id/end-run — ends the run', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/admin/games/${gameId}/end-run`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ENDED');
    });

    // Cleanup
    afterAll(async () => {
      if (gameId) {
        // Archive before delete to avoid session constraints
        await request(app.getHttpServer())
          .post(`/api/games/${gameId}/archive`)
          .set('Authorization', `Bearer ${adminAccessToken}`);
      }
    });
  });
});
