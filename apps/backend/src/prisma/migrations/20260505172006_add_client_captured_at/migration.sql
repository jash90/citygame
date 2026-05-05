-- Add `clientCapturedAt` to record when the player ACTUALLY completed the
-- task on their device, distinct from `createdAt` (server insert time).
-- For online submissions the two timestamps are within network RTT of each
-- other; for offline submissions replayed via /sync the gap can be hours.
-- Used as a tie-breaker in the ranking so an offline player's real play
-- time wins ties against an online player who synced earlier.
ALTER TABLE "TaskAttempt" ADD COLUMN "clientCapturedAt" TIMESTAMP(3);
CREATE INDEX "TaskAttempt_clientCapturedAt_idx" ON "TaskAttempt"("clientCapturedAt");
