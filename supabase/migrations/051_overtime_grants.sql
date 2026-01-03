-- =====================================================
-- Grant anon/authenticated on overtime tables (for employee portal)
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_documents TO anon, authenticated;