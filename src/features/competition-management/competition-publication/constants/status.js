/**
 * CM-06 publication status baseline (stored record status).
 *
 * PUBLISHED  — the currently active publication record for a tenant+competition+channel.
 * SUPERSEDED — an immutable prior publication record replaced by a newer republish.
 * FAILED     — reserved for a persisted failure record; CM-06 prefers to fail closed
 *              during readiness (before any record is created) and therefore does not
 *              normally create FAILED records.
 *
 * Does NOT own SUSPENDED / CANCELLED / ARCHIVED — those lifecycle states belong to
 * other capabilities (e.g. CM-07 suspension, CM-08 archive) and are never produced here.
 */

export const COMPETITION_PUBLICATION_STATUS = Object.freeze({
  PUBLISHED: "PUBLISHED",
  SUPERSEDED: "SUPERSEDED",
  FAILED: "FAILED",
});

export const COMPETITION_PUBLICATION_STATUS_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationStatus(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_STATUS_VALUES.includes(value)
  );
}

/**
 * Semantic outcomes that are never stored as a record `status`:
 *
 * UNPUBLISHED — semantic meaning "no current publication exists" for a scope.
 * READY       — a readiness evaluation outcome only (first publish success is
 *               represented by stored status PUBLISHED, not READY).
 */
export const COMPETITION_PUBLICATION_SEMANTIC_STATE = Object.freeze({
  UNPUBLISHED: "UNPUBLISHED",
  READY: "READY",
  NOT_READY: "NOT_READY",
});

export const COMPETITION_PUBLICATION_SEMANTIC_STATE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_SEMANTIC_STATE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationSemanticState(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_SEMANTIC_STATE_VALUES.includes(value)
  );
}
