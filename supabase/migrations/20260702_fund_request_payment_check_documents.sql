-- Payment check proofs uploaded by Upper Management on final approval.

ALTER TABLE public.fund_request_documents
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'supporting';

ALTER TABLE public.fund_request_documents
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fund_request_documents_document_type_check'
  ) THEN
    ALTER TABLE public.fund_request_documents
      ADD CONSTRAINT fund_request_documents_document_type_check
      CHECK (document_type IN ('supporting', 'payment_check'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fund_request_documents_type
  ON public.fund_request_documents(fund_request_id, document_type);
