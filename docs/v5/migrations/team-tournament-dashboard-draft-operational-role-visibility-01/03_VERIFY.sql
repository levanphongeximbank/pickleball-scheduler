-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-dashboard-draft-operational-role-visibility-01
-- Functional role matrix — not body-string search only.
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

-- A) Presence + grants
select
  'can_view_helper_present' as check_item,
  to_regprocedure('public.team_tournament_can_view_dashboard(text,boolean,boolean,boolean)') is not null as ok;

select
  'dashboard_present' as check_item,
  to_regprocedure('public.team_tournament_get_dashboard(text)') is not null as ok;

select
  'anon_cannot_execute_dashboard' as check_item,
  not has_function_privilege('anon', 'public.team_tournament_get_dashboard(text)', 'execute') as ok;

-- B) Pure decision helper matrix
select
  'helper_draft_organizer_pass' as check_item,
  public.team_tournament_can_view_dashboard('draft', true, false, false) as ok;

select
  'helper_draft_captain_pass' as check_item,
  public.team_tournament_can_view_dashboard('draft', false, true, false) as ok;

select
  'helper_draft_deputy_pass' as check_item,
  public.team_tournament_can_view_dashboard('draft', false, true, false) as ok;

select
  'helper_draft_referee_pass' as check_item,
  public.team_tournament_can_view_dashboard('draft', false, false, true) as ok;

select
  'helper_draft_ordinary_deny' as check_item,
  public.team_tournament_can_view_dashboard('draft', false, false, false) = false as ok;

select
  'helper_registration_viewer_pass' as check_item,
  public.team_tournament_can_view_dashboard('registration', false, false, false) as ok;

select
  'helper_active_viewer_pass' as check_item,
  public.team_tournament_can_view_dashboard('active', false, false, false) as ok;

select
  'helper_cancelled_ordinary_deny' as check_item,
  public.team_tournament_can_view_dashboard('cancelled', false, false, false) = false as ok;

select
  'helper_cancelled_organizer_pass' as check_item,
  public.team_tournament_can_view_dashboard('cancelled', true, false, false) as ok;

-- C) Ordering: role resolve before DRAFT_NOT_VISIBLE in get_dashboard body
select
  'dashboard_roles_before_draft_gate' as check_item,
  (
    position('v_is_captain_or_deputy' in src) > 0
    and position('v_is_assigned_referee' in src) > 0
    and position('team_tournament_can_view_dashboard' in src) > 0
    and position('select t.external_team_id' in src)
        < position('DRAFT_NOT_VISIBLE' in src)
  ) as ok
from (
  select pg_get_functiondef('public.team_tournament_get_dashboard(text)'::regprocedure) as src
) s;

-- D) Functional auth-simulated matrix on Owner draft tournament
-- TT412 M04 captain user c412a001-…0004 / athlete c412a101-…0004 (Đội 4)
do $$
declare
  v_tid text := '7d1fe5a0-f312-4e4e-9869-53eff9383c54';
  v_cap jsonb;
  v_mem jsonb;
  v_x jsonb;
  v_anon jsonb;
begin
  if not exists (
    select 1 from public.team_tournaments where tournament_id = v_tid and lower(status) = 'draft'
  ) then
    raise exception 'VERIFY_FAIL: expected draft tournament %', v_tid;
  end if;

  -- Captain PASS
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', 'c412a001-7e57-4000-8000-000000000004',
      'role', 'authenticated'
    )::text,
    true
  );
  v_cap := public.team_tournament_get_dashboard(v_tid);
  if coalesce(v_cap->>'ok', 'false') <> 'true' then
    raise exception 'VERIFY_FAIL: draft captain expected PASS, got %', v_cap;
  end if;
  if coalesce(v_cap->'view'->'capabilities'->>'isCaptain', 'false') <> 'true' then
    raise exception 'VERIFY_FAIL: draft captain isCaptain expected true';
  end if;
  if coalesce(v_cap->'view'->'capabilities'->>'myTeamId', '') = '' then
    raise exception 'VERIFY_FAIL: draft captain myTeamId missing';
  end if;
  if coalesce((v_cap->'view'->'capabilities'->>'canOrganize')::boolean, false) then
    raise exception 'VERIFY_FAIL: captain must not gain canOrganize';
  end if;

  -- Ordinary team member DENY (M08 on Đội 4 — not captain/deputy)
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', 'c412a001-7e57-4000-8000-000000000008',
      'role', 'authenticated'
    )::text,
    true
  );
  v_mem := public.team_tournament_get_dashboard(v_tid);
  if coalesce(v_mem->>'code', '') <> 'DRAFT_NOT_VISIBLE' then
    raise exception 'VERIFY_FAIL: draft ordinary member expected DRAFT_NOT_VISIBLE, got %', v_mem;
  end if;

  -- Cross-tenant / unknown profile → DENY (fail closed)
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', '00000000-0000-4000-8000-ffffffffffff',
      'role', 'authenticated'
    )::text,
    true
  );
  v_x := public.team_tournament_get_dashboard(v_tid);
  if coalesce(v_x->>'code', '') not in ('CROSS_TENANT_DENIED', 'DRAFT_NOT_VISIBLE', 'NOT_AUTHENTICATED') then
    raise exception 'VERIFY_FAIL: unknown user expected deny, got %', v_x;
  end if;

  -- Unauthenticated
  perform set_config('request.jwt.claims', '{}', true);
  v_anon := public.team_tournament_get_dashboard(v_tid);
  if coalesce(v_anon->>'code', '') <> 'NOT_AUTHENTICATED' then
    raise exception 'VERIFY_FAIL: unauthenticated expected NOT_AUTHENTICATED, got %', v_anon;
  end if;

  raise notice 'VERIFY_OK: draft operational-role matrix (captain PASS / ordinary DENY)';
end;
$$;

select 'verify_script_completed' as check_item, true as ok;
