/**
 * CM-08 fingerprint + schema identities.
 */

export const COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM = Object.freeze({
  id: "cm08-fnv1a32-v1",
  prefix: "cm08-",
  version: 1,
});

export const COMPETITION_ARCHIVE_RECORD_SCHEMA_VERSION = "cm08-archive-v1";

export const COMPETITION_ARCHIVE_MANIFEST_SCHEMA_VERSION = "cm08-archive-manifest-v1";

export const COMPETITION_ARCHIVE_INTENT_EXECUTION_STATUS = Object.freeze({
  PROPOSED: "PROPOSED",
});
