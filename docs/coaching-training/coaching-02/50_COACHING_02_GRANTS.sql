-- =============================================================================
-- COACHING-02 — Grants (fail-closed)
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
-- No PUBLIC write. No anon write/execute. Table DML via authenticated + RLS.
-- Atomic RPCs: EXECUTE for authenticated + service_role after REVOKE PUBLIC.
-- =============================================================================

SET search_path = public, pg_temp;

-- Table privileges: revoke broad, grant scoped DML to authenticated only
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'coaching_programs',
    'coaching_coach_references',
    'coaching_coach_player_relationships',
    'coaching_enrollments',
    'coaching_curricula',
    'coaching_lessons',
    'coaching_training_sessions',
    'coaching_attendance_records',
    'coaching_attendance_corrections',
    'coaching_packages',
    'coaching_package_entitlements',
    'coaching_package_usage_events',
    'coaching_evaluations'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated',
      t
    );
    -- Append-only tables: still GRANT UPDATE at table level is harmless because
    -- RLS has no UPDATE policy and immutability triggers block mutations.
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Explicitly ensure anon has no table privileges
REVOKE ALL ON TABLE public.coaching_programs FROM anon;
REVOKE ALL ON TABLE public.coaching_coach_references FROM anon;
REVOKE ALL ON TABLE public.coaching_coach_player_relationships FROM anon;
REVOKE ALL ON TABLE public.coaching_enrollments FROM anon;
REVOKE ALL ON TABLE public.coaching_curricula FROM anon;
REVOKE ALL ON TABLE public.coaching_lessons FROM anon;
REVOKE ALL ON TABLE public.coaching_training_sessions FROM anon;
REVOKE ALL ON TABLE public.coaching_attendance_records FROM anon;
REVOKE ALL ON TABLE public.coaching_attendance_corrections FROM anon;
REVOKE ALL ON TABLE public.coaching_packages FROM anon;
REVOKE ALL ON TABLE public.coaching_package_entitlements FROM anon;
REVOKE ALL ON TABLE public.coaching_package_usage_events FROM anon;
REVOKE ALL ON TABLE public.coaching_evaluations FROM anon;

-- RPC execute
REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coaching_apply_attendance_correction(
  text, text, text, integer, text, text, text, text, timestamptz, text
) TO service_role;

REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
) FROM anon;
GRANT EXECUTE ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coaching_consume_entitlement(
  text, text, text, integer, text, text, text, text, timestamptz
) TO service_role;
