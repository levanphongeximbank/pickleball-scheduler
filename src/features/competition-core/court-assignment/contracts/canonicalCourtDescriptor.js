/**
 * CORE-12 Phase 1D-B1 — CanonicalCourtDescriptor.
 *
 * Caller-/Integrator-supplied structural DTO for projection.
 * Phase 1D-B1 does not load or invent production descriptors from Venue inventory.
 *
 * Authority semantics (must not be conflated):
 * 1. Structural validation — object passes factory field checks.
 * 2. Declared authority — non-empty `descriptorAuthority` / `sourceContractVersion`
 *    strings supplied by the caller (required; never defaulted to a CORE-12 schema id).
 * 3. Independently verified authority — proven inventory provenance from an Owner-
 *    approved descriptor source. **Not established by this factory.** Passing
 *    shape validation does NOT prove authoritative inventory provenance.
 */

import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import { AVAILABILITY_BRIDGE_CODE } from "./availabilityBridgeCodes.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireBoolean,
  requireFiniteNumber,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "courtId",
  "tenantId",
  "clubId",
  "venueId",
  "active",
  "locked",
  "capabilities",
  "priority",
  "sourceContractVersion",
  "descriptorAuthority",
  "metadata",
]);

/**
 * @param {unknown} caps
 * @param {string} path
 */
function normalizeCapabilities(caps, path) {
  if (caps == null) return Object.freeze({});
  if (Array.isArray(caps)) {
    const out = [];
    for (let i = 0; i < caps.length; i += 1) {
      const c = caps[i];
      if (typeof c !== "string" || c.trim() === "") {
        throw new CourtAssignmentContractError(
          AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_UNKNOWN,
          `${path}[${i}] must be a non-empty string`,
          { path, index: i }
        );
      }
      out.push(c.trim());
    }
    return Object.freeze(out);
  }
  if (typeof caps === "object") {
    return cloneFreezeObject(caps, path);
  }
  throw new CourtAssignmentContractError(
    AVAILABILITY_BRIDGE_CODE.COURT_CAPABILITY_UNKNOWN,
    `${path} must be a string array or plain object`,
    { path }
  );
}

/**
 * @param {object} [partial]
 */
export function createCanonicalCourtDescriptor(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CanonicalCourtDescriptor"
  );

  if (partial.sourceContractVersion == null && partial.descriptorAuthority == null) {
    throw new CourtAssignmentContractError(
      AVAILABILITY_BRIDGE_CODE.MISSING_DESCRIPTOR_AUTHORITY,
      "CanonicalCourtDescriptor requires explicit descriptorAuthority or sourceContractVersion (structural validation is not inventory authority)",
      {}
    );
  }

  const sourceContractVersion = requireStableId(
    partial.sourceContractVersion ?? partial.descriptorAuthority,
    "CanonicalCourtDescriptor.sourceContractVersion"
  );

  const descriptorAuthority = requireStableId(
    partial.descriptorAuthority ?? partial.sourceContractVersion,
    "CanonicalCourtDescriptor.descriptorAuthority"
  );

  return Object.freeze({
    courtId: requireStableId(
      partial.courtId,
      "CanonicalCourtDescriptor.courtId"
    ),
    tenantId: requireStableId(
      partial.tenantId,
      "CanonicalCourtDescriptor.tenantId"
    ),
    clubId: requireStableId(partial.clubId, "CanonicalCourtDescriptor.clubId"),
    venueId: requireStableId(
      partial.venueId,
      "CanonicalCourtDescriptor.venueId"
    ),
    active: requireBoolean(
      partial.active,
      "CanonicalCourtDescriptor.active"
    ),
    /**
     * Inventory locked flag from the descriptor authority.
     * Phase 1D-B1 projection always fail-closes locked descriptors
     * (no manual-lock override path in this pure projector).
     */
    locked: requireBoolean(
      partial.locked ?? false,
      "CanonicalCourtDescriptor.locked"
    ),
    capabilities: normalizeCapabilities(
      partial.capabilities,
      "CanonicalCourtDescriptor.capabilities"
    ),
    /**
     * Structural priority for deterministic ordering when supplied by the caller.
     * Default 0 is a contract fill only — not Venue-derived inventory truth.
     */
    priority: requireFiniteNumber(
      partial.priority,
      "CanonicalCourtDescriptor.priority",
      0
    ),
    sourceContractVersion,
    descriptorAuthority,
    metadata: cloneFreezeObject(
      partial.metadata,
      "CanonicalCourtDescriptor.metadata"
    ),
  });
}
