-- Wave 4 Staging remediation — 04_MEMBERSHIP_CANDIDATES_READONLY.sql
-- AUTHOR ONLY. READ-ONLY. DO NOT MUTATE.
-- SQL_EXECUTION_GO = NO
-- DATA_MUTATION_GO = NO
--
-- Classification report for Owner. NOT an insert manifest.
-- OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED=YES
--
-- Do not derive tenant_members from profiles.role / tenant_id / venue_id.
-- PLAYER / REFEREE / CLUB / COACH normally do not need membership.

SELECT
  p.id AS user_id,
  p.role AS profile_role,
  p.tenant_id AS home_tenant_id,
  coalesce((
    SELECT count(*)
    FROM public.tenant_members tm
    WHERE tm.user_id = p.id AND tm.status = 'active'
  ), 0) AS existing_active_membership_count,
  CASE
    WHEN coalesce((
      SELECT count(*) FROM public.tenant_members tm
      WHERE tm.user_id = p.id AND tm.status = 'active'
    ), 0) > 0 THEN 'has_active_tenant_members_row'
    WHEN upper(coalesce(p.role, '')) IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
      THEN 'global_platform_admin'
    WHEN coalesce(p.status, '') = '' OR p.role IS NULL OR btrim(p.role) = ''
      THEN 'identity_incomplete'
    WHEN upper(coalesce(p.role, '')) IN (
      'PLAYER', 'REFEREE', 'COACH', 'CLUB_MANAGER', 'CLUB_OWNER',
      'CUSTOMER', 'TEAM_CAPTAIN', 'SYSTEM_TECHNICIAN', 'SUPPORT'
    ) THEN 'non_tenant_operational_domain_role'
    WHEN upper(coalesce(p.role, '')) IN (
      'TENANT_OWNER', 'VENUE_OWNER', 'COURT_OWNER',
      'VENUE_MANAGER', 'COURT_MANAGER', 'CASHIER', 'STAFF',
      'TOURNAMENT_MANAGER', 'ACCOUNTANT'
    ) THEN 'operational_role_without_explicit_membership'
    ELSE 'ambiguous_role_or_usage'
  END AS candidate_reason,
  CASE
    WHEN coalesce((
      SELECT count(*) FROM public.tenant_members tm
      WHERE tm.user_id = p.id AND tm.status = 'active'
    ), 0) > 0 THEN 'ALREADY_ENTITLED'
    WHEN upper(coalesce(p.role, '')) IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
      THEN 'SUPER_ADMIN_MEMBERSHIP_NOT_REQUIRED'
    WHEN coalesce(p.status, '') = '' OR p.role IS NULL OR btrim(p.role) = ''
      THEN 'IDENTITY_INCOMPLETE'
    WHEN upper(coalesce(p.role, '')) IN (
      'PLAYER', 'REFEREE', 'COACH', 'CLUB_MANAGER', 'CLUB_OWNER',
      'CUSTOMER', 'TEAM_CAPTAIN', 'SYSTEM_TECHNICIAN', 'SUPPORT'
    ) THEN 'NON_TENANT_OPERATIONAL_ACTOR_NO_MEMBERSHIP_REQUIRED'
    WHEN upper(coalesce(p.role, '')) IN (
      'TENANT_OWNER', 'VENUE_OWNER', 'COURT_OWNER',
      'VENUE_MANAGER', 'COURT_MANAGER', 'CASHIER', 'STAFF',
      'TOURNAMENT_MANAGER', 'ACCOUNTANT'
    ) THEN 'TENANT_OPERATOR_CANDIDATE_OWNER_DECISION_REQUIRED'
    ELSE 'UNCLASSIFIED_OWNER_REVIEW_REQUIRED'
  END AS recommended_classification
FROM public.profiles p
WHERE coalesce(p.status, '') = 'active' OR p.status IS NULL
ORDER BY recommended_classification, profile_role, user_id;

SELECT
  'OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED' AS flag,
  'YES' AS value,
  'No INSERT/UPDATE/DELETE authored. Candidate rows are not an apply list.' AS note;
