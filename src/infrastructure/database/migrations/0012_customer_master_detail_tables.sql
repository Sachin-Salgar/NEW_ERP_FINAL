SET search_path = '';

CREATE TABLE IF NOT EXISTS public.customer_tax_payment_terms (
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
    CONSTRAINT fk_customer_tax_payment_terms_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_tax_payment_terms_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_customer_tax_payment_terms_customer UNIQUE (customer_id),
    CONSTRAINT check_customer_tax_payment_terms_credit_days CHECK (credit_days IS NULL OR credit_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.customer_other_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    notes text,
    reference character varying(255),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT customer_other_details_pkey PRIMARY KEY (id),
    CONSTRAINT fk_customer_other_details_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_other_details_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_customer_other_details_customer UNIQUE (customer_id)
);

ALTER TABLE public.customer_tax_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tax_payment_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_other_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_other_details FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_tax_payment_terms_tenant_isolation_policy ON public.customer_tax_payment_terms;
CREATE POLICY customer_tax_payment_terms_tenant_isolation_policy
  ON public.customer_tax_payment_terms
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS customer_other_details_tenant_isolation_policy ON public.customer_other_details;
CREATE POLICY customer_other_details_tenant_isolation_policy
  ON public.customer_other_details
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
