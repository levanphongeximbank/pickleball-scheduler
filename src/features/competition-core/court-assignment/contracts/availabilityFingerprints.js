/**
 * CORE-12 Phase 1D-B1 — deterministic availability fingerprint helpers.
 * Derived fingerprints only — never fabricate upstream source snapshot IDs.
 */

import {
  CORE12_AVAILABILITY_PROJECTION_V1,
  CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
  CORE12_AVAILABILITY_QUERY_V1,
  CORE12_ELIGIBILITY_SNAPSHOT_V1,
} from "../constants/versions.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { compareStableString } from "../deterministic/compare.js";

export const CORE12_AVAILABILITY_PROVIDER_CONTRACT_VERSION =
  CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1;
export const CORE12_AVAILABILITY_PROJECTION_CONTRACT_VERSION =
  CORE12_AVAILABILITY_PROJECTION_V1;

/**
 * @param {unknown} ids
 * @returns {string[]}
 */
function sortedUniqueIds(ids) {
  const list = Array.isArray(ids) ? ids.map((id) => String(id)) : [];
  return [...list].sort(compareStableString);
}

/**
 * Deterministic query fingerprint material (ordering-insensitive for court id lists).
 * @param {object} queryFields
 * @returns {string}
 */
export function computeAvailabilityQueryFingerprint(queryFields) {
  const material = {
    kind: "CORE12_AVAILABILITY_QUERY_FINGERPRINT",
    derived: true,
    adapterContractVersion:
      queryFields.adapterContractVersion ?? CORE12_AVAILABILITY_QUERY_V1,
    providerContractVersion: CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
    tenantId: String(queryFields.tenantId ?? ""),
    clubId: String(queryFields.clubId ?? ""),
    venueId: String(queryFields.venueId ?? ""),
    competitionId: String(queryFields.competitionId ?? ""),
    timezone: String(queryFields.timezone ?? ""),
    windowStart: String(queryFields.windowStart ?? ""),
    windowEnd: String(queryFields.windowEnd ?? ""),
    civilDate: String(queryFields.civilDate ?? ""),
    civilStartTime: String(queryFields.civilStartTime ?? ""),
    civilEndTime: String(queryFields.civilEndTime ?? ""),
    requestedCourtIds: sortedUniqueIds(queryFields.requestedCourtIds),
    clusterId:
      queryFields.clusterId == null ? null : String(queryFields.clusterId),
  };
  return fingerprintValue(material);
}

/**
 * Derived eligibility fingerprint over a validated eligibility snapshot core.
 * @param {object} snapshotCore
 * @returns {string}
 */
export function computeDerivedEligibilityFingerprint(snapshotCore) {
  const material = {
    kind: "CORE12_DERIVED_ELIGIBILITY_FINGERPRINT",
    derived: true,
    eligibilitySnapshotVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
    providerContractVersion: CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
    queryFingerprint: String(snapshotCore.queryFingerprint ?? ""),
    tenantId: String(snapshotCore.tenantId ?? ""),
    clubId: String(snapshotCore.clubId ?? ""),
    venueId: String(snapshotCore.venueId ?? ""),
    competitionId: String(snapshotCore.competitionId ?? ""),
    timezone: String(snapshotCore.timezone ?? ""),
    windowStart: String(snapshotCore.windowStart ?? ""),
    windowEnd: String(snapshotCore.windowEnd ?? ""),
    civilDate: String(snapshotCore.civilDate ?? ""),
    civilStartTime: String(snapshotCore.civilStartTime ?? ""),
    civilEndTime: String(snapshotCore.civilEndTime ?? ""),
    eligibleCourtIds: sortedUniqueIds(snapshotCore.eligibleCourtIds),
    ineligibleCourtIds: sortedUniqueIds(
      (snapshotCore.ineligibleCourts || []).map((row) => row.courtId)
    ),
    sourceSnapshotId:
      snapshotCore.sourceSnapshotId == null
        ? null
        : String(snapshotCore.sourceSnapshotId),
    sourceSnapshotVersion:
      snapshotCore.sourceSnapshotVersion == null
        ? null
        : String(snapshotCore.sourceSnapshotVersion),
    sourceContractVersion:
      snapshotCore.sourceContractVersion == null
        ? null
        : String(snapshotCore.sourceContractVersion),
  };
  return fingerprintValue(material);
}

/**
 * @param {unknown} caps
 * @returns {unknown}
 */
function canonicalizeCapabilitiesForFingerprint(caps) {
  if (Array.isArray(caps)) {
    return [...caps].map(String).sort(compareStableString);
  }
  if (caps && typeof caps === "object") {
    return caps;
  }
  return {};
}

/**
 * Derived availability fingerprint over projected AvailableCourtInput courts.
 * Metadata is intentionally excluded (ordering drift / non-assignment material).
 * @param {object} projectionCore
 * @returns {string}
 */
export function computeDerivedAvailabilityFingerprint(projectionCore) {
  const courts = Array.isArray(projectionCore.courts)
    ? projectionCore.courts
    : [];
  const courtMaterial = courts
    .map((c) => ({
      courtId: String(c.courtId),
      venueId: String(c.venueId),
      clubId: String(c.clubId),
      availabilityStatus: String(c.availabilityStatus),
      active: Boolean(c.active),
      eligible: Boolean(c.eligible),
      priority: Number(c.priority),
      availabilityIntervals: (c.availabilityIntervals || []).map((iv) => ({
        start: String(iv.start),
        end: String(iv.end),
      })),
      capabilities: canonicalizeCapabilitiesForFingerprint(c.capabilities),
    }))
    .sort((a, b) => compareStableString(a.courtId, b.courtId));

  const material = {
    kind: "CORE12_DERIVED_AVAILABILITY_FINGERPRINT",
    derived: true,
    projectionContractVersion: CORE12_AVAILABILITY_PROJECTION_V1,
    queryFingerprint: String(projectionCore.queryFingerprint ?? ""),
    derivedEligibilityFingerprint: String(
      projectionCore.derivedEligibilityFingerprint ?? ""
    ),
    windowStart: String(projectionCore.windowStart ?? ""),
    windowEnd: String(projectionCore.windowEnd ?? ""),
    courts: courtMaterial,
  };
  return fingerprintValue(material);
}
