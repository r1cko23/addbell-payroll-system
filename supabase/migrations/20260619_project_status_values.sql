UPDATE public.projects
SET status = 'pending'
WHERE status = 'planned';

UPDATE public.projects
SET status = 'on_hold'
WHERE status IN ('on-hold', 'cancelled');

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'pending', 'on_hold', 'completed'));
