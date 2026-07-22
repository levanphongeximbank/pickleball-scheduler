import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { normalizeRefereeRoleCode } from "../enums/roleCodes.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "tournamentId",
  "matchId",
  "roleCode",
  "assignmentId",
  "outgoingRefereeId",
  "incomingRefereeId",
  "reasonCode",
  "actorRef",
  "allowSoftOverride",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeReplacementRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeReplacementRequest"
  );

  const assignmentId = normalizeOptionalStableId(
    partial.assignmentId,
    "assignmentId"
  );
  const matchId = normalizeOptionalStableId(partial.matchId, "matchId");
  const roleCodeRaw = partial.roleCode;
  const roleCode =
    roleCodeRaw == null || roleCodeRaw === ""
      ? null
      : normalizeRefereeRoleCode(roleCodeRaw);

  if (!assignmentId && !(matchId && roleCode)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      "Replacement requires assignmentId or (matchId + roleCode)",
      { assignmentId, matchId, roleCode }
    );
  }

  if (roleCodeRaw != null && roleCodeRaw !== "" && !roleCode) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "RefereeReplacementRequest.roleCode is invalid",
      { field: "roleCode" }
    );
  }

  let reasonCode = null;
  if (partial.reasonCode != null && partial.reasonCode !== "") {
    if (typeof partial.reasonCode !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
        "reasonCode must be a string or null",
        {}
      );
    }
    reasonCode = partial.reasonCode.trim() || null;
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "RefereeReplacementRequest.requestId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "RefereeReplacementRequest.tenantId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
    ),
    tournamentId: requireStableId(
      partial.tournamentId,
      "RefereeReplacementRequest.tournamentId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
    ),
    matchId,
    roleCode,
    assignmentId,
    outgoingRefereeId: normalizeOptionalStableId(
      partial.outgoingRefereeId,
      "outgoingRefereeId"
    ),
    incomingRefereeId: requireStableId(
      partial.incomingRefereeId,
      "RefereeReplacementRequest.incomingRefereeId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST
    ),
    reasonCode,
    actorRef: normalizeOptionalStableId(partial.actorRef, "actorRef"),
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === undefined
        ? false
        : partial.allowSoftOverride,
      "allowSoftOverride"
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeReplacementRequest.metadata"
    ),
  });
}
