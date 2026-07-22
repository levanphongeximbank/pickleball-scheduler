/**
 * CORE-12 — CourtAssignmentPolicy.
 *
 * Documented defaults (applied only when field omitted):
 * - partialAssignmentAllowed = false
 * - overrideManualLocks = false
 * - acceptLockedAssignments = true
 * - invalidLockBehavior = CONFLICT
 * - allowUnscheduledMatches = false
 * - skipTerminalStatuses = true
 * - terminalStatuses = ["completed","forfeit"]
 * - matchOrderingStrategy = STABLE_PRIORITY_THEN_ID
 * - courtOrderingStrategy = STABLE_PRIORITY_THEN_ID
 * - requireVenueTimezone = true
 * - requireAvailabilitySnapshot = true
 * - capabilityMatchMode = HARD
 * - overlapMode = HALF_OPEN
 * - comparatorVersion = CORE12_COMPARATOR_V1
 * - courtSelectionStrategyVersion = CORE12_GREEDY_FIRST_ELIGIBLE_V1
 * - policyVersion must equal CORE12_POLICY_V1
 */

import {
  CORE12_COMPARATOR_VERSION,
  CORE12_COURT_SELECTION_STRATEGY_VERSION,
  CORE12_POLICY_VERSION,
} from "../constants/versions.js";
import {
  CAPABILITY_MATCH_MODE,
  CAPABILITY_MATCH_MODE_VALUES,
  COURT_ORDERING_STRATEGY,
  COURT_ORDERING_STRATEGY_VALUES,
  INVALID_LOCK_BEHAVIOR,
  INVALID_LOCK_BEHAVIOR_VALUES,
  MATCH_ORDERING_STRATEGY,
  MATCH_ORDERING_STRATEGY_VALUES,
  OVERLAP_MODE,
  OVERLAP_MODE_VALUES,
} from "../enums/index.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import {
  rejectUnknownFields,
  requireBoolean,
  requireEnum,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "policyId",
  "policyVersion",
  "partialAssignmentAllowed",
  "overrideManualLocks",
  "acceptLockedAssignments",
  "invalidLockBehavior",
  "allowUnscheduledMatches",
  "skipTerminalStatuses",
  "terminalStatuses",
  "matchOrderingStrategy",
  "courtOrderingStrategy",
  "requireVenueTimezone",
  "requireAvailabilitySnapshot",
  "capabilityMatchMode",
  "overlapMode",
  "comparatorVersion",
  "courtSelectionStrategyVersion",
]);

/**
 * @param {object} [partial]
 */
export function createCourtAssignmentPolicy(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CourtAssignmentPolicy"
  );

  const policyVersion = requireStableId(
    partial.policyVersion ?? CORE12_POLICY_VERSION,
    "CourtAssignmentPolicy.policyVersion",
    COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION
  );
  if (policyVersion !== CORE12_POLICY_VERSION) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION,
      `Unsupported policyVersion: ${policyVersion}`,
      { policyVersion, expected: CORE12_POLICY_VERSION }
    );
  }

  const comparatorVersion = requireStableId(
    partial.comparatorVersion ?? CORE12_COMPARATOR_VERSION,
    "CourtAssignmentPolicy.comparatorVersion",
    COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION
  );
  if (comparatorVersion !== CORE12_COMPARATOR_VERSION) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION,
      `Unsupported comparatorVersion: ${comparatorVersion}`,
      { comparatorVersion, expected: CORE12_COMPARATOR_VERSION }
    );
  }

  const courtSelectionStrategyVersion = requireStableId(
    partial.courtSelectionStrategyVersion ??
      CORE12_COURT_SELECTION_STRATEGY_VERSION,
    "CourtAssignmentPolicy.courtSelectionStrategyVersion",
    COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION
  );
  if (
    courtSelectionStrategyVersion !== CORE12_COURT_SELECTION_STRATEGY_VERSION
  ) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION,
      `Unsupported courtSelectionStrategyVersion: ${courtSelectionStrategyVersion}`,
      {
        courtSelectionStrategyVersion,
        expected: CORE12_COURT_SELECTION_STRATEGY_VERSION,
      }
    );
  }

  let terminalStatuses = partial.terminalStatuses;
  if (terminalStatuses == null) {
    terminalStatuses = ["completed", "forfeit"];
  }
  if (!Array.isArray(terminalStatuses)) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
      "CourtAssignmentPolicy.terminalStatuses must be an array of strings",
      {}
    );
  }
  const normalizedTerminals = [];
  for (let i = 0; i < terminalStatuses.length; i += 1) {
    const s = terminalStatuses[i];
    if (typeof s !== "string" || s.trim() === "") {
      throw new CourtAssignmentContractError(
        COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
        `CourtAssignmentPolicy.terminalStatuses[${i}] must be a non-empty string`,
        { index: i }
      );
    }
    normalizedTerminals.push(s.trim().toLowerCase());
  }

  return Object.freeze({
    policyId: requireStableId(
      partial.policyId,
      "CourtAssignmentPolicy.policyId"
    ),
    policyVersion,
    partialAssignmentAllowed: requireBoolean(
      partial.partialAssignmentAllowed ?? false,
      "CourtAssignmentPolicy.partialAssignmentAllowed"
    ),
    overrideManualLocks: requireBoolean(
      partial.overrideManualLocks ?? false,
      "CourtAssignmentPolicy.overrideManualLocks"
    ),
    acceptLockedAssignments: requireBoolean(
      partial.acceptLockedAssignments ?? true,
      "CourtAssignmentPolicy.acceptLockedAssignments"
    ),
    invalidLockBehavior: requireEnum(
      partial.invalidLockBehavior ?? INVALID_LOCK_BEHAVIOR.CONFLICT,
      INVALID_LOCK_BEHAVIOR_VALUES,
      "CourtAssignmentPolicy.invalidLockBehavior"
    ),
    allowUnscheduledMatches: requireBoolean(
      partial.allowUnscheduledMatches ?? false,
      "CourtAssignmentPolicy.allowUnscheduledMatches"
    ),
    skipTerminalStatuses: requireBoolean(
      partial.skipTerminalStatuses ?? true,
      "CourtAssignmentPolicy.skipTerminalStatuses"
    ),
    terminalStatuses: Object.freeze(normalizedTerminals),
    matchOrderingStrategy: requireEnum(
      partial.matchOrderingStrategy ??
        MATCH_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
      MATCH_ORDERING_STRATEGY_VALUES,
      "CourtAssignmentPolicy.matchOrderingStrategy"
    ),
    courtOrderingStrategy: requireEnum(
      partial.courtOrderingStrategy ??
        COURT_ORDERING_STRATEGY.STABLE_PRIORITY_THEN_ID,
      COURT_ORDERING_STRATEGY_VALUES,
      "CourtAssignmentPolicy.courtOrderingStrategy"
    ),
    requireVenueTimezone: requireBoolean(
      partial.requireVenueTimezone ?? true,
      "CourtAssignmentPolicy.requireVenueTimezone"
    ),
    requireAvailabilitySnapshot: requireBoolean(
      partial.requireAvailabilitySnapshot ?? true,
      "CourtAssignmentPolicy.requireAvailabilitySnapshot"
    ),
    capabilityMatchMode: requireEnum(
      partial.capabilityMatchMode ?? CAPABILITY_MATCH_MODE.HARD,
      CAPABILITY_MATCH_MODE_VALUES,
      "CourtAssignmentPolicy.capabilityMatchMode"
    ),
    overlapMode: requireEnum(
      partial.overlapMode ?? OVERLAP_MODE.HALF_OPEN,
      OVERLAP_MODE_VALUES,
      "CourtAssignmentPolicy.overlapMode"
    ),
    comparatorVersion,
    courtSelectionStrategyVersion,
  });
}
