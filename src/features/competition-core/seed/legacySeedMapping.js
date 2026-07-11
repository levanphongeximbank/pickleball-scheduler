import { CANONICAL_SEED_SOURCE } from "./seedConstants.js";

/**
 * Legacy seed source inventory and mapping — CC-04B audit reference.
 * Does not mutate runtime engines.
 *
 * @type {ReadonlyArray<{ legacyKey: string, context: string, canonical: string }>}
 */
export const LEGACY_SEED_SOURCE_MAPPINGS = Object.freeze([
  {
    legacyKey: "level",
    context: "player.rating ?? player.level (teamPairingEngine)",
    canonical: CANONICAL_SEED_SOURCE.AVERAGE_LEVEL,
  },
  {
    legacyKey: "ratingInternal",
    context: "getPlayerRatingInternal (team tournament)",
    canonical: CANONICAL_SEED_SOURCE.INTERNAL_RATING,
  },
  {
    legacyKey: "elo",
    context: "tournament-engine seedEngine participant.elo",
    canonical: CANONICAL_SEED_SOURCE.COMPETITION_ELO,
  },
  {
    legacyKey: "clubRating.elo",
    context: "tournamentEngineAdapter club extension",
    canonical: CANONICAL_SEED_SOURCE.CLUB_ELO,
  },
  {
    legacyKey: "manualSeedOverride",
    context: "seedEngine manual override",
    canonical: CANONICAL_SEED_SOURCE.MANUAL,
  },
  {
    legacyKey: "manualPriority",
    context: "seedEngine weighted bump",
    canonical: CANONICAL_SEED_SOURCE.MANUAL_ADJUSTMENT,
  },
  {
    legacyKey: "winRate",
    context: "seedEngine stats blend",
    canonical: CANONICAL_SEED_SOURCE.WIN_RATE,
  },
  {
    legacyKey: "recentPerformance",
    context: "seedEngine performance metric",
    canonical: CANONICAL_SEED_SOURCE.PERFORMANCE,
  },
  {
    legacyKey: "provisional_rating",
    context: "Pick_VN player blob (not yet read by seed engines)",
    canonical: CANONICAL_SEED_SOURCE.PROVISIONAL,
  },
  {
    legacyKey: "unseeded",
    context: "seedEngine new player gate",
    canonical: CANONICAL_SEED_SOURCE.NEW_PLAYER,
  },
  {
    legacyKey: "entry.rating",
    context: "stored entry blob fallback",
    canonical: CANONICAL_SEED_SOURCE.LEGACY_BLOB,
  },
  {
    legacyKey: "team.avgLevel",
    context: "stored team blob fallback",
    canonical: CANONICAL_SEED_SOURCE.LEGACY_BLOB,
  },
  {
    legacyKey: "stripOpenEntryMetadata",
    context: "official open tournament override",
    canonical: CANONICAL_SEED_SOURCE.TOURNAMENT_OVERRIDE,
  },
  {
    legacyKey: "seedScore",
    context: "seedEngine composite blend",
    canonical: CANONICAL_SEED_SOURCE.COMPOSITE,
  },
  {
    legacyKey: "groupSeeding:off",
    context: "team tournament random shuffle",
    canonical: CANONICAL_SEED_SOURCE.RANDOM,
  },
  {
    legacyKey: "standingRank",
    context: "post-draw ranking / season standings",
    canonical: CANONICAL_SEED_SOURCE.RANKING,
  },
]);

/**
 * @param {unknown} legacyKey
 * @param {string} [contextHint]
 * @returns {string}
 */
export function mapLegacySeedSourceToCanonical(legacyKey, contextHint) {
  const key = String(legacyKey || "")
    .trim()
    .toLowerCase();

  if (!key) {
    return CANONICAL_SEED_SOURCE.UNKNOWN;
  }

  if (contextHint) {
    const contextual = LEGACY_SEED_SOURCE_MAPPINGS.find(
      (entry) =>
        entry.legacyKey.toLowerCase() === key &&
        entry.context.toLowerCase().includes(String(contextHint).toLowerCase())
    );
    if (contextual) {
      return contextual.canonical;
    }
  }

  const match = LEGACY_SEED_SOURCE_MAPPINGS.find(
    (entry) => entry.legacyKey.toLowerCase() === key
  );
  return match ? match.canonical : CANONICAL_SEED_SOURCE.UNKNOWN;
}

/**
 * Inventory list for CC-04B audit documentation.
 *
 * @returns {string[]}
 */
export function listLegacySeedSourceKeys() {
  return LEGACY_SEED_SOURCE_MAPPINGS.map((entry) => entry.legacyKey);
}
