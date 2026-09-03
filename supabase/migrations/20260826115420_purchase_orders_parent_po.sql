-- Link vendor/cost POs under a main PO for extra works on the same client project.
-- Projects masterlist = client jobs (revenue). Purchase orders = Addbell costs under those projects.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS parent_purchase_order_id uuid
    REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_parent_purchase_order_id
  ON public.purchase_orders (parent_purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id
  ON public.purchase_orders (project_id);

COMMENT ON COLUMN public.purchase_orders.parent_purchase_order_id IS
  'Optional main PO this row is a sub-PO under (extra works). Must be another purchase_orders row, typically on the same project.';

-- Prevent a PO from being its own parent.
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_parent_not_self;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_parent_not_self
  CHECK (
    parent_purchase_order_id IS NULL
    OR parent_purchase_order_id <> id
  );
