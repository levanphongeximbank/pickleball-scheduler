/**
 * Owner-approved assignment lifecycle gate (CORE-13 runtime closure).
 *
 * PRE_MATCH: assign/replace/unassign ALLOW (authorized + otherwise valid)
 * IN_PROGRESS: new assign DENY; atomic replace ALLOW_AUTHORIZED; unassign DENY
 * SCORING_ACTIVE: normal assign/replace DENY; emergency atomic replace ALLOW_AUTHORIZED_EMERGENCY; unassign DENY
 * LOCKED / COMPLETED: all DENY
 * REOPEN: follows new authoritative lifecycle (CORE-13 does not invent reopen)
 */

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
} from "./constants.js";
import { failAssignmentCommand } from "./errors.js";
import { SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS } from "./classifyCanonicalScoringActivity.js";

const PRE_MATCH_ALIASES = new Set([
  "PRE_MATCH",
  "NOT_STARTED",
  "SCHEDULED",
  "READY",
  "PENDING",
  "ASSIGNED",
  "ACKNOWLEDGED",
]);

const IN_PROGRESS_ALIASES = new Set([
  "IN_PROGRESS",
  "ACTIVE",
  "STARTED",
  "LIVE",
]);

const SCORING_ACTIVE_ALIASES = new Set([
  "SCORING_ACTIVE",
  "SCORING",
  "SCORE_ENTRY",
]);

const LOCKED_ALIASES = new Set(["LOCKED", "SUSPENDED", "PAUSED"]);

const COMPLETED_ALIASES = new Set([
  "COMPLETED",
  "COMPLETE",
  "FINISHED",
  "FINAL",
  "CLOSED",
]);

/**
 * Normalize product/match status into Owner lifecycle vocabulary.
 *
 * Precedence:
 *   no live / NOT_STARTED → PRE_MATCH
 *   PAUSED / LOCKED / SUSPENDED → LOCKED (scoring hint cannot overwrite)
 *   COMPLETED / FINISHED / FINAL / CLOSED → COMPLETED (scoring hint cannot overwrite)
 *   IN_PROGRESS / ACTIVE / STARTED / LIVE + scoringActive=false → IN_PROGRESS
 *   IN_PROGRESS / ACTIVE / STARTED / LIVE + scoringActive=true → SCORING_ACTIVE
 *
 * SCORING_ACTIVE is a refinement of IN_PROGRESS only.
 * @param {unknown} raw
 * @param {{ scoringActive?: boolean }} [hints]
 */
export function normalizeAssignmentLifecycleState(raw, hints = {}) {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!value) return ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH;
  if (LOCKED_ALIASES.has(value)) return ASSIGNMENT_LIFECYCLE_STATE.LOCKED;
  if (COMPLETED_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.COMPLETED;
  }
  if (PRE_MATCH_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH;
  }
  if (SCORING_ACTIVE_ALIASES.has(value)) {
    return ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE;
  }
  if (IN_PROGRESS_ALIASES.has(value)) {
    if (
      hints.scoringActive === true &&
      SCORING_ACTIVE_REFINEMENT_ONLY_FOR_IN_PROGRESS === "YES"
    ) {
      return ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE;
    }
    return ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS;
  }
  // Unknown → fail closed as LOCKED (safer than allowing mutation)
  return ASSIGNMENT_LIFECYCLE_STATE.LOCKED;
}

/**
 * @param {{
 *   command: string,
 *   lifecycleState: string,
 *   emergencyReplacement?: boolean,
 *   actorAuthorized?: boolean,
 *   emergencyAuthorized?: boolean,
 * }} input
 */
export function evaluateAssignmentLifecycleGate(input = {}) {
  const command = String(input.command || "").trim();
  const lifecycleState = normalizeAssignmentLifecycleState(input.lifecycleState);
  const actorAuthorized = input.actorAuthorized !== false;
  const emergencyReplacement = input.emergencyReplacement === true;
  const emergencyAuthorized = input.emergencyAuthorized === true;

  const deny = (reason, code = ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED) =>
    Object.freeze({
      ok: false,
      allowed: false,
      code,
      reason,
      lifecycleState,
      command,
    });

  const allow = (policy) =>
    Object.freeze({
      ok: true,
      allowed: true,
      code: null,
      reason: null,
      lifecycleState,
      command,
      policy,
    });

  if (!actorAuthorized) {
    return deny(
      "Actor is not authorized for assignment mutation",
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR
    );
  }

  if (
    lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.LOCKED ||
    lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.COMPLETED
  ) {
    return deny(
      `${lifecycleState} forbids assign/replace/unassign`,
      ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
    );
  }

  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH) {
    if (
      command === ASSIGNMENT_COMMAND.ASSIGN ||
      command === ASSIGNMENT_COMMAND.REPLACE ||
      command === ASSIGNMENT_COMMAND.UNASSIGN
    ) {
      return allow("PRE_MATCH_ALLOW");
    }
    return deny(`Unknown command ${command}`);
  }

  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS) {
    if (command === ASSIGNMENT_COMMAND.ASSIGN) {
      return deny(
        "IN_PROGRESS forbids new assignment (use atomic replace)",
        ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.UNASSIGN) {
      return deny(
        "IN_PROGRESS forbids unassign without replacement",
        ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.REPLACE) {
      return allow("IN_PROGRESS_ATOMIC_REPLACEMENT_ALLOW_AUTHORIZED");
    }
    return deny(`Unknown command ${command}`);
  }

  if (lifecycleState === ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE) {
    if (command === ASSIGNMENT_COMMAND.ASSIGN) {
      return deny(
        "SCORING_ACTIVE forbids normal assign",
        ASSIGNMENT_COMMAND_ERROR_CODE.LIFECYCLE_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.UNASSIGN) {
      return deny(
        "SCORING_ACTIVE forbids unassign without replacement",
        ASSIGNMENT_COMMAND_ERROR_CODE.UNASSIGN_WITHOUT_REPLACEMENT_DENIED
      );
    }
    if (command === ASSIGNMENT_COMMAND.REPLACE) {
      if (!emergencyReplacement) {
        return deny(
          "SCORING_ACTIVE requires explicit emergencyReplacement=true",
          ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_REPLACEMENT_REQUIRED
        );
      }
      if (!emergencyAuthorized) {
        return deny(
          "SCORING_ACTIVE emergency replacement requires emergency authorization",
          ASSIGNMENT_COMMAND_ERROR_CODE.EMERGENCY_UNAUTHORIZED
        );
      }
      return allow("SCORING_ACTIVE_ATOMIC_EMERGENCY_REPLACEMENT_ALLOW");
    }
    return deny(`Unknown command ${command}`);
  }

  return deny(`Lifecycle ${lifecycleState} forbids mutation`);
}

/**
 * Assert gate or throw.
 */
export function assertAssignmentLifecycleGate(input) {
  const result = evaluateAssignmentLifecycleGate(input);
  if (!result.allowed) {
    failAssignmentCommand(result.code, result.reason, {
      lifecycleState: result.lifecycleState,
      command: result.command,
    });
  }
  return result;
}
