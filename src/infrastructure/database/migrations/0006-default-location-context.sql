ALTER TABLE IF EXISTS "users"
  ADD COLUMN IF NOT EXISTS "default_location_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_location_tenant'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "fk_user_location_tenant"
      FOREIGN KEY ("default_location_id", "tenant_id")
      REFERENCES "public"."locations"("id", "tenant_id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_users_default_location_tenant"
  ON "users" ("tenant_id", "default_location_id");
