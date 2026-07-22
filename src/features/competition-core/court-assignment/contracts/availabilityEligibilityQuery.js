/**
 * CORE-12 Phase 1D-B1 — availability eligibility query (provider input).
 */

import {
  CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
  CORE12_AVAILABILITY_QUERY_V1,
} from "../constants/versions.js";
import { computeAvailabilityQueryFingerprint } from "./availabilityFingerprints.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { AVAILABILITY_BRIDGE_CODE } from "./availabilityBridgeCodes.js";
import { createExactAvailabilityQueryWindow } from "./exactAvailabilityQueryWindow.js";
import {
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";
import { compareStableString } from "../deterministic/compare.js";

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
  "requestedCourtIds",
  "clusterId",
  "queryFingerprint",
  "adapterContractVersion",
  "providerContractVersion",
]);

/**
 * @param {object} [partial]
 */
export function createAvailabilityEligibilityQuery(partial = {}) {
  const cleaned = omitInternalFields(
    /** @type {Record<string, unknown>} */ (partial)
  );
  rejectUnknownFields(
    cleaned,
    ALLOWED,
    "AvailabilityEligibilityQuery",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );

  const tenantId = requireStableId(
    cleaned.tenantId,
    "AvailabilityEligibilityQuery.tenantId",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
  const clubId = requireStableId(
    cleaned.clubId,
    "AvailabilityEligibilityQuery.clubId",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
  const venueId = requireStableId(
    cleaned.venueId,
    "AvailabilityEligibilityQuery.venueId",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
  const competitionId = requireStableId(
    cleaned.competitionId,
    "AvailabilityEligibilityQuery.competitionId",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );

  const window = createExactAvailabilityQueryWindow({
    timezone: cleaned.timezone,
    windowStart: cleaned.windowStart,
    windowEnd: cleaned.windowEnd,
    civilDate: cleaned.civilDate,
    civilStartTime: cleaned.civilStartTime,
    civilEndTime: cleaned.civilEndTime,
  });

  let requestedCourtIds = Object.freeze([]);
  if (cleaned.requestedCourtIds != null) {
    if (!Array.isArray(cleaned.requestedCourtIds)) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY,
        "AvailabilityEligibilityQuery.requestedCourtIds must be an array",
        {}
      );
    }
    const seen = new Set();
    const ids = [];
    for (let i = 0; i < cleaned.requestedCourtIds.length; i += 1) {
      const id = requireStableId(
        cleaned.requestedCourtIds[i],
        `AvailabilityEligibilityQuery.requestedCourtIds[${i}]`,
        AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
      );
      if (seen.has(id)) {
        throw new CourtAssignmentContractError(
          AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY,
          "AvailabilityEligibilityQuery.requestedCourtIds contains duplicates",
          { courtId: id }
        );
      }
      seen.add(id);
      ids.push(id);
    }
    ids.sort(compareStableString);
    requestedCourtIds = Object.freeze(ids);
  }

  const clusterId =
    cleaned.clusterId == null
      ? null
      : requireStableId(
          cleaned.clusterId,
          "AvailabilityEligibilityQuery.clusterId",
          AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
        );

  const adapterContractVersion = requireStableId(
    cleaned.adapterContractVersion ?? CORE12_AVAILABILITY_QUERY_V1,
    "AvailabilityEligibilityQuery.adapterContractVersion",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
  if (adapterContractVersion !== CORE12_AVAILABILITY_QUERY_V1) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY,
      `Unsupported adapterContractVersion: ${adapterContractVersion}`,
      { adapterContractVersion, expected: CORE12_AVAILABILITY_QUERY_V1 }
    );
  }

  const providerContractVersion = requireStableId(
    cleaned.providerContractVersion ?? CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
    "AvailabilityEligibilityQuery.providerContractVersion",
    AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
  );
  if (providerContractVersion !== CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY,
      `Unsupported providerContractVersion: ${providerContractVersion}`,
      {
        providerContractVersion,
        expected: CORE12_AVAILABILITY_PROVIDER_CONTRACT_V1,
      }
    );
  }

  const computedFingerprint = computeAvailabilityQueryFingerprint({
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
    requestedCourtIds,
    clusterId,
    adapterContractVersion,
  });

  if (cleaned.queryFingerprint != null) {
    const provided = requireStableId(
      cleaned.queryFingerprint,
      "AvailabilityEligibilityQuery.queryFingerprint",
      AVAILABILITY_BRIDGE_CODE.QUERY_FINGERPRINT_MISMATCH
    );
    if (provided !== computedFingerprint) {
      throw new CourtAssignmentContractError(
        AVAILABILITY_BRIDGE_CODE.QUERY_FINGERPRINT_MISMATCH,
        "AvailabilityEligibilityQuery.queryFingerprint does not match normalized query",
        { provided, expected: computedFingerprint }
      );
    }
  }

  return Object.freeze({
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
    requestedCourtIds,
    clusterId,
    queryFingerprint: computedFingerprint,
    adapterContractVersion,
    providerContractVersion,
    _startMs: window._startMs,
    _endMs: window._endMs,
  });
}
