-- Active development baseline: CORE platform and security infrastructure.
--
---
-- PostgreSQL database dump
--


-- Dumped from database version 17.10
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


--

-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--

-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--

-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--

-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--

-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--

-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--

-- Name: credential_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.credential_status_enum AS ENUM (
    'active',
    'inactive',
    'locked'
);


--

-- Name: fy_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fy_status_enum AS ENUM (
    'open',
    'closed',
    'locked'
);


--

-- Name: identity_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.identity_status_enum AS ENUM (
    'active',
    'locked',
    'disabled'
);


--

-- Name: membership_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_status_enum AS ENUM (
    'active',
    'suspended',
    'revoked',
    'pending'
);


--

-- Name: org_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_status_enum AS ENUM (
    'active',
    'inactive',
    'archived'
);


--

-- Name: permission_scope_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.permission_scope_enum AS ENUM (
    'own',
    'branch',
    'organization',
    'tenant',
    'global'
);


--

-- Name: reset_policy_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reset_policy_enum AS ENUM (
    'financial_year',
    'calendar_year',
    'monthly',
    'never'
);


--

-- Name: session_context_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_context_enum AS ENUM (
    'tenant',
    'platform'
);


--

-- Name: subscription_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status_enum AS ENUM (
    'active',
    'past_due',
    'canceled',
    'trialing'
);


--

-- Name: tenant_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tenant_status_enum AS ENUM (
    'active',
    'suspended',
    'trial',
    'expired',
    'cancelled',
    'maintenance'
);


--

-- Name: user_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status_enum AS ENUM (
    'active',
    'inactive',
    'locked',
    'pending_verification'
);


--

-- Name: assign_session_context_compatibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_session_context_compatibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  resolved_identity uuid;
  resolved_membership uuid;
BEGIN
  IF NEW.context_type = 'tenant' AND NEW.identity_id IS NULL THEN
    SELECT identity_id INTO resolved_identity FROM users
    WHERE id = NEW.user_id AND tenant_id = NEW.tenant_id
    LIMIT 1;
    IF resolved_identity IS NULL THEN
      RAISE EXCEPTION 'Cannot create a session for an unmapped tenant user';
    END IF;
    NEW.identity_id := resolved_identity;
  END IF;

  IF NEW.context_type = 'tenant' AND NEW.tenant_membership_id IS NULL THEN
    SELECT id INTO resolved_membership FROM tenant_memberships
    WHERE identity_id = NEW.identity_id AND tenant_id = NEW.tenant_id
    LIMIT 1;
    IF resolved_membership IS NULL THEN
      INSERT INTO tenant_memberships (identity_id, tenant_id, status, activated_at)
      VALUES (NEW.identity_id, NEW.tenant_id, 'active', now())
      RETURNING id INTO resolved_membership;
    END IF;
    NEW.tenant_membership_id := resolved_membership;
  END IF;

  RETURN NEW;
END;
$$;


--

-- Name: assign_user_identity_compatibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_user_identity_compatibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  resolved_identity uuid;
BEGIN
  IF NEW.identity_id IS NULL THEN
    INSERT INTO identities (status, created_at, updated_at)
    VALUES (
      CASE WHEN NEW.status = 'active' THEN 'active'::identity_status_enum
           WHEN NEW.status = 'locked' THEN 'locked'::identity_status_enum
           ELSE 'disabled'::identity_status_enum END,
      COALESCE(NEW.created_at, now()), NEW.updated_at
    )
    RETURNING id INTO resolved_identity;
    NEW.identity_id := resolved_identity;
  END IF;

  INSERT INTO identity_credentials (identity_id, secret_hash, password_changed_at)
  VALUES (NEW.identity_id, NEW.password_hash, COALESCE(NEW.password_changed_at, now()))
  ON CONFLICT (identity_id, provider, credential_type) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash,
        password_changed_at = COALESCE(EXCLUDED.password_changed_at, identity_credentials.password_changed_at),
        updated_at = now();
  RETURN NEW;
END;
$$;


--

-- Name: initialize_core_organization_modules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_core_organization_modules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "organization_modules" (tenant_id, organization_id, module_id, enabled, enabled_at)
  SELECT NEW.tenant_id, NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true OR m.code IN ('crm', 'sales')
  ON CONFLICT (organization_id, module_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    enabled = true,
    enabled_at = NOW(),
    disabled_at = NULL,
    disabled_by = NULL;
  RETURN NEW;
END;
$$;


--

-- Name: initialize_core_tenant_modules(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_core_tenant_modules() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  previous_tenant_id text;
BEGIN
  previous_tenant_id := current_setting('app.current_tenant_id', true);
  PERFORM set_config('app.current_tenant_id', NEW.id::text, true);

  INSERT INTO "tenant_modules" (tenant_id, module_id, enabled, enabled_at)
  SELECT NEW.id, m.id, true, NOW()
  FROM "modules" m
  WHERE m.is_core = true OR m.code IN ('crm', 'sales')
  ON CONFLICT (tenant_id, module_id) DO UPDATE
  SET
    enabled = true,
    enabled_at = NOW(),
    disabled_at = NULL,
    disabled_by = NULL;

  IF previous_tenant_id IS NULL THEN
    RESET app.current_tenant_id;
  ELSE
    PERFORM set_config('app.current_tenant_id', previous_tenant_id, true);
  END IF;

  RETURN NEW;
END;
$$;


--

-- Name: platform_delete_tenant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.platform_delete_tenant(target_tenant uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  UPDATE tenants SET is_deleted = true, status = 'inactive', updated_at = now()
  WHERE id = target_tenant AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;


--

-- Name: platform_update_tenant_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.platform_update_tenant_status(target_tenant uuid, requested_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF requested_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'invalid tenant lifecycle status';
  END IF;
  UPDATE tenants
  SET status = requested_status, updated_at = now()
  WHERE id = target_tenant AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found'; END IF;
END;
$$;


--

-- Name: prevent_audit_event_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_audit_event_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;


--

-- Name: sync_auth_login_identifiers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_auth_login_identifiers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.is_deleted = false AND NEW.status = 'active' THEN
    INSERT INTO auth_login_identifiers (identifier_type, identifier, tenant_id, user_id, identity_id, is_active)
    VALUES
      ('email', NEW.email::citext, NEW.tenant_id, NEW.id, NEW.identity_id, true),
      ('username', NEW.username::citext, NEW.tenant_id, NEW.id, NEW.identity_id, true)
    ON CONFLICT (identifier_type, identifier) DO UPDATE
      SET tenant_id = EXCLUDED.tenant_id,
          user_id = EXCLUDED.user_id,
          identity_id = EXCLUDED.identity_id,
          is_active = true;
  ELSE
    UPDATE auth_login_identifiers SET is_active = false WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--

-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    actor_user_id uuid,
    action character varying(160) NOT NULL,
    resource_type character varying(120) NOT NULL,
    resource_id character varying(255),
    outcome character varying(16) NOT NULL,
    correlation_id character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    context_type public.session_context_enum DEFAULT 'tenant'::public.session_context_enum NOT NULL,
    actor_identity_id uuid,
    actor_membership_id uuid,
    target_tenant_id uuid,
    permission_key character varying(180),
    actor_platform_membership_id uuid,
    CONSTRAINT check_audit_events_action CHECK ((length(btrim((action)::text)) > 0)),
    CONSTRAINT check_audit_events_outcome CHECK (((outcome)::text = ANY ((ARRAY['success'::character varying, 'failure'::character varying])::text[]))),
    CONSTRAINT check_audit_events_resource_type CHECK ((length(btrim((resource_type)::text)) > 0))
);

ALTER TABLE ONLY public.audit_events FORCE ROW LEVEL SECURITY;


--

-- Name: auth_login_identifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_login_identifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier_type character varying(20) NOT NULL,
    identifier public.citext NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    identity_id uuid NOT NULL,
    CONSTRAINT auth_login_identifiers_type_check CHECK (((identifier_type)::text = ANY ((ARRAY['email'::character varying, 'username'::character varying])::text[])))
);


--

-- Name: TABLE auth_login_identifiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.auth_login_identifiers IS 'Deployment-independent login lookup index. It identifies candidate tenant user accounts before tenant-scoped authentication; it is not a tenant authorization boundary.';


--

-- Name: COLUMN auth_login_identifiers.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.auth_login_identifiers.tenant_id IS 'Candidate tenant discovered from the login identity. Membership and tenant authorization are validated by the application before a tenant session is created.';


--

-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    status public.org_status_enum DEFAULT 'active'::public.org_status_enum NOT NULL,
    is_head_office boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    address_line1 text,
    address_line2 text,
    city character varying(100),
    district character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    timezone character varying(100) DEFAULT 'UTC'::character varying NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_branch_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.branches FORCE ROW LEVEL SECURITY;


--

-- Name: code_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.code_counters (
    tenant_id uuid NOT NULL,
    entity_type character varying(32) NOT NULL,
    scope_key character varying(64) NOT NULL,
    last_value integer DEFAULT 0 NOT NULL
);


--

-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.email_verification_tokens FORCE ROW LEVEL SECURITY;


--

-- Name: financial_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public.fy_status_enum DEFAULT 'open'::public.fy_status_enum NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_financial_year_dates CHECK ((start_date < end_date)),
    CONSTRAINT check_fy_locked_status CHECK ((NOT ((is_locked = true) AND (status = 'open'::public.fy_status_enum)))),
    CONSTRAINT check_fy_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.financial_years FORCE ROW LEVEL SECURITY;


--

-- Name: identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status public.identity_status_enum DEFAULT 'active'::public.identity_status_enum NOT NULL,
    security_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    disabled_at timestamp with time zone,
    CONSTRAINT identities_security_version_check CHECK ((security_version > 0))
);


--

-- Name: identity_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identity_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identity_id uuid NOT NULL,
    provider character varying(40) DEFAULT 'local'::character varying NOT NULL,
    credential_type character varying(40) DEFAULT 'password'::character varying NOT NULL,
    secret_hash character varying(255) NOT NULL,
    status public.credential_status_enum DEFAULT 'active'::public.credential_status_enum NOT NULL,
    failed_attempt_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_changed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT identity_credentials_failed_attempts_check CHECK ((failed_attempt_count >= 0))
);


--

-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status public.org_status_enum DEFAULT 'active'::public.org_status_enum NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    address_line1 text,
    address_line2 text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    timezone character varying(100) DEFAULT 'UTC'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_location_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.locations FORCE ROW LEVEL SECURITY;


--

-- Name: mfa_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfa_enrollments (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    encrypted_secret text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.mfa_enrollments FORCE ROW LEVEL SECURITY;


--

-- Name: mfa_recovery_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfa_recovery_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    code_hash character varying(64) NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.mfa_recovery_codes FORCE ROW LEVEL SECURITY;


--

-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_module_id uuid,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    module_group character varying(100) DEFAULT 'Administration'::character varying NOT NULL,
    description text,
    icon text,
    route character varying(255),
    is_core boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--

-- Name: notification_delivery_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_delivery_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    notification_id uuid NOT NULL,
    attempt_no integer NOT NULL,
    provider character varying(120),
    outcome character varying(32) NOT NULL,
    error_code character varying(160),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_notification_attempt_outcome CHECK (((outcome)::text = ANY ((ARRAY['sent'::character varying, 'failed'::character varying])::text[])))
);

ALTER TABLE ONLY public.notification_delivery_attempts FORCE ROW LEVEL SECURITY;


--

-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    channel character varying(32) NOT NULL,
    template_key character varying(160) NOT NULL,
    recipient character varying(320),
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    lease_owner character varying(255),
    lease_expires_at timestamp with time zone,
    last_error character varying(1000),
    CONSTRAINT check_notifications_attempts CHECK (((attempt_count >= 0) AND (max_attempts > 0))),
    CONSTRAINT check_notifications_channel CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'in_app'::character varying])::text[]))),
    CONSTRAINT check_notifications_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'sent'::character varying, 'failed'::character varying])::text[])))
);

ALTER TABLE ONLY public.notifications FORCE ROW LEVEL SECURITY;


--

-- Name: organization_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    module_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled_by uuid,
    disabled_at timestamp with time zone,
    disabled_by uuid,
    CONSTRAINT check_organization_module_lifecycle CHECK ((((enabled = true) AND (disabled_at IS NULL)) OR ((enabled = false) AND (disabled_at IS NOT NULL))))
);

ALTER TABLE ONLY public.organization_modules FORCE ROW LEVEL SECURITY;


--

-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    legal_name character varying(255),
    gst_no character varying(50),
    pan_no character varying(50),
    cin_no character varying(50),
    email character varying(255),
    phone character varying(50),
    website character varying(255),
    base_currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    fiscal_calendar character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    status public.org_status_enum DEFAULT 'active'::public.org_status_enum NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_org_default_status CHECK ((NOT ((is_default = true) AND (status = 'archived'::public.org_status_enum)))),
    CONSTRAINT check_org_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.organizations FORCE ROW LEVEL SECURITY;


--

-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    aggregate_type character varying(160) NOT NULL,
    aggregate_id character varying(255) NOT NULL,
    event_name character varying(200) NOT NULL,
    event_version integer DEFAULT 1 NOT NULL,
    payload jsonb NOT NULL,
    correlation_id character varying(255),
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    lease_owner character varying(255),
    lease_expires_at timestamp with time zone,
    CONSTRAINT check_outbox_event_version CHECK ((event_version > 0))
);

ALTER TABLE ONLY public.outbox_events FORCE ROW LEVEL SECURITY;


--

-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.password_reset_tokens FORCE ROW LEVEL SECURITY;


--

-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    scope public.permission_scope_enum DEFAULT 'tenant'::public.permission_scope_enum NOT NULL,
    permission_key character varying(150) NOT NULL,
    display_name character varying(150) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL
);


--

-- Name: platform_membership_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_membership_roles (
    platform_membership_id uuid NOT NULL,
    platform_role_id uuid NOT NULL
);


--

-- Name: platform_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identity_id uuid NOT NULL,
    status public.membership_status_enum DEFAULT 'active'::public.membership_status_enum NOT NULL,
    security_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    activated_at timestamp with time zone,
    suspended_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by_identity_id uuid,
    CONSTRAINT platform_memberships_security_version_check CHECK ((security_version > 0))
);


--

-- Name: platform_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_code character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    scope public.permission_scope_enum DEFAULT 'global'::public.permission_scope_enum NOT NULL,
    permission_key character varying(180) NOT NULL,
    display_name character varying(150) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL
);


--

-- Name: platform_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_role_permissions (
    platform_role_id uuid NOT NULL,
    platform_permission_id uuid NOT NULL
);


--

-- Name: platform_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(80) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL
);


--

-- Name: platform_security_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_security_policy (
    id boolean DEFAULT true NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    session_lifetime_minutes integer DEFAULT 43200 NOT NULL,
    max_failed_login_attempts integer DEFAULT 5 NOT NULL,
    lockout_minutes integer DEFAULT 15 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_security_policy_id_check CHECK ((id = true)),
    CONSTRAINT platform_security_policy_lockout_minutes_check CHECK (((lockout_minutes >= 1) AND (lockout_minutes <= 1440))),
    CONSTRAINT platform_security_policy_max_failed_login_attempts_check CHECK (((max_failed_login_attempts >= 1) AND (max_failed_login_attempts <= 20))),
    CONSTRAINT platform_security_policy_session_lifetime_minutes_check CHECK (((session_lifetime_minutes >= 5) AND (session_lifetime_minutes <= 43200)))
);


--

-- Name: refresh_token_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_token_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    replaced_by_hash character varying(255),
    consumed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.refresh_token_history FORCE ROW LEVEL SECURITY;


--

-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    tenant_id uuid NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);

ALTER TABLE ONLY public.role_permissions FORCE ROW LEVEL SECURITY;


--

-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_role_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.roles FORCE ROW LEVEL SECURITY;


--

-- Name: scheduled_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    job_type character varying(160) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    schedule_kind character varying(32) NOT NULL,
    cron_expression character varying(255),
    timezone character varying(100) DEFAULT 'UTC'::character varying NOT NULL,
    next_run_at timestamp with time zone NOT NULL,
    lease_owner character varying(255),
    lease_expires_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    status character varying(32) DEFAULT 'scheduled'::character varying NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_scheduled_jobs_attempts CHECK (((max_attempts > 0) AND (attempt_count >= 0))),
    CONSTRAINT check_scheduled_jobs_kind CHECK (((schedule_kind)::text = ANY ((ARRAY['once'::character varying, 'recurring'::character varying])::text[]))),
    CONSTRAINT check_scheduled_jobs_status CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])))
);

ALTER TABLE ONLY public.scheduled_jobs FORCE ROW LEVEL SECURITY;


--

-- Name: security_bootstrap_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_bootstrap_state (
    key character varying(40) NOT NULL,
    used_at timestamp with time zone,
    value jsonb DEFAULT '{}'::jsonb NOT NULL
);


--

-- Name: security_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_policies (
    tenant_id uuid NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    session_lifetime_minutes integer DEFAULT 43200 NOT NULL,
    max_failed_login_attempts integer DEFAULT 5 NOT NULL,
    lockout_minutes integer DEFAULT 15 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_policies_lockout_minutes_check CHECK (((lockout_minutes >= 1) AND (lockout_minutes <= 1440))),
    CONSTRAINT security_policies_max_failed_login_attempts_check CHECK (((max_failed_login_attempts >= 1) AND (max_failed_login_attempts <= 20))),
    CONSTRAINT security_policies_session_lifetime_minutes_check CHECK (((session_lifetime_minutes >= 5) AND (session_lifetime_minutes <= 43200)))
);

ALTER TABLE ONLY public.security_policies FORCE ROW LEVEL SECURITY;


--

-- Name: stored_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stored_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    owner_user_id uuid,
    storage_key character varying(1024) NOT NULL,
    original_name character varying(512) NOT NULL,
    content_type character varying(255) NOT NULL,
    size_bytes bigint NOT NULL,
    checksum_sha256 character varying(64),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT check_stored_files_size CHECK ((size_bytes >= 0))
);

ALTER TABLE ONLY public.stored_files FORCE ROW LEVEL SECURITY;


--

-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price_monthly numeric(12,2) DEFAULT 0 NOT NULL,
    max_users integer,
    max_storage_gb integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


--

-- Name: tenant_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identity_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    status public.membership_status_enum DEFAULT 'active'::public.membership_status_enum NOT NULL,
    security_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    activated_at timestamp with time zone,
    suspended_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by_identity_id uuid,
    CONSTRAINT tenant_memberships_security_version_check CHECK ((security_version > 0))
);


--

-- Name: tenant_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    module_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled_by uuid,
    enabled_reason text,
    disabled_at timestamp with time zone,
    disabled_by uuid,
    CONSTRAINT check_tenant_module_lifecycle CHECK ((((enabled = true) AND (disabled_at IS NULL)) OR ((enabled = false) AND (disabled_at IS NOT NULL))))
);

ALTER TABLE ONLY public.tenant_modules FORCE ROW LEVEL SECURITY;


--

-- Name: tenant_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subscription_plan_id uuid NOT NULL,
    status public.subscription_status_enum DEFAULT 'active'::public.subscription_status_enum NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_sub_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL)))),
    CONSTRAINT check_subscription_dates CHECK ((starts_at < expires_at))
);

ALTER TABLE ONLY public.tenant_subscriptions FORCE ROW LEVEL SECURITY;


--

-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    display_name character varying(255),
    subdomain character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    timezone character varying(100) DEFAULT 'UTC'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    locale character varying(20) DEFAULT 'en_US'::character varying NOT NULL,
    status public.tenant_status_enum DEFAULT 'trial'::public.tenant_status_enum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_tenant_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);


--

-- Name: user_branch_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_branch_access (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    branch_id uuid NOT NULL
);

ALTER TABLE ONLY public.user_branch_access FORCE ROW LEVEL SECURITY;


--

-- Name: user_location_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_location_access (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    location_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);

ALTER TABLE ONLY public.user_location_access FORCE ROW LEVEL SECURITY;


--

-- Name: user_organization_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organization_access (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL
);

ALTER TABLE ONLY public.user_organization_access FORCE ROW LEVEL SECURITY;


--

-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    allow boolean DEFAULT true NOT NULL
);

ALTER TABLE ONLY public.user_permissions FORCE ROW LEVEL SECURITY;


--

-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);

ALTER TABLE ONLY public.user_roles FORCE ROW LEVEL SECURITY;


--

-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid,
    branch_id uuid,
    access_token_id character varying(255),
    refresh_token_hash character varying(255) NOT NULL,
    device character varying(255),
    user_agent text,
    ip_address character varying(45),
    location character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    termination_reason character varying(100),
    login_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    logout_at timestamp with time zone,
    updated_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    location_id uuid,
    financial_year_id uuid,
    identity_id uuid NOT NULL,
    context_type public.session_context_enum DEFAULT 'tenant'::public.session_context_enum NOT NULL,
    tenant_membership_id uuid,
    platform_membership_id uuid,
    security_version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_session_activity CHECK ((last_activity_at >= login_at)),
    CONSTRAINT check_session_expiry CHECK ((expires_at > login_at)),
    CONSTRAINT check_session_logout CHECK (((logout_at IS NULL) OR (logout_at >= login_at))),
    CONSTRAINT check_session_revocation_coherence CHECK ((((revoked_at IS NULL) AND (termination_reason IS NULL)) OR (revoked_at IS NOT NULL))),
    CONSTRAINT user_sessions_context_shape_check CHECK ((((context_type = 'tenant'::public.session_context_enum) AND (tenant_id IS NOT NULL) AND (tenant_membership_id IS NOT NULL) AND (platform_membership_id IS NULL) AND (user_id IS NOT NULL)) OR ((context_type = 'platform'::public.session_context_enum) AND (tenant_id IS NULL) AND (tenant_membership_id IS NULL) AND (platform_membership_id IS NOT NULL) AND (user_id IS NULL))))
);

ALTER TABLE ONLY public.user_sessions FORCE ROW LEVEL SECURITY;


--

-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid,
    default_branch_id uuid,
    username character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status public.user_status_enum DEFAULT 'active'::public.user_status_enum NOT NULL,
    email_verified_at timestamp with time zone,
    password_reset_token_hash character varying(255),
    password_reset_expires_at timestamp with time zone,
    failed_login_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    mfa_enabled boolean DEFAULT false NOT NULL,
    encrypted_mfa_secret text,
    password_changed_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    default_location_id uuid,
    identity_id uuid NOT NULL,
    CONSTRAINT check_user_reset_expiry CHECK (((password_reset_expires_at IS NULL) OR (password_reset_token_hash IS NOT NULL))),
    CONSTRAINT check_user_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.users FORCE ROW LEVEL SECURITY;


--

-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--

-- Name: auth_login_identifiers auth_login_identifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_identifiers
    ADD CONSTRAINT auth_login_identifiers_pkey PRIMARY KEY (id);


--

-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--

-- Name: code_counters code_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_counters
    ADD CONSTRAINT code_counters_pkey PRIMARY KEY (tenant_id, entity_type, scope_key);


--

-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--

-- Name: financial_years financial_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_pkey PRIMARY KEY (id);


--

-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--

-- Name: identity_credentials identity_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_credentials
    ADD CONSTRAINT identity_credentials_pkey PRIMARY KEY (id);


--

-- Name: identity_credentials identity_credentials_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_credentials
    ADD CONSTRAINT identity_credentials_provider_key UNIQUE (identity_id, provider, credential_type);


--

-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--

-- Name: mfa_enrollments mfa_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_enrollments
    ADD CONSTRAINT mfa_enrollments_pkey PRIMARY KEY (tenant_id, user_id);


--

-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--

-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--

-- Name: notification_delivery_attempts notification_delivery_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_delivery_attempts
    ADD CONSTRAINT notification_delivery_attempts_pkey PRIMARY KEY (id);


--

-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--

-- Name: organization_modules organization_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_modules
    ADD CONSTRAINT organization_modules_pkey PRIMARY KEY (id);


--

-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--

-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--

-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--

-- Name: permissions permissions_permission_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_key_unique UNIQUE (permission_key);


--

-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--

-- Name: platform_membership_roles platform_membership_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_membership_roles
    ADD CONSTRAINT platform_membership_roles_pkey PRIMARY KEY (platform_membership_id, platform_role_id);


--

-- Name: platform_memberships platform_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_memberships
    ADD CONSTRAINT platform_memberships_pkey PRIMARY KEY (id);


--

-- Name: platform_permissions platform_permissions_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_permissions
    ADD CONSTRAINT platform_permissions_permission_key_key UNIQUE (permission_key);


--

-- Name: platform_permissions platform_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_permissions
    ADD CONSTRAINT platform_permissions_pkey PRIMARY KEY (id);


--

-- Name: platform_role_permissions platform_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT platform_role_permissions_pkey PRIMARY KEY (platform_role_id, platform_permission_id);


--

-- Name: platform_roles platform_roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_code_key UNIQUE (code);


--

-- Name: platform_roles platform_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_pkey PRIMARY KEY (id);


--

-- Name: platform_security_policy platform_security_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_security_policy
    ADD CONSTRAINT platform_security_policy_pkey PRIMARY KEY (id);


--

-- Name: refresh_token_history refresh_token_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token_history
    ADD CONSTRAINT refresh_token_history_pkey PRIMARY KEY (id);


--

-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id, tenant_id);


--

-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--

-- Name: scheduled_jobs scheduled_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (id);


--

-- Name: security_bootstrap_state security_bootstrap_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_bootstrap_state
    ADD CONSTRAINT security_bootstrap_state_pkey PRIMARY KEY (key);


--

-- Name: security_policies security_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_policies
    ADD CONSTRAINT security_policies_pkey PRIMARY KEY (tenant_id);


--

-- Name: stored_files stored_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_files
    ADD CONSTRAINT stored_files_pkey PRIMARY KEY (id);


--

-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--

-- Name: tenant_memberships tenant_memberships_identity_tenant_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_identity_tenant_unique UNIQUE (identity_id, tenant_id);


--

-- Name: tenant_memberships tenant_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_pkey PRIMARY KEY (id);


--

-- Name: tenant_modules tenant_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_modules
    ADD CONSTRAINT tenant_modules_pkey PRIMARY KEY (id);


--

-- Name: tenant_subscriptions tenant_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);


--

-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--

-- Name: organization_modules uq_organization_module; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_modules
    ADD CONSTRAINT uq_organization_module UNIQUE (organization_id, module_id);


--

-- Name: user_branch_access user_branch_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_pkey PRIMARY KEY (user_id, branch_id, tenant_id);


--

-- Name: user_location_access user_location_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_access
    ADD CONSTRAINT user_location_access_pkey PRIMARY KEY (user_id, location_id, tenant_id);


--

-- Name: user_organization_access user_organization_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organization_access
    ADD CONSTRAINT user_organization_access_pkey PRIMARY KEY (user_id, organization_id, tenant_id);


--

-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id, tenant_id);


--

-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id, tenant_id);


--

-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--

-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--

-- Name: idx_audit_events_platform_context_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_platform_context_created_at ON public.audit_events USING btree (context_type, actor_platform_membership_id, created_at DESC);


--

-- Name: idx_audit_events_tenant_actor_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_tenant_actor_created_at ON public.audit_events USING btree (tenant_id, actor_user_id, created_at DESC);


--

-- Name: idx_audit_events_tenant_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_tenant_correlation ON public.audit_events USING btree (tenant_id, correlation_id) WHERE (correlation_id IS NOT NULL);


--

-- Name: idx_audit_events_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_tenant_created_at ON public.audit_events USING btree (tenant_id, created_at DESC);


--

-- Name: idx_audit_events_tenant_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_tenant_resource ON public.audit_events USING btree (tenant_id, resource_type, resource_id, created_at DESC);


--

-- Name: idx_auth_login_identifiers_identity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_login_identifiers_identity_type ON public.auth_login_identifiers USING btree (identity_id, identifier_type);


--

-- Name: idx_auth_login_identifiers_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_login_identifiers_lookup ON public.auth_login_identifiers USING btree (identifier_type, identifier) WHERE (is_active = true);


--

-- Name: idx_code_counters_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_code_counters_tenant_entity ON public.code_counters USING btree (tenant_id, entity_type);


--

-- Name: idx_email_verification_tokens_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_verification_tokens_user_active ON public.email_verification_tokens USING btree (tenant_id, user_id, expires_at) WHERE (consumed_at IS NULL);


--

-- Name: idx_identities_security_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identities_security_version ON public.identities USING btree (security_version);


--

-- Name: idx_identities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identities_status ON public.identities USING btree (status);


--

-- Name: idx_identity_credentials_identity_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_identity_credentials_identity_status ON public.identity_credentials USING btree (identity_id, status);


--

-- Name: idx_mfa_recovery_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfa_recovery_codes_active ON public.mfa_recovery_codes USING btree (tenant_id, user_id) WHERE (consumed_at IS NULL);


--

-- Name: idx_notifications_claimable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_claimable ON public.notifications USING btree (tenant_id, available_at, created_at) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying])::text[]));


--

-- Name: idx_notifications_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_due ON public.notifications USING btree (tenant_id, status, available_at);


--

-- Name: idx_organization_modules_tenant_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_modules_tenant_module ON public.organization_modules USING btree (tenant_id, module_id);


--

-- Name: idx_organization_modules_tenant_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_modules_tenant_org ON public.organization_modules USING btree (tenant_id, organization_id);


--

-- Name: idx_outbox_events_claimable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_claimable ON public.outbox_events USING btree (tenant_id, available_at, occurred_at) WHERE (published_at IS NULL);


--

-- Name: idx_outbox_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_events_pending ON public.outbox_events USING btree (tenant_id, available_at, occurred_at) WHERE (published_at IS NULL);


--

-- Name: idx_password_reset_tokens_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user_active ON public.password_reset_tokens USING btree (tenant_id, user_id, expires_at) WHERE (consumed_at IS NULL);


--

-- Name: idx_platform_memberships_identity_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_memberships_identity_status ON public.platform_memberships USING btree (identity_id, status);


--

-- Name: idx_refresh_token_history_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_token_history_session ON public.refresh_token_history USING btree (tenant_id, session_id, consumed_at DESC);


--

-- Name: idx_role_permissions_tenant_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_tenant_role ON public.role_permissions USING btree (tenant_id, role_id);


--

-- Name: idx_scheduled_jobs_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_jobs_due ON public.scheduled_jobs USING btree (tenant_id, status, next_run_at);


--

-- Name: idx_stored_files_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stored_files_active ON public.stored_files USING btree (tenant_id, created_at DESC) WHERE (deleted_at IS NULL);


--

-- Name: idx_tenant_memberships_identity_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_memberships_identity_status ON public.tenant_memberships USING btree (identity_id, status);


--

-- Name: idx_tenant_memberships_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_memberships_tenant_status ON public.tenant_memberships USING btree (tenant_id, status);


--

-- Name: idx_user_branch_access_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_branch_access_tenant_user ON public.user_branch_access USING btree (tenant_id, user_id);


--

-- Name: idx_user_location_access_tenant_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_access_tenant_org ON public.user_location_access USING btree (tenant_id, organization_id);


--

-- Name: idx_user_location_access_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_location_access_tenant_user ON public.user_location_access USING btree (tenant_id, user_id);


--

-- Name: idx_user_organization_access_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_organization_access_tenant_user ON public.user_organization_access USING btree (tenant_id, user_id);


--

-- Name: idx_user_permissions_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_tenant_user ON public.user_permissions USING btree (tenant_id, user_id);


--

-- Name: idx_user_roles_tenant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_tenant_user ON public.user_roles USING btree (tenant_id, user_id);


--

-- Name: idx_user_sessions_identity_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_identity_active ON public.user_sessions USING btree (identity_id, is_active);


--

-- Name: idx_user_sessions_membership_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_membership_active ON public.user_sessions USING btree (tenant_membership_id, is_active);


--

-- Name: idx_user_sessions_platform_membership_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_platform_membership_active ON public.user_sessions USING btree (platform_membership_id, is_active);


--

-- Name: idx_user_sessions_tenant_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_tenant_location ON public.user_sessions USING btree (tenant_id, location_id);


--

-- Name: idx_users_default_location_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_default_location_tenant ON public.users USING btree (tenant_id, default_location_id);


--

-- Name: unique_tenant_module; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tenant_module ON public.tenant_modules USING btree (tenant_id, module_id);


--

-- Name: uq_active_financial_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_active_financial_year ON public.financial_years USING btree (tenant_id, organization_id) WHERE ((is_active = true) AND (is_deleted = false));


--

-- Name: uq_auth_login_identifiers_identity_owned; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_auth_login_identifiers_identity_owned ON public.auth_login_identifiers USING btree (identifier_type, identifier);


--

-- Name: uq_branch_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_branch_id_tenant ON public.branches USING btree (id, tenant_id);


--

-- Name: uq_default_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_default_branch ON public.branches USING btree (organization_id) WHERE ((is_default = true) AND (is_deleted = false));


--

-- Name: uq_default_location; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_default_location ON public.locations USING btree (organization_id) WHERE ((is_default = true) AND (is_deleted = false));


--

-- Name: uq_default_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_default_organization ON public.organizations USING btree (tenant_id) WHERE ((is_default = true) AND (is_deleted = false));


--

-- Name: uq_email_verification_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_email_verification_tokens_hash ON public.email_verification_tokens USING btree (tenant_id, token_hash);


--

-- Name: uq_fy_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_fy_id_tenant ON public.financial_years USING btree (id, tenant_id);


--

-- Name: uq_head_office; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_head_office ON public.branches USING btree (organization_id) WHERE ((is_head_office = true) AND (is_deleted = false));


--

-- Name: uq_location_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_location_id_tenant ON public.locations USING btree (id, tenant_id);


--

-- Name: uq_mfa_recovery_codes_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_mfa_recovery_codes_hash ON public.mfa_recovery_codes USING btree (tenant_id, user_id, code_hash);


--

-- Name: uq_modules_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_modules_code ON public.modules USING btree (code);


--

-- Name: uq_notification_attempt_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_notification_attempt_no ON public.notification_delivery_attempts USING btree (tenant_id, notification_id, attempt_no);


--

-- Name: uq_org_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_org_id_tenant ON public.organizations USING btree (id, tenant_id);


--

-- Name: uq_password_reset_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_password_reset_tokens_hash ON public.password_reset_tokens USING btree (tenant_id, token_hash);


--

-- Name: uq_platform_memberships_active_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_platform_memberships_active_identity ON public.platform_memberships USING btree (identity_id) WHERE (status = 'active'::public.membership_status_enum);


--

-- Name: uq_refresh_token_history_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_refresh_token_history_hash ON public.refresh_token_history USING btree (tenant_id, token_hash);


--

-- Name: uq_role_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_role_id_tenant ON public.roles USING btree (id, tenant_id);


--

-- Name: uq_stored_files_storage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stored_files_storage_key ON public.stored_files USING btree (tenant_id, storage_key);


--

-- Name: uq_subscription_plans_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subscription_plans_name ON public.subscription_plans USING btree (name);


--

-- Name: uq_tenant_branch_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_branch_code_active ON public.branches USING btree (tenant_id, code) WHERE (is_deleted = false);


--

-- Name: uq_tenant_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_email_active ON public.users USING btree (tenant_id, email) WHERE (is_deleted = false);


--

-- Name: uq_tenant_org_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_org_code_active ON public.organizations USING btree (tenant_id, code) WHERE (is_deleted = false);


--

-- Name: uq_tenant_org_location_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_org_location_code_active ON public.locations USING btree (tenant_id, organization_id, code) WHERE (is_deleted = false);


--

-- Name: uq_tenant_role_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_role_code_active ON public.roles USING btree (tenant_id, code) WHERE (is_deleted = false);


--

-- Name: uq_tenant_role_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_role_name_active ON public.roles USING btree (tenant_id, name) WHERE (is_deleted = false);


--

-- Name: uq_tenant_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_slug_active ON public.tenants USING btree (slug) WHERE (is_deleted = false);


--

-- Name: uq_tenant_subdomain_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_subdomain_active ON public.tenants USING btree (subdomain) WHERE (is_deleted = false);


--

-- Name: uq_tenant_username_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_username_active ON public.users USING btree (tenant_id, username) WHERE (is_deleted = false);


--

-- Name: uq_user_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_id_tenant ON public.users USING btree (id, tenant_id);


--

-- Name: uq_user_sessions_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_sessions_id_tenant ON public.user_sessions USING btree (id, tenant_id);


--

-- Name: uq_users_identity_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_identity_tenant ON public.users USING btree (identity_id, tenant_id);


--

-- Name: user_sessions trg_assign_session_context_compatibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_session_context_compatibility BEFORE INSERT ON public.user_sessions FOR EACH ROW EXECUTE FUNCTION public.assign_session_context_compatibility();


--

-- Name: users trg_assign_user_identity_compatibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_user_identity_compatibility BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.assign_user_identity_compatibility();


--

-- Name: organizations trg_initialize_core_organization_modules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_initialize_core_organization_modules AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.initialize_core_organization_modules();


--

-- Name: tenants trg_initialize_core_tenant_modules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_initialize_core_tenant_modules AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.initialize_core_tenant_modules();


--

-- Name: audit_events trg_prevent_audit_event_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_audit_event_delete BEFORE DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();


--

-- Name: audit_events trg_prevent_audit_event_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_audit_event_update BEFORE UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_event_mutation();


--

-- Name: users trg_sync_auth_login_identifiers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_auth_login_identifiers AFTER INSERT OR UPDATE OF username, email, status, is_deleted ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_auth_login_identifiers();


--

-- Name: audit_events audit_events_actor_platform_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_platform_membership_fk FOREIGN KEY (actor_platform_membership_id) REFERENCES public.platform_memberships(id) ON DELETE SET NULL;


--

-- Name: auth_login_identifiers auth_login_identifiers_identity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_identifiers
    ADD CONSTRAINT auth_login_identifiers_identity_fk FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE CASCADE;


--

-- Name: auth_login_identifiers auth_login_identifiers_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_identifiers
    ADD CONSTRAINT auth_login_identifiers_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: auth_login_identifiers auth_login_identifiers_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_identifiers
    ADD CONSTRAINT auth_login_identifiers_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--

-- Name: branches branches_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: financial_years financial_years_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: audit_events fk_audit_events_actor_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_events_actor_user FOREIGN KEY (actor_user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE SET NULL (actor_user_id);


--

-- Name: audit_events fk_audit_events_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT fk_audit_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--

-- Name: branches fk_branch_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT fk_branch_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: code_counters fk_code_counters_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.code_counters
    ADD CONSTRAINT fk_code_counters_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: email_verification_tokens fk_email_verification_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT fk_email_verification_tokens_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE;


--

-- Name: financial_years fk_fy_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT fk_fy_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: locations fk_location_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_location_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: mfa_enrollments fk_mfa_enrollments_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_enrollments
    ADD CONSTRAINT fk_mfa_enrollments_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE;


--

-- Name: mfa_recovery_codes fk_mfa_recovery_codes_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_recovery_codes
    ADD CONSTRAINT fk_mfa_recovery_codes_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE;


--

-- Name: modules fk_modules_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT fk_modules_parent FOREIGN KEY (parent_module_id) REFERENCES public.modules(id);


--

-- Name: notification_delivery_attempts fk_notification_attempt_notification; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_delivery_attempts
    ADD CONSTRAINT fk_notification_attempt_notification FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--

-- Name: notifications fk_notifications_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: organization_modules fk_organization_modules_module; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_modules
    ADD CONSTRAINT fk_organization_modules_module FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--

-- Name: organization_modules fk_organization_modules_organization; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_modules
    ADD CONSTRAINT fk_organization_modules_organization FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE CASCADE;


--

-- Name: organization_modules fk_organization_modules_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_modules
    ADD CONSTRAINT fk_organization_modules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: outbox_events fk_outbox_events_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT fk_outbox_events_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: password_reset_tokens fk_password_reset_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE;


--

-- Name: refresh_token_history fk_refresh_token_history_session; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token_history
    ADD CONSTRAINT fk_refresh_token_history_session FOREIGN KEY (session_id, tenant_id) REFERENCES public.user_sessions(id, tenant_id) ON DELETE CASCADE;


--

-- Name: refresh_token_history fk_refresh_token_history_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_token_history
    ADD CONSTRAINT fk_refresh_token_history_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON DELETE CASCADE;


--

-- Name: role_permissions fk_role_permissions_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id, tenant_id) REFERENCES public.roles(id, tenant_id);


--

-- Name: scheduled_jobs fk_scheduled_jobs_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT fk_scheduled_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_sessions fk_session_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_session_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: user_sessions fk_session_location_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_session_location_tenant FOREIGN KEY (location_id, tenant_id) REFERENCES public.locations(id, tenant_id);


--

-- Name: user_sessions fk_session_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_session_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: user_sessions fk_session_user_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_session_user_tenant FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: stored_files fk_stored_files_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stored_files
    ADD CONSTRAINT fk_stored_files_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_branch_access fk_ub_access_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT fk_ub_access_branch FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: user_branch_access fk_ub_access_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT fk_ub_access_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: user_location_access fk_ula_access_location; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_access
    ADD CONSTRAINT fk_ula_access_location FOREIGN KEY (location_id, tenant_id) REFERENCES public.locations(id, tenant_id);


--

-- Name: user_location_access fk_ula_access_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_access
    ADD CONSTRAINT fk_ula_access_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: user_location_access fk_ula_access_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_access
    ADD CONSTRAINT fk_ula_access_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: user_organization_access fk_uo_access_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organization_access
    ADD CONSTRAINT fk_uo_access_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: user_organization_access fk_uo_access_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organization_access
    ADD CONSTRAINT fk_uo_access_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: users fk_user_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_branch_tenant FOREIGN KEY (default_branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: users fk_user_location_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_location_tenant FOREIGN KEY (default_location_id, tenant_id) REFERENCES public.locations(id, tenant_id) ON DELETE SET NULL;


--

-- Name: users fk_user_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: user_permissions fk_user_perms_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT fk_user_perms_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: user_roles fk_user_roles_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id, tenant_id) REFERENCES public.roles(id, tenant_id);


--

-- Name: user_roles fk_user_roles_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id);


--

-- Name: user_sessions fk_user_sessions_financial_year_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_user_sessions_financial_year_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--

-- Name: identity_credentials identity_credentials_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identity_credentials
    ADD CONSTRAINT identity_credentials_identity_id_fkey FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE CASCADE;


--

-- Name: locations locations_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: organizations organizations_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: platform_membership_roles platform_membership_roles_platform_membership_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_membership_roles
    ADD CONSTRAINT platform_membership_roles_platform_membership_id_fkey FOREIGN KEY (platform_membership_id) REFERENCES public.platform_memberships(id) ON DELETE CASCADE;


--

-- Name: platform_membership_roles platform_membership_roles_platform_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_membership_roles
    ADD CONSTRAINT platform_membership_roles_platform_role_id_fkey FOREIGN KEY (platform_role_id) REFERENCES public.platform_roles(id) ON DELETE RESTRICT;


--

-- Name: platform_memberships platform_memberships_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_memberships
    ADD CONSTRAINT platform_memberships_identity_id_fkey FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE CASCADE;


--

-- Name: platform_memberships platform_memberships_revoked_by_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_memberships
    ADD CONSTRAINT platform_memberships_revoked_by_identity_id_fkey FOREIGN KEY (revoked_by_identity_id) REFERENCES public.identities(id) ON DELETE SET NULL;


--

-- Name: platform_role_permissions platform_role_permissions_platform_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT platform_role_permissions_platform_permission_id_fkey FOREIGN KEY (platform_permission_id) REFERENCES public.platform_permissions(id) ON DELETE CASCADE;


--

-- Name: platform_role_permissions platform_role_permissions_platform_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT platform_role_permissions_platform_role_id_fkey FOREIGN KEY (platform_role_id) REFERENCES public.platform_roles(id) ON DELETE CASCADE;


--

-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--

-- Name: role_permissions role_permissions_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: roles roles_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: security_policies security_policies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_policies
    ADD CONSTRAINT security_policies_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: tenant_memberships tenant_memberships_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_identity_id_fkey FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE CASCADE;


--

-- Name: tenant_memberships tenant_memberships_revoked_by_identity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_revoked_by_identity_id_fkey FOREIGN KEY (revoked_by_identity_id) REFERENCES public.identities(id) ON DELETE SET NULL;


--

-- Name: tenant_memberships tenant_memberships_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_memberships
    ADD CONSTRAINT tenant_memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: tenant_modules tenant_modules_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_modules
    ADD CONSTRAINT tenant_modules_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: tenant_subscriptions tenant_subscriptions_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_branch_access user_branch_access_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_branch_access
    ADD CONSTRAINT user_branch_access_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_location_access user_location_access_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_location_access
    ADD CONSTRAINT user_location_access_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_organization_access user_organization_access_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organization_access
    ADD CONSTRAINT user_organization_access_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_permissions user_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--

-- Name: user_permissions user_permissions_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_roles user_roles_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_sessions user_sessions_identity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_identity_fk FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE RESTRICT;


--

-- Name: user_sessions user_sessions_platform_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_platform_membership_fk FOREIGN KEY (platform_membership_id) REFERENCES public.platform_memberships(id) ON DELETE RESTRICT;


--

-- Name: user_sessions user_sessions_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: user_sessions user_sessions_tenant_membership_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_tenant_membership_fk FOREIGN KEY (tenant_membership_id) REFERENCES public.tenant_memberships(id) ON DELETE RESTRICT;


--

-- Name: users users_identity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_identity_fk FOREIGN KEY (identity_id) REFERENCES public.identities(id) ON DELETE RESTRICT;


--

-- Name: users users_tenant_id_tenants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--

-- Name: audit_events audit_events_context_visibility_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_context_visibility_policy ON public.audit_events USING ((((context_type = 'tenant'::public.session_context_enum) AND (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) OR ((context_type = 'platform'::public.session_context_enum) AND (current_setting('app.platform_audit_enabled'::text, true) = 'true'::text)))) WITH CHECK ((((context_type = 'tenant'::public.session_context_enum) AND (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) OR ((context_type = 'platform'::public.session_context_enum) AND (current_setting('app.platform_audit_enabled'::text, true) = 'true'::text))));


--

-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--

-- Name: code_counters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.code_counters ENABLE ROW LEVEL SECURITY;

--

-- Name: code_counters code_counters_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY code_counters_tenant_isolation_policy ON public.code_counters USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: email_verification_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

--

-- Name: email_verification_tokens email_verification_tokens_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_verification_tokens_tenant_isolation_policy ON public.email_verification_tokens USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: financial_years; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

--

-- Name: locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

--

-- Name: locations locations_tenant_and_org_access_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locations_tenant_and_org_access_policy ON public.locations USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)) AND (is_deleted = false) AND ((current_setting('app.current_user_id'::text, true) IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_location_access ula
  WHERE ((ula.tenant_id = locations.tenant_id) AND (ula.organization_id = locations.organization_id) AND (ula.location_id = locations.id) AND (ula.user_id = (current_setting('app.current_user_id'::text, true))::uuid) AND (ula.is_active = true))))))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)) AND (is_deleted = false)));


--

-- Name: mfa_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mfa_enrollments ENABLE ROW LEVEL SECURITY;

--

-- Name: mfa_enrollments mfa_enrollments_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mfa_enrollments_tenant_isolation_policy ON public.mfa_enrollments USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: mfa_recovery_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

--

-- Name: mfa_recovery_codes mfa_recovery_codes_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mfa_recovery_codes_tenant_isolation_policy ON public.mfa_recovery_codes USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: notification_delivery_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;

--

-- Name: notification_delivery_attempts notification_delivery_attempts_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_delivery_attempts_tenant_isolation_policy ON public.notification_delivery_attempts USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--

-- Name: notifications notifications_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_tenant_isolation_policy ON public.notifications USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: organization_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

--

-- Name: organization_modules organization_modules_tenant_org_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_modules_tenant_org_isolation_policy ON public.organization_modules USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((NULLIF(current_setting('app.current_tenant_id_organization_id'::text, true), ''::text) IS NULL) OR (organization_id = (NULLIF(current_setting('app.current_tenant_id_organization_id'::text, true), ''::text))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((NULLIF(current_setting('app.current_tenant_id_organization_id'::text, true), ''::text) IS NULL) OR (organization_id = (NULLIF(current_setting('app.current_tenant_id_organization_id'::text, true), ''::text))::uuid))));


--

-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--

-- Name: outbox_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

--

-- Name: outbox_events outbox_events_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_events_tenant_isolation_policy ON public.outbox_events USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--

-- Name: password_reset_tokens password_reset_tokens_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_reset_tokens_tenant_isolation_policy ON public.password_reset_tokens USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: refresh_token_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refresh_token_history ENABLE ROW LEVEL SECURITY;

--

-- Name: refresh_token_history refresh_token_history_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY refresh_token_history_tenant_isolation_policy ON public.refresh_token_history USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--

-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--

-- Name: scheduled_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

--

-- Name: scheduled_jobs scheduled_jobs_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scheduled_jobs_tenant_isolation_policy ON public.scheduled_jobs USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: security_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;

--

-- Name: security_policies security_policies_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_policies_tenant_isolation_policy ON public.security_policies USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: stored_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stored_files ENABLE ROW LEVEL SECURITY;

--

-- Name: stored_files stored_files_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stored_files_tenant_isolation_policy ON public.stored_files USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: branches tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.branches USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: financial_years tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.financial_years USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: locations tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.locations USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: organizations tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.organizations USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: role_permissions tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.role_permissions USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: roles tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.roles USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: tenant_modules tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.tenant_modules USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: tenant_subscriptions tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.tenant_subscriptions USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_branch_access tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.user_branch_access USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_organization_access tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.user_organization_access USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_permissions tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.user_permissions USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_roles tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.user_roles USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_sessions tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.user_sessions USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: users tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_policy ON public.users USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: tenant_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

--

-- Name: tenant_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

--

-- Name: user_branch_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

--

-- Name: user_location_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;

--

-- Name: user_location_access user_location_access_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_location_access_tenant_isolation_policy ON public.user_location_access USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: user_organization_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_organization_access ENABLE ROW LEVEL SECURITY;

--

-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--

-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--

-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--

-- Name: user_sessions user_sessions_active_location_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_active_location_policy ON public.user_sessions USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((organization_id IS NULL) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)) AND ((location_id IS NULL) OR (location_id = (current_setting('app.current_location_id'::text, true))::uuid)) AND ((location_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_location_access ula
  WHERE ((ula.tenant_id = user_sessions.tenant_id) AND (ula.user_id = user_sessions.user_id) AND (ula.location_id = user_sessions.location_id) AND (ula.is_active = true))))))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((organization_id IS NULL) OR (organization_id = (current_setting('app.current_organization_id'::text, true))::uuid)) AND ((location_id IS NULL) OR (location_id = (current_setting('app.current_location_id'::text, true))::uuid)) AND ((location_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_location_access ula
  WHERE ((ula.tenant_id = user_sessions.tenant_id) AND (ula.user_id = user_sessions.user_id) AND (ula.location_id = user_sessions.location_id) AND (ula.is_active = true)))))));


--

-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

-- Required singleton platform policy defaults from the final migration state.
INSERT INTO public.platform_security_policy (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.platform_security_policy FROM PUBLIC;
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.user_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.auth_login_identifiers ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.auth_login_identifiers ALTER COLUMN user_id DROP NOT NULL;
REVOKE ALL ON FUNCTION public.sync_auth_login_identifiers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_user_identity_compatibility() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_session_context_compatibility() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_update_tenant_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_delete_tenant(uuid) FROM PUBLIC;
