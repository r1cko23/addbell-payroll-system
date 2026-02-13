-- =====================================================
-- PURCHASE ORDER INTEGRATION BACKBONE
-- =====================================================
-- Connects PO -> Project Costs -> Unified Cost Ledger

-- 1) Purchase Orders (header)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL UNIQUE,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  po_date_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'cancelled')),
  requisitioner TEXT DEFAULT '',
  requested_by TEXT DEFAULT '',
  prepared_by TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  approved_by TEXT DEFAULT '',
  approved_by_title TEXT DEFAULT '',
  project_title TEXT DEFAULT '',
  deliver_to TEXT DEFAULT '',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  vendor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  print_timestamp TIMESTAMPTZ,
  posted_to_costs BOOLEAN NOT NULL DEFAULT FALSE,
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_date ON public.purchase_orders(po_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);

-- 2) Purchase Order Items (lines)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  description TEXT NOT NULL DEFAULT '',
  qty_text TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_order_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(purchase_order_id);

-- 3) Unified project cost ledger (single source for cost posting)
CREATE TABLE IF NOT EXISTS public.project_cost_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('purchase_order_item', 'manpower', 'expense', 'adjustment')),
  source_id UUID NOT NULL,
  ledger_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_project_cost_ledger_project_date ON public.project_cost_ledger(project_id, ledger_date DESC);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_cost_ledger ENABLE ROW LEVEL SECURITY;

-- Allowed roles for PO + project cost workflows
-- admin, upper_management, hr, operations_manager, purchasing_officer
CREATE POLICY "Authorized roles can manage purchase orders" ON public.purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND is_active = true
    )
  );

CREATE POLICY "Authorized roles can manage purchase order items" ON public.purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE po.id = purchase_order_id
        AND p.role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE po.id = purchase_order_id
        AND p.role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND p.is_active = true
    )
  );

CREATE POLICY "Authorized roles can read project cost ledger" ON public.project_cost_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND is_active = true
    )
  );

CREATE POLICY "Authorized roles can write project cost ledger" ON public.project_cost_ledger
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer')
        AND is_active = true
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Post one approved PO into project_costs + project_cost_ledger (idempotent)
CREATE OR REPLACE FUNCTION public.post_purchase_order_costs(
  p_purchase_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_item public.purchase_order_items%ROWTYPE;
  v_qty_numeric NUMERIC;
BEGIN
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_purchase_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'purchase_order % not found', p_purchase_order_id;
  END IF;

  IF v_po.posted_to_costs THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT * FROM public.purchase_order_items
    WHERE purchase_order_id = p_purchase_order_id
    ORDER BY line_no
  LOOP
    BEGIN
      v_qty_numeric := NULLIF(
        regexp_replace(COALESCE(v_item.qty_text, ''), '[^0-9.]', '', 'g'),
        ''
      )::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_qty_numeric := NULL;
    END;

    INSERT INTO public.project_costs (
      project_id,
      cost_type,
      cost_category,
      description,
      quantity,
      unit,
      unit_cost,
      total_cost,
      cost_date,
      vendor_supplier,
      invoice_number,
      payment_status,
      notes,
      created_by
    ) VALUES (
      v_po.project_id,
      'material',
      'purchase_order',
      v_item.description,
      v_qty_numeric,
      v_item.qty_text,
      v_item.unit_price,
      v_item.line_total,
      v_po.po_date,
      COALESCE(v_po.vendor_snapshot->>'name', ''),
      v_po.po_number,
      'pending',
      'Auto-posted from PO ' || v_po.po_number,
      v_po.created_by
    );

    INSERT INTO public.project_cost_ledger (
      project_id,
      source_type,
      source_id,
      ledger_date,
      amount,
      status,
      notes,
      created_by
    ) VALUES (
      v_po.project_id,
      'purchase_order_item',
      v_item.id,
      v_po.po_date,
      v_item.line_total,
      'posted',
      'Auto-posted from PO ' || v_po.po_number || ' line ' || v_item.line_no,
      v_po.created_by
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END LOOP;

  -- Recompute project material total for consistency
  UPDATE public.projects p
  SET total_material_cost = COALESCE((
      SELECT SUM(pc.total_cost)
      FROM public.project_costs pc
      WHERE pc.project_id = p.id
        AND pc.cost_type = 'material'
    ), 0),
    updated_at = NOW()
  WHERE p.id = v_po.project_id;

  UPDATE public.purchase_orders
  SET posted_to_costs = TRUE,
      posted_at = NOW(),
      status = CASE WHEN status = 'approved' THEN 'posted' ELSE status END,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;
END;
$$;

-- Auto-post when PO status changes to approved
CREATE OR REPLACE FUNCTION public.trigger_post_purchase_order_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND COALESCE(OLD.status, '') <> NEW.status
     AND NEW.posted_to_costs = FALSE THEN
    PERFORM public.post_purchase_order_costs(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create PO + items in one call; optionally auto-post to costs
CREATE OR REPLACE FUNCTION public.create_purchase_order_with_items(
  p_project_id UUID,
  p_vendor_id UUID,
  p_po_number TEXT,
  p_po_date_text TEXT,
  p_requisitioner TEXT,
  p_requested_by TEXT,
  p_prepared_by TEXT,
  p_reviewed_by TEXT,
  p_approved_by TEXT,
  p_approved_by_title TEXT,
  p_project_title TEXT,
  p_deliver_to TEXT,
  p_vendor_snapshot JSONB,
  p_company_snapshot JSONB,
  p_payment_terms TEXT[],
  p_items JSONB,
  p_print_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_auto_post BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id UUID;
  v_company_id UUID;
  v_item JSONB;
  v_line_no INTEGER := 1;
  v_subtotal NUMERIC(14,2) := 0;
  v_line_total NUMERIC(14,2);
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'upper_management', 'hr', 'operations_manager', 'purchasing_officer') THEN
    RAISE EXCEPTION 'You are not allowed to create purchase orders.';
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1;

  IF p_po_number IS NULL OR btrim(p_po_number) = '' THEN
    RAISE EXCEPTION 'PO number is required.';
  END IF;

  INSERT INTO public.purchase_orders (
    company_id,
    project_id,
    vendor_id,
    po_number,
    po_date,
    po_date_text,
    status,
    requisitioner,
    requested_by,
    prepared_by,
    reviewed_by,
    approved_by,
    approved_by_title,
    project_title,
    deliver_to,
    payment_terms,
    vendor_snapshot,
    company_snapshot,
    print_timestamp,
    created_by
  ) VALUES (
    v_company_id,
    p_project_id,
    p_vendor_id,
    p_po_number,
    CURRENT_DATE,
    p_po_date_text,
    CASE WHEN p_auto_post THEN 'approved' ELSE 'draft' END,
    COALESCE(p_requisitioner, ''),
    COALESCE(p_requested_by, ''),
    COALESCE(p_prepared_by, ''),
    COALESCE(p_reviewed_by, ''),
    COALESCE(p_approved_by, ''),
    COALESCE(p_approved_by_title, ''),
    COALESCE(p_project_title, ''),
    COALESCE(p_deliver_to, ''),
    COALESCE(p_payment_terms, ARRAY[]::TEXT[]),
    COALESCE(p_vendor_snapshot, '{}'::jsonb),
    COALESCE(p_company_snapshot, '{}'::jsonb),
    p_print_timestamp,
    auth.uid()
  )
  RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line_total := COALESCE(
      NULLIF(v_item->>'lineTotal', '')::NUMERIC,
      NULLIF(v_item->>'totalAmount', '')::NUMERIC,
      0
    );

    INSERT INTO public.purchase_order_items (
      purchase_order_id,
      line_no,
      description,
      qty_text,
      unit_price,
      line_total
    ) VALUES (
      v_po_id,
      COALESCE(NULLIF(v_item->>'itemNo', '')::INTEGER, v_line_no),
      COALESCE(v_item->>'description', ''),
      COALESCE(v_item->>'qty', ''),
      COALESCE(NULLIF(v_item->>'unitPrice', '')::NUMERIC, 0),
      v_line_total
    );

    v_subtotal := v_subtotal + v_line_total;
    v_line_no := v_line_no + 1;
  END LOOP;

  UPDATE public.purchase_orders
  SET subtotal = v_subtotal,
      total_amount = v_subtotal,
      vat_amount = 0,
      updated_at = NOW()
  WHERE id = v_po_id;

  IF p_auto_post THEN
    PERFORM public.post_purchase_order_costs(v_po_id);
  END IF;

  RETURN v_po_id;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_order_items_updated_at ON public.purchase_order_items;
CREATE TRIGGER update_purchase_order_items_updated_at
  BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_auto_post_purchase_order_costs ON public.purchase_orders;
CREATE TRIGGER trigger_auto_post_purchase_order_costs
  AFTER UPDATE OF status ON public.purchase_orders
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND COALESCE(OLD.status, '') <> NEW.status AND NEW.posted_to_costs = FALSE)
  EXECUTE FUNCTION public.trigger_post_purchase_order_costs();