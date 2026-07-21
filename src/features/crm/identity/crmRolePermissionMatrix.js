/**
 * Proposed CRM role → permission matrix (Phase 1H-A).
 *
 * SEPARATELY REVIEWABLE from permission creation seeds.
 * Owner approval required before any Staging/Production apply of role grants.
 *
 * Fail-closed design:
 * - No anonymous / authenticated-global grants
 * - No Customer / Player CRM administration by default
 * - No automatic broad assignment to every role
 * - SUPER_ADMIN follows platform convention (catalog completeness via SQL select)
 * - Venue roles remain tenant/venue scoped at RLS (JWT user_venue_id)
 *
 * Role names use Identity DB ids (SUPER_ADMIN, TENANT_OWNER / VENUE_OWNER aliases,
 * VENUE_MANAGER). No invented CRM_OPERATOR role in Phase 1H-A.
 */

import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { CRM_PERMISSION_SEED_ROWS } from "./crmPermissionSeedDefinitions.js";

/** All CRM permission ids (from seed catalog). */
export const ALL_CRM_PERMISSION_IDS = Object.freeze(
  CRM_PERMISSION_SEED_ROWS.map((row) => row.id)
);

/** Full CRM ops set for venue owners (canonical TENANT_OWNER + legacy aliases). */
const OWNER_OPS = Object.freeze([...ALL_CRM_PERMISSION_IDS]);

/** Venue manager: full ops except campaign manage + pipeline manage (stricter). */
const MANAGER_OPS = Object.freeze(
  ALL_CRM_PERMISSION_IDS.filter(
    (id) =>
      id !== CRM_PERMISSIONS.CAMPAIGN_MANAGE &&
      id !== CRM_PERMISSIONS.PIPELINE_MANAGE
  )
);

/**
 * Read-only / light operator set for STAFF (view + create interactions/tasks;
 * no assign/admin/consent revoke/audit).
 */
const STAFF_OPS = Object.freeze([
  CRM_PERMISSIONS.LEAD_VIEW,
  CRM_PERMISSIONS.LEAD_CREATE,
  CRM_PERMISSIONS.OPPORTUNITY_VIEW,
  CRM_PERMISSIONS.INTERACTION_VIEW,
  CRM_PERMISSIONS.INTERACTION_CREATE,
  CRM_PERMISSIONS.TASK_VIEW,
  CRM_PERMISSIONS.TASK_CREATE,
  CRM_PERMISSIONS.TAG_VIEW,
  CRM_PERMISSIONS.CONSENT_VIEW,
  CRM_PERMISSIONS.CAMPAIGN_VIEW,
]);

/**
 * Proposed role → permission map.
 * Keys are Identity role_id values used in public.role_permissions.
 *
 * SUPER_ADMIN: granted all CRM permissions via SQL
 *   `select 'SUPER_ADMIN', p.id from public.permissions p where p.module = 'crm'`
 * (platform convention). Listed here for review completeness.
 *
 * VENUE_OWNER / COURT_OWNER: legacy aliases of TENANT_OWNER in DB seeds.
 *
 * Empty arrays mean intentionally no CRM grants (documented deny).
 *
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const CRM_PROPOSED_ROLE_PERMISSION_MATRIX = Object.freeze({
  SUPER_ADMIN: OWNER_OPS,
  TENANT_OWNER: OWNER_OPS,
  VENUE_OWNER: OWNER_OPS,
  COURT_OWNER: OWNER_OPS,
  VENUE_MANAGER: MANAGER_OPS,
  COURT_MANAGER: MANAGER_OPS,
  STAFF: STAFF_OPS,
  // Explicit denies (empty) — fail-closed; do not omit silently.
  PLAYER: Object.freeze([]),
  CUSTOMER: Object.freeze([]),
  REFEREE: Object.freeze([]),
  COACH: Object.freeze([]),
  CASHIER: Object.freeze([]),
  TEAM_CAPTAIN: Object.freeze([]),
  TOURNAMENT_MANAGER: Object.freeze([]),
  CLUB_MANAGER: Object.freeze([]),
  SUPPORT: Object.freeze([]),
  ACCOUNTANT: Object.freeze([]),
  SYSTEM_TECHNICIAN: Object.freeze([]),
});

/**
 * Roles that receive non-empty CRM grants in the proposed assignment SQL.
 * (SUPER_ADMIN handled by module-wide select; aliases included for DB compat.)
 */
export const CRM_ROLE_GRANT_CANDIDATES = Object.freeze([
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "VENUE_OWNER",
  "COURT_OWNER",
  "VENUE_MANAGER",
  "COURT_MANAGER",
  "STAFF",
]);

export const CRM_ROLE_MATRIX_APPROVAL = Object.freeze({
  phase: "1H-A",
  status: "PROPOSED_AWAITING_OWNER_APPLY_APPROVAL",
  appliesTo: "public.role_permissions",
  separatedFromPermissionSeed: true,
  noAnonymousGrants: true,
  noAuthenticatedGlobalGrants: true,
  noPlayerCustomerAdmin: true,
  noCrmOperatorRoleInvented: true,
  ownerApprovalRequiredBeforeApply: true,
});

/**
 * Flatten matrix into grant rows (role_id, permission_id) for non-empty sets.
 * Excludes empty deny roles.
 * @returns {ReadonlyArray<{ roleId: string, permissionId: string }>}
 */
export function listProposedCrmRolePermissionGrants() {
  /** @type {Array<{ roleId: string, permissionId: string }>} */
  const grants = [];
  for (const roleId of CRM_ROLE_GRANT_CANDIDATES) {
    const perms = CRM_PROPOSED_ROLE_PERMISSION_MATRIX[roleId] || [];
    for (const permissionId of perms) {
      grants.push({ roleId, permissionId });
    }
  }
  return Object.freeze(grants);
}
