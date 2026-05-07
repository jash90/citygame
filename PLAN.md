# Plan: Character Layer — Faza 1a, 1b, 1c

## Kontekst

Repozytorium CityGame ma działający pipeline AI do generowania gier miejskich (`ai-game-blueprint.service.ts`). Obecnie narrative context (NPC) jest przechowywany ad-hoc w `Task.storyContext` JSON polu jako `characterName`. Cel: wydzielić postacie (Character) jako first-class entity, dodać stage `cast` w pipeline, i pokazać je w mobile/admin UI.

**Worktree:** `.claude/worktrees/ai-game-generator` (branch `worktree-ai-game-generator`)

**Backward compatibility:** `npcId` nullable, `storyContext.characterName` zostaje jako backup, migracja idempotentna.

---

## Faza 1a: Model + migracja danych

### Krok 1 — Prisma schema

**Plik:** `apps/backend/src/prisma/schema.prisma`

Dodać:
- `enum CharacterRoleFunction` (QUEST_GIVER, MENTOR, ANTAGONIST_PROXY, WITNESS, GATEKEEPER, MIRROR, RED_HERRING, UNKNOWN)
- `enum StoryMode` (NONE, FLAVOR, FULL_NARRATIVE)
- `enum TaskRoleInArc` (INTRODUCTION, DEEPENING, TWIST, CLIMAX)
- `enum TaskListMode` (FLAT, GROUPED_BY_NPC)
- `model Character` z polami: id, gameId, name, archetype, roleFunction, voiceTrait, importance (1-5), avatarUrl?, era?, notes?, timestamps + relacje
- Pola na `Task`: `npcId String?`, `npc Character?`, `taskRoleInArc TaskRoleInArc?`
- Pola na `Game`: `storyMode StoryMode @default(NONE)`, `taskListMode TaskListMode @default(FLAT)`, `characters Character[]`
- `@@unique([gameId, name])` na Character
- `onDelete: SetNull` na Task.npc
- `@@index([npcId])` na Task

### Krok 2 — Migracja Prisma

```bash
cd apps/backend && npx prisma migrate dev --name add_character_layer
```

### Krok 3 — Skrypt migracji danych

**Plik:** `apps/backend/scripts/migrate-characters-from-story-context.ts`

Logika:
1. Znajdź taski z `storyContext` zawierającym `characterName` i `npcId = null`
2. Grupuj per `(gameId, characterName)`
3. UPSERT Character per grupa (archetype='nieokreślony', roleFunction=UNKNOWN)
4. UPDATE Task.npcId + heurystyka taskRoleInArc (INTRODUCTION/DEEPENING/CLIMAX)
5. Ustaw storyMode=FLAVOR dla gier które mają characters

### Krok 4 — Shared types

**Plik:** `packages/shared/src/types/task.ts`

Dodać: `characterSchema`, `taskRoleInArcSchema`, rozszerzyć taskSchema o `npcId`, `npc`, `taskRoleInArc`, typy `Character`, `TaskRoleInArc`.

**Plik:** `packages/shared/src/types/game.ts`

Dodać: `StoryMode`, `TaskListMode` enumy + pola na Game interfejsie.

**Plik:** `packages/shared/src/validation/index.ts`

Dodać schematy walidacyjne Character + rozszerzyć istniejące.

### Krok 5 — Backend: include npc w task queries

**Plik:** `apps/backend/src/modules/game/game.service.ts` (findOne, findOnePublic)
**Plik:** `apps/backend/src/modules/game/offline-bundle.service.ts`

Dodać `include: { npc: true }` do task queries.

### Krok 6 — Test regresji

Sprawdzić że existing game UI nie pękł.

---

## Faza 1b: Cast stage w pipeline AI

### Krok 1 — `storyMode` w blueprint input

**Plik:** `packages/shared/src/types/blueprint.ts` — dodać `storyMode` do `BlueprintInput`
**Plik:** `packages/shared/src/validation/index.ts` — rozszerzyć `blueprintInputSchema`
**Plik:** `apps/backend/src/modules/ai/dto/generate-game-blueprint.dto.ts`

### Krok 2 — Schema output `cast` stage

**Plik:** `packages/shared/src/types/blueprint.ts` — dodać `BlueprintCast`, `CastCharacter` interfejsy
**Plik:** `packages/shared/src/validation/index.ts` — dodać `castOutputSchema` z Zod
**Plik:** `apps/backend/src/modules/ai/ai-game-tools.ts` — dodać `castFormat` structured format

### Krok 3 — Prompt `cast` stage

**Plik:** `apps/backend/src/modules/ai/ai-game-prompts.ts` — dodać `buildCastPrompt()`
- System prompt z zasadami tworzenia postaci, opis roleFunction, voiceTrait
- User prompt ze story bible context, parametry gry
- Walidator post-LLM (consistency z bible)

### Krok 4 — Nowy stage `cast` w blueprint service

**Plik:** `apps/backend/src/modules/ai/ai-game-blueprint.service.ts`

Dodać `generateCast()` method. Zmienić flow w `generateGameBlueprint()`:
```
researchPack → storyBible → [cast jeśli FLAVOR] → outline → tasks → endings
```

### Krok 5 — Modyfikacja `tasks` stage

**Plik:** `apps/backend/src/modules/ai/ai-game-prompts.ts` — rozszerzyć `buildTaskForPoiPrompt()` sekcją "DOSTĘPNI NPC" gdy cast != null
**Plik:** `packages/shared/src/validation/index.ts` — rozszerzyć `blueprintTaskSchema` o `npcName`, `taskRoleInArc`

### Krok 6 — Persistence: Character entities z blueprint

**Plik:** `apps/backend/src/modules/game/game-blueprint-persistence.service.ts`

W `createGameFromBlueprint()`:
1. Persist Character entities z cast (upsert po gameId+name)
2. Persist Tasks z npcId
3. Ustaw game.storyMode i game.taskListMode

### Krok 7 — Endpointy stage-by-stage

**Plik:** `apps/backend/src/modules/ai/ai.controller.ts`

Dodać endpoint `POST /api/ai/blueprint/cast` dla stage-by-stage flow.

### Krok 8 — Admin UI: storyMode picker

**Plik:** `apps/admin/src/app/(dashboard)/games/new/ai/page.tsx` lub `BlueprintInputForm.tsx`

Dodać radio: NONE / FLAVOR / FULL_NARRATIVE (disabled).

---

## Faza 1c: UI mobile + admin

### Krok 1 — Mobile: badge NPC w TaskCard

**Plik:** `apps/mobile/src/features/task/components/TaskCard.tsx`

Dodać badge z `task.npc?.name` gdy npc istnieje.

### Krok 2 — Mobile: lista zgrupowana per NPC (warunkowo)

**Plik:** `apps/mobile/app/(tabs)/tasks/index.tsx`

Dodać tryb `GROUPED_BY_NPC` (warunkowo na podstawie game.taskListMode).

### Krok 3 — Mobile: CharacterSheet screen

**Plik:** `apps/mobile/app/character/[id].tsx` (nowy)

Character detail page z task list + revealed clues.

### Krok 4 — Mobile: StoryContextCard klikalny

**Plik:** `apps/mobile/src/features/task/components/StoryContextCard.tsx`

Dodać `Pressable` wrap → nawigacja do CharacterSheet. Fallback na `task.storyContext?.characterName`.

### Krok 5 — Backend: nowe endpointy

- `GET /api/characters/:id` — Character details
- `GET /api/games/:gameId/characters` — lista postaci
- Nowy controller: `apps/backend/src/modules/character/` (character.controller.ts, character.service.ts, character.module.ts)

### Krok 6 — Admin: widok postaci

**Plik:** `apps/admin/src/app/(dashboard)/games/[gameId]/characters/page.tsx` (nowy)

Lista postaci + edytor + regeneracja AI.

### Krok 7 — Admin: dropdown postaci w edytorze zadań

**Plik:** `apps/admin/src/features/editor/components/TaskEditorForm.tsx`

Dropdown z Character entities zamiast text input dla characterName.

---

## Pliki do modyfikacji

### Faza 1a
1. `apps/backend/src/prisma/schema.prisma` — Character model + enumy + pola na Task/Game
2. `packages/shared/src/types/task.ts` — Character types
3. `packages/shared/src/types/game.ts` — StoryMode, TaskListMode
4. `packages/shared/src/types/index.ts` — re-export
5. `packages/shared/src/validation/index.ts` — Character validation schemas
6. `apps/backend/src/modules/game/game.service.ts` — include npc
7. `apps/backend/src/modules/game/offline-bundle.service.ts` — include npc
8. `apps/backend/scripts/migrate-characters-from-story-context.ts` — skrypt migracji (nowy)

### Faza 1b
9. `packages/shared/src/types/blueprint.ts` — BlueprintCast, storyMode w input
10. `packages/shared/src/validation/index.ts` — castOutputSchema, rozszerzenia
11. `apps/backend/src/modules/ai/ai-game-tools.ts` — castFormat
12. `apps/backend/src/modules/ai/ai-game-prompts.ts` — buildCastPrompt, modyfikacja buildTaskForPoiPrompt
13. `apps/backend/src/modules/ai/ai-game-blueprint.service.ts` — generateCast + pipeline flow
14. `apps/backend/src/modules/game/game-blueprint-persistence.service.ts` — persist characters
15. `apps/backend/src/modules/ai/dto/generate-game-blueprint.dto.ts` — storyMode
16. `apps/backend/src/modules/ai/ai.controller.ts` — cast endpoint
17. `apps/admin/.../BlueprintInputForm.tsx` — storyMode radio

### Faza 1c
18. `apps/mobile/src/features/task/components/TaskCard.tsx` — NPC badge
19. `apps/mobile/app/(tabs)/tasks/index.tsx` — grouped mode
20. `apps/mobile/app/character/[id].tsx` — CharacterSheet (nowy)
21. `apps/mobile/src/features/task/components/StoryContextCard.tsx` — klikalny
22. `apps/mobile/src/shared/types/api.types.ts` — Character w BackendTask/Task
23. `apps/backend/src/modules/character/` — nowy moduł (controller, service, module)
24. `apps/backend/src/modules/game/game.module.ts` — import CharacterModule
25. `apps/admin/src/app/(dashboard)/games/[gameId]/characters/page.tsx` — widok postaci (nowy)
26. `apps/admin/src/features/editor/components/TaskEditorForm.tsx` — dropdown postaci

## Reuse

- `callStructured<T>()` z `ai-game-blueprint.service.ts` — uniwersalny runner dla LLM structured output (retry, tier downgrade) — cast stage go używa bez zmian
- `toStructuredFormat()` z `ai-game-tools.ts` — konwersja Zod → structured format — używany dla castOutputSchema
- `buildAnswerHashes()` z `common/utils/offline-hash` — hashowanie odpowiedzi (niezmienione)
- `GameBlueprintPersistenceService.createGameFromBlueprint()` — rozszerzony o Character persist w tej samej transakcji
- `StoryContextCard` — rozszerzony o klikalność, fallback na characterName

## Weryfikacja

1. `cd apps/backend && npx prisma migrate dev` — migracja przechodzi
2. `ts-node scripts/migrate-characters-from-story-context.ts` — idempotentny
3. Istniejące gry wyglądają identycznie w mobile (zero regresji)
4. Nowa gra z `storyMode: FLAVOR` → AI generuje Character entities → taski mają npcId
5. Mobile pokazuje NPC badge w TaskCard → klik → CharacterSheet
6. Admin widzi listę postaci → edytuje → dropdown w task editorze
