import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";
import {
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "roleCode",
  "mandatory",
  "minCount",
  "maxCount",
  "preferredRoleCode",
  "priority",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeRoleRequirement(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeRoleRequirement"
  );

  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeRoleRequirement.roleCode is required",
      { field: "roleCode" }
    );
  }

  const minCount = requireNonNegativeInt(
    partial.minCount === undefined ? 1 : partial.minCount,
    "RefereeRoleRequirement.minCount"
  );
  const maxCount = requireNonNegativeInt(
    partial.maxCount === undefined ? minCount : partial.maxCount,
    "RefereeRoleRequirement.maxCount"
  );
  if (maxCount < minCount) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeRoleRequirement.maxCount must be >= minCount",
      { minCount, maxCount }
    );
  }

  const preferredRoleCode =
    partial.preferredRoleCode == null || partial.preferredRoleCode === ""
      ? null
      : normalizeRefereeRoleCode(partial.preferredRoleCode);

  if (
    partial.preferredRoleCode != null &&
    partial.preferredRoleCode !== "" &&
    !preferredRoleCode
  ) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeRoleRequirement.preferredRoleCode is invalid",
      { field: "preferredRoleCode" }
    );
  }

  let priority = null;
  if (partial.priority != null && partial.priority !== "") {
    if (
      typeof partial.priority !== "number" ||
      !Number.isInteger(partial.priority) ||
      !Number.isFinite(partial.priority)
    ) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "RefereeRoleRequirement.priority must be a finite integer when present",
        { field: "priority" }
      );
    }
    priority = partial.priority;
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    roleCode,
    mandatory: requireBoolean(
      partial.mandatory === undefined ? true : partial.mandatory,
      "RefereeRoleRequirement.mandatory"
    ),
    minCount,
    maxCount,
    preferredRoleCode: preferredRoleCode
      ? preferredRoleCode
      : normalizeOptionalStableId(null, "preferredRoleCode"),
    priority,
  });
}
