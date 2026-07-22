import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import {
  REFEREE_DIAGNOSTIC_SEVERITY,
  REFEREE_DIAGNOSTIC_SEVERITY_VALUES,
} from "../enums/diagnosticSeverity.js";
import {
  REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE,
  isRefereeAssignmentDiagnosticCode,
} from "../errors/diagnosticCodes.js";
import { resolveDefaultDiagnosticSeverity } from "../errors/failureSemantics.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId, normalizeStableIdArray } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "code",
  "message",
  "severity",
  "details",
  "matchId",
  "refereeId",
  "causedBy",
  "reasonCodes",
]);

/**
 * Fatal / envelope failure. For manual rejection use code MANUAL_ASSIGNMENT_REJECTED
 * and preserve underlying reason in causedBy / reasonCodes.
 * @param {object} [partial]
 */
export function createRefereeAssignmentFailure(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentFailure"
  );

  const code =
    typeof partial.code === "string" && isRefereeAssignmentDiagnosticCode(partial.code)
      ? partial.code
      : null;
  if (!code) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeAssignmentFailure.code must be a known diagnostic code",
      { code: partial.code ?? null }
    );
  }

  const message =
    typeof partial.message === "string" && partial.message.trim()
      ? partial.message.trim()
      : code;

  const causedBy =
    partial.causedBy == null || partial.causedBy === ""
      ? null
      : typeof partial.causedBy === "string" &&
          isRefereeAssignmentDiagnosticCode(partial.causedBy)
        ? partial.causedBy
        : typeof partial.causedBy === "string" && partial.causedBy.trim()
          ? partial.causedBy.trim()
          : (() => {
              throw new RefereeAssignmentContractError(
                REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
                "causedBy must be a diagnostic code string or null",
                {}
              );
            })();

  const reasonCodes = Object.freeze(
    normalizeStableIdArray(partial.reasonCodes, {
      field: "reasonCodes",
      sort: true,
      unique: true,
    })
  );

  if (
    (code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED ||
      code ===
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED) &&
    !causedBy &&
    reasonCodes.length === 0
  ) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${code} requires causedBy or reasonCodes`,
      {}
    );
  }

  const severity = requireEnum(
    partial.severity ?? resolveDefaultDiagnosticSeverity(code),
    "RefereeAssignmentFailure.severity",
    REFEREE_DIAGNOSTIC_SEVERITY_VALUES
  );

  // Manual envelope is always FATAL by convention
  if (
    code === REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED &&
    severity !== REFEREE_DIAGNOSTIC_SEVERITY.FATAL
  ) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "MANUAL_ASSIGNMENT_REJECTED severity must be FATAL",
      { severity }
    );
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    code,
    message,
    severity,
    details: normalizeMetadata(partial.details, "RefereeAssignmentFailure.details"),
    matchId: normalizeOptionalStableId(
      partial.matchId,
      "RefereeAssignmentFailure.matchId"
    ),
    refereeId: normalizeOptionalStableId(
      partial.refereeId,
      "RefereeAssignmentFailure.refereeId"
    ),
    causedBy,
    reasonCodes,
  });
}

/**
 * Helper: build manual rejection envelope preserving underlying reason.
 * @param {string} underlyingCode
 * @param {object} [options]
 */
export function createManualAssignmentRejection(underlyingCode, options = {}) {
  const causedBy =
    typeof underlyingCode === "string" && underlyingCode.trim()
      ? underlyingCode.trim()
      : null;
  if (!causedBy) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "underlying reason code required for manual rejection",
      {}
    );
  }
  return createRefereeAssignmentFailure({
    code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED,
    message:
      typeof options.message === "string" && options.message.trim()
        ? options.message.trim()
        : `Manual assignment rejected: ${causedBy}`,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
    causedBy,
    reasonCodes: options.reasonCodes ?? [causedBy],
    matchId: options.matchId ?? null,
    refereeId: options.refereeId ?? null,
    details: options.details ?? {},
  });
}
