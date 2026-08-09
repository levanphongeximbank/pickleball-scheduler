-- ═══════════════════════════════════════════════════════════════════
-- Dreambreaker activation + recompute + confirm_sub_match patch
-- Package: team-tournament-dreambreaker-advancement-canonical-remediation-01
-- Idempotent. DO NOT APPLY without Owner GO.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.team_tournament_dreambreaker_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid not null unique references public.team_tournament_matchups(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','lineup_open','ready','in_progress','completed')),
  team_a_order jsonb not null default '[]'::jsonb,
  team_b_order jsonb not null default '[]'::jsonb,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  winner_team_id text,
  order_lock_at timestamptz,
  orders_locked_at timestamptz,
  order_source_a text,
  order_source_b text,
  rotation jsonb not null default '{}'::jsonb,
  sub_match_external_id text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.team_tournament_dreambreaker_states enable row level security;

-- ─── Recompute: main disciplines only; never complete without winner ─
create or replace function public.team_tournament_recompute_matchup_result(
  p_matchup_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_matchup public.team_tournament_matchups;
  v_header public.team_tournaments;
  v_team_a_wins int := 0;
  v_team_b_wins int := 0;
  v_team_a_points int := 0;
  v_team_b_points int := 0;
  v_winner text := null;
  v_all_main_finalized boolean := true;
  v_main_total int := 0;
  v_main_finalized int := 0;
  v_needs_db boolean := false;
  v_db_enabled boolean := true;
begin
  select * into v_matchup from public.team_tournament_matchups where id = p_matchup_id;
  if v_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_header
  from public.team_tournaments t
  where t.id = v_matchup.team_tournament_id;

  v_db_enabled := coalesce((v_header.settings->>'dreambreakerEnabled')::boolean, true);

  select
    count(*) filter (
      where sm.status in ('completed', 'forfeit') and sm.winner_team_id = v_matchup.team_a_id
    ),
    count(*) filter (
      where sm.status in ('completed', 'forfeit') and sm.winner_team_id = v_matchup.team_b_id
    ),
    coalesce(sum((sm.score->>'teamA')::int) filter (where sm.status in ('completed', 'forfeit')), 0),
    coalesce(sum((sm.score->>'teamB')::int) filter (where sm.status in ('completed', 'forfeit')), 0),
    count(*),
    count(*) filter (where sm.status in ('completed', 'forfeit'))
  into v_team_a_wins, v_team_b_wins, v_team_a_points, v_team_b_points, v_main_total, v_main_finalized
  from public.team_tournament_sub_matches sm
  left join public.team_tournament_disciplines d
    on d.team_tournament_id = v_matchup.team_tournament_id
   and d.external_discipline_id = sm.discipline_external_id
  where sm.matchup_id = p_matchup_id
    and coalesce(lower(d.name), '') not like '%dreambreaker%'
    and coalesce(lower(d.external_discipline_id), '') not like '%dreambreaker%'
    and coalesce(lower(d.discipline_kind), '') not like '%dreambreaker%'
    and coalesce(lower(d.activation_rule), '') <> 'dreambreaker'
    and not exists (
      select 1
      from public.team_tournament_dreambreaker_states db
      where db.matchup_id = p_matchup_id
        and nullif(trim(coalesce(db.sub_match_external_id, '')), '') = sm.external_sub_match_id
    );

  v_all_main_finalized := v_main_total > 0 and v_main_finalized = v_main_total;

  v_needs_db :=
    v_db_enabled
    and v_all_main_finalized
    and v_team_a_wins = 2
    and v_team_b_wins = 2;

  if not v_needs_db then
    if v_team_a_wins > v_team_b_wins then
      v_winner := v_matchup.team_a_id;
    elsif v_team_b_wins > v_team_a_wins then
      v_winner := v_matchup.team_b_id;
    end if;
  end if;

  -- Dreambreaker sub-match winner overrides when completed
  if exists (
    select 1
    from public.team_tournament_dreambreaker_states db
    join public.team_tournament_sub_matches sm
      on sm.matchup_id = db.matchup_id
     and sm.external_sub_match_id = db.sub_match_external_id
    where db.matchup_id = p_matchup_id
      and db.status = 'completed'
      and nullif(trim(coalesce(db.winner_team_id, '')), '') is not null
  ) then
    select db.winner_team_id into v_winner
    from public.team_tournament_dreambreaker_states db
    where db.matchup_id = p_matchup_id;
    v_needs_db := false;
  end if;

  update public.team_tournament_matchups set
    result = jsonb_build_object(
      'teamAWins', v_team_a_wins,
      'teamBWins', v_team_b_wins,
      'teamAPoints', v_team_a_points,
      'teamBPoints', v_team_b_points,
      'winnerTeamId', v_winner,
      'needsDreambreaker', v_needs_db
    ),
    status = case
      when v_winner is not null and (v_all_main_finalized or not v_needs_db)
           and not v_needs_db
        then 'completed'
      when status = 'published' then 'in_progress'
      when v_needs_db then 'in_progress'
      else status
    end,
    standings_recalc_required = true,
    updated_at = now()
  where id = p_matchup_id;

  return jsonb_build_object(
    'ok', true,
    'teamAWins', v_team_a_wins,
    'teamBWins', v_team_b_wins,
    'teamAPoints', v_team_a_points,
    'teamBPoints', v_team_b_points,
    'winnerTeamId', v_winner,
    'needsDreambreaker', v_needs_db,
    'matchupCompleted', v_winner is not null and not v_needs_db and v_all_main_finalized
  );
end;
$$;

-- ─── Durable Dreambreaker activation ───────────────────────────────
create or replace function public.team_tournament_maybe_activate_dreambreaker(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_existing public.team_tournament_dreambreaker_states;
  v_lock_at timestamptz;
  v_enabled boolean := true;
begin
  if p_header.id is null or p_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'activated', false);
  end if;

  v_enabled := coalesce((p_header.settings->>'dreambreakerEnabled')::boolean, true);
  if not v_enabled then
    return jsonb_build_object('ok', true, 'activated', false, 'code', 'DISABLED');
  end if;

  v_result := public.team_tournament_recompute_matchup_result(p_matchup.id);
  if not coalesce((v_result->>'needsDreambreaker')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'activated', false,
      'matchupId', p_matchup.external_matchup_id,
      'matchupResult', v_result
    );
  end if;

  select * into v_existing
  from public.team_tournament_dreambreaker_states
  where matchup_id = p_matchup.id;

  if v_existing.id is not null then
    update public.team_tournament_matchups set
      status = 'in_progress',
      result = (result - 'winnerTeamId') || jsonb_build_object('winnerTeamId', null, 'needsDreambreaker', true),
      updated_at = now()
    where id = p_matchup.id;

    return jsonb_build_object(
      'ok', true,
      'activated', false,
      'alreadyActive', true,
      'code', 'DREAMBREAKER_REQUIRED',
      'status', v_existing.status,
      'matchupId', p_matchup.external_matchup_id,
      'version', v_existing.version,
      'matchupResult', v_result
    );
  end if;

  v_lock_at := now() + interval '10 minutes';

  insert into public.team_tournament_dreambreaker_states (
    tenant_id, tournament_id, matchup_id, status,
    team_a_order, team_b_order, team_a_score, team_b_score,
    order_lock_at, rotation, version, updated_by
  ) values (
    p_header.tenant_id, p_header.tournament_id, p_matchup.id, 'lineup_open',
    '[]'::jsonb, '[]'::jsonb, 0, 0,
    v_lock_at,
    jsonb_build_object('segmentIndex', 0, 'pointsInSegment', 0, 'pointHistory', '[]'::jsonb, 'injurySkips', '[]'::jsonb),
    1,
    auth.uid()
  )
  returning * into v_existing;

  update public.team_tournament_matchups set
    status = 'in_progress',
    result = jsonb_build_object(
      'teamAWins', (v_result->>'teamAWins')::int,
      'teamBWins', (v_result->>'teamBWins')::int,
      'teamAPoints', (v_result->>'teamAPoints')::int,
      'teamBPoints', (v_result->>'teamBPoints')::int,
      'winnerTeamId', null,
      'needsDreambreaker', true
    ),
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_matchup.id;

  perform public.team_tournament_write_audit(
    p_header.tenant_id, p_header.tournament_id,
    'team.match.dreambreaker.activate', p_matchup.external_matchup_id,
    jsonb_build_object('status', 'lineup_open', 'code', 'DREAMBREAKER_REQUIRED')
  );

  return jsonb_build_object(
    'ok', true,
    'activated', true,
    'code', 'DREAMBREAKER_REQUIRED',
    'status', 'lineup_open',
    'matchupId', p_matchup.external_matchup_id,
    'version', v_existing.version,
    'orderLockAt', v_lock_at,
    'matchupResult', v_result
  );
end;
$$;

-- ─── Versioned confirm (Staging contract + activation) ─────────────
create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_cmd json;
  v_hash text;
  v_winner text;
  v_result jsonb;
  v_db jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'score', p_score, 'winnerTeamId', p_winner_team_id,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if p_expected_version is not null and v_sub_match.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_winner := coalesce(nullif(p_winner_team_id, ''), case
    when coalesce((p_score->>'teamA')::int, 0) > coalesce((p_score->>'teamB')::int, 0) then v_matchup.team_a_id
    when coalesce((p_score->>'teamB')::int, 0) > coalesce((p_score->>'teamA')::int, 0) then v_matchup.team_b_id
    else null
  end);

  update public.team_tournament_sub_matches set
    score = p_score,
    status = 'completed',
    winner_team_id = v_winner,
    result_confirmed_at = now(),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    select version into v_sub_match.version from public.team_tournament_sub_matches where id = v_sub_match.id;
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_result := public.team_tournament_recompute_matchup_result(v_matchup.id);
  select * into v_matchup from public.team_tournament_matchups where id = v_matchup.id;
  v_db := public.team_tournament_maybe_activate_dreambreaker(v_header, v_matchup);
  select * into v_matchup from public.team_tournament_matchups where id = v_matchup.id;
  v_result := coalesce(v_matchup.result, v_result) || jsonb_build_object(
    'matchupCompleted', v_matchup.status = 'completed',
    'ok', true
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.match.confirm_sub_match', p_sub_match_id,
    jsonb_build_object('winnerTeamId', v_winner, 'score', p_score, 'dreambreaker', v_db)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'winnerTeamId', v_winner,
    'version', v_sub_match.version + 1,
    'matchupResult', v_result,
    'dreambreaker', v_db,
    'code', case
      when coalesce(v_db->>'code', '') = 'DREAMBREAKER_REQUIRED' then 'DREAMBREAKER_REQUIRED'
      else null
    end
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- ─── Legacy 5-arg Production confirm — same activation contract ────
create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.team_tournament_confirm_sub_match(
    p_tournament_id, p_matchup_id, p_sub_match_id, p_score, p_winner_team_id, null, null
  );
end;
$$;

grant execute on function public.team_tournament_recompute_matchup_result(uuid) to authenticated;
grant execute on function public.team_tournament_maybe_activate_dreambreaker(public.team_tournaments, public.team_tournament_matchups) to authenticated;
grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text) to authenticated;
grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text) to authenticated;

revoke all on function public.team_tournament_recompute_matchup_result(uuid) from anon, public;
revoke all on function public.team_tournament_maybe_activate_dreambreaker(public.team_tournaments, public.team_tournament_matchups) from anon, public;
revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text) from anon, public;
revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text) from anon, public;
