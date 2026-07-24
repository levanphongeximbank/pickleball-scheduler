/**
 * CM-06 fingerprint algorithm + manifest schema version identities.
 * Not a security signature and not CORE-21 replay/ownership fingerprinting.
 */

export const COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM = Object.freeze({
  id: "cm06-fnv1a32-v1",
  prefix: "cm06-",
  version: 1,
});

/** Deterministic public manifest schema identity. */
export const COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION = "cm06-manifest-v1";

/** Typed field difference kinds, kept for parity with sibling comparison modules. */
export const COMPETITION_PUBLICATION_CHANGE_TYPE = Object.freeze({
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  CHANGED: "CHANGED",
});

export const COMPETITION_PUBLICATION_CHANGE_TYPE_VALUES = Object.freeze(
  Object.values(COMPETITION_PUBLICATION_CHANGE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionPublicationChangeType(value) {
  return (
    typeof value === "string" &&
    COMPETITION_PUBLICATION_CHANGE_TYPE_VALUES.includes(value)
  );
}
