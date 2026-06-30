-- Default payee account name for subcontractor payments (auto-fills fund request bank details).
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS account_name text;

COMMENT ON COLUMN public.vendors.account_name IS
  'Default bank account name for subcontractor payments; editable per fund request.';
