-- Daily Play gender-normalizer prerequisite: post-apply verification.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.
-- Read-only.

DO $$
DECLARE
  v_reg text := 'public.team_tournament_normalize_gender_key(text)';
  v_oid oid;
  v_lang text;
  v_volatile "char";
  v_config text;
  v_overloads int;
  v_got text;
BEGIN
  IF to_regprocedure(v_reg) IS NULL THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing %', v_reg;
  END IF;

  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'team_tournament_normalize_gender_key';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unexpected overload count=%', v_overloads;
  END IF;

  SELECT p.oid, p.provolatile, coalesce(array_to_string(p.proconfig, ','), ''), l.lanname
  INTO v_oid, v_volatile, v_config, v_lang
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'team_tournament_normalize_gender_key';

  IF v_lang IS DISTINCT FROM 'sql' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: language is %, expected sql', v_lang;
  END IF;
  IF v_volatile IS DISTINCT FROM 'i' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: helper is not IMMUTABLE';
  END IF;
  IF v_config NOT ILIKE '%search_path=public%' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: search_path is not public';
  END IF;

  v_got := public.team_tournament_normalize_gender_key('Nam');
  IF v_got IS DISTINCT FROM 'male' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: Nam expected male, got %', v_got;
  END IF;
  IF public.team_tournament_normalize_gender_key('nam') IS DISTINCT FROM 'male'
     OR public.team_tournament_normalize_gender_key('male') IS DISTINCT FROM 'male'
     OR public.team_tournament_normalize_gender_key('M') IS DISTINCT FROM 'male' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: male alias contract failed';
  END IF;
  IF public.team_tournament_normalize_gender_key('Nữ') IS DISTINCT FROM 'female'
     OR public.team_tournament_normalize_gender_key('nu') IS DISTINCT FROM 'female'
     OR public.team_tournament_normalize_gender_key('female') IS DISTINCT FROM 'female'
     OR public.team_tournament_normalize_gender_key('F') IS DISTINCT FROM 'female'
     OR public.team_tournament_normalize_gender_key('n') IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: female alias contract failed';
  END IF;
  IF public.team_tournament_normalize_gender_key('other') IS DISTINCT FROM 'other'
     OR public.team_tournament_normalize_gender_key('khac') IS DISTINCT FROM 'other'
     OR public.team_tournament_normalize_gender_key('khác') IS DISTINCT FROM 'other' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: other alias contract failed';
  END IF;
  IF public.team_tournament_normalize_gender_key(NULL) IS DISTINCT FROM 'unknown'
     OR public.team_tournament_normalize_gender_key('') IS DISTINCT FROM 'unknown'
     OR public.team_tournament_normalize_gender_key('xyz') IS DISTINCT FROM 'unknown' THEN
    RAISE EXCEPTION 'VERIFY_FAIL: unknown fail-closed contract failed';
  END IF;

  RAISE NOTICE 'VERIFY_OK: team_tournament_normalize_gender_key contract present';
END
$$;

SELECT
  'HELPER_SIGNATURE' AS check_item,
  'team_tournament_normalize_gender_key(text)' AS value,
  to_regprocedure('public.team_tournament_normalize_gender_key(text)') IS NOT NULL AS ok;

SELECT 'PACKAGE_TABLE_CHANGES' AS check_item, 'NONE' AS value, true AS ok;
SELECT 'PACKAGE_DML' AS check_item, 'NONE' AS value, true AS ok;
SELECT 'VERIFY_MODE' AS check_item, 'READ_ONLY_CONTRACT' AS value, true AS ok;
