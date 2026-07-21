/**
 * CORE-09 Match Generator — schema and generator identity constants.
 * Phase 1B: contracts foundation only (no production executor).
 */

/** Schema version for CORE-09 match-generation domain objects. */
export const MATCH_GENERATION_SCHEMA_VERSION = "core09.match-generation.v1";

/**
 * Generator identity bound into MatchPlan / fingerprints.
 * Bump when stable logical key derivation or canonical fingerprint material changes.
 */
export const MATCH_GENERATOR_IDENTITY = Object.freeze({
  id: "CORE09_MATCH_GENERATOR",
  version: "1.0.0-phase1b",
});

/** @type {ReadonlySet<string>} */
export const FORBIDDEN_MATCH_PLAN_FIELDS = Object.freeze(
  new Set([
    "scheduledAt",
    "date",
    "time",
    "courtId",
    "refereeId",
    "score",
    "playedWinner",
    "winnerId",
    "loserId",
    "liveStatus",
    "matchStatus",
    "lifecycleStatus",
    "standings",
    "standingPoints",
  ])
);
