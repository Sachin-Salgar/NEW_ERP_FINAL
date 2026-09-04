CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "actor_user_id" uuid,
  "action" varchar(160) NOT NULL,
  "resource_type" varchar(120) NOT NULL,
  "resource_id" varchar(255),
  "outcome" varchar(16) NOT NULL,
  "correlation_id" varchar(255),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fk_audit_events_tenant"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "fk_audit_events_actor_user"
    FOREIGN KEY ("actor_user_id", "tenant_id") REFERENCES "public"."users"("id", "tenant_id") ON DELETE SET NULL ("actor_user_id") ON UPDATE NO ACTION,
  CONSTRAINT "check_audit_events_outcome" CHECK ("outcome" IN ('success', 'failure')),
  CONSTRAINT "check_audit_events_action" CHECK (length(btrim("action")) > 0),
  CONSTRAINT "check_audit_events_resource_type" CHECK (length(btrim("resource_type")) > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_tenant_created_at"
  ON "audit_events" ("tenant_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_tenant_actor_created_at"
  ON "audit_events" ("tenant_id", "actor_user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_tenant_resource"
  ON "audit_events" ("tenant_id", "resource_type", "resource_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_events_tenant_correlation"
  ON "audit_events" ("tenant_id", "correlation_id")
  WHERE "correlation_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE IF EXISTS "audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "audit_events_tenant_isolation_policy" ON "audit_events";
CREATE POLICY "audit_events_tenant_isolation_policy"
ON "audit_events"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_prevent_audit_event_update" ON "audit_events";
CREATE TRIGGER "trg_prevent_audit_event_update"
BEFORE UPDATE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_prevent_audit_event_delete" ON "audit_events";
CREATE TRIGGER "trg_prevent_audit_event_delete"
BEFORE DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
