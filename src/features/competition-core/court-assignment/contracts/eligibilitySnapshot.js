/**
 * CORE-12 Phase 1D-B1 — EligibilitySnapshot (eligibility evidence only).
 * eligibleCourtIds are NOT court inventory / descriptors.
 */

import { CORE12_ELIGIBILITY_SNAPSHOT_V1 } from "../constants/versions.js";
import { computeDerivedEligibilityFingerprint } from "./availabilityFingerprints.js";
import { compareStableString } from "../deterministic/compare.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { AVAILABILITY_BRIDGE_CODE } from "./availabilityBridgeCodes.js";
import { createExactAvailabilityQueryWindow } from "./exactAvailabilityQueryWindow.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";

/**
 * @param {Record<string, unknown>} partial
 * @returns {Record<string, unknown>}
 */
function omitInternalFields(partial) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(partial || {})) {
    if (key.startsWith("_") || key === "derived") continue;
    out[key] = value;
  }
  return out;
}

const ALLOWED = Object.freeze([
  "schemaVersion",
  "tenantId",
  "clubId",
  "venueId",
  "competitionId",
  "timezone",
  "windowStart",
  "windowEnd",
  "civilDate",
  "civilStartTime",
  "civilEndTime",
  "eligibleCourtIds",
  "ineligibleCourts",
  "sourceSnapshotId",
  "sourceSnapshotVersion",
  "sourceContractVersion",
  "queryFingerprint",
  "derivedEligibilityFingerprint",
  "metadata",
]);

const INELIGIBLE_ALLOWED = Object.freeze([
  "courtId",
  "reasons",
  "codes",
  "metadata",
]);

/**
 * @param {unknown} row
 * @param {string} path
 */
function normalizeIneligible(row, path) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (row),
    INELIGIBLE_ALLOWED,
    path,
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  const courtId = requireStableId(
    /** @type {{ courtId?: unknown }} */ (row).courtId,
    `${path}.courtId`,
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  const reasonsRaw = /** @type {{ reasons?: unknown }} */ (row).reasons;
  const reasons = Object.freeze(
    Array.isArray(reasonsRaw)
      ? reasonsRaw.map((r, i) => {
          if (typeof r !== "string" || r.trim() === "") {
            throw new CourtAssignmentContractError(
              AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
              `${path}.reasons[${i}] must be a non-empty string`,
              { index: i }
            );
          }
          return r.trim();
        })
      : []
  );
  const codesRaw = /** @type {{ codes?: unknown }} */ (row).codes;
  const codes = Object.freeze(
    Array.isArray(codesRaw)
      ? codesRaw.map((c, i) => {
          if (typeof c !== "string" || c.trim() === "") {
            throw new CourtAssignmentContractError(
              AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
              `${path}.codes[${i}] must be a non-empty string`,
              { index: i }
            );
          }
          return c.trim();
        })
      : []
  );
  return Object.freeze({
    courtId,
    reasons,
    codes,
    metadata: cloneFreezeObject(
      /** @type {{ metadata?: unknown }} */ (row).metadata,
      `${path}.metadata`
    ),
  });
}

/**
 * @param {object} [partial]
 */
export function createEligibilitySnapshot(partial = {}) {
  if (partial == null || typeof partial !== "object" || Array.isArray(partial)) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
      "EligibilitySnapshot must be a plain object",
      {}
    );
  }

  const cleaned = omitInternalFields(
    /** @type {Record<string, unknown>} */ (partial)
  );

  rejectUnknownFields(
    cleaned,
    ALLOWED,
    "EligibilitySnapshot",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );

  const schemaVersion = requireStableId(
    cleaned.schemaVersion ?? CORE12_ELIGIBILITY_SNAPSHOT_V1,
    "EligibilitySnapshot.schemaVersion",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  if (schemaVersion !== CORE12_ELIGIBILITY_SNAPSHOT_V1) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
      `Unsupported EligibilitySnapshot.schemaVersion: ${schemaVersion}`,
      { schemaVersion, expected: CORE12_ELIGIBILITY_SNAPSHOT_V1 }
    );
  }

  const tenantId = requireStableId(
    cleaned.tenantId,
    "EligibilitySnapshot.tenantId",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  const clubId = requireStableId(
    cleaned.clubId,
    "EligibilitySnapshot.clubId",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  const venueId = requireStableId(
    cleaned.venueId,
    "EligibilitySnapshot.venueId",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );
  const competitionId = requireStableId(
    cleaned.competitionId,
    "EligibilitySnapshot.competitionId",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );

  const window = createExactAvailabilityQueryWindow({
    timezone: cleaned.timezone,
    windowStart: cleaned.windowStart,
    windowEnd: cleaned.windowEnd,
    civilDate: cleaned.civilDate,
    civilStartTime: cleaned.civilStartTime,
    civilEndTime: cleaned.civilEndTime,
  });

  if (!Array.isArray(cleaned.eligibleCourtIds)) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
      "EligibilitySnapshot.eligibleCourtIds must be an array",
      {}
    );
  }

  const seen = new Set();
  const eligibleCourtIds = [];
  for (let i = 0; i < cleaned.eligibleCourtIds.length; i += 1) {
    const id = requireStableId(
      cleaned.eligibleCourtIds[i],
      `EligibilitySnapshot.eligibleCourtIds[${i}]`,
      AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
    );
    if (seen.has(id)) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.DUPLICATE_ELIGIBLE_COURT_ID,
        `Duplicate eligibleCourtId: ${id}`,
        { courtId: id }
      );
    }
    seen.add(id);
    eligibleCourtIds.push(id);
  }
  eligibleCourtIds.sort(compareStableString);

  const ineligibleRaw = Array.isArray(cleaned.ineligibleCourts)
    ? cleaned.ineligibleCourts
    : [];
  const ineligibleCourts = ineligibleRaw.map((row, i) =>
    normalizeIneligible(row, `EligibilitySnapshot.ineligibleCourts[${i}]`)
  );
  ineligibleCourts.sort((a, b) => compareStableString(a.courtId, b.courtId));

  const sourceSnapshotId =
    cleaned.sourceSnapshotId == null
      ? null
      : requireStableId(
          cleaned.sourceSnapshotId,
          "EligibilitySnapshot.sourceSnapshotId",
          AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
        );
  const sourceSnapshotVersion =
    cleaned.sourceSnapshotVersion == null
      ? null
      : requireStableId(
          cleaned.sourceSnapshotVersion,
          "EligibilitySnapshot.sourceSnapshotVersion",
          AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
        );
  const sourceContractVersion =
    cleaned.sourceContractVersion == null
      ? null
      : requireStableId(
          cleaned.sourceContractVersion,
          "EligibilitySnapshot.sourceContractVersion",
          AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
        );

  const queryFingerprint = requireStableId(
    cleaned.queryFingerprint,
    "EligibilitySnapshot.queryFingerprint",
    AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
  );

  const computedDerived = computeDerivedEligibilityFingerprint({
    queryFingerprint,
    tenantId,
    clubId,
    venueId,
    competitionId,
    timezone: window.timezone,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    civilDate: window.civilDate,
    civilStartTime: window.civilStartTime,
    civilEndTime: window.civilEndTime,
    eligibleCourtIds,
    ineligibleCourts,
    sourceSnapshotId,
    sourceSnapshotVersion,
    sourceContractVersion,
  });

  if (cleaned.derivedEligibilityFingerprint != null) {
    const provided = requireStableId(
      cleaned.derivedEligibilityFingerprint,
      "EligibilitySnapshot.derivedEligibilityFingerprint",
      AVAILABILITY_BRIDGE_CODE.SNAPSHOT_FINGERPRINT_MISMATCH
    );
    if (provided !== computedDerived) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.SNAPSHOT_FINGERPRINT_MISMATCH,
        "EligibilitySnapshot.derivedEligibilityFingerprint mismatch",
        { provided, expected: computedDerived }
      );
    }
  }

  return Object.freeze({
    schemaVersion,
    tenantId,
    clubId,
    venueId,
    competitionId,
    timezone: window.timezone,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    civilDate: window.civilDate,
    civilStartTime: window.civilStartTime,
    civilEndTime: window.civilEndTime,
    eligibleCourtIds: Object.freeze(eligibleCourtIds),
    ineligibleCourts: Object.freeze(ineligibleCourts),
    /** Upstream source identity — null when CAA/provider does not supply it. Never invent. */
    sourceSnapshotId,
    sourceSnapshotVersion,
    sourceContractVersion,
    queryFingerprint,
    /** Always derived — labeled on the field name. */
    derivedEligibilityFingerprint: computedDerived,
    derived: true,
    metadata: cloneFreezeObject(cleaned.metadata, "EligibilitySnapshot.metadata"),
    _startMs: window._startMs,
    _endMs: window._endMs,
  });
}
