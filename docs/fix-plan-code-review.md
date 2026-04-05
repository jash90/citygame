# CityGame — Code Review Fix Plan

All issues from the code review, organized by priority with exact file paths, code changes, and implementation steps.

---

## 🔴 Critical Issues

### C1. `GameSettings` Type Duplication — Sync Risk

**Problem**: `apps/backend/src/common/types/game-settings.ts` is a manual copy of `packages/shared/src/types/game.ts::GameSettings`. They will drift.

**Files to change**:
- `packages/shared/src/types/game.ts` — export `GameSettings` (already exported ✓)
- `apps/backend/src/common/types/game-settings.ts` — **DELETE this file**
- `apps/backend/src/modules/game/game.service.ts` (line 16)
- `apps/backend/src/modules/game/game-run.service.ts` (line 13)
- `apps/backend/src/modules/player/player.service.ts` (line 25)
- `apps/backend/src/modules/team/team.service.ts` (line 11)

**Steps**:
1. Verify `GameSettings` in `packages/shared/src/types/game.ts` has all fields that the backend version has (`allowHints`, `teamMode`, `minTeamSize`, `maxTeamSize`, `narrative`). Currently the shared version already has them ✓.
2. In all 4 backend files above, change:
   ```ts
   // FROM:
   import type { GameSettings } from '../../common/types/game-settings';
   // TO:
   import type { GameSettings } from '@citygame/shared';
   ```
3. Delete `apps/backend/src/common/types/game-settings.ts`.
4. Run `pnpm typecheck` to confirm no breakage.

---

### C2. No Input Sanitization for AI Prompts — Prompt Injection

**Problem**: Player-submitted text/transcriptions are directly interpolated into Claude prompts in `apps/backend/src/modules/ai/ai.service.ts`. A player could craft answers that override the system prompt.

**Files to change**:
- `apps/backend/src/modules/ai/ai.service.ts`

**Steps**:
1. Add a `sanitizeUserInput()` helper to strip/escape prompt injection patterns:
   ```ts
   // Add at the top of ai.service.ts
   
   /** Max length for player-submitted content sent to AI. */
   const MAX_SUBMISSION_LENGTH = 2000;
   
   /**
    * Sanitize player-submitted text before including in AI prompts.
    * Strips known prompt-injection patterns and truncates to a safe length.
    */
   function sanitizeUserInput(input: string): string {
     return input
       .slice(0, MAX_SUBMISSION_LENGTH)
       .replace(/ignore (all )?(previous|above|prior) instructions/gi, '[filtered]')
       .replace(/you are now/gi, '[filtered]')
       .replace(/system:\s*/gi, '[filtered]')
       .replace(/\{[^}]*"?score"?\s*:/gi, '[filtered]');
   }
   ```
2. Apply `sanitizeUserInput()` to all user-facing inputs before prompt interpolation:
   - `evaluateText()` — wrap `answer`: `const safeAnswer = sanitizeUserInput(answer);`
   - `evaluateAudio()` — wrap `transcription`: already calls `evaluateText`, so it inherits.
   - `evaluatePhoto()` — the image is the submission, but wrap the `prompt` param defensively too (it comes from admin config, lower risk).
3. Add a post-validation guard on AI results — if the raw response text contains suspicious patterns (e.g., `score > 1.0` or feedback containing the system prompt), flag as `ERROR`:
   ```ts
   // In parseResponse(), after JSON.parse:
   if (parsed.score > 1 || parsed.score < 0) {
     return {
       score: 0,
       feedback: 'Evaluation result out of range — flagged for review',
       reasoning: 'Score out of bounds: ' + parsed.score,
     };
   }
   ```
   (Note: the existing `Math.min(1, Math.max(0, ...))` clamp already handles numeric bounds, but an explicit flag helps detect manipulation.)

4. Consider separating user content into a `<user_input>` XML block in the prompt to make the boundary clearer for Claude:
   ```ts
   const userMessage = `Task requirement: ${prompt}\n\n<user_input>\n${safeAnswer}\n</user_input>\n\nDoes the answer meet the requirement?`;
   ```

---

### C3. `devCompleteTask` Has No Environment Guard in Service

**Problem**: `PlayerService.devCompleteTask()` has no production guard. The controller is conditionally registered in `PlayerModule`, but if someone mistakenly registers the route or calls the service directly, it bypasses verification.

**Files to change**:
- `apps/backend/src/modules/player/player.service.ts`

**Steps**:
1. Add a production failsafe at the top of `devCompleteTask()`:
   ```ts
   async devCompleteTask(
     gameId: string,
     taskId: string,
     userId: string,
   ): Promise<TaskAttempt> {
     if (process.env.NODE_ENV === 'production') {
       throw new ForbiddenException('Dev endpoints are disabled in production');
     }
     // ... rest of the method
   ```
2. Import `ForbiddenException` is already imported. No additional imports needed.

---

### C4. Race Condition in Hint Usage Score Clamping

**Problem**: In `PlayerService.useHint()`, score clamping to zero is done as two sequential updates inside a transaction. While Serializable isolation helps, the double update is wasteful and logically fragile.

**Files to change**:
- `apps/backend/src/modules/player/player.service.ts`

**Steps**:
1. Replace the two-step decrement-then-clamp with a single raw SQL update using `GREATEST`:
   ```ts
   // REPLACE this block in useHint():
   //   const updatedSession = await tx.gameSession.update({
   //     where: { id: session.id },
   //     data: { totalPoints: { decrement: unusedHint.pointPenalty } },
   //     select: { id: true, totalPoints: true },
   //   });
   //   if (updatedSession.totalPoints < 0) {
   //     await tx.gameSession.update({
   //       where: { id: session.id },
   //       data: { totalPoints: 0 },
   //     });
   //   }
   
   // WITH:
   await tx.$executeRaw`
     UPDATE "GameSession"
     SET "totalPoints" = GREATEST("totalPoints" - ${unusedHint.pointPenalty}, 0)
     WHERE id = ${session.id}::uuid
   `;
   ```
2. This is a single atomic operation — no intermediate negative state possible.
3. Update the associated spec test (`player.service.spec.ts`) if it mocks the two-step update.

---

## 🟡 Moderate Issues

### M1. No Frontend Tests

**Problem**: Both `apps/admin` and `apps/mobile` have zero test files.

**Files to create**:
- `apps/mobile/src/stores/__tests__/authStore.test.ts`
- `apps/mobile/src/stores/__tests__/gameStore.test.ts`
- `apps/mobile/src/services/__tests__/api.test.ts`
- `apps/admin/src/__tests__/api.test.ts`

**Steps**:
1. **Mobile — install test deps**:
   ```bash
   cd apps/mobile
   pnpm add -D jest @types/jest ts-jest @testing-library/react-native
   ```
2. **Mobile — add jest config** (`apps/mobile/jest.config.ts`):
   ```ts
   export default {
     preset: 'ts-jest',
     testEnvironment: 'node',
     moduleNameMapper: {
       '^@/(.*)$': '<rootDir>/src/$1',
     },
     testMatch: ['**/__tests__/**/*.test.ts'],
   };
   ```
3. **Mobile — add `test` script** to `apps/mobile/package.json`:
   ```json
   "test": "jest"
   ```
4. **Create `apps/mobile/src/stores/__tests__/authStore.test.ts`** — test `init()`, `login()`, `logout()`, `setTokens()` with mocked SecureStore.
5. **Create `apps/mobile/src/stores/__tests__/gameStore.test.ts`** — test `updateProgress()`, `markTaskCompleted()`, `addRevealedHint()`, `restoreSession()`, `reset()`.
6. **Create `apps/mobile/src/services/__tests__/api.test.ts`** — test refresh token flow, 401 handling, response unwrapping (`{ data }` extraction).
7. **Admin — install test deps**:
   ```bash
   cd apps/admin
   pnpm add -D jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
   ```
8. **Create `apps/admin/src/__tests__/api.test.ts`** — test `tryRefreshToken()`, `request()` 401 retry, `handleUnauthorized()` redirect.
9. Add `"test": "jest"` to `apps/admin/package.json` scripts.

---

### M2. Inconsistent `ParseUUIDPipe` Usage

**Problem**: `PlayerController` and `TeamController` accept `:gameId`, `:taskId`, `:teamId` as raw strings without UUID validation.

**Files to change**:
- `apps/backend/src/modules/player/player.controller.ts`
- `apps/backend/src/modules/player/dev-player.controller.ts`
- `apps/backend/src/modules/team/team.controller.ts`

**Steps**:
1. **`player.controller.ts`** — add `ParseUUIDPipe` to all `@Param` decorators:
   ```ts
   // Add to imports:
   import { ParseUUIDPipe } from '@nestjs/common';
   
   // Change every occurrence of:
   @Param('gameId') gameId: string
   // To:
   @Param('gameId', ParseUUIDPipe) gameId: string
   
   // And:
   @Param('taskId') taskId: string
   // To:
   @Param('taskId', ParseUUIDPipe) taskId: string
   ```
   Affected methods: `getRunAnswers` (gameId already has no pipe), `getRanking`, `startGame`, `getProgress`, `unlockTask`, `submitAnswer`, `useHint`.

2. **`dev-player.controller.ts`** — same treatment:
   ```ts
   @Param('gameId', ParseUUIDPipe) gameId: string,
   @Param('taskId', ParseUUIDPipe) taskId: string,
   ```

3. **`team.controller.ts`** — add `ParseUUIDPipe` import and apply to `:gameId` and `:teamId`:
   ```ts
   import { ParseUUIDPipe } from '@nestjs/common';
   
   // @Param('gameId') → @Param('gameId', ParseUUIDPipe)
   // @Param('teamId') → @Param('teamId', ParseUUIDPipe)
   ```
   Affected methods: `create`, `join` (gameId unused but still validated), `list`, `getMyTeam`, `leave`.

---

### M3. Unbounded Image Download in AI Evaluation

**Problem**: `AiService.evaluatePhoto()` fetches an arbitrary URL with no size limit or SSRF protection.

**Files to change**:
- `apps/backend/src/modules/ai/ai.service.ts`

**Steps**:
1. Add a size-limited image fetch helper:
   ```ts
   /** Max image size in bytes (10 MB). */
   private static readonly MAX_IMAGE_BYTES = 10 * 1024 * 1024;
   
   /** Allowed hostnames for image URLs (to prevent SSRF). */
   private readonly allowedImageHosts: Set<string>;
   
   // In constructor, after existing code:
   const publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '');
   const endpoint = this.configService.get<string>('R2_ENDPOINT', '');
   this.allowedImageHosts = new Set<string>();
   try {
     if (publicUrl) this.allowedImageHosts.add(new URL(publicUrl).hostname);
     if (endpoint) this.allowedImageHosts.add(new URL(endpoint).hostname);
   } catch { /* ignore invalid URLs */ }
   ```

2. Add a safe fetch method:
   ```ts
   private async fetchImageSafe(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
     const url = new URL(imageUrl);
   
     // SSRF prevention: block private/internal addresses
     if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)) {
       throw new Error('Image URL points to a local address');
     }
     if (url.hostname.startsWith('10.') || url.hostname.startsWith('192.168.') || url.hostname.startsWith('172.')) {
       throw new Error('Image URL points to a private network');
     }
   
     // Optional: restrict to known storage hosts
     if (this.allowedImageHosts.size > 0 && !this.allowedImageHosts.has(url.hostname)) {
       this.logger.warn(`Image URL hostname not in allowlist: ${url.hostname}`);
       // Still allow — just log for now. Uncomment below to enforce:
       // throw new Error('Image URL hostname not allowed');
     }
   
     const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
   
     const contentLength = response.headers.get('content-length');
     if (contentLength && parseInt(contentLength) > AiService.MAX_IMAGE_BYTES) {
       throw new Error(`Image too large: ${contentLength} bytes (max ${AiService.MAX_IMAGE_BYTES})`);
     }
   
     const chunks: Uint8Array[] = [];
     let totalSize = 0;
     const reader = response.body?.getReader();
     if (!reader) throw new Error('No response body');
   
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;
       totalSize += value.byteLength;
       if (totalSize > AiService.MAX_IMAGE_BYTES) {
         reader.cancel();
         throw new Error(`Image exceeds max size of ${AiService.MAX_IMAGE_BYTES} bytes`);
       }
       chunks.push(value);
     }
   
     const buffer = Buffer.concat(chunks);
     const contentType = response.headers.get('content-type') ?? 'image/jpeg';
     return { buffer, contentType };
   }
   ```

3. Replace the existing `fetch` in `evaluatePhoto()`:
   ```ts
   // REPLACE:
   //   const imageResponse = await fetch(imageUrl);
   //   const arrayBuffer = await imageResponse.arrayBuffer();
   //   const base64Data = Buffer.from(arrayBuffer).toString('base64');
   //   const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
   
   // WITH:
   const { buffer, contentType: rawContentType } = await this.fetchImageSafe(imageUrl);
   const base64Data = buffer.toString('base64');
   const contentType = rawContentType;
   ```

---

### M4. WebSocket CORS Doesn't Use Wildcard Matching

**Problem**: HTTP CORS uses `matchesOrigin()` with wildcard support, but WS CORS in `RankingGateway` does a simple string split.

**Files to change**:
- `apps/backend/src/main.ts` — extract `matchesOrigin` to a shared utility
- `apps/backend/src/common/utils/cors.ts` — new file
- `apps/backend/src/modules/ranking/ranking.gateway.ts`

**Steps**:
1. Create `apps/backend/src/common/utils/cors.ts`:
   ```ts
   /**
    * Parse CORS_ORIGIN env and return a matcher function.
    * Supports exact matches and wildcard patterns like *.vercel.app.
    */
   export function createOriginMatcher(rawOrigins: string): (origin: string) => boolean {
     const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());
   
     return (origin: string): boolean => {
       return allowedOrigins.some((pattern) => {
         if (pattern.startsWith('*.')) {
           const suffix = pattern.slice(1);
           if (!origin.endsWith(suffix)) return false;
           const url = new URL(origin);
           const baseDomain = pattern.slice(2);
           const subdomain = url.hostname.slice(0, url.hostname.length - baseDomain.length - 1);
           return subdomain.startsWith('citygame');
         }
         return pattern === origin;
       });
     };
   }
   
   /** Get allowed origin strings from CORS_ORIGIN env, used for simple lists. */
   export function getAllowedOrigins(): string[] {
     return (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002')
       .split(',')
       .map((o) => o.trim());
   }
   ```

2. Update `apps/backend/src/main.ts` to use the shared utility:
   ```ts
   import { createOriginMatcher } from './common/utils/cors';
   
   // REPLACE the inline matchesOrigin with:
   const rawOrigins = process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002';
   const matchesOrigin = createOriginMatcher(rawOrigins);
   ```
   Remove the inline `matchesOrigin` function and `allowedOrigins` variable.

3. Update `apps/backend/src/modules/ranking/ranking.gateway.ts` to use callback-based CORS:
   ```ts
   import { createOriginMatcher, getAllowedOrigins } from '../../common/utils/cors';
   
   @WebSocketGateway({
     namespace: '/ranking',
     cors: {
       origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
         if (!origin) {
           callback(null, true);
           return;
         }
         const matcher = createOriginMatcher(
           process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002',
         );
         callback(null, matcher(origin));
       },
       credentials: true,
     },
   })
   ```

---

### M5. Missing Pagination DTO for Session Query Parameters

**Problem**: `GameController.adminGetSessions()` parses `page`/`limit` manually with `Number()` instead of using a DTO.

**Files to change**:
- `apps/backend/src/modules/game/game.controller.ts`

**Steps**:
1. The `ListGamesQueryDto` already uses `class-validator`. Use the same pattern — the existing `PaginationQueryDto` base class (`apps/backend/src/common/dto/pagination-query.dto.ts`) should be reused:
   ```ts
   // In adminGetSessions, change:
   @Query('page') page?: string,
   @Query('limit') limit?: string,
   
   // To use @Query() with a DTO. First verify PaginationQueryDto exists, then:
   @Query() query: PaginationQueryDto,
   // And adjust the call:
   return this.gameService.getGameSessions(id, runId, query.page, Math.min(query.limit ?? 50, 100));
   ```
2. If `PaginationQueryDto` doesn't exist or doesn't fit, create a small `GetSessionsQueryDto`:
   ```ts
   // apps/backend/src/modules/game/dto/get-sessions-query.dto.ts
   import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
   import { Type } from 'class-transformer';
   
   export class GetSessionsQueryDto {
     @IsOptional()
     @IsUUID()
     runId?: string;
   
     @IsOptional()
     @Type(() => Number)
     @IsInt()
     @Min(1)
     page?: number = 1;
   
     @IsOptional()
     @Type(() => Number)
     @IsInt()
     @Min(1)
     @Max(100)
     limit?: number = 50;
   }
   ```
3. Replace the method signature:
   ```ts
   adminGetSessions(
     @Param('id', ParseUUIDPipe) id: string,
     @Query() query: GetSessionsQueryDto,
   ) {
     return this.gameService.getGameSessions(id, query.runId, query.page, query.limit);
   }
   ```

---

### M6. `getProgress` Does Separate Query for Task Count

**Problem**: `PlayerService.getProgress()` runs `this.prisma.task.count({ where: { gameId } })` as a separate query.

**Files to change**:
- `apps/backend/src/modules/player/player.service.ts`

**Steps**:
1. Include `_count` in the session query instead of a separate count:
   ```ts
   // In the "active run" branch of getProgress(), change the session query to include game task count:
   const session = await this.prisma.gameSession.findUnique({
     where: { gameRunId_userId: { gameRunId: activeRun.id, userId } },
     include: {
       attempts: {
         where: { status: AttemptStatus.CORRECT },
         select: { taskId: true, pointsAwarded: true, createdAt: true },
         orderBy: { createdAt: 'asc' },
       },
       hintUsages: { /* ... existing ... */ },
       game: {
         select: { _count: { select: { tasks: true } } },
       },
     },
   });
   
   // Then use:
   const totalTasks = session.game._count.tasks;
   ```
2. Apply the same pattern to the fallback branch (no active run). Remove the standalone `this.prisma.task.count()` calls.

---

### M7. No Retry/Circuit Breaker for AI Calls

**Problem**: `AiService` returns `score: 0` on any failure — a transient API error permanently penalizes the player.

**Files to change**:
- `apps/backend/src/modules/ai/ai.service.ts`

**Steps**:
1. Add a retry wrapper:
   ```ts
   /** Retry an async function up to `maxRetries` times with exponential backoff. */
   private async withRetry<T>(
     fn: () => Promise<T>,
     maxRetries = 1,
     baseDelayMs = 1000,
   ): Promise<T> {
     let lastError: unknown;
     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error) {
         lastError = error;
         if (attempt < maxRetries) {
           const isRetryable =
             error instanceof Error &&
             (error.message.includes('timeout') ||
              error.message.includes('500') ||
              error.message.includes('529') ||
              error.message.includes('overloaded'));
           if (!isRetryable) throw error;
           await new Promise((resolve) =>
             setTimeout(resolve, baseDelayMs * 2 ** attempt),
           );
         }
       }
     }
     throw lastError;
   }
   ```
2. Wrap `createMessage` calls in retry:
   ```ts
   // In evaluateText():
   const message = await this.withRetry(() =>
     this.createMessage({ ... }),
   );
   
   // Same for evaluatePhoto() and evaluateAudio()
   ```
3. Return a distinguishable error status so the frontend can tell the player to retry:
   ```ts
   // In catch blocks, change feedback:
   return {
     score: 0,
     feedback: 'Temporary error evaluating your answer. Please try submitting again.',
     reasoning: String(error),
   };
   ```
4. In `VerificationService`, when the AI strategy returns `score: 0` due to an error, map it to `AttemptStatus.ERROR` instead of `INCORRECT` — this already happens via the `statusMap` in `PlayerService.submitAnswer()`, but verify the `VerificationResult.status` returned by strategies is `'ERROR'` (not `'INCORRECT'`) on exception. Currently the strategies return `'INCORRECT'` on `score: 0` which is wrong for transient failures.

   **Fix in strategies** (`photo-ai.strategy.ts`, `text-ai.strategy.ts`, `audio-ai.strategy.ts`): In the catch block of `AiService.evaluateText/evaluatePhoto`, the returned score is `0` which causes the strategy to return `'INCORRECT'`. Instead, add a `isError` flag to `AiEvaluationResult`:
   ```ts
   // In AiService, in catch blocks:
   return {
     score: 0,
     feedback: 'Temporary error evaluating your answer. Please try submitting again.',
     reasoning: String(error),
     isError: true, // new field
   };
   ```
   ```ts
   // In strategies, check for error:
   if (result.isError) {
     return { status: 'ERROR', score: 0, feedback: result.feedback, aiResult: result };
   }
   ```

---

### M8. Ranking TTL Could Cause Data Loss During Long Reads

**Problem**: The 7-day TTL is refreshed on writes (`updateScore`) but not on reads. During a period with no score changes, the key could expire while still being actively viewed.

**Files to change**:
- `apps/backend/src/modules/ranking/ranking.service.ts`

**Steps**:
1. Touch the TTL on reads too — add `expire` call in `getRanking()`:
   ```ts
   async getRanking(runId: string, limit = 50): Promise<RankEntry[]> {
     try {
       const key = this.rankingKey(runId);
       const results = await this.redis.zrevrangebyscore(
         key, '+inf', '-inf', 'WITHSCORES', 'LIMIT', 0, limit,
       );
   
       if (results.length > 0) {
         // Refresh TTL on read to prevent expiry during active consumption
         await this.redis.expire(key, RANKING_TTL_SECONDS);
         // ... parse entries
       }
     } catch (error) { /* ... */ }
     // ... fallback
   }
   ```
2. Apply the same in `getTeamRanking()` and `getUserRank()`.

---

## 🟢 Minor Issues

### S1. Hardcoded Polish Strings in Backend

**Problem**: AI prompts and strategy error messages use hardcoded Polish.

**Files to change**:
- `apps/backend/src/modules/ai/ai.service.ts` — `"Write hints in Polish"`, etc.
- `apps/backend/src/modules/task/verification/strategies/text-ai.strategy.ts` — `"Brak odpowiedzi"`
- `apps/backend/src/modules/task/verification/strategies/audio-ai.strategy.ts` — `"Brak transkrypcji nagrania"`
- `apps/backend/src/modules/task/verification/strategies/mixed.strategy.ts` — `"Brak odpowiedzi na ten krok"`

**Steps**:
1. Create `apps/backend/src/common/constants/messages.ts`:
   ```ts
   /** Default locale for AI-generated content and player-facing messages. */
   export const DEFAULT_LOCALE = 'pl';
   
   export const MESSAGES = {
     noAnswer: 'Brak odpowiedzi',
     noTranscription: 'Brak transkrypcji nagrania',
     noAnswerForStep: 'Brak odpowiedzi na ten krok',
     stepLabel: (i: number) => `Krok ${i}`,
   } as const;
   
   /** AI content generation language instruction. */
   export const AI_LANGUAGE_INSTRUCTION = 'in Polish';
   ```
2. Import and use in the 4 files above instead of inline strings.
3. This makes future i18n straightforward — swap `MESSAGES` based on game locale.

---

### S2. Unused `Logger` in `StorageService`

**File**: `apps/backend/src/modules/storage/storage.service.ts`

**Steps**:
1. Remove the unused `logger` field:
   ```ts
   // DELETE this line:
   private readonly logger = new Logger(StorageService.name);
   ```
2. Remove the `Logger` import if no longer used.

---

### S3. Mobile API Types Redeclare Shared Types

**Problem**: `apps/mobile/src/services/api.ts` redefines `TaskType`, `AttemptStatus`, `Game`, `Task`, etc.

**Steps** (lower priority — substantial refactor):
1. In `packages/shared/src/types`, add mobile-friendly interfaces (e.g., `MobileGame`, `MobileTask`) or make existing ones generic enough.
2. Alternatively, keep the mapper approach but import the raw backend types from `@citygame/shared` and only redefine the mobile-specific view types.
3. At minimum, replace the `TaskType` and `AttemptStatus` string union re-declarations with imports:
   ```ts
   // In apps/mobile/src/services/api.ts, REPLACE:
   export type TaskType = 'QR_SCAN' | 'GPS_REACH' | ...;
   // WITH:
   import { TaskType, AttemptStatus } from '@citygame/shared';
   export type { TaskType, AttemptStatus };
   ```

---

### S4. `useGameStore.getTaskHints` Breaks Zustand Reactivity

**File**: `apps/mobile/src/stores/gameStore.ts`

**Steps**:
1. Remove the deprecated `getTaskHints` action. The selector `selectTaskHints` already exists.
2. Search for any callers of `getTaskHints` and migrate to the selector:
   ```ts
   // FROM:
   const hints = useGameStore.getState().getTaskHints(taskId);
   // TO:
   const hints = useGameStore(selectTaskHints(taskId));
   ```
3. Remove from the store:
   ```ts
   // DELETE from store definition:
   /** @deprecated Use `selectTaskHints(taskId)` selector instead. */
   getTaskHints: (taskId: string) => RevealedHint[];
   
   // DELETE from implementation:
   getTaskHints: (taskId: string): RevealedHint[] => {
     return useGameStore.getState().revealedHints.get(taskId) ?? [];
   },
   ```

---

### S5. Missing `OnModuleDestroy` Interface on `RankingGateway`

**File**: `apps/backend/src/modules/ranking/ranking.gateway.ts` (line 76)

**Steps**:
1. Add `OnModuleDestroy` to the imports and `implements` clause:
   ```ts
   import { OnModuleDestroy } from '@nestjs/common';
   
   // Change:
   export class RankingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
   // To:
   export class RankingGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
   ```

---

### S6. Admin WebSocket Infinite Reconnect

**File**: `apps/admin/src/hooks/useWebSocket.ts`

**Steps**:
1. Add a max retry limit:
   ```ts
   const MAX_RECONNECT_ATTEMPTS = 10;
   
   const handleDisconnect = () => {
     setStatus('disconnected');
   
     if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
       console.warn('WebSocket: max reconnection attempts reached');
       return;
     }
   
     const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 16000);
     reconnectAttempts.current += 1;
     // ... rest unchanged
   };
   ```
2. Reset `reconnectAttempts.current = 0` on successful connect (already done ✓).

---

### S7. Shared Package Source Import in `exports`

**File**: `packages/shared/package.json`

**Steps**:
1. Change the `exports` to only reference built files, or rely on Turborepo's `^build`:
   ```json
   "exports": {
     ".": {
       "types": "./dist/index.d.ts",
       "import": "./dist/index.js",
       "default": "./dist/index.js"
     }
   }
   ```
2. Ensure all consumers have `"@citygame/shared": ["../../packages/shared/src/index.ts"]` in their `tsconfig.json` paths for dev-time resolution (backend already does this ✓, verify admin and mobile).

---

### S8. Review & Standardize ESLint Config

**File**: `eslint.config.mjs` (root)

**Steps**:
1. Read and audit `eslint.config.mjs` and per-app overrides.
2. Ensure consistent rules: `no-console` (warn), `@typescript-eslint/no-explicit-any` (warn), `@typescript-eslint/no-unused-vars` (error with ignore pattern for `_` prefix).
3. Run `pnpm lint` across the monorepo and fix any violations.

---

## 📋 Implementation Order

| Phase | Issues | Effort | Risk |
|-------|--------|--------|------|
| **1 — Critical security** | C2, C3, M3 | 2–3 hours | High — blocks production |
| **2 — Data integrity** | C4, M8 | 1 hour | Medium |
| **3 — Type unification** | C1, S3 | 1–2 hours | Low — breaks if types drift |
| **4 — Input validation** | M2, M5 | 1 hour | Low |
| **5 — CORS consistency** | M4 | 1 hour | Medium |
| **6 — Performance** | M6, M7 | 2 hours | Medium |
| **7 — Frontend testing** | M1 | 4–6 hours | Low — quality gate |
| **8 — Cleanup** | S1, S2, S4, S5, S6, S7, S8 | 2–3 hours | Low |

**Total estimated effort**: ~15–20 hours

After each phase, run:
```bash
pnpm typecheck   # Verify no type errors
pnpm test         # Verify existing tests pass
pnpm lint         # Verify code style
```
