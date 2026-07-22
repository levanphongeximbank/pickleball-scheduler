/**
 * CORE-12 Phase 1D-B2 Option A — pure Venue descriptor envelope normalizer.
 *
 * Maps a Venue Phase 3B Competition-facing descriptor envelope response into
 * CORE-12 `CanonicalCourtDescriptor[]` without I/O, mutation, or invention.
 *
 * Envelope-level `descriptorAuthority` / `sourceContractVersion` are copied
 * onto each court descriptor. Snapshot ids remain null when null; never
 * fabricated. Priority must be an explicit finite number (no factory default).
 */

import { createCanonicalCourtDescriptor } from "../../contracts/canonicalCourtDescriptor.js";
import { AVAILABILITY_BRIDGE_CODE } from "../../contracts/availabilityBridgeCodes.js";
import {
  CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY,
  CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION,
} from "../../constants/versions.js";
import { CourtAssignmentContractError, isCourtAssignmentContractError } from "../../errors/CourtAssignmentContractError.js";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isAuthoritativePriority(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {unknown} err
 * @param {string} fallbackCode
 * @param {string} fallbackMessage
 */
function toFailure(err, fallbackCode, fallbackMessage) {
  if (isCourtAssignmentContractError(err)) {
    return {
      ok: false,
      code: err.code,
      message: err.message,
      details: err.details ?? {},
    };
  }
  return {
    ok: false,
    code: fallbackCode,
    message: err instanceof Error ? err.message : fallbackMessage,
    details: {},
  };
}

/**
 * @param {unknown} envelope
 * @param {object} [options]
 * @param {{ tenantId: string, clubId: string, venueId: string }} [options.expectedScope]
 * @param {string} [options.expectedDescriptorAuthority]
 * @param {string} [options.expectedSourceContractVersion]
 * @returns {{
 *   ok: true,
 *   courtDescriptors: ReadonlyArray<object>,
 *   sourceSnapshotId: null|string,
 *   sourceSnapshotVersion: null|string,
 *   descriptorAuthority: string,
 *   sourceContractVersion: string,
 *   diagnostics: object,
 * } | {
 *   ok: false,
 *   code: string,
 *   message: string,
 *   details: object,
 * }}
 */
export function normalizeVenueDescriptorEnvelope(envelope, options = {}) {
  if (envelope == null || typeof envelope !== "object" || Array.isArray(envelope)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
      message: "Venue descriptor envelope must be a plain object",
      details: { resultType: envelope == null ? "null" : typeof envelope },
    };
  }

  const env = /** @type {Record<string, unknown>} */ (envelope);

  const expectedAuthority =
    options.expectedDescriptorAuthority ??
    CORE12_EXPECTED_VENUE_DESCRIPTOR_AUTHORITY;
  const expectedVersion =
    options.expectedSourceContractVersion ??
    CORE12_EXPECTED_VENUE_SOURCE_CONTRACT_VERSION;

  if (env.descriptorAuthority == null || env.descriptorAuthority === "") {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY,
      message: "Venue descriptor envelope missing descriptorAuthority",
      details: {},
    };
  }
  if (String(env.descriptorAuthority) !== String(expectedAuthority)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_AUTHORITY_MISMATCH,
      message: "Venue descriptorAuthority does not match expected pin",
      details: {
        provided: String(env.descriptorAuthority),
        expected: String(expectedAuthority),
      },
    };
  }

  if (env.sourceContractVersion == null || env.sourceContractVersion === "") {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_CONTRACT_VERSION_MISMATCH,
      message: "Venue descriptor envelope missing sourceContractVersion",
      details: {},
    };
  }
  if (String(env.sourceContractVersion) !== String(expectedVersion)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_CONTRACT_VERSION_MISMATCH,
      message: "Venue sourceContractVersion does not match expected pin",
      details: {
        provided: String(env.sourceContractVersion),
        expected: String(expectedVersion),
      },
    };
  }

  const expectedScope = options.expectedScope;
  if (expectedScope) {
    if (
      String(env.tenantId ?? "") !== String(expectedScope.tenantId) ||
      String(env.clubId ?? "") !== String(expectedScope.clubId) ||
      String(env.venueId ?? "") !== String(expectedScope.venueId)
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.DESCRIPTOR_SCOPE_MISMATCH,
        message: "Venue descriptor envelope scope does not match query scope",
        details: {
          envelopeScope: {
            tenantId: env.tenantId ?? null,
            clubId: env.clubId ?? null,
            venueId: env.venueId ?? null,
          },
          expectedScope: {
            tenantId: expectedScope.tenantId,
            clubId: expectedScope.clubId,
            venueId: expectedScope.venueId,
          },
        },
      };
    }
  }

  if (!Array.isArray(env.courts)) {
    return {
      ok: false,
      code: AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
      message: "Venue descriptor envelope.courts must be an array",
      details: {},
    };
  }

  // Snapshot identity: preserve genuine null; accept genuine non-null strings;
  // never fabricate. Reject non-string non-null values.
  let sourceSnapshotId = null;
  if (env.sourceSnapshotId != null) {
    if (typeof env.sourceSnapshotId !== "string" || env.sourceSnapshotId.trim() === "") {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
        message: "Venue sourceSnapshotId must be null or a non-empty string",
        details: {},
      };
    }
    sourceSnapshotId = env.sourceSnapshotId.trim();
  }

  let sourceSnapshotVersion = null;
  if (env.sourceSnapshotVersion != null) {
    if (
      typeof env.sourceSnapshotVersion !== "string" ||
      env.sourceSnapshotVersion.trim() === ""
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
        message:
          "Venue sourceSnapshotVersion must be null or a non-empty string",
        details: {},
      };
    }
    sourceSnapshotVersion = env.sourceSnapshotVersion.trim();
  }

  const descriptorAuthority = String(env.descriptorAuthority);
  const sourceContractVersion = String(env.sourceContractVersion);
  /** @type {object[]} */
  const courtDescriptors = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (let i = 0; i < env.courts.length; i += 1) {
    const row = env.courts[i];
    if (row == null || typeof row !== "object" || Array.isArray(row)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
        message: `Venue descriptor courts[${i}] must be a plain object`,
        details: { index: i },
      };
    }

    const court = /** @type {Record<string, unknown>} */ (row);

    if (!Object.prototype.hasOwnProperty.call(court, "priority")) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE,
        message: `Venue descriptor courts[${i}] missing authoritative priority`,
        details: { index: i, courtId: court.courtId ?? null },
      };
    }
    if (!isAuthoritativePriority(court.priority)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.PRIORITY_NOT_AUTHORITATIVE,
        message: `Venue descriptor courts[${i}] priority is not an authoritative finite number`,
        details: {
          index: i,
          courtId: court.courtId ?? null,
          priorityType: typeof court.priority,
        },
      };
    }

    if (expectedScope) {
      if (
        String(court.tenantId ?? "") !== String(expectedScope.tenantId) ||
        String(court.clubId ?? "") !== String(expectedScope.clubId) ||
        String(court.venueId ?? "") !== String(expectedScope.venueId)
      ) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.COURT_SCOPE_MISMATCH,
          message: `Venue descriptor courts[${i}] scope does not match query`,
          details: {
            index: i,
            courtId: court.courtId ?? null,
            courtScope: {
              tenantId: court.tenantId ?? null,
              clubId: court.clubId ?? null,
              venueId: court.venueId ?? null,
            },
            expectedScope,
          },
        };
      }
    }

    // Preserve Venue-certified capabilities (including empty []). Do not invent.
    const capabilities =
      court.capabilities === undefined ? [] : court.capabilities;

    let descriptor;
    try {
      descriptor = createCanonicalCourtDescriptor({
        courtId: court.courtId,
        tenantId: court.tenantId,
        clubId: court.clubId,
        venueId: court.venueId,
        active: court.active,
        locked: court.locked === true,
        capabilities,
        // Pass explicit priority — never omit (factory default 0 is not Venue truth).
        priority: court.priority,
        descriptorAuthority,
        sourceContractVersion,
      });
    } catch (err) {
      return toFailure(
        err,
        AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
        `Venue descriptor courts[${i}] failed CanonicalCourtDescriptor validation`
      );
    }

    if (seen.has(descriptor.courtId)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.DUPLICATE_CANONICAL_COURT_DESCRIPTOR,
        message: `Duplicate Venue descriptor courtId: ${descriptor.courtId}`,
        details: { courtId: descriptor.courtId },
      };
    }
    seen.add(descriptor.courtId);
    courtDescriptors.push(descriptor);
  }

  const diagnostics =
    env.diagnostics != null &&
    typeof env.diagnostics === "object" &&
    !Array.isArray(env.diagnostics)
      ? Object.freeze({
          excludedCourts: Object.freeze(
            Array.isArray(
              /** @type {{ excludedCourts?: unknown }} */ (env.diagnostics)
                .excludedCourts
            )
              ? /** @type {{ excludedCourts: unknown[] }} */ (env.diagnostics)
                  .excludedCourts.map((row) =>
                    row && typeof row === "object"
                      ? Object.freeze({ .../** @type {object} */ (row) })
                      : row
                  )
              : []
          ),
        })
      : Object.freeze({ excludedCourts: Object.freeze([]) });

  return {
    ok: true,
    courtDescriptors: Object.freeze(courtDescriptors),
    sourceSnapshotId,
    sourceSnapshotVersion,
    descriptorAuthority,
    sourceContractVersion,
    diagnostics,
  };
}

/**
 * @param {unknown} value
 * @throws {CourtAssignmentContractError}
 */
export function requireNormalizedVenueDescriptors(value) {
  if (value && typeof value === "object" && /** @type {{ ok?: unknown }} */ (value).ok === true) {
    return value;
  }
  throw new CourtAssignmentContractError(
    AVAILABILITY_BRIDGE_CODE.MALFORMED_DESCRIPTOR_ENVELOPE,
    "Normalized Venue descriptors are required",
    {}
  );
}
