-- Daily Play Production prerequisite: gender-key normalizer extraction.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Read-only. STAGING_MUTATIONS=0. PRODUCTION_MUTATIONS=0.
--
-- Expected:
--   Staging: helper PRESENT and semantically compatible.
--   Production: helper ABSENT.
--
-- If ABSENT → PRECHECK_PASS_MISSING_EXPECTED (safe to APPLY).
-- If PRESENT and exact established semantics → PRECHECK_PASS_ALREADY_COMPATIBLE.
-- If PRESENT but semantics differ → FAIL CLOSED. Do not overwrite.

DO $$
DECLARE
  v_reg text := 'public.team_tournament_normalize_gender_key(text)';
  v_oid oid;
  v_def text;
  v_norm text;
  v_lang text;
  v_volatile "char";
  v_config text;
  v_overloads int;
  v_dependents int;
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: PostgreSQL environment is not usable';
  END IF;

  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'team_tournament_normalize_gender_key';

  IF v_overloads = 0 THEN
    RAISE NOTICE 'PRECHECK_PASS_MISSING_EXPECTED: % is absent', v_reg;
    RETURN;
  END IF;

  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unexpected overload count=% for %', v_overloads, v_reg;
  END IF;

  IF to_regprocedure(v_reg) IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper exists but signature is not %(text)', v_reg;
  END IF;

  SELECT p.oid, p.provolatile, coalesce(array_to_string(p.proconfig, ','), ''), l.lanname
  INTO v_oid, v_volatile, v_config, v_lang
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'team_tournament_normalize_gender_key'
    AND pg_get_function_identity_arguments(p.oid) = 'p_gender text';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper present with unexpected argument name/signature';
  END IF;

  v_def := pg_get_functiondef(v_oid);
  v_norm := regexp_replace(v_def, E'[\\n\\r\\t ]+', ' ', 'g');

  IF v_lang IS DISTINCT FROM 'sql' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper language is %, expected sql', v_lang;
  END IF;
  IF v_volatile IS DISTINCT FROM 'i' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper is not IMMUTABLE';
  END IF;
  IF v_config NOT ILIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper search_path is not public';
  END IF;

  IF v_norm NOT ILIKE $p$%when lower(trim(coalesce(p_gender, ''))) in ('nam', 'male', 'm') then 'male'%$p$ THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: male alias contract differs from established helper';
  END IF;
  IF v_norm NOT ILIKE $p$%when lower(trim(coalesce(p_gender, ''))) in ('nữ', 'nu', 'female', 'f', 'n') then 'female'%$p$ THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: female alias contract differs from established helper';
  END IF;
  IF v_norm NOT ILIKE $p$%when lower(trim(coalesce(p_gender, ''))) in ('other', 'khac', 'khác') then 'other'%$p$ THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: other alias contract differs from established helper';
  END IF;
  IF v_norm NOT ILIKE $p$%else 'unknown'%$p$ THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: unknown fallback missing';
  END IF;
  IF v_norm ILIKE $p$%'boy'%$p$ OR v_norm ILIKE $p$%'man'%$p$ OR v_norm ILIKE $p$%'woman'%$p$ THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: helper contains aliases outside the established contract';
  END IF;

  SELECT count(*) INTO v_dependents
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid <> v_oid
    AND pg_get_functiondef(p.oid) ILIKE '%team_tournament_normalize_gender_key%';

  RAISE NOTICE 'PRECHECK_PASS_ALREADY_COMPATIBLE: % present; dependents=%', v_reg, v_dependents;
END
$$;

SELECT 'STAGING_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'PRODUCTION_MUTATIONS' AS check_item, 0 AS value, true AS ok;
SELECT 'DO_NOT_APPLY_WITHOUT_OWNER_GO' AS check_item, 'YES' AS value, true AS ok;
SELECT
  'HELPER_STATE' AS check_item,
  CASE
    WHEN to_regprocedure('public.team_tournament_normalize_gender_key(text)') IS NULL
      THEN 'ABSENT'
    ELSE 'PRESENT'
  END AS value,
  true AS ok;
