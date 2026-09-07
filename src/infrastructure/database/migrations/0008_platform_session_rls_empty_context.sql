-- Prevent platform session lookups from casting unset tenant context settings.
DROP POLICY IF EXISTS user_sessions_active_location_policy ON public.user_sessions;

CREATE POLICY user_sessions_active_location_policy ON public.user_sessions
USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  AND (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
  AND (location_id IS NULL OR location_id = NULLIF(current_setting('app.current_location_id', true), '')::uuid)
  AND (
    location_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_location_access ula
      WHERE ula.tenant_id = user_sessions.tenant_id
        AND ula.user_id = user_sessions.user_id
        AND ula.location_id = user_sessions.location_id
        AND ula.is_active = true
    )
  )
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  AND (organization_id IS NULL OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
  AND (location_id IS NULL OR location_id = NULLIF(current_setting('app.current_location_id', true), '')::uuid)
  AND (
    location_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_location_access ula
      WHERE ula.tenant_id = user_sessions.tenant_id
        AND ula.user_id = user_sessions.user_id
        AND ula.location_id = user_sessions.location_id
        AND ula.is_active = true
    )
  )
);
