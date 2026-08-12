-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-lineup-server-gender-canonical-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Root cause (Owner real-browser + Staging forensic):
--   team_tournament_resolve_player_gender_key used profiles.player_id
--   (+ club_data_v3 blob fallback). Team membership stores athletes.id.
--   Captain portal already uses athletes → profiles(user_id) for gender.
--
-- Also remediates same-family:
--   team_tournament_resolve_player_status (profiles.player_id)
--   validate effective MLP gender_requirement when stored value is any
--     (parity with client applyCanonicalMlpDisciplineMetadata)
--
-- Does NOT change save/submit writers (they already call shared validate).
-- Does NOT touch captain portal roster RPC.
-- Does NOT trust client-supplied gender on write.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_effective_lineup_gender_requirement(
  p_is_mlp boolean,
  p_gender_requirement text,
  p_name text,
  p_category_type text,
  p_external_discipline_id text default null
)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_req text := lower(trim(coalesce(p_gender_requirement, '')));
  v_name text := lower(trim(both from normalize(coalesce(p_name, ''), nfc)));
  v_id text := lower(trim(coalesce(p_external_discipline_id, '')));
  v_cat text := lower(trim(coalesce(p_category_type, '')));
begin
  if v_req in ('male', 'female', 'mixed_pair') then
    return v_req;
  end if;

  if not coalesce(p_is_mlp, false) then
    return coalesce(nullif(v_req, ''), 'any');
  end if;

  if v_id in ('mlp-wd') then return 'female'; end if;
  if v_id in ('mlp-md') then return 'male'; end if;
  if v_id in ('mlp-xd1', 'mlp-xd2') then return 'mixed_pair'; end if;

  -- Mixed before single-gender (Đôi nam nữ).
  if v_name ~ 'nam[[:space:]]*nữ|nam nữ|mixed|nam/nữ|nam-nữ' then
    return 'mixed_pair';
  end if;
  if v_name ~ 'nữ|female|women|ladies' then
    return 'female';
  end if;
  if v_name ~ 'nam|male|men' then
    return 'male';
  end if;
  if v_cat = 'mixed' then
    return 'mixed_pair';
  end if;

  return coalesce(nullif(v_req, ''), 'any');
end;
$function$;

create or replace function public.team_tournament_resolve_player_gender_key(
  p_player_id text,
  p_tenant_id text,
  p_club_id text default null
)
returns text
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_gender text;
  v_athlete_id text := nullif(trim(p_player_id), '');
begin
  -- p_club_id retained for signature compatibility; intentionally unused.
  -- Canonical identity: team membership player_id = athletes.id
  -- Gender authority: profiles via athletes.user_id (same as captain portal).
  -- No profiles.player_id. No club_data_v3 blob. Fail closed → unknown.
  if v_athlete_id is null then
    return 'unknown';
  end if;

  select public.team_tournament_normalize_gender_key(p.gender)
  into v_gender
  from public.athletes a
  left join public.profiles p
    on p.id = a.user_id
  where a.id::text = v_athlete_id
    and (p_tenant_id is null or a.tenant_id = p_tenant_id)
  limit 1;

  if v_gender is not null and v_gender not in ('unknown') then
    return v_gender;
  end if;

  return coalesce(v_gender, 'unknown');
end;
$function$;

create or replace function public.team_tournament_resolve_player_status(
  p_player_id text
)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(
    nullif(trim(a.status), ''),
    case when a.id is not null then 'active' else null end,
    'unknown'
  )
  from (select 1) x
  left join public.athletes a
    on a.id::text = nullif(trim(p_player_id), '')
  limit 1;
$function$;

create or replace function public.team_tournament_validate_lineup_selections(
  p_header team_tournaments,
  p_team_external_id text,
  p_matchup_id text,
  p_selections jsonb,
  p_is_submit boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_team public.team_tournament_teams;
  v_matchup public.team_tournament_matchups;
  v_lineup public.team_tournament_lineups;
  v_discipline record;
  v_player_id text;
  v_count int;
  v_expected int;
  v_gender_req text;
  v_category text;
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

  -- DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION
  -- NORMAL_DISCIPLINES_STILL_VALIDATED
  for v_discipline in
    select *
    from public.team_tournament_disciplines d
    where d.team_tournament_id = p_header.id
      and lower(coalesce(d.discipline_kind, '')) <> 'dreambreaker'
      and lower(coalesce(d.activation_rule, '')) <> 'tie_at_2_2'
    order by d.sort_order
  loop
    v_disc_id := v_discipline.external_discipline_id;
    v_expected := v_discipline.player_count;
    v_gender_req := public.team_tournament_effective_lineup_gender_requirement(
      v_is_mlp,
      v_discipline.gender_requirement,
      v_discipline.name,
      v_discipline.category_type,
      v_discipline.external_discipline_id
    );
    v_category := case
      when v_gender_req = 'mixed_pair' then 'mixed'
      else coalesce(v_discipline.category_type, 'doubles')
    end;

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
      if v_category = 'mixed' and v_gender_req = 'any'
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
          and lower(coalesce(d.discipline_kind, '')) <> 'dreambreaker'
          and lower(coalesce(d.activation_rule, '')) <> 'tie_at_2_2'
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
$function$;

revoke all on function public.team_tournament_effective_lineup_gender_requirement(boolean, text, text, text, text) from public, anon;
grant execute on function public.team_tournament_effective_lineup_gender_requirement(boolean, text, text, text, text) to authenticated;

revoke all on function public.team_tournament_resolve_player_gender_key(text, text, text) from public, anon;
grant execute on function public.team_tournament_resolve_player_gender_key(text, text, text) to authenticated;

revoke all on function public.team_tournament_resolve_player_status(text) from public, anon;
grant execute on function public.team_tournament_resolve_player_status(text) to authenticated;

revoke all on function public.team_tournament_validate_lineup_selections(public.team_tournaments, text, text, jsonb, boolean) from public, anon;
grant execute on function public.team_tournament_validate_lineup_selections(public.team_tournaments, text, text, jsonb, boolean) to authenticated;
