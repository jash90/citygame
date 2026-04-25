-- AlterTable: idempotency key for offline-submitted attempts
ALTER TABLE "TaskAttempt" ADD COLUMN "clientSubmissionId" TEXT;
CREATE UNIQUE INDEX "TaskAttempt_clientSubmissionId_key" ON "TaskAttempt"("clientSubmissionId");

-- AlterTable: idempotency key for offline-revealed hints
ALTER TABLE "HintUsage" ADD COLUMN "clientSubmissionId" TEXT;
CREATE UNIQUE INDEX "HintUsage_clientSubmissionId_key" ON "HintUsage"("clientSubmissionId");
