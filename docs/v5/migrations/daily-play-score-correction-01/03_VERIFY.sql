-- Daily Play canonical score correction: post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Read-only. This implementation run did not apply Staging.

DO $$
DECLARE
  v_sig text := 'public.daily_play_correct_score(text,text,uuid,text,integer,integer,integer,text,text)';
  v_def text;
BEGIN
  IF to_regprocedure(v_sig) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_sig;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'daily_play_correct_score'
      AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig, ','), '') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: daily_play_correct_score is not SECURITY DEFINER with search_path=public';
  END IF;

  IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated EXECUTE missing on %', v_sig;
  END IF;
  IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon/PUBLIC can execute %', v_sig;
  END IF;

  -- Leases/ledger must remain client-ungranted. Do NOT treat pre-existing
  -- canonical_tournaments authenticated/anon UPDATE (from earlier cutover)
  -- as a failure of this additive package.
  IF has_table_privilege('anon', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_play_court_leases', 'SELECT')
     OR has_table_privilege('anon', 'public.daily_play_court_leases', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.daily_play_court_leases', 'UPDATE')
     OR has_table_privilege('anon', 'public.daily_play_command_ledger', 'SELECT')
     OR has_table_privilege('authenticated', 'public.daily_play_command_ledger', 'SELECT')
     OR has_table_privilege('anon', 'public.daily_play_command_ledger', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.daily_play_command_ledger', 'UPDATE') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unexpected direct table grants on Daily Play leases/ledger';
  END IF;

  v_def := pg_get_functiondef(v_sig::regprocedure);
  IF v_def NOT ILIKE '%VERSION_CONFLICT%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: CAS/VERSION_CONFLICT missing from correct_score';
  END IF;
  IF v_def NOT ILIKE '%scoreLog%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: scoreLog audit append missing from correct_score';
  END IF;
  IF v_def NOT ILIKE '%MATCH_NOT_COMPLETED%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: completed-only guard missing';
  END IF;
  IF v_def ILIKE '%INSERT INTO public.daily_play_court_leases%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: correction must not create court leases';
  END IF;
  IF v_def ILIKE '%rating%' AND v_def ILIKE '%recalc%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: correction must not recalculate rating/VPR';
  END IF;
  IF to_regprocedure('public.daily_play_submit_score(text,text,uuid,text,integer,integer,integer,text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: submit_score was removed';
  END IF;

  RAISE NOTICE 'VERIFY_OK: daily_play_correct_score signature, grants, CAS, and audit contract present';
END
$$;

SELECT
  'RPC_CORRECT_SCORE_AUTHENTICATED_ONLY' AS check_item,
  'daily_play_correct_score' AS value,
  has_function_privilege(
    'authenticated',
    'public.daily_play_correct_score(text,text,uuid,text,integer,integer,integer,text,text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.daily_play_correct_score(text,text,uuid,text,integer,integer,integer,text,text)',
    'EXECUTE'
  ) AS ok;

SELECT 'STAGING_APPLIED_BY_THIS_RUN' AS check_item, 'NO' AS value, true AS ok;
SELECT 'RATING_VPR_INTEGRATION' AS check_item, 'STILL_EXCLUDED_BY_DESIGN' AS value, true AS ok;
