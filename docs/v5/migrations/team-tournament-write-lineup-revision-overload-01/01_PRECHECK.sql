-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-write-lineup-revision-overload-01
-- Workstream: TEAM-TOURNAMENT-PR412-WRITE-LINEUP-REVISION-OVERLOAD-PACKAGE-LOCK-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only: inventory + grants baseline. No data mutation.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_has_12 boolean;
  v_has_13 boolean;
  v_save_def text;
  v_submit_def text;
  v_save_has_actor boolean;
  v_submit_has_actor boolean;
begin
  -- Exact target signatures present
  if to_regprocedure(
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)'
  ) is null then
    raise exception 'PRECHECK_FAIL: missing team_tournament_save_lineup_draft(6-arg)';
  end if;

  if to_regprocedure(
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)'
  ) is null then
    raise exception 'PRECHECK_FAIL: missing versioned team_tournament_submit_lineup(6-arg)';
  end if;

  select count(*)::int into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision';

  v_has_12 := to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)'
  ) is not null;
  v_has_13 := to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)'
  ) is not null;

  if v_count < 2 or not v_has_12 or not v_has_13 then
    raise exception
      'PRECHECK_FAIL: need stale 12-arg + canonical 13-arg (count=% has12=% has13=%)',
      v_count, v_has_12, v_has_13;
  end if;

  select pg_get_functiondef(p.oid) into v_save_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_save_lineup_draft'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  select pg_get_functiondef(p.oid) into v_submit_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_submit_lineup'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text';

  if v_save_def is null or position('team_tournament_write_lineup_revision' in v_save_def) = 0 then
    raise exception 'PRECHECK_FAIL: save_lineup_draft missing write_lineup_revision call';
  end if;

  if v_submit_def is null or position('team_tournament_write_lineup_revision' in v_submit_def) = 0 then
    raise exception 'PRECHECK_FAIL: versioned submit_lineup missing write_lineup_revision call';
  end if;

  v_save_has_actor :=
    position('''captain''::text' in v_save_def) > 0
    or position(', ''captain''' in v_save_def) > 0
    or position('''btc''::text' in v_save_def) > 0
    or position(', ''btc''' in v_save_def) > 0;

  v_submit_has_actor :=
    position('''captain''::text' in v_submit_def) > 0
    or position(', ''captain''' in v_submit_def) > 0
    or position('''btc''::text' in v_submit_def) > 0
    or position(', ''btc''' in v_submit_def) > 0;

  if v_save_has_actor then
    raise exception 'PRECHECK_FAIL: save_lineup_draft already passes actor_role (not ambiguous pre-state)';
  end if;

  if v_submit_has_actor then
    raise exception 'PRECHECK_FAIL: versioned submit_lineup already passes actor_role (not ambiguous pre-state)';
  end if;

  raise notice 'PRECHECK_OK: stale 12-arg + canonical 13-arg present; save+submit helper calls ambiguous';
end $$;

select
  'target_signatures' as check_item,
  to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)'
  ) is not null as stale_12arg_present,
  to_regprocedure(
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)'
  ) is not null as canonical_13arg_present,
  to_regprocedure(
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)'
  ) is not null as save_draft_6arg_present,
  to_regprocedure(
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)'
  ) is not null as submit_6arg_present;

select
  'caller_ambiguity_prestate' as check_item,
  (
    select
      position('team_tournament_write_lineup_revision' in pg_get_functiondef(p.oid)) > 0
      and position('''captain''::text' in pg_get_functiondef(p.oid)) = 0
      and position(', ''captain''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as save_draft_caller_ambiguous,
  (
    select
      position('team_tournament_write_lineup_revision' in pg_get_functiondef(p.oid)) > 0
      and position('''captain''::text' in pg_get_functiondef(p.oid)) = 0
      and position(', ''captain''' in pg_get_functiondef(p.oid)) = 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_submit_lineup'
      and pg_get_function_identity_arguments(p.oid)
        = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
  ) as versioned_submit_caller_ambiguous;

select
  'grants_baseline' as check_item,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)',
    'EXECUTE'
  ) as stale_12_auth_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)',
    'EXECUTE'
  ) as canonical_13_auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)',
    'EXECUTE'
  ) as stale_12_anon_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text,text)',
    'EXECUTE'
  ) as canonical_13_anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as save_auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as save_anon_exec,
  has_function_privilege(
    'authenticated',
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as submit_auth_exec,
  has_function_privilege(
    'anon',
    'public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)',
    'EXECUTE'
  ) as submit_anon_exec;

select
  'no_data_mutation' as check_item,
  true as ok;
