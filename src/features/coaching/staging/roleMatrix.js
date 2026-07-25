/**
 * COACHING-03 — Proposed least-privilege role → permission matrix (authored only).
 *
 * Maps Owner-facing role names to Identity catalog roles.
 * Does not apply grants.
 *
 * Root cause (remediated): COACHING-02 RLS enforces permission + tenant/club only.
 * It does NOT enforce coach assignment, coach-player relationship, coach-owned
 * session, assigned-player attendance/evaluation, or assigned entitlement
 * consumption. Therefore COACH receives ZERO Coaching grants in COACHING-03.
 * Assignment-aware COACH authorization is deferred to COACHING-04.
 * PLAYER remains zero until self-only RLS is proven (also COACHING-04).
 */

import { COACHING_IDENTITY_PERMISSION_VALUES } from "../constants/permissions.js";

/** Administrative / manager roles that may receive Coaching grants in COACHING-03. */
export const COACHING_03_ADMIN_GRANT_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "VENUE_OWNER",
  "COURT_OWNER",
  "VENUE_MANAGER",
  "COURT_MANAGER",
  "CLUB_MANAGER",
  "CLUB_OWNER",
]);

export const COACHING_03_ROLE_CATALOG_NOTES = Object.freeze({
  SUPER_ADMIN: "DB seed role id SUPER_ADMIN (app alias PLATFORM_ADMIN)",
  VENUE_OWNER:
    "Legacy/DB alias — normalize to TENANT_OWNER; SQL grants both if present",
  VENUE_MANAGER: "Canonical venue-scoped manager",
  CLUB_OWNER: "Legacy alias — normalize to CLUB_MANAGER; SQL grants both if present",
  CLUB_MANAGER: "Canonical club-scoped manager",
  COACH:
    "Canonical coaching operator — ZERO Coaching grants in COACHING-03; assignment-aware RLS required in COACHING-04",
  PLAYER:
    "Canonical player — zero Coaching grants; self-scope read deferred to COACHING-04",
  TENANT_OWNER: "Canonical venue/tenant owner (COURT_OWNER legacy also granted)",
  EXPLICIT_DENY_DEFAULT: Object.freeze([
    "COACH",
    "PLAYER",
    "REFEREE",
    "CASHIER",
    "CUSTOMER",
    "SUPPORT",
    "ACCOUNTANT",
    "SYSTEM_TECHNICIAN",
    "TOURNAMENT_MANAGER",
    "TEAM_CAPTAIN",
    "STAFF",
  ]),
});

/** All 14 canonical Coaching permission ids. */
export const COACHING_03_ACTIONS = COACHING_IDENTITY_PERMISSION_VALUES;

/**
 * Role → permission grant map (proposal).
 * Keys are permission ids; values are role ids that receive the grant.
 * COACH and PLAYER are never listed.
 */
export const COACHING_03_PROPOSED_ROLE_GRANTS = Object.freeze(
  Object.fromEntries(
    COACHING_03_ACTIONS.map((action) => [
      action,
      COACHING_03_ADMIN_GRANT_ROLES,
    ])
  )
);

/**
 * Per-action decision metadata for Owner review.
 */
export const COACHING_03_ACTION_DECISIONS = Object.freeze({
  "coaching.program.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER and all non-admin roles denied",
    requiresQaRole: true,
    justification:
      "Program design is administrative; managers/owners only. COACH deferred to COACHING-04.",
  },
  "coaching.program.update": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Program mutation remains administrative.",
  },
  "coaching.coach.assign": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Coach assignment is staffing control for managers/owners.",
  },
  "coaching.player.enroll": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied — no assignment-aware RLS yet",
    requiresQaRole: true,
    justification:
      "Enrollment is manager/owner only in COACHING-03. COACH enroll requires assignment-aware RLS in COACHING-04.",
  },
  "coaching.curriculum.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Curriculum authorship is administrative.",
  },
  "coaching.lesson.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied — no assignment-aware RLS yet",
    requiresQaRole: true,
    justification:
      "Lesson create for COACH deferred until assignment-aware scope exists (COACHING-04).",
  },
  "coaching.session.schedule": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied — no coach-owned session RLS yet",
    requiresQaRole: true,
    justification:
      "Session scheduling for COACH deferred until coach-owned session scope is enforced (COACHING-04).",
  },
  "coaching.attendance.record": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied — no assigned-player attendance RLS yet",
    requiresQaRole: true,
    justification:
      "Attendance record for COACH deferred until assigned-player/session RLS exists (COACHING-04).",
  },
  "coaching.attendance.correct": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH and PLAYER denied by default",
    requiresQaRole: true,
    justification:
      "Corrections are sensitive atomic RPC mutations — managers/owners only.",
  },
  "coaching.package.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Package catalog is commercial/admin configuration.",
  },
  "coaching.entitlement.grant": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Granting sessions is commercial entitlement control.",
  },
  "coaching.entitlement.consume": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault:
      "COACH/PLAYER denied — no assigned entitlement relationship RLS yet",
    requiresQaRole: true,
    justification:
      "Entitlement consume for COACH deferred until authorized relationship is enforced (COACHING-04).",
  },
  "coaching.evaluation.submit": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only",
    denyDefault: "COACH/PLAYER denied — no assigned-player evaluation RLS yet",
    requiresQaRole: true,
    justification:
      "Evaluation submit for COACH deferred until assigned-player/session RLS exists (COACHING-04).",
  },
  "coaching.records.read": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative only (NOT coach-assigned, NOT player self-scope)",
    denyDefault:
      "COACH and PLAYER not granted — RLS is permission+tenant/club only; assignment/self-scope unproven",
    requiresQaRole: true,
    justification:
      "Broad records.read for COACH would be club-wide under current RLS. Deferred to COACHING-04 assignment-aware SELECT. PLAYER self-read also deferred. Do not widen policies for positive coach/player flows.",
  },
});

/**
 * COACHING-04 prerequisites before any COACH Coaching grants may be proposed.
 */
export const COACHING_04_COACH_GRANT_PREREQUISITES = Object.freeze([
  "assignment-aware RLS and/or scoped RPCs",
  "verified coach_principal_id / coach-player relationship",
  "SELECT limited to assigned records only",
  "enrollment only within allowed program/assignment",
  "session scheduling only for valid coach scope",
  "attendance/evaluation only for assigned player/session",
  "entitlement consume only under explicit authorized relationship",
  "negative cross-coach tests",
  "removed assignment immediately denies access",
]);

/**
 * Staging certification principals allowed for positive flows in COACHING-03.
 */
export const COACHING_03_CERT_POSITIVE_ROLES = Object.freeze([
  "SUPER_ADMIN",
  "TENANT_OWNER",
  "VENUE_OWNER",
  "VENUE_MANAGER",
  "CLUB_MANAGER",
]);

/**
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   actionCount: number,
 *   playerRecordsReadGranted: boolean,
 *   coachAnyGrant: boolean,
 *   playerAnyGrant: boolean
 * }}
 */
export function verifyCoaching03RoleMatrixCompleteness() {
  /** @type {string[]} */
  const errors = [];
  const actions = COACHING_03_ACTIONS;
  if (actions.length !== 14) {
    errors.push(`Expected 14 actions, got ${actions.length}`);
  }
  for (const action of actions) {
    if (!COACHING_03_PROPOSED_ROLE_GRANTS[action]) {
      errors.push(`Missing proposed grants for ${action}`);
    }
    if (!COACHING_03_ACTION_DECISIONS[action]) {
      errors.push(`Missing decision metadata for ${action}`);
    }
  }

  let coachAnyGrant = false;
  let playerAnyGrant = false;
  for (const action of actions) {
    const roles = COACHING_03_PROPOSED_ROLE_GRANTS[action] || [];
    if (roles.includes("COACH")) {
      coachAnyGrant = true;
      errors.push(
        `COACH must not receive ${action} until assignment-aware RLS (COACHING-04).`
      );
    }
    if (roles.includes("PLAYER")) {
      playerAnyGrant = true;
      errors.push(`PLAYER must not receive ${action} in COACHING-03 proposal.`);
    }
    for (const role of COACHING_03_ADMIN_GRANT_ROLES) {
      if (!roles.includes(role)) {
        errors.push(`Admin role ${role} missing from ${action}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    actionCount: actions.length,
    playerRecordsReadGranted: (
      COACHING_03_PROPOSED_ROLE_GRANTS["coaching.records.read"] || []
    ).includes("PLAYER"),
    coachAnyGrant,
    playerAnyGrant,
  };
}

/**
 * @param {string} roleId
 * @param {string} permissionId
 * @returns {boolean}
 */
export function isCoaching03RoleGrantProposed(roleId, permissionId) {
  const roles = COACHING_03_PROPOSED_ROLE_GRANTS[permissionId] || [];
  return roles.includes(String(roleId || ""));
}

/**
 * @param {string} roleId
 * @returns {boolean}
 */
export function roleHasAnyCoaching03Grant(roleId) {
  const id = String(roleId || "");
  return COACHING_03_ACTIONS.some((action) =>
    (COACHING_03_PROPOSED_ROLE_GRANTS[action] || []).includes(id)
  );
}
