CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_email_verification_tokens_user"
    FOREIGN KEY ("user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_email_verification_tokens_hash"
  ON "email_verification_tokens" ("tenant_id", "token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_verification_tokens_user_active"
  ON "email_verification_tokens" ("tenant_id", "user_id", "expires_at")
  WHERE "consumed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "email_verification_tokens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_verification_tokens_tenant_isolation_policy" ON "email_verification_tokens";
CREATE POLICY "email_verification_tokens_tenant_isolation_policy"
ON "email_verification_tokens"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_password_reset_tokens_user"
    FOREIGN KEY ("user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_password_reset_tokens_hash"
  ON "password_reset_tokens" ("tenant_id", "token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_user_active"
  ON "password_reset_tokens" ("tenant_id", "user_id", "expires_at")
  WHERE "consumed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "password_reset_tokens" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "password_reset_tokens_tenant_isolation_policy" ON "password_reset_tokens";
CREATE POLICY "password_reset_tokens_tenant_isolation_policy"
ON "password_reset_tokens"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
