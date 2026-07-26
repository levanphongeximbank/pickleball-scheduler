/**
 * EC-06 — Public Portal LIVE cutover classification vocabulary.
 * Certification inventory only — does not fetch or mutate runtime data.
 */

export const PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION = Object.freeze({
  CERTIFIED_LIVE_CUTOVER: "CERTIFIED_LIVE_CUTOVER",
  LIVE_SOURCE_NOT_CERTIFIED: "LIVE_SOURCE_NOT_CERTIFIED",
  NO_REMOTE_SOURCE: "NO_REMOTE_SOURCE",
  HIGH_COLLISION_DEFERRED: "HIGH_COLLISION_DEFERRED",
  ALREADY_LIVE_NO_CHANGE: "ALREADY_LIVE_NO_CHANGE",
  MOCK_WITH_HONEST_PROVENANCE: "MOCK_WITH_HONEST_PROVENANCE",
});

export const PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicPortalLiveCutoverClassification(value) {
  return PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION_VALUES.includes(String(value || "").trim());
}
