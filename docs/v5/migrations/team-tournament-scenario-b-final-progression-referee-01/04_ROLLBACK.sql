-- team-tournament-scenario-b-final-progression-referee-01 / 04_ROLLBACK
-- Emergency only. Does NOT restore thin apply_domain replace_matchups
-- (would reintroduce B2/B3). Keeps Scenario B upsert + empty-placeholder.
-- Drops auto-advance trigger/function. Restores prior INSERT-only create.

drop trigger if exists team_tournament_advance_knockout_winner_trg
  on public.team_tournament_matchups;

drop function if exists public.team_tournament_advance_knockout_winner_trg();
drop function if exists public.team_tournament_advance_knockout_winner(uuid);

-- Restore TT-5D create (INSERT after pending/active same-ref check only).
create or replace function public.team_tournament_create_referee_assignment(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_referee_user_id uuid,
  p_expires_at timestamptz default null,
  p_activate boolean default true,
  p_idempotency_key text default null,
  p_reason text default 'tt5d_assign'
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
  v_profile public.profiles;
  v_existing public.referee_assignments;
  v_row public.referee_assignments;
  v_status text;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'refereeUserId', p_referee_user_id,
      'expiresAt', p_expires_at,
      'reason', p_reason
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id
    and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_profile from public.profiles where id = p_referee_user_id;
  if v_profile.id is null then
    return json_build_object('ok', false, 'code', 'REFEREE_NOT_FOUND');
  end if;

  select * into v_existing
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.match_id = v_sub_match.external_sub_match_id
    and ra.referee_user_id = p_referee_user_id
    and ra.role = 'REFEREE'
    and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
      in ('pending', 'active');

  if v_existing.id is not null then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_existing.id,
      'status', public.referee_v5_assignment_effective_status(
        v_existing.status, v_existing.expires_at, v_existing.revoked_at
      ),
      'version', v_existing.version
    );
  end if;

  v_status := case when coalesce(p_activate, true) then 'active' else 'pending' end;

  insert into public.referee_assignments (
    tenant_id, tournament_id, match_id,
    external_matchup_id, external_sub_match_id,
    matchup_id, sub_match_id,
    referee_user_id, referee_display_name,
    role, status, assigned_by, assigned_at, expires_at, version
  ) values (
    v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id,
    v_matchup.external_matchup_id, v_sub_match.external_sub_match_id,
    v_matchup.id, v_sub_match.id,
    p_referee_user_id, coalesce(v_profile.display_name, v_profile.email, 'Referee'),
    'REFEREE', v_status, auth.uid(), now(), p_expires_at, 1
  )
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_created', v_sub_match.external_sub_match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'refereeUserId', p_referee_user_id,
      'status', v_status,
      'expiresAt', p_expires_at,
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'version', v_row.version
    )
  );

  return json_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'refereeMatchId', v_row.match_id,
    'status', v_status,
    'version', v_row.version,
    'expiresAt', v_row.expires_at
  );
end;
$$;

revoke all on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  from public, anon;
grant execute on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  to authenticated;

do $$
begin
  raise notice 'ROLLBACK_NOTE: auto KO advance removed; create_referee_assignment restored to TT-5D INSERT. nextSlot persist on replace_matchups left in place (additive).';
end $$;
