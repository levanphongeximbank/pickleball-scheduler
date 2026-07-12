-- Phase TT-2C — Server-side lineup validation parity
-- Prerequisite: PHASE_23C + PHASE_TT1B + PHASE_TT2B on staging
-- Safe to re-run (create or replace)

-- ─── Gender normalization (mirror client getPlayerGenderKey) ───
create or replace function public.team_tournament_normalize_gender_key(p_gender text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(trim(coalesce(p_gender, ''))) in ('nam', 'male', 'm') then 'male'
    when lower(trim(coalesce(p_gender, ''))) in ('nữ', 'nu', 'female', 'f', 'n') then 'female'
    when lower(trim(coalesce(p_gender, ''))) in ('other', 'khac', 'khác') then 'other'
    else 'unknown'
  end;
$$;

-- Resolve gender from profiles (SoT — never trust client payload)
create or replace function public.team_tournament_resolve_player_gender_key(
  p_player_id text,
  p_tenant_id text,
  p_club_id text default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_gender text;
  v_blob jsonb;
begin
  select public.team_tournament_normalize_gender_key(p.gender)
  into v_gender
  from public.profiles p
  where nullif(trim(p.player_id), '') = nullif(trim(p_player_id), '')
  limit 1;

  if v_gender is not null and v_gender not in ('unknown') then
    return v_gender;
  end if;

  if p_club_id is not null then
    select c.data into v_blob
    from public.club_data_v3 c
    where c.club_id = p_club_id
    limit 1;

    if v_blob is not null then
      select public.team_tournament_normalize_gender_key(elem->>'gender')
      into v_gender
      from jsonb_array_elements(coalesce(v_blob->'players', '[]'::jsonb)) elem
      where elem->>'id' = p_player_id
      limit 1;

      if v_gender is not null and v_gender not in ('unknown') then
        return v_gender;
      end if;
    end if;
  end if;

  return coalesce(v_gender, 'unknown');
end;
$$;

create or replace function public.team_tournament_resolve_player_status(p_player_id text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.status), ''),
    case when p.id is not null then 'active' else null end,
    'unknown'
  )
  from (select 1) x
  left join public.profiles p on nullif(trim(p.player_id), '') = nullif(trim(p_player_id), '')
  limit 1;
$$;

create or replace function public.team_tournament_lineup_validation_fail(
  p_code text,
  p_message text,
  p_field_errors jsonb default '{}'::jsonb,
  p_rule_violations jsonb default '[]'::jsonb,
  p_invalid_player_ids jsonb default '[]'::jsonb,
  p_invalid_discipline_ids jsonb default '[]'::jsonb,
  p_lineup_version integer default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'ok', false,
    'code', p_code,
    'message', p_message,
    'error', p_message,
    'fieldErrors', coalesce(p_field_errors, '{}'::jsonb),
    'ruleViolations', coalesce(p_rule_violations, '[]'::jsonb),
    'invalidPlayerIds', coalesce(p_invalid_player_ids, '[]'::jsonb),
    'invalidDisciplineIds', coalesce(p_invalid_discipline_ids, '[]'::jsonb),
    'serverTime', now(),
    'lineupVersion', p_lineup_version
  );
$$;

-- ─── Core validator ───
create or replace function public.team_tournament_validate_lineup_selections(
  p_header public.team_tournaments,
  p_team_external_id text,
  p_matchup_id text,
  p_selections jsonb,
  p_is_submit boolean default false
)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v_team public.team_tournament_teams;
  v_matchup public.team_tournament_matchups;
  v_lineup public.team_tournament_lineups;
  v_discipline record;
  v_player_id text;
  v_count int;
  v_expected int;
  v_gender_req text;
  v_gender_key text;
  v_male_count int;
  v_female_count int;
  v_used jsonb := '{}'::jsonb;
  v_allow_reuse boolean;
  v_is_mlp boolean;
  v_partial boolean;
  v_warnings jsonb := '[]'::jsonb;
  v_disc_id text;
  v_players int;
begin
  if p_header.id is null then
    return public.team_tournament_lineup_validation_fail(
      'validation', 'Không tìm thấy giải.'
    );
  end if;

  select * into v_team
  from public.team_tournament_teams t
  where t.team_tournament_id = p_header.id
    and t.external_team_id = p_team_external_id;

  if v_team.id is null then
    return public.team_tournament_lineup_validation_fail(
      'player_not_in_team', 'Không tìm thấy đội trong giải.'
    );
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = p_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return public.team_tournament_lineup_validation_fail(
      'invalid_discipline', 'Không tìm thấy matchup.'
    );
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_external_id;

  v_partial := not coalesce(p_is_submit, false);
  v_allow_reuse := coalesce((p_header.settings->>'allowPlayerReusePerMatchup')::boolean, false);
  v_is_mlp := coalesce(p_header.settings->>'formatPreset', '') = 'mlp_4';

  for v_discipline in
    select *
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
    order by d.sort_order
  loop
    v_disc_id := v_discipline.external_discipline_id;
    v_expected := v_discipline.player_count;
    v_gender_req := v_discipline.gender_requirement;

    if not (p_selections ? v_disc_id) then
      if p_is_submit then
        return public.team_tournament_lineup_validation_fail(
          'lineup_incomplete',
          format('%s cần %s VĐV.', v_discipline.name, v_expected),
          jsonb_build_object(v_disc_id, jsonb_build_array(format('Cần %s VĐV', v_expected))),
          '[]'::jsonb,
          '[]'::jsonb,
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;
      continue;
    end if;

    v_count := coalesce(jsonb_array_length(p_selections->v_disc_id), 0);

    if v_count = 0 then
      if p_is_submit then
        return public.team_tournament_lineup_validation_fail(
          'lineup_incomplete',
          format('%s cần %s VĐV.', v_discipline.name, v_expected),
          jsonb_build_object(),
          '[]'::jsonb,
          '[]'::jsonb,
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;
      continue;
    end if;

    if v_partial and v_count > v_expected then
      return public.team_tournament_lineup_validation_fail(
        'roster_limit_exceeded',
        format('%s: tối đa %s VĐV.', v_discipline.name, v_expected),
        jsonb_build_object(),
        '[]'::jsonb,
        '[]'::jsonb,
        jsonb_build_array(v_disc_id),
        v_lineup.version
      );
    end if;

    if (not v_partial or v_count = v_expected) and v_count <> v_expected then
      return public.team_tournament_lineup_validation_fail(
        case when p_is_submit then 'lineup_incomplete' else 'roster_limit_exceeded' end,
        format('%s cần %s VĐV.', v_discipline.name, v_expected),
        jsonb_build_object(),
        '[]'::jsonb,
        '[]'::jsonb,
        jsonb_build_array(v_disc_id),
        v_lineup.version
      );
    end if;

    -- Duplicate within discipline
    if v_count <> (
      select count(distinct val)
      from jsonb_array_elements_text(p_selections->v_disc_id) as t(val)
    ) then
      return public.team_tournament_lineup_validation_fail(
        'duplicate_player',
        format('%s: không được trùng VĐV.', v_discipline.name),
        jsonb_build_object(),
        '[]'::jsonb,
        '[]'::jsonb,
        jsonb_build_array(v_disc_id),
        v_lineup.version
      );
    end if;

    for v_player_id in
      select jsonb_array_elements_text(p_selections->v_disc_id)
    loop
      if not exists (
        select 1 from public.team_tournament_team_members m
        where m.team_id = v_team.id and m.player_id = v_player_id
      ) then
        return public.team_tournament_lineup_validation_fail(
          'player_not_in_team',
          format('%s: VĐV %s không thuộc đội.', v_discipline.name, v_player_id),
          jsonb_build_object(),
          '[]'::jsonb,
          jsonb_build_array(v_player_id),
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;

      if v_player_id = any(coalesce(v_team.absent_player_ids, '{}'::text[]))
        or v_player_id = any(coalesce(v_team.locked_player_ids, '{}'::text[]))
      then
        return public.team_tournament_lineup_validation_fail(
          'player_not_eligible',
          format('%s: VĐV %s vắng mặt hoặc bị khóa.', v_discipline.name, v_player_id),
          jsonb_build_object(),
          '[]'::jsonb,
          jsonb_build_array(v_player_id),
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;

      if lower(public.team_tournament_resolve_player_status(v_player_id)) not in ('active', 'unknown') then
        return public.team_tournament_lineup_validation_fail(
          'player_inactive',
          format('%s: VĐV %s không còn active.', v_discipline.name, v_player_id),
          jsonb_build_object(),
          '[]'::jsonb,
          jsonb_build_array(v_player_id),
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;

      if not v_allow_reuse and v_used ? v_player_id then
        return public.team_tournament_lineup_validation_fail(
          'duplicate_player',
          format('%s: VĐV %s đã được chọn ở nội dung khác.', v_discipline.name, v_player_id),
          jsonb_build_object(),
          '[]'::jsonb,
          jsonb_build_array(v_player_id),
          jsonb_build_array(v_disc_id),
          v_lineup.version
        );
      end if;

      v_used := v_used || jsonb_build_object(v_player_id, true);

      if (not v_partial or v_count = v_expected) then
        v_gender_key := public.team_tournament_resolve_player_gender_key(
          v_player_id, p_header.tenant_id, p_header.club_id
        );

        if v_gender_key in ('unknown', 'other') and v_gender_req in ('male', 'female', 'mixed_pair') then
          return public.team_tournament_lineup_validation_fail(
            'invalid_gender',
            format('%s: VĐV %s thiếu giới tính hợp lệ.', v_discipline.name, v_player_id),
            jsonb_build_object(),
            '[]'::jsonb,
            jsonb_build_array(v_player_id),
            jsonb_build_array(v_disc_id),
            v_lineup.version
          );
        end if;
      end if;
    end loop;

    if (not v_partial or v_count = v_expected) and v_count > 0 then
      v_male_count := 0;
      v_female_count := 0;
      for v_player_id in select jsonb_array_elements_text(p_selections->v_disc_id) loop
        v_gender_key := public.team_tournament_resolve_player_gender_key(
          v_player_id, p_header.tenant_id, p_header.club_id
        );
        if v_gender_key = 'male' then v_male_count := v_male_count + 1; end if;
        if v_gender_key = 'female' then v_female_count := v_female_count + 1; end if;
      end loop;

      if v_gender_req = 'male' and v_male_count <> v_count then
        return public.team_tournament_lineup_validation_fail(
          'invalid_gender', format('%s: Nội dung yêu cầu VĐV nam.', v_discipline.name),
          jsonb_build_object(), '[]'::jsonb, '[]'::jsonb, jsonb_build_array(v_disc_id), v_lineup.version
        );
      end if;
      if v_gender_req = 'female' and v_female_count <> v_count then
        return public.team_tournament_lineup_validation_fail(
          'invalid_gender', format('%s: Nội dung yêu cầu VĐV nữ.', v_discipline.name),
          jsonb_build_object(), '[]'::jsonb, '[]'::jsonb, jsonb_build_array(v_disc_id), v_lineup.version
        );
      end if;
      if v_gender_req = 'mixed_pair' and not (v_count = 2 and v_male_count = 1 and v_female_count = 1) then
        return public.team_tournament_lineup_validation_fail(
          'invalid_gender', format('%s: Nội dung mixed cần 1 nam + 1 nữ.', v_discipline.name),
          jsonb_build_object(), '[]'::jsonb, '[]'::jsonb, jsonb_build_array(v_disc_id), v_lineup.version
        );
      end if;
      if v_discipline.category_type = 'mixed' and v_gender_req = 'any'
        and not (v_count = 2 and v_male_count = 1 and v_female_count = 1)
      then
        return public.team_tournament_lineup_validation_fail(
          'invalid_gender', format('%s: Nội dung mixed cần 1 nam + 1 nữ.', v_discipline.name),
          jsonb_build_object(), '[]'::jsonb, '[]'::jsonb, jsonb_build_array(v_disc_id), v_lineup.version
        );
      end if;
    end if;

    if v_partial and v_count > 0 and v_count < v_expected then
      v_warnings := v_warnings || jsonb_build_array(
        format('%s: nháp chưa đủ %s VĐV.', v_discipline.name, v_expected)
      );
    end if;
  end loop;

  if p_is_submit and v_is_mlp then
    for v_player_id in
      select m.player_id from public.team_tournament_team_members m where m.team_id = v_team.id
    loop
      v_players := 0;
      for v_discipline in
        select * from public.team_tournament_disciplines d
        where d.team_tournament_id = p_header.id
          and d.player_count >= 2
        order by d.sort_order
      loop
        if p_selections ? v_discipline.external_discipline_id
          and exists (
            select 1
            from jsonb_array_elements_text(p_selections->v_discipline.external_discipline_id) elem
            where elem = v_player_id
          )
        then
          v_players := v_players + 1;
        end if;
      end loop;

      if v_players <> 2 then
        return public.team_tournament_lineup_validation_fail(
          'lineup_incomplete',
          format('VĐV %s phải tham gia đúng 2 trận trong tie (hiện tại: %s).', v_player_id, v_players),
          jsonb_build_object(),
          '[]'::jsonb,
          jsonb_build_array(v_player_id),
          '[]'::jsonb,
          v_lineup.version
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'message', '',
    'fieldErrors', '{}'::jsonb,
    'ruleViolations', '[]'::jsonb,
    'invalidPlayerIds', '[]'::jsonb,
    'invalidDisciplineIds', '[]'::jsonb,
    'serverTime', now(),
    'lineupVersion', v_lineup.version,
    'warnings', v_warnings
  );
end;
$$;

-- ─── save_lineup_draft_legacy with TT-2C validation ───
create or replace function public.team_tournament_save_lineup_draft_legacy(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_id uuid;
  v_player_id text;
  v_can_manage boolean;
  v_validation jsonb;
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

  v_player_id := public.team_tournament_user_player_id();
  v_can_manage := public.team_tournament_can_manage();

  if not v_can_manage
    and not (
      public.user_has_permission('team.lineup.submit')
      and public.team_tournament_is_captain(v_header.id, p_team_id, v_player_id)
    ) then
    return json_build_object('ok', false, 'code', 'captain_scope_denied', 'error', 'Không có quyền sửa đội hình đội này.');
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

  v_validation := public.team_tournament_validate_lineup_selections(
    v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), false
  );
  if not (v_validation->>'ok')::boolean then
    return v_validation;
  end if;

  select l.id into v_lineup_id
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  if v_lineup_id is null then
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'draft', coalesce(p_selections, '{}'::jsonb), 'captain', auth.uid(), auth.uid()
    ) returning id into v_lineup_id;
  else
    if exists (
      select 1 from public.team_tournament_lineups
      where id = v_lineup_id and locked_at is not null
    ) then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;

    update public.team_tournament_lineups set
      status = 'draft',
      selections = coalesce(p_selections, '{}'::jsonb),
      updated_at = now(),
      updated_by = auth.uid()
    where id = v_lineup_id;
  end if;

  perform public.team_tournament_sync_lineup_entries(
    v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.draft', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'selections', p_selections)
  );

  return json_build_object('ok', true, 'lineupId', v_lineup_id);
end;
$$;

grant execute on function public.team_tournament_normalize_gender_key(text) to authenticated;
grant execute on function public.team_tournament_resolve_player_gender_key(text, text, text) to authenticated;
grant execute on function public.team_tournament_resolve_player_status(text) to authenticated;
grant execute on function public.team_tournament_validate_lineup_selections(
  public.team_tournaments, text, text, jsonb, boolean
) to authenticated;
