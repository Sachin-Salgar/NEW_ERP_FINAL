-- Active development baseline: SALES domain.
--
-- Core creates shared extensions and search-path prerequisites.

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

-- Sales enum types are defined before tables that use them.
-- Name: sales_credit_note_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_credit_note_status_enum AS ENUM (
    'DRAFT',
    'ISSUED',
    'CANCELLED'
);


--


-- Name: sales_delivery_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_delivery_status_enum AS ENUM (
    'DRAFT',
    'DISPATCHED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
);


--


-- Name: sales_discount_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_discount_status_enum AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);


--


-- Name: sales_invoice_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_invoice_status_enum AS ENUM (
    'DRAFT',
    'ISSUED',
    'CANCELLED'
);


--


-- Name: sales_order_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_order_status_enum AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'CANCELLED',
    'CLOSED'
);


--


-- Name: sales_price_list_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_price_list_status_enum AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);


--


-- Name: sales_return_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sales_return_status_enum AS ENUM (
    'REQUESTED',
    'INSPECTED',
    'APPROVED',
    'PROCESSED',
    'CLOSED',
    'REJECTED',
    'CANCELLED'
);


--


-- Sales quotation enum is defined before its table.
-- Name: quotation_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quotation_status_enum AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);


--


-- Name: sales_credit_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_credit_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    credit_note_id uuid NOT NULL,
    return_item_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    line_total numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT check_sales_credit_note_item_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT check_sales_credit_note_item_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT check_sales_credit_note_item_total CHECK ((line_total >= (0)::numeric))
);

ALTER TABLE ONLY public.sales_credit_note_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_credit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    credit_note_number character varying(50) NOT NULL,
    return_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status public.sales_credit_note_status_enum DEFAULT 'DRAFT'::public.sales_credit_note_status_enum NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    finance_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    tax_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    finance_reference character varying(255),
    CONSTRAINT check_sales_credit_note_finance_status CHECK (((finance_status)::text = ANY ((ARRAY['NOT_CONNECTED'::character varying, 'POSTED'::character varying])::text[]))),
    CONSTRAINT check_sales_credit_note_tax_status CHECK (((tax_status)::text = 'NOT_CONNECTED'::text))
);

ALTER TABLE ONLY public.sales_credit_notes FORCE ROW LEVEL SECURITY;


--


-- Name: sales_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    delivery_number character varying(50) NOT NULL,
    sales_order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status public.sales_delivery_status_enum DEFAULT 'DRAFT'::public.sales_delivery_status_enum NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    warehouse_id uuid
);

ALTER TABLE ONLY public.sales_deliveries FORCE ROW LEVEL SECURITY;


--


-- Name: sales_delivery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_delivery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    delivery_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    item_id uuid,
    reservation_id uuid,
    CONSTRAINT check_sales_delivery_item_quantity CHECK ((quantity > (0)::numeric))
);

ALTER TABLE ONLY public.sales_delivery_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_discount_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_discount_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    status public.sales_discount_status_enum DEFAULT 'DRAFT'::public.sales_discount_status_enum NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_sales_discount_percentage CHECK (((percentage > (0)::numeric) AND (percentage <= (100)::numeric)))
);

ALTER TABLE ONLY public.sales_discount_rules FORCE ROW LEVEL SECURITY;


--


-- Name: sales_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    delivery_item_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    line_total numeric(18,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    item_code character varying(100),
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,4) DEFAULT 0 NOT NULL,
    price_list_id uuid,
    discount_rule_id uuid,
    CONSTRAINT check_sales_invoice_item_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT check_sales_invoice_item_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT check_sales_invoice_item_total CHECK ((line_total >= (0)::numeric))
);

ALTER TABLE ONLY public.sales_invoice_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    invoice_number character varying(50) NOT NULL,
    sales_order_id uuid NOT NULL,
    delivery_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status public.sales_invoice_status_enum DEFAULT 'DRAFT'::public.sales_invoice_status_enum NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    finance_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    tax_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    finance_reference character varying(255),
    tax_reference character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    taxable_amount numeric(18,4),
    tax_rate numeric(9,4),
    tax_amount numeric(18,4),
    subtotal numeric(18,4) DEFAULT 0 NOT NULL,
    discount_total numeric(18,4) DEFAULT 0 NOT NULL,
    total numeric(18,4) DEFAULT 0 NOT NULL,
    CONSTRAINT check_sales_invoice_finance_status CHECK (((finance_status)::text = ANY ((ARRAY['NOT_CONNECTED'::character varying, 'POSTED'::character varying])::text[]))),
    CONSTRAINT check_sales_invoice_tax_status CHECK (((tax_status)::text = ANY ((ARRAY['NOT_CONNECTED'::character varying, 'CALCULATED'::character varying])::text[]))),
    CONSTRAINT check_sales_invoice_tax_values CHECK (((((tax_status)::text = 'NOT_CONNECTED'::text) AND (tax_reference IS NULL) AND (tax_amount IS NULL)) OR (((tax_status)::text = 'CALCULATED'::text) AND (tax_reference IS NOT NULL) AND (taxable_amount >= (0)::numeric) AND (tax_rate >= (0)::numeric) AND (tax_amount >= (0)::numeric))))
);

ALTER TABLE ONLY public.sales_invoices FORCE ROW LEVEL SECURITY;


--


-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    order_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    item_id uuid,
    item_code character varying(100),
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,4) DEFAULT 0 NOT NULL,
    line_total numeric(18,4) DEFAULT 0 NOT NULL,
    price_list_id uuid,
    discount_rule_id uuid,
    CONSTRAINT check_sales_order_item_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT check_sales_order_item_quantity CHECK ((quantity > (0)::numeric))
);

ALTER TABLE ONLY public.sales_order_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    order_number character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    status public.sales_order_status_enum DEFAULT 'DRAFT'::public.sales_order_status_enum NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    warehouse_id uuid,
    reservation_status character varying(20) DEFAULT 'NOT_RESERVED'::character varying NOT NULL,
    subtotal numeric(18,4) DEFAULT 0 NOT NULL,
    discount_total numeric(18,4) DEFAULT 0 NOT NULL,
    total numeric(18,4) DEFAULT 0 NOT NULL,
    CONSTRAINT check_sales_order_reservation_status CHECK (((reservation_status)::text = ANY ((ARRAY['NOT_RESERVED'::character varying, 'RESERVED'::character varying])::text[]))),
    CONSTRAINT check_sales_order_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.sales_orders FORCE ROW LEVEL SECURITY;


--


-- Name: sales_price_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_price_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    price_list_id uuid NOT NULL,
    item_code character varying(128) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    price numeric(18,4) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    version_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_sales_price_item_dates CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT check_sales_price_item_price CHECK ((price >= (0)::numeric))
);

ALTER TABLE ONLY public.sales_price_list_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_price_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_price_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid,
    code character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    currency character varying(3) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    status public.sales_price_list_status_enum DEFAULT 'DRAFT'::public.sales_price_list_status_enum NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_sales_price_list_dates CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)))
);

ALTER TABLE ONLY public.sales_price_lists FORCE ROW LEVEL SECURITY;


--


-- Name: sales_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    quotation_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    branch_id uuid,
    financial_year_id uuid,
    item_id uuid,
    item_code character varying(100),
    discount_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,4) DEFAULT 0 NOT NULL,
    line_total numeric(18,4) DEFAULT 0 NOT NULL,
    price_list_id uuid,
    discount_rule_id uuid,
    CONSTRAINT check_sales_quote_item_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT check_sales_quote_item_quantity CHECK ((quantity > (0)::numeric))
);

ALTER TABLE ONLY public.sales_quotation_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    quotation_number character varying(50) NOT NULL,
    customer_id uuid NOT NULL,
    quotation_date date NOT NULL,
    valid_until date NOT NULL,
    status public.quotation_status_enum DEFAULT 'DRAFT'::public.quotation_status_enum NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    branch_id uuid,
    financial_year_id uuid,
    subtotal numeric(18,4) DEFAULT 0 NOT NULL,
    discount_total numeric(18,4) DEFAULT 0 NOT NULL,
    total numeric(18,4) DEFAULT 0 NOT NULL,
    CONSTRAINT check_sales_quotation_dates CHECK ((valid_until >= quotation_date)),
    CONSTRAINT check_sales_quotation_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.sales_quotations FORCE ROW LEVEL SECURITY;


--


-- Name: sales_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    return_id uuid NOT NULL,
    invoice_item_id uuid NOT NULL,
    line_number integer NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    item_id uuid,
    CONSTRAINT check_sales_return_item_price CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT check_sales_return_item_quantity CHECK ((quantity > (0)::numeric))
);

ALTER TABLE ONLY public.sales_return_items FORCE ROW LEVEL SECURITY;


--


-- Name: sales_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    return_number character varying(50) NOT NULL,
    invoice_id uuid NOT NULL,
    delivery_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status public.sales_return_status_enum DEFAULT 'REQUESTED'::public.sales_return_status_enum NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    inventory_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    finance_status character varying(32) DEFAULT 'NOT_CONNECTED'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version_number integer DEFAULT 1 NOT NULL,
    warehouse_id uuid,
    CONSTRAINT check_sales_return_finance_status CHECK (((finance_status)::text = 'NOT_CONNECTED'::text)),
    CONSTRAINT check_sales_return_inventory_status CHECK (((inventory_status)::text = ANY ((ARRAY['NOT_CONNECTED'::character varying, 'COMPLETED'::character varying])::text[])))
);

ALTER TABLE ONLY public.sales_returns FORCE ROW LEVEL SECURITY;


--


-- Unique indexes are created before same-migration foreign keys that reference them.
-- Name: uq_sales_credit_note_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_credit_note_context ON public.sales_credit_notes USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_credit_note_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_credit_note_id_tenant ON public.sales_credit_notes USING btree (id, tenant_id);


--


-- Name: uq_sales_credit_note_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_credit_note_number ON public.sales_credit_notes USING btree (tenant_id, organization_id, credit_note_number);


--


-- Name: uq_sales_delivery_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_delivery_context ON public.sales_deliveries USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_delivery_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_delivery_id_tenant ON public.sales_deliveries USING btree (id, tenant_id);


--


-- Name: uq_sales_delivery_item_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_delivery_item_id_tenant ON public.sales_delivery_items USING btree (id, tenant_id);


--


-- Name: uq_sales_delivery_item_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_delivery_item_reservation ON public.sales_delivery_items USING btree (reservation_id, tenant_id) WHERE (reservation_id IS NOT NULL);


--


-- Name: uq_sales_invoice_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_invoice_context ON public.sales_invoices USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_invoice_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_invoice_id_tenant ON public.sales_invoices USING btree (id, tenant_id);


--


-- Name: uq_sales_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_invoice_number ON public.sales_invoices USING btree (tenant_id, organization_id, invoice_number);


--


-- Name: uq_sales_order_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_order_context ON public.sales_orders USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_order_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_order_id_tenant ON public.sales_orders USING btree (id, tenant_id);


--


-- Name: uq_sales_order_item_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_order_item_id_tenant ON public.sales_order_items USING btree (id, tenant_id);


--


-- Name: uq_sales_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_order_number ON public.sales_orders USING btree (tenant_id, organization_id, order_number);


--


-- Name: uq_sales_order_warehouse_fk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_order_warehouse_fk ON public.sales_orders USING btree (id, tenant_id);


--


-- Name: uq_sales_price_list_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_price_list_context ON public.sales_price_lists USING btree (id, organization_id, tenant_id);


--


-- Name: uq_sales_quotation_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_quotation_context ON public.sales_quotations USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_quotation_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_quotation_id_tenant ON public.sales_quotations USING btree (id, tenant_id);


--


-- Name: uq_sales_quotation_item_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_quotation_item_id_tenant ON public.sales_quotation_items USING btree (id, tenant_id);


--


-- Name: uq_sales_quotation_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_quotation_number ON public.sales_quotations USING btree (tenant_id, organization_id, quotation_number);


--


-- Name: uq_sales_quotation_org_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_quotation_org_tenant ON public.sales_quotations USING btree (id, organization_id, tenant_id);


--


-- Name: uq_sales_return_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_return_context ON public.sales_returns USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_sales_return_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_return_id_tenant ON public.sales_returns USING btree (id, tenant_id);


--


-- Name: uq_sales_return_item_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_return_item_id_tenant ON public.sales_return_items USING btree (id, tenant_id);


--


-- Name: uq_sales_return_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_return_number ON public.sales_returns USING btree (tenant_id, organization_id, return_number);


--


-- Name: uq_sales_return_warehouse_fk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sales_return_warehouse_fk ON public.sales_returns USING btree (id, tenant_id);


--

-- Name: sales_credit_note_items sales_credit_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_note_items
    ADD CONSTRAINT sales_credit_note_items_pkey PRIMARY KEY (id);


--


-- Name: sales_credit_notes sales_credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT sales_credit_notes_pkey PRIMARY KEY (id);


--


-- Name: sales_deliveries sales_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT sales_deliveries_pkey PRIMARY KEY (id);


--


-- Name: sales_delivery_items sales_delivery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT sales_delivery_items_pkey PRIMARY KEY (id);


--


-- Name: sales_discount_rules sales_discount_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_discount_rules
    ADD CONSTRAINT sales_discount_rules_pkey PRIMARY KEY (id);


--


-- Name: sales_invoice_items sales_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_pkey PRIMARY KEY (id);


--


-- Name: sales_invoices sales_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_pkey PRIMARY KEY (id);


--


-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--


-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--


-- Name: sales_price_list_items sales_price_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_list_items
    ADD CONSTRAINT sales_price_list_items_pkey PRIMARY KEY (id);


--


-- Name: sales_price_lists sales_price_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT sales_price_lists_pkey PRIMARY KEY (id);


--


-- Name: sales_quotation_items sales_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_pkey PRIMARY KEY (id);


--


-- Name: sales_quotations sales_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_pkey PRIMARY KEY (id);


--


-- Name: sales_return_items sales_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_pkey PRIMARY KEY (id);


--


-- Name: sales_returns sales_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_pkey PRIMARY KEY (id);


--


-- Name: sales_credit_note_items uq_sales_credit_note_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_note_items
    ADD CONSTRAINT uq_sales_credit_note_item_line UNIQUE (credit_note_id, line_number);


--


-- Name: sales_credit_notes uq_sales_credit_note_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT uq_sales_credit_note_key UNIQUE (idempotency_key, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_credit_notes uq_sales_credit_note_return_context; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT uq_sales_credit_note_return_context UNIQUE (return_id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_deliveries uq_sales_delivery_context_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT uq_sales_delivery_context_key UNIQUE (idempotency_key, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_deliveries uq_sales_delivery_context_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT uq_sales_delivery_context_order UNIQUE (sales_order_id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_delivery_items uq_sales_delivery_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT uq_sales_delivery_item_line UNIQUE (delivery_id, line_number);


--


-- Name: sales_discount_rules uq_sales_discount_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_discount_rules
    ADD CONSTRAINT uq_sales_discount_code UNIQUE (tenant_id, organization_id, code);


--


-- Name: sales_invoices uq_sales_invoice_delivery_context; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT uq_sales_invoice_delivery_context UNIQUE (delivery_id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_invoice_items uq_sales_invoice_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT uq_sales_invoice_item_line UNIQUE (invoice_id, line_number);


--


-- Name: sales_invoices uq_sales_invoice_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT uq_sales_invoice_key UNIQUE (idempotency_key, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_order_items uq_sales_order_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT uq_sales_order_item_line UNIQUE (order_id, line_number);


--


-- Name: sales_price_list_items uq_sales_price_item_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_list_items
    ADD CONSTRAINT uq_sales_price_item_period UNIQUE (tenant_id, price_list_id, item_code, unit_of_measure, effective_from);


--


-- Name: sales_price_lists uq_sales_price_list_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT uq_sales_price_list_code UNIQUE (tenant_id, organization_id, code);


--


-- Name: sales_quotation_items uq_sales_quote_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT uq_sales_quote_item_line UNIQUE (quotation_id, line_number);


--


-- Name: sales_returns uq_sales_return_invoice_context; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT uq_sales_return_invoice_context UNIQUE (invoice_id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_return_items uq_sales_return_item_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT uq_sales_return_item_line UNIQUE (return_id, line_number);


--


-- Name: sales_returns uq_sales_return_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT uq_sales_return_key UNIQUE (idempotency_key, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_quotations sales_quotation_context_backfill_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sales_quotation_context_backfill_guard BEFORE UPDATE OF branch_id, financial_year_id ON public.sales_quotations FOR EACH ROW EXECUTE FUNCTION public.prevent_implicit_sales_quotation_context_backfill();


--


-- Name: sales_credit_notes fk_sales_credit_note_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_credit_notes fk_sales_credit_note_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_credit_notes fk_sales_credit_note_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_credit_notes fk_sales_credit_note_invoice_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_invoice_context FOREIGN KEY (invoice_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_invoices(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_credit_note_items fk_sales_credit_note_item_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_note_items
    ADD CONSTRAINT fk_sales_credit_note_item_context FOREIGN KEY (credit_note_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_credit_notes(id, organization_id, tenant_id, branch_id, financial_year_id) ON DELETE CASCADE;


--


-- Name: sales_credit_notes fk_sales_credit_note_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_credit_notes fk_sales_credit_note_return_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT fk_sales_credit_note_return_context FOREIGN KEY (return_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_returns(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_deliveries fk_sales_delivery_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_deliveries fk_sales_delivery_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_deliveries fk_sales_delivery_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_delivery_items fk_sales_delivery_item_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT fk_sales_delivery_item_context FOREIGN KEY (delivery_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_deliveries(id, organization_id, tenant_id, branch_id, financial_year_id) ON DELETE CASCADE;


--


-- Name: sales_deliveries fk_sales_delivery_order_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_order_context FOREIGN KEY (sales_order_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_orders(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_deliveries fk_sales_delivery_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_discount_rules fk_sales_discount_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_discount_rules
    ADD CONSTRAINT fk_sales_discount_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_invoices fk_sales_invoice_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT fk_sales_invoice_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_invoices fk_sales_invoice_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT fk_sales_invoice_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_invoices fk_sales_invoice_delivery_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT fk_sales_invoice_delivery_context FOREIGN KEY (delivery_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_deliveries(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_invoices fk_sales_invoice_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT fk_sales_invoice_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_invoice_items fk_sales_invoice_item_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT fk_sales_invoice_item_context FOREIGN KEY (invoice_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_invoices(id, organization_id, tenant_id, branch_id, financial_year_id) ON DELETE CASCADE;


--


-- Name: sales_invoices fk_sales_invoice_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT fk_sales_invoice_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_orders fk_sales_order_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_orders fk_sales_order_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_orders fk_sales_order_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_order_items fk_sales_order_item_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT fk_sales_order_item_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_order_items fk_sales_order_item_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT fk_sales_order_item_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_order_items fk_sales_order_item_order_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT fk_sales_order_item_order_context FOREIGN KEY (order_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_orders(id, organization_id, tenant_id, branch_id, financial_year_id) ON DELETE CASCADE;


--


-- Name: sales_orders fk_sales_order_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_orders fk_sales_order_quotation_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_quotation_context FOREIGN KEY (quotation_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_quotations(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_price_list_items fk_sales_price_item_list; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_list_items
    ADD CONSTRAINT fk_sales_price_item_list FOREIGN KEY (price_list_id, organization_id, tenant_id) REFERENCES public.sales_price_lists(id, organization_id, tenant_id) ON DELETE CASCADE;


--


-- Name: sales_price_lists fk_sales_price_list_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT fk_sales_price_list_branch FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_price_lists fk_sales_price_list_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT fk_sales_price_list_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_quotations fk_sales_quotation_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT fk_sales_quotation_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_quotations fk_sales_quotation_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT fk_sales_quotation_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_quotations fk_sales_quotation_financial_year_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT fk_sales_quotation_financial_year_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_quotation_items fk_sales_quotation_item_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quotation_item_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_quotation_items fk_sales_quotation_item_financial_year_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quotation_item_financial_year_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_quotations fk_sales_quotation_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT fk_sales_quotation_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_quotation_items fk_sales_quote_item_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quote_item_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_quotation_items fk_sales_quote_item_quote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quote_item_quote FOREIGN KEY (quotation_id, tenant_id) REFERENCES public.sales_quotations(id, tenant_id) ON DELETE CASCADE;


--


-- Name: sales_quotation_items fk_sales_quote_item_quote_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quote_item_quote_org_tenant FOREIGN KEY (quotation_id, organization_id, tenant_id) REFERENCES public.sales_quotations(id, organization_id, tenant_id) ON DELETE CASCADE;


--


-- Name: sales_returns fk_sales_return_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--


-- Name: sales_returns fk_sales_return_customer_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_customer_tenant FOREIGN KEY (customer_id, tenant_id) REFERENCES public.customers(id, tenant_id);


--


-- Name: sales_returns fk_sales_return_delivery_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_delivery_context FOREIGN KEY (delivery_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_deliveries(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_returns fk_sales_return_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--


-- Name: sales_returns fk_sales_return_invoice_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_invoice_context FOREIGN KEY (invoice_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_invoices(id, organization_id, tenant_id, branch_id, financial_year_id);


--


-- Name: sales_return_items fk_sales_return_item_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_item_context FOREIGN KEY (return_id, organization_id, tenant_id, branch_id, financial_year_id) REFERENCES public.sales_returns(id, organization_id, tenant_id, branch_id, financial_year_id) ON DELETE CASCADE;


--


-- Name: sales_returns fk_sales_return_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--


-- Name: sales_credit_note_items sales_credit_note_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_note_items
    ADD CONSTRAINT sales_credit_note_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_credit_notes sales_credit_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_credit_notes
    ADD CONSTRAINT sales_credit_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_deliveries sales_deliveries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT sales_deliveries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_delivery_items sales_delivery_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT sales_delivery_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_discount_rules sales_discount_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_discount_rules
    ADD CONSTRAINT sales_discount_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_invoice_items sales_invoice_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_invoices sales_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_invoices
    ADD CONSTRAINT sales_invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_order_items sales_order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_orders sales_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_price_list_items sales_price_list_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_list_items
    ADD CONSTRAINT sales_price_list_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_price_lists sales_price_lists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_price_lists
    ADD CONSTRAINT sales_price_lists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_quotation_items sales_quotation_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_quotations sales_quotations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_return_items sales_return_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT sales_return_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_returns sales_returns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT sales_returns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: sales_credit_note_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_credit_note_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_credit_note_items sales_credit_note_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_credit_note_items_tenant_policy ON public.sales_credit_note_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_credit_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_credit_notes ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_credit_notes sales_credit_notes_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_credit_notes_tenant_policy ON public.sales_credit_notes USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_deliveries ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_deliveries sales_deliveries_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_deliveries_tenant_policy ON public.sales_deliveries USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_delivery_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_delivery_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_delivery_items sales_delivery_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_delivery_items_tenant_policy ON public.sales_delivery_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_discount_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_discount_rules ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_discount_rules sales_discount_rules_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_discount_rules_tenant_policy ON public.sales_discount_rules USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_invoice_items sales_invoice_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoice_items_tenant_policy ON public.sales_invoice_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_invoices sales_invoices_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_invoices_tenant_policy ON public.sales_invoices USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_order_items sales_order_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_order_items_tenant_policy ON public.sales_order_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_orders sales_orders_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_orders_tenant_policy ON public.sales_orders USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_price_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_price_list_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_price_list_items sales_price_list_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_price_list_items_tenant_policy ON public.sales_price_list_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_price_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_price_lists ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_price_lists sales_price_lists_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_price_lists_tenant_policy ON public.sales_price_lists USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_quotation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_quotation_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_quotation_items sales_quotation_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotation_items_tenant_policy ON public.sales_quotation_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_quotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_quotations sales_quotations_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_quotations_tenant_policy ON public.sales_quotations USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_return_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_return_items sales_return_items_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_return_items_tenant_policy ON public.sales_return_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Name: sales_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

--


-- Name: sales_returns sales_returns_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sales_returns_tenant_policy ON public.sales_returns USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
-- Domain indexes relocated from the historical dump ordering.

-- Name: idx_sales_credit_note_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_credit_note_list ON public.sales_credit_notes USING btree (tenant_id, organization_id, branch_id, financial_year_id, credit_note_number);


--


-- Name: idx_sales_delivery_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_delivery_list ON public.sales_deliveries USING btree (tenant_id, organization_id, branch_id, financial_year_id, delivery_number);


--


-- Name: idx_sales_invoice_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoice_list ON public.sales_invoices USING btree (tenant_id, organization_id, branch_id, financial_year_id, invoice_number);


--


-- Name: idx_sales_order_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_list ON public.sales_orders USING btree (tenant_id, organization_id, order_number, id) WHERE (is_deleted = false);


--


-- Name: idx_sales_order_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_warehouse ON public.sales_orders USING btree (tenant_id, organization_id, warehouse_id);


--


-- Name: idx_sales_price_item_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_price_item_lookup ON public.sales_price_list_items USING btree (tenant_id, organization_id, item_code, unit_of_measure, effective_from);


--


-- Name: idx_sales_price_list_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_price_list_scope ON public.sales_price_lists USING btree (tenant_id, organization_id, branch_id, status, effective_from);


--


-- Name: idx_sales_quotation_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_quotation_list ON public.sales_quotations USING btree (tenant_id, organization_id, quotation_number, id) WHERE (is_deleted = false);


--


-- Name: idx_sales_return_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_return_list ON public.sales_returns USING btree (tenant_id, organization_id, branch_id, financial_year_id, return_number);
