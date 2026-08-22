ALTER TABLE "user_location_access" DROP CONSTRAINT IF EXISTS "user_location_access_pkey";
--> statement-breakpoint
ALTER TABLE "user_location_access" DROP COLUMN IF EXISTS "id";
--> statement-breakpoint
ALTER TABLE "user_location_access" ADD CONSTRAINT "user_location_access_pkey" PRIMARY KEY ("user_id","location_id","tenant_id");
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "location_id" uuid;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_sessions_tenant_location";
--> statement-breakpoint
ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "fk_session_location_tenant";
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_session_location_tenant" FOREIGN KEY ("location_id","tenant_id") REFERENCES "public"."locations"("id","tenant_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_sessions_tenant_location" ON "user_sessions" ("tenant_id","location_id");
