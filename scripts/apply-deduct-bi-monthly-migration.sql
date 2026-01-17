-- Migration: Add deduct_bi_monthly column to employee_loans table
-- This allows loans to be configured for bi-monthly deduction (divided by 2) or monthly deduction (full amount)
-- Run this in Supabase SQL Editor if the column is missing

ALTER TABLE public.employee_loans
ADD COLUMN IF NOT EXISTS deduct_bi_monthly BOOLEAN DEFAULT true NOT NULL;

-- Add comment
COMMENT ON COLUMN public.employee_loans.deduct_bi_monthly IS 'If true, monthly payment is divided by 2 for bi-monthly deductions. If false, full monthly payment is deducted per cutoff.';

-- Update existing loans to default to bi-monthly (true) to maintain current behavior
UPDATE public.employee_loans
SET deduct_bi_monthly = true
WHERE deduct_bi_monthly IS NULL;
