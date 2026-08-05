/**
 * Fixture allowlist metadata without scoring imports (browser-safe).
 */

import {
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_VERSION,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
} from "./constants.js";

export const APPROVED_ID_HASHES = Object.freeze([
  "e97fa28f4a36",
  "0b464be6cbba",
  "9154af71ee16",
  "d678d828c636",
  "3d644a31b486",
]);

export const FIXTURE_MANIFEST_META = Object.freeze({
  cohortLabel: FIXTURE_COHORT_LABEL,
  preparationVersion: FIXTURE_PREP_VERSION,
  mappingStatus: MAPPING_STATUS,
  normalizedEquivalence: NORMALIZED_EQUIVALENCE,
  candidateCount: APPROVED_ID_HASHES.length,
  wave1FixtureDomainRequired: true,
});
