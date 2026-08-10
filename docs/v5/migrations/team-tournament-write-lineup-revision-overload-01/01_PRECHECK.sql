-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-write-lineup-revision-overload-01
-- Workstream: TEAM-TOURNAMENT-PR412-WRITE-LINEUP-REVISION-PRECHECK-FALSE-POSITIVE-FIX-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- Read-only: inventory + grants baseline. No data mutation.
--
-- Actor-role detection inspects ONLY the
-- perform ... team_tournament_write_lineup_revision(...) call site.
-- Do NOT match generic ", 'captain'" (INSERT source='captain' false positive).
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_count int;
  v_has_12 boolean;
  v_has_13 boolean;
  v_save_def text;
  v_submit_def text;
  v_save_call text;
  v_submit_call text;
  v_pos int;
  v_tail text;
  v_end int;
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

  -- Extract save perform write_lineup_revision(...) argument list only
  v_pos := position('perform public.team_tournament_write_lineup_revision(' in lower(v_save_def));
  if v_pos = 0 then
    v_pos := position('perform team_tournament_write_lineup_revision(' in lower(v_save_def));
    if v_pos > 0 then
      v_tail := substring(v_save_def from v_pos + length('perform team_tournament_write_lineup_revision('));
    end if;
  else
    v_tail := substring(v_save_def from v_pos + length('perform public.team_tournament_write_lineup_revision('));
  end if;
  if v_tail is null then
    raise exception 'PRECHECK_FAIL: save_lineup_draft missing perform write_lineup_revision call';
  end if;
  v_end := position(');' in v_tail);
  if v_end = 0 then
    v_save_call := v_tail;
  else
    v_save_call := substring(v_tail from 1 for v_end - 1);
  end if;

  -- Extract submit perform write_lineup_revision(...) argument list only
  v_tail := null;
  v_pos := position('perform public.team_tournament_write_lineup_revision(' in lower(v_submit_def));
  if v_pos = 0 then
    v_pos := position('perform team_tournament_write_lineup_revision(' in lower(v_submit_def));
    if v_pos > 0 then
      v_tail := substring(v_submit_def from v_pos + length('perform team_tournament_write_lineup_revision('));
    end if;
  else
    v_tail := substring(v_submit_def from v_pos + length('perform public.team_tournament_write_lineup_revision('));
  end if;
  if v_tail is null then
    raise exception 'PRECHECK_FAIL: versioned submit_lineup missing perform write_lineup_revision call';
  end if;
  v_end := position(');' in v_tail);
  if v_end = 0 then
    v_submit_call := v_tail;
  else
    v_submit_call := substring(v_tail from 1 for v_end - 1);
  end if;

  -- Explicit typed 13th actor_role only (never generic ", 'captain'" whole-body match)
  v_save_has_actor :=
    position('''captain''::text' in v_save_call) > 0
    or position('''btc''::text' in v_save_call) > 0;
  v_submit_has_actor :=
    position('''captain''::text' in v_submit_call) > 0
    or position('''btc''::text' in v_submit_call) > 0;

  if v_save_has_actor then
    raise exception 'PRECHECK_FAIL: save_lineup_draft write_lineup_revision already passes explicit actor_role';
  end if;

  if v_submit_has_actor then
    raise exception 'PRECHECK_FAIL: versioned submit_lineup write_lineup_revision already passes explicit actor_role';
  end if;

  raise notice 'PRECHECK_OK: stale 12-arg + canonical 13-arg present; save+submit helper calls ambiguous';
end $$;

select
  'target_signatures' as check_item,
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) as overload_count,
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

-- Call-site-only ambiguity evidence (no whole-function ", 'captain'" scan)
with defs as (
  select
    (
      select pg_get_functiondef(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'team_tournament_save_lineup_draft'
        and pg_get_function_identity_arguments(p.oid)
          = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
    ) as save_def,
    (
      select pg_get_functiondef(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'team_tournament_submit_lineup'
        and pg_get_function_identity_arguments(p.oid)
          = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text'
    ) as submit_def
),
calls as (
  select
    case
      when position('perform public.team_tournament_write_lineup_revision(' in lower(save_def)) > 0 then
        substring(
          save_def
          from position('perform public.team_tournament_write_lineup_revision(' in lower(save_def))
            + length('perform public.team_tournament_write_lineup_revision(')
        )
      when position('perform team_tournament_write_lineup_revision(' in lower(save_def)) > 0 then
        substring(
          save_def
          from position('perform team_tournament_write_lineup_revision(' in lower(save_def))
            + length('perform team_tournament_write_lineup_revision(')
        )
      else null
    end as save_call_tail,
    case
      when position('perform public.team_tournament_write_lineup_revision(' in lower(submit_def)) > 0 then
        substring(
          submit_def
          from position('perform public.team_tournament_write_lineup_revision(' in lower(submit_def))
            + length('perform public.team_tournament_write_lineup_revision(')
        )
      when position('perform team_tournament_write_lineup_revision(' in lower(submit_def)) > 0 then
        substring(
          submit_def
          from position('perform team_tournament_write_lineup_revision(' in lower(submit_def))
            + length('perform team_tournament_write_lineup_revision(')
        )
      else null
    end as submit_call_tail
  from defs
),
call_bodies as (
  select
    case
      when save_call_tail is null then null
      when position(');' in save_call_tail) > 0
        then substring(save_call_tail from 1 for position(');' in save_call_tail) - 1)
      else save_call_tail
    end as save_call,
    case
      when submit_call_tail is null then null
      when position(');' in submit_call_tail) > 0
        then substring(submit_call_tail from 1 for position(');' in submit_call_tail) - 1)
      else submit_call_tail
    end as submit_call
  from calls
)
select
  'caller_ambiguity_prestate' as check_item,
  save_call is not null
    and position('''captain''::text' in save_call) = 0
    and position('''btc''::text' in save_call) = 0 as save_draft_caller_ambiguous,
  submit_call is not null
    and position('''captain''::text' in submit_call) = 0
    and position('''btc''::text' in submit_call) = 0 as versioned_submit_caller_ambiguous,
  coalesce(
    save_call is not null
      and (
        position('''captain''::text' in save_call) > 0
        or position('''btc''::text' in save_call) > 0
      ),
    false
  ) as save_draft_explicit_actor_role_present,
  coalesce(
    submit_call is not null
      and (
        position('''captain''::text' in submit_call) > 0
        or position('''btc''::text' in submit_call) > 0
      ),
    false
  ) as submit_explicit_actor_role_present
from call_bodies;

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
