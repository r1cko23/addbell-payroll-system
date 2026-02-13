-- =====================================================
-- AUTO-LOG PROJECT PROGRESS HISTORY
-- =====================================================
-- Ensures any project progress_percentage change is reflected in project_progress,
-- even when updated outside the dedicated progress dialog.

CREATE OR REPLACE FUNCTION public.log_project_progress_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initial progress at creation (if non-zero)
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.progress_percentage, 0) > 0 THEN
      INSERT INTO public.project_progress (
        project_id,
        progress_date,
        progress_percentage,
        milestone,
        notes,
        created_by
      )
      SELECT
        NEW.id,
        CURRENT_DATE,
        NEW.progress_percentage,
        'Initial project progress',
        'Auto-recorded from project creation',
        auth.uid()
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.project_progress pp
        WHERE pp.project_id = NEW.id
          AND pp.progress_date = CURRENT_DATE
          AND pp.progress_percentage = NEW.progress_percentage
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Progress updates
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.progress_percentage, -1) <> COALESCE(NEW.progress_percentage, -1) THEN
    INSERT INTO public.project_progress (
      project_id,
      progress_date,
      progress_percentage,
      milestone,
      notes,
      created_by
    )
    SELECT
      NEW.id,
      CURRENT_DATE,
      NEW.progress_percentage,
      'Progress updated from '
        || TO_CHAR(COALESCE(OLD.progress_percentage, 0), 'FM999999990.00')
        || '% to '
        || TO_CHAR(COALESCE(NEW.progress_percentage, 0), 'FM999999990.00')
        || '%',
      'Auto-recorded from project update',
      auth.uid()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.project_progress pp
      WHERE pp.project_id = NEW.id
        AND pp.progress_date = CURRENT_DATE
        AND pp.progress_percentage = NEW.progress_percentage
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_project_progress_history ON public.projects;
CREATE TRIGGER trigger_log_project_progress_history
AFTER INSERT OR UPDATE OF progress_percentage
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_progress_history();
