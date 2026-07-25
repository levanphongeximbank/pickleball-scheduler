/**
 * COACHING-03 — Proposed least-privilege role → permission matrix (authored only).
 *
 * Maps Owner-facing role names to Identity catalog roles.
 * Does not apply grants. PLAYER broad records.read is intentionally denied
 * until self-only RLS semantics are proven (deferred COACHING-04).
 */

import { COACHING_IDENTITY_PERMISSION_VALUES } from "../constants/permissions.js";

/** @typedef {{ grant: boolean, justification: string, tenantScope: string, clubScope: string, actorScope: string, denyDefault: string, requiresQaRole: boolean }} GrantSpec */

export const COACHING_03_ROLE_CATALOG_NOTES = Object.freeze({
  SUPER_ADMIN: "DB seed role id SUPER_ADMIN (app alias PLATFORM_ADMIN)",
  VENUE_OWNER:
    "Legacy/DB alias — normalize to TENANT_OWNER; SQL grants both if present",
  VENUE_MANAGER: "Canonical venue-scoped manager",
  CLUB_OWNER: "Legacy alias — normalize to CLUB_MANAGER; SQL grants both if present",
  CLUB_MANAGER: "Canonical club-scoped manager",
  COACH: "Canonical coaching operator",
  PLAYER:
    "Canonical player — no broad coaching.records.read without self-scope proof",
  TENANT_OWNER: "Canonical venue/tenant owner (COURT_OWNER legacy also granted)",
  EXPLICIT_DENY_DEFAULT: [
    "REFEREE",
    "CASHIER",
    "CUSTOMER",
    "SUPPORT",
    "ACCOUNTANT",
    "SYSTEM_TECHNICIAN",
    "TOURNAMENT_MANAGER",
    "TEAM_CAPTAIN",
    "STAFF",
  ],
});

/** All 14 canonical Coaching permission ids. */
export const COACHING_03_ACTIONS = COACHING_IDENTITY_PERMISSION_VALUES;

/**
 * Role → permission grant map (proposal).
 * Keys are permission ids; values are role ids that receive the grant.
 */
export const COACHING_03_PROPOSED_ROLE_GRANTS = Object.freeze({
  "coaching.program.create": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.program.update": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.coach.assign": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.player.enroll": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.curriculum.create": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.lesson.create": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.session.schedule": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.attendance.record": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.attendance.correct": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.package.create": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.entitlement.grant": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
  ]),
  "coaching.entitlement.consume": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.evaluation.submit": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
  "coaching.records.read": Object.freeze([
    "SUPER_ADMIN",
    "TENANT_OWNER",
    "VENUE_OWNER",
    "COURT_OWNER",
    "VENUE_MANAGER",
    "COURT_MANAGER",
    "CLUB_MANAGER",
    "CLUB_OWNER",
    "COACH",
  ]),
});

/**
 * Per-action decision metadata for Owner review.
 */
export const COACHING_03_ACTION_DECISIONS = Object.freeze({
  "coaching.program.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification:
      "Program design is administrative; managers/owners only — not COACH/PLAYER.",
  },
  "coaching.program.update": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Program mutation remains administrative.",
  },
  "coaching.coach.assign": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Coach assignment is staffing control for managers/owners.",
  },
  "coaching.player.enroll": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + assigned coach ops",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification:
      "Enrollment may be performed by managers or the operating coach.",
  },
  "coaching.curriculum.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Curriculum authorship is administrative.",
  },
  "coaching.lesson.create": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach content",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Coaches may author lessons within club scope.",
  },
  "coaching.session.schedule": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach ops",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Scheduling is day-to-day coach/manager work.",
  },
  "coaching.attendance.record": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach ops",
    denyDefault: "authenticated without permission denied",
    requiresQaRole: true,
    justification: "Attendance capture is coach/manager operational duty.",
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
    actorScope: "administrative",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Package catalog is commercial/admin configuration.",
  },
  "coaching.entitlement.grant": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative",
    denyDefault: "COACH/PLAYER denied",
    requiresQaRole: true,
    justification: "Granting sessions is commercial entitlement control.",
  },
  "coaching.entitlement.consume": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach ops",
    denyDefault: "PLAYER denied",
    requiresQaRole: true,
    justification:
      "Consumption is operational check-in via atomic RPC for coach/manager.",
  },
  "coaching.evaluation.submit": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach ops",
    denyDefault: "PLAYER denied",
    requiresQaRole: true,
    justification: "Evaluations are submitted by coaches/managers.",
  },
  "coaching.records.read": {
    tenantScope: "JWT venue-bound tenant_id = user_venue_id()",
    clubScope: "club_id = user_club_id()",
    actorScope: "administrative + coach ops (NOT player self-scope)",
    denyDefault:
      "PLAYER not granted — RLS currently permission+tenant/club only; self-only semantics unproven",
    requiresQaRole: true,
    justification:
      "Broad records.read for PLAYER deferred to COACHING-04 until self-only RLS is proven. Do not widen policies for positive player flow.",
  },
});

/**
 * @returns {{ ok: boolean, errors: string[], actionCount: number, playerRecordsReadGranted: boolean }}
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
  const playerRead = (COACHING_03_PROPOSED_ROLE_GRANTS["coaching.records.read"] || []).includes(
    "PLAYER"
  );
  if (playerRead) {
    errors.push(
      "PLAYER must not receive coaching.records.read without self-scope proof."
    );
  }
  for (const action of actions) {
    const roles = COACHING_03_PROPOSED_ROLE_GRANTS[action] || [];
    if (roles.includes("PLAYER") && action !== "coaching.records.read") {
      // PLAYER should not get any coaching action in this proposal.
      errors.push(`PLAYER must not receive ${action} in canonical proposal.`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    actionCount: actions.length,
    playerRecordsReadGranted: playerRead,
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
