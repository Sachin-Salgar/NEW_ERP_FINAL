-- Active development baseline: 0002_sales domain.
--
-- Core creates the shared schema, extensions, and search-path prerequisites.

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

-- Name: prevent_implicit_sales_quotation_context_backfill(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_implicit_sales_quotation_context_backfill() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (OLD.branch_id IS NULL AND NEW.branch_id IS NOT NULL)
     OR (OLD.financial_year_id IS NULL AND NEW.financial_year_id IS NOT NULL) THEN
    IF current_setting('app.allow_quotation_context_reclassification', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Sales quotation context reclassification requires explicit authorization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--

-- Name: finance_postings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_postings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    document_type character varying(32) NOT NULL,
    document_id uuid NOT NULL,
    reference character varying(255) NOT NULL,
    amount numeric(18,4) NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT check_finance_posting_amount CHECK ((amount >= (0)::numeric)),
    CONSTRAINT check_finance_posting_type CHECK (((document_type)::text = ANY ((ARRAY['INVOICE'::character varying, 'CREDIT_NOTE'::character varying])::text[])))
);

ALTER TABLE ONLY public.finance_postings FORCE ROW LEVEL SECURITY;


--

-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    unit_of_measure character varying(50) NOT NULL,
    sales_eligible boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_inventory_item_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL)))),
    CONSTRAINT check_inventory_item_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);

ALTER TABLE ONLY public.inventory_items FORCE ROW LEVEL SECURITY;


--

-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    item_id uuid NOT NULL,
    movement_type character varying(20) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    source_type character varying(80) NOT NULL,
    source_id uuid NOT NULL,
    operation_key character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT check_inventory_movement_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT check_inventory_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['RECEIPT'::character varying, 'ISSUE'::character varying, 'RETURN'::character varying])::text[])))
);

ALTER TABLE ONLY public.inventory_movements FORCE ROW LEVEL SECURITY;


--

-- Name: inventory_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    item_id uuid NOT NULL,
    source_type character varying(80) NOT NULL,
    source_id uuid NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    status character varying(20) DEFAULT 'RESERVED'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_inventory_reservation_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT check_inventory_reservation_status CHECK (((status)::text = ANY ((ARRAY['RESERVED'::character varying, 'RELEASED'::character varying, 'FULFILLED'::character varying])::text[])))
);

ALTER TABLE ONLY public.inventory_reservations FORCE ROW LEVEL SECURITY;


--

-- Name: inventory_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    item_id uuid NOT NULL,
    on_hand_quantity numeric(18,4) DEFAULT 0 NOT NULL,
    reserved_quantity numeric(18,4) DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_inventory_stock_nonnegative CHECK (((on_hand_quantity >= (0)::numeric) AND (reserved_quantity >= (0)::numeric) AND (reserved_quantity <= on_hand_quantity)))
);

ALTER TABLE ONLY public.inventory_stock FORCE ROW LEVEL SECURITY;


--

-- Name: inventory_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_inventory_warehouse_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);

ALTER TABLE ONLY public.inventory_warehouses FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) DEFAULT 0 NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT check_procurement_po_qty CHECK ((quantity > (0)::numeric)),
    CONSTRAINT procurement_purchase_order_lines_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_purchase_order_lines FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    requisition_id uuid,
    po_number character varying(50) DEFAULT ('PO-'::text || substr((gen_random_uuid())::text, 1, 8)) NOT NULL,
    order_date date NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT procurement_purchase_orders_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_purchase_orders FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_receipt_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_receipt_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    receipt_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity numeric(18,4) NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT check_procurement_receipt_qty CHECK ((quantity > (0)::numeric)),
    CONSTRAINT procurement_receipt_lines_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_receipt_lines FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    receipt_date date NOT NULL,
    operation_key character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    CONSTRAINT procurement_receipts_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_receipts FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_requisition_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_requisition_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    requisition_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    description character varying(500) NOT NULL,
    quantity numeric(18,4) NOT NULL,
    unit_price numeric(18,4) DEFAULT 0 NOT NULL,
    unit_of_measure character varying(50) NOT NULL,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT check_procurement_requisition_qty CHECK ((quantity > (0)::numeric)),
    CONSTRAINT procurement_requisition_lines_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_requisition_lines FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_requisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_requisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    financial_year_id uuid NOT NULL,
    requisition_number character varying(50) DEFAULT ('PR-'::text || substr((gen_random_uuid())::text, 1, 8)) NOT NULL,
    required_date date NOT NULL,
    justification text,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT procurement_requisitions_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_requisitions FORCE ROW LEVEL SECURITY;


--

-- Name: procurement_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT procurement_suppliers_soft_delete_check CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.procurement_suppliers FORCE ROW LEVEL SECURITY;


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

-- Name: tax_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    rate numeric(9,4) NOT NULL,
    status character varying(16) DEFAULT 'INACTIVE'::character varying NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    version_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT check_tax_rule_dates CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT check_tax_rule_rate CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric))),
    CONSTRAINT check_tax_rule_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);

ALTER TABLE ONLY public.tax_rules FORCE ROW LEVEL SECURITY;


--

-- Name: finance_postings finance_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT finance_postings_pkey PRIMARY KEY (id);


--

-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--

-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--

-- Name: inventory_reservations inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);


--

-- Name: inventory_stock inventory_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_pkey PRIMARY KEY (id);


--

-- Name: inventory_warehouses inventory_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_pkey PRIMARY KEY (id);


--

-- Name: procurement_purchase_order_lines procurement_purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_order_lines
    ADD CONSTRAINT procurement_purchase_order_lines_pkey PRIMARY KEY (id);


--

-- Name: procurement_purchase_orders procurement_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT procurement_purchase_orders_pkey PRIMARY KEY (id);


--

-- Name: procurement_receipt_lines procurement_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipt_lines
    ADD CONSTRAINT procurement_receipt_lines_pkey PRIMARY KEY (id);


--

-- Name: procurement_receipts procurement_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT procurement_receipts_pkey PRIMARY KEY (id);


--

-- Name: procurement_requisition_lines procurement_requisition_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisition_lines
    ADD CONSTRAINT procurement_requisition_lines_pkey PRIMARY KEY (id);


--

-- Name: procurement_requisitions procurement_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT procurement_requisitions_pkey PRIMARY KEY (id);


--

-- Name: procurement_suppliers procurement_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_suppliers
    ADD CONSTRAINT procurement_suppliers_pkey PRIMARY KEY (id);


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

-- Name: tax_rules tax_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_pkey PRIMARY KEY (id);


--

-- Name: finance_postings uq_finance_posting_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT uq_finance_posting_key UNIQUE (tenant_id, organization_id, branch_id, financial_year_id, idempotency_key);


--

-- Name: inventory_movements uq_inventory_movement_operation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT uq_inventory_movement_operation UNIQUE (tenant_id, organization_id, operation_key);


--

-- Name: inventory_reservations uq_inventory_reservation_source_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT uq_inventory_reservation_source_item UNIQUE (tenant_id, organization_id, source_type, source_id, item_id);


--

-- Name: inventory_stock uq_inventory_stock_scope; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT uq_inventory_stock_scope UNIQUE (tenant_id, organization_id, warehouse_id, item_id);


--

-- Name: inventory_warehouses uq_inventory_warehouse_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT uq_inventory_warehouse_code UNIQUE (tenant_id, organization_id, code);


--

-- Name: procurement_purchase_order_lines uq_procurement_po_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_order_lines
    ADD CONSTRAINT uq_procurement_po_line UNIQUE (purchase_order_id, line_number);


--

-- Name: procurement_purchase_orders uq_procurement_po_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT uq_procurement_po_number UNIQUE (tenant_id, organization_id, po_number);


--

-- Name: procurement_receipt_lines uq_procurement_receipt_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipt_lines
    ADD CONSTRAINT uq_procurement_receipt_item UNIQUE (receipt_id, item_id);


--

-- Name: procurement_receipts uq_procurement_receipt_operation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT uq_procurement_receipt_operation UNIQUE (tenant_id, operation_key);


--

-- Name: procurement_requisition_lines uq_procurement_requisition_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisition_lines
    ADD CONSTRAINT uq_procurement_requisition_line UNIQUE (requisition_id, line_number);


--

-- Name: procurement_requisitions uq_procurement_requisition_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT uq_procurement_requisition_number UNIQUE (tenant_id, organization_id, requisition_number);


--

-- Name: procurement_suppliers uq_procurement_supplier_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_suppliers
    ADD CONSTRAINT uq_procurement_supplier_code UNIQUE (tenant_id, organization_id, code);


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

-- Name: tax_rules uq_tax_rule_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT uq_tax_rule_code UNIQUE (tenant_id, organization_id, code);


--

-- Name: idx_finance_posting_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_posting_document ON public.finance_postings USING btree (tenant_id, organization_id, document_type, document_id);


--

-- Name: idx_inventory_item_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_item_org_name ON public.inventory_items USING btree (tenant_id, organization_id, name, id) WHERE (is_deleted = false);


--

-- Name: idx_inventory_movement_org_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movement_org_item ON public.inventory_movements USING btree (tenant_id, organization_id, item_id, created_at);


--

-- Name: idx_inventory_reservation_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_reservation_org_status ON public.inventory_reservations USING btree (tenant_id, organization_id, status, created_at);


--

-- Name: idx_inventory_stock_org_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_stock_org_warehouse ON public.inventory_stock USING btree (tenant_id, organization_id, warehouse_id, item_id);


--

-- Name: idx_inventory_warehouse_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_warehouse_org_name ON public.inventory_warehouses USING btree (tenant_id, organization_id, name);


--

-- Name: idx_procurement_purchase_order_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_purchase_order_lines_tenant_org_active ON public.procurement_purchase_order_lines USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_purchase_orders_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_purchase_orders_tenant_org_active ON public.procurement_purchase_orders USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_receipt_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_receipt_lines_tenant_org_active ON public.procurement_receipt_lines USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_receipts_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_receipts_tenant_org_active ON public.procurement_receipts USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_requisition_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_requisition_lines_tenant_org_active ON public.procurement_requisition_lines USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_requisitions_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_requisitions_tenant_org_active ON public.procurement_requisitions USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_suppliers_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_suppliers_tenant_org_active ON public.procurement_suppliers USING btree (tenant_id, organization_id, id) WHERE (is_deleted = false);


--

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


--

-- Name: idx_tax_rule_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_rule_resolution ON public.tax_rules USING btree (tenant_id, organization_id, status, effective_from, effective_to);


--

-- Name: uq_inventory_item_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_item_id_tenant ON public.inventory_items USING btree (id, tenant_id);


--

-- Name: uq_inventory_item_org_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_item_org_code ON public.inventory_items USING btree (tenant_id, organization_id, code) WHERE (is_deleted = false);


--

-- Name: uq_inventory_reservation_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_reservation_id_tenant ON public.inventory_reservations USING btree (id, tenant_id);


--

-- Name: uq_inventory_warehouse_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_warehouse_id_tenant ON public.inventory_warehouses USING btree (id, tenant_id);


--

-- Name: uq_procurement_po_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_po_context ON public.procurement_purchase_orders USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--

-- Name: uq_procurement_receipt_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_receipt_context ON public.procurement_receipts USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--

-- Name: uq_procurement_requisition_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_requisition_context ON public.procurement_requisitions USING btree (id, organization_id, tenant_id, branch_id, financial_year_id);


--

-- Name: uq_procurement_supplier_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_supplier_context ON public.procurement_suppliers USING btree (id, organization_id, tenant_id);


--

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

-- Name: sales_quotations sales_quotation_context_backfill_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sales_quotation_context_backfill_guard BEFORE UPDATE OF branch_id, financial_year_id ON public.sales_quotations FOR EACH ROW EXECUTE FUNCTION public.prevent_implicit_sales_quotation_context_backfill();


--

-- Name: finance_postings finance_postings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT finance_postings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: finance_postings fk_finance_posting_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT fk_finance_posting_branch FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: finance_postings fk_finance_posting_fy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT fk_finance_posting_fy FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--

-- Name: finance_postings fk_finance_posting_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT fk_finance_posting_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: inventory_items fk_inventory_item_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT fk_inventory_item_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_movements fk_inventory_movement_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movement_branch FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_movements fk_inventory_movement_fy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movement_fy FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_movements fk_inventory_movement_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movement_item FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_movements fk_inventory_movement_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movement_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_movements fk_inventory_movement_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movement_warehouse FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_reservations fk_inventory_reservation_branch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT fk_inventory_reservation_branch FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_reservations fk_inventory_reservation_fy; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT fk_inventory_reservation_fy FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_reservations fk_inventory_reservation_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT fk_inventory_reservation_item FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_reservations fk_inventory_reservation_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT fk_inventory_reservation_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_reservations fk_inventory_reservation_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT fk_inventory_reservation_warehouse FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_stock fk_inventory_stock_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT fk_inventory_stock_item FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_stock fk_inventory_stock_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT fk_inventory_stock_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_stock fk_inventory_stock_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT fk_inventory_stock_warehouse FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: inventory_warehouses fk_inventory_warehouse_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT fk_inventory_warehouse_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: procurement_purchase_orders fk_procurement_po_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: procurement_purchase_orders fk_procurement_po_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--

-- Name: procurement_purchase_order_lines fk_procurement_po_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_order_lines
    ADD CONSTRAINT fk_procurement_po_line FOREIGN KEY (purchase_order_id) REFERENCES public.procurement_purchase_orders(id) ON DELETE CASCADE;


--

-- Name: procurement_purchase_order_lines fk_procurement_po_line_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_order_lines
    ADD CONSTRAINT fk_procurement_po_line_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_purchase_orders fk_procurement_po_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_purchase_orders fk_procurement_po_requisition; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_requisition FOREIGN KEY (requisition_id) REFERENCES public.procurement_requisitions(id);


--

-- Name: procurement_purchase_orders fk_procurement_po_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_supplier FOREIGN KEY (supplier_id) REFERENCES public.procurement_suppliers(id);


--

-- Name: procurement_purchase_orders fk_procurement_po_supplier_context; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT fk_procurement_po_supplier_context FOREIGN KEY (supplier_id, organization_id, tenant_id) REFERENCES public.procurement_suppliers(id, organization_id, tenant_id);


--

-- Name: procurement_receipts fk_procurement_receipt_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT fk_procurement_receipt_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: procurement_receipts fk_procurement_receipt_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT fk_procurement_receipt_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--

-- Name: procurement_receipt_lines fk_procurement_receipt_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipt_lines
    ADD CONSTRAINT fk_procurement_receipt_line FOREIGN KEY (receipt_id) REFERENCES public.procurement_receipts(id) ON DELETE CASCADE;


--

-- Name: procurement_receipt_lines fk_procurement_receipt_line_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipt_lines
    ADD CONSTRAINT fk_procurement_receipt_line_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_receipts fk_procurement_receipt_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT fk_procurement_receipt_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_requisitions fk_procurement_requisition_branch_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT fk_procurement_requisition_branch_tenant FOREIGN KEY (branch_id, tenant_id) REFERENCES public.branches(id, tenant_id);


--

-- Name: procurement_requisitions fk_procurement_requisition_fy_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT fk_procurement_requisition_fy_tenant FOREIGN KEY (financial_year_id, tenant_id) REFERENCES public.financial_years(id, tenant_id);


--

-- Name: procurement_requisition_lines fk_procurement_requisition_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisition_lines
    ADD CONSTRAINT fk_procurement_requisition_line FOREIGN KEY (requisition_id) REFERENCES public.procurement_requisitions(id) ON DELETE CASCADE;


--

-- Name: procurement_requisition_lines fk_procurement_requisition_line_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisition_lines
    ADD CONSTRAINT fk_procurement_requisition_line_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_requisitions fk_procurement_requisition_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT fk_procurement_requisition_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: procurement_suppliers fk_procurement_supplier_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_suppliers
    ADD CONSTRAINT fk_procurement_supplier_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


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

-- Name: sales_delivery_items fk_sales_delivery_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT fk_sales_delivery_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


--

-- Name: sales_delivery_items fk_sales_delivery_item_reservation_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_delivery_items
    ADD CONSTRAINT fk_sales_delivery_item_reservation_tenant FOREIGN KEY (reservation_id, tenant_id) REFERENCES public.inventory_reservations(id, tenant_id);


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

-- Name: sales_deliveries fk_sales_delivery_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


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

-- Name: sales_order_items fk_sales_order_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT fk_sales_order_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


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

-- Name: sales_orders fk_sales_order_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


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

-- Name: sales_quotation_items fk_sales_quotation_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quotation_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


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

-- Name: sales_return_items fk_sales_return_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


--

-- Name: sales_returns fk_sales_return_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: sales_returns fk_sales_return_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


--

-- Name: tax_rules fk_tax_rule_org; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT fk_tax_rule_org FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id);


--

-- Name: inventory_items inventory_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: inventory_movements inventory_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: inventory_reservations inventory_reservations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: inventory_stock inventory_stock_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock
    ADD CONSTRAINT inventory_stock_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: inventory_warehouses inventory_warehouses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: procurement_purchase_orders procurement_purchase_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT procurement_purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: procurement_receipts procurement_receipts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_receipts
    ADD CONSTRAINT procurement_receipts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: procurement_requisitions procurement_requisitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT procurement_requisitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: procurement_suppliers procurement_suppliers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_suppliers
    ADD CONSTRAINT procurement_suppliers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


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

-- Name: tax_rules tax_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: finance_postings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_postings ENABLE ROW LEVEL SECURITY;

--

-- Name: finance_postings finance_postings_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_postings_tenant_policy ON public.finance_postings USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--

-- Name: inventory_items inventory_items_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_tenant_isolation_policy ON public.inventory_items USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--

-- Name: inventory_movements inventory_movements_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_movements_tenant_isolation ON public.inventory_movements USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: inventory_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

--

-- Name: inventory_reservations inventory_reservations_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_reservations_tenant_isolation ON public.inventory_reservations USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: inventory_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;

--

-- Name: inventory_stock inventory_stock_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_tenant_isolation ON public.inventory_stock USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: inventory_warehouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;

--

-- Name: inventory_warehouses inventory_warehouses_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_warehouses_tenant_isolation ON public.inventory_warehouses USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Name: procurement_purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_purchase_order_lines ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_purchase_order_lines procurement_purchase_order_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_purchase_order_lines_tenant_policy ON public.procurement_purchase_order_lines USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_purchase_orders ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_purchase_orders procurement_purchase_orders_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_purchase_orders_tenant_policy ON public.procurement_purchase_orders USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_receipt_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_receipt_lines ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_receipt_lines procurement_receipt_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_receipt_lines_tenant_policy ON public.procurement_receipt_lines USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_receipts ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_receipts procurement_receipts_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_receipts_tenant_policy ON public.procurement_receipts USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_requisition_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_requisition_lines ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_requisition_lines procurement_requisition_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_requisition_lines_tenant_policy ON public.procurement_requisition_lines USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_requisitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_requisitions ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_requisitions procurement_requisitions_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_requisitions_tenant_policy ON public.procurement_requisitions USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


--

-- Name: procurement_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_suppliers ENABLE ROW LEVEL SECURITY;

--

-- Name: procurement_suppliers procurement_suppliers_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_suppliers_tenant_policy ON public.procurement_suppliers USING (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid)))) WITH CHECK (((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid) AND ((current_setting('app.current_tenant_id_organization_id'::text, true) IS NULL) OR (organization_id = (current_setting('app.current_tenant_id_organization_id'::text, true))::uuid))));


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

-- Name: tax_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

--

-- Name: tax_rules tax_rules_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_rules_tenant_policy ON public.tax_rules USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
