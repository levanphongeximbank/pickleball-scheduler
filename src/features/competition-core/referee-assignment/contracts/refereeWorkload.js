import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "refereeId",
  "assignmentCount",
  "confirmedAssignmentCount",
  "plannedAssignmentCount",
  "consecutiveMatchCount",
  "courtTransitionCount",
  "minutesAssigned",
  "fairnessDelta",
  "fairnessScale",
  "roleCounts",
  "historicalAssignmentCount",
  "metadata",
]);

/**
 * Quantized workload measures — integers only.
 * historicalAssignmentCount is separate from current assignmentCount.
 * @param {object} [partial]
 */
export function createRefereeWorkload(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeWorkload"
  );

  /** @type {Record<string, number>} */
  const roleCountsObj = {};
  if (partial.roleCounts != null) {
    if (!isPlainObject(partial.roleCounts)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "roleCounts must be a plain object",
        {}
      );
    }
    const raw = /** @type {Record<string, unknown>} */ (partial.roleCounts);
    for (const key of Object.keys(raw).sort(compareStableString)) {
      const n = raw[key];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `roleCounts.${key} must be a non-negative integer`,
          { key, value: n }
        );
      }
      roleCountsObj[key] = n;
    }
  }

  const historicalAssignmentCount =
    partial.historicalAssignmentCount === undefined ||
    partial.historicalAssignmentCount === null
      ? null
      : requireNonNegativeInt(
          partial.historicalAssignmentCount,
          "historicalAssignmentCount"
        );

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    refereeId: requireStableId(partial.refereeId, "RefereeWorkload.refereeId"),
    assignmentCount: requireNonNegativeInt(
      partial.assignmentCount === undefined ? 0 : partial.assignmentCount,
      "RefereeWorkload.assignmentCount"
    ),
    confirmedAssignmentCount: requireNonNegativeInt(
      partial.confirmedAssignmentCount === undefined
        ? 0
        : partial.confirmedAssignmentCount,
      "confirmedAssignmentCount"
    ),
    plannedAssignmentCount: requireNonNegativeInt(
      partial.plannedAssignmentCount === undefined
        ? 0
        : partial.plannedAssignmentCount,
      "plannedAssignmentCount"
    ),
    consecutiveMatchCount: requireNonNegativeInt(
      partial.consecutiveMatchCount === undefined
        ? 0
        : partial.consecutiveMatchCount,
      "RefereeWorkload.consecutiveMatchCount"
    ),
    courtTransitionCount: requireNonNegativeInt(
      partial.courtTransitionCount === undefined
        ? 0
        : partial.courtTransitionCount,
      "RefereeWorkload.courtTransitionCount"
    ),
    minutesAssigned: requireNonNegativeInt(
      partial.minutesAssigned === undefined ? 0 : partial.minutesAssigned,
      "RefereeWorkload.minutesAssigned"
    ),
    fairnessDelta: requireNonNegativeInt(
      partial.fairnessDelta === undefined ? 0 : partial.fairnessDelta,
      "RefereeWorkload.fairnessDelta"
    ),
    fairnessScale: requireNonNegativeInt(
      partial.fairnessScale === undefined ? 0 : partial.fairnessScale,
      "RefereeWorkload.fairnessScale"
    ),
    roleCounts: ownedFreeze(roleCountsObj),
    historicalAssignmentCount,
    metadata: normalizeMetadata(partial.metadata, "RefereeWorkload.metadata"),
  });
}
