-- Phase V5-B.1P — persistence-only RPC + revoke mean-scoring canonical path
-- Requires PHASE_V5A_RATING_FOUNDATION.sql and prior V5-B.1 applied.
-- Staging ONLY. Do not apply to production.

-- ─── Service role gate ───────────────────────────────────────────
create or replace function public.rating_v5_assert_service_role()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := '';
begin
  v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  if v_role = '' then
    begin
      v_role := coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '');
    exception
      when others then
        v_role := '';
    end;
  end if;
  if v_role = '' then
    v_role := coalesce(auth.jwt() ->> 'role', '');
  end if;
  if v_role = 'service_role' then
    return;
  end if;
  raise exception 'rating_v5_service_forbidden: service_role required (role=%)', coalesce(v_role, 'null')
    using errcode = '42501';
end;
$$;

-- ─── Version contract match ──────────────────────────────────────
create or replace function public.rating_v5_assert_payload_versions(p_versions jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active jsonb := public.rating_v5_active_version_contract();
  v_key text;
begin
  if p_versions is null or jsonb_typeof(p_versions) <> 'object' then
    raise exception 'rating_v5_invalid_versions';
  end if;
  foreach v_key in array array[
    'assessmentVersion', 'questionBankVersion', 'scoringEngineVersion',
    'calibrationVersion', 'gateVersion', 'reliabilityVersion', 'glossaryVersion'
  ] loop
    if coalesce(p_versions->>v_key, '') <> coalesce(v_active->>v_key, '') then
      raise exception 'rating_v5_version_mismatch: %', v_key;
    end if;
  end loop;
end;
$$;

-- ─── Persistence-only RPC (trusted server runtime) ───────────────
create or replace function public.rating_v5_service_persist_assessment_completion(
  p_assessment_id uuid,
  p_payload jsonb,
  p_test_fault text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.player_skill_assessments%rowtype;
  v_completed jsonb;
  v_event jsonb;
  v_profile jsonb;
  v_versions jsonb;
  v_player uuid;
  v_tenant text;
  v_existing_event uuid;
  v_profile_id uuid;
  v_event_id uuid;
begin
  perform public.rating_v5_assert_service_role();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD');
  end if;

  v_player := (p_payload->>'player_id')::uuid;
  v_tenant := p_payload->>'tenant_id';
  v_completed := p_payload->'completed_row';
  v_event := p_payload->'rating_event';
  v_profile := p_payload->'profile_patch';
  v_versions := p_payload->'versions';

  if v_player is null or v_tenant is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD');
  end if;

  perform public.rating_v5_assert_payload_versions(v_versions);

  select * into v_row
  from public.player_skill_assessments
  where id = p_assessment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ASSESSMENT_NOT_FOUND');
  end if;

  if v_row.player_id <> v_player then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN_OWNER');
  end if;
  if v_row.tenant_id <> v_tenant then
    return jsonb_build_object('ok', false, 'code', 'TENANT_MISMATCH');
  end if;

  if v_row.assessment_status = 'completed' then
    return jsonb_build_object(
      'ok', true,
      'code', 'ALREADY_COMPLETED',
      'idempotent', true,
      'assessmentId', v_row.id,
      'overall_skill', v_row.overall_skill,
      'provisional_rating', v_row.provisional_rating,
      'versions', jsonb_build_object(
        'assessmentVersion', v_row.assessment_version,
        'questionBankVersion', v_row.question_bank_version,
        'scoringEngineVersion', v_row.scoring_engine_version,
        'gateVersion', v_row.gate_version,
        'calibrationVersion', v_row.calibration_version,
        'glossaryVersion', v_row.glossary_version,
        'reliabilityVersion', v_row.reliability_version
      )
    );
  end if;

  if v_row.assessment_status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATUS', 'status', v_row.assessment_status);
  end if;

  update public.player_skill_assessments
  set
    answers = coalesce(v_completed->'answers', '{}'::jsonb),
    item_scores = coalesce(v_completed->'item_scores', '{}'::jsonb),
    domain_scores = coalesce(v_completed->'domain_scores', '{}'::jsonb),
    skill_vector = coalesce(v_completed->'skill_vector', '{}'::jsonb),
    overall_skill = (v_completed->>'overall_skill')::numeric,
    initial_mean = (v_completed->>'initial_mean')::numeric,
    initial_deviation = (v_completed->>'initial_deviation')::numeric,
    provisional_rating = (v_completed->>'provisional_rating')::numeric,
    confidence_score = (v_completed->>'confidence_score')::integer,
    estimated_error = (v_completed->>'estimated_error')::numeric,
    warning_flags = coalesce(v_completed->'warning_flags', '[]'::jsonb),
    applied_gates = coalesce(v_completed->'applied_gates', '[]'::jsonb),
    assessment_status = 'completed',
    completed_at = now(),
    updated_at = now(),
    assessment_version = v_completed->>'assessment_version',
    question_bank_version = v_completed->>'question_bank_version',
    scoring_engine_version = v_completed->>'scoring_engine_version',
    gate_version = v_completed->>'gate_version',
    calibration_version = v_completed->>'calibration_version',
    glossary_version = v_completed->>'glossary_version',
    reliability_version = v_completed->>'reliability_version'
  where id = p_assessment_id;

  if p_test_fault = 'after_assessment_update' then
    raise exception 'rating_v5_test_fault: after_assessment_update';
  end if;

  select id into v_existing_event
  from public.player_rating_events
  where tenant_id = v_tenant
    and player_id = v_player
    and source_type = 'questionnaire'
    and source_id = p_assessment_id::text
    and event_type = 'assessment_complete'
  limit 1;

  if p_test_fault = 'before_event_insert' then
    raise exception 'rating_v5_test_fault: before_event_insert';
  end if;

  if v_existing_event is null then
    insert into public.player_rating_events (
      tenant_id, player_id, rating_mode, event_type, source_type, source_id,
      verification_status, evidence_level,
      pre_rating_mean, post_rating_mean, pre_deviation, post_deviation,
      rating_delta, reliability_before, reliability_after,
      engine_version, is_shadow, metadata
    ) values (
      v_tenant,
      v_player,
      coalesce(v_event->>'rating_mode', 'doubles'),
      coalesce(v_event->>'event_type', 'assessment_complete'),
      coalesce(v_event->>'source_type', 'questionnaire'),
      coalesce(v_event->>'source_id', p_assessment_id::text),
      coalesce(v_event->>'verification_status', 'confirmed'),
      coalesce((v_event->>'evidence_level')::smallint, 1),
      nullif(v_event->>'pre_rating_mean', '')::numeric,
      (v_event->>'post_rating_mean')::numeric,
      nullif(v_event->>'pre_deviation', '')::numeric,
      (v_event->>'post_deviation')::numeric,
      (v_event->>'rating_delta')::numeric,
      coalesce((v_event->>'reliability_before')::integer, 0),
      coalesce((v_event->>'reliability_after')::integer, 0),
      coalesce(v_event->>'engine_version', v_versions->>'scoringEngineVersion'),
      coalesce((v_event->>'is_shadow')::boolean, true),
      coalesce(v_event->'metadata', '{}'::jsonb)
    )
    returning id into v_event_id;
  else
    v_event_id := v_existing_event;
  end if;

  if p_test_fault = 'after_event_insert' then
    raise exception 'rating_v5_test_fault: after_event_insert';
  end if;

  if p_test_fault = 'before_profile_upsert' then
    raise exception 'rating_v5_test_fault: before_profile_upsert';
  end if;

  insert into public.player_rating_profiles (
    tenant_id, player_id, rating_mode, is_shadow, rollout_cohort,
    provisional_rating, open_rating_mean, open_rating_deviation,
    display_rating, reliability_score, rating_status, evidence_level,
    assessment_count, engine_version, verified_rating_mean, verified_rating_deviation
  ) values (
    v_tenant,
    v_player,
    coalesce(v_profile->>'rating_mode', 'doubles'),
    coalesce((v_profile->>'is_shadow')::boolean, true),
    coalesce(v_profile->>'rollout_cohort', 'v5-shadow-pilot'),
    (v_profile->>'provisional_rating')::numeric,
    (v_profile->>'open_rating_mean')::numeric,
    (v_profile->>'open_rating_deviation')::numeric,
    (v_profile->>'display_rating')::numeric,
    coalesce((v_profile->>'reliability_score')::integer, 0),
    coalesce(v_profile->>'rating_status', 'provisional'),
    coalesce((v_profile->>'evidence_level')::smallint, 1),
    coalesce((v_profile->>'assessment_count')::integer, 1),
    coalesce(v_profile->>'engine_version', 'pick-vn-rating-v5'),
    nullif(v_profile->>'verified_rating_mean', '')::numeric,
    nullif(v_profile->>'verified_rating_deviation', '')::numeric
  )
  on conflict (tenant_id, player_id, rating_mode) do update
  set
    provisional_rating = excluded.provisional_rating,
    open_rating_mean = excluded.open_rating_mean,
    open_rating_deviation = excluded.open_rating_deviation,
    display_rating = excluded.display_rating,
    rating_status = excluded.rating_status,
    assessment_count = public.player_rating_profiles.assessment_count + 1,
    updated_at = now()
  returning id into v_profile_id;

  if p_test_fault = 'during_profile_upsert' then
    raise exception 'rating_v5_test_fault: during_profile_upsert';
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'COMPLETED',
    'assessmentId', p_assessment_id,
    'profileId', v_profile_id,
    'eventId', v_event_id,
    'overall_skill', (v_completed->>'overall_skill')::numeric,
    'provisional_rating', (v_completed->>'provisional_rating')::numeric,
    'provisional_display_rating', (v_profile->>'display_rating')::numeric,
    'versions', v_versions,
    'shadow', true
  );
exception
  when others then
    if sqlerrm like 'rating_v5_test_fault:%' then
      raise;
    end if;
    if sqlstate = '42501' then
      raise;
    end if;
    return jsonb_build_object('ok', false, 'code', 'PERSISTENCE_ERROR', 'message', sqlerrm);
end;
$$;

revoke all on function public.rating_v5_service_persist_assessment_completion(uuid, jsonb, text) from public;
grant execute on function public.rating_v5_service_persist_assessment_completion(uuid, jsonb, text) to service_role;

-- ─── Rename mean-scoring prototype — NOT canonical ─────────────────
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rating_v5_complete_assessment'
  ) then
    alter function public.rating_v5_complete_assessment(uuid, jsonb, text)
      rename to rating_v5_prototype_mean_complete_assessment;
  end if;
end $$;

revoke all on function public.rating_v5_prototype_mean_complete_assessment(uuid, jsonb, text) from public;
revoke execute on function public.rating_v5_prototype_mean_complete_assessment(uuid, jsonb, text) from authenticated;
grant execute on function public.rating_v5_prototype_mean_complete_assessment(uuid, jsonb, text) to service_role;

comment on function public.rating_v5_prototype_mean_complete_assessment(uuid, jsonb, text) is
  'V5-B.1 diagnostic mean-scoring prototype — NOT canonical. service_role only.';

comment on function public.rating_v5_service_persist_assessment_completion(uuid, jsonb, text) is
  'V5-B.1P persistence-only RPC — accepts pre-scored payload from trusted Edge Function runtime. service_role only.';

-- ─── Strengthen idempotency (assessment completion events) ───────
create unique index if not exists player_rating_events_assessment_complete_idempotent_idx
  on public.player_rating_events (tenant_id, player_id, rating_mode, source_type, source_id, event_type)
  where source_type = 'questionnaire'
    and event_type = 'assessment_complete'
    and source_id is not null;
