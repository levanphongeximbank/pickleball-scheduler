/**
 * Phase 3G — Legacy seeding source → SeedingCandidate[] (map-only).
 * Accepts plain objects — no Production engine imports.
 */

import { createSeedingCandidate } from "../contracts/seedingCandidate.js";
import { CANDIDATE_TYPE } from "../enums/candidateTypes.js";
import { SEEDING_SOURCE_TYPE } from "../enums/seedingSourceTypes.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { SeedingRuntimeError } from "../errors/SeedingRuntimeError.js";
import { normalizeCandidates } from "../services/normalizeCandidates.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacySeedingSource(source, context = {}) {
  if (Array.isArray(source)) return source.length > 0;
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === SEEDING_SOURCE_TYPE.LEGACY ||
    explicit === "LEGACY_SEEDING" ||
    explicit === "LEGACY"
  ) {
    return true;
  }
  if (Array.isArray(s.participants) || Array.isArray(s.entries) || Array.isArray(s.teams)) {
    return true;
  }
  if (s.id != null && (s.seed != null || s.elo != null || s.rating != null || s.name != null)) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../contracts/seedingCandidate.js').SeedingCandidate[]}
 */
export function mapLegacySeedingToCandidates(source, context = {}) {
  if (!isLegacySeedingSource(source, context)) {
    throw new SeedingRuntimeError(
      SEEDING_RUNTIME_ERROR_CODE.SEEDING_UNSUPPORTED_SOURCE,
      "Source is not a legacy seeding payload",
      {}
    );
  }

  /** @type {Array<Record<string, unknown>>} */
  let rows = [];
  if (Array.isArray(source)) {
    rows = source.filter((item) => item && typeof item === "object");
  } else if (source && typeof source === "object") {
    const s = /** @type {Record<string, unknown>} */ (source);
    if (Array.isArray(s.participants)) {
      rows = s.participants;
    } else if (Array.isArray(s.entries)) {
      rows = s.entries;
    } else if (Array.isArray(s.teams)) {
      rows = s.teams.map((team) => ({
        .../** @type {Record<string, unknown>} */ (team),
        candidateType: CANDIDATE_TYPE.TEAM,
        teamId: /** @type {Record<string, unknown>} */ (team).id,
      }));
    } else {
      rows = [s];
    }
  }

  const competitionId = String(context.competitionId || "");
  const contextId = String(context.contextId || "");
  const seedingIdentityKey =
    typeof context.seedingIdentityKey === "string"
      ? context.seedingIdentityKey
      : undefined;

  const normalized = normalizeCandidates(rows, {
    competitionId,
    contextId,
    seedingIdentityKey,
  });

  // Ensure factory shape is frozen-consistent via createSeedingCandidate again
  return normalized.map((candidate) =>
    createSeedingCandidate({
      ...candidate,
      competitionId,
      contextId,
      seedingIdentityKey,
    })
  );
}
