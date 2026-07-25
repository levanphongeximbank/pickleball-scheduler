-- =============================================================================
-- COACHING-02 — Indexes for tenant/club scoped reads
-- Status: AUTHORED ONLY — do not apply in COACHING-02.
-- =============================================================================

SET search_path = public, pg_temp;

CREATE INDEX coaching_programs_tenant_club_idx
  ON public.coaching_programs (tenant_id, club_id);

CREATE INDEX coaching_programs_tenant_club_status_idx
  ON public.coaching_programs (tenant_id, club_id, status);

CREATE INDEX coaching_coach_references_tenant_club_idx
  ON public.coaching_coach_references (tenant_id, club_id);

CREATE INDEX coaching_cpr_tenant_club_idx
  ON public.coaching_coach_player_relationships (tenant_id, club_id);

CREATE INDEX coaching_cpr_tenant_club_player_idx
  ON public.coaching_coach_player_relationships (tenant_id, club_id, player_id);

CREATE INDEX coaching_enrollments_tenant_club_idx
  ON public.coaching_enrollments (tenant_id, club_id);

CREATE INDEX coaching_enrollments_tenant_club_program_idx
  ON public.coaching_enrollments (tenant_id, club_id, program_id);

CREATE INDEX coaching_curricula_tenant_club_idx
  ON public.coaching_curricula (tenant_id, club_id);

CREATE INDEX coaching_lessons_tenant_club_curriculum_idx
  ON public.coaching_lessons (tenant_id, club_id, curriculum_id);

CREATE INDEX coaching_sessions_tenant_club_idx
  ON public.coaching_training_sessions (tenant_id, club_id);

CREATE INDEX coaching_sessions_tenant_club_starts_idx
  ON public.coaching_training_sessions (tenant_id, club_id, schedule_starts_at);

CREATE INDEX coaching_attendance_tenant_club_idx
  ON public.coaching_attendance_records (tenant_id, club_id);

CREATE INDEX coaching_attendance_tenant_club_session_idx
  ON public.coaching_attendance_records (tenant_id, club_id, session_id);

CREATE INDEX coaching_acorr_tenant_club_attendance_idx
  ON public.coaching_attendance_corrections (tenant_id, club_id, attendance_id);

CREATE INDEX coaching_packages_tenant_club_idx
  ON public.coaching_packages (tenant_id, club_id);

CREATE INDEX coaching_entitlements_tenant_club_idx
  ON public.coaching_package_entitlements (tenant_id, club_id);

CREATE INDEX coaching_entitlements_tenant_club_player_idx
  ON public.coaching_package_entitlements (tenant_id, club_id, player_id);

CREATE INDEX coaching_usage_tenant_club_entitlement_idx
  ON public.coaching_package_usage_events (tenant_id, club_id, entitlement_id);

CREATE INDEX coaching_evaluations_tenant_club_idx
  ON public.coaching_evaluations (tenant_id, club_id);

CREATE INDEX coaching_evaluations_tenant_club_player_idx
  ON public.coaching_evaluations (tenant_id, club_id, player_id);
