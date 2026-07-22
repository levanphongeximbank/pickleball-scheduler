/**
 * CORE-13 — generic referee role codes (extensible stable strings).
 * Minimum set only; no sport-specific invention beyond generic staffing roles.
 */

export const REFEREE_ROLE_CODE = Object.freeze({
  PRIMARY: "PRIMARY",
  ASSISTANT: "ASSISTANT",
  OBSERVER: "OBSERVER",
  ANY: "ANY",
});

/** @type {ReadonlySet<string>} */
export const REFEREE_ROLE_CODE_VALUES = new Set(
  Object.values(REFEREE_ROLE_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRefereeRoleCode(value) {
  return typeof value === "string" && REFEREE_ROLE_CODE_VALUES.has(value);
}

/**
 * Extensible: known enum OR non-empty stable string (uppercase recommended).
 * Unknown codes are allowed as extension strings but must be non-empty.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeRefereeRoleCode(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
