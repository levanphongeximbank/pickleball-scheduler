/**
 * Honest NOT_CONFIGURED snapshots for Referee qualification / availability.
 * Adapter B and Referee Domain do not currently expose these capabilities.
 * Do not synthesize success.
 */

import {
  createEmptySnapshotResult,
  createMissingSnapshotResult,
} from "../../../../../competition-core/referee-assignment/ports/portResult.js";

export const REFEREE_EVIDENCE_CAPABILITY = Object.freeze({
  QUALIFICATION: "NOT_CONFIGURED",
  AVAILABILITY: "NOT_CONFIGURED",
  IDENTITY: "IDENTITY_PROFILES_REFEREE_ROLE",
  ACTIVE_STATUS: "IDENTITY_PROFILES_STATUS",
});

export function createNotConfiguredQualificationSnapshot() {
  return createEmptySnapshotResult(
    "Referee qualification capability is NOT_CONFIGURED at Contract #08 / Adapter B"
  );
}

export function createNotConfiguredAvailabilitySnapshot() {
  return createEmptySnapshotResult(
    "Referee availability capability is NOT_CONFIGURED at Contract #08 / Adapter B"
  );
}

export function createRequiredMissingQualificationSnapshot() {
  return createMissingSnapshotResult(
    "Required qualification evidence is unavailable; fail closed"
  );
}

export function createRequiredMissingAvailabilitySnapshot() {
  return createMissingSnapshotResult(
    "Required availability evidence is unavailable; fail closed"
  );
}
