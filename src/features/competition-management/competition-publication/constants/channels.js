/**
 * CM-06 publication channel identities (audit-minimal).
 *
 * PUBLIC_PORTAL   — canonical public competition portal route projection.
 * SHAREABLE_LINK  — restricted-audience shareable reference (club/tenant/public
 *                   visibility permitted; private is always rejected).
 *
 * Channel descriptors (audience classification, required profile, output
 * reference type, allowed visibilities) live in `channels/registry.js`.
 */

export const COMPETITION_PUBLICATION_CHANNEL = Object.freeze({
  PUBLIC_PORTAL: "PUBLIC_PORTAL",
  SHAREABLE_LINK: "SHAREABLE_LINK",
});

export const COMPETITION_PUBLICATION_CHANNEL_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_CHANNEL)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationChannel(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_CHANNEL_VALUES.includes(value)
  );
}

/** Audience classification for a channel descriptor (not the definition visibility). */
export const COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION = Object.freeze({
  PUBLIC: "public",
  RESTRICTED: "restricted",
});

export const COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationAudienceClassification(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_AUDIENCE_CLASSIFICATION_VALUES.includes(value)
  );
}

/** Output reference type produced by a channel (proposal-only identity, never a real URL). */
export const COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE = Object.freeze({
  PORTAL_ROUTE_REFERENCE: "PORTAL_ROUTE_REFERENCE",
  SHAREABLE_LINK_REFERENCE: "SHAREABLE_LINK_REFERENCE",
});

export const COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationOutputReferenceType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_OUTPUT_REFERENCE_TYPE_VALUES.includes(value)
  );
}
