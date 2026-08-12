-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-lineup-server-gender-canonical-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- STAGING_MUTATIONS=0 until explicit GO.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_gender_hash text;
  v_status_hash text;
  v_validate_hash text;
begin
  if to_regclass('public.athletes') is null then
    raise exception 'PRECHECK_FAIL: public.athletes missing';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'PRECHECK_FAIL: public.profiles missing';
  end if;
  if to_regprocedure('public.team_tournament_resolve_player_gender_key(text,text,text)') is null then
    raise exception 'PRECHECK_FAIL: resolve_player_gender_key missing';
  end if;
  if to_regprocedure('public.team_tournament_resolve_player_status(text)') is null then
    raise exception 'PRECHECK_FAIL: resolve_player_status missing';
  end if;
  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is null then
    raise exception 'PRECHECK_FAIL: validate_lineup_selections missing';
  end if;
  if to_regprocedure('public.team_tournament_save_lineup_draft(text,text,text,jsonb,integer,text)') is null then
    raise exception 'PRECHECK_FAIL: save_lineup_draft CAS missing';
  end if;
  if to_regprocedure('public.team_tournament_submit_lineup(text,text,text,jsonb,integer,text)') is null then
    raise exception 'PRECHECK_FAIL: submit_lineup CAS missing';
  end if;

  select md5(pg_get_functiondef('public.team_tournament_resolve_player_gender_key(text,text,text)'::regprocedure))
    into v_gender_hash;
  select md5(pg_get_functiondef('public.team_tournament_resolve_player_status(text)'::regprocedure))
    into v_status_hash;
  select md5(pg_get_functiondef('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)'::regprocedure))
    into v_validate_hash;

  -- Fingerprints captured 2026-08-12 from Staging qyewbxjsiiyufanzcjcq before apply.
  if v_gender_hash is distinct from '820634f96175f548fb2ed3d110d527fa' then
    raise exception 'PRECHECK_FAIL: resolve_player_gender_key hash % != expected 820634f96175f548fb2ed3d110d527fa (re-review before apply)', v_gender_hash;
  end if;
  if v_status_hash is distinct from 'f628846265b3265affe1de639b9b9d3c' then
    raise exception 'PRECHECK_FAIL: resolve_player_status hash % != expected f628846265b3265affe1de639b9b9d3c (re-review before apply)', v_status_hash;
  end if;
  if v_validate_hash is distinct from '8de77cf4a4ea8031744c592815d548ae' then
    raise exception 'PRECHECK_FAIL: validate_lineup_selections hash % != expected 8de77cf4a4ea8031744c592815d548ae (re-review before apply)', v_validate_hash;
  end if;

  -- Prove stale authority class on known TT412 F04 athlete (read-only).
  if exists (
    select 1
    from public.athletes a
    join public.profiles p on p.id = a.user_id
    where a.id::text = 'c412a101-7e57-4000-8000-00000000000c'
      and public.team_tournament_normalize_gender_key(p.gender) = 'female'
      and public.team_tournament_resolve_player_gender_key(
            a.id::text,
            a.tenant_id,
            (select club_id from public.team_tournaments where tournament_id = 'team-tournament-4zllu71z' limit 1)
          ) is distinct from 'female'
  ) then
    raise notice 'PRECHECK_OK: F04 stale resolver confirmed (athletes→profiles female, resolver not female)';
  end if;

  raise notice 'PRECHECK_OK: fingerprints match; athletes/profiles present';
end;
$$;
