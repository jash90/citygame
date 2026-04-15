# CityGame — Project Fix & Improvement Plan

> Audited against all AGENTS.md rules. Every item references the exact rule,
> the affected files with line counts, and a concrete fix.

---

## Current Project State

| Metric | Value |
|--------|-------|
| Lint | ✅ 0 errors, 0 warnings |
| Typecheck | ✅ 0 errors across 6 packages |
| Tests | ✅ 28 suites, 211 tests passing |

---

## 1. SRP — Files Over 300 Lines

> *"Keep files under 300 lines. If a file grows beyond that, extract focused sub-modules."*

### 1.1 `player.service.ts` — 480 lines 🔴

**What's in it**: `startGame`, `startTeamGame` (private), `getProgress`, `getMyActiveSession`, `getRunAnswers`, `devCompleteTask`

**Fix**: Extract to 3 services:

| New service | Methods | Est. lines |
|---|---|---|
| `PlayerService` | `startGame`, `startTeamGame` | ~170 |
| `PlayerQueryService` *(already created, unused)* | `getProgress`, `getMyActiveSession`, `getRunAnswers` | ~180 |
| `PlayerDevService` | `devCompleteTask` | ~100 |

**Files**: `apps/backend/src/modules/player/player.service.ts`, `player.module.ts`, `player.controller.ts`

---

### 1.2 `game.service.ts` — 379 lines 🟡

**What's in it**: `findAll`, `findOne`, `findOnePublic`, `create`, `update`, `delete`, `publish`, `unpublish`, `archive`, `getGameSessions`

**Fix**: Extract status transitions into `GameStatusService`:

| Service | Methods | Est. lines |
|---|---|---|
| `GameService` | `findAll`, `findOne`, `findOnePublic`, `create`, `update`, `delete` | ~200 |
| `GameStatusService` | `publish`, `unpublish`, `archive` | ~120 |
| `getGameSessions` → move to `GameRunService` | `getGameSessions` | adds ~40 |

**Files**: `apps/backend/src/modules/game/game.service.ts`, `game.module.ts`, `admin-game.controller.ts`

---

### 1.3 `ranking.service.ts` — 352 lines 🟡

**What's in it**: player ranking (`updateScore`, `getRanking`, `getRankingWithNames`, `getUserRank`) + team ranking (`updateTeamScore`, `getTeamRanking`, `getTeamRankingWithNames`) + `getActiveRunId`

**Fix**: Split into `RankingPlayerService` and `RankingTeamService`. Shared `getActiveRunId` moves to `GameRunService`.

---

### 1.4 `ranking.gateway.ts` — 324 lines 🟡

**What's in it**: WS join/leave + location tracking (`playerLocations` map, cleanup interval, `handleLocationUpdate`) + broadcast methods

**Fix**: Extract `PlayerLocationService`:
- `PlayerLocationService`: location map, `handleLocationUpdate`, `broadcastPlayerLocations`, cleanup
- Gateway stays thin: join/leave rooms, delegate location tracking

---

### 1.5 `player-task.service.ts` — 335 lines 🟡

**What's in it**: `unlockTask`, `submitAnswer`, `useHint`, `requireActiveSession` (private)

**Fix**: Close to the limit. Extract `TaskUnlockService` with `unlockTask` (~60 lines) if it grows. Otherwise acceptable.

---

### 1.6 `game-run.service.ts` — 309 lines 🟡

**What's in it**: `startRun`, `endRun`, `restartGame`, `getRunHistory`, `getRunTaskCompletions`, `getRunActivity`, `getRunningGames`

**Fix**: Extract `GameRunActivityService` with `getRunActivity` (~70 lines). Move `getRunTaskCompletions` to `GameAnalyticsService`.

---

### 1.7 `ai.service.ts` — 336 lines 🟡

**What's in it**: model management + OpenAI communication helpers + evaluation methods + generation methods

**Fix**: Split into `AiClientService` (client wrapper, `createChatCompletion`, `extractText`, `parseResponse`, `imageToDataUri`, model/cache management) and keep `AiService` (evaluation + generation orchestration).

---

### 1.8 Frontend files over 300 lines 🟡

| File | Lines | Fix |
|------|-------|-----|
| `admin/TaskEditorForm.tsx` | 588 | Extract `TaskLocationFields`, `TaskVerificationConfig`, `TaskUnlockConfig` sub-components |
| `mobile/[taskId].tsx` | 489 | Extract `useTaskSubmission` hook, `TaskUnlockView`, `TaskAnswerForm` components |
| `mobile/api.ts` | 457 | Split into `api/client.ts`, `api/auth.ts`, `api/games.ts`, `api/player.ts`, `api/storage.ts`, `api/types.ts` |
| `admin/AiModelTab.tsx` | 424 | Extract `ModelList`/`ModelCard`, move API calls to `useAiModels` hook |
| `admin/GameSettingsEditor.tsx` | 385 | Extract `TeamSettingsSection`, `TimerSettingsSection` |
| `admin/analytics/page.tsx` | 372 | Extract chart composition into `GameAnalyticsView` component |
| `mobile/TaskRenderer.tsx` | 358 | Extract per-type renderers: `TextInputRenderer`, `PhotoCaptureRenderer`, etc. |
| `admin/useMonitor.ts` | 318 | Split into `useGameMonitor`, `usePlayerLocations`, `useRunTimer` hooks |
| `admin/AIPromptEditor.tsx` | 310 | Extract `PromptTestPanel` component |
| `admin/game/[gameId]/page.tsx` | 302 | Extract `GameDetailHeader`, `GameStatusActions` components |

---

## 2. DIP — Dependency Inversion Violations

> *"Business logic never reads environment variables with `process.env.X` directly."*
> *"Components never call `fetch` or API clients directly."*

### 2.1 `process.env` in backend services 🟡

| File | Usage | Status |
|------|-------|--------|
| `player.module.ts:12` | `process.env.ENABLE_DEV_ENDPOINTS` | Module registration — acceptable for now |
| `cors.ts:14,23` | `process.env.CORS_ORIGIN`, `process.env.NODE_ENV` | Utility used at bootstrap/gateway — acceptable |
| `main.ts` | `process.env.JWT_SECRET`, `process.env.PORT` | Bootstrap root — correct place |

**Verdict**: All remaining `process.env` usage is at the composition root level, not in business logic. ✅ Previously fixed all service-level violations.

---

### 2.2 `new ConcreteClass()` in modules (factory providers) ✅

Already fixed — `Expo`, `S3Client`, and `OpenAI` are now injected via factory providers in their respective modules.

---

### 2.3 Admin components calling `api` directly 🔴

> *"Data fetching through hooks/React Query — components never call API clients directly."*

**9 components** import `api` from `@/lib/api` directly:

| Component | API calls | Fix |
|-----------|-----------|-----|
| `AiModelTab.tsx` | `api.get('/api/admin/ai/models')`, `api.patch(...)` | Create `useAiModels()` hook |
| `SystemInfoTab.tsx` | `api.get('/api/admin/system/info')` | Create `useSystemInfo()` hook |
| `UserManagementTab.tsx` | `api.get('/api/admin/users?...')`, `api.patch(...)` | Create `useAdminUsers()` hook |
| `Header.tsx` | `api.get('/api/auth/me')`, `api.post('/api/auth/logout')` | Use existing `useAuth()` |
| `AuthGuard.tsx` | `api.get('/api/auth/me')` | Use existing `useAuth()` |
| `GameSettingsEditor.tsx` | `api.patch('/api/admin/games/...')` | Create `useUpdateGame()` mutation hook |
| `GameTable.tsx` | `api.get('/api/admin/games?limit=5')` | Create `useAdminGames()` hook |
| `AIGenerateButton.tsx` | `api.post('/api/admin/ai/...')` | Create `useAiGenerate()` hook |
| `AIPromptEditor.tsx` | `api.post('/api/admin/ai/test-prompt')` | Create `useAiTestPrompt()` hook |

**+ 7 admin pages** also import `api` directly. Create page-level hooks or move queries into existing hooks.

---

### 2.4 Mobile components importing from `@/services/api` directly 🟡

**9 components** import types or API functions from `@/services/api`:
- `Badge.tsx`, `Podium.tsx`, `RankItem.tsx`, `GameBrowser.tsx`, `GamePrologueModal.tsx`, `GameCard.tsx`, `TaskPin.tsx`, `TaskCard.tsx` — import **types only** (acceptable)
- `TaskRenderer.tsx` — imports `storageApi` and calls `fetch()` directly → needs `useFileUpload()` hook

---

## 3. ISP — Interface Segregation

> *"Prefer targeted imports. Export granular types, not monolithic barrels."*

### 3.1 Mobile `api.ts` duplicates types from `@citygame/shared` 🔴

`api.ts` defines **15 types locally** that overlap with shared package:

| Local type | Shared equivalent |
|-----------|------------------|
| `User` | `User` from `@citygame/shared` |
| `TaskType` | `TaskType` enum from `@citygame/shared` |
| `AttemptStatus` | `AttemptStatus` enum from `@citygame/shared` |
| `Game` | `Game` from `@citygame/shared` (different shape — mobile-friendly) |
| `GameSession` | `GameSession` from `@citygame/shared` |
| `Task` | `Task` from `@citygame/shared` (different shape) |
| `NarrativeSettings` | `NarrativeSettings` from `@citygame/shared` |

**Fix**: Mobile-specific view types (e.g. `Task` with `status: TaskStatus`, `points: number`) differ from shared Prisma-aligned types. Keep mobile view types but **import the matching shared types** and extend/omit as needed:
```ts
import type { Task as SharedTask, TaskType, AttemptStatus } from '@citygame/shared';
// Mobile-specific view type
export interface Task extends Omit<SharedTask, 'unlockConfig' | 'verifyConfig'> {
  points: number;
  status: TaskStatus;
  // ...
}
```
Re-export enums directly: `export { TaskType, AttemptStatus } from '@citygame/shared';`

---

### 3.2 Hardcoded API URL strings in admin 🟡

**16 locations** with hardcoded `/api/admin/...` or `/api/auth/...` paths.

**Fix**: Create `adminApi` object with typed methods:
```ts
export const adminApi = {
  getGames: (page: number, limit = 20) => api.get(`/api/admin/games?page=${page}&limit=${limit}`),
  getGame: (id: string) => api.get(`/api/admin/games/${id}`),
  createGame: (data: CreateGameDto) => api.post('/api/admin/games', data),
  // ...
};
```

---

## 4. OCP — Open/Closed Principle

### 4.1 ✅ Verification strategy pattern — exemplar

No fix needed. `VerificationService` uses a strategy registry. New task types = new strategy class.

### 4.2 `TaskRenderer.tsx` has task-type branching 🟢

Contains if/else based on task type to render different input UIs.

**Fix (low priority)**: Component registry:
```tsx
const RENDERERS: Record<TaskType, ComponentType<RendererProps>> = {
  TEXT_EXACT: TextInputRenderer,
  PHOTO_AI: PhotoCaptureRenderer,
  AUDIO_AI: AudioCaptureRenderer,
  // ...
};
```

---

## 5. LSP — Liskov Substitution

### 5.1 Test mocks lack contract enforcement 🟡

All `*.spec.ts` use `Record<string, any>` for Prisma mocks — no type safety.

**Fix**: Create typed mock factory:
```ts
// test/helpers/mock-prisma.ts
export function createMockPrisma(): jest.Mocked<PrismaService> { ... }
```

### 5.2 `VerificationResult` shape not runtime-validated 🟢

**Fix**: Add Zod schema validation in `VerificationService.verify()`.

---

## 6. Architecture — Cross-Cutting

### 6.1 `player-query.service.ts` created but unused 🟡

Created during previous work but `PlayerController` still delegates `getRunAnswers` and `getMyActiveSession` to `PlayerService`. Need to wire it.

### 6.2 `player.service.ts` still has `devCompleteTask` 🟡

Dev-only code mixed with production session logic. Extract to `PlayerDevService`.

### 6.3 Admin ESLint config needs migration 🟢

`next lint` is deprecated. Migrate to standalone ESLint CLI.

---

## 7. Implementation Priority

### Phase 1 — Backend SRP Splits

| # | Task | Effort |
|---|------|--------|
| 1.1 | Wire `PlayerQueryService` into controller; extract `PlayerDevService` | Medium |
| 1.2 | Extract `GameStatusService` from `GameService` | Medium |
| 1.4 | Extract `PlayerLocationService` from `RankingGateway` | Small |
| 1.6 | Extract `getRunActivity` → `GameRunActivityService` | Small |
| 1.7 | Split `AiService` → `AiClientService` + `AiService` | Medium |
| 1.3 | Split `RankingService` → player + team | Medium |

### Phase 2 — Frontend DIP + ISP

| # | Task | Effort |
|---|------|--------|
| 2.3 | Create admin hooks (`useAiModels`, `useAdminUsers`, `useSystemInfo`, `useAuth`) | Medium |
| 2.4 | Create `useFileUpload()` hook for mobile | Small |
| 3.1 | Deduplicate mobile types → import from `@citygame/shared` | Medium |
| 3.2 | Create `adminApi` URL abstraction | Small |

### Phase 3 — Frontend SRP Splits

| # | Task | Effort |
|---|------|--------|
| 1.8 | Split large frontend components (TaskEditorForm, [taskId], etc.) | Large |
| 1.8 | Split mobile `api.ts` by domain | Medium |

### Phase 4 — Quality

| # | Task | Effort |
|---|------|--------|
| 5.1 | Typed mock factories | Medium |
| 5.2 | Zod validation for `VerificationResult` | Small |
| 4.2 | Task renderer component registry | Small |
| 6.3 | Admin ESLint migration | Small |

---

## 8. What's Already Good ✅

- **DIP**: All external clients (`Expo`, `S3Client`, `OpenAI`) injected via factory providers
- **DIP**: `ConfigService` used in all backend services — no `process.env` in business logic
- **SRP**: Controllers are thin — all delegate to services, zero business logic
- **OCP**: Verification strategy pattern — exemplar implementation
- **ISP**: DTOs properly separated per operation (`CreateGameDto`, `UpdateGameDto`, etc.)
- **SRP**: Zustand stores scoped by domain (auth, game, location, ranking)
- **SRP**: `GameController` split into `AdminGameController` (203 lines) + `PlayerGameController` (31 lines)
- **SRP**: `PlayerService` already split into `PlayerService` + `PlayerTaskService`
- **Shared package**: Types grouped by domain, clean barrel export
- **Tests**: 28 suites, 211 tests, all green
- **Lint/Typecheck**: 0 errors, 0 warnings
