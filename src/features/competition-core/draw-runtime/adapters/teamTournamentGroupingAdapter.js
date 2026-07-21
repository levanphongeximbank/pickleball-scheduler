/**
 * CORE-08 Phase 1B/1D — Target C: Team Tournament group draw adapter.
 * Maps generic team identity + seed references only. No lineup/match rules.
 *
 * Open paths (Phase 1D):
 * - placementKind "open_random" → OPEN_RANDOM_GROUPS (shuffle-then-round-robin; 1B partial parity)
 * - placementKind "open_shuffled_snake" → OPEN_SHUFFLED_SNAKE_GROUPS (shuffle-then-snake)
 * Adapter never shuffles or snakes itself.
 */

import { DRAW_MODE } from "../enums/drawModes.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
} from "./certificationErrors.js";
import { runCertificationResolve } from "./runCertificationResolve.js";

export const TEAM_TOURNAMENT_GROUPING_ADAPTER_ID = "CORE08_TT_GROUPING_CERT";

/**
 * @param {object} input
 * @param {'seeded_snake'|'open_random'|'open_shuffled_snake'} [input.placementKind]
 * @param {Array} input.teams teams with id and optional seed/seedNumber
 */
export async function runTeamTournamentGroupingAdapter(
  input = {},
  resolverOptions = {}
) {
  if (Array.isArray(input.privatePairingRules) && input.privatePairingRules.length) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED,
      "Team Tournament private pairing rules are outside CORE-08 placement",
      { hardening: "HARDENING_REQUIRED", ruleCount: input.privatePairingRules.length }
    );
  }
  if (Array.isArray(input.pairingConstraints) && input.pairingConstraints.length) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED,
      "Team Tournament pairing constraints are outside CORE-08 placement",
      { hardening: "HARDENING_REQUIRED" }
    );
  }

  const placementKind =
    input.placementKind ||
    (input.seedingMode === "off" || input.seedingMode === "OFF"
      ? "open_random"
      : "seeded_snake");

  const teams = Array.isArray(input.teams) ? input.teams : [];
  const entriesById = new Map();
  for (const team of teams) {
    if (team && typeof team === "object" && team.id != null) {
      entriesById.set(String(team.id), team);
    }
  }

  if (placementKind === "open_shuffled_snake") {
    if (input.deterministicSeed == null && input.seed == null) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
        "deterministicSeed required for TT open_shuffled_snake certification path",
        {}
      );
    }
    return runCertificationResolve(
      {
        ...input,
        teams,
        legacyMode: "tt_open_shuffle_snake",
        drawMode: DRAW_MODE.OPEN_SHUFFLED_SNAKE_GROUPS,
        allowConditionalMode: true,
      },
      {
        target: "C_TEAM_TOURNAMENT_GROUP_DRAW",
        parity: "SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES",
        resolverOptions,
        entriesById,
        namePrefix: input.namePrefix || "Bảng ",
        acceptedDifferences: [
          "Canonical path: Phase 3H OPEN_SHUFFLED_SNAKE_GROUPS (existing shuffle primitive + snake placement).",
          "Team rating sort (sortTeamsForGroupSeeding) remains format-owned — supply seedNumber/order here.",
          "createId('grp') legacy group ids replaced by draw identity keys.",
          "Legacy TT PRNG (createSeededRng) is not executed; Phase 3H mulberry32 from deterministicSeed is used.",
        ],
        unsupportedBehavior: [
          "Private pairing candidate search",
          "Lineup / matchup / dreambreaker rules",
          "In-adapter rating-based reseeding",
          "Adapter-local shuffle or snake algorithms",
        ],
      }
    );
  }

  if (placementKind === "open_random") {
    if (input.deterministicSeed == null && input.seed == null) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
        "deterministicSeed required for TT open_random certification path",
        {}
      );
    }
    return runCertificationResolve(
      {
        ...input,
        teams,
        // Explicit OPEN_RANDOM keeps Phase 1B partial-parity path distinguishable.
        legacyMode: "open",
        drawMode: DRAW_MODE.OPEN_RANDOM_GROUPS,
        allowConditionalMode: true,
      },
      {
        target: "C_TEAM_TOURNAMENT_GROUP_DRAW",
        parity: "PARTIAL_PARITY",
        resolverOptions,
        entriesById,
        namePrefix: input.namePrefix || "Bảng ",
        acceptedDifferences: [
          "TT OFF seeding legacy is shuffle-then-snake; this path uses OPEN_RANDOM_GROUPS (shuffle-then-round-robin).",
          "Use placementKind 'open_shuffled_snake' for Phase 1D shuffle-then-snake compatibility.",
          "Team rating sort (sortTeamsForGroupSeeding) remains format-owned — supply seedNumber here.",
          "createId('grp') legacy group ids replaced by draw identity keys.",
        ],
        unsupportedBehavior: [
          "Private pairing candidate search",
          "Lineup / matchup / dreambreaker rules",
          "In-adapter rating-based reseeding",
        ],
      }
    );
  }

  if (placementKind !== "seeded_snake") {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MODE_AMBIGUOUS,
      `Unsupported Team Tournament placementKind: ${String(placementKind)}`,
      {
        placementKind,
        supported: ["seeded_snake", "open_random", "open_shuffled_snake"],
      }
    );
  }

  return runCertificationResolve(
    {
      ...input,
      teams,
      legacyMode: "tt_avg_level_snake",
      drawMode: DRAW_MODE.SNAKE_GROUPS,
      allowConditionalMode: true,
      forbidImpliedSeeds: input.forbidImpliedSeeds === true,
    },
    {
      target: "C_TEAM_TOURNAMENT_GROUP_DRAW",
      parity: "SEMANTIC_PARITY_WITH_DOCUMENTED_DIFFERENCES",
      resolverOptions,
      entriesById,
      namePrefix: input.namePrefix || "Bảng ",
      acceptedDifferences: [
        "Caller must provide seedNumber (or ranked team order). computeTeamSeedMetrics stays format-owned.",
        "Group display names use deterministic Bảng {A..}; legacy createId ids are not reproduced.",
      ],
      unsupportedBehavior: [
        "Private pairing / constraint repair",
        "Lineup and match generation",
      ],
    }
  );
}
