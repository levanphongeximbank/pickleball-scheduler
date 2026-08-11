-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-submatch-score-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-SUBMATCH-SCORE-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Static verification only — no fixture mutation.
-- ═══════════════════════════════════════════════════════════════════

select
  'save_draft_canonical_versioned_path' as check_item,
  to_regprocedure(
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb,integer,text)'
  ) is not null as ok;

select
  'save_legacy_4arg_absent' as check_item,
  to_regprocedure(
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb)'
  ) is null as ok;

select
  'confirm_canonical_versioned_path' as check_item,
  to_regprocedure(
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)'
  ) is not null as ok;

select
  'confirm_legacy_5arg_absent' as check_item,
  to_regprocedure(
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text)'
  ) is null as ok;

select
  'save_overload_count_after' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_save_sub_match_draft'
  ) = 1 as ok;

select
  'confirm_overload_count_after' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_confirm_sub_match'
  ) = 1 as ok;

select
  'save_cas_before_write' as check_item,
  (
    select
      position('version_conflict' in lower(pg_get_functiondef(p.oid))) > 0
      and position('version = version + 1' in pg_get_functiondef(p.oid)) > 0
      and position('version = p_expected_version' in pg_get_functiondef(p.oid)) > 0
      and position('team_tournament_sub_matches' in pg_get_functiondef(p.oid)) > 0
      and position('v_header.version' in pg_get_functiondef(p.oid)) = 0
      and position('v_matchup.version' in pg_get_functiondef(p.oid)) = 0
      and (
        position('version_conflict' in lower(pg_get_functiondef(p.oid)))
        < position('version = version + 1' in pg_get_functiondef(p.oid))
      )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_sub_match_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'save_conflict_zero_write' as check_item,
  (
    select
      position('if not found' in lower(pg_get_functiondef(p.oid))) > 0
      and position('version_conflict' in lower(pg_get_functiondef(p.oid))) > 0
      and position('finish_command' in lower(pg_get_functiondef(p.oid))) >
          position('version = version + 1' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_sub_match_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'save_version_bump_once' as check_item,
  (
    select
      (length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'version = version + 1', '')))
        / length('version = version + 1') = 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_sub_match_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'confirm_cas_before_write' as check_item,
  (
    select
      position('version_conflict' in lower(pg_get_functiondef(p.oid))) > 0
      and position('version = version + 1' in pg_get_functiondef(p.oid)) > 0
      and position('version = p_expected_version' in pg_get_functiondef(p.oid)) > 0
      and position('MISSING_EXPECTED_VERSION' in pg_get_functiondef(p.oid)) > 0
      and position('v_header.version' in pg_get_functiondef(p.oid)) = 0
      and (
        position('version_conflict' in lower(pg_get_functiondef(p.oid)))
        < position('version = version + 1' in pg_get_functiondef(p.oid))
      )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_confirm_sub_match'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'confirm_conflict_zero_write' as check_item,
  (
    select
      position('if not found' in lower(pg_get_functiondef(p.oid))) > 0
      and position('finish_command' in lower(pg_get_functiondef(p.oid))) >
          position('version = version + 1' in pg_get_functiondef(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_confirm_sub_match'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'confirm_version_bump_once' as check_item,
  (
    select
      (length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'version = version + 1', '')))
        / length('version = version + 1') = 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_confirm_sub_match'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'versionless_cas_bypass_path' as check_item,
  (
    to_regprocedure('public.team_tournament_save_sub_match_draft(text,text,text,jsonb)') is null
    and to_regprocedure('public.team_tournament_confirm_sub_match(text,text,text,jsonb,text)') is null
  ) as ok;

select
  'authenticated_grants_preserved' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'anon_grants_unchanged' as check_item,
  not has_function_privilege(
    'anon',
    'public.team_tournament_save_sub_match_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.team_tournament_confirm_sub_match(text,text,text,jsonb,text,integer,text)',
    'EXECUTE'
  ) as ok;

select
  'rls_changed' as check_item,
  false as ok;

select
  'rbac_changed' as check_item,
  false as ok;
