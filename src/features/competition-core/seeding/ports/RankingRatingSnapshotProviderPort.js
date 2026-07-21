/**
 * CORE-07 RankingRatingSnapshotProviderPort — capability-local (Phase 1F).
 * CORE-07 consumes snapshots; it does not calculate ranking or rating.
 * No Supabase / database adapter in this module.
 */

import {
  createSeedingDomainError,
} from "../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";
import { CORE07_SNAPSHOT_PROVIDER_PORT_VERSION } from "../domain/constants.js";

export { CORE07_SNAPSHOT_PROVIDER_PORT_VERSION };

/**
 * @typedef {Object} RankingRatingSnapshot
 * @property {string} snapshotId
 * @property {string} sourceSystem
 * @property {string} sourceVersion
 * @property {string|number} capturedAt
 * @property {string|number} effectiveAt
 * @property {ReadonlyArray<Record<string, unknown>>|Record<string, unknown>} subjectValues
 * @property {string} completenessState
 * @property {ReadonlyArray<Record<string, unknown>>|null} [missingDataMetadata]
 * @property {string|null} [checksum]
 * @property {string|null} [fingerprint]
 * @property {Record<string, unknown>|null} [scopeRef]
 */

/**
 * @typedef {Object} RankingRatingSnapshotProviderPort
 * @property {string} contractVersion
 * @property {(input: {
 *   seedingScope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 *   entryIds: string[],
 *   effectiveAt: string|number,
 *   snapshotRef?: string|null,
 * }) => RankingRatingSnapshot} getSnapshot
 */

/**
 * @param {unknown} port
 * @returns {port is RankingRatingSnapshotProviderPort}
 */
export function isRankingRatingSnapshotProviderPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {RankingRatingSnapshotProviderPort} */ (port)
      .contractVersion === "string" &&
    /** @type {RankingRatingSnapshotProviderPort} */ (port).contractVersion
      .length > 0 &&
    typeof /** @type {RankingRatingSnapshotProviderPort} */ (port)
      .getSnapshot === "function"
  );
}

/**
 * @param {unknown} port
 * @param {boolean} [required]
 * @returns {RankingRatingSnapshotProviderPort|null}
 */
export function requireRankingRatingSnapshotProviderPort(port, required = true) {
  if (port == null) {
    if (!required) return null;
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "RankingRatingSnapshotProviderPort is required",
      { failClosed: true }
    );
  }
  if (!isRankingRatingSnapshotProviderPort(port)) {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "RankingRatingSnapshotProviderPort contract is invalid",
      { failClosed: true }
    );
  }
  return port;
}

/**
 * @param {RankingRatingSnapshotProviderPort} port
 * @param {object} input
 * @returns {RankingRatingSnapshot}
 */
export function getSnapshotThroughPort(port, input) {
  const safe = requireRankingRatingSnapshotProviderPort(port, true);
  try {
    const snap = safe.getSnapshot(input);
    if (!snap || typeof snap !== "object" || !snap.snapshotId) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
        "Snapshot provider returned invalid snapshot",
        { failClosed: true }
      );
    }
    return snap;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      typeof /** @type {{ code?: string }} */ (err).code === "string"
    ) {
      throw err;
    }
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "RankingRatingSnapshotProviderPort.getSnapshot failed",
      {
        failClosed: true,
        details: {
          message: err instanceof Error ? err.message : String(err),
        },
      }
    );
  }
}
