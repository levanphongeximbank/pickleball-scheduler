-- team-tournament-court-resource-integration-01 / 02_APPLY
-- LOCAL PACKAGE ONLY. Do not apply without Owner GO.
-- Additive canonical court-resource persistence for Team Tournament.

begin;

alter table public.team_tournament_matchups
  add column court_id text,
  add column cluster_id text,
  add column scheduled_end timestamptz;

alter table public.team_tournament_matchups
  add constraint team_tournament_matchups_scheduled_interval_chk
  check (
    scheduled_end is null
    or scheduled_at is null
    or scheduled_end > scheduled_at
  );

comment on column public.team_tournament_matchups.court_id is
  'Canonical court resource id. Never inferred from court_label.';
comment on column public.team_tournament_matchups.cluster_id is
  'Canonical court-cluster id for the scheduled court.';
comment on column public.team_tournament_matchups.scheduled_end is
  'Exclusive end of the canonical [scheduled_at, scheduled_end) occupancy interval.';

-- Preserve exact deployed supersets under package-private names while keeping
-- the public function OIDs stable for every existing dependent function.
do $preserve$
declare
  v_item record;
  v_definition text;
begin
  for v_item in
    select * from (values
      ('team_tournament_setup_norm_projection', 'team_tournament_cri01_prior_setup_norm_projection',
        'public.team_tournament_setup_norm_projection(uuid,text,integer)'),
      ('team_tournament_replace_matchups', 'team_tournament_cri01_prior_replace_matchups',
        'public.team_tournament_replace_matchups(text,jsonb,integer,text)'),
      ('team_tournament_update_matchup_schedule', 'team_tournament_cri01_prior_update_matchup_schedule',
        'public.team_tournament_update_matchup_schedule(text,jsonb,integer,text)'),
      ('team_tournament_apply_schedule_batch', 'team_tournament_cri01_prior_apply_schedule_batch',
        'public.team_tournament_apply_schedule_batch(text,jsonb,integer,text)'),
      ('team_tournament_update_setup_config', 'team_tournament_cri01_prior_update_setup_config',
        'public.team_tournament_update_setup_config(text,jsonb,integer,text)'),
      ('team_tournament_get_setup', 'team_tournament_cri01_prior_get_setup',
        'public.team_tournament_get_setup(text,text,integer,boolean)'),
      ('team_tournament_get_dashboard', 'team_tournament_cri01_prior_get_dashboard',
        'public.team_tournament_get_dashboard(text)')
    ) x(source_name, prior_name, signature)
  loop
    v_definition := pg_get_functiondef(to_regprocedure(v_item.signature));
    v_definition := replace(
      v_definition,
      'FUNCTION public.' || v_item.source_name,
      'FUNCTION public.' || v_item.prior_name
    );
    execute v_definition;
  end loop;
end
$preserve$;

create or replace function public.team_tournament_setup_norm_projection(
  p_team_tournament_id uuid,
  p_tournament_id text,
  p_version integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_settings jsonb := '{}'::jsonb;
begin
  v_result := public.team_tournament_cri01_prior_setup_norm_projection(
    p_team_tournament_id, p_tournament_id, p_version
  );

  select coalesce(settings, '{}'::jsonb)
    into v_settings
  from public.team_tournaments
  where id = p_team_tournament_id;

  v_result := jsonb_set(
    v_result,
    '{matchups}',
    coalesce((
      select jsonb_agg(
        elem || jsonb_build_object(
          'courtId', m.court_id,
          'clusterId', m.cluster_id,
          'scheduledEnd', m.scheduled_end
        )
        order by ord
      )
      from jsonb_array_elements(coalesce(v_result->'matchups', '[]'::jsonb))
        with ordinality x(elem, ord)
      left join public.team_tournament_matchups m
        on m.team_tournament_id = p_team_tournament_id
       and m.external_matchup_id = x.elem->>'id'
    ), '[]'::jsonb),
    true
  );

  v_result := jsonb_set(
    v_result,
    '{schedule}',
    coalesce((
      select jsonb_agg(
        elem || jsonb_build_object(
          'courtId', m.court_id,
          'clusterId', m.cluster_id,
          'scheduledEnd', m.scheduled_end
        )
        order by ord
      )
      from jsonb_array_elements(coalesce(v_result->'schedule', '[]'::jsonb))
        with ordinality x(elem, ord)
      left join public.team_tournament_matchups m
        on m.team_tournament_id = p_team_tournament_id
       and m.external_matchup_id = x.elem->>'matchupId'
    ), '[]'::jsonb),
    true
  );

  return v_result || jsonb_build_object(
    'clusterId', v_settings->'clusterId',
    'selectedCourtIds', v_settings->'selectedCourtIds',
    'courtCapacityWindow', v_settings->'courtCapacityWindow'
  );
end;
$$;

-- Validate only fields explicitly supplied by the caller. No missing value is
-- defaulted and no court id is synthesized from a display label.
create function public.team_tournament_cri01_validate_setup_payload(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_window jsonb;
  v_date_text text;
  v_start_text text;
  v_end_text text;
  v_date date;
  v_start time;
  v_end time;
begin
  if p_payload ? 'clusterId' then
    if jsonb_typeof(p_payload->'clusterId') not in ('string', 'null')
       or (
         jsonb_typeof(p_payload->'clusterId') = 'string'
         and nullif(btrim(p_payload->>'clusterId'), '') is null
       ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_CLUSTER_ID');
    end if;
  end if;

  if p_payload ? 'selectedCourtIds' then
    if jsonb_typeof(p_payload->'selectedCourtIds') <> 'array'
       or exists (
         select 1
         from jsonb_array_elements(p_payload->'selectedCourtIds') x(value)
         where jsonb_typeof(x.value) <> 'string'
            or nullif(btrim(x.value #>> '{}'), '') is null
       )
       or (
         select count(*)
         from jsonb_array_elements_text(p_payload->'selectedCourtIds')
       ) <> (
         select count(distinct btrim(value))
         from jsonb_array_elements_text(p_payload->'selectedCourtIds') x(value)
       ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_SELECTED_COURT_IDS');
    end if;
  end if;

  if p_payload ? 'courtCapacityWindow' then
    v_window := p_payload->'courtCapacityWindow';
    if jsonb_typeof(v_window) <> 'object'
       or not (v_window ?& array['date', 'startTime', 'endTime'])
       or exists (
         select 1
         from jsonb_object_keys(v_window) k(key)
         where k.key not in ('date', 'startTime', 'endTime')
       ) then
      return jsonb_build_object('ok', false, 'code', 'INVALID_COURT_CAPACITY_WINDOW');
    end if;

    v_date_text := v_window->>'date';
    v_start_text := v_window->>'startTime';
    v_end_text := v_window->>'endTime';
    begin
      if v_date_text !~ '^\d{4}-\d{2}-\d{2}$'
         or v_start_text !~ '^([01]\d|2[0-3]):[0-5]\d$'
         or v_end_text !~ '^([01]\d|2[0-3]):[0-5]\d$' then
        raise exception 'invalid format';
      end if;
      v_date := v_date_text::date;
      v_start := v_start_text::time;
      v_end := v_end_text::time;
      if to_char(v_date, 'YYYY-MM-DD') <> v_date_text or v_end <= v_start then
        raise exception 'invalid range';
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'INVALID_COURT_CAPACITY_WINDOW');
    end;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Preserve the complete deployed setup-config implementation by delegation.
-- New-only payloads use the same prepare/bump/finalize pipeline directly.
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
  v_validation jsonb;
  v_payload jsonb := coalesce(p_envelope->'payload', '{}'::jsonb);
  v_new_patch jsonb := '{}'::jsonb;
  v_has_new boolean;
  v_has_prior boolean;
  v_header public.team_tournaments;
  v_prepare json;
  v_envelope jsonb;
  v_new_version integer;
  v_result json;
begin
  v_validation := public.team_tournament_cri01_validate_setup_payload(v_payload);
  if not coalesce((v_validation->>'ok')::boolean, false) then
    return v_validation::json;
  end if;

  if v_payload ? 'clusterId' then
    v_new_patch := v_new_patch || jsonb_build_object('clusterId', v_payload->'clusterId');
  end if;
  if v_payload ? 'selectedCourtIds' then
    v_new_patch := v_new_patch || jsonb_build_object('selectedCourtIds', v_payload->'selectedCourtIds');
  end if;
  if v_payload ? 'courtCapacityWindow' then
    v_new_patch := v_new_patch || jsonb_build_object('courtCapacityWindow', v_payload->'courtCapacityWindow');
  end if;

  v_has_new := v_new_patch <> '{}'::jsonb;
  v_has_prior := v_payload ?| array[
    'formatPreset', 'dreambreakerEnabled', 'groupMode', 'groupCount',
    'qualifiersPerGroup', 'qualificationCount', 'knockoutFormat',
    'teamsPerGroup', 'rosterRules', 'stageTieBreakPolicy',
    'stageScoringPolicy'
  ];

  if not v_has_new then
    return public.team_tournament_cri01_prior_update_setup_config(
      p_tournament_id, p_envelope, p_expected_version, p_idempotency_key
    );
  end if;

  if v_has_prior then
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
      return json_build_object('ok', false, 'code', 'FORBIDDEN');
    end;
    if not public.team_tournament_can_manage() then
      return json_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;

    begin
      update public.team_tournaments
         set settings = coalesce(settings, '{}'::jsonb) || v_new_patch,
             updated_at = now(),
             updated_by = auth.uid()
       where id = v_header.id;

      v_result := public.team_tournament_cri01_prior_update_setup_config(
        p_tournament_id, p_envelope, p_expected_version, p_idempotency_key
      );
      if not coalesce((v_result->>'ok')::boolean, false)
         or coalesce((v_result->>'replay')::boolean, false)
         or coalesce((v_result->>'replayed')::boolean, false) then
        raise exception using errcode = 'TT001', message = 'rollback prewrite';
      end if;
      return v_result;
    exception
      when sqlstate 'TT001' then
        return v_result;
    end;
  end if;

  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'tournament.update_setup_config',
    p_expected_version, p_idempotency_key
  );
  if not coalesce((v_prepare->>'ok')::boolean, false) then
    return v_prepare;
  end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select *
    into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';

  update public.team_tournaments
     set settings = coalesce(settings, '{}'::jsonb) || v_new_patch,
         updated_at = now(),
         updated_by = auth.uid()
   where id = v_header.id;

  v_new_version := public.team_tournament_setup_mutation_bump_version(
    v_header.id, v_header.version
  );

  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid
  );
end;
$$;

-- Current Scenario-B superset plus dedicated canonical resource fields.
create or replace function public.team_tournament_replace_matchups(
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
  v_payload jsonb;
  v_envelope jsonb;
  v_item jsonb;
  v_sub jsonb;
  v_id text;
  v_team_a text;
  v_team_b text;
  v_new_version integer;
  v_match public.team_tournament_matchups;
  v_payload_ids text[];
  v_start timestamptz;
  v_end timestamptz;
  v_court_id text;
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, 'matchups.replace',
    p_expected_version, p_idempotency_key
  );
  if not coalesce((v_prepare->>'ok')::boolean, false) then return v_prepare; end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := v_envelope->'payload';

  if nullif(btrim(v_envelope->>'rulesVersion'), '') is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rulesVersion is required.');
  end if;
  if jsonb_typeof(coalesce(v_payload->'matchups', '[]'::jsonb)) <> 'array' then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'matchups must be an array.');
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) x
    group by coalesce(nullif(x.value->>'id', ''), '')
    having coalesce(nullif(x.value->>'id', ''), '') <> '' and count(*) > 1
  ) then
    return json_build_object('ok', false, 'code', 'DUPLICATE_MATCHUP_ID');
  end if;

  if exists (
    select 1 from public.team_tournament_matchups m
    where m.team_tournament_id = v_header.id
      and (
        public.team_tournament_matchup_is_started(m)
        or public.team_tournament_matchup_has_confirmed_result(m.id)
      )
  ) and not coalesce((v_envelope->>'confirmDestructive')::boolean, false) then
    return json_build_object('ok', false, 'code', 'CONFIRM_DESTRUCTIVE_REQUIRED');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) x
    where (
      nullif(btrim(coalesce(x.value->>'teamAId', '')), '') is not null
      and not exists (
        select 1 from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamAId', '')), '')
      )
    ) or (
      nullif(btrim(coalesce(x.value->>'teamBId', '')), '') is not null
      and not exists (
        select 1 from public.team_tournament_teams t
        where t.team_tournament_id = v_header.id
          and t.external_team_id = nullif(btrim(coalesce(x.value->>'teamBId', '')), '')
      )
    )
  ) then
    return json_build_object('ok', false, 'code', 'UNKNOWN_TEAM', 'error', 'Đội trong lịch không tồn tại trên server.');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) x
    cross join lateral jsonb_array_elements(coalesce(x.value->'subMatches', '[]'::jsonb)) s
    where not exists (
      select 1 from public.team_tournament_disciplines d
      where d.team_tournament_id = v_header.id
        and d.external_discipline_id = coalesce(s.value->>'disciplineId', s.value->>'disciplineExternalId')
    )
  ) then
    return json_build_object('ok', false, 'code', 'UNKNOWN_DISCIPLINE', 'error', 'Nội dung (discipline) không khớp dữ liệu giải.');
  end if;

  -- Canonical tuples are complete and use half-open intervals.
  for v_item in
    select value from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb))
  loop
    v_court_id := nullif(btrim(coalesce(v_item->>'courtId', '')), '');
    begin
      v_start := nullif(v_item->>'scheduledAt', '')::timestamptz;
      v_end := nullif(v_item->>'scheduledEnd', '')::timestamptz;
    exception when others then
      return json_build_object('ok', false, 'code', 'INVALID_SCHEDULE_INTERVAL');
    end;
    if v_end is not null and (v_start is null or v_end <= v_start) then
      return json_build_object('ok', false, 'code', 'INVALID_SCHEDULE_INTERVAL');
    end if;
    if v_court_id is not null and (v_start is null or v_end is null) then
      return json_build_object('ok', false, 'code', 'INVALID_SCHEDULE_INTERVAL');
    end if;
  end loop;

  -- Serialize writers per canonical court before checking shared occupancy.
  perform pg_advisory_xact_lock(hashtextextended(court_id, 0))
  from (
    select distinct nullif(btrim(value->>'courtId'), '') as court_id
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb))
  ) c
  where court_id is not null
  order by court_id;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) with ordinality a(value, ord)
    join jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb)) with ordinality b(value, ord)
      on a.ord < b.ord
    where nullif(btrim(a.value->>'courtId'), '') = nullif(btrim(b.value->>'courtId'), '')
      and nullif(btrim(a.value->>'courtId'), '') is not null
      and (a.value->>'scheduledAt')::timestamptz < (b.value->>'scheduledEnd')::timestamptz
      and (b.value->>'scheduledAt')::timestamptz < (a.value->>'scheduledEnd')::timestamptz
  ) then
    return json_build_object('ok', false, 'code', 'COURT_CONFLICT');
  end if;

  v_payload_ids := '{}'::text[];
  for v_item in
    select value from jsonb_array_elements(coalesce(v_payload->'matchups', '[]'::jsonb))
  loop
    v_id := coalesce(nullif(v_item->>'id', ''), gen_random_uuid()::text);
    v_payload_ids := array_append(v_payload_ids, v_id);
    v_team_a := coalesce(nullif(btrim(coalesce(v_item->>'teamAId', '')), ''), '');
    v_team_b := coalesce(nullif(btrim(coalesce(v_item->>'teamBId', '')), ''), '');

    update public.team_tournament_matchups
       set team_a_id = v_team_a,
           team_b_id = v_team_b,
           scheduled_at = nullif(v_item->>'scheduledAt', '')::timestamptz,
           scheduled_end = nullif(v_item->>'scheduledEnd', '')::timestamptz,
           lineup_lock_at = nullif(v_item->>'lineupLockAt', '')::timestamptz,
           court_id = nullif(btrim(v_item->>'courtId'), ''),
           cluster_id = nullif(btrim(v_item->>'clusterId'), ''),
           court_label = nullif(v_item->>'courtLabel', ''),
           status = coalesce(v_item->>'status', status, 'lineup_open'),
           schedule_meta = coalesce(v_item->'scheduleMeta', '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
                  'groupId', v_item->>'groupId',
                  'roundNumber', v_item->'roundNumber',
                  'matchNumberInRound', v_item->'matchNumberInRound',
                  'stage', v_item->>'stage',
                  'nextMatchupId', v_item->>'nextMatchupId',
                  'nextSlot', v_item->>'nextSlot',
                  'competitionStage', v_item->>'competitionStage',
                  'bracketRoundLabel', v_item->>'bracketRoundLabel'
                )),
           updated_at = now(),
           updated_by = auth.uid()
     where team_tournament_id = v_header.id
       and external_matchup_id = v_id
    returning * into v_match;

    if not found then
      insert into public.team_tournament_matchups(
        tenant_id, tournament_id, team_tournament_id, external_matchup_id,
        team_a_id, team_b_id, scheduled_at, scheduled_end, lineup_lock_at,
        court_id, cluster_id, court_label, status, schedule_meta, created_by, updated_by
      ) values (
        v_header.tenant_id, p_tournament_id, v_header.id, v_id,
        v_team_a, v_team_b,
        nullif(v_item->>'scheduledAt', '')::timestamptz,
        nullif(v_item->>'scheduledEnd', '')::timestamptz,
        nullif(v_item->>'lineupLockAt', '')::timestamptz,
        nullif(btrim(v_item->>'courtId'), ''),
        nullif(btrim(v_item->>'clusterId'), ''),
        nullif(v_item->>'courtLabel', ''),
        coalesce(v_item->>'status', 'lineup_open'),
        coalesce(v_item->'scheduleMeta', '{}'::jsonb)
          || jsonb_strip_nulls(jsonb_build_object(
               'groupId', v_item->>'groupId',
               'roundNumber', v_item->'roundNumber',
               'matchNumberInRound', v_item->'matchNumberInRound',
               'stage', v_item->>'stage',
               'nextMatchupId', v_item->>'nextMatchupId',
               'nextSlot', v_item->>'nextSlot',
               'competitionStage', v_item->>'competitionStage',
               'bracketRoundLabel', v_item->>'bracketRoundLabel'
             )),
        auth.uid(), auth.uid()
      ) returning * into v_match;
    end if;

    delete from public.team_tournament_sub_matches where matchup_id = v_match.id;
    for v_sub in
      select value from jsonb_array_elements(coalesce(v_item->'subMatches', '[]'::jsonb))
    loop
      insert into public.team_tournament_sub_matches(
        tenant_id, tournament_id, matchup_id, external_sub_match_id,
        discipline_external_id, sort_order
      ) values (
        v_header.tenant_id, p_tournament_id, v_match.id,
        coalesce(v_sub->>'id', gen_random_uuid()::text),
        coalesce(v_sub->>'disciplineId', v_sub->>'disciplineExternalId'),
        coalesce((v_sub->>'sortOrder')::int, 1)
      );
    end loop;
  end loop;

  delete from public.team_tournament_matchups m
   where m.team_tournament_id = v_header.id
     and not (m.external_matchup_id = any (v_payload_ids));

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);
  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid
  );
end;
$$;

create function public.team_tournament_cri01_apply_schedule(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_command text,
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
  v_schedule jsonb;
  v_item jsonb;
  v_new_version integer;
begin
  if p_expected_command not in ('schedule.update', 'schedule.batch') then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR');
  end if;

  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, p_expected_command,
    p_expected_version, p_idempotency_key
  );
  if not coalesce((v_prepare->>'ok')::boolean, false) then return v_prepare; end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;

  select * into v_header
  from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := v_envelope->'payload';
  if p_expected_command = 'schedule.batch'
     and nullif(btrim(v_envelope->>'rulesVersion'), '') is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rulesVersion is required.');
  end if;

  v_schedule := case
    when p_expected_command = 'schedule.update' then
      case jsonb_typeof(coalesce(v_payload->'scheduleEntry', v_payload->'updates'))
        when 'array' then coalesce(v_payload->'scheduleEntry', v_payload->'updates')
        else jsonb_build_array(coalesce(v_payload->'scheduleEntry', v_payload->'updates'))
      end
    else coalesce(v_payload->'schedule', '[]'::jsonb)
  end;
  if jsonb_typeof(v_schedule) <> 'array' then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_schedule) x
    where nullif(btrim(coalesce(x.value->>'matchupId', '')), '') is null
       or not exists (
         select 1 from public.team_tournament_matchups m
         where m.team_tournament_id = v_header.id
           and m.external_matchup_id = x.value->>'matchupId'
       )
  ) then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  -- Validate effective canonical tuples, including partial patch entries.
  if exists (
    select 1
    from jsonb_array_elements(v_schedule) x
    join public.team_tournament_matchups m
      on m.team_tournament_id = v_header.id
     and m.external_matchup_id = x.value->>'matchupId'
    cross join lateral (
      select
        case when x.value ? 'courtId'
          then nullif(btrim(x.value->>'courtId'), '') else m.court_id end as court_id,
        case when x.value ? 'scheduledAt'
          then nullif(x.value->>'scheduledAt', '')::timestamptz else m.scheduled_at end as starts_at,
        case when x.value ? 'scheduledEnd'
          then nullif(x.value->>'scheduledEnd', '')::timestamptz else m.scheduled_end end as ends_at
    ) e
    where (e.ends_at is not null and (e.starts_at is null or e.ends_at <= e.starts_at))
       or (e.court_id is not null and (e.starts_at is null or e.ends_at is null))
  ) then
    return json_build_object('ok', false, 'code', 'INVALID_SCHEDULE_INTERVAL');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(court_id, 0))
  from (
    select distinct
      case when x.value ? 'courtId'
        then nullif(btrim(x.value->>'courtId'), '') else m.court_id end as court_id
    from jsonb_array_elements(v_schedule) x
    join public.team_tournament_matchups m
      on m.team_tournament_id = v_header.id
     and m.external_matchup_id = x.value->>'matchupId'
  ) c
  where court_id is not null
  order by court_id;

  -- Proposed entries conflict by canonical court and overlapping half-open range.
  if exists (
    with proposed as (
      select
        m.id,
        case when x.value ? 'courtId'
          then nullif(btrim(x.value->>'courtId'), '') else m.court_id end as court_id,
        case when x.value ? 'scheduledAt'
          then nullif(x.value->>'scheduledAt', '')::timestamptz else m.scheduled_at end as starts_at,
        case when x.value ? 'scheduledEnd'
          then nullif(x.value->>'scheduledEnd', '')::timestamptz else m.scheduled_end end as ends_at
      from jsonb_array_elements(v_schedule) x
      join public.team_tournament_matchups m
        on m.team_tournament_id = v_header.id
       and m.external_matchup_id = x.value->>'matchupId'
    )
    select 1
    from proposed a
    join proposed b on a.id < b.id and a.court_id = b.court_id
    where a.court_id is not null
      and a.starts_at < b.ends_at
      and b.starts_at < a.ends_at
  ) then
    return json_build_object('ok', false, 'code', 'COURT_CONFLICT');
  end if;

  if exists (
    with proposed as (
      select
        m.id,
        case when x.value ? 'courtId'
          then nullif(btrim(x.value->>'courtId'), '') else m.court_id end as court_id,
        case when x.value ? 'scheduledAt'
          then nullif(x.value->>'scheduledAt', '')::timestamptz else m.scheduled_at end as starts_at,
        case when x.value ? 'scheduledEnd'
          then nullif(x.value->>'scheduledEnd', '')::timestamptz else m.scheduled_end end as ends_at
      from jsonb_array_elements(v_schedule) x
      join public.team_tournament_matchups m
        on m.team_tournament_id = v_header.id
       and m.external_matchup_id = x.value->>'matchupId'
    )
    select 1
    from proposed p
    join public.team_tournament_matchups m
      on m.team_tournament_id = v_header.id
     and m.id <> p.id
     and m.court_id = p.court_id
     and m.scheduled_at < p.ends_at
     and p.starts_at < m.scheduled_end
    where p.court_id is not null
      and not exists (
        select 1 from proposed q where q.id = m.id
      )
  ) then
    return json_build_object('ok', false, 'code', 'COURT_CONFLICT');
  end if;

  for v_item in select value from jsonb_array_elements(v_schedule)
  loop
    update public.team_tournament_matchups
       set scheduled_at = case when v_item ? 'scheduledAt'
             then nullif(v_item->>'scheduledAt', '')::timestamptz else scheduled_at end,
           scheduled_end = case when v_item ? 'scheduledEnd'
             then nullif(v_item->>'scheduledEnd', '')::timestamptz else scheduled_end end,
           court_id = case when v_item ? 'courtId'
             then nullif(btrim(v_item->>'courtId'), '') else court_id end,
           cluster_id = case when v_item ? 'clusterId'
             then nullif(btrim(v_item->>'clusterId'), '') else cluster_id end,
           court_label = case when v_item ? 'courtLabel'
             then nullif(v_item->>'courtLabel', '') else court_label end,
           lineup_lock_at = case when v_item ? 'lineupLockAt'
             then nullif(v_item->>'lineupLockAt', '')::timestamptz else lineup_lock_at end,
           schedule_meta = coalesce(schedule_meta, '{}'::jsonb)
             || coalesce(v_item->'scheduleMeta', '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
                  'roundNumber', v_item->'roundNumber',
                  'matchNumberInRound', v_item->'matchNumberInRound',
                  'stage', v_item->>'stage',
                  'groupId', v_item->>'groupId',
                  'nextMatchupId', v_item->>'nextMatchupId',
                  'nextSlot', v_item->>'nextSlot',
                  'competitionStage', v_item->>'competitionStage',
                  'bracketRoundLabel', v_item->>'bracketRoundLabel'
                )),
           updated_at = now(),
           updated_by = auth.uid()
     where team_tournament_id = v_header.id
       and external_matchup_id = v_item->>'matchupId';
  end loop;

  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);
  return public.team_tournament_setup_mutation_finalize(
    v_header.tenant_id, p_tournament_id, v_header.id, v_new_version,
    v_envelope, v_prepare->>'payload_hash', v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id, p_tournament_id, v_new_version),
    (v_prepare->>'actor_id')::uuid
  );
end;
$$;

create or replace function public.team_tournament_update_matchup_schedule(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language sql
security definer
set search_path = public
as $$
  select public.team_tournament_cri01_apply_schedule(
    $1, $2, 'schedule.update', $3, $4
  );
$$;

create or replace function public.team_tournament_apply_schedule_batch(
  p_tournament_id text,
  p_envelope jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
) returns json
language sql
security definer
set search_path = public
as $$
  select public.team_tournament_cri01_apply_schedule(
    $1, $2, 'schedule.batch', $3, $4
  );
$$;

create or replace function public.team_tournament_get_setup(
  p_tournament_id text,
  p_viewer_team_id text default null,
  p_schema_version integer default null,
  p_diagnostic boolean default false
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_header public.team_tournaments;
  v_matchups jsonb;
  v_schedule jsonb;
begin
  v_result := public.team_tournament_cri01_prior_get_setup(
    p_tournament_id, p_viewer_team_id, p_schema_version, p_diagnostic
  )::jsonb;
  if not coalesce((v_result->>'ok')::boolean, false) then return v_result::json; end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  v_matchups := coalesce(v_result #> '{tournament,teamData,matchups}', '[]'::jsonb);
  select coalesce(jsonb_agg(
    elem || jsonb_build_object(
      'courtId', m.court_id,
      'clusterId', m.cluster_id,
      'scheduledEnd', m.scheduled_end
    ) order by ord
  ), '[]'::jsonb)
  into v_matchups
  from jsonb_array_elements(v_matchups) with ordinality x(elem, ord)
  left join public.team_tournament_matchups m
    on m.team_tournament_id = v_header.id
   and m.external_matchup_id = x.elem->>'id';

  v_result := jsonb_set(
    v_result, '{tournament,teamData,matchups}', v_matchups, true
  );
  if v_result #> '{tournament,matchups}' is not null then
    v_result := jsonb_set(v_result, '{tournament,matchups}', v_matchups, true);
  end if;

  v_schedule := coalesce(v_result #> '{tournament,schedule}', '[]'::jsonb);
  select coalesce(jsonb_agg(
    elem || jsonb_build_object(
      'courtId', m.court_id,
      'clusterId', m.cluster_id,
      'scheduledEnd', m.scheduled_end
    ) order by ord
  ), '[]'::jsonb)
  into v_schedule
  from jsonb_array_elements(v_schedule) with ordinality x(elem, ord)
  left join public.team_tournament_matchups m
    on m.team_tournament_id = v_header.id
   and m.external_matchup_id = x.elem->>'matchupId';

  v_result := jsonb_set(v_result, '{tournament,schedule}', v_schedule, true);
  return v_result::json;
end;
$$;

create or replace function public.team_tournament_get_dashboard(p_tournament_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_header public.team_tournaments;
  v_matchups jsonb;
begin
  v_result := public.team_tournament_cri01_prior_get_dashboard(p_tournament_id);
  if not coalesce((v_result->>'ok')::boolean, false) then return v_result; end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  v_matchups := coalesce(v_result #> '{view,matchups}', '[]'::jsonb);
  select coalesce(jsonb_agg(
    elem || jsonb_build_object(
      'courtId', m.court_id,
      'clusterId', m.cluster_id,
      'scheduledEnd', m.scheduled_end
    ) order by ord
  ), '[]'::jsonb)
  into v_matchups
  from jsonb_array_elements(v_matchups) with ordinality x(elem, ord)
  left join public.team_tournament_matchups m
    on m.team_tournament_id = v_header.id
   and m.external_matchup_id = x.elem->>'id';

  v_result := jsonb_set(v_result, '{view,matchups}', v_matchups, true);
  return jsonb_set(
    v_result,
    '{view,courtResourceConfig}',
    jsonb_build_object(
      'clusterId', v_header.settings->'clusterId',
      'selectedCourtIds', v_header.settings->'selectedCourtIds',
      'courtCapacityWindow', v_header.settings->'courtCapacityWindow'
    ),
    true
  );
end;
$$;

-- Public wrappers retain authenticated access; package internals and preserved
-- bodies are never executable by API roles.
revoke all on function public.team_tournament_setup_norm_projection(uuid, text, integer) from public, anon;
revoke all on function public.team_tournament_replace_matchups(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_update_matchup_schedule(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_apply_schedule_batch(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_update_setup_config(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_get_setup(text, text, integer, boolean) from public, anon;
revoke all on function public.team_tournament_get_dashboard(text) from public, anon;

grant execute on function public.team_tournament_replace_matchups(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_update_matchup_schedule(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_apply_schedule_batch(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_update_setup_config(text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_get_setup(text, text, integer, boolean) to authenticated;
grant execute on function public.team_tournament_get_dashboard(text) to authenticated;

revoke all on function public.team_tournament_cri01_validate_setup_payload(jsonb) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_apply_schedule(text, jsonb, text, integer, text) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_setup_norm_projection(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_replace_matchups(text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_update_matchup_schedule(text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_apply_schedule_batch(text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_update_setup_config(text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_get_setup(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.team_tournament_cri01_prior_get_dashboard(text) from public, anon, authenticated;

commit;
