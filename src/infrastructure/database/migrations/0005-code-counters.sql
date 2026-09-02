CREATE TABLE IF NOT EXISTS "code_counters" (
  "tenant_id" uuid NOT NULL,
  "entity_type" varchar(32) NOT NULL,
  "scope_key" varchar(64) NOT NULL,
  "last_value" integer NOT NULL DEFAULT 0,
  CONSTRAINT "code_counters_pkey" PRIMARY KEY ("tenant_id", "entity_type", "scope_key"),
  CONSTRAINT "fk_code_counters_tenant"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_code_counters_tenant_entity"
  ON "code_counters" ("tenant_id", "entity_type");

ALTER TABLE IF EXISTS "code_counters" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "code_counters_tenant_isolation_policy" ON "code_counters";
CREATE POLICY "code_counters_tenant_isolation_policy"
ON "code_counters"
AS PERMISSIVE FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
