/**
 * CORE-12 Phase 1D-B1 — pure eligibility ∩ descriptor → AvailableCourtInput.
 *
 * No I/O. No Venue CAA. No inventory load. Exact-window projection only.
 */

import { COURT_AVAILABILITY_STATUS } from "../../enums/availabilityStatus.js";
import { createAvailableCourtInput } from "../../contracts/availableCourtInput.js";
import { createCanonicalCourtDescriptor } from "../../contracts/canonicalCourtDescriptor.js";
import { createEligibilitySnapshot } from "../../contracts/eligibilitySnapshot.js";
import { createExactAvailabilityQueryWindow } from "../../contracts/exactAvailabilityQueryWindow.js";
import { AVAILABILITY_BRIDGE_CODE } from "../../contracts/availabilityBridgeCodes.js";
import { computeDerivedAvailabilityFingerprint } from "../../contracts/availabilityFingerprints.js";
import { CORE12_AVAILABILITY_PROJECTION_V1 } from "../../constants/versions.js";
import { compareStableString } from "../../deterministic/compare.js";
import { isCourtAssignmentContractError } from "../../errors/CourtAssignmentContractError.js";

/**
 * @param {unknown} caps
 * @returns {Set<string>}
 */
function capabilityTagSet(caps) {
  /** @type {Set<string>} */
  const available = new Set();
  if (Array.isArray(caps)) {
    for (const c of caps) available.add(String(c));
  } else if (caps && typeof caps === "object") {
    if (/** @type {{ courtType?: unknown }} */ (caps).courtType) {
      available.add(
        String(/** @type {{ courtType: unknown }} */ (caps).courtType)
      );
    }
    for (const [k, v] of Object.entries(caps)) {
      if (v === true || typeof v === "string") available.add(k);
      if (typeof v === "string") available.add(v);
    }
  }
  return available;
}

/**
 * @param {unknown} required
 * @returns {string[]|null}
 */
function normalizeRequiredCapabilities(required) {
  if (required == null) return null;
  if (Array.isArray(required)) {
    return required.map((r) => String(r).trim()).filter(Boolean);
  }
  if (typeof required === "object") {
    if (/** @type {{ courtType?: unknown }} */ (required).courtType) {
      return [
        String(/** @type {{ courtType: unknown }} */ (required).courtType),
      ];
    }
    return Object.keys(required).filter(
      (k) => /** @type {Record<string, unknown>} */ (required)[k]
    );
  }
  return null;
}

/**
 * Pure projection: eligibility evidence + canonical descriptors → AvailableCourtInput[].
 *
 * Empty eligibility yields ok:true with courts:[] and finding EMPTY_ELIGIBILITY_RESULT.
 * That must never be interpreted as unrestricted courts.
 *
 * @param {object} input
 * @returns {{
 *   ok: true,
 *   courts: ReadonlyArray<object>,
 *   findings: ReadonlyArray<object>,
 *   derivedAvailabilityFingerprint: string,
 *   projectionContractVersion: string,
 *   queryFingerprint: string,
 *   derivedEligibilityFingerprint: string,
 * } | {
 *   ok: false,
 *   code: string,
 *   message: string,
 *   details: object,
 * }}
 */
export function projectEligibleCourtsToAvailableInputs(input = {}) {
  try {
    const window = createExactAvailabilityQueryWindow({
      timezone: input.timezone ?? input.queryWindow?.timezone,
      windowStart: input.windowStart ?? input.queryWindow?.windowStart,
      windowEnd: input.windowEnd ?? input.queryWindow?.windowEnd,
      civilDate: input.civilDate ?? input.queryWindow?.civilDate,
      civilStartTime:
        input.civilStartTime ?? input.queryWindow?.civilStartTime,
      civilEndTime: input.civilEndTime ?? input.queryWindow?.civilEndTime,
    });

    const snapshot = createEligibilitySnapshot(
      input.eligibilitySnapshot ?? input.snapshot ?? {}
    );

    if (
      snapshot.windowStart !== window.windowStart ||
      snapshot.windowEnd !== window.windowEnd ||
      snapshot.timezone !== window.timezone
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.INVALID_QUERY_WINDOW,
        message:
          "EligibilitySnapshot window does not match the exact projection query window",
        details: {},
      };
    }

    if (
      input.queryFingerprint != null &&
      String(input.queryFingerprint) !== snapshot.queryFingerprint
    ) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.QUERY_FINGERPRINT_MISMATCH,
        message: "Projection queryFingerprint does not match eligibility snapshot",
        details: {
          provided: String(input.queryFingerprint),
          expected: snapshot.queryFingerprint,
        },
      };
    }

    if (!Array.isArray(input.courtDescriptors)) {
      return {
        ok: false,
        code: AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR,
        message: "courtDescriptors must be an array",
        details: {},
      };
    }

    /** @type {Map<string, object>} */
    const descriptorById = new Map();
    for (let i = 0; i < input.courtDescriptors.length; i += 1) {
      const descriptor = createCanonicalCourtDescriptor(
        input.courtDescriptors[i]
      );
      if (descriptorById.has(descriptor.courtId)) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.DUPLICATE_CANONICAL_COURT_DESCRIPTOR,
          message: `Duplicate CanonicalCourtDescriptor for courtId: ${descriptor.courtId}`,
          details: { courtId: descriptor.courtId },
        };
      }
      descriptorById.set(descriptor.courtId, descriptor);
    }

    const requiredCaps = normalizeRequiredCapabilities(
      input.requiredCapabilities
    );
    /** @type {object[]} */
    const findings = [];
    /** @type {object[]} */
    const courts = [];

    if (snapshot.eligibleCourtIds.length === 0) {
      findings.push(
        Object.freeze({
          code: AVAILABILITY_BRIDGE_CODE.EMPTY_ELIGIBILITY_RESULT,
          message:
            "Eligibility snapshot succeeded with zero eligible courts (not unrestricted)",
          courtIds: Object.freeze([]),
        })
      );
    }

    for (const courtId of snapshot.eligibleCourtIds) {
      const descriptor = descriptorById.get(courtId);
      if (!descriptor) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.MISSING_CANONICAL_COURT_DESCRIPTOR,
          message: `Eligible courtId lacks CanonicalCourtDescriptor: ${courtId}`,
          details: { courtId },
        };
      }

      if (
        descriptor.tenantId !== snapshot.tenantId ||
        descriptor.clubId !== snapshot.clubId ||
        descriptor.venueId !== snapshot.venueId
      ) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.COURT_SCOPE_MISMATCH,
          message: `CanonicalCourtDescriptor scope mismatch for ${courtId}`,
          details: {
            courtId,
            descriptor: {
              tenantId: descriptor.tenantId,
              clubId: descriptor.clubId,
              venueId: descriptor.venueId,
            },
            snapshot: {
              tenantId: snapshot.tenantId,
              clubId: snapshot.clubId,
              venueId: snapshot.venueId,
            },
          },
        };
      }

      if (!descriptor.active) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.COURT_NOT_ENABLED,
          message: `CanonicalCourtDescriptor is disabled: ${courtId}`,
          details: {
            courtId,
            active: descriptor.active,
            locked: descriptor.locked,
          },
        };
      }

      if (descriptor.locked) {
        return {
          ok: false,
          code: AVAILABILITY_BRIDGE_CODE.COURT_DESCRIPTOR_LOCKED,
          message: `CanonicalCourtDescriptor is locked and cannot be projected in Phase 1D-B1: ${courtId}`,
          details: {
            courtId,
            active: descriptor.active,
            locked: descriptor.locked,
            policy:
              "LOCKED_DESCRIPTORS_FAIL_CLOSED_NO_MANUAL_OVERRIDE_IN_PROJECTION",
          },
        };
      }

      if (requiredCaps && requiredCaps.length > 0) {
        const available = capabilityTagSet(descriptor.capabilities);
        if (available.size === 0) {
          return {
            ok: false,
            code: AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_UNKNOWN,
            message: `Required capabilities present but descriptor has no capability data: ${courtId}`,
            details: { courtId, requiredCapabilities: requiredCaps },
          };
        }
        const missing = requiredCaps.filter((tag) => !available.has(tag));
        if (missing.length > 0) {
          return {
            ok: false,
            code: AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_MISMATCH,
            message: `CanonicalCourtDescriptor capability mismatch: ${courtId}`,
            details: { courtId, missing },
          };
        }
      }

      courts.push(
        createAvailableCourtInput({
          courtId: descriptor.courtId,
          tenantId: descriptor.tenantId,
          clubId: descriptor.clubId,
          venueId: descriptor.venueId,
          availabilityStatus: COURT_AVAILABILITY_STATUS.AVAILABLE,
          active: true,
          eligible: true,
          capabilities: descriptor.capabilities,
          priority: descriptor.priority,
          availabilityIntervals: [
            {
              start: window.windowStart,
              end: window.windowEnd,
            },
          ],
          availabilityWindows: [
            {
              date: window.civilDate,
              startTime: window.civilStartTime,
              endTime: window.civilEndTime,
              timezone: window.timezone,
            },
          ],
          metadata: {
            ...descriptor.metadata,
            descriptorAuthority: descriptor.descriptorAuthority,
            sourceContractVersion: descriptor.sourceContractVersion,
            eligibilityDerived: true,
            projectionContractVersion: CORE12_AVAILABILITY_PROJECTION_V1,
          },
        })
      );
    }

    // Descriptors without eligibility must not project (silently ignored unless required).
    for (const [courtId] of descriptorById) {
      if (!snapshot.eligibleCourtIds.includes(courtId)) {
        findings.push(
          Object.freeze({
            code: "DESCRIPTOR_WITHOUT_ELIGIBILITY",
            message: `Descriptor ${courtId} omitted — not in eligibleCourtIds`,
            courtIds: Object.freeze([courtId]),
          })
        );
      }
    }

    courts.sort((a, b) => compareStableString(a.courtId, b.courtId));

    const derivedAvailabilityFingerprint =
      computeDerivedAvailabilityFingerprint({
        queryFingerprint: snapshot.queryFingerprint,
        derivedEligibilityFingerprint: snapshot.derivedEligibilityFingerprint,
        windowStart: window.windowStart,
        windowEnd: window.windowEnd,
        courts,
      });

    return {
      ok: true,
      courts: Object.freeze(courts),
      findings: Object.freeze(findings),
      derivedAvailabilityFingerprint,
      projectionContractVersion: CORE12_AVAILABILITY_PROJECTION_V1,
      queryFingerprint: snapshot.queryFingerprint,
      derivedEligibilityFingerprint: snapshot.derivedEligibilityFingerprint,
      sourceSnapshotId: snapshot.sourceSnapshotId,
      sourceSnapshotVersion: snapshot.sourceSnapshotVersion,
    };
  } catch (err) {
    if (isCourtAssignmentContractError(err)) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      };
    }
    throw err;
  }
}
