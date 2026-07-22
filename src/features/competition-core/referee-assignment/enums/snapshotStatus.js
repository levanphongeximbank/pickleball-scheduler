/**
 * Port snapshot resolution kinds — distinguish missing / invalid / empty / populated.
 */

export const REFEREE_SNAPSHOT_STATUS = Object.freeze({
  MISSING: "MISSING",
  INVALID: "INVALID",
  EMPTY: "EMPTY",
  POPULATED: "POPULATED",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_SNAPSHOT_STATUS_VALUES = new Set(
  Object.values(REFEREE_SNAPSHOT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeSnapshotStatus(value) {
  return typeof value === "string" && REFEREE_SNAPSHOT_STATUS_VALUES.has(value);
}

/** Opaque resource type for CORE-14 Resource Conflict Resolver projections. */
export const REFEREE_RESOURCE_TYPE = Object.freeze({
  REFEREE: "REFEREE",
});
