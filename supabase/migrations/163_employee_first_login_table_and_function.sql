-- Employee first login tracking: table + RPC for record_employee_first_login
-- Used by /api/employee/first-login and Audit > First Login tab

CREATE TABLE IF NOT EXISTS public.employee_first_login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  first_login_time timestamptz NOT NULL DEFAULT now(),
  first_logout_time timestamptz,
  ip_address text,
  device_info text,
  user_agent text,
  browser_name text,
  browser_version text,
  os_name text,
  os_version text,
  device_type text,
  mac_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_first_login_employee_id
  ON public.employee_first_login(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_first_login_first_login_time
  ON public.employee_first_login(first_login_time DESC);

COMMENT ON TABLE public.employee_first_login IS 'Tracks first portal login per employee and optional logout time';

-- RPC: record first login (device info) or record logout (when device params are null)
CREATE OR REPLACE FUNCTION public.record_employee_first_login(
  p_employee_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_info text DEFAULT NULL,
  p_browser_name text DEFAULT NULL,
  p_browser_version text DEFAULT NULL,
  p_os_name text DEFAULT NULL,
  p_os_version text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_mac_address text DEFAULT NULL
)
RETURNS TABLE(success boolean, is_first_login boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Logout: only employee_id (and optionally null mac) — update latest row without logout time
  IF p_user_agent IS NULL AND p_ip_address IS NULL AND p_device_info IS NULL THEN
    UPDATE public.employee_first_login e
    SET first_logout_time = now(), updated_at = now()
    FROM (
      SELECT id FROM public.employee_first_login
      WHERE employee_id = p_employee_id AND first_logout_time IS NULL
      ORDER BY first_login_time DESC
      LIMIT 1
    ) sub
    WHERE e.id = sub.id;
    RETURN QUERY SELECT true, false, 'Logout recorded'::text;
    RETURN;
  END IF;

  -- Login: check if we already have any first-login record for this employee
  SELECT EXISTS(
    SELECT 1 FROM public.employee_first_login WHERE employee_id = p_employee_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN QUERY SELECT true, false, 'Login recorded (not first)'::text;
    RETURN;
  END IF;

  -- First login: insert
  INSERT INTO public.employee_first_login (
    employee_id,
    first_login_time,
    ip_address,
    device_info,
    user_agent,
    browser_name,
    browser_version,
    os_name,
    os_version,
    device_type,
    mac_address,
    updated_at
  ) VALUES (
    p_employee_id,
    now(),
    p_ip_address,
    p_device_info,
    p_user_agent,
    p_browser_name,
    p_browser_version,
    p_os_name,
    p_os_version,
    p_device_type,
    p_mac_address,
    now()
  );

  RETURN QUERY SELECT true, true, 'First login recorded'::text;
END;
$$;

COMMENT ON FUNCTION public.record_employee_first_login IS 'Records first portal login with device info, or records logout when called with only employee_id (no device params)';
