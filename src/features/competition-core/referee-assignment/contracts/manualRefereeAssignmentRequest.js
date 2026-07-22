import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ROLE_CODE, normalizeRefereeRoleCode } from "../enums/roleCodes.js";
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
  "refereeId",
  "roleCode",
  "actorRef",
  "allowSoftOverride",
  "metadata",
]);

/**
 * Manual assignment validation request.
 * Hard constraints are never overridable; soft only when allowSoftOverride=true.
 * @param {object} [partial]
 */
export function createManualRefereeAssignmentRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ManualRefereeAssignmentRequest"
  );

  const roleCode = normalizeRefereeRoleCode(partial.roleCode);
  if (!roleCode || roleCode === REFEREE_ROLE_CODE.ANY) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      "ManualRefereeAssignmentRequest.roleCode must be a concrete role (ANY is not assignable)",
      { field: "roleCode", roleCode: roleCode || null }
    );
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "ManualRefereeAssignmentRequest.requestId"
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "ManualRefereeAssignmentRequest.tenantId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
    ),
    tournamentId: requireStableId(
      partial.tournamentId,
      "ManualRefereeAssignmentRequest.tournamentId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
    ),
    matchId: requireStableId(
      partial.matchId,
      "ManualRefereeAssignmentRequest.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    refereeId: requireStableId(
      partial.refereeId,
      "ManualRefereeAssignmentRequest.refereeId"
    ),
    roleCode,
    actorRef: normalizeOptionalStableId(
      partial.actorRef,
      "ManualRefereeAssignmentRequest.actorRef"
    ),
    allowSoftOverride: requireBoolean(
      partial.allowSoftOverride === undefined
        ? false
        : partial.allowSoftOverride,
      "ManualRefereeAssignmentRequest.allowSoftOverride"
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "ManualRefereeAssignmentRequest.metadata"
    ),
  });
}
