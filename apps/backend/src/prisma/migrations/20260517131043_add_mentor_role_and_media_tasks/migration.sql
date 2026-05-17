-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'AUDIO';
ALTER TYPE "TaskType" ADD VALUE 'PHOTO';
ALTER TYPE "TaskType" ADD VALUE 'VIDEO';
ALTER TYPE "TaskType" ADD VALUE 'PRACTICAL';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MENTOR';

-- AlterTable
ALTER TABLE "TaskAttempt" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewerFeedback" TEXT;

-- CreateTable
CREATE TABLE "GameMentor" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMentor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameMentor_mentorId_idx" ON "GameMentor"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "GameMentor_gameId_mentorId_key" ON "GameMentor"("gameId", "mentorId");

-- AddForeignKey
ALTER TABLE "GameMentor" ADD CONSTRAINT "GameMentor_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMentor" ADD CONSTRAINT "GameMentor_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttempt" ADD CONSTRAINT "TaskAttempt_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
