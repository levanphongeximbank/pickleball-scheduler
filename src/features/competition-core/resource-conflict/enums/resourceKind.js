/**
 * CORE-14 — ResourceKind. Unknown values fail closed.
 * Immutable; do not use caller-provided arbitrary strings as canonical enums.
 */

export const RESOURCE_KIND = Object.freeze({
  PLAYER: "PLAYER",
  TEAM: "TEAM",
  COURT: "COURT",
  REFEREE: "REFEREE",
  VENUE: "VENUE",
  LOCATION: "LOCATION",
  EQUIPMENT: "EQUIPMENT",
  CUSTOM_RESOURCE: "CUSTOM_RESOURCE",
});

/** Frozen ordered list — do not rely on object insertion order elsewhere. */
export const RESOURCE_KIND_VALUES = Object.freeze([
  RESOURCE_KIND.PLAYER,
  RESOURCE_KIND.TEAM,
  RESOURCE_KIND.COURT,
  RESOURCE_KIND.REFEREE,
  RESOURCE_KIND.VENUE,
  RESOURCE_KIND.LOCATION,
  RESOURCE_KIND.EQUIPMENT,
  RESOURCE_KIND.CUSTOM_RESOURCE,
]);

const RESOURCE_KIND_SET = new Set(RESOURCE_KIND_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isResourceKind(value) {
  return typeof value === "string" && RESOURCE_KIND_SET.has(value);
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function resolveResourceKind(value) {
  if (value == null || value === "") {
    return { ok: false, reason: "RESOURCE_KIND_REQUIRED" };
  }
  if (!isResourceKind(value)) {
    return { ok: false, reason: "RESOURCE_KIND_UNKNOWN" };
  }
  return { ok: true, value: /** @type {string} */ (value) };
}
