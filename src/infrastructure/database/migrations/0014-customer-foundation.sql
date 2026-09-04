-- Customer backend foundation: organization-scoped CRM customers.
CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_at" timestamptz,
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "fk_customers_tenant"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "fk_customer_org_tenant"
    FOREIGN KEY ("organization_id", "tenant_id")
    REFERENCES "public"."organizations"("id", "tenant_id") ON DELETE restrict,
  CONSTRAINT "check_customer_soft_delete" CHECK (
    ("is_deleted" = false AND "deleted_at" IS NULL)
    OR ("is_deleted" = true AND "deleted_at" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "uq_customer_id_tenant"
  ON "customers" ("id", "tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customer_tenant_org_name"
  ON "customers" ("tenant_id", "organization_id", "name", "id")
  WHERE "is_deleted" = false;
--> statement-breakpoint

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "customers_tenant_isolation_policy" ON "customers";
--> statement-breakpoint
CREATE POLICY "customers_tenant_isolation_policy"
ON "customers"
AS PERMISSIVE
FOR ALL
USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
