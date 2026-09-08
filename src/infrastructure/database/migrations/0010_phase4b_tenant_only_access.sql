-- Phase 4B: remove Organization/Location from active authorization.
-- Legacy columns remain readable for forward-compatible data cleanup, but they
-- are no longer foreign-key or RLS boundaries.

ALTER TABLE public.branches
  DROP CONSTRAINT IF EXISTS fk_branch_org_tenant;

DROP INDEX IF EXISTS public.uq_head_office;
DROP INDEX IF EXISTS public.uq_default_branch;

CREATE UNIQUE INDEX IF NOT EXISTS uq_head_office
  ON public.branches (tenant_id)
  WHERE is_head_office = true AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_default_branch
  ON public.branches (tenant_id)
  WHERE is_default = true AND is_deleted = false;

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_modules_tenant_isolation_policy ON public.tenant_modules;
DROP POLICY IF EXISTS tenant_modules_tenant_policy ON public.tenant_modules;
CREATE POLICY tenant_modules_tenant_isolation_policy ON public.tenant_modules
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

