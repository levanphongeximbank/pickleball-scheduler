-- CC-02D — Staging hardening patch (apply AFTER cc02-rating-v2 + cc02c-rating-durability)
-- Phase: CC-02D | STAGING ONLY until owner GO for production
-- Idempotent: safe to re-run

-- ─── Additional constraints on player_ratings ───
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_ratings_competition_match_count_nonneg'
  ) then
    alter table public.player_ratings
      add constraint player_ratings_competition_match_count_nonneg
      check (competition_match_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'player_ratings_public_skill_range'
  ) then
    alter table public.player_ratings
      add constraint player_ratings_public_skill_range
      check (public_skill_level is null or (public_skill_level >= 1.0 and public_skill_level <= 8.0));
  end if;
end $$;

-- ─── rating_history RLS (no direct client writes) ───
alter table public.rating_history enable row level security;

drop policy if exists rating_history_service_only on public.rating_history;
create policy rating_history_service_only on public.rating_history
  for all
  using (false)
  with check (false);

-- ─── Hardened RPC: advisory lock + authenticated director path ───
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
  v_jwt_role text;
begin
  v_jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  if v_jwt_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    null;
  elsif auth.uid() is not null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'platform_admin', 'club_admin', 'director')
    ) then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'not-authenticated';
  end if;

  if p_match_id is null or p_match_id = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-match-id');
  end if;

  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no-updates');
  end if;

  perform pg_advisory_xact_lock(hashtext('cc02c:rating:' || p_match_id));

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
grant execute on function public.competition_core_apply_match_rating_v2(text, text, text, jsonb, text) to authenticated;
