import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import {
  REFEREE_CONFLICT_TYPE_VALUES,
} from "../enums/conflictType.js";
import {
  REFEREE_DIAGNOSTIC_SEVERITY,
  REFEREE_DIAGNOSTIC_SEVERITY_VALUES,
} from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import {
  normalizeOptionalStableId,
  normalizeStableIdArray,
} from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
  requireStableId,
} from "./shared.js";
import { isRefereeAssignmentDiagnosticCode } from "../errors/diagnosticCodes.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "conflictId",
  "conflictType",
  "refereeId",
  "matchId",
  "relatedMatchIds",
  "relatedIds",
  "severity",
  "reasonCodes",
  "startAt",
  "endAt",
  "metadata",
]);

/**
 * Referee-domain conflict fact (CORE-13 owned).
 * @param {object} [partial]
 */
export function createRefereeConflict(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeConflict"
  );

  const reasonCodes = Object.freeze(
    normalizeStableIdArray(partial.reasonCodes, {
      field: "RefereeConflict.reasonCodes",
      sort: true,
      unique: true,
    }).map((code) => {
      if (!isRefereeAssignmentDiagnosticCode(code) && typeof code === "string") {
        return code;
      }
      return code;
    })
  );

  for (const code of reasonCodes) {
    if (typeof code !== "string" || code.trim() === "") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "reasonCodes must be non-empty strings",
        {}
      );
    }
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    conflictId: requireStableId(partial.conflictId, "RefereeConflict.conflictId"),
    conflictType: requireEnum(
      partial.conflictType,
      "RefereeConflict.conflictType",
      REFEREE_CONFLICT_TYPE_VALUES
    ),
    refereeId: requireStableId(partial.refereeId, "RefereeConflict.refereeId"),
    matchId: requireStableId(
      partial.matchId,
      "RefereeConflict.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    relatedMatchIds: Object.freeze(
      normalizeStableIdArray(partial.relatedMatchIds, {
        field: "relatedMatchIds",
        sort: true,
        unique: true,
      })
    ),
    relatedIds: Object.freeze(
      normalizeStableIdArray(partial.relatedIds, {
        field: "relatedIds",
        sort: true,
        unique: true,
      })
    ),
    severity: requireEnum(
      partial.severity ?? REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
      "RefereeConflict.severity",
      REFEREE_DIAGNOSTIC_SEVERITY_VALUES
    ),
    reasonCodes,
    startAt: normalizeOptionalInstant(partial.startAt, "RefereeConflict.startAt"),
    endAt: normalizeOptionalInstant(partial.endAt, "RefereeConflict.endAt"),
    metadata: normalizeMetadata(partial.metadata, "RefereeConflict.metadata"),
  });
}

void normalizeOptionalStableId;
