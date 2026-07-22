import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "qualificationId",
  "refereeId",
  "roleCode",
  "certificationCode",
  "validFrom",
  "validTo",
  "level",
  "tenantId",
  "tournamentId",
  "metadata",
]);

/**
 * Qualification / certification evidence reference — not persistence ownership.
 * @param {object} [partial]
 */
export function createRefereeQualification(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeQualification"
  );

  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeQualification.roleCode is required",
      { field: "roleCode" }
    );
  }

  let level = null;
  if (partial.level != null && partial.level !== "") {
    if (typeof partial.level !== "string" && typeof partial.level !== "number") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "RefereeQualification.level must be string, number, or null",
        { field: "level" }
      );
    }
    level =
      typeof partial.level === "number"
        ? partial.level
        : String(partial.level).trim() || null;
    if (typeof level === "number" && !Number.isFinite(level)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "RefereeQualification.level must be finite",
        { field: "level" }
      );
    }
  }

  const certificationCode =
    partial.certificationCode == null || partial.certificationCode === ""
      ? null
      : typeof partial.certificationCode === "string"
        ? partial.certificationCode.trim() || null
        : (() => {
            throw new RefereeAssignmentContractError(
              REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
              "RefereeQualification.certificationCode must be a string or null",
              { field: "certificationCode" }
            );
          })();

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    qualificationId: requireStableId(
      partial.qualificationId,
      "RefereeQualification.qualificationId"
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeQualification.refereeId"
    ),
    roleCode,
    certificationCode,
    validFrom: normalizeOptionalInstant(
      partial.validFrom,
      "RefereeQualification.validFrom"
    ),
    validTo: normalizeOptionalInstant(
      partial.validTo,
      "RefereeQualification.validTo"
    ),
    level,
    tenantId: normalizeOptionalStableId(
      partial.tenantId,
      "RefereeQualification.tenantId"
    ),
    tournamentId: normalizeOptionalStableId(
      partial.tournamentId,
      "RefereeQualification.tournamentId"
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeQualification.metadata"
    ),
  });
}
