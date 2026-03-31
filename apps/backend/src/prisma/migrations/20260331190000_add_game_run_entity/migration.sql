-- CreateEnum: RunStatus
CREATE TYPE "RunStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable: GameRun
CREATE TABLE "GameRun" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: GameRun unique and search indexes
CREATE UNIQUE INDEX "GameRun_gameId_runNumber_key" ON "GameRun"("gameId", "runNumber");
CREATE INDEX "GameRun_gameId_status_idx" ON "GameRun"("gameId", "status");
CREATE INDEX "GameRun_status_endsAt_idx" ON "GameRun"("status", "endsAt");

-- Backfill: Create GameRun rows from existing Game/GameSession data
-- For each distinct (gameId, runNumber) in GameSession, create a GameRun
INSERT INTO "GameRun" ("id", "gameId", "runNumber", "status", "startedAt", "endsAt", "endedAt")
SELECT
    gen_random_uuid(),
    gs."gameId",
    gs."runNumber",
    CASE
        -- If game has endsAt in the past OR all sessions for this run are non-ACTIVE, mark as ENDED
        WHEN g."endsAt" IS NOT NULL AND g."endsAt" <= NOW() THEN 'ENDED'::"RunStatus"
        WHEN NOT EXISTS (
            SELECT 1 FROM "GameSession" gs2
            WHERE gs2."gameId" = gs."gameId"
              AND gs2."runNumber" = gs."runNumber"
              AND gs2."status" = 'ACTIVE'
        ) THEN 'ENDED'::"RunStatus"
        ELSE 'ACTIVE'::"RunStatus"
    END,
    MIN(gs."startedAt"),
    g."endsAt",
    CASE
        WHEN g."endsAt" IS NOT NULL AND g."endsAt" <= NOW() THEN g."endsAt"
        WHEN NOT EXISTS (
            SELECT 1 FROM "GameSession" gs2
            WHERE gs2."gameId" = gs."gameId"
              AND gs2."runNumber" = gs."runNumber"
              AND gs2."status" = 'ACTIVE'
        ) THEN MAX(gs."completedAt")
        ELSE NULL
    END
FROM "GameSession" gs
JOIN "Game" g ON g."id" = gs."gameId"
GROUP BY gs."gameId", gs."runNumber", g."endsAt";

-- Also create GameRun for published games with currentRun that have no sessions yet
INSERT INTO "GameRun" ("id", "gameId", "runNumber", "status", "startedAt", "endsAt", "endedAt")
SELECT
    gen_random_uuid(),
    g."id",
    g."currentRun",
    CASE
        WHEN g."endsAt" IS NOT NULL AND g."endsAt" <= NOW() THEN 'ENDED'::"RunStatus"
        WHEN g."status" = 'PUBLISHED' AND (g."endsAt" IS NULL OR g."endsAt" > NOW()) THEN 'ACTIVE'::"RunStatus"
        ELSE 'ENDED'::"RunStatus"
    END,
    g."updatedAt",
    g."endsAt",
    CASE
        WHEN g."endsAt" IS NOT NULL AND g."endsAt" <= NOW() THEN g."endsAt"
        ELSE NULL
    END
FROM "Game" g
WHERE g."status" = 'PUBLISHED'
  AND NOT EXISTS (
    SELECT 1 FROM "GameRun" gr WHERE gr."gameId" = g."id" AND gr."runNumber" = g."currentRun"
  );

-- AddForeignKey: GameRun -> Game
ALTER TABLE "GameRun" ADD CONSTRAINT "GameRun_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add gameRunId column to GameSession (nullable first for backfill)
ALTER TABLE "GameSession" ADD COLUMN "gameRunId" TEXT;

-- Backfill: Set gameRunId from matching GameRun
UPDATE "GameSession" gs
SET "gameRunId" = gr."id"
FROM "GameRun" gr
WHERE gr."gameId" = gs."gameId" AND gr."runNumber" = gs."runNumber";

-- Make gameRunId NOT NULL after backfill
ALTER TABLE "GameSession" ALTER COLUMN "gameRunId" SET NOT NULL;

-- AddForeignKey: GameSession -> GameRun
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameRunId_fkey" FOREIGN KEY ("gameRunId") REFERENCES "GameRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex: old unique constraint
DROP INDEX "GameSession_gameId_userId_runNumber_key";

-- CreateIndex: new unique constraint using gameRunId
CREATE UNIQUE INDEX "GameSession_gameRunId_userId_key" ON "GameSession"("gameRunId", "userId");

-- AlterTable: Drop runNumber from GameSession
ALTER TABLE "GameSession" DROP COLUMN "runNumber";

-- AlterTable: Drop endsAt from Game
ALTER TABLE "Game" DROP COLUMN "endsAt";

-- Partial unique index: prevent two ACTIVE runs per game
CREATE UNIQUE INDEX "GameRun_gameId_active_unique" ON "GameRun"("gameId") WHERE "status" = 'ACTIVE';
