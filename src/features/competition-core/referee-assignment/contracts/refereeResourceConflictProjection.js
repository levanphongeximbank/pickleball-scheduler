/**
 * Opaque projection of referee-domain conflict facts for CORE-14
 * Resource Conflict Resolver consumption.
 *
 * CORE-13 owns generation of these facts.
 * CORE-14 may resolve/aggregate cross-resource conflicts later.
 * Do not import CORE-14 implementation.
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_CONFLICT_TYPE_VALUES } from "../enums/conflictType.js";
import {
  REFEREE_DIAGNOSTIC_SEVERITY,
  REFEREE_DIAGNOSTIC_SEVERITY_VALUES,
} from "../enums/diagnosticSeverity.js";
import { REFEREE_RESOURCE_TYPE } from "../enums/snapshotStatus.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import { normalizeOptionalStableId, normalizeStableIdArray } from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  normalizeOptionalInstant,
  ownedFreeze,
  rejectUnknownFields,
  requireEnum,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "conflictId",
  "resourceType",
  "refereeId",
  "matchId",
  "conflictingMatchId",
  "conflictType",
  "startAt",
  "endAt",
  "severity",
  "reasonCodes",
  "metadata",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeResourceConflictProjection(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeResourceConflictProjection"
  );

  const resourceType = partial.resourceType ?? REFEREE_RESOURCE_TYPE.REFEREE;
  if (resourceType !== REFEREE_RESOURCE_TYPE.REFEREE) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      "resourceType must be REFEREE for CORE-13 projections",
      { resourceType }
    );
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    conflictId: requireStableId(
      partial.conflictId,
      "RefereeResourceConflictProjection.conflictId"
    ),
    resourceType: REFEREE_RESOURCE_TYPE.REFEREE,
    refereeId: requireStableId(
      partial.refereeId,
      "RefereeResourceConflictProjection.refereeId"
    ),
    matchId: requireStableId(
      partial.matchId,
      "RefereeResourceConflictProjection.matchId",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED
    ),
    conflictingMatchId: normalizeOptionalStableId(
      partial.conflictingMatchId,
      "conflictingMatchId"
    ),
    conflictType: requireEnum(
      partial.conflictType,
      "RefereeResourceConflictProjection.conflictType",
      REFEREE_CONFLICT_TYPE_VALUES
    ),
    startAt: normalizeOptionalInstant(
      partial.startAt,
      "RefereeResourceConflictProjection.startAt"
    ),
    endAt: normalizeOptionalInstant(
      partial.endAt,
      "RefereeResourceConflictProjection.endAt"
    ),
    severity: requireEnum(
      partial.severity ?? REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
      "severity",
      REFEREE_DIAGNOSTIC_SEVERITY_VALUES
    ),
    reasonCodes: Object.freeze(
      normalizeStableIdArray(partial.reasonCodes, {
        field: "reasonCodes",
        sort: true,
        unique: true,
      })
    ),
    metadata: normalizeMetadata(
      partial.metadata,
      "RefereeResourceConflictProjection.metadata"
    ),
  });
}
