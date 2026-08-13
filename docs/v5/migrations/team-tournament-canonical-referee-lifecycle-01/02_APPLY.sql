-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-canonical-referee-lifecycle-01
-- LOCAL ONLY. Do NOT apply on Staging/Production without Owner GO.
-- Forward-only. Do NOT re-run prior packages.
--
-- Canonical parent matchup referee assignment + effective inheritance
-- + auto V5 runtime ensure + scoped result write + Dreambreaker start.
-- Reuses referee_assignments / team_sub_match_referee_links / provision
-- / Referee V5. No second assignment table.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Effective referee: explicit child override else parent matchup else none.
create or replace function public.team_tournament_resolve_effective_referee_assignment(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches
)
returns public.referee_assignments
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.referee_assignments;
begin
  if p_header.id is null or p_matchup.id is null then
    return v_row;
  end if;

  if p_sub_match.id is not null then
    select * into v_row
    from public.referee_assignments ra
    where ra.tenant_id = p_header.tenant_id
      and ra.tournament_id = p_header.tournament_id
      and ra.role = 'REFEREE'
      and ra.sub_match_id is not null
      and ra.match_id = p_sub_match.external_sub_match_id
      and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
        in ('pending', 'active')
    order by ra.assigned_at desc nulls last
    limit 1;
    if v_row.id is not null then
      return v_row;
    end if;
  end if;

  select * into v_row
  from public.referee_assignments ra
  where ra.tenant_id = p_header.tenant_id
    and ra.tournament_id = p_header.tournament_id
    and ra.role = 'REFEREE'
    and ra.sub_match_id is null
    and ra.match_id = p_matchup.external_matchup_id
    and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
      in ('pending', 'active')
  order by ra.assigned_at desc nulls last
  limit 1;

  return v_row;
end;
$$;

revoke all on function public.team_tournament_resolve_effective_referee_assignment(team_tournaments, team_tournament_matchups, team_tournament_sub_matches)
  from public, anon, authenticated;

-- 2. Write guard: organizer/admin (can_manage) OR effective assigned referee.
--    Broad can_manage_results is NOT sufficient for unassigned matchups.
create or replace function public.team_tournament_result_write_guard(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_assignment public.referee_assignments;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if public.team_tournament_can_manage() then
    return jsonb_build_object('ok', true, 'authority', 'organizer');
  end if;
  v_assignment := public.team_tournament_resolve_effective_referee_assignment(
    p_header, p_matchup, p_sub_match
  );
  if v_assignment.id is not null and v_assignment.referee_user_id = auth.uid() then
    return jsonb_build_object(
      'ok', true,
      'authority', 'assigned_referee',
      'assignmentId', v_assignment.id,
      'scope', case when v_assignment.sub_match_id is null then 'parent' else 'child' end
    );
  end if;
  return jsonb_build_object(
    'ok', false,
    'code', 'FORBIDDEN',
    'error', 'Không có quyền ghi kết quả trận này — cần phân công trọng tài hoặc quyền BTC.'
  );
end;
$$;

revoke all on function public.team_tournament_result_write_guard(team_tournaments, team_tournament_matchups, team_tournament_sub_matches)
  from public, anon, authenticated;

-- 3. Eligibility: parent assignment covers children + Dreambreaker.
create or replace function public.team_tournament_provision_eligibility(
  p_header team_tournaments,
  p_matchup team_tournament_matchups,
  p_sub_match team_tournament_sub_matches,
  p_referee_assignment_id uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_assignment public.referee_assignments;
  v_existing public.team_sub_match_referee_links;
  v_discipline record;
  v_match_type text;
  v_parent_ok boolean := false;
begin
  if p_sub_match.id is null then
    return jsonb_build_object('eligible', false, 'blockCode', 'NOT_FOUND');
  end if;

  if p_sub_match.status in ('completed', 'forfeit') or p_sub_match.result_confirmed_at is not null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'sub_match_finalized',
      'blockMessage', 'Trận con đã kết thúc.'
    );
  end if;

  if p_matchup.status not in ('published', 'in_progress') then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'matchup_not_published',
      'blockMessage', 'Matchup chưa công bố.'
    );
  end if;

  if coalesce(p_matchup.requires_republish, false) then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'requires_republish',
      'blockMessage', 'Lineup đã override — cần công bố lại trước khi provision.'
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups
  where matchup_id = p_matchup.id and team_external_id = p_matchup.team_b_id;

  if v_lineup_a.id is null or v_lineup_b.id is null
     or v_lineup_a.status <> 'published' or v_lineup_b.status <> 'published' then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'lineup_not_published',
      'blockMessage', 'Cả hai lineup phải published.'
    );
  end if;

  select * into v_existing
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id and l.status <> 'revoked';

  if v_existing.id is not null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'bridge_already_exists',
      'blockMessage', 'Sub-match đã có liên kết Referee V5.',
      'linkId', v_existing.id,
      'status', v_existing.status
    );
  end if;

  if p_referee_assignment_id is null then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_required',
      'blockMessage', 'Cần referee assignment trước khi provision.'
    );
  end if;

  select * into v_assignment
  from public.referee_assignments a
  where a.id = p_referee_assignment_id;

  if v_assignment.id is null then
    return jsonb_build_object('eligible', false, 'blockCode', 'assignment_not_found');
  end if;

  v_parent_ok := v_assignment.sub_match_id is null
    and v_assignment.match_id = p_matchup.external_matchup_id;

  if v_assignment.tenant_id <> p_header.tenant_id
     or v_assignment.tournament_id <> p_header.tournament_id
     or (v_assignment.match_id <> p_sub_match.external_sub_match_id and not v_parent_ok) then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_scope_mismatch',
      'blockMessage', 'Assignment không khớp tenant/tournament/sub-match.'
    );
  end if;

  if public.referee_v5_assignment_effective_status(
       v_assignment.status, v_assignment.expires_at, v_assignment.revoked_at
     ) not in ('pending', 'active') then
    return jsonb_build_object(
      'eligible', false,
      'blockCode', 'assignment_not_active',
      'blockMessage', 'Assignment không active.'
    );
  end if;

  select * into v_discipline
  from public.team_tournament_disciplines d
  where d.team_tournament_id = p_header.id
    and d.external_discipline_id = p_sub_match.discipline_external_id;

  v_match_type := case
    when coalesce(v_discipline.category_type, 'doubles') = 'singles' then 'singles'
    else 'doubles'
  end;

  return jsonb_build_object(
    'eligible', true,
    'blockCode', null,
    'matchType', v_match_type,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'matchupVersion', p_matchup.version,
    'subMatchVersion', p_sub_match.version,
    'inheritedFromParent', v_parent_ok
  );
end;
$$;

-- 4. Idempotent V5 runtime ensure from effective assignment.
create or replace function public.team_tournament_ensure_referee_runtime_for_matchup(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.team_tournament_sub_matches;
  v_assignment public.referee_assignments;
  v_link public.team_sub_match_referee_links;
  v_elig jsonb;
  v_players_a text[];
  v_players_b text[];
  v_discipline record;
  v_match_type text;
  v_state jsonb;
  v_state_id text;
  v_now timestamptz := now();
  v_ensured int := 0;
  v_skipped int := 0;
begin
  if p_header.id is null or p_matchup.id is null then
    return jsonb_build_object('ok', true, 'ensured', 0, 'skipped', 'missing_matchup');
  end if;
  if p_matchup.status not in ('published', 'in_progress') then
    return jsonb_build_object('ok', true, 'ensured', 0, 'skipped', 'matchup_not_actionable');
  end if;

  for v_sub in
    select * from public.team_tournament_sub_matches sm
    where sm.matchup_id = p_matchup.id
      and (p_sub_match_id is null or sm.external_sub_match_id = p_sub_match_id)
  loop
    v_assignment := public.team_tournament_resolve_effective_referee_assignment(
      p_header, p_matchup, v_sub
    );
    if v_assignment.id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select * into v_link
    from public.team_sub_match_referee_links l
    where l.sub_match_id = v_sub.id
    order by l.created_at desc nulls last
    limit 1;

    if v_link.id is not null and v_link.status <> 'revoked' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_elig := public.team_tournament_provision_eligibility(
      p_header, p_matchup, v_sub, v_assignment.id
    );
    if coalesce(v_elig->>'blockCode', '') = 'bridge_already_exists' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if not coalesce((v_elig->>'eligible')::boolean, false) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select coalesce(array_agg(le.player_id order by le.sort_order, le.player_id), '{}')
    into v_players_a
    from public.team_tournament_lineups l
    join public.team_tournament_lineup_entries le on le.lineup_id = l.id
    where l.matchup_id = p_matchup.id
      and l.team_external_id = p_matchup.team_a_id
      and le.discipline_external_id = v_sub.discipline_external_id;

    select coalesce(array_agg(le.player_id order by le.sort_order, le.player_id), '{}')
    into v_players_b
    from public.team_tournament_lineups l
    join public.team_tournament_lineup_entries le on le.lineup_id = l.id
    where l.matchup_id = p_matchup.id
      and l.team_external_id = p_matchup.team_b_id
      and le.discipline_external_id = v_sub.discipline_external_id;

    select * into v_discipline
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
      and d.external_discipline_id = v_sub.discipline_external_id;

    v_match_type := coalesce(v_elig->>'matchType', 'doubles');
    v_state := public.team_tournament_build_v5_state_shell(
      v_sub.external_sub_match_id,
      p_matchup.team_a_id,
      p_matchup.team_b_id,
      v_players_a,
      v_players_b,
      v_match_type,
      coalesce(v_discipline.scoring_format, '{}'::jsonb)
    );
    v_state_id := public.referee_v5_match_state_id(
      p_header.tenant_id, p_header.tournament_id, v_sub.external_sub_match_id
    );

    begin
      if not exists (select 1 from public.match_live_states where id = v_state_id) then
        insert into public.match_live_states (
          id, tenant_id, tournament_id, match_id,
          team_a_id, team_b_id,
          state_payload, state_version, version, status, last_event_sequence,
          participants, scoring_format, points_to_win, win_by, best_of, scoring_system
        ) values (
          v_state_id,
          p_header.tenant_id,
          p_header.tournament_id,
          v_sub.external_sub_match_id,
          p_matchup.team_a_id,
          p_matchup.team_b_id,
          v_state,
          0, 0, 'not_started', 0,
          coalesce(v_state->'teams', '[]'::jsonb),
          coalesce(v_discipline.scoring_format, '{}'::jsonb),
          coalesce((v_state->>'pointsToWin')::int, 11),
          coalesce((v_state->>'winBy')::int, 2),
          1,
          coalesce(v_state->>'scoringFormat', 'side_out')
        );
      end if;

      if v_link.id is not null then
        update public.team_sub_match_referee_links set
          status = 'provisioned',
          referee_assignment_id = v_assignment.id,
          referee_match_id = v_sub.external_sub_match_id,
          provisioned_at = coalesce(provisioned_at, v_now),
          linked_at = coalesce(linked_at, v_now),
          version = version + 1
        where id = v_link.id;
      else
        insert into public.team_sub_match_referee_links (
          tenant_id, tournament_id, team_tournament_id,
          matchup_id, external_matchup_id,
          sub_match_id, external_sub_match_id,
          referee_match_id, referee_assignment_id,
          status, provision_version, provisioned_at, linked_at,
          snapshot, created_by, version
        ) values (
          p_header.tenant_id, p_header.tournament_id, p_header.id,
          p_matchup.id, p_matchup.external_matchup_id,
          v_sub.id, v_sub.external_sub_match_id,
          v_sub.external_sub_match_id,
          v_assignment.id,
          'provisioned', 1, v_now, v_now,
          jsonb_build_object('provisionSource', 'canonical_ensure'),
          auth.uid(), 1
        );
      end if;
      v_ensured := v_ensured + 1;
    exception when unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'ensured', v_ensured, 'skipped', v_skipped);
end;
$$;

revoke all on function public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments, team_tournament_matchups, text)
  from public, anon, authenticated;

create or replace function public.team_tournament_trg_matchup_ensure_runtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
begin
  if new.status not in ('published', 'in_progress') then
    return new;
  end if;
  select * into v_header from public.team_tournaments where id = new.team_tournament_id;
  perform public.team_tournament_ensure_referee_runtime_for_matchup(v_header, new, null);
  return new;
end;
$$;

drop trigger if exists trg_tt_matchup_ensure_referee_runtime on public.team_tournament_matchups;
create trigger trg_tt_matchup_ensure_referee_runtime
after insert or update of status on public.team_tournament_matchups
for each row
when (new.status in ('published', 'in_progress'))
execute function public.team_tournament_trg_matchup_ensure_runtime();

create or replace function public.team_tournament_trg_sub_match_ensure_runtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
begin
  select * into v_matchup from public.team_tournament_matchups where id = new.matchup_id;
  select * into v_header from public.team_tournaments where id = v_matchup.team_tournament_id;
  perform public.team_tournament_ensure_referee_runtime_for_matchup(
    v_header, v_matchup, new.external_sub_match_id
  );
  return new;
end;
$$;

drop trigger if exists trg_tt_sub_match_ensure_referee_runtime on public.team_tournament_sub_matches;
create trigger trg_tt_sub_match_ensure_referee_runtime
after insert on public.team_tournament_sub_matches
for each row
execute function public.team_tournament_trg_sub_match_ensure_runtime();

-- 5. create_referee_assignment: nullable p_sub_match_id = parent matchup authority.
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
  v_effective text;
  v_parent boolean;
  v_match_key text;
  v_result jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'error', 'Phiên đăng nhập hết hạn — đăng nhập lại.');
  end if;
  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không đủ quyền thực hiện thao tác này.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải hoặc tài nguyên liên quan.');
  end if;
  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', 'Từ chối truy cập ngoài tenant.');
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
  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận đấu.');
  end if;
  if nullif(btrim(coalesce(v_matchup.team_a_id, '')), '') is null
     or nullif(btrim(coalesce(v_matchup.team_b_id, '')), '') is null then
    return json_build_object(
      'ok', false,
      'code', 'MATCHUP_TEAMS_UNRESOLVED',
      'error', 'Trận chưa đủ hai đội (placeholder knockout). Không gán trọng tài.'
    );
  end if;

  v_parent := nullif(btrim(coalesce(p_sub_match_id, '')), '') is null;
  if v_parent then
    v_match_key := v_matchup.external_matchup_id;
  else
    select * into v_sub_match
    from public.team_tournament_sub_matches sm
    where sm.matchup_id = v_matchup.id
      and sm.external_sub_match_id = p_sub_match_id;
    if v_sub_match.id is null then
      return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy trận con.');
    end if;
    v_match_key := v_sub_match.external_sub_match_id;
  end if;

  select * into v_profile from public.profiles where id = p_referee_user_id;
  if v_profile.id is null then
    return json_build_object('ok', false, 'code', 'REFEREE_NOT_FOUND', 'error', 'Không tìm thấy hồ sơ trọng tài (profiles id).');
  end if;

  v_status := case when coalesce(p_activate, true) then 'active' else 'pending' end;

  update public.referee_assignments
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoke_reason = coalesce(nullif(btrim(p_reason), ''), 'tt5d_supersede'),
         version = version + 1,
         updated_at = now()
   where tenant_id = v_header.tenant_id
     and tournament_id = v_header.tournament_id
     and match_id = v_match_key
     and role = 'REFEREE'
     and referee_user_id is distinct from p_referee_user_id
     and public.referee_v5_assignment_effective_status(status, expires_at, revoked_at)
       in ('pending', 'active');

  select * into v_existing
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.match_id = v_match_key
    and ra.referee_user_id = p_referee_user_id
    and ra.role = 'REFEREE'
  for update;

  if v_existing.id is not null then
    v_effective := public.referee_v5_assignment_effective_status(
      v_existing.status, v_existing.expires_at, v_existing.revoked_at
    );
    if v_effective in ('pending', 'active') then
      perform public.team_tournament_ensure_referee_runtime_for_matchup(
        v_header, v_matchup, case when v_parent then null else v_match_key end
      );
      v_result := jsonb_build_object(
        'ok', true,
        'replayed', true,
        'assignmentId', v_existing.id,
        'status', v_effective,
        'version', v_existing.version,
        'scope', case when v_parent then 'parent' else 'child' end
      );
      perform public.team_tournament_finish_command(
        v_header.tenant_id, p_tournament_id, 'create_referee_assignment',
        p_idempotency_key, v_cmd->>'payload_hash', v_result
      );
      return v_result;
    end if;

    update public.referee_assignments set
      status = v_status,
      revoked_at = null,
      revoked_by = null,
      revoke_reason = null,
      assigned_by = auth.uid(),
      assigned_at = now(),
      expires_at = p_expires_at,
      external_matchup_id = v_matchup.external_matchup_id,
      external_sub_match_id = case when v_parent then null else v_sub_match.external_sub_match_id end,
      matchup_id = v_matchup.id,
      sub_match_id = case when v_parent then null else v_sub_match.id end,
      referee_display_name = coalesce(v_profile.display_name, v_profile.email, 'Referee'),
      version = version + 1,
      updated_at = now()
    where id = v_existing.id
    returning * into v_row;
  else
    begin
      insert into public.referee_assignments (
        tenant_id, tournament_id, match_id,
        external_matchup_id, external_sub_match_id,
        matchup_id, sub_match_id,
        referee_user_id, referee_display_name,
        role, status, assigned_by, assigned_at, expires_at, version
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_match_key,
        v_matchup.external_matchup_id,
        case when v_parent then null else v_sub_match.external_sub_match_id end,
        v_matchup.id,
        case when v_parent then null else v_sub_match.id end,
        p_referee_user_id, coalesce(v_profile.display_name, v_profile.email, 'Referee'),
        'REFEREE', v_status, auth.uid(), now(), p_expires_at, 1
      )
      returning * into v_row;
    exception when unique_violation then
      select * into v_existing
      from public.referee_assignments ra
      where ra.tenant_id = v_header.tenant_id
        and ra.tournament_id = v_header.tournament_id
        and ra.match_id = v_match_key
        and ra.referee_user_id = p_referee_user_id
        and ra.role = 'REFEREE';
      if v_existing.id is not null then
        perform public.team_tournament_ensure_referee_runtime_for_matchup(
          v_header, v_matchup, case when v_parent then null else v_match_key end
        );
        return json_build_object(
          'ok', true,
          'replayed', true,
          'assignmentId', v_existing.id,
          'status', public.referee_v5_assignment_effective_status(
            v_existing.status, v_existing.expires_at, v_existing.revoked_at
          ),
          'version', v_existing.version,
          'scope', case when v_parent then 'parent' else 'child' end
        );
      end if;
      return json_build_object(
        'ok', false,
        'code', 'REFEREE_ASSIGNMENT_CONFLICT',
        'error', 'Trọng tài này đã được gán cho trận. Tải lại danh sách — không tạo assignment trùng.'
      );
    end;
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_upserted', v_match_key,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'refereeUserId', p_referee_user_id,
      'status', v_status,
      'scope', case when v_parent then 'parent' else 'child' end,
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'version', v_row.version
    )
  );

  perform public.team_tournament_ensure_referee_runtime_for_matchup(
    v_header, v_matchup, case when v_parent then null else v_match_key end
  );

  v_result := jsonb_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'refereeMatchId', v_row.match_id,
    'status', v_status,
    'version', v_row.version,
    'expiresAt', v_row.expires_at,
    'scope', case when v_parent then 'parent' else 'child' end
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment',
    p_idempotency_key, v_cmd->>'payload_hash', v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  from public, anon;
grant execute on function public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)
  to authenticated;

-- 6. start_dreambreaker: scoped auth, already-started idempotent, no score reset.
create or replace function public.team_tournament_start_dreambreaker(
  p_tournament_id text,
  p_matchup_id text,
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
  v_db public.team_tournament_dreambreaker_states;
  v_disc public.team_tournament_disciplines;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_sub_ext text;
  v_sub_id uuid;
  v_disc_ext text;
  v_disc_sort integer;
  v_guard jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_guard := public.team_tournament_result_write_guard(v_header, v_matchup, null);
  if not coalesce((v_guard->>'ok')::boolean, false) then
    return v_guard;
  end if;

  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null then
    return json_build_object(
      'ok', false,
      'code', 'NOT_ACTIVATED',
      'error', 'Dreambreaker chưa sẵn sàng — cần tỉ số 2–2 và chính sách DREAMBREAKER.'
    );
  end if;

  if v_db.status in ('in_progress', 'completed') then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'alreadyStarted', true,
      'code', 'ALREADY_STARTED',
      'version', v_db.version,
      'status', v_db.status,
      'subMatchId', v_db.sub_match_external_id
    );
  end if;

  if jsonb_array_length(coalesce(v_db.team_a_order, '[]'::jsonb)) <> 4
     or jsonb_array_length(coalesce(v_db.team_b_order, '[]'::jsonb)) <> 4 then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Hai đội phải có thứ tự 4 VĐV.');
  end if;
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu dreambreaker.version.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'start_dreambreaker', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if v_db.version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states', p_expected_version, v_db.version
    );
  end if;

  select * into v_disc
  from (
    select d.*,
      case
        when lower(coalesce(d.discipline_kind, '')) = 'dreambreaker' then 1
        when lower(coalesce(d.activation_rule, '')) = 'tie_at_2_2' then 2
        when lower(coalesce(d.activation_rule, '')) = 'dreambreaker' then 3
        when lower(coalesce(d.name, '')) like '%dreambreaker%'
          or lower(coalesce(d.external_discipline_id, '')) like '%dreambreaker%'
          or lower(coalesce(d.discipline_kind, '')) like '%dreambreaker%' then 4
        else null
      end as match_rank
    from public.team_tournament_disciplines d
    where d.team_tournament_id = v_header.id
  ) ranked
  where match_rank is not null
  order by match_rank, sort_order nulls last
  limit 1;

  if v_disc.id is null then
    v_disc_ext := 'dreambreaker';
    v_disc_sort := 99;
  else
    v_disc_ext := v_disc.external_discipline_id;
    v_disc_sort := coalesce(v_disc.sort_order, 99);
  end if;

  v_sub_ext := coalesce(nullif(trim(v_db.sub_match_external_id), ''), 'db-' || p_matchup_id);
  select id into v_sub_id from public.team_tournament_sub_matches
  where matchup_id = v_matchup.id and external_sub_match_id = v_sub_ext;
  if v_sub_id is null then
    insert into public.team_tournament_sub_matches (
      tenant_id, tournament_id, matchup_id, discipline_external_id, external_sub_match_id,
      sort_order, status, score, winner_team_id, version, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, v_disc_ext, v_sub_ext,
      v_disc_sort, 'playing',
      jsonb_build_object('teamA', 0, 'teamB', 0, 'games', '[]'::jsonb),
      null, 1, auth.uid()
    )
    returning id into v_sub_id;
  end if;

  update public.team_tournament_dreambreaker_states set
    status = 'in_progress',
    sub_match_external_id = v_sub_ext,
    team_a_score = 0,
    team_b_score = 0,
    winner_team_id = null,
    rotation = jsonb_build_object(
      'segmentIndex', 0, 'pointsInSegment', 0, 'pointHistory', '[]'::jsonb,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    orders_locked_at = coalesce(orders_locked_at, now()),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_db.id
    and status = 'ready'
    and version = p_expected_version
  returning * into v_db;

  if v_db.id is null then
    select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
    if v_db.status in ('in_progress', 'completed') then
      return json_build_object(
        'ok', true,
        'replayed', true,
        'alreadyStarted', true,
        'code', 'ALREADY_STARTED',
        'version', v_db.version,
        'status', v_db.status,
        'subMatchId', v_db.sub_match_external_id
      );
    end if;
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states', p_expected_version, v_db.version
    );
  end if;

  update public.team_tournament_matchups
     set status = 'in_progress', updated_at = now(), updated_by = auth.uid()
   where id = v_matchup.id;

  perform public.team_tournament_ensure_referee_runtime_for_matchup(
    v_header, v_matchup, v_sub_ext
  );

  v_result := jsonb_build_object(
    'ok', true,
    'version', v_db.version,
    'status', v_db.status,
    'subMatchId', v_sub_ext
  );
  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.match.dreambreaker.start', p_matchup_id, v_result
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'start_dreambreaker', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_start_dreambreaker(text, text, integer, text)
  from public, anon;
grant execute on function public.team_tournament_start_dreambreaker(text, text, integer, text)
  to authenticated;

-- 7. confirm_sub_match: assignment-scoped write (organizer can_manage remains).
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
  v_guard jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'MISSING_EXPECTED_VERSION', 'error', 'p_expected_version (subMatch.version) is required.');
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object('ok', false, 'code', 'MISSING_IDEMPOTENCY_KEY', 'error', 'p_idempotency_key is required.');
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

  v_guard := public.team_tournament_result_write_guard(v_header, v_matchup, v_sub_match);
  if not coalesce((v_guard->>'ok')::boolean, false) then
    return v_guard;
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

  if v_sub_match.version is distinct from p_expected_version then
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
    and version = p_expected_version;
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
  perform public.team_tournament_ensure_referee_runtime_for_matchup(v_header, v_matchup, null);

  v_result := jsonb_build_object(
    'ok', true,
    'winnerTeamId', v_winner,
    'version', p_expected_version + 1,
    'matchupResult', coalesce(v_matchup.result, v_result) || jsonb_build_object(
      'matchupCompleted', v_matchup.status = 'completed',
      'ok', true
    ),
    'dreambreaker', v_db,
    'code', case
      when coalesce(v_db->>'code', '') = 'DREAMBREAKER_REQUIRED' then 'DREAMBREAKER_REQUIRED'
      else null
    end
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.match.confirm_sub_match', p_sub_match_id,
    jsonb_build_object('winnerTeamId', v_winner, 'score', p_score, 'dreambreaker', v_db)
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match',
    p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  from public, anon;
grant execute on function public.team_tournament_confirm_sub_match(text, text, text, jsonb, text, integer, text)
  to authenticated;

-- 8. save_sub_match_draft: same scoped write guard.
create or replace function public.team_tournament_save_sub_match_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_expected_version integer,
  p_idempotency_key text
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
  v_score_ops jsonb;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_new_version integer;
  v_guard jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'MISSING_EXPECTED_VERSION', 'error', 'p_expected_version (subMatch.version) is required.');
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object('ok', false, 'code', 'MISSING_IDEMPOTENCY_KEY', 'error', 'p_idempotency_key is required.');
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
  if v_matchup.status not in ('published', 'in_progress', 'completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;
  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_guard := public.team_tournament_result_write_guard(v_header, v_matchup, v_sub_match);
  if not coalesce((v_guard->>'ok')::boolean, false) then
    return v_guard;
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'score', p_score, 'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  if v_sub_match.version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_score_ops := public.team_tournament_sub_match_score_ops(v_header, v_matchup, v_sub_match);
  if not coalesce((v_score_ops->>'canSaveDraft')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_score_ops->>'blockCode', 'referee_v5_linked_legacy_write_blocked'),
      'error', coalesce(v_score_ops->>'blockMessage', 'Legacy draft bị khóa.')
    );
  end if;
  if v_sub_match.result_confirmed_at is not null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Kết quả đã xác nhận — không lưu nháp qua draft path.');
  end if;
  if v_sub_match.status = 'completed' then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Trận con đã hoàn thành — không lưu nháp qua draft path.');
  end if;

  update public.team_tournament_sub_matches set
    status = 'playing',
    score = p_score,
    winner_team_id = null,
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_sub_match.id
    and version = p_expected_version;
  if not found then
    select version into v_sub_match.version from public.team_tournament_sub_matches where id = v_sub_match.id;
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  v_new_version := p_expected_version + 1;
  if v_matchup.status = 'published' then
    update public.team_tournament_matchups set
      status = 'in_progress', updated_at = now(), updated_by = auth.uid()
    where id = v_matchup.id;
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'version', v_new_version, 'subMatchId', p_sub_match_id, 'matchupId', p_matchup_id
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft',
    p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text)
  from public, anon;
grant execute on function public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text)
  to authenticated;

-- 9. record_dreambreaker_point: same scoped write guard (DB scoring).
create or replace function public.team_tournament_record_dreambreaker_point(
  p_tournament_id text,
  p_matchup_id text,
  p_scoring_team_id text,
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
  v_db public.team_tournament_dreambreaker_states;
  v_disc public.team_tournament_disciplines;
  v_updated public.team_tournament_dreambreaker_states;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_a int;
  v_b int;
  v_hist jsonb;
  v_seg int;
  v_pts int;
  v_rot int;
  v_target int;
  v_win_by int;
  v_winner text := null;
  v_completed boolean := false;
  v_override jsonb;
  v_fmt jsonb;
  v_guard jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  select * into v_matchup from public.team_tournament_matchups
  where team_tournament_id = v_header.id and external_matchup_id = p_matchup_id;
  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  v_guard := public.team_tournament_result_write_guard(v_header, v_matchup, null);
  if not coalesce((v_guard->>'ok')::boolean, false) then
    return v_guard;
  end if;
  select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
  if v_db.id is null or v_db.status <> 'in_progress' then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Dreambreaker chưa bắt đầu.');
  end if;
  if p_scoring_team_id not in (v_matchup.team_a_id, v_matchup.team_b_id) then
    return json_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  if p_expected_version is null then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Thiếu dreambreaker.version.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'record_dreambreaker_point', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'scoringTeamId', p_scoring_team_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  v_override := coalesce(
    nullif(v_matchup.schedule_meta->'dreambreakerScoringFormat', 'null'::jsonb),
    nullif(v_matchup.schedule_meta->'dreambreaker'->'scoringFormat', 'null'::jsonb),
    '{}'::jsonb
  );
  select * into v_disc
  from (
    select d.*,
      case
        when lower(coalesce(d.discipline_kind, '')) = 'dreambreaker' then 1
        when lower(coalesce(d.activation_rule, '')) = 'tie_at_2_2' then 2
        when lower(coalesce(d.activation_rule, '')) = 'dreambreaker' then 3
        when lower(coalesce(d.name, '')) like '%dreambreaker%'
          or lower(coalesce(d.external_discipline_id, '')) like '%dreambreaker%'
          or lower(coalesce(d.discipline_kind, '')) like '%dreambreaker%' then 4
        else null
      end as match_rank
    from public.team_tournament_disciplines d
    where d.team_tournament_id = v_header.id
  ) ranked
  where match_rank is not null
  order by match_rank, sort_order nulls last
  limit 1;
  v_fmt := coalesce(v_disc.scoring_format, '{}'::jsonb);
  v_target := coalesce(
    case when (v_override->>'targetScore') ~ '^[1-9][0-9]*$' then (v_override->>'targetScore')::int end,
    case when (v_override->>'targetPoints') ~ '^[1-9][0-9]*$' then (v_override->>'targetPoints')::int end,
    case when (v_fmt->>'targetScore') ~ '^[1-9][0-9]*$' then (v_fmt->>'targetScore')::int end,
    case when (v_fmt->>'targetPoints') ~ '^[1-9][0-9]*$' then (v_fmt->>'targetPoints')::int end,
    21
  );
  v_win_by := coalesce(
    case when (v_override->>'winBy') ~ '^[1-9][0-9]*$' then (v_override->>'winBy')::int end,
    case when (v_fmt->>'winBy') ~ '^[1-9][0-9]*$' then (v_fmt->>'winBy')::int end,
    2
  );
  v_rot := coalesce(
    case when (v_override->>'rotationPoints') ~ '^[1-9][0-9]*$' then (v_override->>'rotationPoints')::int end,
    case when (v_fmt->>'rotationPoints') ~ '^[1-9][0-9]*$' then (v_fmt->>'rotationPoints')::int end,
    4
  );

  v_a := v_db.team_a_score + case when p_scoring_team_id = v_matchup.team_a_id then 1 else 0 end;
  v_b := v_db.team_b_score + case when p_scoring_team_id = v_matchup.team_b_id then 1 else 0 end;
  v_seg := coalesce((v_db.rotation->>'segmentIndex')::int, 0);
  v_pts := coalesce((v_db.rotation->>'pointsInSegment')::int, 0) + 1;
  v_hist := coalesce(v_db.rotation->'pointHistory', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('teamId', p_scoring_team_id, 'segmentIndex', v_seg, 'teamAScore', v_a, 'teamBScore', v_b)
  );
  if v_pts >= v_rot then v_seg := v_seg + 1; v_pts := 0; end if;
  if greatest(v_a, v_b) >= v_target and abs(v_a - v_b) >= v_win_by then
    v_winner := case when v_a > v_b then v_matchup.team_a_id else v_matchup.team_b_id end;
    v_completed := true;
  end if;

  update public.team_tournament_dreambreaker_states set
    team_a_score = v_a, team_b_score = v_b, winner_team_id = v_winner,
    status = case when v_completed then 'completed' else 'in_progress' end,
    rotation = jsonb_build_object(
      'segmentIndex', v_seg, 'pointsInSegment', v_pts, 'pointHistory', v_hist,
      'injurySkips', coalesce(rotation->'injurySkips', '[]'::jsonb)
    ),
    version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = v_db.id
    and version = p_expected_version
  returning * into v_updated;
  if v_updated.id is null then
    select * into v_db from public.team_tournament_dreambreaker_states where matchup_id = v_matchup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_dreambreaker_states', p_expected_version, v_db.version
    );
  end if;
  v_db := v_updated;

  if v_db.sub_match_external_id is not null then
    update public.team_tournament_sub_matches set
      score = jsonb_build_object('teamA', v_a, 'teamB', v_b, 'games', '[]'::jsonb),
      status = case when v_completed then 'completed' else 'playing' end,
      winner_team_id = v_winner,
      result_confirmed_at = case when v_completed then now() else result_confirmed_at end,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
    where matchup_id = v_matchup.id and external_sub_match_id = v_db.sub_match_external_id;
  end if;
  if v_completed then
    perform public.team_tournament_recompute_matchup_result(v_matchup.id);
    perform public.team_tournament_recompute_standings_cache(v_header.id);
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'version', v_db.version, 'teamAScore', v_a, 'teamBScore', v_b,
    'completed', v_completed, 'winnerTeamId', v_winner, 'status', v_db.status,
    'scoringFormat', jsonb_build_object('targetScore', v_target, 'winBy', v_win_by, 'rotationPoints', v_rot)
  );
  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.match.dreambreaker.point', p_matchup_id, v_result
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'record_dreambreaker_point', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_record_dreambreaker_point(text, text, text, integer, text)
  from public, anon;
grant execute on function public.team_tournament_record_dreambreaker_point(text, text, text, integer, text)
  to authenticated;

-- 10. Discovery: parent assignment is one task; do not treat matchup id as V5 match id.
create or replace function public.team_tournament_list_my_referee_assignments(
  p_tournament_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  if to_regclass('public.referee_assignments') is null then
    return jsonb_build_object('ok', true, 'assignments', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', ra.id,
    'refereeUserId', ra.referee_user_id,
    'scope', case when ra.sub_match_id is null then 'parent' else 'child' end,
    'matchId', case
      when ra.sub_match_id is null then null
      else ra.match_id
    end,
    'assignmentMatchId', ra.match_id,
    'externalMatchupId', coalesce(ra.external_matchup_id, ra.match_id),
    'matchupId', coalesce(ra.external_matchup_id, ra.match_id),
    'externalSubMatchId', ra.external_sub_match_id,
    'status', ra.status
  ) order by ra.assigned_at desc), '[]'::jsonb)
  into v_items
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.referee_user_id = auth.uid()
    and ra.revoked_at is null
    and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
      in ('pending', 'active');

  return jsonb_build_object('ok', true, 'assignments', v_items);
end;
$$;

revoke all on function public.team_tournament_list_my_referee_assignments(text)
  from public, anon;
grant execute on function public.team_tournament_list_my_referee_assignments(text)
  to authenticated;
