-- Game flow types, branching transitions, multi-ending support and per-session
-- inventory enabling AI-generated games (linear / branching / open-world / mixed)
-- with cipher chain mechanics where an item revealed at one task is required at
-- another task.

-- ── Enum ────────────────────────────────────────────────────────────────────
CREATE TYPE "GameFlowType" AS ENUM ('LINEAR', 'BRANCHING', 'OPEN_WORLD', 'MIXED');

-- ── Game.flowType ───────────────────────────────────────────────────────────
ALTER TABLE "Game"
  ADD COLUMN "flowType" "GameFlowType" NOT NULL DEFAULT 'LINEAR';

-- ── Task: cipher chain fields ───────────────────────────────────────────────
ALTER TABLE "Task"
  ADD COLUMN "revealsItem" JSONB,
  ADD COLUMN "unlockRequirements" JSONB;

-- ── GameSession: inventory + reached ending ─────────────────────────────────
ALTER TABLE "GameSession"
  ADD COLUMN "unlockedItems" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "endingId" TEXT;

-- ── TaskTransition (graph edges) ────────────────────────────────────────────
CREATE TABLE "TaskTransition" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "fromTaskId" TEXT,
  "toTaskId" TEXT NOT NULL,
  "label" TEXT,
  "condition" JSONB,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskTransition_gameId_idx" ON "TaskTransition"("gameId");
CREATE INDEX "TaskTransition_fromTaskId_toTaskId_idx" ON "TaskTransition"("fromTaskId", "toTaskId");

ALTER TABLE "TaskTransition"
  ADD CONSTRAINT "TaskTransition_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTransition"
  ADD CONSTRAINT "TaskTransition_fromTaskId_fkey"
  FOREIGN KEY ("fromTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTransition"
  ADD CONSTRAINT "TaskTransition_toTaskId_fkey"
  FOREIGN KEY ("toTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── GameEnding (terminal nodes evaluated as rules) ──────────────────────────
CREATE TABLE "GameEnding" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "condition" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameEnding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameEnding_gameId_slug_key" ON "GameEnding"("gameId", "slug");
CREATE INDEX "GameEnding_gameId_idx" ON "GameEnding"("gameId");

ALTER TABLE "GameEnding"
  ADD CONSTRAINT "GameEnding_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── GameSession ↔ GameEnding FK ─────────────────────────────────────────────
ALTER TABLE "GameSession"
  ADD CONSTRAINT "GameSession_endingId_fkey"
  FOREIGN KEY ("endingId") REFERENCES "GameEnding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
