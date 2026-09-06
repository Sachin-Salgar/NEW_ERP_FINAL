-- Active development baseline: FINANCE domain.
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


-- Name: finance_postings finance_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT finance_postings_pkey PRIMARY KEY (id);


--


-- Name: finance_postings uq_finance_posting_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_postings
    ADD CONSTRAINT uq_finance_posting_key UNIQUE (tenant_id, organization_id, branch_id, financial_year_id, idempotency_key);


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


-- Name: finance_postings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_postings ENABLE ROW LEVEL SECURITY;

--


-- Name: finance_postings finance_postings_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY finance_postings_tenant_policy ON public.finance_postings USING ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid));


--


-- Domain indexes relocated from the historical dump ordering.
-- Name: idx_finance_posting_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_posting_document ON public.finance_postings USING btree (tenant_id, organization_id, document_type, document_id);


--
