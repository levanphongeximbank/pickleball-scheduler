-- Phase V5-B.1 — rating_v5_complete_assessment (staging only)
-- Requires PHASE_V5A_RATING_FOUNDATION.sql applied first.
-- Server-side scoring via plpgsql; versions stamped from frozen v5.0f contract.

-- ─── Frozen version contract (do not edit without version bump) ───
create or replace function public.rating_v5_active_version_contract()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'assessmentVersion', 'assessment-v5.0f',
    'questionBankVersion', 'qbank-v5.0f',
    'scoringEngineVersion', 'scoring-v5.0f',
    'calibrationVersion', 'calibration-v5.0f',
    'gateVersion', 'gates-v5.0f',
    'reliabilityVersion', 'reliability-v5.0',
    'glossaryVersion', 'glossary-v5.0f'
  );
$$;

create or replace function public.rating_v5_anchor_to_mean(p_anchor int)
returns numeric
language sql
immutable
as $$
  select 1.5 + (greatest(0, least(7, coalesce(p_anchor, 0)))::numeric / 7.0) * 4.5;
$$;

create or replace function public.rating_v5_complete_assessment(
  p_assessment_id uuid,
  p_answers jsonb,
  p_rating_mode text default 'doubles'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant text := public.rating_v5_resolve_tenant_id();
  v_row public.player_skill_assessments%rowtype;
  v_versions jsonb := public.rating_v5_active_version_contract();
  v_existing_event uuid;
  v_profile_id uuid;
  v_rating_before numeric;
  v_rating_after numeric;
  v_display numeric;
  v_status text := 'provisional';
  v_verification_required boolean := false;
  v_result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if not public.rating_v5_has_permission('rating_v5.assess_self') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_rating_mode = 'singles' then
    return jsonb_build_object('ok', false, 'code', 'SINGLES_NOT_IMPLEMENTED', 'message', 'V5-B.1');
  end if;
  if p_rating_mode <> 'doubles' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MODE');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ANSWERS');
  end if;

  select * into v_row
  from public.player_skill_assessments
  where id = p_assessment_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ASSESSMENT_NOT_FOUND');
  end if;
  if v_row.player_id <> v_uid then
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

  -- Validate anchors 0-7 and core coverage (22 core ids)
  if (
    select count(*) from jsonb_each_text(p_answers) e
    where e.key like 'core_%'
  ) < 22 then
    return jsonb_build_object('ok', false, 'code', 'MISSING_CORE_QUESTIONS');
  end if;

  if exists (
    select 1 from jsonb_each_text(p_answers) e
    where (e.value)::int < 0 or (e.value)::int > 7
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ANSWER_ANCHOR');
  end if;

  if (
    select count(*) from jsonb_each_text(p_answers) e where e.key like 'adp_%'
  ) > 8 then
    return jsonb_build_object('ok', false, 'code', 'ADAPTIVE_BUDGET_EXCEEDED');
  end if;

  -- Simplified scoring: mean of all anchor means (server RPC uses JS engine in app layer tests;
  -- staging RPC uses conservative mean for shadow pilot until full plpgsql port in V5-B.2)
  select avg(public.rating_v5_anchor_to_mean((value)::int))
    into v_rating_before
  from jsonb_each_text(p_answers);

  v_rating_after := least(4.5, greatest(1.5, coalesce(v_rating_before, 1.5)));
  v_display := round(v_rating_after::numeric, 1);
  if v_rating_before > 4.5 then
    v_verification_required := true;
    v_status := 'under_review';
  elsif v_rating_after <= 1.5 then
    v_status := 'self_assessed';
  end if;

  update public.player_skill_assessments
  set
    answers = p_answers,
    domain_scores = p_answers,
    skill_vector = '{}'::jsonb,
    overall_skill = v_rating_after,
    initial_mean = v_rating_after,
    initial_deviation = 0.48,
    provisional_rating = v_rating_after,
    confidence_score = 50,
    estimated_error = 0.4,
    warning_flags = '[]'::jsonb,
    applied_gates = '[]'::jsonb,
    assessment_status = 'completed',
    completed_at = now(),
    updated_at = now(),
    assessment_version = v_versions->>'assessmentVersion',
    question_bank_version = v_versions->>'questionBankVersion',
    scoring_engine_version = v_versions->>'scoringEngineVersion',
    gate_version = v_versions->>'gateVersion',
    calibration_version = v_versions->>'calibrationVersion',
    glossary_version = v_versions->>'glossaryVersion',
    reliability_version = v_versions->>'reliabilityVersion'
  where id = p_assessment_id;

  select id into v_existing_event
  from public.player_rating_events
  where tenant_id = v_tenant
    and player_id = v_uid
    and source_type = 'questionnaire'
    and source_id = p_assessment_id::text
    and event_type = 'assessment_complete'
  limit 1;

  if v_existing_event is null then
    insert into public.player_rating_events (
      tenant_id, player_id, rating_mode, event_type, source_type, source_id,
      verification_status, evidence_level, post_rating_mean, post_deviation,
      engine_version, is_shadow, metadata
    ) values (
      v_tenant, v_uid, 'doubles', 'assessment_complete', 'questionnaire', p_assessment_id::text,
      'confirmed', 1, v_rating_after, 0.48,
      v_versions->>'scoringEngineVersion', true,
      jsonb_build_object('assessmentVersion', v_versions->>'assessmentVersion')
    );
  end if;

  insert into public.player_rating_profiles (
    tenant_id, player_id, rating_mode, is_shadow, rollout_cohort,
    provisional_rating, open_rating_mean, open_rating_deviation,
    display_rating, reliability_score, rating_status, evidence_level,
    assessment_count, engine_version
  ) values (
    v_tenant, v_uid, 'doubles', true, coalesce(v_row.rollout_cohort, 'v5-shadow-pilot'),
    v_rating_after, v_rating_after, 0.48,
    v_display, 0, v_status, 1,
    1, 'pick-vn-rating-v5'
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

  return jsonb_build_object(
    'ok', true,
    'code', 'COMPLETED',
    'assessmentId', p_assessment_id,
    'profileId', v_profile_id,
    'overall_skill', v_rating_after,
    'provisional_rating', v_rating_after,
    'provisional_display_rating', v_display,
    'estimated_rating', v_rating_before,
    'verification_required', v_verification_required,
    'rating_status', v_status,
    'versions', v_versions,
    'shadow', true
  );
end;
$$;

revoke all on function public.rating_v5_complete_assessment(uuid, jsonb, text) from public;
grant execute on function public.rating_v5_complete_assessment(uuid, jsonb, text) to authenticated;
