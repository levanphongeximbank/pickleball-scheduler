-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-production-alignment-01
-- LOCAL / Owner GO only. Do NOT apply on Staging/Production without Owner GO.
-- Consolidated current-main frontend contract. Historical packages are
-- semantic sources only — this file does not include or EXECUTE them.
--
-- No business data DML.
-- No historical tournament backfill.
-- No captainAccessEnabled backfill.
-- No canonical-referee-lifecycle-01 continuation objects.
-- ═══════════════════════════════════════════════════════════════════

-- Operational ledger only (not tournament business data).
create table if not exists public.team_tournament_package_apply_ledger (
  package_id text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

create table if not exists public.team_tournament_alignment_01_prestate (
  proname text not null,
  args text not null,
  def text not null,
  captured_at timestamptz not null default now(),
  primary key (proname, args)
);

-- Snapshot drop/replace targets once, before first DROP. Second apply must not overwrite.
insert into public.team_tournament_alignment_01_prestate (proname, args, def)
select p.proname, pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    (p.proname = 'team_tournament_user_player_id')
    or (p.proname = 'team_tournament_get_setup'
        and pg_get_function_identity_arguments(p.oid) not like '%p_schema_version%')
    or (p.proname = 'team_tournament_save_lineup_draft'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_version%')
    or (p.proname = 'team_tournament_submit_lineup'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_version%')
    or (p.proname = 'team_tournament_publish_matchup'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_matchup_version%')
    or (p.proname = 'team_tournament_save_sub_match_draft'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_version%')
    or (p.proname = 'team_tournament_lock_matchup'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_version%')
    or (p.proname = 'team_tournament_confirm_sub_match'
        and pg_get_function_identity_arguments(p.oid) not like '%p_expected_version%')
    or (p.proname = 'team_tournament_write_lineup_revision'
        and pg_get_function_identity_arguments(p.oid) not like '%p_actor_role%'
        and array_length(p.proargnames, 1) = 12)
  )
on conflict (proname, args) do nothing;

insert into public.team_tournament_package_apply_ledger (package_id, notes)
values (
  'team-tournament-production-alignment-01',
  'canonical Team Tournament frontend contract alignment; no historical backfill'
)
on conflict (package_id) do nothing;

-- Drop proven obsolete overloads that collide with current frontend named-arg bodies.
drop function if exists public.team_tournament_get_setup(text, text);
drop function if exists public.team_tournament_save_lineup_draft(text, text, text, jsonb);
drop function if exists public.team_tournament_submit_lineup(text, text, text, jsonb);
drop function if exists public.team_tournament_publish_matchup(text, text);
drop function if exists public.team_tournament_save_sub_match_draft(text, text, text, jsonb);
drop function if exists public.team_tournament_lock_matchup(text, text);
drop function if exists public.team_tournament_confirm_sub_match(text, text, text, jsonb, text);
drop function if exists public.team_tournament_write_lineup_revision(
  text, text, uuid, text, text, text, jsonb, jsonb, integer, integer, text, text
);
drop function if exists public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb);
drop function if exists public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb, integer);

-- merge_mlp_initial_settings
create or replace function public.team_tournament_merge_mlp_initial_settings(p_settings jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'formatPreset', 'mlp_4',
    'rosterRules', jsonb_build_object(
      'teamSize', 4,
      'minPlayers', 4,
      'maxPlayers', 4,
      'requiredMales', 2,
      'requiredFemales', 2
    ),
    'allowPlayerReusePerMatchup', true,
    'allowPlayerCrossTeam', false,
    'dreambreakerEnabled', true,
    'lineupLockLeadMinutes', 15,
    'groupMode', 'single_pool',
    'groupCount', 1,
    'qualificationCount', 2,
    'knockoutFormat', 'top_n',
    'selectedCourtIds', '[]'::jsonb,
    'missingLineupPolicy', 'random',
    'tiebreakOrder', '["wins","subMatchDiff","pointsScored","manual"]'::jsonb
  ) || coalesce(p_settings, '{}'::jsonb);
$$;

-- seed_mlp_disciplines
create or replace function public.team_tournament_seed_mlp_disciplines(p_header public.team_tournaments)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rally jsonb := jsonb_build_object(
    'scoringSystem', 'rally',
    'matchFormat', 'rally_single',
    'targetScore', 21,
    'winBy', 2,
    'freezeAt', 20,
    'sideSwitchAt', 11,
    'winPoints', 1
  );
  v_dream jsonb;
begin
  if p_header.id is null then
    return;
  end if;
  if exists (
    select 1
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
  ) then
    return;
  end if;

  v_dream := v_rally || jsonb_build_object('sideSwitchAt', 20, 'rotationPoints', 4);

  insert into public.team_tournament_disciplines (
    tenant_id, tournament_id, team_tournament_id, external_discipline_id,
    name, category_type, gender_requirement, player_count, sort_order,
    scoring_format, counts_toward_result, discipline_kind, activation_rule, enabled, updated_at
  ) values
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-wd',
     'Đôi nữ', 'doubles', 'female', 2, 1, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-md',
     'Đôi nam', 'doubles', 'male', 2, 2, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-xd1',
     'Đôi nam nữ 1', 'mixed', 'mixed_pair', 2, 3, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'mlp-xd2',
     'Đôi nam nữ 2', 'mixed', 'mixed_pair', 2, 4, v_rally, true, 'doubles', 'always', true, now()),
    (p_header.tenant_id, p_header.tournament_id, p_header.id, 'dreambreaker',
     'Dreambreaker', 'singles', 'any', 1, 5, v_dream, true, 'dreambreaker', 'tie_at_2_2', true, now())
  on conflict (team_tournament_id, external_discipline_id) do nothing;
end;
$$;

-- initial_setup_team_data
create or replace function public.team_tournament_initial_setup_team_data(p_header public.team_tournaments)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'settings', coalesce(p_header.settings, '{}'::jsonb),
    'disciplines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.external_discipline_id,
        'name', d.name,
        'categoryType', d.category_type,
        'genderRequirement', d.gender_requirement,
        'playerCount', d.player_count,
        'sortOrder', d.sort_order,
        'scoringFormat', d.scoring_format,
        'countsTowardResult', d.counts_toward_result,
        'disciplineKind', d.discipline_kind,
        'activationRule', d.activation_rule,
        'enabled', d.enabled
      ) order by d.sort_order, d.external_discipline_id)
      from public.team_tournament_disciplines d
      where d.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.external_team_id,
        'name', t.name,
        'captainPlayerId', t.captain_player_id,
        'color', t.color
      ) order by t.name, t.external_team_id)
      from public.team_tournament_teams t
      where t.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.external_group_id,
        'name', g.name,
        'sortOrder', g.sort_order,
        'teamIds', to_jsonb(g.team_ids)
      ) order by g.sort_order, g.external_group_id)
      from public.team_tournament_groups g
      where g.team_tournament_id = p_header.id
    ), '[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.external_matchup_id,
        'teamAId', m.team_a_id,
        'teamBId', m.team_b_id
      ) order by m.external_matchup_id)
      from public.team_tournament_matchups m
      where m.team_tournament_id = p_header.id
    ), '[]'::jsonb)
  );
$$;

-- status_is_athlete_visible
create or replace function public.team_tournament_status_is_athlete_visible(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(nullif(trim(p_status), ''), 'draft')) in (
    'registration', 'ready', 'active', 'completed'
  );
$$;

-- can_view_dashboard
create or replace function public.team_tournament_can_view_dashboard(
  p_status text,
  p_can_manage boolean,
  p_is_captain_or_deputy boolean,
  p_is_assigned_referee boolean
)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_can_manage, false)
    or public.team_tournament_status_is_athlete_visible(p_status)
    or (
      lower(coalesce(nullif(trim(p_status), ''), 'draft')) = 'draft'
      and (
        coalesce(p_is_captain_or_deputy, false)
        or coalesce(p_is_assigned_referee, false)
      )
    );
$$;

-- user_player_id athletes canonical
create or replace function public.team_tournament_user_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.id::text
      from public.athletes a
      where a.user_id = auth.uid()
      order by a.updated_at desc nulls last, a.created_at desc nulls last
      limit 1
    ),
    ''
  );
$$;

-- captain_access_enabled
create or replace function public.team_tournament_captain_access_enabled(
  p_settings jsonb
)
returns boolean
language sql
immutable
as $$
  select coalesce((p_settings ->> 'captainAccessEnabled')::boolean, false);
$$;

-- assert_captain_portal_access
create or replace function public.team_tournament_assert_captain_portal_access(
  p_tournament_id text,
  p_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_player_id text;
  v_team_id text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if not public.team_tournament_captain_access_enabled(v_header.settings) then
    return json_build_object(
      'ok', false,
      'code', 'captain_portal_closed',
      'error', 'Portal đội trưởng chưa được mở.',
      'captainAccessEnabled', false
    );
  end if;

  v_player_id := public.team_tournament_user_player_id();
  if v_player_id is null or btrim(v_player_id) = '' then
    return json_build_object('ok', false, 'code', 'IDENTITY_UNPROVEN', 'error', 'Không xác định được danh tính vận động viên.');
  end if;

  v_team_id := nullif(trim(coalesce(p_team_id, '')), '');
  if v_team_id is null then
    select t.external_team_id
    into v_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
      )
    order by t.created_at
    limit 1;
  end if;

  if v_team_id is null then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Chỉ đội trưởng hoặc đội phó mới truy cập được.');
  end if;

  if not public.team_tournament_is_captain(v_header.id, v_team_id, v_player_id) then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền đội này.');
  end if;

  return json_build_object(
    'ok', true,
    'captainAccessEnabled', true,
    'viewerTeamId', v_team_id,
    'viewerPlayerId', v_player_id,
    'tournamentId', v_header.tournament_id,
    'version', v_header.version
  );
end;
$$;

-- guard_captain_portal_write
create or replace function public.team_tournament_guard_captain_portal_write(
  p_header public.team_tournaments,
  p_team_id text
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player_id text;
begin
  -- Organizer/manage bypass (does not grant captain role; keeps BTC tools working).
  if public.team_tournament_can_manage() then
    return json_build_object('ok', true, 'bypass', 'manage');
  end if;

  if not public.team_tournament_captain_access_enabled(p_header.settings) then
    return json_build_object(
      'ok', false,
      'code', 'captain_portal_closed',
      'error', 'Portal đội trưởng chưa được mở.'
    );
  end if;

  v_player_id := public.team_tournament_user_player_id();
  if v_player_id is null or btrim(coalesce(p_team_id, '')) = '' then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền sửa đội hình đội này.');
  end if;

  if not (
    public.user_has_permission('team.lineup.submit')
    and public.team_tournament_is_captain(p_header.id, p_team_id, v_player_id)
  ) then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền sửa đội hình đội này.');
  end if;

  return json_build_object('ok', true, 'bypass', 'captain');
end;
$$;

-- resolve_competition_stage
create or replace function public.team_tournament_resolve_competition_stage(
  p_matchup public.team_tournament_matchups
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_stored text;
  v_stage text;
  v_next text;
  v_hops int := 0;
  v_current public.team_tournament_matchups;
  v_seen text[] := '{}';
begin
  if p_matchup.id is null then
    return 'group';
  end if;

  v_stored := nullif(trim(coalesce(p_matchup.schedule_meta->>'competitionStage', '')), '');
  if v_stored in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
    return v_stored;
  end if;

  v_stage := nullif(trim(coalesce(p_matchup.schedule_meta->>'stage', '')), '');
  if v_stage is distinct from 'knockout' then
    return 'group';
  end if;

  v_current := p_matchup;
  loop
    v_next := nullif(trim(coalesce(v_current.schedule_meta->>'nextMatchupId', '')), '');
    if v_next is null then
      exit;
    end if;
    if v_current.external_matchup_id is not null
       and v_current.external_matchup_id = any (v_seen) then
      return '';
    end if;
    if v_current.external_matchup_id is not null then
      v_seen := array_append(v_seen, v_current.external_matchup_id);
    end if;
    v_hops := v_hops + 1;
    if v_hops > 8 then
      return '';
    end if;
    select * into v_current
    from public.team_tournament_matchups m
    where m.team_tournament_id = p_matchup.team_tournament_id
      and m.external_matchup_id = v_next;
    exit when v_current.id is null;
  end loop;

  if v_hops = 0 then return 'final'; end if;
  if v_hops = 1 then return 'semifinal'; end if;
  if v_hops = 2 then return 'quarterfinal'; end if;
  if v_hops = 3 then return 'round_of_16'; end if;
  return '';
end;
$$;

-- resolve_stage_tiebreak_policy
create or replace function public.team_tournament_resolve_stage_tiebreak_policy(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_stage text;
  v_value text;
begin
  v_stage := public.team_tournament_resolve_competition_stage(p_matchup);
  v_value := upper(nullif(trim(coalesce(
    p_header.settings->'stageTieBreakPolicy'->>v_stage,
    ''
  )), ''));
  if v_value = 'TOTAL_SUBMATCH_POINTS' then
    return 'TOTAL_SUBMATCH_POINTS';
  end if;
  return 'DREAMBREAKER';
end;
$$;

-- stage_tiebreak_locked_stages
create or replace function public.team_tournament_stage_tiebreak_locked_stages(
  p_team_tournament_id uuid
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_locked text[] := '{}';
  v_row public.team_tournament_matchups;
  v_stage text;
  v_started boolean;
begin
  for v_row in
    select * from public.team_tournament_matchups
    where team_tournament_id = p_team_tournament_id
  loop
    v_started :=
      v_row.status in ('in_progress', 'completed')
      or exists (
        select 1
        from public.team_tournament_sub_matches sm
        where sm.matchup_id = v_row.id
          and sm.status in ('playing', 'completed', 'forfeit')
      )
      or exists (
        select 1
        from public.team_tournament_dreambreaker_states db
        where db.matchup_id = v_row.id
          and db.status is distinct from 'pending'
      );
    if not v_started then
      continue;
    end if;
    v_stage := coalesce(
      nullif(public.team_tournament_resolve_competition_stage(v_row), ''),
      'group'
    );
    if v_stage in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final')
       and not (v_stage = any (v_locked)) then
      v_locked := array_append(v_locked, v_stage);
    end if;
  end loop;
  return v_locked;
end;
$$;

-- referee_link_blocks_legacy
create or replace function public.team_tournament_referee_link_blocks_legacy(
  p_status text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status, '') in (
    'pending', 'provisioned', 'assigned', 'active', 'finalized', 'sync_error', 'reprovision_required'
  );
$$;

-- sub_match_score_ops
create or replace function public.team_tournament_sub_match_score_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_sub_match public.team_tournament_sub_matches
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_link public.team_sub_match_referee_links;
  v_can_results boolean := public.team_tournament_can_manage_results();
  v_can_manage boolean := public.team_tournament_can_manage();
begin
  if p_sub_match.id is null then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'NOT_FOUND'
    );
  end if;

  select * into v_link
  from public.team_sub_match_referee_links l
  where l.sub_match_id = p_sub_match.id
    and l.status <> 'revoked'
  limit 1;

  if v_link.id is not null and public.team_tournament_referee_link_blocks_legacy(v_link.status) then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', case
        when v_link.status = 'finalized' then 'referee_v5_result_finalized'
        when v_link.status in ('active', 'sync_error') then 'referee_v5_match_active'
        else 'referee_v5_linked_legacy_write_blocked'
      end,
      'blockMessage', case
        when v_link.status = 'finalized' then 'Kết quả đã chốt qua Referee V5.'
        else 'Trận con đang dùng Referee V5 — legacy score entry bị khóa.'
      end,
      'linkId', v_link.id,
      'linkStatus', v_link.status,
      'refereeMatchId', v_link.referee_match_id,
      'refereeRoute', '/referee/match/' || v_link.referee_match_id,
      'subMatchVersion', p_sub_match.version
    );
  end if;

  if not (v_can_results or v_can_manage) then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'FORBIDDEN',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  if p_sub_match.result_confirmed_at is not null and p_sub_match.status = 'completed' then
    return jsonb_build_object(
      'canSaveDraft', false,
      'canConfirm', false,
      'blockCode', 'result_already_confirmed',
      'subMatchVersion', p_sub_match.version
    );
  end if;

  return jsonb_build_object(
    'canSaveDraft', true,
    'canConfirm', true,
    'blockCode', null,
    'blockMessage', null,
    'linkId', v_link.id,
    'linkStatus', v_link.status,
    'refereeRoute', case when v_link.id is not null then '/referee/match/' || v_link.referee_match_id else null end,
    'subMatchVersion', p_sub_match.version
  );
end;
$$;

-- write_lineup_revision 13-arg
create or replace function public.team_tournament_write_lineup_revision(
  p_tenant_id text,
  p_tournament_id text,
  p_lineup_id uuid,
  p_action_type text,
  p_status_before text,
  p_status_after text,
  p_selections_before jsonb,
  p_selections_after jsonb,
  p_version_before integer,
  p_version_after integer,
  p_reason text default null,
  p_request_id text default null,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  select coalesce(max(revision_no), 0) + 1 into v_next
  from public.team_tournament_lineup_revisions
  where lineup_id = p_lineup_id;

  insert into public.team_tournament_lineup_revisions (
    tenant_id, tournament_id, lineup_id, revision_no, action_type,
    status_before, status_after, selections_before, selections_after,
    version_before, version_after, reason, request_id, actor_id, actor_role
  ) values (
    p_tenant_id, p_tournament_id, p_lineup_id, v_next, p_action_type,
    p_status_before, p_status_after,
    coalesce(p_selections_before, '{}'::jsonb),
    coalesce(p_selections_after, '{}'::jsonb),
    p_version_before, p_version_after, p_reason, p_request_id, auth.uid(),
    coalesce(
      p_actor_role,
      case
        when public.is_super_admin() then 'super_admin'
        when public.team_tournament_can_manage() then 'btc'
        else 'organizer'
      end
    )
  );
end;
$$;

-- lineup_override_ops helper
create or replace function public.team_tournament_lineup_override_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_lineup public.team_tournament_lineups,
  p_team_id text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_can_override boolean := false;
  v_block_code text := null;
  v_block_message text := null;
  v_started boolean := false;
  v_elevated_required boolean := false;
  v_warning text := null;
begin
  if p_lineup.id is null then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_missing',
      'blockMessage', 'Chưa có đội hình cho đội này.'
    );
  end if;

  if public.team_tournament_matchup_has_confirmed_result(p_matchup.id) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_override_blocked_confirmed_result',
      'blockMessage', 'Đã có kết quả trận được xác nhận — không thể override lineup trực tiếp.',
      'lineupStatus', p_lineup.status,
      'lineupVersion', p_lineup.version,
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  if p_lineup.status not in ('locked', 'published', 'overridden') then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_not_overridable',
      'blockMessage', 'Chỉ override lineup đã khóa hoặc đã công bố.',
      'lineupStatus', p_lineup.status,
      'lineupVersion', p_lineup.version
    );
  end if;

  if p_team_id not in (p_matchup.team_a_id, p_matchup.team_b_id) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'NOT_FOUND',
      'blockMessage', 'Đội không thuộc matchup.'
    );
  end if;

  v_started := public.team_tournament_matchup_is_started(p_matchup);
  v_elevated_required := v_started;

  if v_started then
    v_warning := 'Matchup đã bắt đầu — chỉ Tournament Director/Super Admin được override và phải republish.';
    if not (public.is_super_admin() or public.user_has_permission('tournament.update')) then
      return jsonb_build_object(
        'canOverride', false,
        'blockCode', 'override_elevated_required',
        'blockMessage', v_warning,
        'matchupStarted', true,
        'elevatedReasonRequired', true,
        'lineupStatus', p_lineup.status,
        'lineupVersion', p_lineup.version,
        'matchupStatus', p_matchup.status,
        'matchupVersion', p_matchup.version
      );
    end if;
  elsif not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.override')) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'override_forbidden',
      'blockMessage', 'Không có quyền thay đổi lineup.'
    );
  end if;

  v_can_override := true;

  return jsonb_build_object(
    'canOverride', v_can_override,
    'blockCode', v_block_code,
    'blockMessage', v_block_message,
    'matchupStarted', v_started,
    'elevatedReasonRequired', v_elevated_required,
    'operationalWarning', v_warning,
    'lineupStatus', p_lineup.status,
    'lineupVersion', p_lineup.version,
    'matchupStatus', p_matchup.status,
    'matchupVersion', p_matchup.version,
    'requiresRepublish', coalesce(p_matchup.requires_republish, false)
  );
end;
$$;

-- team_tournament_create post417 + stable UUID
create or replace function public.team_tournament_create(
  p_tenant_id text,
  p_club_id text,
  p_name text,
  p_season_id text default null,
  p_league_id text default null,
  p_created_by text default null,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := coalesce(nullif(trim(p_name), ''), 'Giải đồng đội');
  v_created_by text := nullif(trim(coalesce(p_created_by, '')), '');
  v_settings jsonb := coalesce(p_settings, '{}'::jsonb);
  v_idempotency text := nullif(trim(coalesce(p_settings->>'idempotencyKey', '')), '');
  v_row public.canonical_tournaments%rowtype;
  v_header public.team_tournaments%rowtype;
  v_header_exists boolean := false;
  v_preset text;
  v_team_data jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_preset := lower(coalesce(nullif(trim(v_settings->>'formatPreset'), ''), 'mlp_4'));
  if v_preset = 'mlp_4' then
    v_settings := public.team_tournament_merge_mlp_initial_settings(v_settings);
  end if;

  if v_idempotency is not null then
    perform pg_advisory_xact_lock(
      hashtext(p_tenant_id || ':' || p_club_id),
      hashtext(v_idempotency)
    );
    select * into v_row
    from public.canonical_tournaments t
    where t.tenant_id = p_tenant_id
      and t.club_id = p_club_id
      and t.payload->>'idempotencyKey' = v_idempotency
    limit 1;
    if found then
      select * into v_header
      from public.team_tournaments tt
      where tt.tenant_id = p_tenant_id
        and tt.club_id = p_club_id
        and tt.tournament_id = v_row.id::text;
      v_header_exists := found;
      if not v_header_exists then
        return jsonb_build_object('ok', false, 'code', 'CREATE_INCONSISTENT');
      end if;
      if v_preset = 'mlp_4' then
        perform public.team_tournament_seed_mlp_disciplines(v_header);
        select * into v_header
        from public.team_tournaments tt
        where tt.id = v_header.id;
      end if;
      v_team_data := public.team_tournament_initial_setup_team_data(v_header);
      return jsonb_build_object(
        'ok', true,
        'replayed', true,
        'tournament', jsonb_build_object(
          'id', v_row.id::text,
          'canonicalId', v_row.id::text,
          'teamDomainId', coalesce(v_row.payload->>'teamDomainId', v_row.id::text),
          'clubId', v_row.club_id,
          'tenantId', v_row.tenant_id,
          'name', v_row.name,
          'mode', 'team_tournament',
          'status', v_row.status,
          'createdBy', v_row.payload->>'createdBy',
          'ownerPlayerId', v_row.payload->>'ownerPlayerId',
          'settings', coalesce(v_header.settings, v_row.payload->'settings', v_settings),
          'teamData', v_team_data
        )
      );
    end if;
  end if;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, season_id, league_id, payload, engine_v4
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'team_tournament',
    'draft',
    nullif(trim(coalesce(p_season_id, '')), ''),
    nullif(trim(coalesce(p_league_id, '')), ''),
    jsonb_build_object(
      'id', v_id::text,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'teamDomainId', v_id::text,
      'idempotencyKey', v_idempotency,
      'settings', v_settings
    ),
    '{}'::jsonb
  )
  returning * into v_row;

  insert into public.team_tournaments (
    id, tenant_id, club_id, tournament_id, name, status, settings, created_by, updated_by
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_id::text,
    v_name,
    'draft',
    v_settings,
    auth.uid(),
    auth.uid()
  )
  returning * into v_header;

  if v_preset = 'mlp_4' then
    perform public.team_tournament_seed_mlp_disciplines(v_header);
  end if;

  v_team_data := public.team_tournament_initial_setup_team_data(v_header);

  return jsonb_build_object(
    'ok', true,
    'tournament', jsonb_build_object(
      'id', v_id::text,
      'canonicalId', v_id::text,
      'teamDomainId', v_id::text,
      'clubId', p_club_id,
      'tenantId', p_tenant_id,
      'name', v_name,
      'mode', 'team_tournament',
      'status', 'draft',
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'settings', v_settings,
      'teamData', v_team_data
    )
  );
exception
  when others then
    if sqlerrm in ('access_denied: cross-tenant', 'TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', sqlerrm);
    end if;
    raise;
end;
$$;

-- team_tournament_ensure_canonical
create or replace function public.team_tournament_ensure_canonical(
  p_tenant_id text,
  p_club_id text,
  p_tournament_id text,
  p_name text default null,
  p_created_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_existing public.canonical_tournaments%rowtype;
  v_id uuid;
  v_domain text := nullif(trim(coalesce(p_tournament_id, '')), '');
  v_created_by text := nullif(trim(coalesce(p_created_by, '')), '');
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  perform public.team_tournament_assert_tenant(p_tenant_id);
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_domain is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  v_header := public.team_tournament_resolve_header(v_domain);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_existing
  from public.canonical_tournaments t
  where t.tenant_id = p_tenant_id
    and t.club_id = p_club_id
    and (
      t.id::text = v_domain
      or t.external_key = v_domain
      or coalesce(t.payload->>'teamDomainId', '') = v_domain
    )
  limit 1;

  if found then
    return jsonb_build_object('ok', true, 'already', true, 'tournament', to_jsonb(v_existing));
  end if;

  begin
    v_id := v_domain::uuid;
  exception
    when others then
      v_id := gen_random_uuid();
  end;

  insert into public.canonical_tournaments (
    id, tenant_id, club_id, external_key, name, mode, status, payload
  ) values (
    v_id,
    p_tenant_id,
    p_club_id,
    v_header.tournament_id,
    coalesce(nullif(trim(p_name), ''), v_header.name, 'Giải đồng đội'),
    'team_tournament',
    coalesce(v_header.status, 'draft'),
    jsonb_build_object(
      'id', v_id::text,
      'mode', 'team_tournament',
      'status', coalesce(v_header.status, 'draft'),
      'createdBy', v_created_by,
      'ownerPlayerId', v_created_by,
      'teamDomainId', v_header.tournament_id
    )
  )
  returning * into v_existing;

  return jsonb_build_object('ok', true, 'already', false, 'tournament', to_jsonb(v_existing));
end;
$$;

-- team_tournament_get_dashboard
create or replace function public.team_tournament_get_dashboard(
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
  v_canonical public.canonical_tournaments%rowtype;
  v_player_id text;
  v_can_manage boolean;
  v_is_draft boolean := false;
  v_is_participant boolean := false;
  v_is_captain_or_deputy boolean := false;
  v_is_assigned_referee boolean := false;
  v_can_view boolean := false;
  v_captain_team_id text := null;
  v_my_team_id text := null;
  v_my_team jsonb := null;
  v_teams jsonb := '[]'::jsonb;
  v_matchups jsonb := '[]'::jsonb;
  v_standings jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_policy jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    select * into v_canonical
    from public.canonical_tournaments t
    where t.id::text = p_tournament_id
       or t.external_key = p_tournament_id
    limit 1;
    if found then
      v_header := public.team_tournament_resolve_header(
        coalesce(v_canonical.payload->>'teamDomainId', v_canonical.external_key, v_canonical.id::text)
      );
    end if;
  end if;

  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  perform public.team_tournament_assert_tenant(v_header.tenant_id);
  v_can_manage := public.team_tournament_can_manage();
  v_is_draft := lower(coalesce(v_header.status, 'draft')) = 'draft';

  -- Canonical player identity: athletes.id first, profiles.player_id fallback.
  select a.id::text
    into v_player_id
  from public.athletes a
  where a.user_id = auth.uid()
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;
  if v_player_id is null then
    v_player_id := nullif(trim(coalesce(public.team_tournament_user_player_id(), '')), '');
  end if;

  -- Role resolution BEFORE visibility decision (server authority only).
  if v_player_id is not null then
    select t.external_team_id
      into v_captain_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
      )
    limit 1;
  end if;
  v_is_captain_or_deputy := v_captain_team_id is not null;

  if to_regclass('public.referee_assignments') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'assignmentId', ra.id,
      'refereeUserId', ra.referee_user_id,
      'matchId', ra.match_id,
      'matchupId', ra.external_matchup_id
    )), '[]'::jsonb)
    into v_assignments
    from public.referee_assignments ra
    where ra.tenant_id = v_header.tenant_id
      and ra.tournament_id = v_header.tournament_id
      and ra.referee_user_id = auth.uid()
      and ra.revoked_at is null;
  end if;
  v_is_assigned_referee := jsonb_array_length(coalesce(v_assignments, '[]'::jsonb)) > 0;

  v_can_view := public.team_tournament_can_view_dashboard(
    v_header.status,
    v_can_manage,
    v_is_captain_or_deputy,
    v_is_assigned_referee
  );

  if not v_can_view then
    if v_is_draft then
      return jsonb_build_object('ok', false, 'code', 'DRAFT_NOT_VISIBLE');
    end if;
    return jsonb_build_object('ok', false, 'code', 'NOT_VISIBLE');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.external_team_id,
    'name', t.name,
    'color', t.color,
    'withdrawn', coalesce(t.withdrawn, false)
  ) order by t.created_at), '[]'::jsonb)
  into v_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id;

  if v_player_id is not null then
    select t.external_team_id into v_my_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and (
        t.captain_player_id = v_player_id
        or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
        or exists (
          select 1
          from public.team_tournament_team_members m
          where m.team_id = t.id
            and m.player_id = v_player_id
        )
      )
    limit 1;

    v_is_participant := v_my_team_id is not null;
    if v_captain_team_id is not null then
      v_is_participant := true;
      if v_my_team_id is null then
        v_my_team_id := v_captain_team_id;
      end if;
    end if;

    if v_my_team_id is not null then
      select jsonb_build_object(
        'id', t.external_team_id,
        'name', t.name,
        'roster', coalesce((
          select jsonb_agg(jsonb_build_object('playerId', m.player_id, 'name', null))
          from public.team_tournament_team_members m
          where m.team_id = t.id
        ), '[]'::jsonb)
      )
      into v_my_team
      from public.team_tournament_teams t
      where t.team_tournament_id = v_header.id
        and t.external_team_id = v_my_team_id
      limit 1;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.external_matchup_id,
    'stage', coalesce(m.schedule_meta->>'stage', null),
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'scheduledAt', m.scheduled_at,
    'courtLabel', m.court_label,
    'status', m.status,
    'result', jsonb_build_object(
      'teamAWins', m.result->'teamAWins',
      'teamBWins', m.result->'teamBWins',
      'teamAPoints', m.result->'teamAPoints',
      'teamBPoints', m.result->'teamBPoints',
      'winnerTeamId', m.result->>'winnerTeamId',
      'tieBreakPolicy', m.result->>'tieBreakPolicy',
      'tieBreakStatus', m.result->>'tieBreakStatus',
      'needsDreambreaker', coalesce((m.result->>'needsDreambreaker')::boolean, false)
    )
  ) order by m.scheduled_at nulls last), '[]'::jsonb)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id;

  if to_regclass('public.team_tournament_lineups') is not null then
    select coalesce(jsonb_agg(
      elem || jsonb_build_object(
        'lineups', coalesce((
          select jsonb_object_agg(
            l.team_external_id,
            jsonb_build_object('status', l.status)
          )
          from public.team_tournament_lineups l
          join public.team_tournament_matchups mu
            on mu.id = l.matchup_id
           and mu.team_tournament_id = v_header.id
          where mu.external_matchup_id = elem->>'id'
        ), '{}'::jsonb)
      )
    ), v_matchups)
    into v_matchups
    from jsonb_array_elements(coalesce(v_matchups, '[]'::jsonb)) elem;
  end if;

  if to_regclass('public.team_tournament_dreambreaker_states') is not null then
    select coalesce(jsonb_agg(
      elem || jsonb_build_object(
        'dreambreaker', coalesce((
          select jsonb_build_object('status', d.status)
          from public.team_tournament_dreambreaker_states d
          join public.team_tournament_matchups mu
            on mu.id = d.matchup_id
           and mu.team_tournament_id = v_header.id
          where mu.external_matchup_id = elem->>'id'
          limit 1
        ), '{}'::jsonb)
      )
    ), v_matchups)
    into v_matchups
    from jsonb_array_elements(coalesce(v_matchups, '[]'::jsonb)) elem;
  end if;

  if to_regclass('public.team_tournament_standings') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'teamId', s.team_external_id,
      'rank', s.rank,
      'played', s.played,
      'wins', s.wins,
      'losses', s.losses,
      'pointsScored', s.points_scored
    ) order by s.rank), '[]'::jsonb)
    into v_standings
    from public.team_tournament_standings s
    where s.team_tournament_id = v_header.id;
  end if;

  v_policy := coalesce(v_header.settings->'stageTieBreakPolicy', '{}'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'view', jsonb_build_object(
      'overview', jsonb_build_object(
        'id', v_header.tournament_id,
        'name', v_header.name,
        'status', v_header.status,
        'clubId', v_header.club_id,
        'tenantId', v_header.tenant_id,
        'mode', 'team_tournament',
        'isDraft', v_is_draft,
        'registrationFoundationReady', lower(coalesce(v_header.status, 'draft')) in ('draft', 'registration'),
        'registrationFullUiImplemented', false
      ),
      'stageTieBreakPolicy', v_policy,
      'teams', v_teams,
      'matchups', v_matchups,
      'standings', v_standings,
      'capabilities', jsonb_build_object(
        'canOrganize', v_can_manage,
        'isParticipant', v_is_participant,
        'isCaptain', v_is_captain_or_deputy,
        'isReferee', v_is_assigned_referee,
        'myTeamId', v_my_team_id,
        'captainTeamId', v_captain_team_id
      ),
      'myTeam', v_my_team,
      'refereeAssignments', v_assignments
    )
  );
exception
  when others then
    if sqlerrm like 'access_denied%' then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED');
    end if;
    raise;
end;
$$;

-- team_tournament_list_my_dashboards
create or replace function public.team_tournament_list_my_dashboards()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_player_id text := null;
  v_user_tenant text := null;
  v_can_manage boolean := false;
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'tournaments', '[]'::jsonb);
  end if;

  v_can_manage := public.team_tournament_can_manage();
  v_user_tenant := public.user_venue_id();

  if not public.is_super_admin() and v_user_tenant is null then
    return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'tournaments', '[]'::jsonb);
  end if;

  select a.id::text
    into v_player_id
  from public.athletes a
  where a.user_id = auth.uid()
  order by a.updated_at desc nulls last, a.created_at desc nulls last
  limit 1;

  with base as (
    select
      tt.id as team_tournament_uuid,
      coalesce(nullif(trim(tt.tournament_id), ''), tt.id::text) as canonical_id,
      tt.name,
      tt.status,
      tt.club_id,
      tt.tenant_id,
      tt.updated_at,
      (
        v_can_manage
        and (
          public.is_super_admin()
          or tt.tenant_id = v_user_tenant
        )
      ) as is_organizer,
      (
        v_player_id is not null
        and exists (
          select 1
          from public.team_tournament_teams t
          where t.team_tournament_id = tt.id
            and (
              t.captain_player_id = v_player_id
              or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
            )
        )
      ) as is_captain_or_deputy,
      (
        to_regclass('public.referee_assignments') is not null
        and exists (
          select 1
          from public.referee_assignments ra
          where ra.tenant_id = tt.tenant_id
            and ra.tournament_id = coalesce(nullif(trim(tt.tournament_id), ''), tt.id::text)
            and ra.referee_user_id = auth.uid()
            and ra.revoked_at is null
        )
      ) as is_assigned_referee,
      (
        v_player_id is not null
        and exists (
          select 1
          from public.team_tournament_teams t
          left join public.team_tournament_team_members mb on mb.team_id = t.id
          where t.team_tournament_id = tt.id
            and (
              mb.player_id = v_player_id
              or t.captain_player_id = v_player_id
              or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
            )
        )
      ) as is_participant
    from public.team_tournaments tt
    where public.is_super_admin()
       or tt.tenant_id = v_user_tenant
  ),
  gated as (
    select *
    from base b
    where public.team_tournament_can_view_dashboard(
      b.status,
      b.is_organizer,
      b.is_captain_or_deputy,
      b.is_assigned_referee
    )
  ),
  enriched as (
    select
      g.*,
      (
        select jsonb_build_object(
          'id', t.external_team_id,
          'name', t.name
        )
        from public.team_tournament_teams t
        left join public.team_tournament_team_members mb on mb.team_id = t.id
        where t.team_tournament_id = g.team_tournament_uuid
          and v_player_id is not null
          and (
            mb.player_id = v_player_id
            or t.captain_player_id = v_player_id
            or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
          )
        order by
          case
            when t.captain_player_id = v_player_id then 0
            when coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id] then 1
            else 2
          end,
          t.created_at
        limit 1
      ) as my_team,
      (
        select t.external_team_id
        from public.team_tournament_teams t
        where t.team_tournament_id = g.team_tournament_uuid
          and v_player_id is not null
          and (
            t.captain_player_id = v_player_id
            or coalesce(t.deputy_player_ids, '{}'::text[]) @> array[v_player_id]
          )
        limit 1
      ) as captain_team_id
    from gated g
  ),
  projected as (
    select
      jsonb_build_object(
        'id', e.canonical_id,
        'teamDomainId', e.team_tournament_uuid::text,
        'name', e.name,
        'status', e.status,
        'clubId', e.club_id,
        'tenantId', e.tenant_id,
        'roles', (
          select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
          from (
            select 'organizer' as role where e.is_organizer
            union all
            select 'captain' where e.is_captain_or_deputy
            union all
            select 'referee' where e.is_assigned_referee
            union all
            select 'participant' where e.is_participant
            union all
            select 'viewer'
              where not e.is_organizer
                and not e.is_captain_or_deputy
                and not e.is_assigned_referee
                and not e.is_participant
          ) roles
        ),
        'myTeam', e.my_team,
        'openTaskCount', case
          when e.captain_team_id is null then 0
          else (
            select count(*)::int
            from public.team_tournament_matchups m
            left join public.team_tournament_lineups l
              on l.matchup_id = m.id
             and l.team_external_id = e.captain_team_id
            where m.team_tournament_id = e.team_tournament_uuid
              and (m.team_a_id = e.captain_team_id or m.team_b_id = e.captain_team_id)
              and lower(coalesce(m.status, '')) <> 'completed'
              and (
                l.id is null
                or lower(coalesce(l.status, '')) in ('', 'draft', 'lineup_open', 'waiting')
              )
          )
        end,
        'nextMatchup', (
          select jsonb_build_object(
            'id', m.external_matchup_id,
            'status', m.status,
            'teamAId', m.team_a_id,
            'teamBId', m.team_b_id,
            'scheduledAt', m.scheduled_at
          )
          from public.team_tournament_matchups m
          where m.team_tournament_id = e.team_tournament_uuid
            and lower(coalesce(m.status, '')) <> 'completed'
            and (
              e.my_team is null
              or m.team_a_id = e.my_team->>'id'
              or m.team_b_id = e.my_team->>'id'
              or e.is_assigned_referee
              or e.is_organizer
            )
          order by m.scheduled_at nulls last, m.created_at
          limit 1
        ),
        'href', '/tournaments/' || e.canonical_id,
        'captainPortalHref', case
          when e.captain_team_id is null then null
          else '/team-portal/' || e.canonical_id || '?club=' || coalesce(e.club_id, '')
        end,
        'refereeHref', case
          when not e.is_assigned_referee then null
          else '/team-referee/' || e.canonical_id
        end
      ) as item,
      e.updated_at
    from enriched e
  )
  select coalesce(jsonb_agg(p.item order by p.updated_at desc), '[]'::jsonb)
    into v_rows
  from projected p;

  return jsonb_build_object('ok', true, 'tournaments', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- team_tournament_commit_pairing
create or replace function public.team_tournament_commit_pairing(
  p_tournament_id text,
  p_teams jsonb default '[]'::jsonb,
  p_groups jsonb default '[]'::jsonb,
  p_settings_patch jsonb default '{}'::jsonb,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_team jsonb;
  v_group jsonb;
  v_external_id text;
  v_team_id uuid;
  v_player_id text;
  v_team_count integer;
  v_input_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  if p_expected_version is not null and coalesce(v_header.version, 1) is distinct from p_expected_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'version', v_header.version
    );
  end if;

  if jsonb_typeof(coalesce(p_teams, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_teams, '[]'::jsonb)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'EMPTY_TEAMS');
  end if;

  for v_team in select value from jsonb_array_elements(p_teams) loop
    v_external_id := coalesce(nullif(v_team->>'id', ''), nullif(v_team->>'externalTeamId', ''));
    if v_external_id is null then
      raise exception using errcode = 'P0001', message = 'VALIDATION';
    end if;

    select t.id into v_team_id
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id and t.external_team_id = v_external_id;

    if v_team_id is null then
      insert into public.team_tournament_teams (
        tenant_id, tournament_id, team_tournament_id, external_team_id,
        name, color, logo_url, captain_player_id, deputy_player_ids,
        absent_player_ids, locked_player_ids, created_by, updated_by
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_header.id, v_external_id,
        coalesce(v_team->>'name', 'Đội mới'),
        v_team->>'color', v_team->>'logoUrl',
        nullif(v_team->>'captainPlayerId', ''),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'deputyPlayerIds','[]'::jsonb)) x), '{}'),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'absentPlayerIds','[]'::jsonb)) x), '{}'),
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_team->'lockedPlayerIds','[]'::jsonb)) x), '{}'),
        auth.uid(), auth.uid()
      ) returning id into v_team_id;
    else
      update public.team_tournament_teams set
        name = coalesce(v_team->>'name', name),
        color = coalesce(v_team->>'color', color),
        logo_url = coalesce(v_team->>'logoUrl', logo_url),
        captain_player_id = coalesce(nullif(v_team->>'captainPlayerId', ''), captain_player_id),
        updated_at = now(),
        updated_by = auth.uid()
      where id = v_team_id;
    end if;

    delete from public.team_tournament_team_members
    where team_id = v_team_id;

    for v_player_id in
      select jsonb_array_elements_text(coalesce(v_team->'playerIds', '[]'::jsonb))
    loop
      insert into public.team_tournament_team_members (
        tenant_id, tournament_id, team_id, player_id, role, created_by
      ) values (
        v_header.tenant_id, v_header.tournament_id, v_team_id, v_player_id, 'member', auth.uid()
      )
      on conflict (team_id, player_id) do nothing;
    end loop;
  end loop;

  if jsonb_typeof(coalesce(p_groups, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_groups, '[]'::jsonb)) > 0 then
    select count(*) into v_input_count from jsonb_array_elements(p_groups);
    select count(distinct x.value) into v_team_count
    from jsonb_array_elements(p_groups) g,
         jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb)) x(value);
    if (
      select count(*)
      from jsonb_array_elements(p_groups) g,
           jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb))
    ) <> v_team_count then
      raise exception using errcode = 'P0001', message = 'DUPLICATE_GROUP_TEAM';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_groups) g,
           jsonb_array_elements_text(coalesce(g.value->'teamIds', '[]'::jsonb)) x(value)
      where not exists (
        select 1
        from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id and t.external_team_id = x.value
      )
    ) then
      raise exception using errcode = 'P0001', message = 'UNKNOWN_TEAM';
    end if;

    delete from public.team_tournament_groups where team_tournament_id = v_header.id;
    for v_group in select value from jsonb_array_elements(p_groups) loop
      insert into public.team_tournament_groups (
        tenant_id, tournament_id, team_tournament_id, external_group_id, name, sort_order, team_ids
      ) values (
        v_header.tenant_id,
        v_header.tournament_id,
        v_header.id,
        coalesce(nullif(v_group->>'id', ''), gen_random_uuid()::text),
        coalesce(v_group->>'name', ''),
        coalesce((v_group->>'sortOrder')::int, 1),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_group->'teamIds', '[]'::jsonb))), '{}'::text[])
      );
    end loop;
  end if;

  if p_settings_patch is not null and p_settings_patch <> '{}'::jsonb then
    update public.team_tournaments
    set settings = coalesce(settings, '{}'::jsonb) || p_settings_patch,
        version = coalesce(version, 1) + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_header.id
    returning * into v_header;
  else
    update public.team_tournaments
    set version = coalesce(version, 1) + 1,
        updated_at = now(),
        updated_by = auth.uid()
    where id = v_header.id
    returning * into v_header;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tournamentId', v_header.tournament_id,
    'version', v_header.version,
    'teamData', public.team_tournament_initial_setup_team_data(v_header)
  );
exception
  when others then
    if sqlerrm in ('access_denied: cross-tenant', 'TOURNAMENT_MISSING_TENANT', 'TOURNAMENT_FORBIDDEN') then
      return jsonb_build_object('ok', false, 'code', 'CROSS_TENANT_DENIED', 'error', sqlerrm);
    end if;
    if sqlstate = 'P0001' then
      return jsonb_build_object('ok', false, 'code', sqlerrm);
    end if;
    raise;
end;
$$;

-- team_tournament_update_setup_config
create or replace function public.team_tournament_update_setup_config(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prepare json;
  v_header public.team_tournaments;
  v_envelope jsonb;
  v_payload jsonb;
  v_patch jsonb := '{}'::jsonb;
  v_new_version integer;
  v_roster jsonb;
  v_courts jsonb;
  v_policy jsonb;
  v_policy_norm jsonb := '{}'::jsonb;
  v_existing_policy jsonb;
  v_merged_policy jsonb;
  v_scoring jsonb;
  v_scoring_norm jsonb := '{}'::jsonb;
  v_entry jsonb;
  v_entry_norm jsonb;
  v_key text;
  v_val text;
  v_old text;
  v_new text;
  v_locked text[];
  v_q integer;
  v_gc integer;
  v_total integer;
  v_target integer;
  v_win_by integer;
  v_change_ends integer;
  v_freeze integer;
  v_scoring_mode text;
  v_mode_raw text;
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.update_setup_config',
    p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := coalesce(v_envelope->'payload', '{}'::jsonb);

  if v_payload ? 'formatPreset' then
    v_patch := v_patch || jsonb_build_object('formatPreset', v_payload->'formatPreset');
  end if;
  if v_payload ? 'dreambreakerEnabled' then
    v_patch := v_patch || jsonb_build_object('dreambreakerEnabled', v_payload->'dreambreakerEnabled');
  end if;
  if v_payload ? 'groupMode' then
    v_patch := v_patch || jsonb_build_object('groupMode', v_payload->'groupMode');
  end if;
  if v_payload ? 'groupCount' then
    v_patch := v_patch || jsonb_build_object('groupCount', v_payload->'groupCount');
  end if;
  if v_payload ? 'qualifiersPerGroup' then
    v_q := greatest(1, coalesce((v_payload->>'qualifiersPerGroup')::int, 1));
    v_patch := v_patch || jsonb_build_object(
      'qualifiersPerGroup', v_q,
      'qualificationCount', v_q
    );
  elsif v_payload ? 'qualificationCount' then
    v_q := greatest(1, coalesce((v_payload->>'qualificationCount')::int, 1));
    v_patch := v_patch || jsonb_build_object(
      'qualificationCount', v_q,
      'qualifiersPerGroup', v_q
    );
  end if;
  if v_payload ? 'knockoutFormat' then
    v_patch := v_patch || jsonb_build_object('knockoutFormat', v_payload->'knockoutFormat');
  end if;
  if v_payload ? 'teamsPerGroup' then
    v_patch := v_patch || jsonb_build_object('teamsPerGroup', v_payload->'teamsPerGroup');
  end if;
  if v_payload ? 'rosterRules' then
    v_roster := coalesce(v_payload->'rosterRules', '{}'::jsonb);
    v_patch := v_patch || jsonb_build_object('rosterRules', v_roster);
  end if;
  if v_payload ? 'selectedCourtIds' then
    v_courts := coalesce(v_payload->'selectedCourtIds', '[]'::jsonb);
    v_patch := v_patch || jsonb_build_object('selectedCourtIds', v_courts);
  end if;

  -- Fail closed non power-of-two qualification totals when multi-group.
  v_gc := coalesce(
    (v_patch->>'groupCount')::int,
    (v_header.settings->>'groupCount')::int,
    1
  );
  v_q := coalesce(
    (v_patch->>'qualifiersPerGroup')::int,
    (v_header.settings->>'qualifiersPerGroup')::int,
    (v_header.settings->>'qualificationCount')::int,
    2
  );
  if v_gc >= 2 then
    v_total := v_gc * v_q;
    if v_total not in (2, 4, 8, 16) then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_QUALIFICATION_TOTAL',
        'error', 'totalQualifiedTeams must be in {2,4,8,16}; cloud bye not supported',
        'groupCount', v_gc,
        'qualifiersPerGroup', v_q,
        'totalQualifiedTeams', v_total
      )::json;
    end if;
  end if;

  if v_payload ? 'stageTieBreakPolicy' then
    v_policy := v_payload->'stageTieBreakPolicy';
    if jsonb_typeof(v_policy) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_STAGE_TIEBREAK_POLICY',
        'error', 'stageTieBreakPolicy must be an object'
      )::json;
    end if;
    for v_key in select jsonb_object_keys(v_policy)
    loop
      if v_key not in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_TIEBREAK_POLICY',
          'error', 'Unknown competition stage key'
        )::json;
      end if;
      v_val := upper(trim(coalesce(v_policy->>v_key, '')));
      if v_val not in ('DREAMBREAKER', 'TOTAL_SUBMATCH_POINTS') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_TIEBREAK_POLICY',
          'error', 'Invalid stage tie-break policy value'
        )::json;
      end if;
      v_policy_norm := v_policy_norm || jsonb_build_object(v_key, v_val);
    end loop;
    v_existing_policy := coalesce(v_header.settings->'stageTieBreakPolicy', '{}'::jsonb);
    v_merged_policy := v_existing_policy || v_policy_norm;
    v_locked := public.team_tournament_stage_tiebreak_locked_stages(v_header.id);
    foreach v_key in array array['group', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
    loop
      v_old := coalesce(nullif(trim(coalesce(v_existing_policy->>v_key, '')), ''), 'DREAMBREAKER');
      v_new := coalesce(nullif(trim(coalesce(v_merged_policy->>v_key, '')), ''), 'DREAMBREAKER');
      if v_old is distinct from v_new and v_key = any (v_locked) then
        return jsonb_build_object(
          'ok', false,
          'code', 'STAGE_TIEBREAK_POLICY_LOCKED',
          'error', 'Cannot change tie-break policy after that stage has started',
          'lockedStages', to_jsonb(v_locked)
        )::json;
      end if;
    end loop;
    v_patch := v_patch || jsonb_build_object('stageTieBreakPolicy', v_merged_policy);
  end if;

  if v_payload ? 'stageScoringPolicy' then
    v_scoring := v_payload->'stageScoringPolicy';
    if jsonb_typeof(v_scoring) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'code', 'INVALID_STAGE_SCORING_POLICY',
        'error', 'stageScoringPolicy must be an object'
      )::json;
    end if;
    for v_key in select jsonb_object_keys(v_scoring)
    loop
      if v_key not in ('group', 'round_of_16', 'quarterfinal', 'semifinal', 'final') then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'Unknown competition stage key'
        )::json;
      end if;
      v_entry := v_scoring->v_key;
      if jsonb_typeof(v_entry) <> 'object' then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'stage scoring entry must be object'
        )::json;
      end if;

      -- Reject unknown fields (canonical scoring engine aliases only).
      if exists (
        select 1
        from jsonb_object_keys(v_entry) k(key)
        where k.key not in (
          'targetPoints', 'targetScore', 'winBy', 'changeEndsAt', 'freezeAt',
          'scoringMode', 'scoringSystem'
        )
      ) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'Unsupported stage scoring field'
        )::json;
      end if;

      begin
        v_target := coalesce(
          nullif(v_entry->>'targetPoints', '')::int,
          nullif(v_entry->>'targetScore', '')::int
        );
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'targetPoints/targetScore must be integer'
        )::json;
      end;
      begin
        v_win_by := nullif(v_entry->>'winBy', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'winBy must be integer'
        )::json;
      end;
      begin
        v_change_ends := nullif(v_entry->>'changeEndsAt', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'changeEndsAt must be integer or null'
        )::json;
      end;
      begin
        v_freeze := nullif(v_entry->>'freezeAt', '')::int;
      exception when others then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'freezeAt must be integer or null'
        )::json;
      end;

      if v_target is null or v_target < 1 or v_target > 99 then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'targetPoints must be between 1 and 99'
        )::json;
      end if;
      if v_win_by is null or v_win_by < 1 or v_win_by > 20 then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'winBy must be between 1 and 20'
        )::json;
      end if;
      if v_change_ends is not null and (v_change_ends < 1 or v_change_ends > 99) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'changeEndsAt out of range'
        )::json;
      end if;
      if v_freeze is not null and (v_freeze < 1 or v_freeze > 99) then
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'freezeAt out of range'
        )::json;
      end if;

      -- Normalize scoringMode to rally|traditional (aliases accepted).
      v_mode_raw := lower(trim(coalesce(
        nullif(trim(coalesce(v_entry->>'scoringMode', '')), ''),
        nullif(trim(coalesce(v_entry->>'scoringSystem', '')), ''),
        'rally'
      )));
      if v_mode_raw in ('traditional', 'side_out', 'sideout') then
        v_scoring_mode := 'traditional';
      elsif v_mode_raw in ('rally', 'direct') then
        v_scoring_mode := 'rally';
      else
        return jsonb_build_object(
          'ok', false,
          'code', 'INVALID_STAGE_SCORING_POLICY',
          'error', 'scoringMode must be rally or traditional'
        )::json;
      end if;

      v_entry_norm := jsonb_build_object(
        'scoringMode', v_scoring_mode,
        'targetPoints', v_target,
        'winBy', v_win_by,
        'changeEndsAt', to_jsonb(v_change_ends),
        'freezeAt', to_jsonb(v_freeze)
      );
      v_scoring_norm := v_scoring_norm || jsonb_build_object(v_key, v_entry_norm);
    end loop;
    v_patch := v_patch || jsonb_build_object(
      'stageScoringPolicy',
      coalesce(v_header.settings->'stageScoringPolicy', '{}'::jsonb) || v_scoring_norm
    );
  end if;

  if v_patch = '{}'::jsonb then
    return jsonb_build_object(
      'ok', false,
      'code', 'EMPTY_SETUP_CONFIG',
      'error', 'No whitelisted Format/Venue/Group settings keys in payload'
    )::json;
  end if;

  update public.team_tournaments
     set settings = coalesce(settings, '{}'::jsonb) || v_patch,
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_header.id;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

-- team_tournament_set_captain_access
create or replace function public.team_tournament_set_captain_access(
  p_tournament_id text,
  p_enabled boolean,
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
  v_new_version integer;
  v_enabled boolean := coalesce(p_enabled, false);
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Chỉ BTC được mở/đóng Portal đội trưởng.');
  end if;

  if p_expected_version is not null and v_header.version is distinct from p_expected_version then
    return json_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'expectedVersion', p_expected_version,
      'actualVersion', v_header.version
    );
  end if;

  update public.team_tournaments
  set
    settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
      'captainAccessEnabled', v_enabled,
      'captainAccess', jsonb_strip_nulls(jsonb_build_object(
        'enabled', v_enabled,
        'updatedAt', now(),
        'updatedBy', auth.uid()::text
      ))
    ),
    version = version + 1,
    updated_at = now(),
    updated_by = auth.uid()
  where id = v_header.id
  returning version into v_new_version;

  perform public.team_tournament_write_audit(
    v_header.tenant_id,
    v_header.tournament_id,
    'team.captain_access.set',
    v_header.tournament_id,
    jsonb_build_object(
      'captainAccessEnabled', v_enabled,
      'expectedVersion', p_expected_version,
      'idempotencyKey', p_idempotency_key,
      'version', v_new_version
    )
  );

  return json_build_object(
    'ok', true,
    'captainAccessEnabled', v_enabled,
    'version', v_new_version,
    'tournamentId', v_header.tournament_id
  );
end;
$$;

-- team_tournament_get_captain_portal
create or replace function public.team_tournament_get_captain_portal(
  p_tournament_id text,
  p_schema_version integer default 7
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assert json;
  v_header public.team_tournaments;
  v_viewer_team_id text;
  v_player_id text;
  v_teams json;
  v_my_team json;
  v_opponent_teams json;
  v_matchups json;
  v_lineups json;
  v_disciplines json;
  v_is_captain boolean := false;
  v_is_deputy boolean := false;
begin
  if p_schema_version is distinct from null and p_schema_version is distinct from 7 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'schemaVersion phải là 7.');
  end if;

  v_assert := public.team_tournament_assert_captain_portal_access(p_tournament_id, null);
  if not coalesce((v_assert->>'ok')::boolean, false) then
    return v_assert;
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  v_viewer_team_id := v_assert->>'viewerTeamId';
  v_player_id := v_assert->>'viewerPlayerId';

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and t.captain_player_id = v_player_id
  ) into v_is_captain;

  select exists (
    select 1 from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
      and v_player_id = any(coalesce(t.deputy_player_ids, '{}'::text[]))
  ) into v_is_deputy;

  select coalesce(json_agg(json_build_object(
    'id', d.external_discipline_id,
    'name', d.name,
    'playerCount', d.player_count,
    'sortOrder', d.sort_order,
    'categoryType', d.category_type,
    'genderRequirement', d.gender_requirement,
    'activationRule', d.activation_rule,
    'disciplineKind', d.discipline_kind
  ) order by d.sort_order, d.created_at), '[]'::json)
  into v_disciplines
  from public.team_tournament_disciplines d
  where d.team_tournament_id = v_header.id;

  select row_to_json(x)
  into v_my_team
  from (
    select
      t.external_team_id as id,
      t.name,
      t.captain_player_id as "captainPlayerId",
      coalesce(t.deputy_player_ids, '{}'::text[]) as "deputyPlayerIds",
      coalesce((
        select json_agg(m.player_id order by m.created_at)
        from public.team_tournament_team_members m
        where m.team_id = t.id
      ), '[]'::json) as "playerIds",
      coalesce((
        select json_agg(
          json_build_object(
            'athleteId', m.player_id,
            'displayName', coalesce(nullif(trim(a.display_name), ''), m.player_id),
            'gender', case
              when lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'nam') then 'male'
              when lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'nu', 'nữ') then 'female'
              when nullif(trim(coalesce(p.gender, '')), '') is null then null
              else lower(trim(p.gender))
            end
          )
          order by m.created_at
        )
        from public.team_tournament_team_members m
        left join public.athletes a
          on a.id::text = m.player_id
         and a.tenant_id = v_header.tenant_id
        left join public.profiles p
          on p.id = a.user_id
        where m.team_id = t.id
      ), '[]'::json) as "rosterAthletes"
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id
      and t.external_team_id = v_viewer_team_id
  ) x;

  -- Viewer-scoped matchups only. Official subMatches gated by publication state.
  -- Dreambreaker: ownOrder + opponentOrderSubmitted boolean. Never opponent IDs.
  select coalesce(json_agg(json_build_object(
    'id', m.external_matchup_id,
    'teamAId', m.team_a_id,
    'teamBId', m.team_b_id,
    'status', m.status,
    'scheduledAt', m.scheduled_at,
    'courtLabel', m.court_label,
    'lineupLockAt', m.lineup_lock_at,
    'roundNumber', m.schedule_meta->>'roundNumber',
    'stage', m.schedule_meta->>'stage',
    'groupId', m.schedule_meta->>'groupId',
    'subMatches', case
      when m.status in ('published', 'in_progress', 'completed') then
        coalesce((
          select json_agg(json_build_object(
            'id', sm.external_sub_match_id,
            'disciplineId', sm.discipline_external_id,
            'sortOrder', sm.sort_order,
            'status', sm.status,
            'score', sm.score,
            'winnerTeamId', sm.winner_team_id,
            'resultConfirmedAt', sm.result_confirmed_at,
            'version', sm.version
          ) order by sm.sort_order)
          from public.team_tournament_sub_matches sm
          where sm.matchup_id = m.id
            and sm.tournament_id = v_header.tournament_id
        ), '[]'::json)
      else '[]'::json
    end,
    'dreambreaker', coalesce((
      select json_build_object(
        'required', db.status is distinct from 'pending',
        'status', db.status,
        'version', db.version,
        'canSubmitOwnOrder',
          db.status = 'lineup_open'
          and db.orders_locked_at is null
          and (v_is_captain or v_is_deputy)
          and (
            case
              when jsonb_typeof(coalesce(
                case
                  when m.team_a_id = v_viewer_team_id then db.team_a_order
                  else db.team_b_order
                end,
                '[]'::jsonb
              )) = 'array'
              then jsonb_array_length(coalesce(
                case
                  when m.team_a_id = v_viewer_team_id then db.team_a_order
                  else db.team_b_order
                end,
                '[]'::jsonb
              ))
              else 0
            end
          ) is distinct from 4,
        'ownOrder', to_json(coalesce(
          case
            when m.team_a_id = v_viewer_team_id then db.team_a_order
            when m.team_b_id = v_viewer_team_id then db.team_b_order
            else '[]'::jsonb
          end,
          '[]'::jsonb
        )),
        'opponentOrderSubmitted',
          (
            case
              when jsonb_typeof(coalesce(
                case
                  when m.team_a_id = v_viewer_team_id then db.team_b_order
                  else db.team_a_order
                end,
                '[]'::jsonb
              )) = 'array'
              then jsonb_array_length(coalesce(
                case
                  when m.team_a_id = v_viewer_team_id then db.team_b_order
                  else db.team_a_order
                end,
                '[]'::jsonb
              ))
              else 0
            end
          ) = 4,
        'orderLockAt', db.order_lock_at,
        'ordersLockedAt', db.orders_locked_at,
        'ownOrderSource',
          case
            when m.team_a_id = v_viewer_team_id then db.order_source_a
            when m.team_b_id = v_viewer_team_id then db.order_source_b
            else null
          end
      )
      from public.team_tournament_dreambreaker_states db
      where db.matchup_id = m.id
        and db.tournament_id = v_header.tournament_id
    ), json_build_object(
      'required', false,
      'status', null,
      'version', null,
      'canSubmitOwnOrder', false,
      'ownOrder', '[]'::json,
      'opponentOrderSubmitted', false
    ))
  ) order by m.scheduled_at nulls last, m.created_at), '[]'::json)
  into v_matchups
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id);

  select coalesce(json_agg(json_build_object(
    'id', t.external_team_id,
    'name', t.name
  ) order by t.name), '[]'::json)
  into v_opponent_teams
  from public.team_tournament_teams t
  where t.team_tournament_id = v_header.id
    and t.external_team_id <> v_viewer_team_id
    and exists (
      select 1
      from public.team_tournament_matchups m
      where m.team_tournament_id = v_header.id
        and (m.team_a_id = v_viewer_team_id or m.team_b_id = v_viewer_team_id)
        and (m.team_a_id = t.external_team_id or m.team_b_id = t.external_team_id)
    );

  select coalesce(json_object_agg(
    l.team_external_id || '::' || mu.external_matchup_id,
    json_build_object(
      'matchupId', mu.external_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when l.team_external_id = v_viewer_team_id then l.selections
        when mu.status in ('published', 'in_progress', 'completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  join public.team_tournament_matchups mu on mu.id = l.matchup_id
  where mu.team_tournament_id = v_header.id
    and (mu.team_a_id = v_viewer_team_id or mu.team_b_id = v_viewer_team_id)
    and (
      l.team_external_id = v_viewer_team_id
      or mu.status in ('published', 'in_progress', 'completed')
      or l.published_at is not null
    );

  v_teams := json_build_array(v_my_team);

  return json_build_object(
    'ok', true,
    'schemaVersion', 7,
    'serverTime', now(),
    'viewerTeamId', v_viewer_team_id,
    'captainAccessEnabled', true,
    'viewer', json_build_object(
      'userId', auth.uid(),
      'viewerTeamId', v_viewer_team_id,
      'captain', v_is_captain,
      'deputy', v_is_deputy
    ),
    'permissions', json_build_object(
      'canViewTeams', true,
      'canViewSchedule', true,
      'canSubmitLineup', true,
      'canManageTournament', false
    ),
    'tournament', json_build_object(
      'id', v_header.tournament_id,
      'clubId', v_header.club_id,
      'tenantId', v_header.tenant_id,
      'name', v_header.name,
      'status', v_header.status,
      'version', v_header.version,
      'settings', jsonb_build_object(
        'captainAccessEnabled', true,
        'lineupLockLeadMinutes', v_header.settings->'lineupLockLeadMinutes',
        'rosterRules', v_header.settings->'rosterRules',
        'schedulePublish', v_header.settings->'schedulePublish',
        'formatPreset', v_header.settings->'formatPreset',
        'allowPlayerReusePerMatchup', v_header.settings->'allowPlayerReusePerMatchup',
        'dreambreakerEnabled', coalesce(
          (v_header.settings->>'dreambreakerEnabled')::boolean,
          true
        )
      ),
      'disciplines', v_disciplines,
      'myTeam', v_my_team,
      'opponentTeams', v_opponent_teams,
      'teams', v_teams,
      'matchups', v_matchups,
      'lineups', v_lineups
    )
  );
end;
$$;

-- team_tournament_get_visible_lineups
create or replace function public.team_tournament_get_visible_lineups(
  p_tournament_id text,
  p_matchup_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_is_manage boolean;
  v_can_results boolean;
  v_lineups json;
  v_player_id text;
  v_viewer text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  v_is_manage := public.team_tournament_can_manage();
  v_can_results := public.team_tournament_can_manage_results();
  v_player_id := public.team_tournament_user_player_id();
  v_viewer := nullif(trim(coalesce(p_viewer_team_id, '')), '');

  if not v_is_manage and not v_can_results then
    if not public.team_tournament_captain_access_enabled(v_header.settings) then
      return json_build_object(
        'ok', false,
        'code', 'captain_portal_closed',
        'error', 'Portal đội trưởng chưa được mở.'
      );
    end if;
    if v_viewer is not null
       and v_player_id is not null
       and not public.team_tournament_is_captain(v_header.id, v_viewer, v_player_id) then
      return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền xem đội hình đội này.');
    end if;
  end if;

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(v_viewer, '') then l.selections
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and (
      v_is_manage
      or l.team_external_id = coalesce(v_viewer, '')
      or (
        v_can_results
        and v_matchup.status in ('published','in_progress','completed')
      )
      or v_matchup.status in ('published','in_progress','completed')
      or l.published_at is not null
    );

  return json_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'matchupStatus', v_matchup.status,
    'serverTime', now(),
    'lineups', v_lineups
  );
end;
$$;

-- save_lineup_draft 6-arg CAS
create or replace function public.team_tournament_save_lineup_draft(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb,
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
  v_before jsonb;
  v_after jsonb;
  v_lineup_id uuid;
  v_gate json;
  v_validation jsonb;
  v_exists boolean := false;
  v_new_version integer;
begin
  if p_idempotency_key is null then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_IDEMPOTENCY_KEY',
      'error', 'p_idempotency_key is required.'
    );
  end if;

  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'save_lineup_draft', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'teamId', p_team_id, 'selections', p_selections,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
  if not coalesce((v_gate->>'ok')::boolean, false) then
    return v_gate;
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'deadline_passed', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  select l.* into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  v_exists := found;

  if not v_exists then
    if p_expected_version is not null and p_expected_version is distinct from 0 then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, 0
      );
    end if;
  else
    if v_lineup.locked_at is not null then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;
    if p_expected_version is not null and v_lineup.version is distinct from p_expected_version then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null then
    v_validation := public.team_tournament_validate_lineup_selections(
      v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), false
    );
    if not (v_validation->>'ok')::boolean then
      return v_validation;
    end if;
  end if;

  v_after := coalesce(p_selections, '{}'::jsonb);

  if not v_exists then
    v_before := null;
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, version, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'draft', v_after, 'captain', 1, auth.uid(), auth.uid()
    )
    returning id, version, status into v_lineup_id, v_new_version, v_lineup.status;
  else
    v_before := v_lineup.selections;
    update public.team_tournament_lineups l
    set status = 'draft',
        selections = v_after,
        updated_at = now(),
        updated_by = auth.uid(),
        version = l.version + 1
    where l.id = v_lineup.id
      and (p_expected_version is null or l.version = p_expected_version)
    returning l.id, l.version, l.status into v_lineup_id, v_new_version, v_lineup.status;

    if not found then
      select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_sync_lineup_entries(uuid,text,text,jsonb)') is not null then
    perform public.team_tournament_sync_lineup_entries(
      v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
    );
  end if;

  -- Explicit casts + p_actor_role force unique 13-arg resolution.
  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id::text,
    p_tournament_id::text,
    v_lineup_id::uuid,
    'draft'::text,
    coalesce(v_lineup.status, 'draft')::text,
    'draft'::text,
    v_before,
    v_after,
    case when p_expected_version is null then v_new_version - 1 else p_expected_version end,
    v_new_version,
    null::text,
    p_idempotency_key::text,
    'captain'::text
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.draft', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'selections', p_selections, 'version', v_new_version)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'lineupId', v_lineup_id,
    'version', v_new_version,
    'status', 'draft'
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_lineup_draft', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- submit_lineup 6-arg CAS
create or replace function public.team_tournament_submit_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb,
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
  v_before jsonb;
  v_after jsonb;
  v_lineup_id uuid;
  v_gate json;
  v_validation jsonb;
  v_exists boolean := false;
  v_new_version integer;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if p_idempotency_key is null then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'error', 'submit_lineup yêu cầu idempotencyKey + lineup expectedVersion.'
    );
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'submit_lineup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'teamId', p_team_id, 'selections', p_selections,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
  if not coalesce((v_gate->>'ok')::boolean, false) then
    return v_gate;
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'deadline_passed', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  select l.* into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  v_exists := found;

  if not v_exists then
    if p_expected_version is not null and p_expected_version is distinct from 0 then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, 0
      );
    end if;
  else
    if v_lineup.locked_at is not null then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;
    if p_expected_version is not null and v_lineup.version is distinct from p_expected_version then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null then
    v_validation := public.team_tournament_validate_lineup_selections(
      v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), true
    );
    if not (v_validation->>'ok')::boolean then
      return v_validation;
    end if;
  end if;

  v_after := coalesce(p_selections, '{}'::jsonb);

  if not v_exists then
    v_before := null;
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, version, submitted_at, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'submitted', v_after, 'captain', 1, now(), auth.uid(), auth.uid()
    )
    returning id, version into v_lineup_id, v_new_version;
  else
    v_before := v_lineup.selections;
    update public.team_tournament_lineups l
    set status = 'submitted',
        selections = v_after,
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid(),
        version = l.version + 1
    where l.id = v_lineup.id
      and (p_expected_version is null or l.version = p_expected_version)
    returning l.id, l.version into v_lineup_id, v_new_version;

    if not found then
      select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_sync_lineup_entries(uuid,text,text,jsonb)') is not null then
    perform public.team_tournament_sync_lineup_entries(
      v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
    );
  end if;

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id::text,
    p_tournament_id::text,
    v_lineup_id::uuid,
    'submit'::text,
    coalesce(v_lineup.status, 'draft')::text,
    'submitted'::text,
    v_before,
    v_after,
    case when p_expected_version is null then v_new_version - 1 else p_expected_version end,
    v_new_version,
    null::text,
    p_idempotency_key::text,
    'captain'::text
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.submit', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'version', v_new_version)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'lineupId', v_lineup_id,
    'version', v_new_version,
    'status', 'submitted'
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'submit_lineup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- publish_matchup 6-arg CAS
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_matchup_version integer,
  p_expected_lineup_a_version integer,
  p_expected_lineup_b_version integer,
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
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_ops jsonb;
  v_pub timestamptz := now();
  v_before jsonb;
  v_actor_role text;
  v_republish boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.publish')) then
    return json_build_object('ok', false, 'code', 'publish_forbidden', 'message', 'Không có quyền công bố đội hình.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupAVersion', p_expected_lineup_a_version,
      'expectedLineupBVersion', p_expected_lineup_b_version
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

  v_republish := coalesce(v_matchup.requires_republish, false);

  if not v_republish and v_matchup.status in ('published', 'in_progress', 'completed') then
    return json_build_object(
      'ok', false,
      'code', 'already_published',
      'message', 'Matchup đã được công bố.',
      'matchupVersion', v_matchup.version
    );
  end if;

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  if not v_republish and v_matchup.status <> 'locked' then
    return json_build_object(
      'ok', false,
      'code', 'matchup_not_locked',
      'message', 'Matchup chưa khóa.',
      'matchupVersion', v_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_a_id
  for update;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_b_id
  for update;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return json_build_object('ok', false, 'code', 'lineup_missing', 'message', 'Thiếu đội hình.');
  end if;

  if p_expected_lineup_a_version is not null and v_lineup_a.version <> p_expected_lineup_a_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_a_version, v_lineup_a.version
    );
  end if;

  if p_expected_lineup_b_version is not null and v_lineup_b.version <> p_expected_lineup_b_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_b_version, v_lineup_b.version
    );
  end if;

  v_ops := public.team_tournament_matchup_publish_ops(v_header, v_matchup, v_pub);

  if not coalesce((v_ops->>'canPublish')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'CANNOT_PUBLISH'),
      'message', coalesce(v_ops->>'blockMessage', 'Chưa đủ điều kiện công bố.'),
      'publishOps', v_ops
    );
  end if;

  if v_republish then
    update public.team_tournament_lineups l
    set status = 'published',
        published_at = v_pub,
        override_reason = null,
        version = l.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where l.id in (v_lineup_a.id, v_lineup_b.id)
      and l.status in ('locked', 'overridden', 'published');

    if (
      select count(*)::int from public.team_tournament_lineups
      where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
    ) <> 2 then
      raise exception 'TT2E/TT3 republish partial lineup update blocked';
    end if;

    update public.team_tournament_matchups m
    set status = case when m.status in ('lineup_open','locked') then 'published' else m.status end,
        requires_republish = false,
        version = m.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where m.id = v_matchup.id;

    if not found then
      raise exception 'TT3 republish partial matchup update blocked';
    end if;
  else
    update public.team_tournament_lineups l
    set status = 'published',
        published_at = v_pub,
        version = l.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where l.id in (v_lineup_a.id, v_lineup_b.id)
      and l.status = 'locked';

    if (
      select count(*)::int from public.team_tournament_lineups
      where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
    ) <> 2 then
      raise exception 'TT2E publish partial lineup update blocked';
    end if;

    update public.team_tournament_matchups m
    set status = 'published',
        version = m.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where m.id = v_matchup.id
      and m.status = 'locked'
      and (p_expected_matchup_version is null or m.version = p_expected_matchup_version);

    if not found then
      raise exception 'TT2E publish partial matchup update blocked';
    end if;
  end if;

  select l.version into v_lineup_a.version from public.team_tournament_lineups l where l.id = v_lineup_a.id;
  select l.version into v_lineup_b.version from public.team_tournament_lineups l where l.id = v_lineup_b.id;
  select m.version into v_matchup.version from public.team_tournament_matchups m where m.id = v_matchup.id;

  v_actor_role := case
    when public.team_tournament_can_manage() then 'btc'
    when public.user_has_permission('team.lineup.publish') then 'organizer'
    else 'unknown'
  end;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id,
    case when v_republish then 'team.lineup.republish' else 'team.lineup.publish' end,
    p_matchup_id,
    jsonb_build_object(
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'republish', v_republish,
      'matchupVersion', v_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'republish', v_republish,
    'matchupVersion', v_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'publishedAt', v_pub
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- save_sub_match_draft 6-arg CAS
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
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_expected_version is null then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_EXPECTED_VERSION',
      'error', 'p_expected_version (subMatch.version) is required.'
    );
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object(
      'ok', false,
      'code', 'MISSING_IDEMPOTENCY_KEY',
      'error', 'p_idempotency_key is required.'
    );
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

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'score', p_score,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  -- CAS BEFORE write — subMatch.version only (never tournament/matchup.version)
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

  -- Confirmed/finalized results cannot use normal draft writer
  if v_sub_match.result_confirmed_at is not null then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION',
      'error', 'Kết quả đã xác nhận — không lưu nháp qua draft path.'
    );
  end if;
  if v_sub_match.status = 'completed' then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION',
      'error', 'Trận con đã hoàn thành — không lưu nháp qua draft path.'
    );
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
    select version into v_sub_match.version
    from public.team_tournament_sub_matches
    where id = v_sub_match.id;
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
    'ok', true,
    'version', v_new_version,
    'subMatchId', p_sub_match_id,
    'matchupId', p_matchup_id
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_sub_match_draft',
    p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- upsert_standings 4-arg CAS
create or replace function public.team_tournament_upsert_standings(
  p_tournament_id text,
  p_standings jsonb,
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
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_current_version integer;
begin
  if p_idempotency_key is null then
    return public.team_tournament_upsert_standings(p_tournament_id, p_standings);
  end if;

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
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'recalculate_standings', p_idempotency_key,
    jsonb_build_object('standings', p_standings, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select coalesce(max(s.version), 1) into v_current_version
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id;

  if p_expected_version is not null and v_current_version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_standings', p_expected_version, v_current_version
    );
  end if;

  v_result := public.team_tournament_upsert_standings(p_tournament_id, p_standings)::jsonb;

  if not (v_result->>'ok')::boolean then
    return v_result;
  end if;

  update public.team_tournament_standings
  set version = coalesce(v_current_version, 1) + 1
  where team_tournament_id = v_header.id;

  v_result := jsonb_build_object(
    'ok', true,
    'version', coalesce(v_current_version, 1) + 1,
    'calculationVersion', md5(coalesce(p_standings, '[]'::jsonb)::text)
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'recalculate_standings', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- override_lineup
create or replace function public.team_tournament_override_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb,
  p_reason text,
  p_expected_matchup_version integer,
  p_expected_lineup_version integer,
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
  v_lineup public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_ops jsonb;
  v_validation jsonb;
  v_now timestamptz := now();
  v_status_before text;
  v_version_before integer;
  v_selections_before jsonb;
  v_actor_role text;
  v_elevated boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object(
      'ok', false,
      'code', 'override_reason_required',
      'message', 'Bắt buộc nhập lý do override.'
    );
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'override_lineup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'teamId', p_team_id,
      'selections', coalesce(p_selections, '{}'::jsonb),
      'reason', p_reason,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupVersion', p_expected_lineup_version
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

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_id
  for update;

  v_ops := public.team_tournament_lineup_override_ops(v_header, v_matchup, v_lineup, p_team_id);
  if not coalesce((v_ops->>'canOverride')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'override_forbidden'),
      'message', coalesce(v_ops->>'blockMessage', 'Không thể override lineup.'),
      'overrideOps', v_ops
    );
  end if;

  v_elevated := coalesce((v_ops->>'elevatedReasonRequired')::boolean, false);
  if v_elevated and length(btrim(p_reason)) < 15 then
    return json_build_object(
      'ok', false,
      'code', 'override_elevated_reason_required',
      'message', 'Matchup đã bắt đầu — lý do phải có ít nhất 15 ký tự.',
      'overrideOps', v_ops
    );
  end if;

  if p_expected_lineup_version is not null and v_lineup.version <> p_expected_lineup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_version, v_lineup.version
    );
  end if;

  v_validation := public.team_tournament_validate_lineup_selections(
    v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), true
  );
  if not (v_validation->>'ok')::boolean then
    return v_validation;
  end if;

  v_status_before := v_lineup.status;
  v_version_before := v_lineup.version;
  v_selections_before := coalesce(v_lineup.selections, '{}'::jsonb);

  v_actor_role := case
    when public.is_super_admin() then 'super_admin'
    when public.user_has_permission('tournament.update') then 'tournament_director'
    when public.team_tournament_can_manage() then 'btc'
    else 'organizer'
  end;

  update public.team_tournament_lineups l
  set status = 'overridden',
      selections = coalesce(p_selections, '{}'::jsonb),
      source = 'btc_override',
      previous_lineup_version = v_version_before,
      override_reason = btrim(p_reason),
      overridden_at = v_now,
      overridden_by = auth.uid(),
      published_at = null,
      locked_at = coalesce(l.locked_at, v_now),
      updated_at = v_now,
      updated_by = auth.uid(),
      version = l.version + 1,
      audit_note = format('tt3:override:%s', v_now)
  where l.id = v_lineup.id
    and (p_expected_lineup_version is null or l.version = p_expected_lineup_version)
  returning l.version, l.selections into v_lineup.version, v_lineup.selections;

  if not found then
    select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_version, v_lineup.version
    );
  end if;

  perform public.team_tournament_sync_lineup_entries(
    v_lineup.id, v_header.tenant_id, p_tournament_id, v_lineup.selections
  );

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id, p_tournament_id, v_lineup.id, 'btc_override',
    v_status_before, 'overridden',
    v_selections_before, v_lineup.selections,
    v_version_before, v_lineup.version,
    btrim(p_reason), p_idempotency_key, v_actor_role
  );

  update public.team_tournament_matchups m
  set requires_republish = true,
      version = m.version + 1,
      updated_at = v_now,
      updated_by = auth.uid()
  where m.id = v_matchup.id
    and (p_expected_matchup_version is null or m.version = p_expected_matchup_version)
  returning m.version into v_matchup.version;

  if not found then
    raise exception 'TT3 override partial matchup update blocked';
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.override', p_matchup_id,
    jsonb_build_object(
      'teamId', p_team_id,
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'reason', btrim(p_reason),
      'statusBefore', v_status_before,
      'statusAfter', 'overridden',
      'lineupVersionBefore', v_version_before,
      'lineupVersionAfter', v_lineup.version,
      'matchupVersion', v_matchup.version,
      'requiresRepublish', true,
      'matchupStarted', v_elevated,
      'requestId', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'teamId', p_team_id,
    'lineupId', v_lineup.id,
    'lineupVersion', v_lineup.version,
    'matchupVersion', v_matchup.version,
    'status', 'overridden',
    'requiresRepublish', true,
    'previousLineupVersion', v_version_before
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'override_lineup', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- get_lineup_override_ops
create or replace function public.team_tournament_get_lineup_override_ops(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text
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
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_id;

  return json_build_object(
    'ok', true,
    'overrideOps', public.team_tournament_lineup_override_ops(v_header, v_matchup, v_lineup, p_team_id),
    'requiresRepublish', coalesce(v_matchup.requires_republish, false),
    'matchupStatus', v_matchup.status,
    'matchupVersion', v_matchup.version
  );
end;
$$;

-- assert_close_readiness
create or replace function public.team_tournament_assert_close_readiness(
  p_team_tournament_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_gc integer;
  v_group_total integer := 0;
  v_group_incomplete integer := 0;
  v_ko_total integer := 0;
  v_ko_incomplete integer := 0;
  v_final public.team_tournament_matchups;
  v_champion text := null;
  v_rank1_count integer := 0;
begin
  select * into v_header
  from public.team_tournaments
  where id = p_team_tournament_id;

  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Tournament not found');
  end if;

  v_gc := greatest(
    1,
    coalesce(nullif(trim(coalesce(v_header.settings->>'groupCount', '')), '')::int, 1)
  );

  select
    count(*)::int,
    count(*) filter (
      where m.status is distinct from 'completed'
         or nullif(trim(coalesce(m.result->>'winnerTeamId', '')), '') is null
    )::int
  into v_group_total, v_group_incomplete
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group')
        is distinct from 'knockout';

  if v_group_total < 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_STAGE_INCOMPLETE',
      'error', 'Required group round-robin matchups are missing',
      'groupCount', v_gc,
      'groupMatchupCount', v_group_total
    );
  end if;

  if v_group_incomplete > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'GROUP_STAGE_INCOMPLETE',
      'error', 'Required group matchups are not all completed',
      'groupCount', v_gc,
      'groupMatchupCount', v_group_total,
      'incompleteGroupMatchups', v_group_incomplete
    );
  end if;

  if v_gc <= 1 then
    -- One-group: no knockout required. Champion = deterministic standings rank 1
    -- (recompute is caller's responsibility before reading standings; here we
    -- validate completion is enough to resolve via existing ranking order).
    select count(*)::int into v_rank1_count
    from public.team_tournament_teams t
    where t.team_tournament_id = v_header.id;

    if v_rank1_count < 1 then
      return jsonb_build_object(
        'ok', false,
        'code', 'CHAMPION_UNRESOLVED',
        'error', 'No teams available to resolve champion from group standings',
        'groupCount', v_gc
      );
    end if;

    -- Deterministic champion from completed group results (same order as standings cache).
    with scored as (
      select
        t.external_team_id as team_id,
        coalesce(sum(case
          when m.status = 'completed'
           and nullif(trim(coalesce(m.result->>'winnerTeamId','')), '') = t.external_team_id
          then 1 else 0 end), 0) as wins,
        coalesce(sum(case
          when m.status = 'completed'
           and m.team_a_id = t.external_team_id
          then coalesce((m.result->>'teamAWins')::int, 0)
             - coalesce((m.result->>'teamBWins')::int, 0)
          when m.status = 'completed'
           and m.team_b_id = t.external_team_id
          then coalesce((m.result->>'teamBWins')::int, 0)
             - coalesce((m.result->>'teamAWins')::int, 0)
          else 0 end), 0) as sub_diff,
        coalesce(sum(case
          when m.status = 'completed' and m.team_a_id = t.external_team_id
            then coalesce((m.result->>'teamAPoints')::int, 0)
          when m.status = 'completed' and m.team_b_id = t.external_team_id
            then coalesce((m.result->>'teamBPoints')::int, 0)
          else 0 end), 0) as points_scored
      from public.team_tournament_teams t
      left join public.team_tournament_matchups m
        on m.team_tournament_id = t.team_tournament_id
       and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group')
           is distinct from 'knockout'
       and (m.team_a_id = t.external_team_id or m.team_b_id = t.external_team_id)
      where t.team_tournament_id = v_header.id
      group by t.external_team_id
    )
    select team_id into v_champion
    from scored
    order by wins desc, sub_diff desc, points_scored desc, team_id
    limit 1;

    if nullif(trim(coalesce(v_champion, '')), '') is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'CHAMPION_UNRESOLVED',
        'error', 'Champion could not be resolved from completed group results',
        'groupCount', v_gc
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'groupCount', v_gc,
      'mode', 'one_group',
      'championTeamId', v_champion,
      'championSource', 'group_standings_derived'
    );
  end if;

  -- Multi-group: elimination bracket required; final must be completed.
  select
    count(*)::int,
    count(*) filter (
      where m.status is distinct from 'completed'
         or nullif(trim(coalesce(m.result->>'winnerTeamId', '')), '') is null
    )::int
  into v_ko_total, v_ko_incomplete
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group') = 'knockout';

  if v_ko_total < 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'ELIMINATION_INCOMPLETE',
      'error', 'Required elimination bracket is missing',
      'groupCount', v_gc,
      'knockoutMatchupCount', v_ko_total
    );
  end if;

  if v_ko_incomplete > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'ELIMINATION_INCOMPLETE',
      'error', 'Required elimination matchups are not all completed',
      'groupCount', v_gc,
      'knockoutMatchupCount', v_ko_total,
      'incompleteKnockoutMatchups', v_ko_incomplete
    );
  end if;

  select m.* into v_final
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and coalesce(nullif(trim(coalesce(m.schedule_meta->>'stage', '')), ''), 'group') = 'knockout'
    and public.team_tournament_resolve_competition_stage(m) = 'final'
  order by m.updated_at desc nulls last
  limit 1;

  if v_final.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'FINAL_NOT_COMPLETED',
      'error', 'Canonical final matchup not found',
      'groupCount', v_gc
    );
  end if;

  if v_final.status is distinct from 'completed'
     or nullif(trim(coalesce(v_final.result->>'winnerTeamId', '')), '') is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'FINAL_NOT_COMPLETED',
      'error', 'Canonical final matchup is not completed with a winner',
      'groupCount', v_gc,
      'finalMatchupId', v_final.external_matchup_id
    );
  end if;

  v_champion := nullif(trim(coalesce(v_final.result->>'winnerTeamId', '')), '');
  if v_champion is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'CHAMPION_UNRESOLVED',
      'error', 'Champion could not be resolved from final winner',
      'groupCount', v_gc,
      'finalMatchupId', v_final.external_matchup_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'groupCount', v_gc,
    'mode', 'multi_group',
    'championTeamId', v_champion,
    'championSource', 'final_winner',
    'finalMatchupId', v_final.external_matchup_id
  );
end;
$$;

-- close_tournament
create or replace function public.team_tournament_close_tournament(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prepare json;
  v_header public.team_tournaments;
  v_envelope jsonb;
  v_payload jsonb;
  v_new_version integer;
  v_settings jsonb;
  v_closing jsonb;
  v_ready jsonb;
  v_standings jsonb;
  v_now timestamptz := now();
  v_actor uuid := auth.uid();
  v_champion text;
begin
  if v_actor is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.close',
    p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if v_header.status in ('completed', 'cancelled') then
    return json_build_object('ok', false, 'code', 'ALREADY_CLOSED',
      'error', 'Tournament already completed/cancelled');
  end if;

  v_envelope := v_prepare->'envelope';
  v_payload := coalesce(v_envelope->'payload', '{}'::jsonb);

  -- B01: fail closed unless canonical competition state is ready.
  v_ready := public.team_tournament_assert_close_readiness(v_header.id);
  if not coalesce((v_ready->>'ok')::boolean, false) then
    return v_ready::json;
  end if;

  v_champion := nullif(trim(coalesce(v_ready->>'championTeamId', '')), '');
  if v_champion is null then
    return json_build_object(
      'ok', false,
      'code', 'CHAMPION_UNRESOLVED',
      'error', 'Champion unresolved after readiness check'
    );
  end if;

  -- Refresh standings cache from persisted results (server authority).
  if to_regprocedure('public.team_tournament_recompute_standings_cache(uuid)') is not null then
    v_standings := public.team_tournament_recompute_standings_cache(v_header.id);
  end if;

  -- B02: lifecycle + existing closing metadata only.
  -- Client summary/awardsSheet/frozenStandings are NEVER trusted as result authority.
  -- Optional non-authoritative presentation snapshot is server-derived only.
  v_closing := jsonb_build_object(
    'closed', true,
    'closedAt', to_jsonb(v_now),
    'closedBy', to_jsonb(v_actor::text),
    'resultsLocked', true,
    'championTeamId', to_jsonb(v_champion),
    'closingSnapshot', jsonb_build_object(
      'authoritative', false,
      'note', 'Presentation/audit only; champion/status derive from canonical matchups/results',
      'championTeamId', v_champion,
      'championSource', v_ready->>'championSource',
      'mode', v_ready->>'mode',
      'derivedAt', v_now,
      'standingsRecomputeOk', coalesce((v_standings->>'ok')::boolean, false)
    )
  );

  -- Explicitly ignore client result payloads even if present.
  if v_payload ? 'summary'
     or v_payload ? 'awardsSheet'
     or v_payload ? 'frozenStandings'
     or v_payload ? 'championTeamId' then
    null; -- discarded: CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO
  end if;

  v_settings := coalesce(v_header.settings, '{}'::jsonb) || v_closing
    || jsonb_build_object('closing', coalesce(v_header.settings->'closing', '{}'::jsonb) || v_closing);

  update public.team_tournaments
     set status = 'completed',
         settings = v_settings,
         updated_at = v_now,
         updated_by = v_actor
   where id = v_header.id;

  -- uuid/text-safe dual-write (remediation vs lifecycle bare id = text)
  update public.canonical_tournaments
     set status = 'completed',
         updated_at = v_now
   where id = nullif(btrim(coalesce(v_header.tournament_id, '')), '')::uuid
      or id = nullif(btrim(coalesce(p_tournament_id, '')), '')::uuid
      or external_key = nullif(btrim(coalesce(v_header.tournament_id, '')), '')
      or external_key = nullif(btrim(coalesce(p_tournament_id, '')), '');

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version)
      || jsonb_build_object(
        'championTeamId', v_champion,
        'closeReadiness', v_ready
      ),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

-- search_referee_candidates
create or replace function public.team_tournament_search_referee_candidates(
  p_tournament_id text,
  p_search text default '',
  p_limit integer default 20
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_rows json;
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

  -- Candidate source = profiles identity directory (display + email).
  -- No profiles.role filter: existing create assignment treats profile existence
  -- as sufficient identity; assignment table is runtime authority.
  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      p.id as "userId",
      coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'Referee')
        as "displayName",
      coalesce(p.email, '') as email,
      coalesce(p.status, '') as status
    from public.profiles p
    where coalesce(p.status, 'active') is distinct from 'disabled'
      and (
        v_q is null
        or p.email ilike '%' || v_q || '%'
        or p.display_name ilike '%' || v_q || '%'
        or coalesce(p.phone, '') ilike '%' || v_q || '%'
      )
    order by
      case when v_q is not null and p.email ilike v_q || '%' then 0 else 1 end,
      p.display_name nulls last,
      p.email
    limit v_limit
  ) t;

  return json_build_object(
    'ok', true,
    'candidates', coalesce(v_rows, '[]'::json),
    'eligibilityNote', 'profiles identity only; create_referee_assignment is authority'
  );
end;
$$;

-- revoke_referee_assignment
create or replace function public.team_tournament_revoke_referee_assignment(
  p_tournament_id text,
  p_assignment_id uuid,
  p_expected_version integer,
  p_reason text,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_row public.referee_assignments;
  v_effective text;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'code', 'REVOKE_REASON_REQUIRED');
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
    v_header.tenant_id, p_tournament_id, 'revoke_referee_assignment', p_idempotency_key,
    jsonb_build_object('assignmentId', p_assignment_id, 'expectedVersion', p_expected_version, 'reason', p_reason)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_row
  from public.referee_assignments
  where id = p_assignment_id
    and tenant_id = v_header.tenant_id
    and tournament_id = v_header.tournament_id
  for update;

  if v_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_version is not null and v_row.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'referee_assignments', p_expected_version, v_row.version
    );
  end if;

  v_effective := public.referee_v5_assignment_effective_status(
    v_row.status, v_row.expires_at, v_row.revoked_at
  );

  if v_effective = 'revoked' then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_row.id,
      'status', 'revoked'
    );
  end if;

  update public.referee_assignments set
    status = 'revoked',
    revoked_at = now(),
    revoked_by = auth.uid(),
    revoke_reason = p_reason,
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_revoked', v_row.match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'reason', p_reason,
      'beforeStatus', v_effective,
      'afterStatus', 'revoked',
      'version', v_row.version
    )
  );

  return json_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'status', 'revoked',
    'version', v_row.version,
    'revokedAt', v_row.revoked_at
  );
end;
$$;

-- list_referee_assignments
create or replace function public.team_tournament_list_referee_assignments(
  p_tournament_id text,
  p_sub_match_id text default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_items jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', ra.id,
    'refereeUserId', ra.referee_user_id,
    'refereeDisplayName', ra.referee_display_name,
    'matchId', ra.match_id,
    'externalSubMatchId', ra.external_sub_match_id,
    'externalMatchupId', ra.external_matchup_id,
    'status', public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at),
    'rawStatus', ra.status,
    'assignedAt', ra.assigned_at,
    'expiresAt', ra.expires_at,
    'revokedAt', ra.revoked_at,
    'revokeReason', ra.revoke_reason,
    'version', ra.version
  ) order by ra.assigned_at desc), '[]'::jsonb)
  into v_items
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and (p_sub_match_id is null or ra.external_sub_match_id = p_sub_match_id);

  return json_build_object('ok', true, 'assignments', v_items);
end;
$$;

-- referee_competition_athlete_directory
create or replace function public.team_tournament_referee_competition_athlete_directory(
  p_tournament_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_allowed boolean := false;
  v_athletes jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  if public.team_tournament_can_manage()
     or public.team_tournament_can_manage_results() then
    v_allowed := true;
  elsif to_regclass('public.referee_assignments') is not null then
    select exists (
      select 1
      from public.referee_assignments ra
      where ra.tenant_id = v_header.tenant_id
        and ra.tournament_id = v_header.tournament_id
        and ra.referee_user_id = auth.uid()
        and ra.revoked_at is null
    ) into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."displayName", t."athleteId"), '[]'::jsonb)
    into v_athletes
  from (
    select distinct on (m.player_id)
      m.player_id as "athleteId",
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(a.display_name), ''),
        m.player_id
      ) as "displayName",
      case
        when lower(trim(coalesce(p.gender, ''))) in ('male', 'm', 'nam') then 'male'
        when lower(trim(coalesce(p.gender, ''))) in ('female', 'f', 'nu', 'nữ') then 'female'
        when nullif(trim(coalesce(p.gender, '')), '') is null then null
        else lower(trim(p.gender))
      end as gender
    from public.team_tournament_team_members m
    join public.team_tournament_teams tm
      on tm.id = m.team_id
     and tm.team_tournament_id = v_header.id
    left join public.athletes a
      on a.id::text = m.player_id
     and a.tenant_id = v_header.tenant_id
    left join public.profiles p
      on p.id = a.user_id
    where nullif(trim(coalesce(m.player_id, '')), '') is not null
    order by m.player_id, m.created_at nulls last
  ) t;

  return jsonb_build_object(
    'ok', true,
    'athletes', coalesce(v_athletes, '[]'::jsonb)
  );
end;
$$;

-- Least-privilege grants. Privileged RPCs: authenticated only. Anon/PUBLIC denied.
do $grants$
declare
  r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'team_tournament_merge_mlp_initial_settings',
        'team_tournament_seed_mlp_disciplines',
        'team_tournament_initial_setup_team_data',
        'team_tournament_status_is_athlete_visible',
        'team_tournament_can_view_dashboard',
        'team_tournament_user_player_id',
        'team_tournament_captain_access_enabled',
        'team_tournament_assert_captain_portal_access',
        'team_tournament_guard_captain_portal_write',
        'team_tournament_resolve_competition_stage',
        'team_tournament_resolve_stage_tiebreak_policy',
        'team_tournament_stage_tiebreak_locked_stages',
        'team_tournament_referee_link_blocks_legacy',
        'team_tournament_sub_match_score_ops',
        'team_tournament_write_lineup_revision',
        'team_tournament_lineup_override_ops',
        'team_tournament_create',
        'team_tournament_ensure_canonical',
        'team_tournament_get_dashboard',
        'team_tournament_list_my_dashboards',
        'team_tournament_commit_pairing',
        'team_tournament_update_setup_config',
        'team_tournament_set_captain_access',
        'team_tournament_get_captain_portal',
        'team_tournament_get_visible_lineups',
        'team_tournament_save_lineup_draft',
        'team_tournament_submit_lineup',
        'team_tournament_publish_matchup',
        'team_tournament_save_sub_match_draft',
        'team_tournament_upsert_standings',
        'team_tournament_override_lineup',
        'team_tournament_get_lineup_override_ops',
        'team_tournament_assert_close_readiness',
        'team_tournament_close_tournament',
        'team_tournament_search_referee_candidates',
        'team_tournament_revoke_referee_assignment',
        'team_tournament_list_referee_assignments',
        'team_tournament_referee_competition_athlete_directory'
      )
  loop
    execute format('revoke all on function %s from public', r.oid::regprocedure);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.oid::regprocedure);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
    end if;
  end loop;
end;
$grants$;

comment on function public.team_tournament_create(text, text, text, text, text, text, jsonb) is
  'alignment-01: canonical dual persist, MLP seed, Dreambreaker catalog, fail closed';
