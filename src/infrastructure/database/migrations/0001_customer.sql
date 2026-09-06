-- Active development baseline: 0001_customer domain.
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

-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    is_deleted boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_customer_soft_delete CHECK ((((is_deleted = false) AND (deleted_at IS NULL)) OR ((is_deleted = true) AND (deleted_at IS NOT NULL))))
);

ALTER TABLE ONLY public.customers FORCE ROW LEVEL SECURITY;


--

-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--

-- Name: idx_customer_tenant_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_tenant_org_name ON public.customers USING btree (tenant_id, organization_id, name, id) WHERE (is_deleted = false);


--

-- Name: uq_customer_id_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_id_tenant ON public.customers USING btree (id, tenant_id);


--

-- Name: customers fk_customer_org_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customer_org_tenant FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, tenant_id) ON DELETE RESTRICT;


--

-- Name: customers fk_customers_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--

-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--

-- Name: customers customers_tenant_isolation_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_tenant_isolation_policy ON public.customers USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--
