-- Migration 146: Add deduct_bi_monthly column to employee_loans table
-- Execute this via Supabase MCP or SQL Editor

ALTER TABLE public.employee_loans
ADD COLUMN IF NOT EXISTS deduct_bi_monthly BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN public.employee_loans.deduct_bi_monthly IS 'If true, monthly payment is divided by 2 for bi-monthly deductions. If false, full monthly payment is deducted per cutoff.';

UPDATE public.employee_loans
SET deduct_bi_monthly = true
WHERE deduct_bi_monthly IS NULL;
