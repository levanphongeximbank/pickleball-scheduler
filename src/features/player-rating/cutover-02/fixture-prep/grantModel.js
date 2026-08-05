/**
 * A3d-Security — documented grant model for A3c fixture-prep RPCs.
 * Authoritative live apply is the SQL migration (unapplied in this gate).
 */

export const A3D_SECURITY_MIGRATION_IDENTITY =
  "rating_v5_cutover_02_a3d_least_privilege_grants_v1";

export const A3D_SECURITY_SQL_RELATIVE_PATH =
  "docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3D_LEAST_PRIVILEGE_GRANTS.sql";

/** Live Staging ACL before corrective apply (Gate A3d snapshot). */
export const A3C_PRE_CORRECTIVE_GRANTS = Object.freeze({
  public: false,
  anon: false,
  authenticated: true,
  service_role: true,
  rootCause:
    "pg_default_acl on public functions grants authenticated=X and service_role=X at CREATE; A3c migration only REVOKE FROM PUBLIC",
});

/** Intended grants after A3d-Security apply — no authenticated exceptions. */
export const A3C_INTENDED_GRANTS = Object.freeze({
  public: false,
  anon: false,
  authenticated: false,
  service_role: true,
  authenticatedException: null,
});

/**
 * Exact A3c function inventory from rating_v5_cutover_02_a3c_fixture_prep_v1.
 * @type {readonly {name: string, args: string, securityDefiner: boolean, edgeCallsDirectly: boolean, internalGuard: string, authenticatedExecuteRequired: boolean, recommendedGrants: typeof A3C_INTENDED_GRANTS}[]}
 */
export const A3C_FUNCTION_GRANT_INVENTORY = Object.freeze([
  Object.freeze({
    name: "rating_v5_cutover_02_a3c_assert_staging_project",
    args: "",
    securityDefiner: true,
    edgeCallsDirectly: false,
    internalGuard: "project ref / production deny",
    authenticatedExecuteRequired: false,
    recommendedGrants: A3C_INTENDED_GRANTS,
  }),
  Object.freeze({
    name: "rating_v5_cutover_02_a3c_assert_caller",
    args: "p_caller_id uuid",
    securityDefiner: true,
    edgeCallsDirectly: false,
    internalGuard: "SUPER_ADMIN profile or calibration_manage",
    authenticatedExecuteRequired: false,
    recommendedGrants: A3C_INTENDED_GRANTS,
  }),
  Object.freeze({
    name: "rating_v5_cutover_02_a3c_service_create_fixture_assessment",
    args: "p_caller_id uuid, p_target_player_id uuid, p_cohort_label text, p_preparation_version text, p_tenant_id text",
    securityDefiner: true,
    edgeCallsDirectly: true,
    internalGuard: "rating_v5_assert_service_role + staging + caller + allowlist",
    authenticatedExecuteRequired: false,
    recommendedGrants: A3C_INTENDED_GRANTS,
  }),
  Object.freeze({
    name: "rating_v5_cutover_02_a3c_service_record_prep_audit",
    args: "p_caller_id uuid, p_payload jsonb",
    securityDefiner: true,
    edgeCallsDirectly: false,
    note: "Available for trusted service path; Edge scaffold currently calls create only",
    internalGuard: "rating_v5_assert_service_role + staging + caller",
    authenticatedExecuteRequired: false,
    recommendedGrants: A3C_INTENDED_GRANTS,
  }),
]);

/**
 * Edge database call-path proof (deployed prepare-fixture shell).
 */
export const A3C_EDGE_DB_CALL_PATH = Object.freeze({
  jwtVerification: "Bearer Authorization + user.auth.getUser() via anon client",
  callerAuthorization: "profiles.role === SUPER_ADMIN && status === active",
  userClientOps: Object.freeze(["auth.getUser", "profiles.select id/role/status"]),
  serviceRoleOps: Object.freeze([
    "rpc rating_v5_cutover_02_a3c_service_create_fixture_assessment",
  ]),
  serviceRoleKeyExposure: "Deno.env SUPABASE_SERVICE_ROLE_KEY only — never browser",
  browserDirectServiceRpc: false,
  removingAuthenticatedExecuteBreaksEdge: false,
  candidateJwtRequired: false,
  candidatePasswordRequired: false,
});

/**
 * Simulate grant evaluation for a role against intended policy.
 * @param {'public'|'anon'|'authenticated'|'service_role'} role
 * @param {string} functionName
 */
export function evaluateIntendedExecuteGrant(role, functionName) {
  const row = A3C_FUNCTION_GRANT_INVENTORY.find((f) => f.name === functionName);
  if (!row) {
    return { ok: false, code: "UNKNOWN_FUNCTION" };
  }
  const allowed = Boolean(row.recommendedGrants[role]);
  return {
    ok: true,
    allowed,
    role,
    functionName,
    code: allowed ? "EXECUTE_ALLOWED" : "EXECUTE_DENIED",
  };
}

/**
 * Rollback model restores only documented pre-corrective grants.
 */
export const A3D_SECURITY_ROLLBACK_GRANT_MODEL = Object.freeze({
  restoreAuthenticatedExecute: true,
  keepServiceRoleExecute: true,
  keepPublicRevoked: true,
  keepAnonRevoked: true,
  alterDefaultPrivileges: false,
  dataMutation: false,
});
