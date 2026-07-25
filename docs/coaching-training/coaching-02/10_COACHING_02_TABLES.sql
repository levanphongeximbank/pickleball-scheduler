-- =============================================================================
-- COACHING-02 — Canonical tables and constraints
-- Purpose: Durable relational persistence for Coaching & Training aggregates
--          owned by COACHING-01. Typed references only to Identity / Player /
--          Club / Venue / Court / Finance — no FK into those modules.
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to local/staging/production in COACHING-02.
-- Convention: mirrors CUSTOMER-03 numbered pack. No secrets. No Production IDs.
-- Phase 28 (docs/v5/PHASE_28_COACHING.sql) is NOT the canonical apply source.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. coaching_programs
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_programs (
  program_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  name text NOT NULL,
  description text NULL,
  curriculum_id text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_programs_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_programs_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_programs_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT coaching_programs_status_chk
    CHECK (status IN ('draft', 'active', 'suspended', 'completed', 'archived')),
  CONSTRAINT coaching_programs_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_programs_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_programs_tenant_club_program_uq UNIQUE (tenant_id, club_id, program_id)
);

COMMENT ON TABLE public.coaching_programs IS
  'COACHING-02 program aggregate root. Scoped by tenant_id + club_id. Soft archive via status=archived.';

-- -----------------------------------------------------------------------------
-- 2. coaching_coach_references (typed Identity refs — not coach profile SoT)
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_coach_references (
  coach_reference_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  coach_principal_id text NOT NULL,
  coach_membership_id text NULL,
  display_label text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_coach_references_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_coach_references_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_coach_references_principal_nonempty CHECK (length(trim(coach_principal_id)) > 0),
  CONSTRAINT coaching_coach_references_status_chk CHECK (status IN ('active', 'inactive')),
  CONSTRAINT coaching_coach_references_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_coach_references_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_coach_references_tenant_club_id_uq UNIQUE (tenant_id, club_id, coach_reference_id),
  CONSTRAINT coaching_coach_references_tenant_club_principal_uq
    UNIQUE (tenant_id, club_id, coach_principal_id)
);

COMMENT ON TABLE public.coaching_coach_references IS
  'COACHING-02 typed coach reference. Does not store Identity profile; coach_principal_id / coach_membership_id are deferred RI boundaries.';

-- -----------------------------------------------------------------------------
-- 3. coaching_coach_player_relationships
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_coach_player_relationships (
  relationship_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  coach_reference_id text NOT NULL,
  player_id text NOT NULL,
  program_id text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_cpr_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_cpr_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_cpr_coach_ref_nonempty CHECK (length(trim(coach_reference_id)) > 0),
  CONSTRAINT coaching_cpr_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_cpr_status_chk CHECK (status IN ('active', 'inactive')),
  CONSTRAINT coaching_cpr_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_cpr_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_cpr_tenant_club_id_uq UNIQUE (tenant_id, club_id, relationship_id),
  CONSTRAINT coaching_cpr_tenant_club_coach_player_program_uq
    UNIQUE (tenant_id, club_id, coach_reference_id, player_id, program_id)
);

COMMENT ON TABLE public.coaching_coach_player_relationships IS
  'COACHING-02 coach–player relationship. player_id is a typed Player reference (deferred RI).';

-- -----------------------------------------------------------------------------
-- 4. coaching_enrollments
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_enrollments (
  enrollment_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  program_id text NOT NULL,
  player_id text NOT NULL,
  coach_reference_id text NULL,
  package_id text NULL,
  entitlement_id text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_enrollments_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_enrollments_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_enrollments_program_id_nonempty CHECK (length(trim(program_id)) > 0),
  CONSTRAINT coaching_enrollments_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_enrollments_status_chk
    CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled')),
  CONSTRAINT coaching_enrollments_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_enrollments_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_enrollments_tenant_club_id_uq UNIQUE (tenant_id, club_id, enrollment_id),
  CONSTRAINT coaching_enrollments_tenant_club_program_player_uq
    UNIQUE (tenant_id, club_id, program_id, player_id)
);

-- -----------------------------------------------------------------------------
-- 5. coaching_curricula
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_curricula (
  curriculum_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  program_id text NULL,
  name text NOT NULL,
  description text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_curricula_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_curricula_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_curricula_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT coaching_curricula_status_chk CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT coaching_curricula_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_curricula_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_curricula_tenant_club_id_uq UNIQUE (tenant_id, club_id, curriculum_id)
);

-- -----------------------------------------------------------------------------
-- 6. coaching_lessons
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_lessons (
  lesson_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  curriculum_id text NOT NULL,
  title text NOT NULL,
  sequence integer NOT NULL,
  objectives text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_lessons_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_lessons_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_lessons_curriculum_id_nonempty CHECK (length(trim(curriculum_id)) > 0),
  CONSTRAINT coaching_lessons_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT coaching_lessons_sequence_positive CHECK (sequence >= 1),
  CONSTRAINT coaching_lessons_status_chk CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT coaching_lessons_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_lessons_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_lessons_tenant_club_id_uq UNIQUE (tenant_id, club_id, lesson_id),
  CONSTRAINT coaching_lessons_tenant_club_curriculum_sequence_uq
    UNIQUE (tenant_id, club_id, curriculum_id, sequence)
);

-- -----------------------------------------------------------------------------
-- 7. coaching_training_sessions
-- Schedule is an embedded value object (COACHING-01), not a separate table.
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_training_sessions (
  session_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  program_id text NOT NULL,
  lesson_id text NULL,
  coach_reference_id text NULL,
  enrollment_id text NULL,
  status text NOT NULL,
  schedule_starts_at timestamptz NULL,
  schedule_ends_at timestamptz NULL,
  schedule_venue_id text NULL,
  schedule_court_id text NULL,
  schedule_timezone text NULL,
  notes text NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_sessions_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_sessions_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_sessions_program_id_nonempty CHECK (length(trim(program_id)) > 0),
  CONSTRAINT coaching_sessions_status_chk
    CHECK (status IN ('draft', 'scheduled', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT coaching_sessions_schedule_window_chk
    CHECK (
      schedule_starts_at IS NULL
      OR schedule_ends_at IS NULL
      OR schedule_ends_at > schedule_starts_at
    ),
  CONSTRAINT coaching_sessions_scheduled_requires_window_chk
    CHECK (
      status NOT IN ('scheduled', 'confirmed')
      OR (schedule_starts_at IS NOT NULL AND schedule_ends_at IS NOT NULL)
    ),
  CONSTRAINT coaching_sessions_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_sessions_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_sessions_tenant_club_id_uq UNIQUE (tenant_id, club_id, session_id)
);

COMMENT ON COLUMN public.coaching_training_sessions.schedule_court_id IS
  'Typed Court reference only — Venue/Court owns availability (deferred RI).';

-- -----------------------------------------------------------------------------
-- 8. coaching_attendance_records
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_attendance_records (
  attendance_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  session_id text NOT NULL,
  player_id text NOT NULL,
  enrollment_id text NULL,
  status text NOT NULL,
  recorded_by_actor_id text NULL,
  notes text NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_attendance_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_attendance_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_attendance_session_id_nonempty CHECK (length(trim(session_id)) > 0),
  CONSTRAINT coaching_attendance_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_attendance_status_chk
    CHECK (status IN ('absent', 'present', 'late', 'excused')),
  CONSTRAINT coaching_attendance_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_attendance_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_attendance_tenant_club_id_uq UNIQUE (tenant_id, club_id, attendance_id),
  CONSTRAINT coaching_attendance_tenant_club_session_player_uq
    UNIQUE (tenant_id, club_id, session_id, player_id)
);

-- -----------------------------------------------------------------------------
-- 9. coaching_attendance_corrections (APPEND-ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_attendance_corrections (
  correction_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  attendance_id text NOT NULL,
  previous_status text NOT NULL,
  corrected_status text NOT NULL,
  reason text NOT NULL,
  actor_id text NOT NULL,
  corrected_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT coaching_acorr_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_acorr_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_acorr_attendance_id_nonempty CHECK (length(trim(attendance_id)) > 0),
  CONSTRAINT coaching_acorr_reason_nonempty CHECK (length(trim(reason)) > 0),
  CONSTRAINT coaching_acorr_actor_id_nonempty CHECK (length(trim(actor_id)) > 0),
  CONSTRAINT coaching_acorr_previous_status_chk
    CHECK (previous_status IN ('absent', 'present', 'late', 'excused')),
  CONSTRAINT coaching_acorr_corrected_status_chk
    CHECK (corrected_status IN ('absent', 'present', 'late', 'excused')),
  CONSTRAINT coaching_acorr_status_changed_chk CHECK (previous_status <> corrected_status),
  CONSTRAINT coaching_acorr_version_fixed CHECK (version = 1),
  CONSTRAINT coaching_acorr_tenant_club_id_uq UNIQUE (tenant_id, club_id, correction_id)
);

COMMENT ON TABLE public.coaching_attendance_corrections IS
  'COACHING-02 append-only attendance correction history. No client UPDATE/DELETE.';

-- -----------------------------------------------------------------------------
-- 10. coaching_packages (definition — no Finance price SoT)
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_packages (
  package_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  name text NOT NULL,
  description text NULL,
  session_entitlement integer NOT NULL,
  validity_days integer NULL,
  external_payment_reference text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_packages_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_packages_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_packages_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT coaching_packages_session_entitlement_positive CHECK (session_entitlement >= 1),
  CONSTRAINT coaching_packages_validity_days_positive
    CHECK (validity_days IS NULL OR validity_days >= 1),
  CONSTRAINT coaching_packages_status_chk
    CHECK (status IN ('draft', 'active', 'expired', 'archived')),
  CONSTRAINT coaching_packages_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_packages_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_packages_tenant_club_id_uq UNIQUE (tenant_id, club_id, package_id)
);

COMMENT ON COLUMN public.coaching_packages.external_payment_reference IS
  'Optional Finance reference only — invoice/payment/refund owned by Finance (deferred RI).';

-- -----------------------------------------------------------------------------
-- 11. coaching_package_entitlements
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_package_entitlements (
  entitlement_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  package_id text NOT NULL,
  player_id text NOT NULL,
  enrollment_id text NULL,
  sessions_granted integer NOT NULL,
  sessions_consumed integer NOT NULL DEFAULT 0,
  sessions_remaining integer NOT NULL,
  valid_from timestamptz NULL,
  valid_to timestamptz NULL,
  external_payment_reference text NULL,
  status text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_entitlements_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_entitlements_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_entitlements_package_id_nonempty CHECK (length(trim(package_id)) > 0),
  CONSTRAINT coaching_entitlements_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_entitlements_granted_positive CHECK (sessions_granted >= 1),
  CONSTRAINT coaching_entitlements_consumed_nonneg CHECK (sessions_consumed >= 0),
  CONSTRAINT coaching_entitlements_remaining_nonneg CHECK (sessions_remaining >= 0),
  CONSTRAINT coaching_entitlements_math_chk
    CHECK (sessions_remaining = sessions_granted - sessions_consumed),
  CONSTRAINT coaching_entitlements_consumed_lte_granted_chk
    CHECK (sessions_consumed <= sessions_granted),
  CONSTRAINT coaching_entitlements_validity_window_chk
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT coaching_entitlements_status_chk
    CHECK (status IN ('active', 'inactive', 'exhausted', 'cancelled', 'expired')),
  CONSTRAINT coaching_entitlements_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_entitlements_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_entitlements_tenant_club_id_uq UNIQUE (tenant_id, club_id, entitlement_id)
);

-- -----------------------------------------------------------------------------
-- 12. coaching_package_usage_events (APPEND-ONLY consumption ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_package_usage_events (
  usage_event_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  entitlement_id text NOT NULL,
  package_id text NOT NULL,
  player_id text NOT NULL,
  sessions_delta integer NOT NULL DEFAULT 1,
  remaining_after integer NOT NULL,
  idempotency_key text NOT NULL,
  actor_id text NULL,
  consumed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT coaching_usage_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_usage_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_usage_entitlement_id_nonempty CHECK (length(trim(entitlement_id)) > 0),
  CONSTRAINT coaching_usage_package_id_nonempty CHECK (length(trim(package_id)) > 0),
  CONSTRAINT coaching_usage_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_usage_idempotency_nonempty CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT coaching_usage_sessions_delta_positive CHECK (sessions_delta >= 1),
  CONSTRAINT coaching_usage_remaining_after_nonneg CHECK (remaining_after >= 0),
  CONSTRAINT coaching_usage_version_fixed CHECK (version = 1),
  CONSTRAINT coaching_usage_tenant_club_id_uq UNIQUE (tenant_id, club_id, usage_event_id),
  CONSTRAINT coaching_usage_tenant_club_idempotency_uq UNIQUE (tenant_id, club_id, idempotency_key)
);

COMMENT ON TABLE public.coaching_package_usage_events IS
  'COACHING-02 append-only package consumption ledger. Idempotent via (tenant_id, club_id, idempotency_key).';

-- -----------------------------------------------------------------------------
-- 13. coaching_evaluations (revisions = new rows via revises_evaluation_id)
-- -----------------------------------------------------------------------------
CREATE TABLE public.coaching_evaluations (
  evaluation_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  club_id text NOT NULL,
  venue_id text NULL,
  player_id text NOT NULL,
  coach_reference_id text NULL,
  session_id text NULL,
  program_id text NULL,
  summary text NULL,
  rating numeric(4, 2) NULL,
  revises_evaluation_id text NULL,
  status text NOT NULL,
  submitted_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT coaching_evaluations_tenant_id_nonempty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT coaching_evaluations_club_id_nonempty CHECK (length(trim(club_id)) > 0),
  CONSTRAINT coaching_evaluations_player_id_nonempty CHECK (length(trim(player_id)) > 0),
  CONSTRAINT coaching_evaluations_status_chk CHECK (status IN ('draft', 'submitted')),
  CONSTRAINT coaching_evaluations_rating_range_chk
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  CONSTRAINT coaching_evaluations_submitted_requires_summary_chk
    CHECK (status <> 'submitted' OR (summary IS NOT NULL AND length(trim(summary)) > 0)),
  CONSTRAINT coaching_evaluations_submitted_requires_submitted_at_chk
    CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CONSTRAINT coaching_evaluations_version_positive CHECK (version >= 1),
  CONSTRAINT coaching_evaluations_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT coaching_evaluations_tenant_club_id_uq UNIQUE (tenant_id, club_id, evaluation_id)
);

COMMENT ON TABLE public.coaching_evaluations IS
  'COACHING-02 evaluations. Submitted rows are immutable; revisions are new rows linked by revises_evaluation_id. Does not own Player Rating.';
