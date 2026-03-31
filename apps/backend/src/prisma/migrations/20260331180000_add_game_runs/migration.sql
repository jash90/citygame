-- AlterTable: add currentRun and endsAt to Game
ALTER TABLE "Game" ADD COLUMN "currentRun" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN "endsAt" TIMESTAMP(3);

-- AlterTable: add runNumber to GameSession
ALTER TABLE "GameSession" ADD COLUMN "runNumber" INTEGER NOT NULL DEFAULT 0;

-- DropIndex: old unique constraint
DROP INDEX "GameSession_gameId_userId_key";

-- CreateIndex: new unique constraint including runNumber
CREATE UNIQUE INDEX "GameSession_gameId_userId_runNumber_key" ON "GameSession"("gameId", "userId", "runNumber");
