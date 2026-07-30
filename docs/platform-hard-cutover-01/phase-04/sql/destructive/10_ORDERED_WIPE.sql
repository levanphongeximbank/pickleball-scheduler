-- PLATFORM-HARD-CUTOVER-01 Phase 4 — Ordered business-data wipe
-- Exact tables from Phase 3 §5 + Owner-approved FK closure (+6).
-- No wildcard. No TRUNCATE ALL public. Multi-table TRUNCATE only (RESTRICT).
-- NEVER touch: auth.users, profiles, venues, tenant_members,
--   roles, permissions, role_permissions, plans, plan_limits.
-- Prerequisites: 00_IDENTITY_PRESERVE_PRECHECK + 01_PROTECTED_OBJECT_GUARDS PASS.
-- Owner GO required. NOT executed by this PR.

BEGIN;

-- Capture protected fingerprints for post-check
CREATE TEMP TABLE hard_cutover_protect_snap AS
SELECT
  (SELECT count(*) FROM auth.users) AS auth_n,
  (SELECT count(*) FROM public.profiles) AS profiles_n,
  (SELECT count(*) FROM public.venues) AS venues_n,
  (SELECT count(*) FROM public.tenant_members) AS tm_n,
  (SELECT count(*) FROM public.roles) AS roles_n,
  (SELECT count(*) FROM public.permissions) AS permissions_n,
  (SELECT count(*) FROM public.role_permissions) AS rp_n,
  (SELECT count(*) FROM public.plans) AS plans_n,
  (SELECT count(*) FROM public.plan_limits) AS plan_limits_n;

-- W1 Team Tournament + referee bridge (single FK connected component; RESTRICT)
TRUNCATE TABLE
  public.referee_device_sessions,
  public.referee_assignments,
  public.team_sub_match_referee_links,
  public.team_tournament_referee_correction_requests,
  public.team_tournament_referee_event_inbox,
  public.team_tournament_lineup_entries,
  public.team_tournament_lineup_revisions,
  public.team_tournament_lineups,
  public.team_tournament_dreambreaker_states,
  public.team_tournament_forfeit_events,
  public.team_tournament_sub_matches,
  public.team_tournament_matchups,
  public.team_tournament_standings,
  public.team_tournament_team_members,
  public.team_tournament_teams,
  public.team_tournament_groups,
  public.team_tournament_disciplines,
  public.team_tournament_setup_snapshots,
  public.team_tournaments;

TRUNCATE TABLE public.team_tournament_sync_mismatch;
TRUNCATE TABLE public.team_tournament_command_log;
TRUNCATE TABLE public.team_tournament_audit_logs;

-- W2 Rating / VPR / pairing / AI / notif / payments / catalog biz
TRUNCATE TABLE
  public.rating_v5_reassessment_approvals,
  public.player_rating_profiles,
  public.player_rating_events,
  public.player_skill_assessments;
TRUNCATE TABLE public.rating_v5_pilot_enrollments;
TRUNCATE TABLE public.rating_v5_idempotency;
TRUNCATE TABLE public.rating_snapshots;
TRUNCATE TABLE public.rating_review_cases;
TRUNCATE TABLE public.rating_evidence;
TRUNCATE TABLE public.pick_vn_player_ratings;
-- Keep rating_v5_rollout_config + rating_calibration_versions structure;
-- wipe rows then require reseed in 40_RESEED (Owner may keep config row).
DELETE FROM public.rating_calibration_versions;
DELETE FROM public.rating_v5_rollout_config;

TRUNCATE TABLE public.vpr_point_ledger;
TRUNCATE TABLE public.vpr_leaderboard;
TRUNCATE TABLE public.vpr_audit_logs;
TRUNCATE TABLE public.vpr_athlete_links;
TRUNCATE TABLE public.vpr_athletes;
TRUNCATE TABLE public.vpr_point_config;

TRUNCATE TABLE
  public.private_pairing_rule_targets,
  public.private_pairing_rules,
  public.private_pairing_rule_sets;
TRUNCATE TABLE public.private_pairing_rule_audit_logs;

TRUNCATE TABLE public.ai_suggestions;
TRUNCATE TABLE public.ai_workflow_checklists;
TRUNCATE TABLE public.notifications;
TRUNCATE TABLE public.notification_logs;
TRUNCATE TABLE public.push_subscriptions;
TRUNCATE TABLE public.qr_tokens;
TRUNCATE TABLE public.checkins;

TRUNCATE TABLE public.payment_events;
TRUNCATE TABLE public.payment_transactions;
TRUNCATE TABLE
  public.payments,
  public.invoice_items,
  public.invoices;
TRUNCATE TABLE public.billing_events;
TRUNCATE TABLE public.billing_audit_logs;
TRUNCATE TABLE public.marketplace_orders;
TRUNCATE TABLE public.marketplace_products;
TRUNCATE TABLE public.webhook_events;
TRUNCATE TABLE public.webhook_endpoints;
TRUNCATE TABLE public.tenant_integration_settings;
TRUNCATE TABLE public.integration_audit_logs;
TRUNCATE TABLE public.api_logs;
TRUNCATE TABLE
  public.api_keys,
  public.api_clients;
TRUNCATE TABLE public.idempotency_requests;
TRUNCATE TABLE public.tournament_certifications;
TRUNCATE TABLE public.tournament_match_live;
TRUNCATE TABLE public.password_reset_tokens;
TRUNCATE TABLE public._phase19b_test_accounts;
TRUNCATE TABLE public.subscriptions;
TRUNCATE TABLE public.public_catalog_rankings;
TRUNCATE TABLE public.public_catalog_tournaments;
TRUNCATE TABLE public.public_catalog_courts;

-- W3 Court / club / athlete (+ player_identity_links before clubs DELETE)
TRUNCATE TABLE public.court_engine_active_sessions;
TRUNCATE TABLE public.court_engine_stores;
TRUNCATE TABLE public.court_claim_requests;
TRUNCATE TABLE public.user_cluster_assignments;
TRUNCATE TABLE
  public.club_governance_assignments,
  public.club_members,
  public.athletes;
TRUNCATE TABLE public.club_membership_requests_v42;
TRUNCATE TABLE
  public.club_membership_requests,
  public.club_governance;
TRUNCATE TABLE public.player_identity_links;
DELETE FROM public.club_data_v3;
DELETE FROM public.clubs;
DELETE FROM public.court_clusters;

-- W4 Billing subscription biz (keep plans catalog)
DELETE FROM public.tenant_subscriptions;

-- W5 Audit history (Owner-accepted biz loss). Schema retained.
TRUNCATE TABLE public.audit_logs;

-- Fail-fast: protected counts must match snapshot
DO $$
DECLARE
  s RECORD;
  v_auth bigint;
  v_profiles bigint;
  v_venues bigint;
  v_tm bigint;
  v_roles bigint;
  v_perms bigint;
  v_rp bigint;
  v_plans bigint;
  v_limits bigint;
BEGIN
  SELECT * INTO s FROM hard_cutover_protect_snap LIMIT 1;
  SELECT count(*) INTO v_auth FROM auth.users;
  SELECT count(*) INTO v_profiles FROM public.profiles;
  SELECT count(*) INTO v_venues FROM public.venues;
  SELECT count(*) INTO v_tm FROM public.tenant_members;
  SELECT count(*) INTO v_roles FROM public.roles;
  SELECT count(*) INTO v_perms FROM public.permissions;
  SELECT count(*) INTO v_rp FROM public.role_permissions;
  SELECT count(*) INTO v_plans FROM public.plans;
  SELECT count(*) INTO v_limits FROM public.plan_limits;

  IF v_auth <> s.auth_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: auth.users mutated (% -> %)', s.auth_n, v_auth;
  END IF;
  IF v_profiles <> s.profiles_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: profiles mutated (% -> %)', s.profiles_n, v_profiles;
  END IF;
  IF v_venues <> s.venues_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: venues mutated (% -> %)', s.venues_n, v_venues;
  END IF;
  IF v_tm <> s.tm_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: tenant_members mutated (% -> %)', s.tm_n, v_tm;
  END IF;
  IF v_roles <> s.roles_n OR v_perms <> s.permissions_n OR v_rp <> s.rp_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: RBAC catalog mutated';
  END IF;
  IF v_plans <> s.plans_n OR v_limits <> s.plan_limits_n THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: plans catalog mutated';
  END IF;
END $$;

COMMIT;
