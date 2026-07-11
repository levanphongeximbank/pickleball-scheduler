import { DRAW_MODE } from "../constants/drawMode.js";
import { CANONICAL_DRAW_MODE, isCanonicalDrawMode } from "./drawConstants.js";

/**
 * Map CC-01 DRAW_MODE → CC-04A CANONICAL_DRAW_MODE.
 * Reference only — does not change runtime behavior.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CC01_DRAW_MODE_TO_CANONICAL = Object.freeze({
  [DRAW_MODE.PURE_RANDOM]: CANONICAL_DRAW_MODE.RANDOM,
  [DRAW_MODE.CONSTRAINED_RANDOM]: CANONICAL_DRAW_MODE.OPEN,
  [DRAW_MODE.SKILL_CONTROLLED]: CANONICAL_DRAW_MODE.SNAKE,
  [DRAW_MODE.MANUAL]: CANONICAL_DRAW_MODE.MANUAL,
});

/**
 * Legacy runtime / UI strings → canonical draw mode.
 * Covers production draw paths inventoried in CC-04A audit.
 *
 * @type {ReadonlyArray<{ legacyValue: string, context: string, canonical: string }>}
 */
export const LEGACY_DRAW_MODE_MAPPINGS = Object.freeze([
  {
    legacyValue: "open",
    context: "tournament.seeding.logic / seedMode UI",
    canonical: CANONICAL_DRAW_MODE.RANDOM,
  },
  {
    legacyValue: "skill_controlled",
    context: "tournament.seeding.logic / official AI balance",
    canonical: CANONICAL_DRAW_MODE.SNAKE,
  },
  {
    legacyValue: "official_open",
    context: "OFFICIAL_MODE.OPEN / assignEntriesOpenConditional",
    canonical: CANONICAL_DRAW_MODE.OPEN,
  },
  {
    legacyValue: "official_ai_balance",
    context: "OFFICIAL_MODE.AI_BALANCE / assignGroupsWithConstraints",
    canonical: CANONICAL_DRAW_MODE.SNAKE,
  },
  {
    legacyValue: "snake",
    context: "seededGroupEngine / animation SNAKE_GROUP",
    canonical: CANONICAL_DRAW_MODE.SNAKE,
  },
  {
    legacyValue: "seeded",
    context: "team group seeding / seedEngine",
    canonical: CANONICAL_DRAW_MODE.SEEDED,
  },
  {
    legacyValue: "heuristic",
    context: "features/tournament-engine/drawEngine generateDraw",
    canonical: CANONICAL_DRAW_MODE.HEURISTIC,
  },
  {
    legacyValue: "team",
    context: "teamAutoDrawEngine / assignSeededTeamsToGroups",
    canonical: CANONICAL_DRAW_MODE.TEAM,
  },
  {
    legacyValue: "manual",
    context: "manual group assignment UI",
    canonical: CANONICAL_DRAW_MODE.MANUAL,
  },
  {
    legacyValue: "random",
    context: "animation RANDOM_DRAW / openConditionalRandomEngine",
    canonical: CANONICAL_DRAW_MODE.RANDOM,
  },
  {
    legacyValue: "pure_random",
    context: "CC-01 DRAW_MODE.PURE_RANDOM",
    canonical: CANONICAL_DRAW_MODE.RANDOM,
  },
  {
    legacyValue: "constrained_random",
    context: "CC-01 DRAW_MODE.CONSTRAINED_RANDOM",
    canonical: CANONICAL_DRAW_MODE.OPEN,
  },
  {
    legacyValue: "mlp_auto_draw",
    context: "applyMlpAutoDraw team tournament",
    canonical: CANONICAL_DRAW_MODE.TEAM,
  },
  {
    legacyValue: "lineup_random",
    context: "lineupRandomEngine randomizeMissingLineups",
    canonical: CANONICAL_DRAW_MODE.RANDOM,
  },
  {
    legacyValue: "custom",
    context: "future custom draw adapters",
    canonical: CANONICAL_DRAW_MODE.CUSTOM,
  },
]);

/**
 * Resolve a legacy draw/seed mode string to CANONICAL_DRAW_MODE.
 * Never throws; unknown → UNKNOWN.
 *
 * @param {unknown} legacyMode
 * @param {string} [contextHint]
 * @returns {string}
 */
export function mapLegacyDrawModeToCanonical(legacyMode, contextHint) {
  const value = String(legacyMode || "")
    .trim()
    .toLowerCase();

  if (!value) {
    return CANONICAL_DRAW_MODE.UNKNOWN;
  }

  /** Tokens that are both CC-04A modes and legacy strings with different meaning. */
  const ambiguousLegacyTokens = new Set(["open", "manual", "random", "team", "custom"]);

  if (isCanonicalDrawMode(value) && !ambiguousLegacyTokens.has(value)) {
    return value;
  }

  if (CC01_DRAW_MODE_TO_CANONICAL[value]) {
    return CC01_DRAW_MODE_TO_CANONICAL[value];
  }

  if (contextHint) {
    const contextual = LEGACY_DRAW_MODE_MAPPINGS.find(
      (entry) =>
        entry.legacyValue === value &&
        entry.context.toLowerCase().includes(String(contextHint).toLowerCase())
    );
    if (contextual) {
      return contextual.canonical;
    }
  }

  const match = LEGACY_DRAW_MODE_MAPPINGS.find((entry) => entry.legacyValue === value);
  if (match) {
    return match.canonical;
  }

  return isCanonicalDrawMode(value) ? value : CANONICAL_DRAW_MODE.UNKNOWN;
}

/**
 * Map CC-01 DRAW_MODE value to canonical mode.
 *
 * @param {unknown} cc01Mode
 * @returns {string}
 */
export function mapCc01DrawModeToCanonical(cc01Mode) {
  const value = String(cc01Mode || "").trim();
  return CC01_DRAW_MODE_TO_CANONICAL[value] || CANONICAL_DRAW_MODE.UNKNOWN;
}
