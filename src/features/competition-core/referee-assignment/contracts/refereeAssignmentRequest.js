import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId, normalizeStableIdArray } from "../deterministic/normalize.js";
import { createRefereeAssignmentContext } from "./refereeAssignmentContext.js";
import { createRefereeAssignmentPolicy } from "./refereeAssignmentPolicy.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireStableId,
} from "./shared.js";
import { isPlainObject } from "../deterministic/canonicalize.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "requestId",
  "tenantId",
  "tournamentId",
  "matchIds",
  "policy",
  "context",
  "seed",
  "allowSoftOverride",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeAssignmentRequest(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeAssignmentRequest"
  );

  const tenantId = requireStableId(
    partial.tenantId,
    "RefereeAssignmentRequest.tenantId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED
  );
  const tournamentId = requireStableId(
    partial.tournamentId,
    "RefereeAssignmentRequest.tournamentId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED
  );

  if (!isPlainObject(partial.policy)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeAssignmentRequest.policy is required",
      { field: "policy" }
    );
  }
  if (!isPlainObject(partial.context)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "RefereeAssignmentRequest.context is required",
      { field: "context" }
    );
  }

  const policy = createRefereeAssignmentPolicy(partial.policy);
  const context = createRefereeAssignmentContext({
    ...partial.context,
    tenantId: partial.context.tenantId ?? tenantId,
    tournamentId: partial.context.tournamentId ?? tournamentId,
  });

  if (context.tenantId !== tenantId) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TENANT_SCOPE_REQUIRED,
      "context.tenantId must equal request.tenantId",
      { requestTenantId: tenantId, contextTenantId: context.tenantId }
    );
  }
  if (context.tournamentId !== tournamentId) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.TOURNAMENT_SCOPE_REQUIRED,
      "context.tournamentId must equal request.tournamentId",
      {
        requestTournamentId: tournamentId,
        contextTournamentId: context.tournamentId,
      }
    );
  }

  const matchIds = Object.freeze(
    normalizeStableIdArray(
      partial.matchIds != null ? partial.matchIds : context.matchIds,
      {
        field: "RefereeAssignmentRequest.matchIds",
        sort: true,
        unique: true,
      }
    )
  );

  if (matchIds.length === 0) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
      "RefereeAssignmentRequest.matchIds must be a non-empty array",
      { field: "matchIds" }
    );
  }

  let seed = null;
  if (partial.seed != null && partial.seed !== "") {
    if (typeof partial.seed !== "string" && typeof partial.seed !== "number") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "seed must be a string, integer, or null",
        { field: "seed" }
      );
    }
    if (typeof partial.seed === "number" && !Number.isInteger(partial.seed)) {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        "numeric seed must be an integer",
        { field: "seed" }
      );
    }
    seed = String(partial.seed);
  }

  const allowSoftOverride = requireBoolean(
    partial.allowSoftOverride === undefined
      ? policy.allowSoftOverride
      : partial.allowSoftOverride,
    "RefereeAssignmentRequest.allowSoftOverride"
  );

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    requestId: requireStableId(
      partial.requestId,
      "RefereeAssignmentRequest.requestId"
    ),
    tenantId,
    tournamentId,
    matchIds,
    policy,
    context,
    seed,
    allowSoftOverride,
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeAssignmentRequest.metadata"
    ),
  });
}

// silence unused import if tree-shaken oddly
void normalizeOptionalStableId;
