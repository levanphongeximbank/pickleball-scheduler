/**
 * CORE-14 Phase 1D — capacity policy helpers.
 * Capacity scanning uses start/end events with release-before-acquire at equal timestamps.
 */

import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { isSpecializedOverlapKind } from "./overlapPolicy.js";

export const CAPACITY_POLICY_VERSION = "core14-capacity-policy-v1";

/** Default exclusive capacity when capacity checking is enabled. */
export const DEFAULT_CAPACITY_ONE_KINDS = Object.freeze([
  RESOURCE_KIND.PLAYER,
  RESOURCE_KIND.TEAM,
  RESOURCE_KIND.COURT,
  RESOURCE_KIND.REFEREE,
]);

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>|null} [details]
 */
function diagnostic(code, message, details = null) {
  return Object.freeze({
    code,
    message,
    path: null,
    resourceKey: null,
    occupancyId: null,
    assignmentId: null,
    details: details ? Object.freeze({ ...details }) : null,
  });
}

/**
 * Normalize capacity policy without mutating caller input.
 *
 * @param {unknown} raw
 * @returns {{
 *   ok: true,
 *   value: {
 *     policyVersion: string,
 *     capacityByResourceKey: ReadonlyMap<string, number>,
 *     exclusiveLocationKeys: ReadonlySet<string>,
 *   }
 * } | { ok: false, diagnostics: object[] }}
 */
export function normalizeCapacityPolicy(raw) {
  const diagnostics = [];
  const policy =
    raw == null || typeof raw !== "object" || Array.isArray(raw)
      ? {}
      : /** @type {Record<string, unknown>} */ (raw);

  const policyVersion =
    typeof policy.policyVersion === "string" && policy.policyVersion.length > 0
      ? policy.policyVersion
      : CAPACITY_POLICY_VERSION;

  /** @type {Map<string, number>} */
  const capacityByResourceKey = new Map();
  /** @type {Set<string>} */
  const exclusiveLocationKeys = new Set();

  const capacities = Array.isArray(policy.capacities) ? policy.capacities : [];
  for (let i = 0; i < capacities.length; i += 1) {
    const entry = capacities[i];
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY, "capacity entry must be an object", {
          index: i,
        })
      );
      continue;
    }
    let canonical;
    try {
      canonical = serializeCanonicalResourceKey(entry.resourceKey);
    } catch {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE, "capacity entry resourceKey invalid", {
          index: i,
        })
      );
      continue;
    }
    const capacity = entry.capacity;
    if (capacity == null) {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING, "capacity is required when supplied in policy", {
          index: i,
          resourceKeyCanonical: canonical,
        })
      );
      continue;
    }
    if (typeof capacity !== "number" || !Number.isSafeInteger(capacity) || capacity <= 0) {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY, "capacity must be a safe integer greater than zero", {
          index: i,
          capacity,
          resourceKeyCanonical: canonical,
        })
      );
      continue;
    }
    capacityByResourceKey.set(canonical, capacity);
    if (entry.exclusive === true) {
      exclusiveLocationKeys.add(canonical);
    }
  }

  const exclusiveLocations = Array.isArray(policy.exclusiveLocations)
    ? policy.exclusiveLocations
    : [];
  for (let i = 0; i < exclusiveLocations.length; i += 1) {
    try {
      exclusiveLocationKeys.add(serializeCanonicalResourceKey(exclusiveLocations[i]));
    } catch {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE, "exclusiveLocations entry invalid", {
          index: i,
        })
      );
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    value: Object.freeze({
      policyVersion,
      capacityByResourceKey,
      exclusiveLocationKeys,
    }),
  };
}

/**
 * Resolve resource capacity limit for capacity scanning.
 * Returns fail-closed diagnostics when required capacity is missing/invalid.
 *
 * @param {object} occupancy normalized ResourceOccupancy
 * @param {{
 *   capacityByResourceKey: ReadonlyMap<string, number>,
 *   exclusiveLocationKeys: ReadonlySet<string>,
 * }} policy
 * @returns {{
 *   ok: true,
 *   capacity: number,
 *   exclusive: boolean,
 *   skipCapacityFinding: boolean,
 * } | { ok: false, diagnostics: object[] }}
 */
export function resolveResourceCapacity(occupancy, policy) {
  const kind = occupancy.resourceKey.resourceKind;
  const canonical = serializeCanonicalResourceKey(occupancy.resourceKey);
  const exclusive =
    kind === RESOURCE_KIND.LOCATION && policy.exclusiveLocationKeys.has(canonical);

  // Specialized overlap owns capacity-one exclusive conflicts for these kinds.
  if (isSpecializedOverlapKind(kind)) {
    return {
      ok: true,
      capacity: 1,
      exclusive: true,
      skipCapacityFinding: true,
    };
  }

  if (kind === RESOURCE_KIND.LOCATION && exclusive) {
    return {
      ok: true,
      capacity: 1,
      exclusive: true,
      skipCapacityFinding: true,
    };
  }

  if (policy.capacityByResourceKey.has(canonical)) {
    return {
      ok: true,
      capacity: /** @type {number} */ (policy.capacityByResourceKey.get(canonical)),
      exclusive,
      skipCapacityFinding: false,
    };
  }

  if (kind === RESOURCE_KIND.LOCATION && !exclusive) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING,
          "Non-exclusive LOCATION requires explicit capacity when capacity checking is enabled",
          { resourceKeyCanonical: canonical, resourceKind: kind }
        ),
      ],
    };
  }

  if (
    kind === RESOURCE_KIND.VENUE ||
    kind === RESOURCE_KIND.EQUIPMENT ||
    kind === RESOURCE_KIND.CUSTOM_RESOURCE
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING,
          "Explicit capacity is required when capacity checking is enabled for this resource kind",
          { resourceKeyCanonical: canonical, resourceKind: kind }
        ),
      ],
    };
  }

  return {
    ok: false,
    diagnostics: [
      diagnostic(INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING, "Resource capacity missing", {
        resourceKeyCanonical: canonical,
        resourceKind: kind,
      }),
    ],
  };
}

/**
 * @param {string} resourceKind
 * @returns {string}
 */
export function resolveCapacityFindingCode(resourceKind) {
  if (resourceKind === RESOURCE_KIND.VENUE) {
    return RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED;
  }
  return RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED;
}
