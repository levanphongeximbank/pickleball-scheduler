-- CC-02C — Rating durability: idempotency + atomic RPC
-- Phase: CC-02C | NOT FOR STAGING/PRODUCTION APPLY without owner GO
-- Depends on: supabase-cc02-rating-v2.sql (player_ratings, rating_history)

-- ─── rating_applications (durable idempotency SSOT) ───
create table if not exists public.rating_applications (
  id text primary key default gen_random_uuid()::text,
  match_id text not null,
  player_id text not null,
  rating_type text not null default 'competition_elo',
  applied_at timestamptz not null default now(),
  engine_version text not null default 'competition-core-rating-v2-cc02c',
  before_rating numeric(8, 2) not null,
  after_rating numeric(8, 2) not null,
  tenant_id text,
  tournament_id text,
  unique (match_id, player_id, rating_type)
);

create index if not exists rating_applications_match_idx
  on public.rating_applications (match_id);

create index if not exists rating_applications_player_idx
  on public.rating_applications (player_id, rating_type, applied_at desc);

-- ─── RLS: players cannot self-update competition_elo ───
alter table public.player_ratings enable row level security;

drop policy if exists player_ratings_select_own on public.player_ratings;
create policy player_ratings_select_own on public.player_ratings
  for select
  using (
    auth.uid() is not null
    and (
      auth_user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('super_admin', 'platform_admin', 'club_admin', 'director')
      )
    )
  );

drop policy if exists player_ratings_no_direct_competition_elo_update on public.player_ratings;
create policy player_ratings_no_direct_competition_elo_update on public.player_ratings
  for update
  using (false)
  with check (false);

alter table public.rating_applications enable row level security;

drop policy if exists rating_applications_service_only on public.rating_applications;
create policy rating_applications_service_only on public.rating_applications
  for all
  using (false)
  with check (false);

-- ─── Atomic apply RPC (single transaction) ───
create or replace function public.competition_core_apply_match_rating_v2(
  p_match_id text,
  p_tenant_id text,
  p_tournament_id text,
  p_updates jsonb,
  p_engine_version text default 'competition-core-rating-v2-cc02c'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update jsonb;
  v_player_id text;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  v_player_rating_id text;
  v_existing int;
begin
  if p_match_id is null or p_match_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-match-id');
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no-updates');
  end if;

  -- Idempotency: any existing application for this match blocks re-apply
  select count(*) into v_existing
  from public.rating_applications
  where match_id = p_match_id
    and rating_type = 'competition_elo';

  if v_existing > 0 then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already-applied', 'idempotent', true);
  end if;

  for v_update in select * from jsonb_array_elements(p_updates)
  loop
    v_player_id := v_update->>'playerId';
    v_before := (v_update->>'previousRating')::numeric;
    v_after := (v_update->>'nextRating')::numeric;
    v_delta := coalesce((v_update->>'delta')::numeric, v_after - v_before);

    if v_player_id is null or v_player_id = '' then
      raise exception 'invalid-player-id';
    end if;

    select id into v_player_rating_id
    from public.player_ratings
    where player_id = v_player_id
      and (tenant_id is not distinct from p_tenant_id)
    for update;

    if v_player_rating_id is null then
      raise exception 'player-rating-not-found:%', v_player_id;
    end if;

    update public.player_ratings
    set
      competition_elo = v_after,
      competition_match_count = competition_match_count + 1,
      updated_at = now()
    where id = v_player_rating_id;

    insert into public.rating_history (
      id,
      player_rating_id,
      field_name,
      previous_value,
      next_value,
      delta,
      source,
      match_id,
      tournament_id,
      reason
    ) values (
      gen_random_uuid()::text,
      v_player_rating_id,
      'competition_elo',
      v_before,
      v_after,
      v_delta,
      'competition-core-rating-v2',
      p_match_id,
      p_tournament_id,
      'match_completed'
    );

    insert into public.rating_applications (
      match_id,
      player_id,
      rating_type,
      engine_version,
      before_rating,
      after_rating,
      tenant_id,
      tournament_id
    ) values (
      p_match_id,
      v_player_id,
      'competition_elo',
      coalesce(p_engine_version, 'competition-core-rating-v2-cc02c'),
      v_before,
      v_after,
      p_tenant_id,
      p_tournament_id
    );
  end loop;

  return jsonb_build_object('ok', true, 'skipped', false, 'applied', jsonb_array_length(p_updates));
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already-applied', 'idempotent', true);
  when others then
    raise;
end;
$$;

revoke all on function public.competition_core_apply_match_rating_v2(text, text, text, jsonb, text) from public;
grant execute on function public.competition_core_apply_match_rating_v2(text, text, text, jsonb, text) to service_role;

-- ─── Verification queries ───
-- select count(*) from public.rating_applications;
-- select conname from pg_constraint where conrelid = 'public.rating_applications'::regclass;

-- Duplicate apply should return idempotent skip:
-- select public.competition_core_apply_match_rating_v2(
--   'm-test-1', 'tenant-a', 't1',
--   '[{"playerId":"p1","previousRating":1500,"nextRating":1510,"delta":10}]'::jsonb
-- );

-- ─── Rollback (CC-02C only) ───
-- drop function if exists public.competition_core_apply_match_rating_v2(text, text, text, jsonb, text);
-- drop table if exists public.rating_applications;
