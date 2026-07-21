import { deepFreeze } from "./deepFreeze.js";
import { normalizeManualSeedOverride } from "./normalizeManualSeedOverride.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * Normalize override collection; reject duplicate overrideId fail-closed.
 * Does not silently dedupe. Does not depend on input array order for acceptance.
 *
 * @param {unknown} rawOverrides
 * @returns {ReadonlyArray<import('./normalizeManualSeedOverride.js').NormalizedManualSeedOverride>}
 */
export function normalizeManualSeedOverrides(rawOverrides) {
  if (rawOverrides == null) {
    return deepFreeze([]);
  }
  if (!Array.isArray(rawOverrides)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "manualOverrides must be an array",
      { field: "manualOverrides" }
    );
  }

  /** @type {import('./normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (let i = 0; i < rawOverrides.length; i += 1) {
    const normalized = normalizeManualSeedOverride(rawOverrides[i]);
    if (seen.has(normalized.overrideId)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "Duplicate overrideId in override collection",
        {
          overrideId: normalized.overrideId,
          field: "overrideId",
        }
      );
    }
    seen.add(normalized.overrideId);
    out.push(normalized);
  }

  return deepFreeze(out.slice());
}

/**
 * Deterministic override ordering for conflict processing (stable overrideId ASC).
 * Input array order must not affect conflict outcomes.
 *
 * @param {ReadonlyArray<import('./normalizeManualSeedOverride.js').NormalizedManualSeedOverride>} overrides
 * @returns {import('./normalizeManualSeedOverride.js').NormalizedManualSeedOverride[]}
 */
export function sortOverridesDeterministically(overrides) {
  return overrides.slice().sort((a, b) => {
    if (a.overrideId === b.overrideId) return 0;
    return a.overrideId < b.overrideId ? -1 : 1;
  });
}
