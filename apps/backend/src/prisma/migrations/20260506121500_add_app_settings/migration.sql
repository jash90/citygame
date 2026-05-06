-- Singleton-style key/value store for runtime-mutable admin settings
-- (e.g. OpenRouter API key + active model overridden from the admin UI).
CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
