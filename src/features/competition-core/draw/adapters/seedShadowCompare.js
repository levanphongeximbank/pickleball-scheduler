import { runCanonicalSeedPipeline } from "../../seed/seedPipeline.js";
import { createSeedRequest } from "../../seed/seedContracts.js";

/**
 * @typedef {Object} SeedShadowComparisonRow
 * @property {string} participantId
 * @property {number|null} legacySeedNumber
 * @property {number|null} canonicalSeedNumber
 * @property {number|null} legacySeedScore
 * @property {number|null} canonicalSeedScore
 * @property {string|null} sourceDifference
 * @property {boolean} rankingMismatch
 * @property {boolean} tieBreakDifference
 * @property {number|null} confidence
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} SeedShadowComparison
 * @property {boolean} ok
 * @property {SeedShadowComparisonRow[]} rows
 * @property {string[]} warnings
 * @property {import('../../seed/seedTypes.js').SeedResult} canonicalResult
 */

/**
 * Shadow-only seed comparison. Legacy seeds remain authoritative for business output.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} input.participants
 * @param {Array<{ participantId: string, seedNumber: number, seedScore?: number|null, source?: string|null }>} input.legacySeeds
 * @param {Partial<import('../../seed/seedTypes.js').SeedRequest>} [input.seedRequest]
 */
export function compareSeedShadowParity(input = {}) {
  const participants = input.participants || [];
  const legacySeeds = input.legacySeeds || [];
  const legacyById = new Map(legacySeeds.map((seed) => [String(seed.participantId), seed]));

  const canonicalResult = runCanonicalSeedPipeline(
    createSeedRequest({
      participants,
      ...(input.seedRequest || {}),
    })
  );

  /** @type {SeedShadowComparisonRow[]} */
  const rows = [];
  /** @type {string[]} */
  const warnings = [];

  for (const canonicalSeed of canonicalResult.seeds || []) {
    const participantId = String(canonicalSeed.participantId);
    const legacySeed = legacyById.get(participantId);
    const legacySeedNumber = legacySeed?.seedNumber ?? null;
    const canonicalSeedNumber = canonicalSeed.seedNumber ?? null;
    const legacySeedScore = legacySeed?.seedScore ?? null;
    const canonicalSeedScore = canonicalSeed.seedScore ?? null;
    const rankingMismatch =
      legacySeedNumber != null &&
      canonicalSeedNumber != null &&
      legacySeedNumber !== canonicalSeedNumber;
    const sourceDifference =
      legacySeed?.source && canonicalSeed.source && legacySeed.source !== canonicalSeed.source
        ? `${legacySeed.source} -> ${canonicalSeed.source}`
        : null;
    const tieBreakDifference =
      rankingMismatch &&
      legacySeedScore != null &&
      canonicalSeedScore != null &&
      legacySeedScore === canonicalSeedScore;

    const rowWarnings = [];
    if (rankingMismatch) {
      rowWarnings.push("Ranking mismatch");
    }
    if (tieBreakDifference) {
      rowWarnings.push("Equal score but different rank — tie-break difference");
    }
    if (sourceDifference) {
      rowWarnings.push(`Source difference: ${sourceDifference}`);
    }

    rows.push({
      participantId,
      legacySeedNumber,
      canonicalSeedNumber,
      legacySeedScore,
      canonicalSeedScore,
      sourceDifference,
      rankingMismatch,
      tieBreakDifference,
      confidence: canonicalSeed.confidence ?? null,
      warnings: rowWarnings,
    });
  }

  for (const legacySeed of legacySeeds) {
    if (!rows.some((row) => row.participantId === String(legacySeed.participantId))) {
      warnings.push(`Legacy seed participant missing from canonical pipeline: ${legacySeed.participantId}`);
    }
  }

  const ok = rows.every((row) => !row.rankingMismatch) && warnings.length === 0;
  if (!ok) {
    warnings.push("Seed shadow comparison detected mismatches — legacy output unchanged.");
  }

  return {
    ok,
    rows,
    warnings,
    canonicalResult,
  };
}

/**
 * Build legacy seed rows from sorted participant order (shadow helper).
 *
 * @param {Array<Record<string, unknown>>} sortedParticipants
 * @param {string} [source]
 */
export function buildLegacySeedRowsFromOrder(sortedParticipants = [], source = "legacy_runtime") {
  return sortedParticipants.map((participant, index) => ({
    participantId: String(participant.id ?? participant.participantId ?? `p-${index + 1}`),
    seedNumber: index + 1,
    seedScore: Number(participant.seedScore ?? participant.rating ?? participant.level ?? 0),
    source,
  }));
}
