-- Separate UM "return to purchasing" from final rejection audit fields.
ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS returned_by uuid,
ADD COLUMN IF NOT EXISTS returned_at timestamptz,
ADD COLUMN IF NOT EXISTS return_reason text;

COMMENT ON COLUMN public.fund_requests.returned_by IS 'Upper management user who returned the request for PO/OM review (not a final rejection).';
COMMENT ON COLUMN public.fund_requests.returned_at IS 'When upper management returned the request for PO/OM review.';
COMMENT ON COLUMN public.fund_requests.return_reason IS 'Reason upper management returned the request for PO/OM review.';
