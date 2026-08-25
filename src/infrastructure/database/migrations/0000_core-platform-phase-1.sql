CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."fy_status_enum" AS ENUM('open', 'closed', 'locked');--> statement-breakpoint
CREATE TYPE "public"."org_status_enum" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."permission_scope_enum" AS ENUM('own', 'branch', 'organization', 'tenant', 'global');--> statement-breakpoint
CREATE TYPE "public"."reset_policy_enum" AS ENUM('financial_year', 'calendar_year', 'monthly', 'never');--> statement-breakpoint
CREATE TYPE "public"."subscription_status_enum" AS ENUM('active', 'past_due', 'canceled', 'trialing');--> statement-breakpoint
CREATE TYPE "public"."tenant_status_enum" AS ENUM('active', 'suspended', 'trial', 'expired', 'cancelled', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."user_status_enum" AS ENUM('active', 'inactive', 'locked', 'pending_verification');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "org_status_enum" DEFAULT 'active' NOT NULL,
	"is_head_office" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" varchar(100),
	"district" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_branch_soft_delete" CHECK (((("branches"."is_deleted") = false AND ("branches"."deleted_at") IS NULL) OR (("branches"."is_deleted") = true AND ("branches"."deleted_at") IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "financial_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "fy_status_enum" DEFAULT 'open' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_financial_year_dates" CHECK ("financial_years"."start_date" < "financial_years"."end_date"),
	CONSTRAINT "check_fy_soft_delete" CHECK (((("financial_years"."is_deleted") = false AND ("financial_years"."deleted_at") IS NULL) OR (("financial_years"."is_deleted") = true AND ("financial_years"."deleted_at") IS NOT NULL))),
	CONSTRAINT "check_fy_locked_status" CHECK (NOT (("financial_years"."is_locked") = true AND ("financial_years"."status") = 'open'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"gst_no" varchar(50),
	"pan_no" varchar(50),
	"cin_no" varchar(50),
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(255),
	"base_currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"fiscal_calendar" varchar(50) DEFAULT 'standard' NOT NULL,
	"status" "org_status_enum" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_org_soft_delete" CHECK (((("organizations"."is_deleted") = false AND ("organizations"."deleted_at") IS NULL) OR (("organizations"."is_deleted") = true AND ("organizations"."deleted_at") IS NOT NULL))),
	CONSTRAINT "check_org_default_status" CHECK (NOT (("organizations"."is_default") = true AND ("organizations"."status") = 'archived'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_code" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"scope" "permission_scope_enum" DEFAULT 'tenant' NOT NULL,
	"permission_key" varchar(150) NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permissions_permission_key_unique" UNIQUE("permission_key")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_monthly" numeric(12,2) NOT NULL DEFAULT 0,
	"max_users" integer,
	"max_storage_gb" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_plans_name" ON "subscription_plans" USING btree ("name");--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_module_id" uuid,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"module_group" varchar(100) NOT NULL DEFAULT 'Administration',
	"description" text,
	"icon" text,
	"route" varchar(255),
	"is_core" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_modules_code" ON "modules" USING btree ("code");--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "fk_modules_parent" FOREIGN KEY ("parent_module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"tenant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_role_soft_delete" CHECK (((("roles"."is_deleted") = false AND ("roles"."deleted_at") IS NULL) OR (("roles"."is_deleted") = true AND ("roles"."deleted_at") IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "tenant_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enabled_by" uuid,
	"enabled_reason" text,
	"disabled_at" timestamp with time zone,
	"disabled_by" uuid,
	CONSTRAINT "check_tenant_module_lifecycle" CHECK (((("tenant_modules"."enabled") = true AND ("tenant_modules"."disabled_at") IS NULL) OR (("tenant_modules"."enabled") = false AND ("tenant_modules"."disabled_at") IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "tenant_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_plan_id" uuid NOT NULL,
	"status" "subscription_status_enum" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_sub_soft_delete" CHECK (((("tenant_subscriptions"."is_deleted") = false AND ("tenant_subscriptions"."deleted_at") IS NULL) OR (("tenant_subscriptions"."is_deleted") = true AND ("tenant_subscriptions"."deleted_at") IS NOT NULL))),
	CONSTRAINT "check_subscription_dates" CHECK ("tenant_subscriptions"."starts_at" < "tenant_subscriptions"."expires_at")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"subdomain" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"locale" varchar(20) DEFAULT 'en_US' NOT NULL,
	"status" "tenant_status_enum" DEFAULT 'trial' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_tenant_soft_delete" CHECK (((("tenants"."is_deleted") = false AND ("tenants"."deleted_at") IS NULL) OR (("tenants"."is_deleted") = true AND ("tenants"."deleted_at") IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "user_branch_access" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "user_branch_access_pkey" PRIMARY KEY("user_id","branch_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "user_organization_access" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "user_organization_access_pkey" PRIMARY KEY("user_id","organization_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"allow" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_permissions_pkey" PRIMARY KEY("user_id","permission_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"branch_id" uuid,
	"access_token_id" varchar(255),
	"refresh_token_hash" varchar(255) NOT NULL,
	"device" varchar(255),
	"user_agent" text,
	"ip_address" varchar(45),
	"location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"termination_reason" varchar(100),
	"login_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"logout_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_session_expiry" CHECK ("user_sessions"."expires_at" > "user_sessions"."login_at"),
	CONSTRAINT "check_session_activity" CHECK ("user_sessions"."last_activity_at" >= "user_sessions"."login_at"),
	CONSTRAINT "check_session_logout" CHECK ("user_sessions"."logout_at" IS NULL OR "user_sessions"."logout_at" >= "user_sessions"."login_at"),
	CONSTRAINT "check_session_revocation_coherence" CHECK (((("user_sessions"."revoked_at") IS NULL AND ("user_sessions"."termination_reason") IS NULL) OR (("user_sessions"."revoked_at") IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid,
	"default_branch_id" uuid,
	"username" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"status" "user_status_enum" DEFAULT 'active' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_reset_token_hash" varchar(255),
	"password_reset_expires_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"encrypted_mfa_secret" text,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "check_user_soft_delete" CHECK (((("users"."is_deleted") = false AND ("users"."deleted_at") IS NULL) OR (("users"."is_deleted") = true AND ("users"."deleted_at") IS NOT NULL))),
	CONSTRAINT "check_user_reset_expiry" CHECK (("users"."password_reset_expires_at" IS NULL OR "users"."password_reset_token_hash" IS NOT NULL))
);
--> statement-breakpoint
-- Ensure composite unique indexes exist before adding foreign keys that reference them
CREATE UNIQUE INDEX "uq_org_id_tenant" ON "organizations" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_id_tenant" ON "roles" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_id_tenant" ON "users" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_branch_id_tenant" ON "branches" USING btree ("id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fy_id_tenant" ON "financial_years" USING btree ("id","tenant_id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "fk_branch_org_tenant" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_years" ADD CONSTRAINT "fk_fy_org_tenant" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions_role" FOREIGN KEY ("role_id","tenant_id") REFERENCES "public"."roles"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "fk_ub_access_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "fk_ub_access_branch" FOREIGN KEY ("branch_id","tenant_id") REFERENCES "public"."branches"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_access" ADD CONSTRAINT "user_organization_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_access" ADD CONSTRAINT "fk_uo_access_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_access" ADD CONSTRAINT "fk_uo_access_org" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "fk_user_perms_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role" FOREIGN KEY ("role_id","tenant_id") REFERENCES "public"."roles"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_session_user_tenant" FOREIGN KEY ("user_id","tenant_id") REFERENCES "public"."users"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_session_org_tenant" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "fk_session_branch_tenant" FOREIGN KEY ("branch_id","tenant_id") REFERENCES "public"."branches"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "fk_user_org_tenant" FOREIGN KEY ("organization_id","tenant_id") REFERENCES "public"."organizations"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "fk_user_branch_tenant" FOREIGN KEY ("default_branch_id","tenant_id") REFERENCES "public"."branches"("id","tenant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_branch_code_active" ON "branches" USING btree ("tenant_id","code") WHERE "branches"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_head_office" ON "branches" USING btree ("organization_id") WHERE "branches"."is_head_office" = true AND "branches"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_default_branch" ON "branches" USING btree ("organization_id") WHERE "branches"."is_default" = true AND "branches"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_financial_year" ON "financial_years" USING btree ("tenant_id","organization_id") WHERE "financial_years"."is_active" = true AND "financial_years"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_org_code_active" ON "organizations" USING btree ("tenant_id","code") WHERE "organizations"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_default_organization" ON "organizations" USING btree ("tenant_id") WHERE "organizations"."is_default" = true AND "organizations"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "idx_role_permissions_tenant_role" ON "role_permissions" USING btree ("tenant_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_role_name_active" ON "roles" USING btree ("tenant_id","name") WHERE "roles"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_role_code_active" ON "roles" USING btree ("tenant_id","code") WHERE "roles"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_tenant_module" ON "tenant_modules" USING btree ("tenant_id","module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_subdomain_active" ON "tenants" USING btree ("subdomain") WHERE "tenants"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_slug_active" ON "tenants" USING btree ("slug") WHERE "tenants"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "idx_user_branch_access_tenant_user" ON "user_branch_access" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_organization_access_tenant_user" ON "user_organization_access" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_permissions_tenant_user" ON "user_permissions" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_tenant_user" ON "user_roles" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_email_active" ON "users" USING btree ("tenant_id","email") WHERE "users"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_username_active" ON "users" USING btree ("tenant_id","username") WHERE "users"."is_deleted" = false;--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "branches";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "branches" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "financial_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_years" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "financial_years";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "financial_years" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "organizations";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "organizations" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "role_permissions" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "roles";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "roles" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tenant_modules";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tenant_modules" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tenant_subscriptions";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tenant_subscriptions" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "user_branch_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_branch_access" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_branch_access";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user_branch_access" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "user_organization_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_organization_access" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_organization_access";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user_organization_access" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_permissions";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user_permissions" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_roles";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user_roles" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user_sessions";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "user_sessions" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "users";--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "users" AS PERMISSIVE FOR ALL USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);