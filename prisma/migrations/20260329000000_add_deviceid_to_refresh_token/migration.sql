-- Issue #1085: Add deviceId to RefreshToken for mobile device binding
-- Nullable to maintain backward compatibility with existing web refresh tokens

ALTER TABLE "refresh_tokens" ADD COLUMN "deviceId" TEXT;

CREATE INDEX "refresh_tokens_deviceId_idx" ON "refresh_tokens"("deviceId");
