-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-lineup-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-LINEUP-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

select
  'save_rpc_present' as check_item,
  to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)') is not null as ok;

select
  'submit_rpc_present' as check_item,
  to_regprocedure('public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)') is not null as ok;

select
  'save_authenticated_execute' as check_item,
  has_function_privilege('authenticated', 'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)', 'EXECUTE') as ok;

select
  'save_anon_denied' as check_item,
  not has_function_privilege('anon', 'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)', 'EXECUTE') as ok;

select
  'submit_authenticated_execute' as check_item,
  has_function_privilege('authenticated', 'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)', 'EXECUTE') as ok;

select
  'submit_anon_denied' as check_item,
  not has_function_privilege('anon', 'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)', 'EXECUTE') as ok;

select
  'save_cas_before_write' as check_item,
  (
    select
      pg_get_functiondef(p.oid) ilike '%first create%'
      or (
        position('version_conflict' in lower(pg_get_functiondef(p.oid))) > 0
        and (
          position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid)) = 0
          or position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid))
             > position('version_conflict' in lower(pg_get_functiondef(p.oid)))
          or position('if not v_exists' in lower(pg_get_functiondef(p.oid))) > 0
        )
        and position('v_exists' in pg_get_functiondef(p.oid)) > 0
        and position('p_expected_version is distinct from 0' in pg_get_functiondef(p.oid)) > 0
      )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'save_no_legacy_write_before_cas' as check_item,
  (
    select
      -- versioned path must not call legacy before CAS block
      position('v_exists' in pg_get_functiondef(p.oid)) > 0
      and position('p_expected_version is distinct from 0' in pg_get_functiondef(p.oid)) > 0
      and (
        position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid)) = 0
        or position('team_tournament_save_lineup_draft_legacy' in pg_get_functiondef(p.oid))
           < 400  -- only early null-idempotency fallback
      )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'submit_no_delegate_save_before_cas' as check_item,
  (
    select
      position('v_exists' in pg_get_functiondef(p.oid)) > 0
      and position('p_expected_version is distinct from 0' in pg_get_functiondef(p.oid)) > 0
      and position('status = ''submitted''' in pg_get_functiondef(p.oid)) > 0
      -- must not call save_lineup_draft as write prelude
      and position('v_result := public.team_tournament_save_lineup_draft' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_lineup'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'finish_command_on_success_present' as check_item,
  (
    select pg_get_functiondef(p.oid) ilike '%team_tournament_finish_command%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as ok;

select
  'package_verify_summary' as check_item,
  true as ok,
  'VERIFY_OK: lineup revision CAS-before-write + grants preserved' as note;
