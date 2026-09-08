-- Active development baseline: TAX domain.
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
-- Name: tax_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
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


-- Name: tax_rules tax_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_pkey PRIMARY KEY (id);


--


-- Name: tax_rules uq_tax_rule_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT uq_tax_rule_code UNIQUE (tenant_id, code);


--


-- Name: tax_rules tax_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--


-- Name: tax_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

--


-- Name: tax_rules tax_rules_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tax_rules_tenant_policy ON public.tax_rules USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--

-- Domain indexes relocated from the historical dump ordering.
-- Name: idx_tax_rule_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_rule_resolution ON public.tax_rules USING btree (tenant_id, status, effective_from, effective_to);


--
