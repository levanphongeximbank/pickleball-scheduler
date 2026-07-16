-- Phase P1.3 — Team Tournament V6 domain persistence RPCs
-- Staging-only apply after PHASE_P1_3_DOMAIN_PERSISTENCE_SCHEMA.sql and P1.2.
-- Client engines own generation. These RPCs persist the submitted payload only.

drop function if exists public.team_tournament_setup_mutation_finalize(text, text, uuid, integer, jsonb, text, jsonb, uuid);
drop function if exists public.team_tournament_setup_mutation_finalize(text, text, uuid, integer, jsonb, text, text, jsonb, uuid);

create or replace function public.team_tournament_setup_norm_projection(
  p_team_tournament_id uuid,
  p_tournament_id text,
  p_version integer
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'schemaVersion', 7,
    'tournamentId', p_tournament_id,
    'tournamentVersion', p_version,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.external_team_id, 'name', t.name)
                       order by t.external_team_id)
      from public.team_tournament_teams t where t.team_tournament_id = p_team_tournament_id
    ), '[]'::jsonb),
    'disciplines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.external_discipline_id, 'name', d.name, 'categoryType', d.category_type,
        'genderRequirement', d.gender_requirement, 'playerCount', d.player_count,
        'sortOrder', d.sort_order, 'scoringFormat', d.scoring_format,
        'countsTowardResult', d.counts_toward_result, 'disciplineKind', d.discipline_kind,
        'activationRule', d.activation_rule, 'enabled', d.enabled
      ) order by d.sort_order, d.external_discipline_id)
      from public.team_tournament_disciplines d where d.team_tournament_id = p_team_tournament_id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.external_group_id, 'name', g.name, 'sortOrder', g.sort_order, 'teamIds', g.team_ids
      ) order by g.sort_order, g.external_group_id)
      from public.team_tournament_groups g where g.team_tournament_id = p_team_tournament_id
    ), '[]'::jsonb),
    'matchups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.external_matchup_id, 'teamAId', m.team_a_id, 'teamBId', m.team_b_id,
        'scheduledAt', m.scheduled_at, 'lineupLockAt', m.lineup_lock_at,
        'courtLabel', m.court_label, 'status', m.status, 'scheduleMeta', m.schedule_meta,
        'groupId', nullif(m.schedule_meta->>'groupId',''),
        'roundNumber', m.schedule_meta->'roundNumber',
        'matchNumberInRound', m.schedule_meta->'matchNumberInRound',
        'stage', nullif(m.schedule_meta->>'stage',''),
        'nextMatchupId', nullif(m.schedule_meta->>'nextMatchupId',''),
        'subMatches', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sm.external_sub_match_id, 'disciplineId', sm.discipline_external_id,
            'sortOrder', sm.sort_order, 'status', sm.status
          ) order by sm.sort_order, sm.external_sub_match_id)
          from public.team_tournament_sub_matches sm where sm.matchup_id = m.id
        ), '[]'::jsonb)
      ) order by m.scheduled_at nulls last, m.external_matchup_id)
      from public.team_tournament_matchups m where m.team_tournament_id = p_team_tournament_id
    ), '[]'::jsonb),
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchupId', m.external_matchup_id, 'scheduledAt', m.scheduled_at,
        'courtLabel', m.court_label, 'groupId', m.schedule_meta->>'groupId',
        'roundNumber', m.schedule_meta->'roundNumber',
        'matchNumberInRound', m.schedule_meta->'matchNumberInRound',
        'stage', m.schedule_meta->>'stage'
      ) order by m.scheduled_at nulls last, m.external_matchup_id)
      from public.team_tournament_matchups m where m.team_tournament_id = p_team_tournament_id
    ), '[]'::jsonb),
    'schedulePublish', coalesce((select settings->'schedulePublish' from public.team_tournaments
                                  where id = p_team_tournament_id), '{}'::jsonb),
    'dreambreaker', coalesce((select settings->'dreambreaker' from public.team_tournaments
                              where id = p_team_tournament_id), '{}'::jsonb),
    'awards', coalesce((select settings->'awards' from public.team_tournaments
                        where id = p_team_tournament_id), '{}'::jsonb),
    'closing', coalesce((select settings->'closing' from public.team_tournaments
                         where id = p_team_tournament_id), '{"closed":false}'::jsonb)
  );
$$;

create or replace function public.team_tournament_setup_mutation_prepare(
  p_tournament_id text, p_envelope jsonb, p_expected_command text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_command text := nullif(btrim(coalesce(p_envelope->>'commandName','')), '');
  v_key text := coalesce(nullif(btrim(p_idempotency_key),''), nullif(btrim(p_envelope->>'idempotencyKey'), ''));
  v_expected integer := coalesce(p_expected_version, nullif(p_envelope->>'expectedTournamentVersion','')::integer);
  v_payload jsonb := p_envelope->'payload';
  v_begin json;
  v_payload_hash text;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED'); end if;
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then return json_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  begin perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end;
  if not public.team_tournament_can_manage() then return json_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if v_command is distinct from p_expected_command
     or p_envelope->>'tournamentId' is distinct from p_tournament_id
     or v_payload is null or jsonb_typeof(v_payload) <> 'object'
     or v_payload->'snapshot' is null
     or nullif(v_payload->'snapshot'->>'snapshotCanonicalText','') is null
     or nullif(v_payload->'snapshot'->>'snapshotHash','') is null
     or v_payload->'snapshot'->'snapshotJson' is null
     or v_key is null
     or nullif(btrim(p_envelope->>'engineVersion'),'') is null
     or nullif(btrim(p_envelope->>'engineInputHash'),'') is null
     or nullif(btrim(p_envelope->>'engineOutputHash'),'') is null
  then return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'Invalid setup mutation envelope.'); end if;
  if coalesce((v_header.settings->'closing'->>'closed')::boolean, (v_header.settings->>'closed')::boolean, false)
     or v_header.status = 'cancelled'
  then return json_build_object('ok', false, 'code', 'TOURNAMENT_CLOSED'); end if;
  if v_expected is null then return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'expectedTournamentVersion is required.'); end if;
  -- Client payloadHash is S1-A canonical hash of the full envelope (excluding payloadHash).
  -- Command-log uses a separate Postgres jsonb hash via begin_command.
  v_payload_hash := lower(coalesce(p_envelope->>'payloadHash', ''));
  if not public.team_tournament_is_sha256_hex(v_payload_hash) then
    return json_build_object('ok', false, 'code', 'PAYLOAD_HASH_MISMATCH', 'error', 'payloadHash không hợp lệ.');
  end if;
  -- Idempotency replay must short-circuit BEFORE optimistic version check.
  v_begin := public.team_tournament_begin_command(v_header.tenant_id, p_tournament_id, v_command, v_key, p_envelope);
  if not coalesce((v_begin->>'ok')::boolean, false) then return v_begin; end if;
  if coalesce((v_begin->>'replay')::boolean, false) then
    return json_build_object('ok', true, 'replay', true, 'replayed', true, 'result', v_begin->'result');
  end if;
  if v_expected <> v_header.version then return public.team_tournament_version_conflict('team_tournament', v_expected, v_header.version); end if;
  return json_build_object('ok', true, 'replay', false, 'header', to_jsonb(v_header),
    'envelope', jsonb_set(p_envelope, '{idempotencyKey}', to_jsonb(v_key), true),
    'payload_hash', v_payload_hash,
    'command_payload_hash', coalesce(v_begin->>'payload_hash', v_payload_hash),
    'idempotency_key', v_key, 'actor_id', auth.uid());
end;
$$;

create or replace function public.team_tournament_setup_mutation_bump_version(
  p_team_tournament_id uuid, p_expected_version integer
) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_version integer;
begin
  update public.team_tournaments set version = version + 1, updated_at = now(), updated_by = auth.uid()
  where id = p_team_tournament_id and version = p_expected_version returning version into v_version;
  if v_version is null then raise exception 'VERSION_CONFLICT'; end if;
  return v_version;
end;
$$;

create or replace function public.team_tournament_setup_mutation_finalize(
  p_tenant_id text, p_tournament_id text, p_team_tournament_id uuid, p_new_version integer,
  p_envelope jsonb, p_snapshot_payload_hash text, p_command_payload_hash text,
  p_norm_projection jsonb, p_actor_id uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare v_snapshot json; v_result jsonb; v_hash text; v_command text := p_envelope->>'commandName';
begin
  v_hash := public.team_tournament_normalized_read_hash(p_norm_projection);
  v_snapshot := public.team_tournament_create_setup_snapshot(
    p_tenant_id, p_tournament_id, p_team_tournament_id, p_new_version, 7, v_command,
    p_envelope->>'idempotencyKey', p_snapshot_payload_hash, p_envelope->>'engineInputHash',
    p_envelope->>'engineOutputHash', p_envelope->'payload'->'snapshot'->>'snapshotHash',
    p_envelope->'payload'->'snapshot'->>'snapshotCanonicalText', p_envelope->>'engineVersion',
    nullif(btrim(p_envelope->>'rulesVersion'), ''), p_envelope->'payload'->'snapshot'->'snapshotJson',
    v_hash, p_actor_id
  );
  if not coalesce((v_snapshot->>'ok')::boolean, false) then
    raise exception 'SETUP_SNAPSHOT_FAILED: %', v_snapshot;
  end if;
  v_result := jsonb_build_object('ok', true, 'version', p_new_version, 'replayed', false,
    'snapshot', jsonb_build_object(
      'snapshotId', v_snapshot->'snapshotId', 'snapshotVersion', v_snapshot->'snapshotVersion',
      'snapshotHash', v_snapshot->'snapshotHash', 'normalizedReadHash', v_snapshot->'normalizedReadHash',
      'engineVersion', v_snapshot->'engineVersion', 'rulesVersion', v_snapshot->'rulesVersion',
      'engineInputHash', v_snapshot->'engineInputHash', 'engineOutputHash', v_snapshot->'engineOutputHash',
      'createdAt', v_snapshot->'createdAt', 'commandName', v_command
    ), 'commandName', v_command);
  perform public.team_tournament_finish_command(p_tenant_id, p_tournament_id, v_command,
    p_envelope->>'idempotencyKey', p_command_payload_hash, v_result);
  perform public.team_tournament_write_audit(p_tenant_id, p_tournament_id, v_command,
    p_team_tournament_id::text, jsonb_build_object('version', p_new_version, 'payloadHash', p_snapshot_payload_hash));
  return v_result;
end;
$$;

create or replace function public.team_tournament_apply_domain_setup_mutation(
  p_tournament_id text, p_envelope jsonb, p_expected_command text,
  p_expected_version integer default null, p_idempotency_key text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_prepare json; v_header public.team_tournaments; v_payload jsonb; v_envelope jsonb; v_item jsonb; v_sub jsonb;
  v_id text; v_new_version integer; v_team_count integer; v_input_count integer;
  v_schedule jsonb; v_locked boolean; v_match public.team_tournament_matchups;
begin
  v_prepare := public.team_tournament_setup_mutation_prepare(
    p_tournament_id, p_envelope, p_expected_command, p_expected_version, p_idempotency_key);
  if not coalesce((v_prepare->>'ok')::boolean, false) then return v_prepare; end if;
  if coalesce((v_prepare->>'replay')::boolean, false) then
    return (
      coalesce((v_prepare->'result')::jsonb, jsonb_build_object('ok', true))
      || jsonb_build_object('replayed', true, 'replay', true)
    )::json;
  end if;
  select * into v_header from jsonb_populate_record(null::public.team_tournaments, (v_prepare->'header')::jsonb);
  v_envelope := v_prepare->'envelope';
  v_payload := v_envelope->'payload';
  if p_expected_command in ('groups.replace','groups.clear','matchups.replace','schedule.batch','schedule.publish')
     and nullif(btrim(v_envelope->>'rulesVersion'),'') is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rulesVersion is required.');
  end if;

  if p_expected_command = 'discipline.save' then
    v_item := coalesce(v_payload->'discipline', v_payload->'disciplines'->0);
    v_id := coalesce(nullif(v_item->>'external_discipline_id',''), nullif(v_item->>'id',''));
    if v_id is null or nullif(btrim(v_item->>'name'),'') is null then return json_build_object('ok',false,'code','VALIDATION_ERROR'); end if;
    insert into public.team_tournament_disciplines (
      tenant_id,tournament_id,team_tournament_id,external_discipline_id,name,category_type,gender_requirement,
      player_count,sort_order,scoring_format,counts_toward_result,discipline_kind,activation_rule,enabled,updated_at
    ) values (
      v_header.tenant_id,p_tournament_id,v_header.id,v_id,v_item->>'name',
      coalesce(v_item->>'categoryType','doubles'),coalesce(v_item->>'genderRequirement','any'),
      coalesce((v_item->>'playerCount')::int,2),coalesce((v_item->>'sortOrder')::int,1),
      coalesce(v_item->'scoringFormat','{}'::jsonb),coalesce((v_item->>'countsTowardResult')::boolean,true),
      coalesce(v_item->>'disciplineKind','doubles'),coalesce(v_item->>'activationRule','always'),
      coalesce((v_item->>'enabled')::boolean,true),now()
    ) on conflict (team_tournament_id, external_discipline_id) do update set
      name=excluded.name,category_type=excluded.category_type,gender_requirement=excluded.gender_requirement,
      player_count=excluded.player_count,sort_order=excluded.sort_order,scoring_format=excluded.scoring_format,
      counts_toward_result=excluded.counts_toward_result,discipline_kind=excluded.discipline_kind,
      activation_rule=excluded.activation_rule,enabled=excluded.enabled,updated_at=now();
  elsif p_expected_command = 'discipline.remove' then
    v_id := nullif(v_payload->>'disciplineId','');
    if v_id is null then return json_build_object('ok',false,'code','VALIDATION_ERROR'); end if;
    if exists (select 1 from public.team_tournament_sub_matches sm join public.team_tournament_matchups m on m.id=sm.matchup_id
               where m.team_tournament_id=v_header.id and sm.discipline_external_id=v_id)
       and not coalesce((v_envelope->>'confirmDestructive')::boolean,false)
    then return json_build_object('ok',false,'code','CONFIRM_DESTRUCTIVE_REQUIRED'); end if;
    delete from public.team_tournament_disciplines where team_tournament_id=v_header.id and external_discipline_id=v_id;
  elsif p_expected_command = 'discipline.reorder' then
    for v_item in select value from jsonb_array_elements(coalesce(v_payload->'disciplines', '[]'::jsonb)) loop
      update public.team_tournament_disciplines set sort_order=coalesce((v_item->>'sortOrder')::int,sort_order),updated_at=now()
      where team_tournament_id=v_header.id and external_discipline_id=coalesce(v_item->>'id',v_item->>'externalDisciplineId');
    end loop;
    if jsonb_array_length(coalesce(v_payload->'orderedIds','[]'::jsonb)) > 0 then
      for v_item in select jsonb_build_object('id', x.value, 'sortOrder', x.ord)
        from jsonb_array_elements(v_payload->'orderedIds') with ordinality x(value,ord) loop
        update public.team_tournament_disciplines set sort_order=(v_item->>'sortOrder')::int,updated_at=now()
        where team_tournament_id=v_header.id and external_discipline_id=v_item->>'id';
      end loop;
    end if;
  elsif p_expected_command in ('groups.replace','groups.clear') then
    if p_expected_command='groups.clear' and not coalesce((v_envelope->>'confirmDestructive')::boolean,false) then
      return json_build_object('ok',false,'code','CONFIRM_DESTRUCTIVE_REQUIRED');
    end if;
    v_locked := coalesce(v_header.settings->'schedulePublish'->>'status','draft')='locked';
    if v_locked and not coalesce((v_envelope->>'confirmDestructive')::boolean,false) then return json_build_object('ok',false,'code','SCHEDULE_LOCKED'); end if;
    if p_expected_command='groups.replace' then
      select count(*) into v_input_count from jsonb_array_elements(coalesce(v_payload->'groups','[]'::jsonb));
      select count(distinct x.value) into v_team_count from jsonb_array_elements(coalesce(v_payload->'groups','[]'::jsonb)) g,
        jsonb_array_elements_text(coalesce(g.value->'teamIds','[]'::jsonb)) x(value);
      if (select count(*) from jsonb_array_elements(coalesce(v_payload->'groups','[]'::jsonb)) g,
          jsonb_array_elements_text(coalesce(g.value->'teamIds','[]'::jsonb))) <> v_team_count
      then return json_build_object('ok',false,'code','DUPLICATE_GROUP_TEAM'); end if;
      if exists (select 1 from jsonb_array_elements(coalesce(v_payload->'groups','[]'::jsonb)) g,
          jsonb_array_elements_text(coalesce(g.value->'teamIds','[]'::jsonb)) x(value)
          where not exists (select 1 from public.team_tournament_teams t where t.team_tournament_id=v_header.id and t.external_team_id=x.value))
      then return json_build_object('ok',false,'code','UNKNOWN_TEAM'); end if;
    end if;
    delete from public.team_tournament_groups where team_tournament_id=v_header.id;
    if p_expected_command='groups.replace' then
      for v_item in select value from jsonb_array_elements(coalesce(v_payload->'groups','[]'::jsonb)) loop
        insert into public.team_tournament_groups(tenant_id,tournament_id,team_tournament_id,external_group_id,name,sort_order,team_ids)
        values(v_header.tenant_id,p_tournament_id,v_header.id,coalesce(v_item->>'id',gen_random_uuid()::text),
          coalesce(v_item->>'name',''),coalesce((v_item->>'sortOrder')::int,1),
          coalesce(array(select jsonb_array_elements_text(v_item->'teamIds')),'{}'::text[]));
      end loop;
    end if;
  elsif p_expected_command = 'matchups.replace' then
    if exists (select 1 from public.team_tournament_matchups m where m.team_tournament_id=v_header.id
      and (public.team_tournament_matchup_is_started(m) or public.team_tournament_matchup_has_confirmed_result(m.id)))
      and not coalesce((v_envelope->>'confirmDestructive')::boolean,false)
    then return json_build_object('ok',false,'code','CONFIRM_DESTRUCTIVE_REQUIRED'); end if;
    if exists (select 1 from jsonb_array_elements(coalesce(v_payload->'matchups','[]'::jsonb)) x
      where not exists (select 1 from public.team_tournament_teams t where t.team_tournament_id=v_header.id and t.external_team_id=x.value->>'teamAId')
         or not exists (select 1 from public.team_tournament_teams t where t.team_tournament_id=v_header.id and t.external_team_id=x.value->>'teamBId'))
    then return json_build_object('ok',false,'code','UNKNOWN_TEAM'); end if;
    delete from public.team_tournament_matchups where team_tournament_id=v_header.id;
    for v_item in select value from jsonb_array_elements(coalesce(v_payload->'matchups','[]'::jsonb)) loop
      v_id := coalesce(nullif(v_item->>'id',''), gen_random_uuid()::text);
      insert into public.team_tournament_matchups(tenant_id,tournament_id,team_tournament_id,external_matchup_id,team_a_id,team_b_id,
        scheduled_at,lineup_lock_at,court_label,status,schedule_meta,created_by,updated_by)
      values(v_header.tenant_id,p_tournament_id,v_header.id,v_id,v_item->>'teamAId',v_item->>'teamBId',
        nullif(v_item->>'scheduledAt','')::timestamptz,nullif(v_item->>'lineupLockAt','')::timestamptz,nullif(v_item->>'courtLabel',''),
        coalesce(v_item->>'status','lineup_open'),
        coalesce(v_item->'scheduleMeta','{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'groupId',v_item->>'groupId','roundNumber',v_item->'roundNumber','matchNumberInRound',v_item->'matchNumberInRound',
          'stage',v_item->>'stage','nextMatchupId',v_item->>'nextMatchupId')),auth.uid(),auth.uid())
      returning * into v_match;
      for v_sub in select value from jsonb_array_elements(coalesce(v_item->'subMatches','[]'::jsonb)) loop
        if not exists(select 1 from public.team_tournament_disciplines d where d.team_tournament_id=v_header.id
          and d.external_discipline_id=coalesce(v_sub->>'disciplineId',v_sub->>'disciplineExternalId')) then
          return json_build_object('ok', false, 'code', 'UNKNOWN_DISCIPLINE');
        end if;
        insert into public.team_tournament_sub_matches(tenant_id,tournament_id,matchup_id,external_sub_match_id,discipline_external_id,sort_order)
        values(v_header.tenant_id,p_tournament_id,v_match.id,coalesce(v_sub->>'id',gen_random_uuid()::text),
          coalesce(v_sub->>'disciplineId',v_sub->>'disciplineExternalId'),coalesce((v_sub->>'sortOrder')::int,1));
      end loop;
    end loop;
    if exists (
      select 1 from public.team_tournament_matchups a
      join public.team_tournament_matchups b
        on a.team_tournament_id=b.team_tournament_id and a.id<b.id
       and a.court_label=b.court_label and a.scheduled_at=b.scheduled_at
      where a.team_tournament_id=v_header.id and a.court_label is not null and a.scheduled_at is not null
    ) then return json_build_object('ok', false, 'code', 'COURT_CONFLICT'); end if;
  elsif p_expected_command in ('schedule.update','schedule.batch') then
    v_schedule := case when p_expected_command='schedule.update'
      then case jsonb_typeof(coalesce(v_payload->'scheduleEntry',v_payload->'updates'))
        when 'array' then coalesce(v_payload->'scheduleEntry',v_payload->'updates')
        else jsonb_build_array(coalesce(v_payload->'scheduleEntry',v_payload->'updates')) end
      else coalesce(v_payload->'schedule','[]'::jsonb) end;
    if exists (select 1 from jsonb_array_elements(v_schedule) with ordinality a(value, ord)
      join jsonb_array_elements(v_schedule) with ordinality b(value, ord) on a.ord < b.ord
      where nullif(a.value->>'courtLabel','')=nullif(b.value->>'courtLabel','')
        and nullif(a.value->>'scheduledAt','')=nullif(b.value->>'scheduledAt','')
        and a.value->>'matchupId'<>b.value->>'matchupId')
    then return json_build_object('ok',false,'code','COURT_CONFLICT'); end if;
    for v_item in select value from jsonb_array_elements(v_schedule) loop
      if exists (select 1 from public.team_tournament_matchups m where m.team_tournament_id=v_header.id
        and m.external_matchup_id<>v_item->>'matchupId' and m.court_label=nullif(v_item->>'courtLabel','')
        and m.scheduled_at=nullif(v_item->>'scheduledAt','')::timestamptz
        and not exists (select 1 from jsonb_array_elements(v_schedule) q where q.value->>'matchupId'=m.external_matchup_id))
      then return json_build_object('ok',false,'code','COURT_CONFLICT'); end if;
      update public.team_tournament_matchups set scheduled_at=nullif(v_item->>'scheduledAt','')::timestamptz,
        court_label=nullif(v_item->>'courtLabel',''),lineup_lock_at=coalesce(nullif(v_item->>'lineupLockAt','')::timestamptz,lineup_lock_at),
        schedule_meta=schedule_meta || jsonb_strip_nulls(jsonb_build_object('roundNumber',v_item->'roundNumber',
          'matchNumberInRound',v_item->'matchNumberInRound','stage',v_item->>'stage','groupId',v_item->>'groupId')),
        updated_at=now(),updated_by=auth.uid()
      where team_tournament_id=v_header.id and external_matchup_id=v_item->>'matchupId';
    end loop;
  elsif p_expected_command = 'schedule.publish' then
    update public.team_tournaments set settings=settings || jsonb_build_object('schedulePublish',
      coalesce(settings->'schedulePublish','{}'::jsonb) || jsonb_build_object('status','published','publishedAt',now(),'publishedBy',auth.uid()::text,'lockedAt',null,'lockedBy',''))
    where id=v_header.id;
  elsif p_expected_command = 'schedule.lock' then
    if coalesce(v_header.settings->'schedulePublish'->>'status','draft')<>'published'
       and not coalesce((v_envelope->>'confirmDestructive')::boolean,false) then return json_build_object('ok',false,'code','CONFIRM_DESTRUCTIVE_REQUIRED'); end if;
    update public.team_tournaments set settings=settings || jsonb_build_object('schedulePublish',
      coalesce(settings->'schedulePublish','{}'::jsonb) || jsonb_build_object('status','locked','lockedAt',now(),'lockedBy',auth.uid()::text))
    where id=v_header.id;
  else
    return json_build_object('ok',false,'code','VALIDATION_ERROR');
  end if;
  v_new_version := public.team_tournament_setup_mutation_bump_version(v_header.id, v_header.version);
  return public.team_tournament_setup_mutation_finalize(v_header.tenant_id,p_tournament_id,v_header.id,v_new_version,
    v_envelope,v_prepare->>'payload_hash',v_prepare->>'command_payload_hash',
    public.team_tournament_setup_norm_projection(v_header.id,p_tournament_id,v_new_version),
    (v_prepare->>'actor_id')::uuid);
end;
$$;

create or replace function public.team_tournament_save_discipline(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'discipline.save',$3,$4); $$;
create or replace function public.team_tournament_remove_discipline(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'discipline.remove',$3,$4); $$;
create or replace function public.team_tournament_reorder_disciplines(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'discipline.reorder',$3,$4); $$;
create or replace function public.team_tournament_replace_groups(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'groups.replace',$3,$4); $$;
create or replace function public.team_tournament_clear_groups(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'groups.clear',$3,$4); $$;
create or replace function public.team_tournament_replace_matchups(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'matchups.replace',$3,$4); $$;
create or replace function public.team_tournament_update_matchup_schedule(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'schedule.update',$3,$4); $$;
create or replace function public.team_tournament_apply_schedule_batch(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'schedule.batch',$3,$4); $$;
create or replace function public.team_tournament_publish_schedule(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'schedule.publish',$3,$4); $$;
create or replace function public.team_tournament_lock_schedule(p_tournament_id text,p_envelope jsonb,p_expected_version integer default null,p_idempotency_key text default null) returns json language sql security definer set search_path=public as $$ select public.team_tournament_apply_domain_setup_mutation($1,$2,'schedule.lock',$3,$4); $$;

revoke all on function public.team_tournament_setup_mutation_prepare(text,jsonb,text,integer,text), public.team_tournament_setup_mutation_finalize(text,text,uuid,integer,jsonb,text,text,jsonb,uuid), public.team_tournament_apply_domain_setup_mutation(text,jsonb,text,integer,text) from public, anon, authenticated;
grant execute on function public.team_tournament_save_discipline(text,jsonb,integer,text), public.team_tournament_remove_discipline(text,jsonb,integer,text), public.team_tournament_reorder_disciplines(text,jsonb,integer,text), public.team_tournament_replace_groups(text,jsonb,integer,text), public.team_tournament_clear_groups(text,jsonb,integer,text), public.team_tournament_replace_matchups(text,jsonb,integer,text), public.team_tournament_update_matchup_schedule(text,jsonb,integer,text), public.team_tournament_apply_schedule_batch(text,jsonb,integer,text), public.team_tournament_publish_schedule(text,jsonb,integer,text), public.team_tournament_lock_schedule(text,jsonb,integer,text) to authenticated;
revoke all on function public.team_tournament_save_discipline(text,jsonb,integer,text), public.team_tournament_remove_discipline(text,jsonb,integer,text), public.team_tournament_reorder_disciplines(text,jsonb,integer,text), public.team_tournament_replace_groups(text,jsonb,integer,text), public.team_tournament_clear_groups(text,jsonb,integer,text), public.team_tournament_replace_matchups(text,jsonb,integer,text), public.team_tournament_update_matchup_schedule(text,jsonb,integer,text), public.team_tournament_apply_schedule_batch(text,jsonb,integer,text), public.team_tournament_publish_schedule(text,jsonb,integer,text), public.team_tournament_lock_schedule(text,jsonb,integer,text) from anon, public;
