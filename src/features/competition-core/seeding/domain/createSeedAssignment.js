import { deepFreeze } from "./deepFreeze.js";
import { ASSIGNMENT_SOURCE_VALUES } from "./constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} SeedAssignment
 * @property {string} entryId
 * @property {number} seedNumber
 * @property {string} assignmentSource
 * @property {Readonly<Record<string, unknown>>} scoreValuesUsed
 * @property {ReadonlyArray<unknown>} orderedTieBreakValues
 * @property {string} policyId
 * @property {string} policyVersion
 * @property {string|null} snapshotId
 * @property {string|null} overrideId
 * @property {ReadonlyArray<string>} reasonCodes
 * @property {number} deterministicOrdinal
 * @property {string} assignmentFingerprint
 */

/**
 * Build an immutable SeedAssignment (doc 08 / 09).
 *
 * @param {Partial<SeedAssignment> & {
 *   entryId: string,
 *   seedNumber: number,
 *   assignmentSource: string,
 *   policyId: string,
 *   policyVersion: string,
 *   deterministicOrdinal: number,
 *   assignmentFingerprint: string,
 * }} partial
 * @returns {Readonly<SeedAssignment>}
 */
export function createSeedAssignment(partial) {
  if (!partial || typeof partial !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedAssignment partial is required"
    );
  }
  if (
    typeof partial.seedNumber !== "number" ||
    !Number.isInteger(partial.seedNumber) ||
    partial.seedNumber < 1
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "seedNumber must be a positive integer"
    );
  }
  if (!ASSIGNMENT_SOURCE_VALUES.has(partial.assignmentSource)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Invalid assignmentSource"
    );
  }

  return deepFreeze({
    entryId: String(partial.entryId),
    seedNumber: partial.seedNumber,
    assignmentSource: partial.assignmentSource,
    scoreValuesUsed: deepFreeze(
      partial.scoreValuesUsed && typeof partial.scoreValuesUsed === "object"
        ? { ...partial.scoreValuesUsed }
        : {}
    ),
    orderedTieBreakValues: deepFreeze(
      Array.isArray(partial.orderedTieBreakValues)
        ? partial.orderedTieBreakValues.slice()
        : []
    ),
    policyId: String(partial.policyId),
    policyVersion: String(partial.policyVersion),
    snapshotId: partial.snapshotId == null ? null : String(partial.snapshotId),
    overrideId: partial.overrideId == null ? null : String(partial.overrideId),
    reasonCodes: deepFreeze(
      Array.isArray(partial.reasonCodes)
        ? partial.reasonCodes.map((c) => String(c))
        : []
    ),
    deterministicOrdinal: Number(partial.deterministicOrdinal),
    assignmentFingerprint: String(partial.assignmentFingerprint),
  });
}
