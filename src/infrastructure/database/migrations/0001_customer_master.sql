-- Canonical development baseline: Customer Master.
--
-- This migration is intentionally a complete Customer-domain baseline. It replaces
-- the former 0001/0011/0012/0013 development chain after a zero-state reset.

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

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    short_name character varying(100),
    customer_type character varying(50),
    customer_category character varying(50),
    zone character varying(100),
    domestic_export character varying(20),
    in_use boolean,
    merchant_exporter boolean,
    insurance boolean,
    nda boolean,
    start_date date,
    expiry_date date,
    address text,
    address_1 text,
    city character varying(100),
    pincode character varying(20),
    country character varying(100),
    state character varying(100),
    district character varying(100),
    pan_no character varying(50),
    gst_no character varying(50),
    vat_no character varying(50),
    cst_no character varying(50),
    service_tax_no character varying(50),
    ecc_code character varying(50),
    fax character varying(50),
    phone character varying(50),
    mobile character varying(50),
    email public.citext,
    contact_person character varying(255),
    designation character varying(255),
    website character varying(255),
    interest_percent numeric(12,2),
    outstanding_limit numeric(18,2),
    aging_limit numeric(18,2),
    cash_discount_percent numeric(12,2),
    supplier_code character varying(50),
    industry_type character varying(100),
    discount_applicable boolean,
    bank_name character varying(255),
    bank_address text,
    bank_address_1 text,
    bank_account_no character varying(100),
    range character varying(100),
    commissionerate character varying(100),
    division character varying(100),
    reference_customer character varying(255),
    document_through character varying(255),
    dealer_name character varying(255),
    dealer_address text,
    dealer_address_1 text,
    weekly_off character varying(50),
    group_customer character varying(255),
    distance_in_km numeric(12,2),
    marketing_by character varying(255),
    salesman_name character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_customer_soft_delete CHECK (
        ((is_deleted = false) AND (deleted_at IS NULL))
        OR ((is_deleted = true) AND (deleted_at IS NOT NULL))
    ),
    CONSTRAINT check_customer_code_length CHECK (code IS NULL OR length(code) <= 50),
    CONSTRAINT check_customer_name_length CHECK (length(name) <= 255),
    CONSTRAINT check_customer_version_positive CHECK (version >= 1),
    CONSTRAINT check_customer_dates CHECK (
        start_date IS NULL OR expiry_date IS NULL OR start_date <= expiry_date
    ),
    CONSTRAINT customers_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_tenant_org_name
    ON public.customers USING btree (tenant_id, name, id)
    WHERE (is_deleted = false);

CREATE UNIQUE INDEX uq_customer_id_tenant
    ON public.customers USING btree (id, tenant_id);

CREATE UNIQUE INDEX uq_customer_code_tenant
    ON public.customers USING btree (tenant_id, code)
    WHERE (code IS NOT NULL AND is_deleted = false);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_tenant_isolation_policy
    ON public.customers
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TABLE public.customer_contacts (
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
    CONSTRAINT customer_contacts_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customer_contacts_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_contacts_customer_tenant FOREIGN KEY (customer_id, tenant_id)
        REFERENCES public.customers(id, tenant_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_customer_contact_customer_sort
    ON public.customer_contacts USING btree (customer_id, sort_order);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_contacts_tenant_isolation_policy
    ON public.customer_contacts
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TABLE public.customer_offices (
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
    CONSTRAINT customer_offices_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customer_offices_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_offices_customer_tenant FOREIGN KEY (customer_id, tenant_id)
        REFERENCES public.customers(id, tenant_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_customer_office_customer
    ON public.customer_offices USING btree (customer_id);

ALTER TABLE public.customer_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_offices FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_offices_tenant_isolation_policy
    ON public.customer_offices
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TABLE public.customer_tax_payment_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    tax_category character varying(100),
    payment_terms character varying(255),
    credit_days integer,
    tax_registration_type character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customer_tax_payment_terms_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customer_tax_payment_terms_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_tax_payment_terms_customer_tenant FOREIGN KEY (customer_id, tenant_id)
        REFERENCES public.customers(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_customer_tax_payment_terms_customer UNIQUE (customer_id),
    CONSTRAINT check_customer_tax_payment_terms_credit_days CHECK (
        credit_days IS NULL OR credit_days >= 0
    )
);

ALTER TABLE public.customer_tax_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tax_payment_terms FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_tax_payment_terms_tenant_isolation_policy
    ON public.customer_tax_payment_terms
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE TABLE public.customer_other_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    notes text,
    reference character varying(255),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customer_other_details_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customer_other_details_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_other_details_customer_tenant FOREIGN KEY (customer_id, tenant_id)
        REFERENCES public.customers(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_customer_other_details_customer UNIQUE (customer_id)
);

ALTER TABLE public.customer_other_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_other_details FORCE ROW LEVEL SECURITY;

CREATE POLICY customer_other_details_tenant_isolation_policy
    ON public.customer_other_details
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
