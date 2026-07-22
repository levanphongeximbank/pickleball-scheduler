import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_AUDIT_ACTION_VALUES } from "../enums/auditAction.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "auditId",
  "action",
  "requestId",
  "planFingerprint",
  "beforeRef",
  "afterRef",
  "actorRef",
  "reasonCode",
  "recordedAt",
  "payload",
  "metadata",
]);

/**
 * Audit metadata. recordedAt is supplied by AuditSinkPort — factories must not
 * invent wall-clock values; omit or pass through caller-provided string.
 * @param {object} [partial]
 */
export function createRefereeAssignmentAuditRecord(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentAuditRecord"
  );

  let payload = null;
  if (partial.payload != null) {
    if (!isPlainObject(partial.payload)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "payload must be a plain object or null",
        {}
      );
    }
    payload = ownedFreeze(partial.payload);
  }

  let reasonCode = null;
  if (partial.reasonCode != null && partial.reasonCode !== "") {
    if (typeof partial.reasonCode !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "reasonCode must be a string or null",
        {}
      );
    }
    reasonCode = partial.reasonCode.trim() || null;
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    auditId: requireStableId(
      partial.auditId,
      "RefereeAssignmentAuditRecord.auditId"
    ),
    action: requireEnum(
      partial.action,
      "RefereeAssignmentAuditRecord.action",
      REFEREE_AUDIT_ACTION_VALUES
    ),
    requestId: normalizeOptionalStableId(partial.requestId, "requestId"),
    planFingerprint: normalizeOptionalStableId(
      partial.planFingerprint,
      "planFingerprint"
    ),
    beforeRef: normalizeOptionalStableId(partial.beforeRef, "beforeRef"),
    afterRef: normalizeOptionalStableId(partial.afterRef, "afterRef"),
    actorRef: normalizeOptionalStableId(partial.actorRef, "actorRef"),
    reasonCode,
    recordedAt: normalizeOptionalInstant(
      partial.recordedAt,
      "RefereeAssignmentAuditRecord.recordedAt"
    ),
    payload,
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentAuditRecord.metadata"
    ),
  });
}
