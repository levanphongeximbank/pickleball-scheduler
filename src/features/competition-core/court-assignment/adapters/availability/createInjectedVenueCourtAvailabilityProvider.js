/**
 * CORE-12 Phase 1D-B2 Option A — injected Venue court availability provider.
 *
 * Consumes injected eligibility + descriptor providers (sync or Promise).
 * Does NOT import Venue & Court modules. Composition root / tests supply
 * public Venue facade functions via dependency injection.
 *
 * Flow: validate query → eligibility → descriptors → normalize → join →
 * projectEligibleCourtsToAvailableInputs (exact-window interval only).
 */

import { createAvailabilityEligibilityQuery } from "../../contracts/availabilityEligibilityQuery.js";
import { createEligibilitySnapshot } from "../../contracts/eligibilitySnapshot.js";
import { AVAILABILITY_BRIDGE_CODE } from "../../contracts/availabilityBridgeCodes.js";
import {
  CORE12_ELIGIBILITY_SNAPSHOT_V1,
  CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY,
  CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION,
  CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
} from "../../constants/versions.js";
import { isCourtAssignmentContractError } from "../../errors/CourtAssignmentContractError.js";
import { isVenueEligibilityProvider } from "../../ports/venueEligibilityProvider.js";
import { isCanonicalCourtDescriptorProvider } from "../../ports/canonicalCourtDescriptorProvider.js";
import { isAvailabilitySnapshotProvider } from "../../ports/availabilitySnapshotProvider.js";
import { projectEligibleCourtsToAvailableInputs } from "./projectEligibleCourtsToAvailableInputs.js";
import { normalizeVenueDescriptorEnvelope } from "./normalizeVenueDescriptorEnvelope.js";

/**
 * @param {unknown} err
 * @param {string} fallbackCode
 */
function mapProviderError(err, fallbackCode) {
  if (isCourtAssignmentContractError(err)) {
    return {
      ok: false,
      code: err.code,
      message: err.message,
      details: err.details ?? {},
    };
  }
  if (err && typeof err === "object") {
    const code =
      "code" in err &&
      typeof /** @type {{ code?: unknown }} */ (err).code === "string"
        ? /** @type {{ code: string }} */ (err).code
        : fallbackCode;
    const message =
      err instanceof Error
        ? err.message
        : typeof /** @type {{ message?: unknown }} */ (err).message === "string"
          ? /** @type {{ message: string }} */ (err).message
          : "Injected provider rejected";
    return {
      ok: false,
      code,
      message,
      details: {
        name: err instanceof Error ? err.name : "Error",
      },
    };
  }
  return {
    ok: false,
    code: fallbackCode,
    message: String(err ?? "Injected provider rejected"),
    details: {},
  };
}

/**
 * Build descriptor provider request from CORE-12 query (no ID rewriting).
 * @param {object} query
 */
function toDescriptorRequest(query) {
  return Object.freeze({
    tenantId: query.tenantId,
    clubId: query.clubId,
    venueId: query.venueId,
    courtIds:
      query.requestedCourtIds && query.requestedCourtIds.length > 0
        ? [...query.requestedCourtIds]
        : undefined,
    clusterId: query.clusterId ?? undefined,
    includeInactive: false,
    includeLocked: true,
  });
}

/**
 * Build eligibility provider request from CORE-12 query.
 * @param {object} query
 */
function toEligibilityRequest(query) {
  return Object.freeze({
    tenantId: query.tenantId,
    clubId: query.clubId,
    venueId: query.venueId,
    competitionId: query.competitionId,
    timezone: query.timezone,
    windowStart: query.windowStart,
    windowEnd: query.windowEnd,
    civilDate: query.civilDate,
    civilStartTime: query.civilStartTime,
    civilEndTime: query.civilEndTime,
    date: query.civilDate,
    startTime: query.civilStartTime,
    endTime: query.civilEndTime,
    courtIds:
      query.requestedCourtIds && query.requestedCourtIds.length > 0
        ? [...query.requestedCourtIds]
        : undefined,
    clusterId: query.clusterId ?? undefined,
    queryFingerprint: query.queryFingerprint,
  });
}

/**
 * Map injected eligibility evidence into EligibilitySnapshot fields.
 * Accepts either CORE-12-shaped evidence or CAA-like { availableCourtIds }.
 * @param {object} raw
 * @param {object} query
 */
function adaptEligibilityEvidence(raw, query) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.PROVIDER_RESULT_INVALID,
      message: "Eligibility provider returned a non-object result",
      details: { resultType: raw == null ? "null" : typeof raw },
    };
  }

  const evidence = /** @type {Record<string, unknown>} */ (raw);

  let eligibleCourtIds;
  if (Array.isArray(evidence.eligibleCourtIds)) {
    eligibleCourtIds = evidence.eligibleCourtIds;
  } else if (Array.isArray(evidence.availableCourtIds)) {
    eligibleCourtIds = evidence.availableCourtIds;
  } else {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT,
      message:
        "Eligibility evidence must include eligibleCourtIds or availableCourtIds array",
      details: {},
    };
  }

  // Scope: do not rewrite. Prefer evidence values when present; require match.
  const clubId = evidence.clubId != null ? String(evidence.clubId) : query.clubId;
  const venueId =
    evidence.venueId != null && evidence.venueId !== ""
      ? String(evidence.venueId)
      : query.venueId;
  const tenantId =
    evidence.tenantId != null && evidence.tenantId !== ""
      ? String(evidence.tenantId)
      : query.tenantId;

  if (
    clubId !== query.clubId ||
    venueId !== query.venueId ||
    tenantId !== query.tenantId
  ) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.ELIGIBILITY_SCOPE_MISMATCH,
      message: "Eligibility evidence scope does not match query (no ID rewrite)",
      details: {
        queryScope: {
          tenantId: query.tenantId,
          clubId: query.clubId,
          venueId: query.venueId,
        },
        evidenceScope: { tenantId, clubId, venueId },
      },
    };
  }

  // Optional civil echo validation when CAA-shaped fields are present.
  if (evidence.date != null && String(evidence.date) !== query.civilDate) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      message: "Eligibility evidence civil date does not match query window",
      details: { provided: evidence.date, expected: query.civilDate },
    };
  }
  if (
    evidence.startTime != null &&
    String(evidence.startTime) !== query.civilStartTime
  ) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      message: "Eligibility evidence startTime does not match query window",
      details: {
        provided: evidence.startTime,
        expected: query.civilStartTime,
      },
    };
  }
  if (
    evidence.endTime != null &&
    String(evidence.endTime) !== query.civilEndTime
  ) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
      message: "Eligibility evidence endTime does not match query window",
      details: { provided: evidence.endTime, expected: query.civilEndTime },
    };
  }

  /** @type {object[]} */
  const ineligibleCourts = [];
  if (Array.isArray(evidence.ineligibleCourts)) {
    for (const row of evidence.ineligibleCourts) {
      ineligibleCourts.push(row);
    }
  } else if (Array.isArray(evidence.unavailableCourts)) {
    for (const row of evidence.unavailableCourts) {
      if (row == null || typeof row !== "object") continue;
      const u = /** @type {Record<string, unknown>} */ (row);
      ineligibleCourts.push({
        courtId: u.courtId,
        reasons: Array.isArray(u.reasons) ? u.reasons : [],
        codes: Array.isArray(u.codes)
          ? u.codes
          : Array.isArray(u.reasons)
            ? []
            : [],
      });
    }
  }

  try {
    const snapshot = createEligibilitySnapshot({
      schemaVersion: CORE12_ELIGIBILITY_SNAPSHOT_V1,
      tenantId: query.tenantId,
      clubId: query.clubId,
      venueId: query.venueId,
      competitionId: query.competitionId,
      timezone: query.timezone,
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
      civilDate: query.civilDate,
      civilStartTime: query.civilStartTime,
      civilEndTime: query.civilEndTime,
      eligibleCourtIds,
      ineligibleCourts,
      sourceSnapshotId:
        evidence.sourceSnapshotId === undefined
          ? null
          : evidence.sourceSnapshotId,
      sourceSnapshotVersion:
        evidence.sourceSnapshotVersion === undefined
          ? null
          : evidence.sourceSnapshotVersion,
      sourceContractVersion:
        evidence.sourceContractVersion === undefined
          ? null
          : evidence.sourceContractVersion,
      queryFingerprint: query.queryFingerprint,
    });
    return { ok: true, snapshot };
  } catch (err) {
    return mapProviderError(
      err,
      AVAILABILITY_BRIDGE_CODE.MALFORMED_ELIGIBILITY_SNAPSHOT
    );
  }
}

/**
 * @param {object} [deps]
 * @param {import('../../ports/venueEligibilityProvider.js').VenueEligibilityProvider} [deps.eligibilityProvider]
 * @param {import('../../ports/canonicalCourtDescriptorProvider.js').CanonicalCourtDescriptorProvider} [deps.descriptorProvider]
 * @param {string} [deps.expectedDescriptorAuthority]
 * @param {string} [deps.expectedSourceContractVersion]
 */
export function createInjectedVenueCourtAvailabilityProvider(deps = {}) {
  const eligibilityProvider = deps.eligibilityProvider;
  const descriptorProvider = deps.descriptorProvider;
  const expectedDescriptorAuthority =
    deps.expectedDescriptorAuthority ??
    CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY;
  const expectedSourceContractVersion =
    deps.expectedSourceContractVersion ??
    CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION;

  /**
   * @param {object} queryPartial
   * @param {object} [options]
   * @param {unknown} [options.requiredCapabilities]
   */
  async function resolveAvailableCourtsProjection(queryPartial, options = {}) {
    if (!isVenueEligibilityProvider(eligibilityProvider)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MISSING_ELIGIBILITY_PROVIDER,
        message:
          "VenueEligibilityProvider is missing or does not implement resolveEligibility",
        details: {},
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }
    if (!isCanonicalCourtDescriptorProvider(descriptorProvider)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_PROVIDER,
        message:
          "CanonicalCourtDescriptorProvider is missing or does not implement resolveDescriptors",
        details: {},
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    let query;
    try {
      query = createAvailabilityEligibilityQuery(queryPartial);
    } catch (err) {
      const mapped = mapProviderError(
        err,
        AVAILABILITY_BRIDGE_CODE.INVALID_AVAILABILITY_QUERY
      );
      return {
        ...mapped,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    let eligibilityRaw;
    try {
      eligibilityRaw = await Promise.resolve(
        eligibilityProvider.resolveEligibility(toEligibilityRequest(query))
      );
    } catch (err) {
      const mapped = mapProviderError(
        err,
        AVAILABILITY_BRIDGE_CODE.PROVIDER_REJECTED
      );
      return {
        ...mapped,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    const eligibilityAdapted = adaptEligibilityEvidence(eligibilityRaw, query);
    if (!eligibilityAdapted.ok) {
      return {
        ...eligibilityAdapted,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    let descriptorRaw;
    try {
      descriptorRaw = await Promise.resolve(
        descriptorProvider.resolveDescriptors(toDescriptorRequest(query))
      );
    } catch (err) {
      const mapped = mapProviderError(
        err,
        AVAILABILITY_BRIDGE_CODE.PROVIDER_REJECTED
      );
      return {
        ...mapped,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    const normalized = normalizeVenueDescriptorEnvelope(descriptorRaw, {
      expectedScope: {
        tenantId: query.tenantId,
        clubId: query.clubId,
        venueId: query.venueId,
      },
      expectedDescriptorAuthority,
      expectedSourceContractVersion,
    });
    if (!normalized.ok) {
      return {
        ...normalized,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      };
    }

    const projected = projectEligibleCourtsToAvailableInputs({
      timezone: query.timezone,
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
      civilDate: query.civilDate,
      civilStartTime: query.civilStartTime,
      civilEndTime: query.civilEndTime,
      queryFingerprint: query.queryFingerprint,
      eligibilitySnapshot: eligibilityAdapted.snapshot,
      courtDescriptors: normalized.courtDescriptors,
      requiredCapabilities: options.requiredCapabilities,
    });

    if (!projected.ok) {
      return {
        ...projected,
        bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
        query,
        eligibilitySnapshot: eligibilityAdapted.snapshot,
        sourceSnapshotId: normalized.sourceSnapshotId,
        sourceSnapshotVersion: normalized.sourceSnapshotVersion,
      };
    }

    return Object.freeze({
      ok: true,
      bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
      query,
      eligibilitySnapshot: eligibilityAdapted.snapshot,
      courtDescriptors: normalized.courtDescriptors,
      courts: projected.courts,
      findings: projected.findings,
      derivedAvailabilityFingerprint: projected.derivedAvailabilityFingerprint,
      projectionContractVersion: projected.projectionContractVersion,
      queryFingerprint: projected.queryFingerprint,
      derivedEligibilityFingerprint: projected.derivedEligibilityFingerprint,
      sourceSnapshotId: normalized.sourceSnapshotId,
      sourceSnapshotVersion: normalized.sourceSnapshotVersion,
      descriptorAuthority: normalized.descriptorAuthority,
      sourceContractVersion: normalized.sourceContractVersion,
      diagnostics: normalized.diagnostics,
    });
  }

  /**
   * AvailabilitySnapshotProvider-compatible eligibility path (no descriptors).
   * @param {object} queryPartial
   */
  async function resolveEligibilitySnapshot(queryPartial) {
    if (!isVenueEligibilityProvider(eligibilityProvider)) {
      throw Object.assign(
        new Error(
          "VenueEligibilityProvider is missing or does not implement resolveEligibility"
        ),
        { code: AVAILABILITY_BRIDGE_CODE.MISSING_ELIGIBILITY_PROVIDER }
      );
    }

    const query = createAvailabilityEligibilityQuery(queryPartial);
    const eligibilityRaw = await Promise.resolve(
      eligibilityProvider.resolveEligibility(toEligibilityRequest(query))
    );
    const adapted = adaptEligibilityEvidence(eligibilityRaw, query);
    if (!adapted.ok) {
      throw Object.assign(new Error(adapted.message), {
        code: adapted.code,
        details: adapted.details,
      });
    }
    return adapted.snapshot;
  }

  return Object.freeze({
    bridgeContractVersion: CORE12_VENUE_AVAILABILITY_BRIDGE_V1,
    resolveAvailableCourtsProjection,
    resolveEligibilitySnapshot,
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isInjectedVenueCourtAvailabilityProvider(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof /** @type {{ resolveAvailableCourtsProjection?: unknown }} */ (
      value
    ).resolveAvailableCourtsProjection === "function" &&
    isAvailabilitySnapshotProvider(value)
  );
}
