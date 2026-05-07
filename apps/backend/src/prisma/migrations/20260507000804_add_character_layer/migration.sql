-- CreateEnum
CREATE TYPE "CharacterRoleFunction" AS ENUM ('QUEST_GIVER', 'MENTOR', 'ANTAGONIST_PROXY', 'WITNESS', 'GATEKEEPER', 'MIRROR', 'RED_HERRING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StoryMode" AS ENUM ('NONE', 'FLAVOR', 'FULL_NARRATIVE');

-- CreateEnum
CREATE TYPE "TaskRoleInArc" AS ENUM ('INTRODUCTION', 'DEEPENING', 'TWIST', 'CLIMAX');

-- CreateEnum
CREATE TYPE "TaskListMode" AS ENUM ('FLAT', 'GROUPED_BY_NPC');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "storyMode" "StoryMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "taskListMode" "TaskListMode" NOT NULL DEFAULT 'FLAT';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "npcId" TEXT,
ADD COLUMN     "taskRoleInArc" "TaskRoleInArc";

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "roleFunction" "CharacterRoleFunction" NOT NULL,
    "voiceTrait" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "avatarUrl" TEXT,
    "era" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Character_gameId_idx" ON "Character"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_gameId_name_key" ON "Character"("gameId", "name");

-- CreateIndex
CREATE INDEX "Task_npcId_idx" ON "Task"("npcId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
