/**
 * RefereeCandidate — assignment projection only (not an identity/profile aggregate).
 * displayLabel is optional non-authoritative projection data.
 * CORE-13 does not own names, phones, profile updates, auth, or certification persistence.
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";
import {
  normalizeOptionalStableId,
  normalizePreferenceTags,
  normalizeStableIdArray,
} from "../deterministic/normalize.js";
import {
  normalizeMetadata,
  ownedFreeze,
  rejectUnknownFields,
  requireBoolean,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "schemaVersion",
  "refereeId",
  "active",
  "userId",
  "playerId",
  "organizationIds",
  "clubIds",
  "qualificationRefs",
  "preferenceTags",
  "displayLabel",
  "metadata",
]);

/**
 * Forbidden profile-ish fields — reject if present (unknown-field path also covers these
 * when not allowlisted; listed explicitly for documentation clarity in tests).
 */
export const REFEREE_CANDIDATE_FORBIDDEN_PROFILE_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "password",
  "profile",
]);

/**
 * @param {object} [partial]
 */
export function createRefereeCandidate(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "RefereeCandidate"
  );

  const refereeId = requireStableId(
    partial.refereeId,
    "RefereeCandidate.refereeId",
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
  );

  let displayLabel = null;
  if (partial.displayLabel != null && partial.displayLabel !== "") {
    if (typeof partial.displayLabel !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
        "RefereeCandidate.displayLabel must be a string or null",
        { field: "displayLabel" }
      );
    }
    displayLabel = partial.displayLabel.trim() || null;
  }

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    refereeId,
    active: requireBoolean(
      partial.active === undefined ? true : partial.active,
      "RefereeCandidate.active"
    ),
    userId: normalizeOptionalStableId(partial.userId, "RefereeCandidate.userId"),
    playerId: normalizeOptionalStableId(
      partial.playerId,
      "RefereeCandidate.playerId"
    ),
    organizationIds: Object.freeze(
      normalizeStableIdArray(partial.organizationIds, {
        field: "RefereeCandidate.organizationIds",
        sort: true,
        unique: true,
      })
    ),
    clubIds: Object.freeze(
      normalizeStableIdArray(partial.clubIds, {
        field: "RefereeCandidate.clubIds",
        sort: true,
        unique: true,
      })
    ),
    qualificationRefs: Object.freeze(
      normalizeStableIdArray(partial.qualificationRefs, {
        field: "RefereeCandidate.qualificationRefs",
        sort: true,
        unique: true,
      })
    ),
    preferenceTags: Object.freeze(
      normalizePreferenceTags(
        partial.preferenceTags,
        "RefereeCandidate.preferenceTags"
      )
    ),
    displayLabel,
    metadata: normalizeMetadata(partial.metadata, "RefereeCandidate.metadata"),
  });
}
