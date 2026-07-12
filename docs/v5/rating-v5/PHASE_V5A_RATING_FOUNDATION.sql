-- Phase V5-A.1 — Pick_VN Rating V5 Foundation (DRAFT — NOT APPLIED)
-- system_version: pick-vn-rating-v5
-- Chạy SAU: PHASE_30_PICK_VN_PLAYER_RATING.sql
-- KHÔNG apply Production | KHÔNG migrate V2 | KHÔNG xóa pick_vn_player_ratings

-- ─── Helpers ─────────────────────────────────────────────────────
create or replace function public.rating_v5_rating_in_range(p_value numeric)
returns boolean
language sql
immutable
as $$
  select p_value is null or (p_value >= 1.5 and p_value <= 6.0);
$$;

create or replace function public.rating_v5_deviation_non_negative(p_value numeric)
returns boolean
language sql
immutable
as $$
  select p_value is null or p_value >= 0;
$$;

create or replace function public.rating_v5_resolve_tenant_id()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant text;
begin
  if v_uid is null then
    return null;
  end if;
  select nullif(trim(p.venue_id::text), '')
    into v_tenant
  from public.profiles p
  where p.id = v_uid;
  if v_tenant is not null then
    return v_tenant;
  end if;
  return 'platform';
end;
$$;

create or replace function public.rating_v5_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
    or public.user_has_permission(p_permission);
$$;

create or replace function public.rating_v5_same_tenant(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
    or p_tenant_id = public.rating_v5_resolve_tenant_id();
$$;

-- ─── Permissions ─────────────────────────────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('rating_v5.view_own', 'rating_v5', 'view', 'Xem hồ sơ rating V5 của mình'),
  ('rating_v5.assess_self', 'rating_v5', 'assess', 'Tự đánh giá questionnaire V5'),
  ('rating_v5.submit_match', 'rating_v5', 'submit_match', 'Gửi kết quả trận (input only)'),
  ('rating_v5.confirm_match', 'rating_v5', 'confirm_match', 'Xác nhận trận giao lưu'),
  ('rating_v5.submit_evidence', 'rating_v5', 'submit_evidence', 'Gửi bằng chứng (court/coach)'),
  ('rating_v5.review_evidence', 'rating_v5', 'review', 'Duyệt bằng chứng / anomaly'),
  ('rating_v5.override', 'rating_v5', 'override', 'Override rating có audit'),
  ('rating_v5.view_any', 'rating_v5', 'view_any', 'Xem rating V5 mọi VĐV (admin)'),
  ('rating_v5.calibration_manage', 'rating_v5', 'calibration', 'Quản lý calibration version')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── Shadow / rollout config (no hard-coded user IDs) ────────────
create table if not exists public.rating_v5_rollout_config (
  id text primary key default 'default',
  shadow_mode_enabled boolean not null default true,
  pilot_cohort_label text not null default 'v5-shadow-pilot',
  allow_v5_assessment boolean not null default true,
  allow_v5_profile_write boolean not null default true,
  compare_v2_enabled boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.rating_v5_rollout_config (id)
values ('default')
on conflict (id) do nothing;

-- ─── Idempotency ─────────────────────────────────────────────────
create table if not exists public.rating_v5_idempotency (
  idempotency_key text not null,
  scope text not null,
  tenant_id text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (idempotency_key, scope, tenant_id)
);

create index if not exists rating_v5_idempotency_created_idx
  on public.rating_v5_idempotency (created_at desc);

-- ─── 18.1 player_rating_profiles ─────────────────────────────────
create table if not exists public.player_rating_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  rating_mode text not null check (rating_mode in ('singles', 'doubles')),
  is_shadow boolean not null default true,
  rollout_cohort text not null default 'v5-shadow-pilot',
  singles_assessment_status text not null default 'incomplete'
    check (singles_assessment_status in ('incomplete', 'draft', 'complete')),
  provisional_rating numeric(5, 3)
    check (public.rating_v5_rating_in_range(provisional_rating)),
  open_rating_mean numeric(5, 3)
    check (public.rating_v5_rating_in_range(open_rating_mean)),
  open_rating_deviation numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(open_rating_deviation)),
  verified_rating_mean numeric(5, 3)
    check (public.rating_v5_rating_in_range(verified_rating_mean)),
  verified_rating_deviation numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(verified_rating_deviation)),
  display_rating numeric(3, 1)
    check (public.rating_v5_rating_in_range(display_rating)),
  reliability_score integer not null default 0 check (reliability_score between 0 and 100),
  rating_status text not null default 'not_assessed'
    check (rating_status in (
      'not_assessed', 'self_assessed', 'provisional', 'projected', 'under_review',
      'court_assessed', 'coach_verified', 'match_calibrated', 'verified',
      'reliable', 'stable', 'overridden', 'suspended'
    )),
  evidence_level smallint not null default 0 check (evidence_level between 0 and 5),
  assessment_count integer not null default 0 check (assessment_count >= 0),
  open_match_count integer not null default 0 check (open_match_count >= 0),
  verified_match_count integer not null default 0 check (verified_match_count >= 0),
  last_rated_at timestamptz,
  engine_version text not null default 'pick-vn-rating-v5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, player_id, rating_mode)
);

create index if not exists player_rating_profiles_player_idx
  on public.player_rating_profiles (player_id, rating_mode);
create index if not exists player_rating_profiles_tenant_status_idx
  on public.player_rating_profiles (tenant_id, rating_status);
create index if not exists player_rating_profiles_leaderboard_idx
  on public.player_rating_profiles (tenant_id, rating_mode, display_rating desc, reliability_score desc)
  where rating_status not in ('suspended', 'not_assessed') and is_shadow = false;
create index if not exists player_rating_profiles_shadow_idx
  on public.player_rating_profiles (tenant_id, is_shadow, rollout_cohort);

-- Public-safe view (no deviation internals unless privileged)
create or replace view public.player_rating_profiles_public_v5
with (security_invoker = true)
as
select
  id,
  tenant_id,
  player_id,
  rating_mode,
  display_rating,
  rating_status,
  reliability_score,
  evidence_level,
  verified_match_count,
  last_rated_at,
  is_shadow
from public.player_rating_profiles
where rating_status not in ('suspended');

-- ─── 18.2 player_skill_assessments ───────────────────────────────
create table if not exists public.player_skill_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  rating_mode text not null check (rating_mode in ('singles', 'doubles')),
  assessment_status text not null default 'draft'
    check (assessment_status in ('draft', 'completed', 'cancelled')),
  is_shadow boolean not null default true,
  rollout_cohort text not null default 'v5-shadow-pilot',
  answers jsonb not null default '{}'::jsonb,
  item_scores jsonb not null default '{}'::jsonb,
  domain_scores jsonb not null default '{}'::jsonb,
  skill_vector jsonb not null default '{}'::jsonb,
  overall_skill numeric(5, 3)
    check (public.rating_v5_rating_in_range(overall_skill)),
  initial_mean numeric(5, 3)
    check (public.rating_v5_rating_in_range(initial_mean)),
  initial_deviation numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(initial_deviation)),
  provisional_rating numeric(5, 3)
    check (public.rating_v5_rating_in_range(provisional_rating)),
  confidence_score integer check (confidence_score between 0 and 100),
  estimated_error numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(estimated_error)),
  warning_flags jsonb not null default '[]'::jsonb,
  applied_gates jsonb not null default '[]'::jsonb,
  assessment_version text not null default 'assessment-v5.0',
  question_bank_version text not null default 'qbank-v5.0',
  scoring_engine_version text not null default 'scoring-v5.0',
  gate_version text not null default 'gates-v5.0',
  calibration_version text not null default 'calibration-v5.0',
  glossary_version text not null default 'glossary-v5.0',
  reliability_version text not null default 'reliability-v5.0',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assessment_status <> 'completed' or completed_at is not null)
);

create index if not exists player_skill_assessments_player_idx
  on public.player_skill_assessments (player_id, completed_at desc nulls last);
create index if not exists player_skill_assessments_tenant_draft_idx
  on public.player_skill_assessments (tenant_id, player_id, assessment_status)
  where assessment_status = 'draft';

-- ─── 18.3 player_rating_events (append-only) ───────────────────
create table if not exists public.player_rating_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  rating_mode text not null check (rating_mode in ('singles', 'doubles')),
  event_type text not null,
  source_type text not null,
  source_id text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'confirmed', 'rejected', 'hold')),
  evidence_level smallint not null default 0 check (evidence_level between 0 and 5),
  pre_rating_mean numeric(5, 3)
    check (public.rating_v5_rating_in_range(pre_rating_mean)),
  post_rating_mean numeric(5, 3)
    check (public.rating_v5_rating_in_range(post_rating_mean)),
  pre_deviation numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(pre_deviation)),
  post_deviation numeric(5, 3)
    check (public.rating_v5_deviation_non_negative(post_deviation)),
  expected_performance numeric(6, 4),
  actual_performance numeric(6, 4),
  rating_delta numeric(6, 4),
  reliability_before integer check (reliability_before between 0 and 100),
  reliability_after integer check (reliability_after between 0 and 100),
  engine_version text not null default 'match-v5.0',
  is_shadow boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists player_rating_events_player_idx
  on public.player_rating_events (player_id, created_at desc);
create index if not exists player_rating_events_tenant_idx
  on public.player_rating_events (tenant_id, created_at desc);
create index if not exists player_rating_events_source_idx
  on public.player_rating_events (source_type, source_id);
create unique index if not exists player_rating_events_idempotent_idx
  on public.player_rating_events (tenant_id, player_id, source_type, source_id, event_type)
  where source_id is not null;

create or replace function public.rating_v5_deny_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'player_rating_events is append-only; use compensating event';
end;
$$;

drop trigger if exists trg_rating_v5_events_no_update on public.player_rating_events;
create trigger trg_rating_v5_events_no_update
  before update or delete on public.player_rating_events
  for each row execute function public.rating_v5_deny_event_mutation();

-- ─── 18.4 rating_evidence ────────────────────────────────────────
create table if not exists public.rating_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  player_id uuid not null references public.profiles (id) on delete restrict,
  rating_mode text not null check (rating_mode in ('singles', 'doubles')),
  evidence_type text not null,
  evidence_level smallint not null default 0 check (evidence_level between 0 and 5),
  source_id text,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  verified_by uuid references public.profiles (id) on delete set null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  evidence_data jsonb not null default '{}'::jsonb,
  is_shadow boolean not null default true,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  check (evidence_level <= 3 or verification_status = 'approved')
);

create index if not exists rating_evidence_player_idx
  on public.rating_evidence (player_id, created_at desc);
create index if not exists rating_evidence_tenant_pending_idx
  on public.rating_evidence (tenant_id, verification_status)
  where verification_status = 'pending';

-- ─── 18.5 rating_snapshots ───────────────────────────────────────
create table if not exists public.rating_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  player_id uuid not null references public.profiles (id) on delete restrict,
  rating_mode text not null,
  snapshot_at timestamptz not null default now(),
  profile_snapshot jsonb not null,
  reason text not null default 'periodic',
  engine_version text not null default 'pick-vn-rating-v5',
  is_shadow boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rating_snapshots_player_time_idx
  on public.rating_snapshots (player_id, snapshot_at desc);

-- ─── 18.6 rating_review_cases ────────────────────────────────────
create table if not exists public.rating_review_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  player_id uuid references public.profiles (id) on delete set null,
  case_type text not null,
  status text not null default 'open' check (status in ('open', 'hold', 'resolved', 'dismissed')),
  anomaly_flags jsonb not null default '[]'::jsonb,
  related_event_ids uuid[] not null default '{}',
  assigned_to uuid references public.profiles (id) on delete set null,
  resolution_note text not null default '',
  is_shadow boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists rating_review_cases_tenant_status_idx
  on public.rating_review_cases (tenant_id, status);

-- ─── 18.7 rating_calibration_versions ────────────────────────────
create table if not exists public.rating_calibration_versions (
  version text primary key,
  engine_scope text not null default 'pick-vn-rating-v5',
  status text not null default 'draft' check (status in ('draft', 'pilot', 'approved', 'retired')),
  parameters jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  sample_size integer not null default 0 check (sample_size >= 0),
  validation_metrics jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists rating_calibration_one_active_per_scope
  on public.rating_calibration_versions (engine_scope)
  where status in ('pilot', 'approved') and effective_to is null;

insert into public.rating_calibration_versions (version, engine_scope, status, parameters)
values (
  'calibration-v5.0',
  'pick-vn-rating-v5',
  'draft',
  jsonb_build_object(
    'domainWeights', 'doubles-v5.0',
    'reliabilityWeights', 'reliability-v5.0',
    'questionnaireMaeTarget', 0.25
  )
)
on conflict (version) do nothing;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.rating_v5_rollout_config enable row level security;
alter table public.rating_v5_idempotency enable row level security;
alter table public.player_rating_profiles enable row level security;
alter table public.player_skill_assessments enable row level security;
alter table public.player_rating_events enable row level security;
alter table public.rating_evidence enable row level security;
alter table public.rating_snapshots enable row level security;
alter table public.rating_review_cases enable row level security;
alter table public.rating_calibration_versions enable row level security;

-- Rollout config: read authenticated; write technician only
create policy rating_v5_rollout_select
  on public.rating_v5_rollout_config for select to authenticated
  using (true);

create policy rating_v5_rollout_manage
  on public.rating_v5_rollout_config for all
  using (public.rating_v5_has_permission('rating_v5.calibration_manage'))
  with check (public.rating_v5_has_permission('rating_v5.calibration_manage'));

-- Idempotency: no direct client access
create policy rating_v5_idempotency_deny
  on public.rating_v5_idempotency for all
  using (false) with check (false);

-- Profiles
create policy rating_v5_profiles_select_self
  on public.player_rating_profiles for select
  using (auth.uid() = player_id and public.rating_v5_same_tenant(tenant_id));

create policy rating_v5_profiles_select_reviewer
  on public.player_rating_profiles for select
  using (
    public.rating_v5_same_tenant(tenant_id)
    and public.rating_v5_has_permission('rating_v5.view_any')
  );

create policy rating_v5_profiles_no_direct_write
  on public.player_rating_profiles for insert to authenticated
  with check (false);

create policy rating_v5_profiles_no_direct_update
  on public.player_rating_profiles for update to authenticated
  using (false);

create policy rating_v5_profiles_no_direct_delete
  on public.player_rating_profiles for delete to authenticated
  using (false);

-- Assessments
create policy rating_v5_assessments_select_self
  on public.player_skill_assessments for select
  using (auth.uid() = player_id and public.rating_v5_same_tenant(tenant_id));

create policy rating_v5_assessments_select_reviewer
  on public.player_skill_assessments for select
  using (
    public.rating_v5_same_tenant(tenant_id)
    and public.rating_v5_has_permission('rating_v5.view_any')
  );

create policy rating_v5_assessments_insert_draft_self
  on public.player_skill_assessments for insert
  with check (
    auth.uid() = player_id
    and tenant_id = public.rating_v5_resolve_tenant_id()
    and assessment_status = 'draft'
    and provisional_rating is null
    and initial_mean is null
    and overall_skill is null
    and skill_vector = '{}'::jsonb
    and domain_scores = '{}'::jsonb
    and is_shadow = true
  );

create policy rating_v5_assessments_update_draft_self
  on public.player_skill_assessments for update
  using (
    auth.uid() = player_id
    and assessment_status = 'draft'
    and public.rating_v5_same_tenant(tenant_id)
  )
  with check (
    auth.uid() = player_id
    and assessment_status = 'draft'
    and provisional_rating is null
    and initial_mean is null
    and overall_skill is null
    and skill_vector = '{}'::jsonb
  );

-- Events: append-only
create policy rating_v5_events_select_self
  on public.player_rating_events for select
  using (auth.uid() = player_id and public.rating_v5_same_tenant(tenant_id));

create policy rating_v5_events_select_reviewer
  on public.player_rating_events for select
  using (
    public.rating_v5_same_tenant(tenant_id)
    and public.rating_v5_has_permission('rating_v5.view_any')
  );

create policy rating_v5_events_no_insert
  on public.player_rating_events for insert to authenticated
  with check (false);

create policy rating_v5_events_no_update
  on public.player_rating_events for update to authenticated
  using (false);

create policy rating_v5_events_no_delete
  on public.player_rating_events for delete to authenticated
  using (false);

-- Evidence
create policy rating_v5_evidence_select_self
  on public.rating_evidence for select
  using (auth.uid() = player_id and public.rating_v5_same_tenant(tenant_id));

create policy rating_v5_evidence_insert_self
  on public.rating_evidence for insert
  with check (
    auth.uid() = submitted_by
    and auth.uid() = player_id
    and tenant_id = public.rating_v5_resolve_tenant_id()
    and verification_status = 'pending'
    and verified_by is null
    and evidence_level <= 3
    and is_shadow = true
  );

create policy rating_v5_evidence_no_self_verify
  on public.rating_evidence for update to authenticated
  using (false);

-- Snapshots: backend only
create policy rating_v5_snapshots_deny_client
  on public.rating_snapshots for all to authenticated
  using (false) with check (false);

-- Review cases
create policy rating_v5_review_select_self
  on public.rating_review_cases for select
  using (auth.uid() = player_id and public.rating_v5_same_tenant(tenant_id));

create policy rating_v5_review_select_reviewer
  on public.rating_review_cases for select
  using (
    public.rating_v5_same_tenant(tenant_id)
    and public.rating_v5_has_permission('rating_v5.review_evidence')
  );

create policy rating_v5_review_no_client_write
  on public.rating_review_cases for all to authenticated
  with check (false);

-- Calibration
create policy rating_v5_calibration_read
  on public.rating_calibration_versions for select
  using (status in ('pilot', 'approved') or public.rating_v5_has_permission('rating_v5.calibration_manage'));

create policy rating_v5_calibration_write
  on public.rating_calibration_versions for all
  using (public.rating_v5_has_permission('rating_v5.calibration_manage'))
  with check (public.rating_v5_has_permission('rating_v5.calibration_manage'));

-- ─── RPC (SECURITY DEFINER, search_path hardened) ───────────────
create or replace function public.rating_v5_submit_answer(
  p_assessment_id uuid,
  p_question_id text,
  p_answer_index smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.player_skill_assessments%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if p_answer_index < 0 or p_answer_index > 7 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_ANSWER');
  end if;

  select * into v_row
  from public.player_skill_assessments
  where id = p_assessment_id
    and player_id = v_uid
    and assessment_status = 'draft';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ASSESSMENT_NOT_FOUND');
  end if;

  update public.player_skill_assessments
  set
    answers = answers || jsonb_build_object(p_question_id, p_answer_index),
    updated_at = now()
  where id = p_assessment_id;

  return jsonb_build_object('ok', true, 'code', 'ANSWER_STORED', 'assessmentId', p_assessment_id);
end;
$$;

create or replace function public.rating_v5_get_profile(
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
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;
  if p_rating_mode not in ('singles', 'doubles') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MODE');
  end if;

  return coalesce(
    (
      select jsonb_build_object('ok', true, 'profile', to_jsonb(p.*))
      from public.player_rating_profiles p
      where p.player_id = v_uid
        and p.rating_mode = p_rating_mode
        and p.tenant_id = v_tenant
      limit 1
    ),
    jsonb_build_object('ok', true, 'profile', null)
  );
end;
$$;

revoke all on public.player_rating_profiles from anon;
revoke all on public.player_skill_assessments from anon;
revoke all on public.player_rating_events from anon;
revoke all on public.rating_evidence from anon;
revoke all on public.rating_snapshots from anon;
revoke all on public.rating_review_cases from anon;
revoke all on public.rating_v5_idempotency from anon, authenticated;

grant select on public.player_rating_profiles_public_v5 to authenticated;
grant execute on function public.rating_v5_submit_answer(uuid, text, smallint) to authenticated;
grant execute on function public.rating_v5_get_profile(text) to authenticated;

-- ─── Role permission seeds ───────────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id = 'PLAYER'
  and p.id in ('rating_v5.view_own', 'rating_v5.assess_self', 'rating_v5.submit_match', 'rating_v5.confirm_match', 'rating_v5.submit_evidence')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('CLUB_MANAGER', 'CLUB_OWNER', 'VENUE_MANAGER')
  and p.id in ('rating_v5.view_any', 'rating_v5.review_evidence', 'rating_v5.submit_evidence')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('TOURNAMENT_MANAGER', 'REFEREE')
  and p.id in ('rating_v5.view_any', 'rating_v5.review_evidence', 'rating_v5.confirm_match')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('SUPER_ADMIN', 'SYSTEM_TECHNICIAN')
  and p.id in (
    'rating_v5.view_own', 'rating_v5.view_any', 'rating_v5.assess_self',
    'rating_v5.review_evidence', 'rating_v5.override', 'rating_v5.calibration_manage'
  )
on conflict do nothing;

-- ─── Start assessment (draft, shadow, tenant from server) ────────
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
  v_id uuid;
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

  insert into public.player_skill_assessments (
    tenant_id, player_id, rating_mode, assessment_status, is_shadow, rollout_cohort
  ) values (
    v_tenant, v_uid, p_rating_mode, 'draft', true, 'v5-shadow-pilot'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'assessmentId', v_id, 'shadow', true);
end;
$$;

-- ─── Service-only profile upsert (RPC engines) ───────────────────
create or replace function public.rating_v5_service_upsert_profile(
  p_player_id uuid,
  p_rating_mode text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant text := public.rating_v5_resolve_tenant_id();
  v_row public.player_rating_profiles%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role'
     and not public.rating_v5_has_permission('rating_v5.override') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  insert into public.player_rating_profiles (
    tenant_id, player_id, rating_mode, is_shadow, rollout_cohort, singles_assessment_status
  ) values (
    coalesce(p_patch->>'tenantId', v_tenant),
    p_player_id,
    p_rating_mode,
    coalesce((p_patch->>'isShadow')::boolean, true),
    coalesce(p_patch->>'rolloutCohort', 'v5-shadow-pilot'),
    'incomplete'
  )
  on conflict (tenant_id, player_id, rating_mode) do update
  set updated_at = now()
  returning * into v_row;

  return jsonb_build_object('ok', true, 'profileId', v_row.id);
end;
$$;

revoke all on function public.rating_v5_service_upsert_profile(uuid, text, jsonb) from public;
grant execute on function public.rating_v5_start_assessment(text) to authenticated;
grant execute on function public.rating_v5_service_upsert_profile(uuid, text, jsonb) to service_role;

-- ─── Rollback plan (manual) ──────────────────────────────────────
-- See docs/v5/rating-v5/V5-A1_MIGRATION_REVIEW.md
