-- Phase TT-2D — Missing-lineup policy, server-side randomize, lock workflow
-- Prerequisite: PHASE_23C + TT-1B + TT-2B + TT-2C on staging
-- Safe to re-run (create or replace). Staging only.

-- ─── Policy normalization ───
create or replace function public.team_tournament_normalize_missing_lineup_policy(p_policy text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_policy, '')))
    when 'random' then 'random'
    when 'forfeit' then 'forfeit_pending'
    when 'forfeit_pending' then 'forfeit_pending'
    when 'btc_override' then 'manual_pending'
    when 'manual' then 'manual_pending'
    when 'manual_pending' then 'manual_pending'
    else 'random'
  end;
$$;

create or replace function public.team_tournament_lineup_is_submitted(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status, 'not_submitted') in ('submitted', 'locked', 'published');
$$;

create or replace function public.team_tournament_lineup_policy_handled(
  p_lineup public.team_tournament_lineups,
  p_policy text
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_policy text := public.team_tournament_normalize_missing_lineup_policy(p_policy);
begin
  if p_lineup.id is null then
    return false;
  end if;

  if public.team_tournament_lineup_is_submitted(p_lineup.status) then
    return true;
  end if;

  if v_policy = 'random' then
    return p_lineup.source = 'random'
      and coalesce(p_lineup.selections, '{}'::jsonb) <> '{}'::jsonb
      and p_lineup.status in ('submitted', 'locked', 'published');
  end if;

  if v_policy = 'forfeit_pending' then
    return coalesce(p_lineup.audit_note, '') like 'tt2d:forfeit_pending%';
  end if;

  if v_policy = 'manual_pending' then
    return coalesce(p_lineup.audit_note, '') like 'tt2d:manual_resolved%';
  end if;

  return false;
end;
$$;

create or replace function public.team_tournament_deadline_passed(
  p_lineup_lock_at timestamptz,
  p_now timestamptz default now()
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_lineup_lock_at is not null and p_now >= p_lineup_lock_at;
$$;

-- ─── Greedy random lineup builder (uses TT-2C validator) ───
create or replace function public.team_tournament_build_random_lineup_selections(
  p_header public.team_tournaments,
  p_team_external_id text,
  p_matchup_id text,
  p_seed text default null,
  p_allow_reuse boolean default null
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_team public.team_tournament_teams;
  v_matchup public.team_tournament_matchups;
  v_discipline record;
  v_selections jsonb := '{}'::jsonb;
  v_used text[] := '{}'::text[];
  v_player_id text;
  v_candidates text[];
  v_males text[];
  v_females text[];
  v_male text;
  v_female text;
  v_partial jsonb;
  v_validation jsonb;
  v_allow_reuse boolean;
  v_seed text := coalesce(nullif(trim(p_seed), ''), p_matchup_id || ':' || p_team_external_id);
  v_gender_req text;
  v_gender_key text;
  v_count int;
begin
  select * into v_team
  from public.team_tournament_teams t
  where t.team_tournament_id = p_header.id
    and t.external_team_id = p_team_external_id;

  if v_team.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Không tìm thấy đội.');
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = p_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Không tìm thấy matchup.');
  end if;

  v_allow_reuse := coalesce(
    p_allow_reuse,
    coalesce((p_header.settings->>'allowPlayerReusePerMatchup')::boolean, false)
  );

  for v_discipline in
    select *
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
    order by d.sort_order
  loop
    v_gender_req := v_discipline.gender_requirement;

    select coalesce(array_agg(m.player_id order by md5(m.player_id || v_seed)), '{}'::text[])
    into v_candidates
    from public.team_tournament_team_members m
    where m.team_id = v_team.id
      and not (m.player_id = any(coalesce(v_team.absent_player_ids, '{}'::text[])))
      and not (m.player_id = any(coalesce(v_team.locked_player_ids, '{}'::text[])))
      and lower(public.team_tournament_resolve_player_status(m.player_id)) in ('active', 'unknown')
      and (v_allow_reuse or not (m.player_id = any(v_used)))
      and (
        v_gender_req = 'any'
        or (v_gender_req = 'male' and public.team_tournament_resolve_player_gender_key(
          m.player_id, p_header.tenant_id, p_header.club_id
        ) = 'male')
        or (v_gender_req = 'female' and public.team_tournament_resolve_player_gender_key(
          m.player_id, p_header.tenant_id, p_header.club_id
        ) = 'female')
        or v_gender_req = 'mixed_pair'
      );

    if v_gender_req = 'mixed_pair' and v_discipline.player_count = 2 then
      v_males := '{}'::text[];
      v_females := '{}'::text[];
      foreach v_player_id in array v_candidates loop
        v_gender_key := public.team_tournament_resolve_player_gender_key(
          v_player_id, p_header.tenant_id, p_header.club_id
        );
        if v_gender_key = 'male' then
          v_males := array_append(v_males, v_player_id);
        elsif v_gender_key = 'female' then
          v_females := array_append(v_females, v_player_id);
        end if;
      end loop;

      v_partial := null;
      if array_length(v_males, 1) >= 1 and array_length(v_females, 1) >= 1 then
        v_partial := jsonb_build_object(
          v_discipline.external_discipline_id,
          jsonb_build_array(v_males[1], v_females[1])
        );
        v_selections := v_selections || v_partial;
        if not v_allow_reuse then
          v_used := array_append(array_append(v_used, v_males[1]), v_females[1]);
        end if;
      end if;

      if not (v_selections ? v_discipline.external_discipline_id) then
        return jsonb_build_object(
          'ok', false,
          'code', 'randomize_failed',
          'message', format('%s: không đủ cặp nam/nữ để random.', v_discipline.name)
        );
      end if;
      continue;
    end if;

    v_count := 0;
    v_partial := '[]'::jsonb;
    foreach v_player_id in array v_candidates loop
      if not v_allow_reuse and v_player_id = any(v_used) then
        continue;
      end if;
      v_partial := v_partial || to_jsonb(v_player_id);
      v_count := v_count + 1;
      if v_count = v_discipline.player_count then
        exit;
      end if;
    end loop;

    if v_count <> v_discipline.player_count then
      return jsonb_build_object(
        'ok', false,
        'code', 'randomize_failed',
        'message', format('%s: không đủ VĐV hợp lệ để random.', v_discipline.name)
      );
    end if;

    v_selections := v_selections || jsonb_build_object(
      v_discipline.external_discipline_id,
      v_partial
    );

    if not v_allow_reuse then
      for v_player_id in
        select jsonb_array_elements_text(v_partial)
      loop
        v_used := array_append(v_used, v_player_id);
      end loop;
    end if;
  end loop;

  v_validation := public.team_tournament_validate_lineup_selections(
    p_header, p_team_external_id, p_matchup_id, v_selections, true
  );

  if not coalesce((v_validation->>'ok')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'code', coalesce(v_validation->>'code', 'randomize_failed'),
      'message', coalesce(v_validation->>'message', v_validation->>'error', 'Không tạo được đội hình random.'),
      'validation', v_validation
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'selections', v_selections,
    'allowReuse', v_allow_reuse
  );
end;
$$;

-- ─── Matchup lineup ops snapshot (BTC UI) ───
create or replace function public.team_tournament_matchup_lineup_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_policy text;
  v_deadline_passed boolean;
  v_team_id text;
  v_lineup public.team_tournament_lineups;
  v_teams jsonb := '[]'::jsonb;
  v_missing text[] := '{}'::text[];
  v_unhandled text[] := '{}'::text[];
  v_can_randomize text[] := '{}'::text[];
  v_can_lock boolean := false;
  v_matchup_open boolean;
begin
  v_policy := public.team_tournament_normalize_missing_lineup_policy(p_header.settings->>'missingLineupPolicy');
  v_deadline_passed := public.team_tournament_deadline_passed(p_matchup.lineup_lock_at, p_now);
  v_matchup_open := p_matchup.status in ('scheduled', 'lineup_open');

  foreach v_team_id in array array[p_matchup.team_a_id, p_matchup.team_b_id] loop
    select * into v_lineup
    from public.team_tournament_lineups l
    where l.matchup_id = p_matchup.id
      and l.team_external_id = v_team_id;

    v_teams := v_teams || jsonb_build_array(jsonb_build_object(
      'teamId', v_team_id,
      'status', coalesce(v_lineup.status, 'not_submitted'),
      'source', coalesce(v_lineup.source, 'captain'),
      'submitted', public.team_tournament_lineup_is_submitted(coalesce(v_lineup.status, 'not_submitted')),
      'policyHandled', public.team_tournament_lineup_policy_handled(v_lineup, v_policy),
      'version', v_lineup.version,
      'auditNote', v_lineup.audit_note
    ));

    if not public.team_tournament_lineup_is_submitted(coalesce(v_lineup.status, 'not_submitted')) then
      v_missing := array_append(v_missing, v_team_id);
      if not public.team_tournament_lineup_policy_handled(v_lineup, v_policy) then
        v_unhandled := array_append(v_unhandled, v_team_id);
      end if;
      if v_policy = 'random'
        and v_deadline_passed
        and v_matchup_open
        and not public.team_tournament_lineup_policy_handled(v_lineup, v_policy)
      then
        v_can_randomize := array_append(v_can_randomize, v_team_id);
      end if;
    end if;
  end loop;

  v_can_lock := v_matchup_open and (
    cardinality(v_missing) = 0
    or (
      v_deadline_passed and (
        v_policy in ('random', 'forfeit_pending')
        or cardinality(v_unhandled) = 0
      )
    )
  );

  return jsonb_build_object(
    'policy', v_policy,
    'deadlinePassed', v_deadline_passed,
    'teams', v_teams,
    'missingTeamIds', to_jsonb(v_missing),
    'unhandledMissingTeamIds', to_jsonb(v_unhandled),
    'canLock', v_can_lock,
    'canRandomizeTeamIds', to_jsonb(v_can_randomize),
    'allowedActions', case
      when v_can_lock and cardinality(v_can_randomize) > 0 then '["randomize","lock"]'::jsonb
      when v_can_lock then '["lock"]'::jsonb
      when cardinality(v_can_randomize) > 0 then '["randomize"]'::jsonb
      else '[]'::jsonb
    end
  );
end;
$$;

-- ─── Mark forfeit/manual policy (no full forfeit in TT-2D) ───
create or replace function public.team_tournament_mark_missing_lineup_policy(
  p_lineup public.team_tournament_lineups,
  p_policy text,
  p_actor_note text default null
)
returns public.team_tournament_lineups
language plpgsql
set search_path = public
as $$
declare
  v_policy text := public.team_tournament_normalize_missing_lineup_policy(p_policy);
  v_marker text;
begin
  if v_policy = 'forfeit_pending' then
    v_marker := 'tt2d:forfeit_pending';
  elsif v_policy = 'manual_pending' then
    v_marker := 'tt2d:manual_pending';
  else
    return p_lineup;
  end if;

  update public.team_tournament_lineups l
  set audit_note = coalesce(p_actor_note, v_marker),
      updated_at = now(),
      updated_by = auth.uid(),
      version = l.version + 1
  where l.id = p_lineup.id
  returning * into p_lineup;

  return p_lineup;
end;
$$;

-- ─── RPC: randomize lineup (server-side only) ───
create or replace function public.team_tournament_randomize_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
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
  v_lineup public.team_tournament_lineups;
  v_team public.team_tournament_teams;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_policy text;
  v_built jsonb;
  v_now timestamptz := now();
  v_version_before int;
  v_version_after int;
  v_allow_reuse boolean;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.lock')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_policy := public.team_tournament_normalize_missing_lineup_policy(v_header.settings->>'missingLineupPolicy');
  if v_policy <> 'random' then
    return json_build_object('ok', false, 'code', 'POLICY_BLOCKED', 'message', 'Chính sách không cho random.');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'randomize_lineup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'teamId', p_team_id, 'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if v_matchup.status not in ('scheduled', 'lineup_open') then
    return json_build_object('ok', false, 'code', 'MATCHUP_LOCKED', 'message', 'Matchup đã khóa.');
  end if;

  if not public.team_tournament_deadline_passed(v_matchup.lineup_lock_at, v_now) then
    return json_build_object('ok', false, 'code', 'DEADLINE_NOT_PASSED', 'message', 'Chưa hết hạn nộp đội hình.');
  end if;

  select * into v_team
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id
    and t.external_team_id = p_team_id;

  if v_team.id is null or p_team_id not in (v_matchup.team_a_id, v_matchup.team_b_id) then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Đội không thuộc matchup.');
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_id
  for update;

  if v_lineup.id is null then
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id, status, selections, source
    ) values (
      v_header.tenant_id, p_tournament_id, v_matchup.id, p_team_id, 'not_submitted', '{}'::jsonb, 'captain'
    )
    returning * into v_lineup;
  end if;

  if public.team_tournament_lineup_is_submitted(v_lineup.status) then
    return json_build_object('ok', false, 'code', 'ALREADY_SUBMITTED', 'message', 'Đội đã nộp đội hình.');
  end if;

  if v_lineup.status = 'locked' then
    return json_build_object('ok', false, 'code', 'LINEUP_LOCKED', 'message', 'Đội hình đã khóa.');
  end if;

  if p_expected_version is not null and v_lineup.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_version, v_lineup.version
    );
  end if;

  v_version_before := v_lineup.version;
  v_allow_reuse := coalesce((v_header.settings->>'allowPlayerReusePerMatchup')::boolean, false);
  v_before := jsonb_build_object(
    'status', v_lineup.status,
    'source', v_lineup.source,
    'selections', v_lineup.selections,
    'version', v_lineup.version
  );

  v_built := public.team_tournament_build_random_lineup_selections(
    v_header, p_team_id, p_matchup_id,
    coalesce(p_idempotency_key, p_matchup_id || ':' || p_team_id),
    v_allow_reuse
  );

  if not coalesce((v_built->>'ok')::boolean, false) and not v_allow_reuse then
    v_built := public.team_tournament_build_random_lineup_selections(
      v_header, p_team_id, p_matchup_id,
      coalesce(p_idempotency_key, p_matchup_id || ':' || p_team_id) || ':reuse',
      true
    );
  end if;

  if not coalesce((v_built->>'ok')::boolean, false) then
    perform public.team_tournament_mark_missing_lineup_policy(v_lineup, 'manual_pending', 'tt2d:manual_pending');
    perform public.team_tournament_write_audit(
      v_header.tenant_id, p_tournament_id, 'team.lineup.randomize_failed', p_matchup_id,
      jsonb_build_object(
        'teamId', p_team_id,
        'policy', v_policy,
        'code', coalesce(v_built->>'code', 'randomize_failed'),
        'message', coalesce(v_built->>'message', 'Random thất bại'),
        'requestId', p_idempotency_key,
        'versionBefore', v_version_before
      )
    );
    return json_build_object(
      'ok', false,
      'code', coalesce(v_built->>'code', 'randomize_failed'),
      'message', coalesce(v_built->>'message', 'Không tạo được đội hình random.'),
      'manualPending', true,
      'validation', v_built->'validation'
    );
  end if;

  update public.team_tournament_lineups l
  set status = 'submitted',
      source = 'random',
      selections = v_built->'selections',
      submitted_at = v_now,
      audit_note = format('tt2d:random:%s', v_now),
      updated_at = v_now,
      updated_by = auth.uid(),
      version = l.version + 1
  where l.id = v_lineup.id
    and (p_expected_version is null or l.version = p_expected_version)
  returning l.selections, l.version into v_after, v_version_after;

  if not found then
    select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_version, v_lineup.version
    );
  end if;

  perform public.team_tournament_sync_lineup_entries(
    v_lineup.id, v_header.tenant_id, p_tournament_id, v_after
  );

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id, p_tournament_id, v_lineup.id, 'randomize',
    v_lineup.status, 'submitted', v_before->'selections', v_after,
    v_version_before, v_version_after, null, p_idempotency_key
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.randomize', p_matchup_id,
    jsonb_build_object(
      'teamId', p_team_id,
      'policy', v_policy,
      'action', 'randomize',
      'before', v_before,
      'after', jsonb_build_object(
        'status', 'submitted',
        'source', 'random',
        'selections', v_after,
        'version', v_version_after
      ),
      'requestId', p_idempotency_key,
      'versionBefore', v_version_before,
      'versionAfter', v_version_after,
      'serverTime', v_now
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'randomized',
    'version', v_version_after,
    'lineupVersion', v_version_after,
    'matchupVersion', v_matchup.version,
    'teamId', p_team_id,
    'source', 'random',
    'selections', v_after,
    'serverTime', v_now
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'randomize_lineup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ─── RPC: lock matchup (policy-aware, TT-2D) ───
create or replace function public.team_tournament_lock_matchup(
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
  v_lineup public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_lock_time timestamptz := now();
  v_policy text;
  v_ops jsonb;
  v_team_id text;
  v_random json;
  v_before jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.lock')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_policy := public.team_tournament_normalize_missing_lineup_policy(v_header.settings->>'missingLineupPolicy');

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'lock_matchup', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_version is not null and v_matchup.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  if v_matchup.status not in ('scheduled', 'lineup_open') then
    return json_build_object('ok', false, 'code', 'MATCHUP_LOCKED', 'message', 'Matchup đã khóa.');
  end if;

  v_ops := public.team_tournament_matchup_lineup_ops(v_header, v_matchup, v_lock_time);

  if not coalesce((v_ops->>'canLock')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', 'CANNOT_LOCK',
      'message', 'Chưa đủ điều kiện khóa đội hình.',
      'lineupOps', v_ops
    );
  end if;

  v_before := jsonb_build_object('matchupStatus', v_matchup.status, 'version', v_matchup.version);

  -- Apply missing-lineup policy for unhandled teams at deadline
  for v_team_id in
    select jsonb_array_elements_text(v_ops->'unhandledMissingTeamIds')
  loop
    select * into v_lineup
    from public.team_tournament_lineups l
    where l.matchup_id = v_matchup.id and l.team_external_id = v_team_id
    for update;

    if v_policy = 'random' then
      v_random := public.team_tournament_randomize_lineup(
        p_tournament_id, p_matchup_id, v_team_id, v_lineup.version, p_idempotency_key || ':auto:' || v_team_id
      );
      if not coalesce((v_random->>'ok')::boolean, false) then
        return v_random;
      end if;
    elsif v_policy = 'forfeit_pending' then
      if v_lineup.id is null then
        insert into public.team_tournament_lineups (
          tenant_id, tournament_id, matchup_id, team_external_id, status, selections, source, audit_note
        ) values (
          v_header.tenant_id, p_tournament_id, v_matchup.id, v_team_id,
          'not_submitted', '{}'::jsonb, 'captain', 'tt2d:forfeit_pending'
        );
      else
        perform public.team_tournament_mark_missing_lineup_policy(v_lineup, 'forfeit_pending');
      end if;
      perform public.team_tournament_write_audit(
        v_header.tenant_id, p_tournament_id, 'team.lineup.forfeit_pending', p_matchup_id,
        jsonb_build_object('teamId', v_team_id, 'policy', v_policy, 'requestId', p_idempotency_key)
      );
    else
      return json_build_object(
        'ok', false,
        'code', 'MANUAL_PENDING',
        'message', 'Đội thiếu lineup — cần xử lý thủ công trước khi khóa.',
        'teamId', v_team_id
      );
    end if;
  end loop;

  update public.team_tournament_lineups set
    status = 'locked', locked_at = v_lock_time, version = version + 1, updated_at = v_lock_time, updated_by = auth.uid()
  where matchup_id = v_matchup.id and status in ('submitted','draft','not_submitted');

  update public.team_tournament_matchups set
    status = 'locked', version = version + 1, updated_at = v_lock_time, updated_by = auth.uid()
  where id = v_matchup.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    select version into v_matchup.version from public.team_tournament_matchups where id = v_matchup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.lock', p_matchup_id,
    jsonb_build_object(
      'policy', v_policy,
      'action', 'lock',
      'before', v_before,
      'after', jsonb_build_object('matchupStatus', 'locked', 'lockedAt', v_lock_time),
      'requestId', p_idempotency_key,
      'versionBefore', p_expected_version,
      'versionAfter', v_matchup.version,
      'serverTime', v_lock_time
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'code', 'locked',
    'version', v_matchup.version,
    'lockedAt', v_lock_time,
    'canLock', true
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'lock_matchup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ─── get_setup: attach lineup ops per matchup for BTC ───
create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_is_manage boolean;
  v_viewer_team_id text;
  v_teams json;
  v_disciplines json;
  v_matchups json;
  v_lineups json;
  v_standings json;
  v_server_time timestamptz := now();
  v_summary jsonb;
  v_lineup_deadline timestamptz;
  v_can_save_draft boolean := false;
  v_can_submit boolean := false;
  v_deadline_status text := 'locked';
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy giải.');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_player_id := public.team_tournament_user_player_id();
  v_is_manage := public.team_tournament_can_manage();

  v_viewer_team_id := nullif(trim(coalesce(p_viewer_team_id, '')), '');
  if v_viewer_team_id is null and v_player_id is not null then
    select t.external_team_id
    into v_viewer_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    order by t.created_at
    limit 1;
  end if;

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'logoUrl', t.logo_url,
    'captainPlayerId', t.captain_player_id,
    'deputyPlayerIds', t.deputy_player_ids,
    'playerIds', coalesce((
      select json_agg(m.player_id order by m.role desc, m.created_at)
      from public.team_tournament_team_members m where m.team_id = t.id
    ), '[]'::json),
    'absentPlayerIds', t.absent_player_ids,
    'lockedPlayerIds', t.locked_player_ids
  )), '[]'::json)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'scoringFormat', d.scoring_format,
    'countsTowardResult', d.counts_toward_result
  ) order by d.sort_order), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select coalesce(json_agg(
    json_build_object(
      'id', m.external_matchup_id,
      'teamAId', m.team_a_id,
      'teamBId', m.team_b_id,
      'scheduledAt', m.scheduled_at,
      'lineupLockAt', m.lineup_lock_at,
      'lineupDeadline', m.lineup_lock_at,
      'courtLabel', m.court_label,
      'status', m.status,
      'result', m.result,
      'version', m.version,
      'canSaveDraft', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSaveDraft')::boolean
        else null
      end,
      'canSubmit', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then (public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'canSubmit')::boolean
        else null
      end,
      'deadlineStatus', case
        when v_viewer_team_id is not null
          and v_viewer_team_id in (m.team_a_id, m.team_b_id)
        then public.team_tournament_lineup_deadline_fields(
          m.lineup_lock_at,
          m.status,
          coalesce(vl.status, 'not_submitted'),
          vl.locked_at
        )->>'deadlineStatus'
        else null
      end,
      'lineupOps', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time) else null end,
      'canLock', case when v_is_manage then (public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->>'canLock')::boolean else null end,
      'missingTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'missingTeamIds' else null end,
      'canRandomizeTeamIds', case when v_is_manage then public.team_tournament_matchup_lineup_ops(v_header, m, v_server_time)->'canRandomizeTeamIds' else null end,
      'missingLineupPolicy', public.team_tournament_normalize_missing_lineup_policy(v_header.settings->>'missingLineupPolicy'),
      'subMatches', coalesce((
        select json_agg(json_build_object(
          'id', sm.external_sub_match_id,
          'disciplineId', sm.discipline_external_id,
          'sortOrder', sm.sort_order,
          'status', sm.status,
          'score', sm.score,
          'winnerTeamId', sm.winner_team_id,
          'resultConfirmedAt', sm.result_confirmed_at
        ) order by sm.sort_order)
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = m.id
      ), '[]'::json)
    )
    order by m.scheduled_at nulls last, m.external_matchup_id
  ), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  left join public.team_tournament_lineups vl
    on vl.matchup_id = m.id
   and vl.team_external_id = v_viewer_team_id
  where m.team_tournament_id = v_header.id;

  select coalesce(json_object_agg(
    m.external_matchup_id || '::' || l.team_external_id,
    json_build_object(
      'matchupId', m.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(v_viewer_team_id, '') then l.selections
        when m.status in ('published','in_progress','completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'auditNote', l.audit_note,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.view')
      or public.user_has_permission('team.standings.view')
      or public.team_tournament_can_manage_results()
      or l.team_external_id = coalesce(v_viewer_team_id, '')
      or m.status in ('published','in_progress','completed')
      or l.published_at is not null
    );

  select coalesce(json_agg(json_build_object(
    'teamId', s.team_external_id,
    'rank', s.rank,
    'played', s.played,
    'wins', s.wins,
    'losses', s.losses,
    'subMatchWins', s.sub_match_wins,
    'subMatchLosses', s.sub_match_losses,
    'subMatchDiff', s.sub_match_diff,
    'pointsScored', s.points_scored,
    'pointsConceded', s.points_conceded,
    'rankingPoints', s.ranking_points
  ) order by s.rank), '[]'::json)
  into v_standings
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id
    and (
      v_is_manage
      or public.user_has_permission('team.standings.view')
      or v_header.status in ('active','completed')
    );

  if v_viewer_team_id is not null then
    select public.team_tournament_lineup_deadline_fields(
      m.lineup_lock_at,
      m.status,
      coalesce(l.status, 'not_submitted'),
      l.locked_at
    )
    into v_summary
    from public.team_tournament_matchups m
    left join public.team_tournament_lineups l
      on l.matchup_id = m.id
     and l.team_external_id = v_viewer_team_id
    where m.team_tournament_id = v_header.id
      and v_viewer_team_id in (m.team_a_id, m.team_b_id)
      and m.status not in ('completed')
    order by
      case
        when m.lineup_lock_at is null then 1
        when now() < m.lineup_lock_at then 0
        else 2
      end,
      m.lineup_lock_at nulls last,
      m.scheduled_at nulls last
    limit 1;

    if v_summary is not null then
      v_lineup_deadline := (v_summary->>'lineupDeadline')::timestamptz;
      v_can_save_draft := coalesce((v_summary->>'canSaveDraft')::boolean, false);
      v_can_submit := coalesce((v_summary->>'canSubmit')::boolean, false);
      v_deadline_status := coalesce(v_summary->>'deadlineStatus', 'locked');
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'serverTime', v_server_time,
    'lineupDeadline', v_lineup_deadline,
    'canSaveDraft', v_can_save_draft,
    'canSubmit', v_can_submit,
    'deadlineStatus', v_deadline_status,
    'viewerTeamId', v_viewer_team_id,
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', v_header.settings,
      'teamData', json_build_object(
        'disciplines', v_disciplines,
        'teams', v_teams,
        'matchups', v_matchups,
        'lineups', v_lineups,
        'standings', v_standings,
        'settings', v_header.settings
      )
    )
  );
end;
$$;

revoke all on function public.team_tournament_randomize_lineup(text, text, text, integer, text) from public;
revoke all on function public.team_tournament_randomize_lineup(text, text, text, integer, text) from anon;
grant execute on function public.team_tournament_randomize_lineup(text, text, text, integer, text) to authenticated;

grant execute on function public.team_tournament_normalize_missing_lineup_policy(text) to authenticated;
grant execute on function public.team_tournament_matchup_lineup_ops(public.team_tournaments, public.team_tournament_matchups, timestamptz) to authenticated;
grant execute on function public.team_tournament_get_setup(text, text) to authenticated;
