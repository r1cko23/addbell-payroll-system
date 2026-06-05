-- Link HR profile auth id to Melanie Sapinoso employee row for approver name resolution.
UPDATE public.employees
SET user_id = 'd8c2de99-1d65-432d-928f-5efaad8c1a55'
WHERE id = 'c74186df-5ee5-424e-aba1-aab9a2815d0f'
  AND user_id IS NULL;
