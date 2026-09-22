BEGIN;

-- Canonical employee -> ERP access mapping invariants.
CREATE UNIQUE INDEX IF NOT EXISTS ux_hr_employees_user_id
  ON public.hr_employees(user_id)
  WHERE user_id IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_hr_employees_identity_id
  ON public.hr_employees(identity_id)
  WHERE identity_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_hr_access_history_employee_changed_at
  ON public.hr_access_history(tenant_id, employee_id, changed_at DESC);

-- Employee access history is append-only.
CREATE OR REPLACE FUNCTION public.prevent_hr_access_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hr_access_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_access_history_no_update ON public.hr_access_history;
CREATE TRIGGER trg_hr_access_history_no_update
BEFORE UPDATE OR DELETE ON public.hr_access_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_hr_access_history_mutation();

COMMIT;
