import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import {
  REFEREE_DIAGNOSTIC_SEVERITY,
  REFEREE_DIAGNOSTIC_SEVERITY_VALUES,
} from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { isRefereeAssignmentDiagnosticCode } from "../errors/diagnosticCodes.js";
import { normalizeStableIdArray } from "../deterministic/normalize.js";
import { compareStableString } from "../deterministic/compare.js";
import { createRefereeConflict } from "./refereeConflict.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireEnum,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "matchId",
  "roleCode",
  "mandatory",
  "requiredCount",
  "assignedCount",
  "unfilledCount",
  "candidateCountEvaluated",
  "candidateCountEligible",
  "reasonCodes",
  "reasonCounts",
  "blockingConflicts",
  "evidenceRefs",
  "severity",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createUnassignedRefereeRequirement(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "UnassignedRefereeRequirement"
  );

  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "UnassignedRefereeRequirement.roleCode is required",
      { field: "roleCode" }
    );
  }

  const reasonCodes = Object.freeze(
    normalizeStableIdArray(partial.reasonCodes, {
      field: "reasonCodes",
      sort: true,
      unique: true,
    })
  );
  if (reasonCodes.length === 0) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "UnassignedRefereeRequirement.reasonCodes must be non-empty",
      {}
    );
  }
  for (const code of reasonCodes) {
    if (!isRefereeAssignmentDiagnosticCode(code)) {
      if (typeof code !== "string" || !code) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          "Invalid reason code",
          { code }
        );
      }
    }
  }

  /** @type {Record<string, number>} */
  const reasonCountsRaw =
    partial.reasonCounts && isPlainObject(partial.reasonCounts)
      ? /** @type {Record<string, unknown>} */ (partial.reasonCounts)
      : {};
  /** @type {Record<string, number>} */
  const reasonCountsObj = {};
  for (const key of Object.keys(reasonCountsRaw).sort(compareStableString)) {
    const n = reasonCountsRaw[key];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        `reasonCounts.${key} must be a non-negative integer`,
        { key, value: n }
      );
    }
    reasonCountsObj[key] = n;
  }

  const blockingConflicts = Object.freeze(
    (Array.isArray(partial.blockingConflicts)
      ? partial.blockingConflicts
      : []
    ).map((item, i) => {
      if (!isPlainObject(item)) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `blockingConflicts[${i}] must be a plain object`,
          { index: i }
        );
      }
      return createRefereeConflict(item);
    })
  );

  const requiredCount = requireNonNegativeInt(
    partial.requiredCount === undefined ? 1 : partial.requiredCount,
    "requiredCount"
  );
  const assignedCount = requireNonNegativeInt(
    partial.assignedCount === undefined ? 0 : partial.assignedCount,
    "assignedCount"
  );
  const unfilledCount = requireNonNegativeInt(
    partial.unfilledCount === undefined
      ? Math.max(0, requiredCount - assignedCount)
      : partial.unfilledCount,
    "unfilledCount"
  );

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    matchId: requireStableId(
      partial.matchId,
      "UnassignedRefereeRequirement.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    roleCode,
    mandatory: requireBoolean(
      partial.mandatory === undefined ? true : partial.mandatory,
      "mandatory"
    ),
    requiredCount,
    assignedCount,
    unfilledCount,
    candidateCountEvaluated: requireNonNegativeInt(
      partial.candidateCountEvaluated === undefined
        ? 0
        : partial.candidateCountEvaluated,
      "candidateCountEvaluated"
    ),
    candidateCountEligible: requireNonNegativeInt(
      partial.candidateCountEligible === undefined
        ? 0
        : partial.candidateCountEligible,
      "candidateCountEligible"
    ),
    reasonCodes,
    reasonCounts: ownedFreeze(reasonCountsObj),
    blockingConflicts,
    evidenceRefs: Object.freeze(
      normalizeStableIdArray(partial.evidenceRefs, {
        field: "evidenceRefs",
        sort: true,
        unique: true,
      })
    ),
    severity: requireEnum(
      partial.severity ?? REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
      "UnassignedRefereeRequirement.severity",
      REFEREE_DIAGNOSTIC_SEVERITY_VALUES
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "UnassignedRefereeRequirement.metadata"
    ),
  });
}
