CREATE TABLE IF NOT EXISTS "mfa_enrollments" (
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "encrypted_secret" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mfa_enrollments_pkey" PRIMARY KEY ("tenant_id", "user_id"),
  CONSTRAINT "fk_mfa_enrollments_user"
    FOREIGN KEY ("user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "mfa_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mfa_enrollments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mfa_enrollments_tenant_isolation_policy" ON "mfa_enrollments";
CREATE POLICY "mfa_enrollments_tenant_isolation_policy"
ON "mfa_enrollments"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_mfa_recovery_codes_user"
    FOREIGN KEY ("user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_mfa_recovery_codes_hash"
  ON "mfa_recovery_codes" ("tenant_id", "user_id", "code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mfa_recovery_codes_active"
  ON "mfa_recovery_codes" ("tenant_id", "user_id")
  WHERE "consumed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mfa_recovery_codes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "mfa_recovery_codes_tenant_isolation_policy" ON "mfa_recovery_codes";
CREATE POLICY "mfa_recovery_codes_tenant_isolation_policy"
ON "mfa_recovery_codes"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
