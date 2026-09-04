CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_sessions_id_tenant"
  ON "user_sessions" ("id", "tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_token_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(255) NOT NULL,
  "replaced_by_hash" varchar(255),
  "consumed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_refresh_token_history_session"
    FOREIGN KEY ("session_id", "tenant_id") REFERENCES "public"."user_sessions"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "fk_refresh_token_history_user"
    FOREIGN KEY ("user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_refresh_token_history_hash"
  ON "refresh_token_history" ("tenant_id", "token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_token_history_session"
  ON "refresh_token_history" ("tenant_id", "session_id", "consumed_at" DESC);
--> statement-breakpoint
ALTER TABLE IF EXISTS "refresh_token_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "refresh_token_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "refresh_token_history_tenant_isolation_policy" ON "refresh_token_history";
CREATE POLICY "refresh_token_history_tenant_isolation_policy"
ON "refresh_token_history"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
