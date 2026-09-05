ALTER TABLE sales_quotation_items
  ADD COLUMN IF NOT EXISTS item_code varchar(100),
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_list_id uuid,
  ADD COLUMN IF NOT EXISTS discount_rule_id uuid;
--> statement-breakpoint
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS item_code varchar(100),
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_list_id uuid,
  ADD COLUMN IF NOT EXISTS discount_rule_id uuid;
--> statement-breakpoint
ALTER TABLE sales_invoice_items
  ADD COLUMN IF NOT EXISTS item_code varchar(100),
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_list_id uuid,
  ADD COLUMN IF NOT EXISTS discount_rule_id uuid;
--> statement-breakpoint
ALTER TABLE sales_quotations
  ADD COLUMN IF NOT EXISTS subtotal numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(18,4) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(18,4) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(18,4) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items FORCE ROW LEVEL SECURITY;
