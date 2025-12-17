-- =====================================================
-- Overtime requests (filed by employee, approved by account manager)
-- Offset credits come ONLY from approved OT (1:1 hours)
-- =====================================================

-- Table
CREATE TABLE IF NOT EXISTS public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  account_manager_id UUID REFERENCES public.users(id),
  ot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours NUMERIC NOT NULL CHECK (total_hours > 0),
  reason TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id)
);

-- Timestamp trigger
DROP TRIGGER IF EXISTS trg_overtime_requests_updated ON public.overtime_requests;
CREATE TRIGGER trg_overtime_requests_updated
  BEFORE UPDATE ON public.overtime_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

-- Employees: view own, insert own
CREATE POLICY "Employees can view own OT requests" ON public.overtime_requests
  FOR SELECT USING (auth.uid() IS NOT NULL AND employee_id = auth.uid());
CREATE POLICY "Employees can insert own OT requests" ON public.overtime_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND employee_id = auth.uid());

-- Account managers & admins: view/manage all
CREATE POLICY "Account managers/admin can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );
CREATE POLICY "Account managers/admin can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

-- RPC: approve OT (account manager/admin only); increments offset_hours 1:1
CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.overtime_requests;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role NOT IN ('account_manager','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_req FROM public.overtime_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN;
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid()
  WHERE id = p_request_id;

  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;

-- RPC: reject OT
CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role NOT IN ('account_manager','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_overtime_request(UUID, TEXT) TO authenticated;

-- Reset offset balances so only approved OT funds them
UPDATE public.employees SET offset_hours = 0;
