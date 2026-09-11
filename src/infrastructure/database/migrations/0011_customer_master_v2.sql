-- Active development baseline: CUSTOMER MASTER V2.
--
-- Extends the root customer master with the detailed ERP customer fields and child
-- records that are needed for customer master administration while preserving the
-- tenant-scoped RLS boundary and soft-delete conventions already used by the module.

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

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS code character varying(50),
  ADD COLUMN IF NOT EXISTS short_name character varying(100),
  ADD COLUMN IF NOT EXISTS customer_type character varying(50),
  ADD COLUMN IF NOT EXISTS customer_category character varying(50),
  ADD COLUMN IF NOT EXISTS zone character varying(100),
  ADD COLUMN IF NOT EXISTS domestic_export character varying(20),
  ADD COLUMN IF NOT EXISTS in_use boolean,
  ADD COLUMN IF NOT EXISTS merchant_exporter boolean,
  ADD COLUMN IF NOT EXISTS insurance boolean,
  ADD COLUMN IF NOT EXISTS nda boolean,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_1 text,
  ADD COLUMN IF NOT EXISTS city character varying(100),
  ADD COLUMN IF NOT EXISTS pincode character varying(20),
  ADD COLUMN IF NOT EXISTS country character varying(100),
  ADD COLUMN IF NOT EXISTS state character varying(100),
  ADD COLUMN IF NOT EXISTS district character varying(100),
  ADD COLUMN IF NOT EXISTS pan_no character varying(50),
  ADD COLUMN IF NOT EXISTS gst_no character varying(50),
  ADD COLUMN IF NOT EXISTS vat_no character varying(50),
  ADD COLUMN IF NOT EXISTS cst_no character varying(50),
  ADD COLUMN IF NOT EXISTS service_tax_no character varying(50),
  ADD COLUMN IF NOT EXISTS ecc_code character varying(50),
  ADD COLUMN IF NOT EXISTS fax character varying(50),
  ADD COLUMN IF NOT EXISTS phone character varying(50),
  ADD COLUMN IF NOT EXISTS mobile character varying(50),
  ADD COLUMN IF NOT EXISTS email public.citext,
  ADD COLUMN IF NOT EXISTS contact_person character varying(255),
  ADD COLUMN IF NOT EXISTS designation character varying(255),
  ADD COLUMN IF NOT EXISTS website character varying(255),
  ADD COLUMN IF NOT EXISTS interest_percent numeric(12,2),
  ADD COLUMN IF NOT EXISTS outstanding_limit numeric(18,2),
  ADD COLUMN IF NOT EXISTS aging_limit numeric(18,2),
  ADD COLUMN IF NOT EXISTS cash_discount_percent numeric(12,2),
  ADD COLUMN IF NOT EXISTS supplier_code character varying(50),
  ADD COLUMN IF NOT EXISTS industry_type character varying(100),
  ADD COLUMN IF NOT EXISTS discount_applicable boolean,
  ADD COLUMN IF NOT EXISTS bank_name character varying(255),
  ADD COLUMN IF NOT EXISTS bank_address text,
  ADD COLUMN IF NOT EXISTS bank_address_1 text,
  ADD COLUMN IF NOT EXISTS bank_account_no character varying(100),
  ADD COLUMN IF NOT EXISTS range character varying(100),
  ADD COLUMN IF NOT EXISTS commissionerate character varying(100),
  ADD COLUMN IF NOT EXISTS division character varying(100),
  ADD COLUMN IF NOT EXISTS reference_customer character varying(255),
  ADD COLUMN IF NOT EXISTS document_through character varying(255),
  ADD COLUMN IF NOT EXISTS dealer_name character varying(255),
  ADD COLUMN IF NOT EXISTS dealer_address text,
  ADD COLUMN IF NOT EXISTS dealer_address_1 text,
  ADD COLUMN IF NOT EXISTS weekly_off character varying(50),
  ADD COLUMN IF NOT EXISTS group_customer character varying(255),
  ADD COLUMN IF NOT EXISTS distance_in_km numeric(12,2),
  ADD COLUMN IF NOT EXISTS marketing_by character varying(255),
  ADD COLUMN IF NOT EXISTS salesman_name character varying(255);

ALTER TABLE ONLY public.customers
  ADD CONSTRAINT check_customer_code_length CHECK ((code IS NULL) OR (length(code) <= 50)),
  ADD CONSTRAINT check_customer_name_length CHECK (length(name) <= 255),
  ADD CONSTRAINT check_customer_version_positive CHECK (version >= 1),
  ADD CONSTRAINT check_customer_dates CHECK (
    (start_date IS NULL OR expiry_date IS NULL OR start_date <= expiry_date)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_code_tenant
  ON public.customers USING btree (tenant_id, code)
  WHERE (code IS NOT NULL AND is_deleted = false);

CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    contact_person character varying(255),
    designation character varying(255),
    mobile character varying(50),
    email public.citext,
    sort_order integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customer_contacts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.customer_offices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255),
    address text,
    address_1 text,
    city character varying(100),
    pincode character varying(20),
    state character varying(100),
    fax_no character varying(50),
    phone character varying(50),
    email public.citext,
    mobile character varying(50),
    contact character varying(255),
    designation character varying(255),
    website character varying(255),
    weekly_off character varying(50),
    pan_no character varying(50),
    gst_no character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customer_offices_pkey PRIMARY KEY (id)
);

ALTER TABLE ONLY public.customer_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.customer_offices FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT fk_customer_contacts_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_customer_contacts_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.customer_offices
    ADD CONSTRAINT fk_customer_offices_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_customer_offices_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_contact_customer_sort
  ON public.customer_contacts USING btree (customer_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_office_customer
  ON public.customer_offices USING btree (customer_id);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_contacts_tenant_isolation_policy
  ON public.customer_contacts
  USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid))
  WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));

CREATE POLICY customer_offices_tenant_isolation_policy
  ON public.customer_offices
  USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid))
  WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));

ALTER TABLE public.customers
  ALTER COLUMN code SET DEFAULT NULL;
