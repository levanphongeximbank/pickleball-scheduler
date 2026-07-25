/**
 * CoachReference — typed reference boundary only.
 * Does not own principal identity, membership, or player profile.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_STATUS_VALUES,
} from "../constants/lifecycles.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import { optionalId, requireNonEmptyId } from "./scope.js";
import {
  createScopedAggregateBase,
  optionalTrimmedString,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachReference(input = {}, deps = {}) {
  const coachPrincipalId = requireNonEmptyId(
    input.coachPrincipalId,
    "coachPrincipalId"
  );
  const coachMembershipId = optionalId(
    input.coachMembershipId,
    "coachMembershipId"
  );
  const status =
    input.status != null
      ? String(input.status)
      : RELATIONSHIP_STATUS.ACTIVE;
  if (!RELATIONSHIP_STATUS_VALUES.includes(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid coach reference status: ${status}`,
      { status }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "coachReferenceId",
    idPrefix: "cref",
    status,
    extra: {
      coachPrincipalId,
      coachMembershipId,
      displayLabel: optionalTrimmedString(input.displayLabel, "displayLabel", 200),
    },
  });
}

/**
 * Coach–player relationship (typed ids only).
 *
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachPlayerRelationship(input = {}, deps = {}) {
  const coachReferenceId = requireNonEmptyId(
    input.coachReferenceId,
    "coachReferenceId"
  );
  const playerId = requireNonEmptyId(input.playerId, "playerId");
  const programId = optionalId(input.programId, "programId");
  const status =
    input.status != null
      ? String(input.status)
      : RELATIONSHIP_STATUS.ACTIVE;
  if (!RELATIONSHIP_STATUS_VALUES.includes(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid relationship status: ${status}`,
      { status }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "relationshipId",
    idPrefix: "rel",
    status,
    extra: {
      coachReferenceId,
      playerId,
      programId,
    },
  });
}
