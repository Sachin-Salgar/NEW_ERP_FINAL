-- Allow the canonical platform authentication flow to create and use
-- platform-context sessions while preserving tenant isolation for tenant sessions.
-- The application sets app.platform_session_enabled transaction-locally only
-- around platform session operations.

DROP POLICY IF EXISTS tenant_isolation_policy ON public.user_sessions;
DROP POLICY IF EXISTS user_sessions_context_visibility_policy ON public.user_sessions;

CREATE POLICY user_sessions_context_visibility_policy ON public.user_sessions
USING (
  (
    context_type = 'tenant'::public.session_context_enum
    AND tenant_id = (current_setting('app.current_tenant_id', true))::uuid
  )
  OR
  (
    context_type = 'platform'::public.session_context_enum
    AND current_setting('app.platform_session_enabled', true) = 'true'
  )
)
WITH CHECK (
  (
    context_type = 'tenant'::public.session_context_enum
    AND tenant_id = (current_setting('app.current_tenant_id', true))::uuid
  )
  OR
  (
    context_type = 'platform'::public.session_context_enum
    AND current_setting('app.platform_session_enabled', true) = 'true'
  )
);
