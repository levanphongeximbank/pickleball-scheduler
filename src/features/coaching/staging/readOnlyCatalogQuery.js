/**
 * COACHING-03 — Read-only catalog query enforcement.
 *
 * Live Staging probes must:
 * 1. wrap in BEGIN TRANSACTION READ ONLY … ROLLBACK
 * 2. contain only allowlisted catalog SELECT statements
 * 3. never include write/DDL/mutation verbs
 */

const FORBIDDEN_VERB_RE =
  /\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|COPY|VACUUM|REINDEX|CLUSTER|NOTIFY|LISTEN|LOAD)\b|\bCOMMENT\s+ON\b|\bSECURITY\s+LABEL\b|\bREFRESH\s+MATERIALIZED\b|\bSET\s+ROLE\b|\bRESET\s+ROLE\b|\bDO\s+\$\$/i;

const ALLOWED_SET_RE =
  /^\s*SET\s+search_path\s*=\s*public,\s*pg_temp\s*;?\s*$/i;

/**
 * Strip SQL line/block comments for verb scanning.
 * @param {string} sql
 * @returns {string}
 */
export function stripSqlComments(sql) {
  return String(sql || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/**
 * @param {string} sql
 * @returns {{ ok: boolean, errors: string[], writeVerbsFound: string[] }}
 */
export function assertCatalogQueryReadOnly(sql) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const writeVerbsFound = [];
  const stripped = stripSqlComments(sql);
  const upper = stripped.toUpperCase();

  if (
    !/\bBEGIN\s+TRANSACTION\s+READ\s+ONLY\b/.test(upper) &&
    !/\bBEGIN\s+READ\s+ONLY\b/.test(upper)
  ) {
    errors.push(
      "Missing BEGIN TRANSACTION READ ONLY (or BEGIN READ ONLY) wrapper."
    );
  }
  if (!/\bROLLBACK\b/.test(upper)) {
    errors.push("Missing ROLLBACK terminator for read-only probe.");
  }

  // Non-greedy SET extraction so each statement is checked independently.
  const setStatements = [...stripped.matchAll(/\bSET\b[\s\S]*?;/gi)].map(
    (m) => m[0]
  );
  for (const stmt of setStatements) {
    if (!ALLOWED_SET_RE.test(stmt.trim())) {
      errors.push(
        `Disallowed SET statement in read-only probe: ${stmt.trim().slice(0, 80)}`
      );
    }
  }

  let match;
  const re = new RegExp(FORBIDDEN_VERB_RE.source, "gi");
  while ((match = re.exec(stripped)) !== null) {
    const verb = String(match[0] || "").toUpperCase().trim();
    writeVerbsFound.push(verb);
  }

  if (writeVerbsFound.length > 0) {
    errors.push(
      `Forbidden write/DDL verbs in catalog probe: ${[...new Set(writeVerbsFound)].join(", ")}`
    );
  }

  if (!/\bSELECT\b/i.test(stripped)) {
    errors.push("Read-only probe must include at least one SELECT.");
  }

  return {
    ok: errors.length === 0,
    errors,
    writeVerbsFound: [...new Set(writeVerbsFound)],
  };
}

/**
 * Canonical Staging catalog probe SQL (counts only, no PII columns).
 * @returns {string}
 */
export function buildCoaching03ReadOnlyCatalogProbeSql() {
  return `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;

SELECT version() AS pg_version;

SELECT
  current_database() AS database_name,
  current_user AS current_user_name,
  current_setting('transaction_read_only', true) AS transaction_read_only;

SELECT
  to_regclass('public.coaching_programs') IS NOT NULL AS coaching_programs_present,
  to_regclass('public.coaching_coach_references') IS NOT NULL AS coaching_coach_references_present,
  to_regclass('public.coaching_coach_player_relationships') IS NOT NULL AS coaching_cpr_present,
  to_regclass('public.coaching_enrollments') IS NOT NULL AS coaching_enrollments_present,
  to_regclass('public.coaching_curricula') IS NOT NULL AS coaching_curricula_present,
  to_regclass('public.coaching_lessons') IS NOT NULL AS coaching_lessons_present,
  to_regclass('public.coaching_training_sessions') IS NOT NULL AS coaching_sessions_present,
  to_regclass('public.coaching_attendance_records') IS NOT NULL AS coaching_attendance_present,
  to_regclass('public.coaching_attendance_corrections') IS NOT NULL AS coaching_acorr_present,
  to_regclass('public.coaching_packages') IS NOT NULL AS coaching_packages_present,
  to_regclass('public.coaching_package_entitlements') IS NOT NULL AS coaching_entitlements_present,
  to_regclass('public.coaching_package_usage_events') IS NOT NULL AS coaching_usage_present,
  to_regclass('public.coaching_evaluations') IS NOT NULL AS coaching_evaluations_present;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'user_venue_id',
    'user_club_id',
    'user_has_permission',
    'is_super_admin',
    'coaching_02_scope_allows',
    'coaching_02_has_action',
    'coaching_apply_attendance_correction',
    'coaching_consume_entitlement'
  )
ORDER BY p.proname, identity_args;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'coaching_%'
ORDER BY c.relname;

SELECT
  pol.polname AS policy_name,
  c.relname AS table_name
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'coaching_%'
ORDER BY c.relname, pol.polname;

SELECT
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE module = 'coaching' OR id LIKE 'coaching.%'
    )
  END AS coaching_permission_count;

SELECT
  CASE
    WHEN to_regclass('public.role_permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE p.module = 'coaching' OR p.id LIKE 'coaching.%'
    )
  END AS coaching_role_permission_count;

SELECT
  extname
FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp')
ORDER BY extname;

ROLLBACK;
`.trim();
}

/**
 * @param {string} sql
 * @returns {boolean}
 */
export function isCoaching03ReadOnlyCatalogProbe(sql) {
  return assertCatalogQueryReadOnly(sql).ok;
}

/**
 * COACHING-04 Staging read-only catalog probe (counts/catalog only; no PII; no writes).
 * Extends COACHING-03 probes with assignment helper/policy/player-mapping collision checks.
 * @returns {string}
 */
export function buildCoaching04ReadOnlyCatalogProbeSql() {
  return `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;

SELECT version() AS pg_version;

SELECT
  current_database() AS database_name,
  current_user AS current_user_name,
  current_setting('transaction_read_only', true) AS transaction_read_only;

SELECT
  to_regclass('public.coaching_programs') IS NOT NULL AS coaching_programs_present,
  to_regclass('public.coaching_coach_references') IS NOT NULL AS coaching_coach_references_present,
  to_regclass('public.coaching_coach_player_relationships') IS NOT NULL AS coaching_cpr_present,
  to_regclass('public.coaching_enrollments') IS NOT NULL AS coaching_enrollments_present,
  to_regclass('public.coaching_curricula') IS NOT NULL AS coaching_curricula_present,
  to_regclass('public.coaching_lessons') IS NOT NULL AS coaching_lessons_present,
  to_regclass('public.coaching_training_sessions') IS NOT NULL AS coaching_sessions_present,
  to_regclass('public.coaching_attendance_records') IS NOT NULL AS coaching_attendance_present,
  to_regclass('public.coaching_attendance_corrections') IS NOT NULL AS coaching_acorr_present,
  to_regclass('public.coaching_packages') IS NOT NULL AS coaching_packages_present,
  to_regclass('public.coaching_package_entitlements') IS NOT NULL AS coaching_entitlements_present,
  to_regclass('public.coaching_package_usage_events') IS NOT NULL AS coaching_usage_present,
  to_regclass('public.coaching_evaluations') IS NOT NULL AS coaching_evaluations_present;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'coaching_coach_references'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN (
    'coach_reference_id',
    'coach_principal_id',
    'coach_membership_id',
    'tenant_id',
    'club_id',
    'status'
  )
ORDER BY a.attname;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'coaching_coach_player_relationships'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN (
    'relationship_id',
    'coach_reference_id',
    'player_id',
    'program_id',
    'tenant_id',
    'club_id',
    'status'
  )
ORDER BY a.attname;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'user_venue_id',
    'user_club_id',
    'user_has_permission',
    'is_super_admin',
    'coaching_02_scope_allows',
    'coaching_02_has_action',
    'coaching_apply_attendance_correction',
    'coaching_consume_entitlement',
    'coaching_04_actor_uid',
    'coaching_04_active_coach_reference_id',
    'coaching_04_coach_assigned_to_player',
    'coaching_04_coach_owns_session',
    'coaching_04_has_assigned_action',
    'coaching_04_record_assigned_attendance',
    'coaching_04_submit_assigned_evaluation',
    'coaching_04_consume_assigned_entitlement'
  )
ORDER BY p.proname, identity_args;

SELECT
  p.proname AS collision_candidate
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'coaching_04_%'
    OR p.proname IN (
      'resolve_canonical_player_id',
      'coaching_player_id_from_auth',
      'coaching_04_resolve_player_id'
    )
  )
ORDER BY p.proname;

SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'coaching_%'
ORDER BY c.relname;

SELECT
  pol.polname AS policy_name,
  c.relname AS table_name
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'coaching_%'
ORDER BY c.relname, pol.polname;

SELECT
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE module = 'coaching' OR id LIKE 'coaching.%'
    )
  END AS coaching_permission_count;

SELECT
  CASE
    WHEN to_regclass('public.role_permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE (p.module = 'coaching' OR p.id LIKE 'coaching.%')
        AND rp.role_id IN ('COACH', 'PLAYER')
    )
  END AS coaching_coach_player_role_permission_count;

SELECT
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE id LIKE 'coaching.assigned.%'
    )
  END AS coaching_assigned_permission_count;

ROLLBACK;
`.trim();
}

/**
 * @param {string} sql
 * @returns {boolean}
 */
export function isCoaching04ReadOnlyCatalogProbe(sql) {
  return assertCatalogQueryReadOnly(sql).ok;
}
