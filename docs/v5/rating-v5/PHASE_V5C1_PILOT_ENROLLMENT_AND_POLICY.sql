-- Phase V5-C.1 — Pilot enrollment, rollout policy, invalidation, profile traceability
-- Requires: PHASE_V5A_RATING_FOUNDATION.sql, PHASE_V5B1_COMPLETE_ASSESSMENT.sql, PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql
-- Production bundle step 4. Idempotent. Does NOT modify pick_vn_player_ratings (V2).

-- ─── Rollout policy columns ─────────────────────────────────────
alter table public.rating_v5_rollout_config
  add column if not exists max_completed_assessments integer not null default 1,
  add column if not exists cooldown_days integer not null default 7,
  add column if not exists allow_manual_reassessment boolean not null default true,
  add column if not exists reassessment_requires_approval boolean not null default true;

alter table public.rating_v5_rollout_config
  drop constraint if exists rating_v5_rollout_config_max_completed_check;
alter table public.rating_v5_rollout_config
  add constraint rating_v5_rollout_config_max_completed_check
  check (max_completed_assessments >= 1);

alter table public.rating_v5_rollout_config
  drop constraint if exists rating_v5_rollout_config_cooldown_check;
alter table public.rating_v5_rollout_config
  add constraint rating_v5_rollout_config_cooldown_check
  check (cooldown_days >= 0);

-- ─── Assessment lifecycle / invalidation columns ───────────────────
alter table public.player_skill_assessments
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidated_by uuid references public.profiles (id) on delete set null,
  add column if not exists invalidation_reason_code text,
  add column if not exists invalidation_notes text,
  add column if not exists superseded_by_assessment_id uuid references public.player_skill_assessments (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists lifecycle_version integer not null default 1;

alter table public.player_skill_assessments
  drop constraint if exists player_skill_assessments_assessment_status_check;
alter table public.player_skill_assessments
  add constraint player_skill_assessments_assessment_status_check
  check (assessment_status in (
    'draft', 'in_progress', 'completed', 'under_review', 'accepted', 'invalidated', 'cancelled'
  ));

alter table public.player_skill_assessments
  drop constraint if exists player_skill_assessments_lifecycle_version_check;
alter table public.player_skill_assessments
  add constraint player_skill_assessments_lifecycle_version_check
  check (lifecycle_version >= 1);

-- ─── Profile source traceability ─────────────────────────────────
alter table public.player_rating_profiles
  add column if not exists source_assessment_id uuid references public.player_skill_assessments (id) on delete set null,
  add column if not exists source_event_id uuid references public.player_rating_events (id) on delete set null,
  add column if not exists source_selection_reason text,
  add column if not exists source_selected_at timestamptz,
  add column if not exists profile_version integer not null default 1;

alter table public.player_rating_profiles
  drop constraint if exists player_rating_profiles_profile_version_check;
alter table public.player_rating_profiles
  add constraint player_rating_profiles_profile_version_check
  check (profile_version >= 1);

-- ─── Pilot enrollment SOT ────────────────────────────────────────
create table if not exists public.rating_v5_pilot_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  cohort_label text not null check (length(trim(cohort_label)) > 0),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'paused', 'removed', 'completed')),
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references public.profiles (id) on delete set null,
  paused_at timestamptz,
  removed_at timestamptz,
  expires_at timestamptz,
  notes text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, cohort_label)
);

create index if not exists rating_v5_pilot_enrollments_tenant_status_idx
  on public.rating_v5_pilot_enrollments (tenant_id, cohort_label, status);

-- ─── Reassessment approvals ────────────────────────────────────────
create table if not exists public.rating_v5_reassessment_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  cohort_label text not null,
  previous_assessment_id uuid references public.player_skill_assessments (id) on delete set null,
  approved_by uuid not null references public.profiles (id) on delete restrict,
  approved_at timestamptz not null default now(),
  reason text not null check (length(trim(reason)) > 0),
  consumed_at timestamptz,
  consumed_assessment_id uuid references public.player_skill_assessments (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now()
);

create index if not exists rating_v5_reassessment_approvals_player_idx
  on public.rating_v5_reassessment_approvals (player_id, tenant_id, cohort_label)
  where consumed_at is null;

-- ─── Rollout config loader ───────────────────────────────────────
create or replace function public.rating_v5_load_rollout_config()
returns public.rating_v5_rollout_config
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.rating_v5_rollout_config where id = 'default' limit 1;
$$;

-- ─── Completed assessment counter (excludes invalidated) ───────────
create or replace function public.rating_v5_count_valid_completed_assessments(
  p_player_id uuid,
  p_tenant_id text,
  p_rating_mode text default 'doubles'
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.player_skill_assessments a
  where a.player_id = p_player_id
    and a.tenant_id = p_tenant_id
    and a.rating_mode = p_rating_mode
    and a.is_shadow = true
    and a.invalidated_at is null
    and a.assessment_status in ('completed', 'under_review', 'accepted');
$$;

-- ─── Cohort gate (enrollment SOT) ──────────────────────────────────
create or replace function public.rating_v5_assert_pilot_gate(
  p_player_id uuid,
  p_tenant_id text,
  p_action text default 'complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.rating_v5_rollout_config%rowtype;
  v_enrollment public.rating_v5_pilot_enrollments%rowtype;
  v_completed_count integer;
  v_last_completed timestamptz;
  v_has_approval boolean;
begin
  if p_player_id is null or p_tenant_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_cfg from public.rating_v5_load_rollout_config();
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROLLOUT_BLOCKED');
  end if;
  if not v_cfg.allow_v5_assessment or not v_cfg.shadow_mode_enabled then
    return jsonb_build_object('ok', false, 'code', 'ROLLOUT_BLOCKED');
  end if;

  select * into v_enrollment
  from public.rating_v5_pilot_enrollments e
  where e.player_id = p_player_id
    and e.cohort_label = v_cfg.pilot_cohort_label
    and e.tenant_id = p_tenant_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PILOT_NOT_ENROLLED');
  end if;

  if v_enrollment.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'PILOT_NOT_ENROLLED', 'enrollment_status', v_enrollment.status);
  end if;

  if v_enrollment.expires_at is not null and v_enrollment.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'PILOT_NOT_ENROLLED', 'detail', 'expired');
  end if;

  if p_action = 'start' then
    v_completed_count := public.rating_v5_count_valid_completed_assessments(p_player_id, p_tenant_id, 'doubles');

    if v_completed_count >= v_cfg.max_completed_assessments then
      if not v_cfg.allow_manual_reassessment then
        return jsonb_build_object('ok', false, 'code', 'REASSESSMENT_NOT_ALLOWED');
      end if;

      select exists (
        select 1 from public.rating_v5_reassessment_approvals ra
        where ra.player_id = p_player_id
          and ra.tenant_id = p_tenant_id
          and ra.cohort_label = v_cfg.pilot_cohort_label
          and ra.consumed_at is null
      ) into v_has_approval;

      if v_cfg.reassessment_requires_approval and not v_has_approval then
        return jsonb_build_object('ok', false, 'code', 'REASSESSMENT_APPROVAL_REQUIRED');
      end if;

      select max(a.completed_at) into v_last_completed
      from public.player_skill_assessments a
      where a.player_id = p_player_id
        and a.tenant_id = p_tenant_id
        and a.rating_mode = 'doubles'
        and a.invalidated_at is null
        and a.assessment_status in ('completed', 'under_review', 'accepted');

      if v_last_completed is not null
         and v_cfg.cooldown_days > 0
         and v_last_completed > now() - make_interval(days => v_cfg.cooldown_days)
         and not v_has_approval then
        return jsonb_build_object('ok', false, 'code', 'REASSESSMENT_COOLDOWN_ACTIVE');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'cohort_label', v_cfg.pilot_cohort_label,
    'enrollment_id', v_enrollment.id
  );
end;
$$;

-- ─── My enrollment (frontend auth SOT) ─────────────────────────────
create or replace function public.rating_v5_get_my_pilot_enrollment()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.rating_v5_rollout_config%rowtype;
  v_row public.rating_v5_pilot_enrollments%rowtype;
  v_tenant text := public.rating_v5_resolve_tenant_id();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  select * into v_cfg from public.rating_v5_load_rollout_config();
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ROLLOUT_BLOCKED');
  end if;

  select * into v_row
  from public.rating_v5_pilot_enrollments e
  where e.player_id = v_uid
    and e.cohort_label = v_cfg.pilot_cohort_label
    and e.tenant_id = v_tenant
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'PILOT_NOT_ENROLLED', 'enrolled', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'enrolled', true,
    'enrollment', jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'cohort_label', v_row.cohort_label,
      'tenant_id', v_row.tenant_id,
      'expires_at', v_row.expires_at,
      'version', v_row.version
    )
  );
end;
$$;

-- ─── Admin enrollment upsert ─────────────────────────────────────
create or replace function public.rating_v5_admin_upsert_pilot_enrollment(
  p_player_id uuid,
  p_tenant_id text,
  p_cohort_label text,
  p_status text,
  p_expected_version integer default null,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.rating_v5_pilot_enrollments%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if not public.rating_v5_has_permission('rating_v5.calibration_manage') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_row
  from public.rating_v5_pilot_enrollments
  where player_id = p_player_id
    and cohort_label = p_cohort_label
  for update;

  if found then
    if p_expected_version is not null and v_row.version <> p_expected_version then
      return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'actual', v_row.version);
    end if;
    update public.rating_v5_pilot_enrollments
    set
      tenant_id = p_tenant_id,
      status = p_status,
      expires_at = p_expires_at,
      notes = coalesce(p_notes, notes),
      paused_at = case when p_status = 'paused' then now() else paused_at end,
      removed_at = case when p_status = 'removed' then now() else removed_at end,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.rating_v5_pilot_enrollments (
      tenant_id, player_id, cohort_label, status, enrolled_by, expires_at, notes
    ) values (
      p_tenant_id, p_player_id, p_cohort_label, p_status, v_uid, p_expires_at, p_notes
    )
    returning * into v_row;
  end if;

  return jsonb_build_object('ok', true, 'enrollment', row_to_json(v_row));
end;
$$;

-- ─── Reassessment approval grant ─────────────────────────────────
create or replace function public.rating_v5_grant_reassessment_approval(
  p_player_id uuid,
  p_tenant_id text,
  p_previous_assessment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.rating_v5_rollout_config%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if not public.rating_v5_has_permission('rating_v5.calibration_manage') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REASON');
  end if;

  select * into v_cfg from public.rating_v5_load_rollout_config();

  insert into public.rating_v5_reassessment_approvals (
    tenant_id, player_id, cohort_label, previous_assessment_id, approved_by, reason
  ) values (
    p_tenant_id, p_player_id, v_cfg.pilot_cohort_label, p_previous_assessment_id, v_uid, p_reason
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'approvalId', v_id);
end;
$$;

-- ─── Shadow profile recompute (source traceability) ────────────────
create or replace function public.rating_v5_recompute_shadow_profile(
  p_player_id uuid,
  p_tenant_id text,
  p_rating_mode text default 'doubles'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg public.rating_v5_rollout_config%rowtype;
  v_assessment public.player_skill_assessments%rowtype;
  v_event public.player_rating_events%rowtype;
  v_profile public.player_rating_profiles%rowtype;
begin
  perform public.rating_v5_assert_service_role();

  select * into v_cfg from public.rating_v5_load_rollout_config();

  select a.* into v_assessment
  from public.player_skill_assessments a
  where a.player_id = p_player_id
    and a.tenant_id = p_tenant_id
    and a.rating_mode = p_rating_mode
    and a.is_shadow = true
    and a.invalidated_at is null
    and a.assessment_status in ('completed', 'accepted')
  order by a.completed_at desc nulls last, a.created_at desc
  limit 1;

  if not found then
    update public.player_rating_profiles p
    set
      provisional_rating = null,
      open_rating_mean = null,
      open_rating_deviation = null,
      display_rating = null,
      rating_status = 'not_assessed',
      source_assessment_id = null,
      source_event_id = null,
      source_selection_reason = 'no_valid_assessment',
      source_selected_at = now(),
      profile_version = p.profile_version + 1,
      updated_at = now()
    where p.player_id = p_player_id
      and p.tenant_id = p_tenant_id
      and p.rating_mode = p_rating_mode
      and p.is_shadow = true
    returning * into v_profile;

    return jsonb_build_object('ok', true, 'code', 'NO_VALID_SOURCE', 'profileId', v_profile.id);
  end if;

  select e.* into v_event
  from public.player_rating_events e
  where e.source_id = v_assessment.id::text
    and e.event_type = 'assessment_complete'
  order by e.created_at desc
  limit 1;

  insert into public.player_rating_profiles (
    tenant_id, player_id, rating_mode, is_shadow, rollout_cohort,
    provisional_rating, open_rating_mean, open_rating_deviation, display_rating,
    rating_status, evidence_level, assessment_count, engine_version,
    source_assessment_id, source_event_id, source_selection_reason, source_selected_at
  ) values (
    p_tenant_id,
    p_player_id,
    p_rating_mode,
    true,
    coalesce(v_cfg.pilot_cohort_label, v_assessment.rollout_cohort),
    v_assessment.provisional_rating,
    v_assessment.initial_mean,
    v_assessment.initial_deviation,
    least(v_assessment.provisional_rating, 4.5),
    case when v_assessment.provisional_rating > 4.5 then 'under_review' else 'provisional' end,
    1,
    public.rating_v5_count_valid_completed_assessments(p_player_id, p_tenant_id, p_rating_mode),
    coalesce(v_assessment.scoring_engine_version, 'pick-vn-rating-v5'),
    v_assessment.id,
    v_event.id,
    'latest_valid_completed',
    now()
  )
  on conflict (tenant_id, player_id, rating_mode) do update
  set
    provisional_rating = excluded.provisional_rating,
    open_rating_mean = excluded.open_rating_mean,
    open_rating_deviation = excluded.open_rating_deviation,
    display_rating = excluded.display_rating,
    rating_status = excluded.rating_status,
    assessment_count = excluded.assessment_count,
    source_assessment_id = excluded.source_assessment_id,
    source_event_id = excluded.source_event_id,
    source_selection_reason = excluded.source_selection_reason,
    source_selected_at = excluded.source_selected_at,
    profile_version = public.player_rating_profiles.profile_version + 1,
    updated_at = now()
  returning * into v_profile;

  return jsonb_build_object(
    'ok', true,
    'code', 'RECOMPUTED',
    'profileId', v_profile.id,
    'source_assessment_id', v_assessment.id,
    'source_event_id', v_event.id
  );
end;
$$;

-- ─── Invalidation (admin + service) ──────────────────────────────
create or replace function public.rating_v5_invalidate_assessment(
  p_assessment_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.player_skill_assessments%rowtype;
  v_event_id uuid;
  v_existing_invalidation uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if not public.rating_v5_has_permission('rating_v5.override')
     and not public.rating_v5_has_permission('rating_v5.calibration_manage') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_reason_code is null or length(trim(p_reason_code)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REASON');
  end if;

  select * into v_row
  from public.player_skill_assessments
  where id = p_assessment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ASSESSMENT_NOT_FOUND');
  end if;

  if v_row.lifecycle_version <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'expected', p_expected_version, 'actual', v_row.lifecycle_version);
  end if;

  if v_row.assessment_status = 'invalidated' then
    return jsonb_build_object('ok', true, 'code', 'ALREADY_INVALIDATED', 'idempotent', true, 'assessmentId', v_row.id);
  end if;

  select id into v_existing_invalidation
  from public.player_rating_events
  where source_id = p_assessment_id::text
    and event_type = 'assessment_invalidated'
  limit 1;

  update public.player_skill_assessments
  set
    assessment_status = 'invalidated',
    invalidated_at = now(),
    invalidated_by = v_uid,
    invalidation_reason_code = p_reason_code,
    invalidation_notes = p_notes,
    lifecycle_version = lifecycle_version + 1,
    updated_at = now()
  where id = p_assessment_id;

  if v_existing_invalidation is null then
    insert into public.player_rating_events (
      tenant_id, player_id, rating_mode, event_type, source_type, source_id,
      verification_status, evidence_level, engine_version, is_shadow, metadata
    ) values (
      v_row.tenant_id,
      v_row.player_id,
      v_row.rating_mode,
      'assessment_invalidated',
      'admin_action',
      p_assessment_id::text,
      'confirmed',
      0,
      coalesce(v_row.scoring_engine_version, 'pick-vn-rating-v5'),
      true,
      jsonb_build_object(
        'reason_code', p_reason_code,
        'notes', p_notes,
        'invalidated_by', v_uid
      )
    )
    returning id into v_event_id;
  else
    v_event_id := v_existing_invalidation;
  end if;

  perform public.rating_v5_recompute_shadow_profile(v_row.player_id, v_row.tenant_id, v_row.rating_mode);

  return jsonb_build_object(
    'ok', true,
    'code', 'INVALIDATED',
    'assessmentId', p_assessment_id,
    'invalidationEventId', v_event_id
  );
end;
$$;

create or replace function public.rating_v5_service_invalidate_assessment(
  p_assessment_id uuid,
  p_expected_version integer,
  p_reason_code text,
  p_notes text default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid());
  v_row public.player_skill_assessments%rowtype;
  v_event_id uuid;
  v_existing_invalidation uuid;
begin
  perform public.rating_v5_assert_service_role();
  if p_reason_code is null or length(trim(p_reason_code)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REASON');
  end if;

  select * into v_row from public.player_skill_assessments where id = p_assessment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'ASSESSMENT_NOT_FOUND');
  end if;
  if v_row.lifecycle_version <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'expected', p_expected_version, 'actual', v_row.lifecycle_version);
  end if;
  if v_row.assessment_status = 'invalidated' then
    return jsonb_build_object('ok', true, 'code', 'ALREADY_INVALIDATED', 'idempotent', true);
  end if;

  select id into v_existing_invalidation
  from public.player_rating_events
  where source_id = p_assessment_id::text and event_type = 'assessment_invalidated'
  limit 1;

  update public.player_skill_assessments
  set assessment_status = 'invalidated', invalidated_at = now(),
      invalidated_by = v_actor, invalidation_reason_code = p_reason_code,
      invalidation_notes = p_notes, lifecycle_version = lifecycle_version + 1, updated_at = now()
  where id = p_assessment_id;

  if v_existing_invalidation is null then
    insert into public.player_rating_events (
      tenant_id, player_id, rating_mode, event_type, source_type, source_id,
      verification_status, evidence_level, engine_version, is_shadow, metadata
    ) values (
      v_row.tenant_id, v_row.player_id, v_row.rating_mode, 'assessment_invalidated', 'admin_action',
      p_assessment_id::text, 'confirmed', 0, coalesce(v_row.scoring_engine_version, 'pick-vn-rating-v5'), true,
      jsonb_build_object('reason_code', p_reason_code, 'notes', p_notes, 'invalidated_by', v_actor, 'service_role', true)
    ) returning id into v_event_id;
  else
    v_event_id := v_existing_invalidation;
  end if;

  perform public.rating_v5_recompute_shadow_profile(v_row.player_id, v_row.tenant_id, v_row.rating_mode);
  return jsonb_build_object('ok', true, 'code', 'INVALIDATED', 'assessmentId', p_assessment_id, 'invalidationEventId', v_event_id);
end;
$$;

-- ─── Start assessment (pilot gate enforced) ──────────────────────
create or replace function public.rating_v5_start_assessment(
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
  v_cfg public.rating_v5_rollout_config%rowtype;
  v_gate jsonb;
  v_id uuid;
  v_approval_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if not public.rating_v5_has_permission('rating_v5.assess_self') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if p_rating_mode not in ('singles', 'doubles') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MODE');
  end if;
  if p_rating_mode = 'singles' then
    return jsonb_build_object('ok', false, 'code', 'SINGLES_NOT_IMPLEMENTED', 'message', 'V5-B.1');
  end if;

  v_gate := public.rating_v5_assert_pilot_gate(v_uid, v_tenant, 'start');
  if coalesce((v_gate->>'ok')::boolean, false) is not true then
    return v_gate;
  end if;

  select * into v_cfg from public.rating_v5_load_rollout_config();

  insert into public.player_skill_assessments (
    tenant_id, player_id, rating_mode, assessment_status, is_shadow, rollout_cohort
  ) values (
    v_tenant, v_uid, p_rating_mode, 'draft', true, v_cfg.pilot_cohort_label
  )
  returning id into v_id;

  select ra.id into v_approval_id
  from public.rating_v5_reassessment_approvals ra
  where ra.player_id = v_uid
    and ra.tenant_id = v_tenant
    and ra.cohort_label = v_cfg.pilot_cohort_label
    and ra.consumed_at is null
  order by ra.approved_at desc
  limit 1;

  if v_approval_id is not null then
    update public.rating_v5_reassessment_approvals
    set consumed_at = now(), consumed_assessment_id = v_id
    where id = v_approval_id;
  end if;

  return jsonb_build_object('ok', true, 'assessmentId', v_id, 'shadow', true);
end;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.rating_v5_pilot_enrollments enable row level security;
alter table public.rating_v5_reassessment_approvals enable row level security;

drop policy if exists rating_v5_pilot_enrollments_select on public.rating_v5_pilot_enrollments;
create policy rating_v5_pilot_enrollments_select
  on public.rating_v5_pilot_enrollments for select to authenticated
  using (
    player_id = auth.uid()
    or public.rating_v5_has_permission('rating_v5.view_any')
    or public.rating_v5_has_permission('rating_v5.calibration_manage')
  );

drop policy if exists rating_v5_pilot_enrollments_manage on public.rating_v5_pilot_enrollments;
create policy rating_v5_pilot_enrollments_manage
  on public.rating_v5_pilot_enrollments for all to authenticated
  using (public.rating_v5_has_permission('rating_v5.calibration_manage'))
  with check (public.rating_v5_has_permission('rating_v5.calibration_manage'));

drop policy if exists rating_v5_reassessment_approvals_select on public.rating_v5_reassessment_approvals;
create policy rating_v5_reassessment_approvals_select
  on public.rating_v5_reassessment_approvals for select to authenticated
  using (
    player_id = auth.uid()
    or public.rating_v5_has_permission('rating_v5.view_any')
    or public.rating_v5_has_permission('rating_v5.calibration_manage')
  );

drop policy if exists rating_v5_reassessment_approvals_manage on public.rating_v5_reassessment_approvals;
create policy rating_v5_reassessment_approvals_manage
  on public.rating_v5_reassessment_approvals for all to authenticated
  using (public.rating_v5_has_permission('rating_v5.calibration_manage'))
  with check (public.rating_v5_has_permission('rating_v5.calibration_manage'));

-- ─── Grants / revokes ────────────────────────────────────────────
revoke all on table public.rating_v5_pilot_enrollments from anon;
revoke all on table public.rating_v5_reassessment_approvals from anon;

grant select on table public.rating_v5_pilot_enrollments to authenticated;
grant select on table public.rating_v5_reassessment_approvals to authenticated;

grant execute on function public.rating_v5_load_rollout_config() to authenticated;
grant execute on function public.rating_v5_count_valid_completed_assessments(uuid, text, text) to authenticated;
grant execute on function public.rating_v5_assert_pilot_gate(uuid, text, text) to authenticated;
grant execute on function public.rating_v5_get_my_pilot_enrollment() to authenticated;
grant execute on function public.rating_v5_admin_upsert_pilot_enrollment(uuid, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.rating_v5_grant_reassessment_approval(uuid, text, uuid, text) to authenticated;
grant execute on function public.rating_v5_invalidate_assessment(uuid, integer, text, text) to authenticated;

revoke all on function public.rating_v5_recompute_shadow_profile(uuid, text, text) from public;
grant execute on function public.rating_v5_recompute_shadow_profile(uuid, text, text) to service_role;
revoke all on function public.rating_v5_service_invalidate_assessment(uuid, integer, text, text, uuid) from public;
grant execute on function public.rating_v5_service_invalidate_assessment(uuid, integer, text, text, uuid) to service_role;

-- ─── Production initial rollout config (assessment OFF) ──────────
insert into public.rating_v5_rollout_config (
  id,
  shadow_mode_enabled,
  compare_v2_enabled,
  allow_v5_assessment,
  pilot_cohort_label,
  max_completed_assessments,
  cooldown_days,
  reassessment_requires_approval
)
values (
  'default',
  true,
  true,
  false,
  'club-rating-v5-production-pilot',
  1,
  7,
  true
)
on conflict (id) do update
set
  shadow_mode_enabled = excluded.shadow_mode_enabled,
  compare_v2_enabled = excluded.compare_v2_enabled,
  allow_v5_assessment = excluded.allow_v5_assessment,
  pilot_cohort_label = excluded.pilot_cohort_label,
  max_completed_assessments = excluded.max_completed_assessments,
  cooldown_days = excluded.cooldown_days,
  reassessment_requires_approval = excluded.reassessment_requires_approval,
  updated_at = now();

-- NOTE: rollout_cohort on profiles/assessments is metadata/traceability only — NOT used for auth.
