/**
 * CM-03 Competition Versioning — version state, numbering, change types.
 *
 * CompetitionVersion is an immutable historical snapshot.
 * Lifecycle states (published/suspended/cancelled/archived) belong to CM-06..CM-08.
 */

/** Immutable frozen snapshot state only. */
export const COMPETITION_VERSION_STATE = Object.freeze({
  FROZEN: "frozen",
});

export const COMPETITION_VERSION_STATE_VALUES = Object.freeze(
  Object.values(COMPETITION_VERSION_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionVersionState(value) {
  return COMPETITION_VERSION_STATE_VALUES.includes(/** @type {string} */ (value));
}

/** First version number within a competition lineage (monotonic, integer >= 1). */
export const COMPETITION_VERSION_INITIAL_NUMBER = 1;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionVersionNumber(value) {
  return Number.isInteger(value) && /** @type {number} */ (value) >= 1;
}

/**
 * @param {number} current
 * @returns {number}
 */
export function nextCompetitionVersionNumber(current) {
  if (!isValidCompetitionVersionNumber(current)) {
    throw new Error("current version number must be an integer >= 1");
  }
  return current + 1;
}

/** Typed field difference kinds for version comparison. */
export const COMPETITION_VERSION_CHANGE_TYPE = Object.freeze({
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  CHANGED: "CHANGED",
});

export const COMPETITION_VERSION_CHANGE_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_VERSION_CHANGE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionVersionChangeType(value) {
  return COMPETITION_VERSION_CHANGE_TYPE_VALUES.includes(
    /** @type {string} */ (value)
  );
}

/**
 * Fingerprint algorithm identity (not a security signature).
 * Local to CM-03 — do not treat as CORE-21 replay fingerprint ownership.
 */
export const COMPETITION_VERSION_FINGERPRINT_ALGORITHM = Object.freeze({
  id: "cm03-fnv1a32-v1",
  prefix: "cm03-",
});

/** Definition fields that restore proposals must never alter. */
export const COMPETITION_VERSION_IMMUTABLE_DEFINITION_FIELDS = Object.freeze([
  "competitionId",
  "tenantId",
  "owner",
  "createdAt",
]);
