/**
 * CORE-08 Phase 1B — Target A: Seeded Tournament Grouping adapter.
 * Maps legacy seeded snake group fixtures → Phase 3H SNAKE_GROUPS.
 * No placement algorithm. No seed calculation from rating.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import { runCertificationResolve } from "./runCertificationResolve.js";

export const SEEDED_GROUPING_ADAPTER_ID = "CORE08_SEEDED_GROUPING_CERT";

/**
 * @param {object} input
 * @param {string} input.competitionId
 * @param {string} input.contextId
 * @param {Array} input.entries ranked or seed-bearing entries/teams
 * @param {number} input.groupCount
 * @param {number} [input.groupCapacity]
 * @param {unknown} [input.deterministicSeed]
 * @param {object} [resolverOptions]
 */
export async function runSeededGroupingAdapter(input = {}, resolverOptions = {}) {
  const entries = Array.isArray(input.entries)
    ? input.entries
    : Array.isArray(input.teams)
      ? input.teams
      : [];

  /** @type {Map<string, unknown>} */
  const entriesById = new Map();
  for (const entry of entries) {
    if (entry && typeof entry === "object" && entry.id != null) {
      entriesById.set(String(entry.id), entry);
    }
  }

  return runCertificationResolve(
    {
      ...input,
      entries,
      legacyMode: input.legacyMode || "skill_controlled",
      drawMode: input.drawMode || DRAW_MODE.SNAKE_GROUPS,
      allowConditionalMode: true,
      // Ranked array order becomes seed 1..n when seedNumber absent — not a rating calc.
      forbidImpliedSeeds: input.forbidImpliedSeeds === true,
    },
    {
      target: "A_SEEDED_TOURNAMENT_GROUPING",
      parity: "SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES",
      resolverOptions,
      entriesById,
      namePrefix: input.namePrefix || "Bảng ",
      acceptedDifferences: [
        "Legacy snake group records used wall-clock group ids; adapter uses draw identity keys.",
        "Legacy name uses 'Bảng {label}'; adapter mirrors that via namePrefix.",
        "Seed ranking must be supplied by caller (seedNumber or ranked array order). Adapter does not read avgLevel/rating.",
      ],
      unsupportedBehavior: [
        "entriesToTeams / player avgLevel enrichment (format/pairing ownership)",
        "In-adapter non-deterministic shuffle for legacy open seeding mode (use Target B)",
      ],
    }
  );
}
