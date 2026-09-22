BEGIN;
CREATE TABLE IF NOT EXISTS public.hr_access_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE, user_id uuid, action varchar(30) NOT NULL,
 reason text, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
 EXECUTE 'ALTER TABLE public.hr_access_history ENABLE ROW LEVEL SECURITY';
 EXECUTE 'ALTER TABLE public.hr_access_history FORCE ROW LEVEL SECURITY';
 EXECUTE 'DROP POLICY IF EXISTS hr_access_history_tenant_policy ON public.hr_access_history';
 EXECUTE 'CREATE POLICY hr_access_history_tenant_policy ON public.hr_access_history USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;
DO $$ DECLARE a text; BEGIN
 FOREACH a IN ARRAY ARRAY['create','read','update','delete'] LOOP
 INSERT INTO public.permissions(id,module_code,resource,action,scope,permission_key,display_name,description,is_system)
 VALUES(gen_random_uuid(),'hr','access_history',a,'tenant','hr.access_history.'||a,'HR access history '||a,'HR capability',false)
 ON CONFLICT(permission_key) DO UPDATE SET module_code='hr';
 END LOOP;
END $$;
COMMIT;