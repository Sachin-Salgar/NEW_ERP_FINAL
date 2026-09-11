SET search_path = '';

ALTER TABLE public.customer_contacts
  DROP CONSTRAINT IF EXISTS fk_customer_contacts_customer,
  DROP CONSTRAINT IF EXISTS fk_customer_contacts_tenant,
  ADD CONSTRAINT fk_customer_contacts_customer_tenant
    FOREIGN KEY (customer_id, tenant_id)
    REFERENCES public.customers (id, tenant_id)
    ON DELETE CASCADE;

ALTER TABLE public.customer_offices
  DROP CONSTRAINT IF EXISTS fk_customer_offices_customer,
  DROP CONSTRAINT IF EXISTS fk_customer_offices_tenant,
  ADD CONSTRAINT fk_customer_offices_customer_tenant
    FOREIGN KEY (customer_id, tenant_id)
    REFERENCES public.customers (id, tenant_id)
    ON DELETE CASCADE;

ALTER TABLE public.customer_tax_payment_terms
  DROP CONSTRAINT IF EXISTS fk_customer_tax_payment_terms_customer,
  DROP CONSTRAINT IF EXISTS fk_customer_tax_payment_terms_tenant,
  ADD CONSTRAINT fk_customer_tax_payment_terms_customer_tenant
    FOREIGN KEY (customer_id, tenant_id)
    REFERENCES public.customers (id, tenant_id)
    ON DELETE CASCADE;

ALTER TABLE public.customer_other_details
  DROP CONSTRAINT IF EXISTS fk_customer_other_details_customer,
  DROP CONSTRAINT IF EXISTS fk_customer_other_details_tenant,
  ADD CONSTRAINT fk_customer_other_details_customer_tenant
    FOREIGN KEY (customer_id, tenant_id)
    REFERENCES public.customers (id, tenant_id)
    ON DELETE CASCADE;
