import {
  CANONICAL_DRAW_STRATEGY_ID,
  DEFAULT_STRATEGY_CAPABILITIES,
  DISTRIBUTION_TYPE,
} from "./strategyConstants.js";
import { CANONICAL_DRAW_MODE } from "../drawConstants.js";
import { mapLegacyDrawModeToCanonical } from "../legacyDrawMapping.js";

/**
 * Foundation strategy catalog — CC-04C audit inventory.
 * Reference only; does not execute runtime algorithms.
 *
 * @type {ReadonlyArray<import('./strategyTypes.js').DrawStrategyDefinition>}
 */
export const CANONICAL_DRAW_STRATEGY_CATALOG = Object.freeze([
  {
    id: CANONICAL_DRAW_STRATEGY_ID.SNAKE,
    name: "Snake",
    distributionType: DISTRIBUTION_TYPE.SNAKE,
    legacyKey: "skill_controlled",
    requiresSeed: true,
    supportsConstraints: true,
    supportsBalance: true,
    supportsRandomization: false,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.RANDOM,
    name: "Random",
    distributionType: DISTRIBUTION_TYPE.RANDOM,
    legacyKey: "open",
    requiresSeed: false,
    supportsConstraints: true,
    supportsBalance: false,
    supportsRandomization: true,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: false,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.BALANCED,
    name: "Balanced",
    distributionType: DISTRIBUTION_TYPE.BALANCED,
    legacyKey: "official_ai_balance",
    requiresSeed: true,
    supportsConstraints: true,
    supportsBalance: true,
    supportsRandomization: false,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.MANUAL,
    name: "Manual",
    distributionType: DISTRIBUTION_TYPE.MANUAL,
    legacyKey: "manual",
    requiresSeed: false,
    supportsConstraints: false,
    supportsBalance: false,
    supportsRandomization: false,
    supportsManualPlacement: true,
    supportsGroups: true,
    supportsByes: true,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC,
    name: "AI Heuristic",
    distributionType: DISTRIBUTION_TYPE.HYBRID,
    legacyKey: "heuristic",
    requiresSeed: true,
    supportsConstraints: true,
    supportsBalance: true,
    supportsRandomization: true,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: false,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.OPEN,
    name: "Open",
    distributionType: DISTRIBUTION_TYPE.RANDOM,
    legacyKey: "official_open",
    requiresSeed: false,
    supportsConstraints: true,
    supportsBalance: false,
    supportsRandomization: true,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: false,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.TEAM,
    name: "Team",
    distributionType: DISTRIBUTION_TYPE.SNAKE,
    legacyKey: "mlp_auto_draw",
    requiresSeed: true,
    supportsConstraints: false,
    supportsBalance: true,
    supportsRandomization: true,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: false,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.ROUND_ROBIN,
    name: "Round Robin",
    distributionType: DISTRIBUTION_TYPE.ROUND_ROBIN,
    legacyKey: "group_stage_schedule",
    requiresSeed: false,
    supportsConstraints: false,
    supportsBalance: false,
    supportsRandomization: false,
    supportsManualPlacement: false,
    supportsGroups: true,
    supportsByes: true,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.SWISS,
    name: "Swiss",
    distributionType: DISTRIBUTION_TYPE.SWISS_READY,
    legacyKey: "swiss",
    requiresSeed: true,
    supportsConstraints: true,
    supportsBalance: true,
    supportsRandomization: false,
    supportsManualPlacement: false,
    supportsGroups: false,
    supportsByes: true,
    supportsTeams: false,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.KNOCKOUT_PREP,
    name: "Knockout Preparation",
    distributionType: DISTRIBUTION_TYPE.KNOCKOUT_PREP,
    legacyKey: "knockout_bracket",
    requiresSeed: true,
    supportsConstraints: false,
    supportsBalance: false,
    supportsRandomization: false,
    supportsManualPlacement: true,
    supportsGroups: false,
    supportsByes: true,
    supportsTeams: true,
  },
  {
    id: CANONICAL_DRAW_STRATEGY_ID.LEGACY_CUSTOM,
    name: "Legacy Custom",
    distributionType: DISTRIBUTION_TYPE.CUSTOM,
    legacyKey: "custom",
    requiresSeed: false,
    supportsConstraints: true,
    supportsBalance: true,
    supportsRandomization: true,
    supportsManualPlacement: true,
    supportsGroups: true,
    supportsByes: true,
    supportsTeams: true,
  },
]);

/**
 * Extended legacy strategy inventory for CC-04C audit docs.
 *
 * @type {ReadonlyArray<{ legacyKey: string, runtimePath: string, strategyId: string }>}
 */
export const LEGACY_DRAW_STRATEGY_INVENTORY = Object.freeze([
  { legacyKey: "skill_controlled", runtimePath: "seededGroupEngine / seedTeamsIntoGroups", strategyId: CANONICAL_DRAW_STRATEGY_ID.SNAKE },
  { legacyKey: "open", runtimePath: "openConditionalRandomEngine / tournament.seeding open", strategyId: CANONICAL_DRAW_STRATEGY_ID.RANDOM },
  { legacyKey: "official_ai_balance", runtimePath: "officialTournamentEngine + assignGroupsWithConstraints", strategyId: CANONICAL_DRAW_STRATEGY_ID.BALANCED },
  { legacyKey: "manual", runtimePath: "manual group UI / manualEntries", strategyId: CANONICAL_DRAW_STRATEGY_ID.MANUAL },
  { legacyKey: "heuristic", runtimePath: "features/tournament-engine/drawEngine", strategyId: CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC },
  { legacyKey: "official_open", runtimePath: "buildOfficialOpenPlan", strategyId: CANONICAL_DRAW_STRATEGY_ID.OPEN },
  { legacyKey: "mlp_auto_draw", runtimePath: "teamAutoDrawEngine", strategyId: CANONICAL_DRAW_STRATEGY_ID.TEAM },
  { legacyKey: "group_stage_schedule", runtimePath: "scheduleEngine buildGroupStageSchedule", strategyId: CANONICAL_DRAW_STRATEGY_ID.ROUND_ROBIN },
  { legacyKey: "swiss", runtimePath: "not implemented — contract placeholder", strategyId: CANONICAL_DRAW_STRATEGY_ID.SWISS },
  { legacyKey: "knockout_bracket", runtimePath: "bracketEngine generateKnockoutBracket", strategyId: CANONICAL_DRAW_STRATEGY_ID.KNOCKOUT_PREP },
  { legacyKey: "constraint_repair", runtimePath: "constraintGroupEngine swap heuristics", strategyId: CANONICAL_DRAW_STRATEGY_ID.LEGACY_CUSTOM },
]);

/**
 * Map legacy draw mode / strategy key to catalog strategy id.
 *
 * @param {unknown} legacyKey
 * @param {string} [contextHint]
 * @returns {string}
 */
export function mapLegacyStrategyKeyToCatalogId(legacyKey, contextHint) {
  const key = String(legacyKey || "")
    .trim()
    .toLowerCase();

  if (key === "constraint_repair" || key === "custom") {
    return CANONICAL_DRAW_STRATEGY_ID.LEGACY_CUSTOM;
  }

  const byLegacy = CANONICAL_DRAW_STRATEGY_CATALOG.find(
    (item) => item.legacyKey === key
  );
  if (byLegacy) {
    return byLegacy.id;
  }

  const drawMode = mapLegacyDrawModeToCanonical(key, contextHint);
  const modeMap = {
    [CANONICAL_DRAW_MODE.SNAKE]: CANONICAL_DRAW_STRATEGY_ID.SNAKE,
    [CANONICAL_DRAW_MODE.RANDOM]: CANONICAL_DRAW_STRATEGY_ID.RANDOM,
    [CANONICAL_DRAW_MODE.OPEN]: CANONICAL_DRAW_STRATEGY_ID.OPEN,
    [CANONICAL_DRAW_MODE.HEURISTIC]: CANONICAL_DRAW_STRATEGY_ID.AI_HEURISTIC,
    [CANONICAL_DRAW_MODE.TEAM]: CANONICAL_DRAW_STRATEGY_ID.TEAM,
    [CANONICAL_DRAW_MODE.MANUAL]: CANONICAL_DRAW_STRATEGY_ID.MANUAL,
    [CANONICAL_DRAW_MODE.SEEDED]: CANONICAL_DRAW_STRATEGY_ID.SNAKE,
  };

  return modeMap[drawMode] || CANONICAL_DRAW_STRATEGY_ID.UNKNOWN;
}

/**
 * @param {string} strategyId
 * @returns {import('./strategyTypes.js').DrawStrategyDefinition|null}
 */
export function getDrawStrategyFromCatalog(strategyId) {
  return (
    CANONICAL_DRAW_STRATEGY_CATALOG.find((item) => item.id === strategyId) || null
  );
}

/**
 * @param {Partial<import('./strategyTypes.js').DrawStrategyDefinition>} [partial]
 * @returns {import('./strategyTypes.js').DrawStrategyDefinition}
 */
export function createDrawStrategyDefinition(partial = {}) {
  const defaults = DEFAULT_STRATEGY_CAPABILITIES;
  return {
    id: String(partial.id || CANONICAL_DRAW_STRATEGY_ID.UNKNOWN),
    name: String(partial.name || "Unknown Strategy"),
    distributionType: String(partial.distributionType || DISTRIBUTION_TYPE.UNKNOWN),
    requiresSeed: partial.requiresSeed ?? defaults.requiresSeed,
    supportsConstraints: partial.supportsConstraints ?? defaults.supportsConstraints,
    supportsBalance: partial.supportsBalance ?? defaults.supportsBalance,
    supportsRandomization: partial.supportsRandomization ?? defaults.supportsRandomization,
    supportsManualPlacement: partial.supportsManualPlacement ?? defaults.supportsManualPlacement,
    supportsGroups: partial.supportsGroups ?? defaults.supportsGroups,
    supportsByes: partial.supportsByes ?? defaults.supportsByes,
    supportsTeams: partial.supportsTeams ?? defaults.supportsTeams,
    legacyKey: partial.legacyKey != null ? String(partial.legacyKey) : undefined,
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}
