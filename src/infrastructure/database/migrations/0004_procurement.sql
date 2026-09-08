-- Active development baseline: PROCUREMENT domain.
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
-- Name: procurement_purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
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


-- Unique indexes are created before foreign keys that reference composite keys.
-- Name: uq_procurement_po_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_po_context ON public.procurement_purchase_orders USING btree (id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_procurement_receipt_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_receipt_context ON public.procurement_receipts USING btree (id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_procurement_requisition_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_requisition_context ON public.procurement_requisitions USING btree (id, tenant_id, branch_id, financial_year_id);


--


-- Name: uq_procurement_supplier_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_procurement_supplier_context ON public.procurement_suppliers USING btree (id, tenant_id);


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


-- Name: procurement_purchase_order_lines uq_procurement_po_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_order_lines
    ADD CONSTRAINT uq_procurement_po_line UNIQUE (purchase_order_id, line_number);


--


-- Name: procurement_purchase_orders uq_procurement_po_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_purchase_orders
    ADD CONSTRAINT uq_procurement_po_number UNIQUE (tenant_id, po_number);


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
    ADD CONSTRAINT uq_procurement_requisition_number UNIQUE (tenant_id, requisition_number);


--


-- Name: procurement_suppliers uq_procurement_supplier_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_suppliers
    ADD CONSTRAINT uq_procurement_supplier_code UNIQUE (tenant_id, code);


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
    ADD CONSTRAINT fk_procurement_po_supplier_context FOREIGN KEY (supplier_id, tenant_id) REFERENCES public.procurement_suppliers(id, tenant_id);


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


-- Name: procurement_purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_purchase_order_lines ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_purchase_order_lines procurement_purchase_order_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_purchase_order_lines_tenant_policy ON public.procurement_purchase_order_lines USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_purchase_orders ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_purchase_orders procurement_purchase_orders_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_purchase_orders_tenant_policy ON public.procurement_purchase_orders USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_receipt_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_receipt_lines ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_receipt_lines procurement_receipt_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_receipt_lines_tenant_policy ON public.procurement_receipt_lines USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_receipts ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_receipts procurement_receipts_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_receipts_tenant_policy ON public.procurement_receipts USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_requisition_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_requisition_lines ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_requisition_lines procurement_requisition_lines_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_requisition_lines_tenant_policy ON public.procurement_requisition_lines USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_requisitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_requisitions ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_requisitions procurement_requisitions_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_requisitions_tenant_policy ON public.procurement_requisitions USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: procurement_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procurement_suppliers ENABLE ROW LEVEL SECURITY;

--


-- Name: procurement_suppliers procurement_suppliers_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY procurement_suppliers_tenant_policy ON public.procurement_suppliers USING ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)) WITH CHECK ((tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));
-- Name: idx_procurement_purchase_order_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_purchase_order_lines_tenant_org_active ON public.procurement_purchase_order_lines USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_purchase_orders_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_purchase_orders_tenant_org_active ON public.procurement_purchase_orders USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_receipt_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_receipt_lines_tenant_org_active ON public.procurement_receipt_lines USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_receipts_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_receipts_tenant_org_active ON public.procurement_receipts USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_requisition_lines_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_requisition_lines_tenant_org_active ON public.procurement_requisition_lines USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_requisitions_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_requisitions_tenant_org_active ON public.procurement_requisitions USING btree (tenant_id, id) WHERE (is_deleted = false);


--

-- Name: idx_procurement_suppliers_tenant_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procurement_suppliers_tenant_org_active ON public.procurement_suppliers USING btree (tenant_id, id) WHERE (is_deleted = false);


--
