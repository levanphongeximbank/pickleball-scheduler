-- Official/Open authenticated referee discovery: READ-ONLY verify.
-- Does not create live rows or mutate Tournament business data.

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_list text;
  v_open text;
  v_identity text;
  v_authorize text;
  v_token_resolver text;
  v_current_guard text;
  v_ensure text;
  v_token_get text;
  v_token_adjust text;
  v_token_commit text;
  v_legacy_get text;
  v_legacy_update text;
  v_internal_ensure text;
  v_internal_commit text;
BEGIN
  IF to_regprocedure('public.official_open_referee_assignment_identity(jsonb,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_referee_assignment_identity');
  END IF;
  IF to_regprocedure('public.official_open_referee_assignment_authorized(jsonb,text,uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_referee_assignment_authorized');
  END IF;
  IF to_regprocedure('public.official_open_resolve_authorized_assignment_token(jsonb,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_resolve_authorized_assignment_token');
  END IF;
  IF to_regprocedure('public.official_open_assert_current_referee_token(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_assert_current_referee_token');
  END IF;
  IF to_regprocedure('public.official_open_list_my_referee_assignments()') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_list_my_referee_assignments');
  END IF;
  IF to_regprocedure('public.official_open_open_my_referee_match(uuid,text)') IS NULL THEN
    v_missing := array_append(v_missing, 'official_open_open_my_referee_match');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: missing: %', array_to_string(v_missing, ', ');
  END IF;

  IF has_function_privilege('anon', 'public.official_open_list_my_referee_assignments()', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute list RPC';
  END IF;
  IF has_function_privilege('anon', 'public.official_open_open_my_referee_match(uuid,text)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: anon must not execute open RPC';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.official_open_list_my_referee_assignments()',
    'execute'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated must execute list RPC';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.official_open_open_my_referee_match(uuid,text)',
    'execute'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: authenticated must execute open RPC';
  END IF;
  IF NOT has_function_privilege('anon', 'public.official_open_referee_get_match(text)', 'execute')
     OR NOT has_function_privilege('authenticated', 'public.official_open_referee_get_match(text)', 'execute')
     OR NOT has_function_privilege(
       'anon',
       'public.official_open_adjust_live_score(text,text,integer,integer,integer)',
       'execute'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'public.official_open_adjust_live_score(text,text,integer,integer,integer)',
       'execute'
     )
     OR NOT has_function_privilege(
       'anon',
       'public.official_open_commit_match_result(text,integer,integer,text)',
       'execute'
     )
     OR NOT has_function_privilege(
       'authenticated',
       'public.official_open_commit_match_result(text,integer,integer,text)',
       'execute'
     )
     OR NOT has_function_privilege('anon', 'public.referee_get_match_by_token(text)', 'execute')
     OR NOT has_function_privilege('authenticated', 'public.referee_get_match_by_token(text)', 'execute')
     OR NOT has_function_privilege('anon', 'public.referee_update_match_score(text,jsonb)', 'execute')
     OR NOT has_function_privilege('authenticated', 'public.referee_update_match_score(text,jsonb)', 'execute') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: token RPC grants changed unexpectedly';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.official_open_referee_assignment_identity(jsonb,text)',
    'execute'
  ) OR has_function_privilege(
    'anon',
    'public.official_open_referee_assignment_identity(jsonb,text)',
    'execute'
  ) OR has_function_privilege(
    'authenticated',
    'public.official_open_referee_assignment_authorized(jsonb,text,uuid,text)',
    'execute'
  ) OR has_function_privilege(
    'anon',
    'public.official_open_referee_assignment_authorized(jsonb,text,uuid,text)',
    'execute'
  ) OR has_function_privilege(
    'authenticated',
    'public.official_open_resolve_authorized_assignment_token(jsonb,text)',
    'execute'
  ) OR has_function_privilege(
    'anon',
    'public.official_open_resolve_authorized_assignment_token(jsonb,text)',
    'execute'
  ) OR has_function_privilege(
    'authenticated',
    'public.official_open_assert_current_referee_token(text)',
    'execute'
  ) OR has_function_privilege(
    'anon',
    'public.official_open_assert_current_referee_token(text)',
    'execute'
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: clients must not execute private assignment helpers';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'official_open_list_my_referee_assignments'
      AND p.prosecdef
      AND 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: list RPC SECURITY DEFINER/search_path';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'official_open_open_my_referee_match'
      AND p.prosecdef
      AND 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: open RPC SECURITY DEFINER/search_path';
  END IF;

  v_list := pg_get_functiondef(
    'public.official_open_list_my_referee_assignments()'::regprocedure
  );
  v_open := pg_get_functiondef(
    'public.official_open_open_my_referee_match(uuid,text)'::regprocedure
  );
  v_identity := pg_get_functiondef(
    'public.official_open_referee_assignment_identity(jsonb,text)'::regprocedure
  );
  v_authorize := pg_get_functiondef(
    'public.official_open_referee_assignment_authorized(jsonb,text,uuid,text)'::regprocedure
  );
  v_token_resolver := pg_get_functiondef(
    'public.official_open_resolve_authorized_assignment_token(jsonb,text)'::regprocedure
  );
  v_current_guard := pg_get_functiondef(
    'public.official_open_assert_current_referee_token(text)'::regprocedure
  );
  v_ensure := pg_get_functiondef(
    'public.official_open_ensure_match_live(text,text,uuid,text,jsonb)'::regprocedure
  );
  v_token_get := pg_get_functiondef(
    'public.official_open_referee_get_match(text)'::regprocedure
  );
  v_token_adjust := pg_get_functiondef(
    'public.official_open_adjust_live_score(text,text,integer,integer,integer)'::regprocedure
  );
  v_token_commit := pg_get_functiondef(
    'public.official_open_commit_match_result(text,integer,integer,text)'::regprocedure
  );
  v_legacy_get := pg_get_functiondef(
    'public.referee_get_match_by_token(text)'::regprocedure
  );
  v_legacy_update := pg_get_functiondef(
    'public.referee_update_match_score(text,jsonb)'::regprocedure
  );
  v_internal_ensure := pg_get_functiondef(
    'public.canonical_ensure_internal_referee_match_live(text)'::regprocedure
  );
  v_internal_commit := pg_get_functiondef(
    'public.canonical_commit_internal_referee_match_result(text,integer,integer,bigint)'::regprocedure
  );

  IF position('routeToken' in v_list) > 0
     OR position('to_jsonb(t)' in v_list) > 0
     OR position('referee_token' in v_list) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: list RPC must not expose token or canonical row';
  END IF;
  IF position('routeToken' in v_open) = 0
     OR position('official_open_referee_assignment_authorized' in v_open) = 0
     OR position('official_open_resolve_authorized_assignment_token' in v_open) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: open RPC must authorize exact assignment then return route token';
  END IF;
  IF position('v_canonical_user_id IS NOT NULL' in v_authorize) = 0
     OR position('v_stored_email = v_session_email' in v_authorize) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: canonical ID primary / exact email compatibility missing';
  END IF;
  IF position('refereeAssignments' in v_identity) = 0
     OR position('v_match' in v_identity) > 0
     OR position('v_roster' in v_identity) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: identity must come only from exact assignment record';
  END IF;
  IF position('ILIKE' in v_authorize) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: fuzzy referee identity matching is forbidden';
  END IF;
  IF position('official_open_assignment_token' in v_open) > 0
     OR position('official_open_assignment_token' in v_list) > 0
     OR position('official_open_assignment_token' in v_token_resolver) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: discovery package must not use legacy token precedence';
  END IF;
  IF position('refereeAssignments' in v_token_resolver) = 0
     OR position('ASSIGNMENT_TOKEN_MISSING' in v_token_resolver) = 0
     OR position('TOKEN_BINDING_INCONSISTENT' in v_token_resolver) = 0
     OR position('v_match_token IS DISTINCT FROM v_assignment_token' in v_token_resolver) = 0
     OR position('v_assignment_token IS DISTINCT FROM btrim(v_assignment_token)' in v_token_resolver) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: assignment-map token authority/fail-closed copy check missing';
  END IF;
  IF position('LIVE_TOKEN_BINDING_INCONSISTENT' in v_open) = 0
     OR position('referee_token = v_token' in v_open) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: open RPC must deny live token mismatch without rotation';
  END IF;
  IF position('ON CONFLICT DO NOTHING' in v_open) = 0
     OR position('FOR UPDATE' in v_open) = 0
     OR position('FOR SHARE' in v_open) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: open live ensure must lock canonical Tournament FOR UPDATE before live create';
  END IF;
  IF position('FOR UPDATE' in v_ensure) = 0
     OR position('FOR SHARE' in v_ensure) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: organizer live ensure must lock canonical Tournament FOR UPDATE before live create';
  END IF;
  IF position('refereeAssignments' in v_current_guard) = 0
     OR position('CURRENT_ASSIGNMENT_DENIED' in v_current_guard) = 0
     OR position('STALE_REFEREE_TOKEN' in v_current_guard) = 0
     OR position('TOKEN_BINDING_INCONSISTENT' in v_current_guard) = 0
     OR position('FOR UPDATE' in v_current_guard) = 0
     OR position('FOR SHARE' in v_current_guard) > 0
     OR position('FROM public.canonical_tournaments' in v_current_guard) = 0
     OR position('FOR UPDATE' in v_current_guard)
          < position('FROM public.canonical_tournaments' in v_current_guard)
     OR position('FROM public.tournament_match_live' in v_current_guard)
          > position('FROM public.canonical_tournaments' in v_current_guard) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: current-assignment token guard lock order is inverted or incomplete';
  END IF;
  IF position('official_open_assert_current_referee_token' in v_token_get) = 0
     OR position('official_open_assert_current_referee_token' in v_token_adjust) = 0
     OR position('official_open_assert_current_referee_token' in v_token_commit) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: Official token RPC bypasses current assignment guard';
  END IF;
  IF position('FROM public.canonical_tournaments' in v_token_commit) = 0
     OR position('FOR UPDATE' in v_token_commit)
          < position('FROM public.canonical_tournaments' in v_token_commit) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: commit RPC lock order is inverted';
  END IF;
  IF position('official_open_resolve_authorized_assignment_token' in v_ensure) = 0
     OR position('official_open_assignment_token' in v_ensure) > 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: organizer live ensure bypasses assignment-map token authority';
  END IF;
  IF position('mode = ''official_tournament''' in v_legacy_get) = 0
     OR position('NOT FOUND' in v_legacy_get) = 0
     OR position('mode = ''official_tournament''' in v_legacy_update) = 0
     OR position('NOT FOUND' in v_legacy_update) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: legacy token RPCs do not deny Official rows';
  END IF;
  IF position('mode = ''internal_tournament''' in v_internal_ensure) = 0
     OR position('mode = ''internal_tournament''' in v_internal_commit) = 0 THEN
    RAISE EXCEPTION 'VERIFY_FAIL: internal token RPCs are not mode-confined';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'official_open_referee_get_match',
        'official_open_ensure_match_live',
        'official_open_adjust_live_score',
        'official_open_commit_match_result',
        'referee_get_match_by_token',
        'referee_update_match_score',
        'official_open_assert_current_referee_token'
      )
      AND p.prosecdef
      AND 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
    GROUP BY n.nspname
    HAVING count(*) = 7
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAIL: hardened token surface SECURITY DEFINER/search_path';
  END IF;

  RAISE NOTICE 'VERIFY_OK: official-open-referee-discovery-01';
  RAISE NOTICE 'VERIFY_OK: CANONICAL_USER_ID_PRIMARY=YES';
  RAISE NOTICE 'VERIFY_OK: LEGACY_EMAIL_COMPATIBILITY=EXACT_NORMALIZED_ONLY';
  RAISE NOTICE 'VERIFY_OK: LIST_RPC_RETURNS_TOKEN=NO';
  RAISE NOTICE 'VERIFY_OK: VERIFY_TOKEN_BINDING_INVARIANT=YES';
  RAISE NOTICE 'VERIFY_OK: ASSIGNMENT_MAP_TOKEN_AUTHORITY=YES';
  RAISE NOTICE 'VERIFY_OK: TOKEN_BINDING_MISMATCH=DENY';
  RAISE NOTICE 'VERIFY_OK: VERIFY_IDENTITY_INVARIANT=YES';
  RAISE NOTICE 'VERIFY_OK: VERIFY_REVOCATION_INVARIANT=YES';
  RAISE NOTICE 'VERIFY_OK: LIVE_TOKEN_ALONE_AUTHORIZES_OFFICIAL=NO';
  RAISE NOTICE 'VERIFY_OK: OFFICIAL_TOKEN_RPC_SURFACE_COMPLETE=YES';
  RAISE NOTICE 'VERIFY_OK: OPEN_ENSURES_LIVE_ROW=YES';
  RAISE NOTICE 'VERIFY_OK: OPEN_CONCURRENT_DUPLICATE_LIVE_ROW=NO';
END;
$$;
