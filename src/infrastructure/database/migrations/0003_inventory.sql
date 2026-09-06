-- Active development baseline: INVENTORY domain.
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


-- Unique indexes are created before foreign keys that reference composite keys.
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


-- Name: sales_deliveries fk_sales_delivery_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_deliveries
    ADD CONSTRAINT fk_sales_delivery_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


--


-- Name: sales_order_items fk_sales_order_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT fk_sales_order_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


--


-- Name: sales_orders fk_sales_order_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_order_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


--


-- Name: sales_quotation_items fk_sales_quotation_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT fk_sales_quotation_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


--


-- Name: sales_return_items fk_sales_return_item_item_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_return_items
    ADD CONSTRAINT fk_sales_return_item_item_tenant FOREIGN KEY (item_id, tenant_id) REFERENCES public.inventory_items(id, tenant_id);


--


-- Name: sales_returns fk_sales_return_warehouse_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_returns
    ADD CONSTRAINT fk_sales_return_warehouse_tenant FOREIGN KEY (warehouse_id, tenant_id) REFERENCES public.inventory_warehouses(id, tenant_id);


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
-- Domain indexes relocated from the historical dump ordering.

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

