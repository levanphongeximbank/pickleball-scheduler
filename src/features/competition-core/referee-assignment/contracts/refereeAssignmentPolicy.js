import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { CORE13_COMPARATOR_VERSION } from "../constants/versions.js";
import { normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import {
  REFEREE_SOFT_OBJECTIVE_KEY,
  isRefereeSoftObjectiveKey,
} from "../enums/softNotes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { createRefereeRoleRequirement } from "./refereeRoleRequirement.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "policyId",
  "policyVersion",
  "defaultRoleRequirements",
  "allowSelfRefereed",
  "maxSimultaneousAssignments",
  "softObjectiveKeys",
  "allowSoftOverride",
  "requireScheduleWindowForMandatoryRoles",
  "allowSameRefereeMultipleRolesOnMatch",
  "enableSeededExploration",
  "requireSeed",
  "preferredConcreteRoles",
  "consecutiveGapMinutesThreshold",
  "comparatorVersion",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeAssignmentPolicy(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentPolicy"
  );

  const rawReqs = Array.isArray(partial.defaultRoleRequirements)
    ? partial.defaultRoleRequirements
    : [
        {
          roleCode: "PRIMARY",
          mandatory: true,
          minCount: 1,
          maxCount: 1,
        },
      ];

  const defaultRoleRequirements = Object.freeze(
    rawReqs.map((item, index) => {
      try {
        return createRefereeRoleRequirement(item);
      } catch (err) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `RefereeAssignmentPolicy.defaultRoleRequirements[${index}] invalid`,
          {
            index,
            causeCode:
              err && typeof err === "object" && "code" in err
                ? /** @type {{ code: string }} */ (err).code
                : null,
          }
        );
      }
    })
  );

  const defaultObjectives = [
    REFEREE_SOFT_OBJECTIVE_KEY.WORKLOAD_BALANCE,
    REFEREE_SOFT_OBJECTIVE_KEY.CONSECUTIVE_MATCH_MINIMIZATION,
    REFEREE_SOFT_OBJECTIVE_KEY.COURT_TRANSITION_MINIMIZATION,
    REFEREE_SOFT_OBJECTIVE_KEY.ROLE_PREFERENCE,
  ];

  const softObjectiveKeys = Object.freeze(
    (Array.isArray(partial.softObjectiveKeys) &&
    partial.softObjectiveKeys.length > 0
      ? partial.softObjectiveKeys
      : defaultObjectives
    ).map((key, i) => {
      if (typeof key !== "string" || key.trim() === "") {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `softObjectiveKeys[${i}] must be a non-empty string`,
          { index: i }
        );
      }
      const trimmed = key.trim();
      if (!isRefereeSoftObjectiveKey(trimmed)) {
        throw new RefereeAssignmentContractError(
          REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
          `Unsupported soft objective key: ${trimmed}`,
          { key: trimmed }
        );
      }
      return trimmed;
    })
  );

  const preferredConcreteRoles = Object.freeze(
    (Array.isArray(partial.preferredConcreteRoles)
      ? partial.preferredConcreteRoles
      : []
    )
      .map((r) => normalizeRefereeRoleCode(r))
      .filter(Boolean)
  );

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    policyId: requireStableId(
      partial.policyId,
      "RefereeAssignmentPolicy.policyId"
    ),
    policyVersion: requireStableId(
      partial.policyVersion,
      "RefereeAssignmentPolicy.policyVersion"
    ),
    defaultRoleRequirements,
    allowSelfRefereed: requireBoolean(
      partial.allowSelfRefereed === undefined
        ? false
        : partial.allowSelfRefereed,
      "RefereeAssignmentPolicy.allowSelfRefereed"
    ),
    maxSimultaneousAssignments: requireNonNegativeInt(
      partial.maxSimultaneousAssignments === undefined
        ? 1
        : partial.maxSimultaneousAssignments,
      "RefereeAssignmentPolicy.maxSimultaneousAssignments"
    ),
    softObjectiveKeys,
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === undefined
        ? false
        : partial.allowSoftOverride,
      "RefereeAssignmentPolicy.allowSoftOverride"
    ),
    requireScheduleWindowForMandatoryRoles: requireBoolean(
      partial.requireScheduleWindowForMandatoryRoles === undefined
        ? true
        : partial.requireScheduleWindowForMandatoryRoles,
      "RefereeAssignmentPolicy.requireScheduleWindowForMandatoryRoles"
    ),
    allowSameRefereeMultipleRolesOnMatch: requireBoolean(
      partial.allowSameRefereeMultipleRolesOnMatch === undefined
        ? false
        : partial.allowSameRefereeMultipleRolesOnMatch,
      "allowSameRefereeMultipleRolesOnMatch"
    ),
    enableSeededExploration: requireBoolean(
      partial.enableSeededExploration === undefined
        ? false
        : partial.enableSeededExploration,
      "enableSeededExploration"
    ),
    requireSeed: requireBoolean(
      partial.requireSeed === undefined ? false : partial.requireSeed,
      "requireSeed"
    ),
    preferredConcreteRoles,
    consecutiveGapMinutesThreshold: requireNonNegativeInt(
      partial.consecutiveGapMinutesThreshold === undefined
        ? 30
        : partial.consecutiveGapMinutesThreshold,
      "consecutiveGapMinutesThreshold"
    ),
    comparatorVersion: String(
      partial.comparatorVersion ?? CORE13_COMPARATOR_VERSION
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentPolicy.metadata"
    ),
  });
}
