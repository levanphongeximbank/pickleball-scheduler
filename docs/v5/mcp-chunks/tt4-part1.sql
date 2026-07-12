-- ═══════════════════════════════════════════════════════════════════
-- Phase TT-4 — Forfeit, Withdrawal & Technical Result Workflow
-- Staging only — idempotent, non-destructive
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.team_tournament_apply_forfeit(text, text, text, text, text, text, text, jsonb, integer, text);

-- ─── 1. Schema extensions ─────────────────────────────────────────
alter table public.team_tournament_teams
  add column if not exists withdrawn boolean not null default false;

alter table public.team_tournament_teams
  add column if not exists withdrawn_at timestamptz;

alter table public.team_tournament_teams
  add column if not exists withdrawal_reason text;

alter table public.team_tournament_forfeit_events
  add column if not exists reason_code text not null default '';

alter table public.team_tournament_forfeit_events
  add column if not exists request_id text;

alter table public.team_tournament_forfeit_events
  add column if not exists actor_role text;

alter table public.team_tournament_forfeit_events
  add column if not exists before_data jsonb not null default '{}'::jsonb;

alter table public.team_tournament_forfeit_events
  add column if not exists after_data jsonb not null default '{}'::jsonb;

alter table public.team_tournament_standings
  add column if not exists forfeit_count int not null default 0;

alter table public.team_tournament_matchups
  add column if not exists standings_recalc_required boolean not null default false;

do $tt4_result_type$
begin
  alter table public.team_tournament_forfeit_events
    drop constraint if exists team_tournament_forfeit_events_result_type_check;

  alter table public.team_tournament_forfeit_events
    add constraint team_tournament_forfeit_events_result_type_check
    check (result_type in (
      'forfeit', 'technical', 'withdrawn', 'no_show', 'injury',
      'late_arrival', 'invalid_lineup', 'withdrawal_before_match',
      'withdrawal_during_match', 'misconduct', 'team_withdrawal',
      'administrative_forfeit'
    ));
exception
  when others then null;
end $tt4_result_type$;

-- ─── 2. Technical score config (single source in tournament settings) ─
create or replace function public.team_tournament_technical_score_defaults(
  p_settings jsonb
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'winnerPoints', coalesce((p_settings->'technicalScoreDefaults'->>'winnerPoints')::int, 11),
    'loserPoints', coalesce((p_settings->'technicalScoreDefaults'->>'loserPoints')::int, 0),
    'affectsStandings', coalesce((p_settings->'technicalScoreDefaults'->>'affectsStandings')::boolean, true),
    'affectsPointDifference', coalesce((p_settings->'technicalScoreDefaults'->>'affectsPointDifference')::boolean, true),
    'affectsElo', coalesce((p_settings->'technicalScoreDefaults'->>'affectsElo')::boolean, false)
  );
$$;

create or replace function public.team_tournament_resolve_technical_score(
  p_settings jsonb,
  p_team_a_id text,
  p_team_b_id text,
  p_forfeiting_team_id text,
  p_override jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_defaults jsonb;
  v_winner int;
  v_loser int;
  v_score_a int;
  v_score_b int;
begin
  v_defaults := public.team_tournament_technical_score_defaults(p_settings);
  v_winner := coalesce((p_override->>'winnerPoints')::int, (v_defaults->>'winnerPoints')::int, 11);
  v_loser := coalesce((p_override->>'loserPoints')::int, (v_defaults->>'loserPoints')::int, 0);

  if p_forfeiting_team_id = p_team_a_id then
    v_score_a := v_loser;
    v_score_b := v_winner;
  else
    v_score_a := v_winner;
    v_score_b := v_loser;
  end if;

  if p_override ? 'teamA' or p_override ? 'teamB' then
    v_score_a := coalesce((p_override->>'teamA')::int, v_score_a);
    v_score_b := coalesce((p_override->>'teamB')::int, v_score_b);
  end if;

  return jsonb_build_object(
    'teamA', v_score_a,
    'teamB', v_score_b,
    'games', coalesce(p_override->'games', '[]'::jsonb)
  );
end;
$$;

-- ─── 3. Confirmed result guard ────────────────────────────────────
create or replace function public.team_tournament_sub_match_is_confirmed_normal(
  p_sub_match public.team_tournament_sub_matches
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_sub_match.status = 'completed'
    and p_sub_match.result_confirmed_at is not null;
$$;

-- ─── 4. Matchup result recompute (includes forfeit sub-matches) ───
create or replace function public.team_tournament_recompute_matchup_result(
  p_matchup_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_matchup public.team_tournament_matchups;
  v_team_a_wins int := 0;
  v_team_b_wins int := 0;
  v_team_a_points int := 0;
  v_team_b_points int := 0;
  v_winner text := null;
  v_all_finalized boolean := true;
  v_total int := 0;
  v_finalized int := 0;
begin
  select * into v_matchup from public.team_tournament_matchups where id = p_matchup_id;
  if v_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

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
  into v_team_a_wins, v_team_b_wins, v_team_a_points, v_team_b_points, v_total, v_finalized
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = p_matchup_id;

  v_all_finalized := v_total > 0 and v_finalized = v_total;

  if v_team_a_wins > v_team_b_wins then
    v_winner := v_matchup.team_a_id;
  elsif v_team_b_wins > v_team_a_wins then
    v_winner := v_matchup.team_b_id;
  end if;

  update public.team_tournament_matchups set
    result = jsonb_build_object(
      'teamAWins', v_team_a_wins,
      'teamBWins', v_team_b_wins,
      'teamAPoints', v_team_a_points,
      'teamBPoints', v_team_b_points,
      'winnerTeamId', v_winner
    ),
    status = case
      when v_all_finalized and v_winner is not null then 'completed'
      when status = 'published' then 'in_progress'
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
    'matchupCompleted', v_all_finalized and v_winner is not null
  );
end;
$$;

-- ─── 5. Standings cache recompute (idempotent) ────────────────────
create or replace function public.team_tournament_recompute_standings_cache(
  p_team_tournament_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team record;
  v_matchup record;
  v_map jsonb := '{}'::jsonb;
  v_key text;
  v_row jsonb;
  v_rank int := 0;
begin
  select * into v_header from public.team_tournaments where id = p_team_tournament_id;
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  for v_team in
    select external_team_id from public.team_tournament_teams
    where team_tournament_id = p_team_tournament_id
  loop
    v_map := v_map || jsonb_build_object(v_team.external_team_id, jsonb_build_object(
      'teamId', v_team.external_team_id,
      'rank', 0,
      'played', 0,
      'wins', 0,
      'losses', 0,
      'subMatchWins', 0,
      'subMatchLosses', 0,
      'subMatchDiff', 0,
      'pointsScored', 0,
      'pointsConceded', 0,
      'rankingPoints', 0,
      'forfeitCount', 0
    ));
  end loop;

  for v_matchup in
    select m.* from public.team_tournament_matchups m
    where m.team_tournament_id = p_team_tournament_id
      and m.result is not null
  loop
    v_key := v_matchup.team_a_id;
    if v_map ? v_key then
      v_row := v_map->v_key;
      v_row := jsonb_set(v_row, '{subMatchWins}', to_jsonb((v_row->>'subMatchWins')::int + coalesce((v_matchup.result->>'teamAWins')::int, 0)));
      v_row := jsonb_set(v_row, '{subMatchLosses}', to_jsonb((v_row->>'subMatchLosses')::int + coalesce((v_matchup.result->>'teamBWins')::int, 0)));
      v_row := jsonb_set(v_row, '{pointsScored}', to_jsonb((v_row->>'pointsScored')::int + coalesce((v_matchup.result->>'teamAPoints')::int, 0)));
      v_row := jsonb_set(v_row, '{pointsConceded}', to_jsonb((v_row->>'pointsConceded')::int + coalesce((v_matchup.result->>'teamBPoints')::int, 0)));
      v_map := jsonb_set(v_map, array[v_key], v_row);
    end if;

    v_key := v_matchup.team_b_id;
    if v_map ? v_key then
      v_row := v_map->v_key;
      v_row := jsonb_set(v_row, '{subMatchWins}', to_jsonb((v_row->>'subMatchWins')::int + coalesce((v_matchup.result->>'teamBWins')::int, 0)));
      v_row := jsonb_set(v_row, '{subMatchLosses}', to_jsonb((v_row->>'subMatchLosses')::int + coalesce((v_matchup.result->>'teamAWins')::int, 0)));
      v_row := jsonb_set(v_row, '{pointsScored}', to_jsonb((v_row->>'pointsScored')::int + coalesce((v_matchup.result->>'teamBPoints')::int, 0)));
      v_row := jsonb_set(v_row, '{pointsConceded}', to_jsonb((v_row->>'pointsConceded')::int + coalesce((v_matchup.result->>'teamAPoints')::int, 0)));
      v_map := jsonb_set(v_map, array[v_key], v_row);
    end if;

    if v_matchup.status = 'completed' and coalesce(v_matchup.result->>'winnerTeamId', '') <> '' then
      v_key := v_matchup.team_a_id;
      if v_map ? v_key then
        v_row := v_map->v_key;
        v_row := jsonb_set(v_row, '{played}', to_jsonb((v_row->>'played')::int + 1));
        if v_matchup.result->>'winnerTeamId' = v_key then
          v_row := jsonb_set(v_row, '{wins}', to_jsonb((v_row->>'wins')::int + 1));
          v_row := jsonb_set(v_row, '{rankingPoints}', to_jsonb((v_row->>'rankingPoints')::int + 2));
        else
          v_row := jsonb_set(v_row, '{losses}', to_jsonb((v_row->>'losses')::int + 1));
          v_row := jsonb_set(v_row, '{rankingPoints}', to_jsonb((v_row->>'rankingPoints')::int + 1));
        end if;
        v_map := jsonb_set(v_map, array[v_key], v_row);
      end if;

      v_key := v_matchup.team_b_id;
      if v_map ? v_key then
        v_row := v_map->v_key;
        v_row := jsonb_set(v_row, '{played}', to_jsonb((v_row->>'played')::int + 1));
        if v_matchup.result->>'winnerTeamId' = v_key then
          v_row := jsonb_set(v_row, '{wins}', to_jsonb((v_row->>'wins')::int + 1));
          v_row := jsonb_set(v_row, '{rankingPoints}', to_jsonb((v_row->>'rankingPoints')::int + 2));
        else
          v_row := jsonb_set(v_row, '{losses}', to_jsonb((v_row->>'losses')::int + 1));
          v_row := jsonb_set(v_row, '{rankingPoints}', to_jsonb((v_row->>'rankingPoints')::int + 1));
        end if;
        v_map := jsonb_set(v_map, array[v_key], v_row);
      end if;
    end if;
  end loop;

  for v_key in select jsonb_object_keys(v_map)
  loop
    v_row := v_map->v_key;
    v_row := jsonb_set(v_row, '{subMatchDiff}',
      to_jsonb((v_row->>'subMatchWins')::int - (v_row->>'subMatchLosses')::int));
    v_map := jsonb_set(v_map, array[v_key], v_row);
  end loop;

  delete from public.team_tournament_standings where team_tournament_id = p_team_tournament_id;

  for v_key, v_row in select * from jsonb_each(v_map)
  loop
    insert into public.team_tournament_standings (
      tenant_id, tournament_id, team_tournament_id, team_external_id,
      rank, played, wins, losses,
      sub_match_wins, sub_match_losses, sub_match_diff,
      points_scored, points_conceded, ranking_points, forfeit_count
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_header.id, v_key,
      0,
      (v_row->>'played')::int,
      (v_row->>'wins')::int,
      (v_row->>'losses')::int,
      (v_row->>'subMatchWins')::int,
      (v_row->>'subMatchLosses')::int,
      (v_row->>'subMatchDiff')::int,
      (v_row->>'pointsScored')::int,
      (v_row->>'pointsConceded')::int,
      (v_row->>'rankingPoints')::int,
      (v_row->>'forfeitCount')::int
    );
  end loop;

  with ranked as (
    select id, row_number() over (
      order by wins desc, sub_match_diff desc, points_scored desc, team_external_id
    ) as new_rank
    from public.team_tournament_standings
    where team_tournament_id = p_team_tournament_id
  )
  update public.team_tournament_standings s
  set rank = r.new_rank
  from ranked r
  where s.id = r.id;

  update public.team_tournament_matchups
  set standings_recalc_required = false
  where team_tournament_id = p_team_tournament_id
    and standings_recalc_required = true;

  return jsonb_build_object('ok', true, 'teamCount', (select count(*) from jsonb_object_keys(v_map)));
end;
$$;

