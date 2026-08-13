-- ═══════════════════════════════════════════════════════════════════
-- 03_VERIFY.sql
-- Package: team-tournament-lineup-server-gender-canonical-01
-- Functional proofs — not body-string search only.
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- ═══════════════════════════════════════════════════════════════════

-- A) Function presence + grants
select
  'gender_resolver_present' as check_item,
  to_regprocedure('public.team_tournament_resolve_player_gender_key(text,text,text)') is not null as ok;

select
  'status_resolver_present' as check_item,
  to_regprocedure('public.team_tournament_resolve_player_status(text)') is not null as ok;

select
  'effective_gender_helper_present' as check_item,
  to_regprocedure('public.team_tournament_effective_lineup_gender_requirement(boolean,text,text,text,text)') is not null as ok;

select
  'validate_present' as check_item,
  to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null as ok;

select
  'gender_resolver_no_stale_profile_player_id' as check_item,
  (
    pg_get_functiondef('public.team_tournament_resolve_player_gender_key(text,text,text)'::regprocedure)
      not ilike '%p.player_id%'
    and pg_get_functiondef('public.team_tournament_resolve_player_gender_key(text,text,text)'::regprocedure)
      not ilike '%club_data_v3%'
    and pg_get_functiondef('public.team_tournament_resolve_player_gender_key(text,text,text)'::regprocedure)
      ilike '%athletes%'
  ) as ok;

select
  'status_resolver_uses_athletes' as check_item,
  (
    pg_get_functiondef('public.team_tournament_resolve_player_status(text)'::regprocedure)
      ilike '%athletes%'
    and pg_get_functiondef('public.team_tournament_resolve_player_status(text)'::regprocedure)
      not ilike '%p.player_id%'
  ) as ok;

select
  'validate_keeps_dreambreaker_skip' as check_item,
  (
    pg_get_functiondef('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)'::regprocedure)
      ilike '%DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION%'
  ) as ok;

-- B) F04 canonical gender resolve
select
  'f04_resolver_female' as check_item,
  public.team_tournament_resolve_player_gender_key(
    'c412a101-7e57-4000-8000-00000000000c',
    (select tenant_id from public.team_tournaments where tournament_id = 'team-tournament-4zllu71z' limit 1),
    (select club_id from public.team_tournaments where tournament_id = 'team-tournament-4zllu71z' limit 1)
  ) = 'female' as ok;

-- C) All #412 athletes resolve male/female (not unknown)
select
  'all_tt412_athletes_gender_resolved' as check_item,
  not exists (
    select 1
    from public.team_tournament_team_members m
    join public.team_tournament_teams tm on tm.id = m.team_id
    join public.team_tournaments tt on tt.id = tm.team_tournament_id
    where tt.tournament_id = 'team-tournament-4zllu71z'
      and public.team_tournament_resolve_player_gender_key(m.player_id, tt.tenant_id, tt.club_id)
          not in ('male', 'female')
  ) as ok;

-- D) Effective MLP gender inference for Đôi nữ / Đôi nam / mixed names
select
  'mlp_infer_female_doubles' as check_item,
  public.team_tournament_effective_lineup_gender_requirement(true, 'any', 'Đôi nữ', 'doubles', 'disc-0ot1sc1m') = 'female' as ok;

select
  'mlp_infer_male_doubles' as check_item,
  public.team_tournament_effective_lineup_gender_requirement(true, 'any', 'Đôi nam', 'doubles', 'disc-t6d3zebc') = 'male' as ok;

select
  'mlp_infer_mixed' as check_item,
  public.team_tournament_effective_lineup_gender_requirement(true, 'any', 'Đôi nam nữ', 'doubles', 'disc-05t8iukv') = 'mixed_pair' as ok;

-- E) Functional validate: F04+F08 female doubles draft PASS
select
  'validate_doi4_female_draft_pass' as check_item,
  (
    public.team_tournament_validate_lineup_selections(
      t,
      'team-3xnvw71s',
      'matchup-zivuolzv',
      jsonb_build_object(
        'disc-0ot1sc1m',
        jsonb_build_array(
          'c412a101-7e57-4000-8000-00000000000c',
          'c412a101-7e57-4000-8000-000000000010'
        )
      ),
      false
    )->>'ok'
  )::boolean as ok
from public.team_tournaments t
where t.tournament_id = 'team-tournament-4zllu71z'
limit 1;

-- F) Functional validate: males in Đôi nữ FAIL closed
select
  'validate_doi4_female_rejects_males' as check_item,
  (
    public.team_tournament_validate_lineup_selections(
      t,
      'team-3xnvw71s',
      'matchup-zivuolzv',
      jsonb_build_object(
        'disc-0ot1sc1m',
        jsonb_build_array(
          'c412a101-7e57-4000-8000-000000000002',
          'c412a101-7e57-4000-8000-000000000008'
        )
      ),
      false
    )->>'code'
  ) = 'invalid_gender' as ok
from public.team_tournaments t
where t.tournament_id = 'team-tournament-4zllu71z'
limit 1;

-- G) Full MLP draft + submit PASS for Đội 4
select
  'validate_doi4_full_mlp_draft_pass' as check_item,
  (
    public.team_tournament_validate_lineup_selections(
      t,
      'team-3xnvw71s',
      'matchup-zivuolzv',
      jsonb_build_object(
        'disc-t6d3zebc', jsonb_build_array('c412a101-7e57-4000-8000-000000000002','c412a101-7e57-4000-8000-000000000008'),
        'disc-0ot1sc1m', jsonb_build_array('c412a101-7e57-4000-8000-00000000000c','c412a101-7e57-4000-8000-000000000010'),
        'disc-05t8iukv', jsonb_build_array('c412a101-7e57-4000-8000-000000000002','c412a101-7e57-4000-8000-00000000000c'),
        'disc-cphujcgs', jsonb_build_array('c412a101-7e57-4000-8000-000000000008','c412a101-7e57-4000-8000-000000000010')
      ),
      false
    )->>'ok'
  )::boolean as ok
from public.team_tournaments t
where t.tournament_id = 'team-tournament-4zllu71z'
limit 1;

select
  'validate_doi4_full_mlp_submit_pass' as check_item,
  (
    public.team_tournament_validate_lineup_selections(
      t,
      'team-3xnvw71s',
      'matchup-zivuolzv',
      jsonb_build_object(
        'disc-t6d3zebc', jsonb_build_array('c412a101-7e57-4000-8000-000000000002','c412a101-7e57-4000-8000-000000000008'),
        'disc-0ot1sc1m', jsonb_build_array('c412a101-7e57-4000-8000-00000000000c','c412a101-7e57-4000-8000-000000000010'),
        'disc-05t8iukv', jsonb_build_array('c412a101-7e57-4000-8000-000000000002','c412a101-7e57-4000-8000-00000000000c'),
        'disc-cphujcgs', jsonb_build_array('c412a101-7e57-4000-8000-000000000008','c412a101-7e57-4000-8000-000000000010')
      ),
      true
    )->>'ok'
  )::boolean as ok
from public.team_tournaments t
where t.tournament_id = 'team-tournament-4zllu71z'
limit 1;

-- H) Wrong-team athlete FAIL
select
  'validate_wrong_team_athlete_fail' as check_item,
  (
    public.team_tournament_validate_lineup_selections(
      t,
      'team-3xnvw71s',
      'matchup-zivuolzv',
      jsonb_build_object(
        'disc-0ot1sc1m',
        jsonb_build_array(
          'c412a101-7e57-4000-8000-00000000000c',
          'c412a101-7e57-4000-8000-000000000009'
        )
      ),
      false
    )->>'code'
  ) = 'player_not_in_team' as ok
from public.team_tournaments t
where t.tournament_id = 'team-tournament-4zllu71z'
limit 1;

-- I) Save + Submit still share validate (body check)
select
  'save_calls_shared_validate' as check_item,
  (
    pg_get_functiondef('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)'::regprocedure)
      ilike '%team_tournament_validate_lineup_selections%'
  ) as ok;

select
  'submit_calls_shared_validate' as check_item,
  (
    pg_get_functiondef('public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)'::regprocedure)
      ilike '%team_tournament_validate_lineup_selections%'
  ) as ok;
