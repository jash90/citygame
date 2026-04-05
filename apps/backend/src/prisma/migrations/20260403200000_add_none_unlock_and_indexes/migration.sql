-- AlterEnum: Add NONE to UnlockMethod
ALTER TYPE "UnlockMethod" ADD VALUE 'NONE';

-- CreateIndex: User.pushToken for push notification queries
CREATE INDEX "User_pushToken_idx" ON "User"("pushToken");

-- CreateIndex: TaskAttempt(taskId, status) for AI verification stats
CREATE INDEX "TaskAttempt_taskId_status_idx" ON "TaskAttempt"("taskId", "status");

-- CreateIndex: HintUsage(sessionId, userId) for hint lookup queries
CREATE INDEX "HintUsage_sessionId_userId_idx" ON "HintUsage"("sessionId", "userId");
