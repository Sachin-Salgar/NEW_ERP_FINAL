-- Phase 4 architecture reconciliation.
-- Tenant is the module/licensing boundary; Branch is the only business
-- subdivision below Tenant.  The legacy organization-module projection is
-- intentionally removed after its enabled state is folded into tenant_modules.

WITH legacy_modules AS (
  SELECT om.tenant_id,
         om.module_id,
         bool_or(om.enabled) AS enabled,
         min(om.enabled_at) AS enabled_at,
         (array_agg(om.enabled_by ORDER BY om.enabled_at NULLS LAST))[1] AS enabled_by,
         CASE WHEN bool_or(om.enabled) THEN NULL ELSE max(om.disabled_at) END AS disabled_at,
         CASE WHEN bool_or(om.enabled) THEN NULL
              ELSE (array_agg(om.disabled_by ORDER BY om.disabled_at DESC NULLS LAST))[1] END AS disabled_by
  FROM public.organization_modules om
  GROUP BY om.tenant_id, om.module_id
)
INSERT INTO public.tenant_modules (
  id, tenant_id, module_id, enabled, enabled_at, enabled_by,
  enabled_reason, disabled_at, disabled_by
)
SELECT gen_random_uuid(), tenant_id, module_id, enabled, enabled_at, enabled_by,
       'migrated-from-organization-module', disabled_at, disabled_by
FROM legacy_modules
ON CONFLICT (tenant_id, module_id) DO NOTHING;

WITH legacy_modules AS (
  SELECT om.tenant_id,
         om.module_id,
         bool_or(om.enabled) AS enabled,
         min(om.enabled_at) AS enabled_at,
         (array_agg(om.enabled_by ORDER BY om.enabled_at NULLS LAST))[1] AS enabled_by,
         CASE WHEN bool_or(om.enabled) THEN NULL ELSE max(om.disabled_at) END AS disabled_at,
         CASE WHEN bool_or(om.enabled) THEN NULL
              ELSE (array_agg(om.disabled_by ORDER BY om.disabled_at DESC NULLS LAST))[1] END AS disabled_by
  FROM public.organization_modules om
  GROUP BY om.tenant_id, om.module_id
)
UPDATE public.tenant_modules tm
SET enabled = tm.enabled OR lm.enabled,
    enabled_at = LEAST(tm.enabled_at, lm.enabled_at),
    enabled_by = COALESCE(tm.enabled_by, lm.enabled_by),
    enabled_reason = COALESCE(tm.enabled_reason, 'migrated-from-organization-module'),
    disabled_at = CASE WHEN tm.enabled OR lm.enabled THEN NULL
                       ELSE COALESCE(tm.disabled_at, lm.disabled_at) END,
    disabled_by = CASE WHEN tm.enabled OR lm.enabled THEN NULL
                       ELSE COALESCE(tm.disabled_by, lm.disabled_by) END
FROM legacy_modules lm
WHERE tm.tenant_id = lm.tenant_id
  AND tm.module_id = lm.module_id;

DROP TRIGGER IF EXISTS trg_initialize_core_organization_modules ON public.organizations;
DROP FUNCTION IF EXISTS public.initialize_core_organization_modules();
DROP TABLE IF EXISTS public.organization_modules;

-- Existing rows remain valid during the transition; new branches no longer
-- require an organization owner. Tenant ownership is enforced by tenant_id.
ALTER TABLE public.branches ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.financial_years
  ADD COLUMN IF NOT EXISTS branch_id uuid;

ALTER TABLE public.financial_years
  DROP CONSTRAINT IF EXISTS fk_financial_year_branch_tenant;

ALTER TABLE public.financial_years
  ADD CONSTRAINT fk_financial_year_branch_tenant
  FOREIGN KEY (branch_id, tenant_id)
  REFERENCES public.branches(id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_financial_years_tenant_branch
  ON public.financial_years (tenant_id, branch_id);
