# CityGame — Comprehensive Fix Plan

> Generated: 2026-04-03  
> Codebase: ~22,400 LOC across 4 apps + 1 shared package

---

## Table of Contents

1. [Issue #1: Insufficient Test Coverage](#issue-1-insufficient-test-coverage)
2. [Issue #2: Missing Root .env.example & Onboarding Docs](#issue-2-missing-root-envexample--onboarding-docs)
3. [Issue #3: Duplicated API Client / Types Between Apps](#issue-3-duplicated-api-client--types-between-apps)
4. [Issue #4: Redis Not Properly Encapsulated in a Module](#issue-4-redis-not-properly-encapsulated-in-a-module)
5. [Issue #5: Weak Mobile Error Handling](#issue-5-weak-mobile-error-handling)
6. [Issue #6: Landing Page Lacks Content & SEO](#issue-6-landing-page-lacks-content--seo)
7. [Issue #7: No E2E Tests](#issue-7-no-e2e-tests)

---

## Issue #1: Insufficient Test Coverage

### Current State

**16 test files total**, covering:
- ✅ All 8 verification strategies (unit tests)
- ✅ Verification service (integration)
- ✅ Auth service
- ✅ Game expiry service
- ✅ Team service
- ✅ HTTP exception filter, Roles guard
- ✅ Shared package: utils + validation

**Missing tests for critical services (3,069 lines untested):**
| Service | Lines | Risk | Priority |
|---------|-------|------|----------|
| `PlayerService` | 971 | 🔴 Critical — core gameplay loop | P0 |
| `GameService` | 967 | 🔴 Critical — game CRUD + run lifecycle | P0 |
| `AiService` | 263 | 🟡 High — AI verification orchestration | P1 |
| `AdminService` | 209 | 🟡 High — admin analytics queries | P1 |
| `TaskService` | 175 | 🟡 Medium — task CRUD | P1 |
| `RankingService` | ~200 | 🟡 Medium — Redis leaderboard logic | P1 |
| `RankingGateway` | ~200 | 🟢 Low — WebSocket events | P2 |
| `StorageService` | 62 | 🟢 Low — S3 presign wrapper | P2 |
| `NotificationService` | 68 | 🟢 Low — Expo push wrapper | P2 |
| `PlayerController` | 122 | 🟢 Low — route wiring | P2 |
| `GameController` | 232 | 🟢 Low — route wiring | P2 |

### Fix Plan

#### Phase 1 — P0: Core Gameplay (ETA: 3-4 days)

**File: `apps/backend/src/modules/player/player.service.spec.ts`**

Test cases for `PlayerService`:
1. `startGame()` — happy path: creates session with first task as currentTaskId
2. `startGame()` — returns existing active session (idempotent)
3. `startGame()` — rejects when game is not PUBLISHED
4. `startGame()` — rejects when no active run
5. `startGame()` — rejects when run has expired
6. `startGame()` — team mode: reuses existing team session
7. `startGame()` — team mode: rejects when user not in team
8. `unlockTask()` — GPS unlock within radius succeeds
9. `unlockTask()` — GPS unlock outside radius rejects
10. `unlockTask()` — QR unlock with matching hash succeeds
11. `unlockTask()` — QR unlock with wrong hash rejects
12. `unlockTask()` — rejects if task already unlocked
13. `submitAnswer()` — correct answer awards points, updates session
14. `submitAnswer()` — incorrect answer records attempt, no points
15. `submitAnswer()` — AI task types (PHOTO_AI, TEXT_AI, AUDIO_AI) delegate to VerificationService
16. `submitAnswer()` — respects task time limit
17. `submitAnswer()` — broadcasts ranking update via gateway
18. `submitAnswer()` — broadcasts activity event
19. `getProgress()` — returns correct completion percentage
20. `useHint()` — deducts points, records HintUsage
21. `useHint()` — rejects if already used
22. `getActiveSession()` — returns active session or null

```typescript
// Test setup pattern:
const mockPrismaService = { game: { findUnique: jest.fn() }, ... };
const mockVerificationService = { verify: jest.fn() };
const mockRankingService = { updateScore: jest.fn() };
const mockRankingGateway = { broadcastRankingUpdate: jest.fn(), broadcastActivity: jest.fn() };
const mockNotificationService = { sendPush: jest.fn() };
const mockTeamService = { getTeamForUser: jest.fn() };
```

**File: `apps/backend/src/modules/game/game.service.spec.ts`**

Test cases for `GameService`:
1. `create()` — creates game with DRAFT status
2. `findAll()` — paginates correctly, filters by status/city
3. `findOne()` — returns game with task count and player count
4. `update()` — partial update works
5. `update()` — rejects if game not found
6. `publish()` — transitions DRAFT → PUBLISHED
7. `publish()` — rejects if no tasks exist
8. `archive()` — transitions to ARCHIVED
9. `startRun()` — creates new GameRun, increments currentRun
10. `startRun()` — rejects if active run already exists
11. `endRun()` — ends active run, sets endedAt
12. `endRun()` — marks active sessions as TIMED_OUT
13. `delete()` — cascades task deletion

#### Phase 2 — P1: Supporting Services (ETA: 2-3 days)

**File: `apps/backend/src/modules/ai/ai.service.spec.ts`**

1. `generateDescription()` — calls Anthropic API with correct prompt
2. `generateHints()` — returns array of hints
3. `generatePrompt()` — builds verification prompt for task type
4. Error handling — Anthropic API failure returns graceful error

**File: `apps/backend/src/modules/admin/admin.service.spec.ts`**

1. `getUsers()` — paginates, filters by role/search
2. `updateUserRole()` — updates role correctly
3. `getGameStats()` — aggregates session/attempt data correctly
4. `getRunActivity()` — returns chronological activity feed
5. `getPlayerActivity()` — returns correct time-series data

**File: `apps/backend/src/modules/task/task.service.spec.ts`**

1. `create()` — creates task with correct orderIndex
2. `reorder()` — updates orderIndex for all affected tasks
3. `update()` — partial update works
4. `delete()` — cascades hints

**File: `apps/backend/src/modules/ranking/ranking.service.spec.ts`**

1. `updateScore()` — calls Redis ZADD correctly
2. `getRanking()` — returns entries sorted by score desc
3. `getRankingWithNames()` — enriches with user displayName
4. `getUserRank()` — returns correct 1-based rank
5. `updateTeamScore()` / `getTeamRanking()` — team leaderboard

> **Note**: Use `ioredis-mock` or a mock Redis for unit tests.

#### Phase 3 — P2: Controllers & Wrappers (ETA: 1-2 days)

- `StorageService` — test presign URL generation
- `NotificationService` — test Expo push call
- Controller tests — verify guards, decorators, param passing

### Implementation Notes

- Use NestJS `Test.createTestingModule()` with `.overrideProvider()` for mocking
- All new test files go in the same directory as the service (co-located)
- Target: **>80% coverage** for P0 services, **>60%** for P1
- Add `--coverage` flag to CI backend test step (already present)

---

## Issue #2: Missing Root .env.example & Onboarding Docs

### Current State

Each app has its own `.env.example`:
- ✅ `apps/backend/.env.example` — 12 vars
- ✅ `apps/admin/.env.example` — 1 var
- ✅ `apps/mobile/.env.example` — 2 vars

**What's missing:**
- No root-level `.env.example` for quick reference
- No consolidated onboarding guide (developer must discover env vars per app)
- Docker Compose env vars don't match `.env.example` port (6380 vs 6379)

### Fix Plan (ETA: 0.5 day)

#### 1. Create root `.env.example`

**File: `.env.example`**
```bash
# ═══════════════════════════════════════════════════════════════
# CityGame — Root Environment Reference
# Copy per-app .env.example files for actual development:
#   cp apps/backend/.env.example apps/backend/.env
#   cp apps/admin/.env.example apps/admin/.env.local
#   cp apps/mobile/.env.example apps/mobile/.env
# ═══════════════════════════════════════════════════════════════

# ── Backend (apps/backend/.env) ───────────────────────────────
DATABASE_URL="postgresql://citygame:citygame_dev@localhost:5433/citygame"
REDIS_URL="redis://localhost:6380"
JWT_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-in-production"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"
ANTHROPIC_API_KEY="sk-ant-..."
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY=""
R2_SECRET_KEY=""
R2_BUCKET="citygame-assets"
CORS_ORIGIN="http://localhost:3000,http://localhost:3002"
PORT=3001

# ── Admin (apps/admin/.env.local) ────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001

# ── Mobile (apps/mobile/.env) ────────────────────────────────
EXPO_PUBLIC_API_URL=http://localhost:3001/api
EXPO_PUBLIC_WS_URL=http://localhost:3001
```

#### 2. Fix Docker Compose port mismatch

The `docker-compose.yml` maps Redis to port 6380 but `apps/backend/.env.example` says `redis://localhost:6379`. Fix `.env.example` to use port `6380` (Docker) or add a comment explaining the difference.

**Edit: `apps/backend/.env.example`**
```diff
-REDIS_URL="redis://localhost:6379"
+REDIS_URL="redis://localhost:6380"
+# Port 6380 matches docker/docker-compose.yml mapping (host:6380 → container:6379)
+# Use port 6379 if running Redis natively without Docker
```

Same for Postgres port — Docker maps to 5433, but `.env.example` uses default 5432:
```diff
-DATABASE_URL="postgresql://user:password@localhost:5432/citygame"
+DATABASE_URL="postgresql://citygame:citygame_dev@localhost:5433/citygame"
+# Port 5433 and credentials match docker/docker-compose.yml
+# Adjust if running Postgres natively
```

---

## Issue #3: Duplicated API Client / Types Between Apps

### Current State

| Location | Types/Interfaces | API Client Pattern |
|----------|------------------|--------------------|
| `apps/mobile/src/services/api.ts` | **22** local types | Custom `ApiClient` class (SecureStore tokens) |
| `apps/admin/src/lib/api.ts` | **3** local types | Custom `request()` function (localStorage tokens) |
| `packages/shared/src/types/` | **46** types across 7 files | Types only, no API client |

**Duplications found:**
- `User`, `TaskType`, `AttemptStatus`, `GameSession`, `TaskAttempt` — defined in both mobile `api.ts` AND `@citygame/shared`
- `ApiError`, `PresignedUrlResponse` — defined in shared but redefined in mobile
- `Game`, `Task` shapes differ between mobile (flattened) and shared (backend-shaped)

### Fix Plan (ETA: 2-3 days)

#### Phase 1: Consolidate Types in `@citygame/shared`

**Do NOT merge the API clients** — they have fundamentally different auth strategies (SecureStore vs localStorage). Instead, unify the **types**.

1. **Add mobile-specific DTOs to `packages/shared/src/types/mobile.ts`**:
   ```typescript
   // Mobile-friendly flattened game/task types
   export interface MobileGame {
     id: string;
     name: string;
     description: string;
     city: string;
     coverImageUrl?: string;
     taskCount: number;
     duration: number;
     currentRun: number;
     endsAt?: string;
     activeRunId?: string;
     isRunning?: boolean;
     narrative?: NarrativeSettings;
     tasks?: MobileTask[];
   }

   export interface MobileTask {
     id: string;
     title: string;
     description: string;
     type: TaskType;
     points: number;
     status: TaskStatus;
     order: number;
     // ... etc
   }
   ```

2. **Move common response types to shared**:
   - `RankEntry` (mobile) → use `RankingEntry` from shared
   - `TaskSubmission` union → `packages/shared/src/types/submission.ts`
   - `HintResult`, `UnlockTaskResult` → `packages/shared/src/types/player.ts`

3. **Update mobile `api.ts`**:
   - Remove all locally-defined types that exist in `@citygame/shared`
   - Import from `@citygame/shared` instead
   - Keep mapper functions (`mapGame`, `mapTask`) as they transform backend→mobile shapes

4. **Update admin `api.ts`**:
   - Already imports from `@citygame/shared` ✅
   - Move `GameStats`, `GenerateTaskContentParams`, `GenerateTaskContentResult` to shared

#### Phase 2: Extract API Client Factory to Shared (Optional)

If desired, extract the **base HTTP logic** (request, response unwrapping, error handling) into a shared utility:

```typescript
// packages/shared/src/api/base-client.ts
export abstract class BaseApiClient {
  constructor(protected baseUrl: string) {}
  
  protected abstract getToken(): Promise<string | null> | string | null;
  protected abstract onUnauthorized(): void;
  
  protected async request<T>(path: string, options: RequestOptions): Promise<T> {
    // Shared: headers, JSON body, response unwrapping (data.data pattern),
    // 204 handling, error parsing
  }
}
```

This is optional and lower priority — the current duplication is mainly in types, not HTTP logic.

### Impact

- **~150 lines removed** from `apps/mobile/src/services/api.ts`
- Single source of truth for all DTOs
- Breaking change: mobile screens that import types from `@/services/api` need to update imports

---

## Issue #4: Redis Not Properly Encapsulated in a Module

### Current State

- `RankingService` creates its own `new Redis()` instance in constructor
- `seed.ts` creates its own `new Redis()` instance
- No `RedisModule` — Redis connection is not shared or injectable
- No health check for Redis connectivity
- Socket.IO adapter does NOT use Redis (in-memory only — single-instance limitation)

### Fix Plan (ETA: 1-2 days)

#### 1. Create `RedisModule` with injectable provider

**File: `apps/backend/src/redis/redis.module.ts`**
```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        redis.connect().catch((err) => {
          console.warn('Redis connection failed:', err.message);
        });
        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

#### 2. Refactor `RankingService` to inject Redis

```typescript
@Injectable()
export class RankingService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // No longer owns the connection — module handles lifecycle
  }
}
```

#### 3. Add Redis health check to `HealthModule`

```typescript
@Get()
async check() {
  const redisOk = await this.redis.ping() === 'PONG';
  return { status: 'ok', db: dbOk, redis: redisOk };
}
```

#### 4. (Future) Add Redis adapter for Socket.IO

For multi-instance deployments, add `@socket.io/redis-adapter` so WebSocket rooms work across Railway replicas. This is lower priority (single instance works for now).

---

## Issue #5: Weak Mobile Error Handling

### Current State

- ✅ `ErrorBoundary` wraps the root layout — catches render crashes
- ✅ Auth screens handle errors from `useAuth` hook
- ✅ Task detail screen has try/catch around submissions
- ❌ **No per-screen error boundaries** for isolated failures
- ❌ **No network error UI** — API failures show no feedback on list screens
- ❌ **No retry mechanisms** on game list, map, or ranking screens
- ❌ **No offline detection** or empty state handling
- ❌ **No toast/snackbar** for transient errors

### Fix Plan (ETA: 2-3 days)

#### 1. Create reusable error components

**File: `apps/mobile/src/components/NetworkError.tsx`**
```typescript
// Full-screen error state with retry button
// Props: message, onRetry, icon
```

**File: `apps/mobile/src/components/EmptyState.tsx`**
```typescript
// Empty state with illustration
// Props: title, subtitle, action
```

**File: `apps/mobile/src/components/Toast.tsx`**
```typescript
// Lightweight toast notification using Reanimated
// Zustand store for toast queue
```

#### 2. Add React Query error/loading states to screens

For each tab screen that uses `useQuery`:

```typescript
// Pattern to apply in: tasks/index, map/index, ranking/index, profile/index
const { data, isLoading, isError, error, refetch } = useQuery({ ... });

if (isLoading) return <LoadingSpinner />;
if (isError) return <NetworkError message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState title="No tasks yet" />;
```

#### 3. Add per-screen error boundaries

Wrap each tab in its own `ErrorBoundary` in `(tabs)/_layout.tsx` so one crashing tab doesn't take down the entire app.

#### 4. Add network connectivity detection

**File: `apps/mobile/src/hooks/useNetworkStatus.ts`**
```typescript
import NetInfo from '@react-native-community/netinfo';
// Expose isConnected, show banner when offline
```

#### 5. Screens to update

| Screen | Current Error Handling | Fix Needed |
|--------|----------------------|------------|
| `(tabs)/tasks/index.tsx` | None | Add loading/error/empty states |
| `(tabs)/map/index.tsx` | None | Add loading/error states, offline fallback |
| `(tabs)/ranking/index.tsx` | None | Add loading/error/empty states |
| `(tabs)/profile/index.tsx` | None | Add loading/error states |
| `index.tsx` (home) | None | Add loading/error states for game list |
| `game-summary.tsx` | None | Add error state |
| `run-answers.tsx` | None | Add loading/error states |

---

## Issue #6: Landing Page Lacks Content & SEO

### Current State

- 7 Astro components totaling **1,194 lines** — actually more substantial than initially assessed
- Sections: Hero, Features, How It Works, Game Showcase, Download CTA, Nav, Footer
- ❌ **No SEO metadata** (og:image, description, structured data)
- ❌ **No analytics** integration
- ❌ **No favicon/webmanifest** configuration
- ❌ **No blog/content section** for organic traffic
- ❌ **No privacy policy / terms of service** pages (required for App Store)

### Fix Plan (ETA: 2-3 days)

#### 1. SEO & Metadata

**Edit: `apps/landing/src/layouts/Layout.astro`**
```html
<!-- Add Open Graph -->
<meta property="og:title" content="CityGame — Explore Your City" />
<meta property="og:description" content="Location-based city exploration game..." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />

<!-- Add structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "name": "CityGame",
  "operatingSystem": "iOS, Android",
  ...
}
</script>
```

#### 2. Required Legal Pages

**Create:**
- `apps/landing/src/pages/privacy.astro` — Privacy policy
- `apps/landing/src/pages/terms.astro` — Terms of service
- Link from footer

#### 3. Favicon & Web Manifest

**Create:**
- `apps/landing/public/favicon.ico` — from existing `assets/icon.png`
- `apps/landing/public/site.webmanifest`
- Apple touch icon, multiple sizes

#### 4. Analytics (Optional)

Add privacy-friendly analytics (e.g., Plausible or Umami) via Astro integration.

---

## Issue #7: No E2E Tests

### Current State

- CI runs unit tests and type checks only
- No browser-based or API-based end-to-end tests
- No Playwright, Cypress, or Supertest integration tests
- Admin dashboard has no test coverage at all

### Fix Plan (ETA: 3-4 days)

#### Phase 1: Backend API E2E Tests (Priority)

Use **Supertest + NestJS testing** for API integration tests against a real database.

**File: `apps/backend/test/app.e2e-spec.ts`** (NestJS convention: `/test` directory)

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
```

**Test scenarios:**

1. **Auth flow**: Register → Login → Get profile → Refresh token → Logout
2. **Game lifecycle**: Create game → Add tasks → Publish → Start run → End run
3. **Player flow**: Join game → Unlock task (GPS) → Submit answer → Check ranking
4. **Team flow**: Create team → Join team → Start game → Submit as team
5. **AI verification**: Submit photo task → Receive AI result
6. **Admin flow**: List users → Change role → View analytics
7. **Error cases**: Invalid tokens, expired runs, duplicate sessions

**CI Changes: `.github/workflows/ci.yml`**

Add new job:
```yaml
e2e-tests:
  name: E2E Tests
  runs-on: ubuntu-latest
  services:
    postgres: ...
    redis: ...
  steps:
    - run: pnpm run test:e2e --filter=@citygame/backend
```

#### Phase 2: Admin Dashboard E2E (Lower Priority)

Use **Playwright** for critical admin flows:

**File: `apps/admin/e2e/`**

1. Login → Dashboard loads with stats
2. Create game → Add task → Publish
3. Monitor page → WebSocket connects → Shows live data
4. Settings → User management works

**Setup:**
```bash
cd apps/admin && pnpm add -D @playwright/test
```

---

## Priority & Timeline Summary

| # | Issue | Priority | ETA | Effort |
|---|-------|----------|-----|--------|
| 1 | Test Coverage (P0 — Player + Game) | 🔴 Critical | 3-4 days | Large |
| 4 | Redis Module Encapsulation | 🟡 High | 1-2 days | Medium |
| 3 | Deduplicate API Types | 🟡 High | 2-3 days | Medium |
| 5 | Mobile Error Handling | 🟡 High | 2-3 days | Medium |
| 2 | Root .env.example + Port Fix | 🟢 Quick Win | 0.5 day | Small |
| 7 | Backend E2E Tests | 🟡 Medium | 3-4 days | Large |
| 1 | Test Coverage (P1 + P2) | 🟡 Medium | 3-5 days | Large |
| 6 | Landing SEO + Legal Pages | 🟢 Low | 2-3 days | Medium |
| 7 | Admin Playwright E2E | 🟢 Low | 2-3 days | Medium |

**Recommended execution order:**
1. 🏁 **Quick win**: Root `.env.example` + port fix (Issue #2) — 0.5 day
2. 🧪 **Foundation**: Player + Game service tests (Issue #1 P0) — 3-4 days
3. 🔧 **Infra**: Redis module (Issue #4) — 1-2 days
4. 📦 **Cleanup**: API type deduplication (Issue #3) — 2-3 days
5. 📱 **UX**: Mobile error handling (Issue #5) — 2-3 days
6. 🧪 **Quality**: Backend E2E tests (Issue #7 Phase 1) — 3-4 days
7. 🧪 **Coverage**: Remaining service tests (Issue #1 P1+P2) — 3-5 days
8. 🌐 **Marketing**: Landing SEO + legal (Issue #6) — 2-3 days
9. 🎭 **Polish**: Admin Playwright E2E (Issue #7 Phase 2) — 2-3 days

**Total estimated effort: ~20-28 days** (1 developer)

---

## Dependencies Between Issues

```
Issue #2 (env fix) ──→ no dependencies, do first
Issue #4 (Redis) ────→ must be done before Ranking tests
Issue #1 P0 (tests) ─→ benefits from Issue #4 (mockable Redis)
Issue #3 (types) ────→ benefits from Issue #1 (tests catch regressions)
Issue #5 (mobile) ───→ no dependencies
Issue #7 (E2E) ──────→ benefits from Issue #2 (env setup) + Issue #4 (Redis)
Issue #6 (landing) ──→ no dependencies
```
