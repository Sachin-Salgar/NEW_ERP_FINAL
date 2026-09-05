ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS financial_year_id uuid;
--> statement-breakpoint

ALTER TABLE user_sessions
  ADD CONSTRAINT fk_user_sessions_financial_year_tenant
    FOREIGN KEY (financial_year_id, tenant_id) REFERENCES financial_years(id, tenant_id);
