/**
 * Translator-only scoring rules mapping into CORE-16 createScoringFormat.
 * Adapter B never calculates or persists scores.
 */

import { SCORING_SYSTEM } from "../../../../../competition-core/scoring/index.js";
import { applySideOutDoublesOpeningPolicy } from "./competitionContentProjection.js";
import { REFEREE_ADAPTER_ERROR_CODE } from "../../constants.js";
import { assertScoringRulesPayload } from "../../contract.js";
import { failRefereeAdapter } from "../../errors.js";
import { isPlainObject } from "../../helpers.js";

/** Documented Daily Play product default (not a scoring authority). */
export const DAILY_PLAY_DEFAULT_SCORING_RULES = Object.freeze({
  scoringSystem: SCORING_SYSTEM.SIDE_OUT,
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

/**
 * @param {unknown} raw
 * @param {{
 *   allowDailyPlayDefault?: boolean,
 *   matchFormat?: string|null,
 *   expectedPlayersPerSide?: number|null,
 * }} [options]
 */
export function mapModeScoringRulesToCore16(raw, options = {}) {
  if (raw == null) {
    if (options.allowDailyPlayDefault === true) {
      const withPolicy = applySideOutDoublesOpeningPolicy(
        { ...DAILY_PLAY_DEFAULT_SCORING_RULES },
        {
          matchFormat: options.matchFormat,
          expectedPlayersPerSide: options.expectedPlayersPerSide,
        }
      );
      return assertScoringRulesPayload(withPolicy);
    }
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules are required",
      {}
    );
  }
  if (!isPlainObject(raw)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules must be a plain object",
      {}
    );
  }

  // Team DreamBreaker / legacy aliases → CORE-16 fields
  const normalized = applySideOutDoublesOpeningPolicy(
    {
      ...raw,
      scoringSystem:
        raw.scoringSystem ||
        (raw.targetScore != null || raw.targetPoints != null
          ? SCORING_SYSTEM.RALLY
          : undefined),
      pointsToWin:
        raw.pointsToWin ?? raw.targetScore ?? raw.targetPoints ?? undefined,
      winBy: raw.winBy ?? undefined,
      bestOfGames: raw.bestOfGames ?? undefined,
    },
    {
      matchFormat: options.matchFormat || raw.matchFormat,
      expectedPlayersPerSide:
        options.expectedPlayersPerSide ?? raw.expectedPlayersPerSide ?? null,
    }
  );

  return assertScoringRulesPayload(normalized);
}
