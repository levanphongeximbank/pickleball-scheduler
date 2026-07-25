-- =============================================================================
-- COACHING-02 — Append-only / immutability guards
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
-- Fixed search_path on all guard functions. Rollback drops these by name.
-- =============================================================================

SET search_path = public, pg_temp;

-- Attendance corrections: no UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.coaching_attendance_corrections_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'coaching_attendance_corrections is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS coaching_attendance_corrections_immutable_trg
  ON public.coaching_attendance_corrections;

CREATE TRIGGER coaching_attendance_corrections_immutable_trg
  BEFORE UPDATE OR DELETE ON public.coaching_attendance_corrections
  FOR EACH ROW
  EXECUTE FUNCTION public.coaching_attendance_corrections_immutable_guard();

-- Package usage events: no UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.coaching_package_usage_events_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'coaching_package_usage_events is append-only: UPDATE and DELETE are forbidden'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS coaching_package_usage_events_immutable_trg
  ON public.coaching_package_usage_events;

CREATE TRIGGER coaching_package_usage_events_immutable_trg
  BEFORE UPDATE OR DELETE ON public.coaching_package_usage_events
  FOR EACH ROW
  EXECUTE FUNCTION public.coaching_package_usage_events_immutable_guard();

-- Submitted evaluations: immutable (revisions = new rows)
CREATE OR REPLACE FUNCTION public.coaching_evaluations_submitted_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted coaching_evaluations cannot be deleted; create an explicit revision'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted coaching_evaluations are immutable; create an explicit revision'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coaching_evaluations_submitted_immutable_trg
  ON public.coaching_evaluations;

CREATE TRIGGER coaching_evaluations_submitted_immutable_trg
  BEFORE UPDATE OR DELETE ON public.coaching_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.coaching_evaluations_submitted_immutable_guard();

REVOKE ALL ON FUNCTION public.coaching_attendance_corrections_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_package_usage_events_immutable_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_evaluations_submitted_immutable_guard() FROM PUBLIC;
