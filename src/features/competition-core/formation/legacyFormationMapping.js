import { FORMATION_STRATEGY } from "./formationConstants.js";

/**
 * Foundation strategy catalog — CC-05A audit inventory.
 *
 * @type {ReadonlyArray<import('./formationTypes.js').FormationStrategyDefinition>}
 */
export const CANONICAL_FORMATION_STRATEGY_CATALOG = Object.freeze([
  {
    id: FORMATION_STRATEGY.BALANCED,
    name: "Balanced",
    legacyKey: "ai_balance",
    supportsPairs: true,
    supportsTeams: true,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.RANDOM,
    name: "Random",
    legacyKey: "pure_random",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: true,
  },
  {
    id: FORMATION_STRATEGY.SNAKE,
    name: "Snake",
    legacyKey: "snake_pairing",
    supportsPairs: true,
    supportsTeams: true,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.ROTATION,
    name: "Rotation",
    legacyKey: "rotation",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: true,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.KING_OF_COURT,
    name: "King of Court",
    legacyKey: "king_of_court",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: true,
    supportsConstraints: false,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.MIXED,
    name: "Mixed",
    legacyKey: "mixed_doubles",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.FIXED_PARTNER,
    name: "Fixed Partner",
    legacyKey: "fixed_partner",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.ROTATING_PARTNER,
    name: "Rotating Partner",
    legacyKey: "rotating_partner",
    supportsPairs: true,
    supportsTeams: false,
    supportsRotation: true,
    supportsConstraints: true,
    supportsRandomization: true,
  },
  {
    id: FORMATION_STRATEGY.TEAM_MATCH,
    name: "Team Match",
    legacyKey: "mlp_team_pairing",
    supportsPairs: false,
    supportsTeams: true,
    supportsRotation: false,
    supportsConstraints: true,
    supportsRandomization: false,
  },
  {
    id: FORMATION_STRATEGY.CUSTOM,
    name: "Custom",
    legacyKey: "custom",
    supportsPairs: true,
    supportsTeams: true,
    supportsRotation: true,
    supportsConstraints: true,
    supportsRandomization: true,
  },
]);

/**
 * @type {ReadonlyArray<{ legacyKey: string, runtimePath: string, strategyId: string }>}
 */
export const LEGACY_FORMATION_STRATEGY_INVENTORY = Object.freeze([
  { legacyKey: "ai_balance", runtimePath: "ai/engine.runAI", strategyId: FORMATION_STRATEGY.BALANCED },
  { legacyKey: "pure_random", runtimePath: "ai/pairingEngine", strategyId: FORMATION_STRATEGY.RANDOM },
  { legacyKey: "snake_pairing", runtimePath: "ai/waitingEngine", strategyId: FORMATION_STRATEGY.SNAKE },
  { legacyKey: "rotation", runtimePath: "court-engine/queueService", strategyId: FORMATION_STRATEGY.ROTATION },
  { legacyKey: "king_of_court", runtimePath: "court-engine/kingOfCourt", strategyId: FORMATION_STRATEGY.KING_OF_COURT },
  { legacyKey: "mixed_doubles", runtimePath: "tournament/teamPairingEngine", strategyId: FORMATION_STRATEGY.MIXED },
  { legacyKey: "fixed_partner", runtimePath: "pairing-constraints", strategyId: FORMATION_STRATEGY.FIXED_PARTNER },
  { legacyKey: "rotating_partner", runtimePath: "ai/session rotation", strategyId: FORMATION_STRATEGY.ROTATING_PARTNER },
  { legacyKey: "mlp_team_pairing", runtimePath: "teamAutoDrawEngine/pairTeamsFromSelectedPlayers", strategyId: FORMATION_STRATEGY.TEAM_MATCH },
  { legacyKey: "daily_play_fair", runtimePath: "tournament-daily-play", strategyId: FORMATION_STRATEGY.BALANCED },
  { legacyKey: "custom", runtimePath: "manual overrides", strategyId: FORMATION_STRATEGY.CUSTOM },
]);

const LEGACY_KEY_MAP = Object.freeze({
  balanced: FORMATION_STRATEGY.BALANCED,
  ai_balance: FORMATION_STRATEGY.BALANCED,
  random: FORMATION_STRATEGY.RANDOM,
  pure_random: FORMATION_STRATEGY.RANDOM,
  snake: FORMATION_STRATEGY.SNAKE,
  rotation: FORMATION_STRATEGY.ROTATION,
  king_of_court: FORMATION_STRATEGY.KING_OF_COURT,
  koc: FORMATION_STRATEGY.KING_OF_COURT,
  mixed: FORMATION_STRATEGY.MIXED,
  mixed_doubles: FORMATION_STRATEGY.MIXED,
  fixed_partner: FORMATION_STRATEGY.FIXED_PARTNER,
  rotating_partner: FORMATION_STRATEGY.ROTATING_PARTNER,
  team_match: FORMATION_STRATEGY.TEAM_MATCH,
  mlp: FORMATION_STRATEGY.TEAM_MATCH,
  mlp_team_pairing: FORMATION_STRATEGY.TEAM_MATCH,
  daily_play_fair: FORMATION_STRATEGY.BALANCED,
  custom: FORMATION_STRATEGY.CUSTOM,
});

/**
 * @param {unknown} legacyKey
 * @returns {string}
 */
export function mapLegacyFormationStrategyToCanonical(legacyKey) {
  const key = String(legacyKey || "")
    .trim()
    .toLowerCase();
  const byCatalog = CANONICAL_FORMATION_STRATEGY_CATALOG.find((item) => item.legacyKey === key);
  if (byCatalog) {
    return byCatalog.id;
  }
  return LEGACY_KEY_MAP[key] || FORMATION_STRATEGY.UNKNOWN;
}

/**
 * @param {string} strategyId
 * @returns {import('./formationTypes.js').FormationStrategyDefinition|null}
 */
export function getFormationStrategyFromCatalog(strategyId) {
  return CANONICAL_FORMATION_STRATEGY_CATALOG.find((item) => item.id === strategyId) || null;
}

/**
 * @param {Partial<import('./formationTypes.js').FormationStrategyDefinition>} [partial]
 * @returns {import('./formationTypes.js').FormationStrategyDefinition}
 */
export function createFormationStrategyDefinition(partial = {}) {
  return {
    id: String(partial.id || FORMATION_STRATEGY.UNKNOWN),
    name: String(partial.name || "Unknown"),
    supportsPairs: partial.supportsPairs !== false,
    supportsTeams: partial.supportsTeams === true,
    supportsRotation: partial.supportsRotation === true,
    supportsConstraints: partial.supportsConstraints !== false,
    supportsRandomization: partial.supportsRandomization === true,
    legacyKey: partial.legacyKey != null ? String(partial.legacyKey) : undefined,
  };
}

/**
 * @param {unknown} legacyKind
 * @returns {string}
 */
export function mapLegacyFormationConstraintKind(legacyKind) {
  const key = String(legacyKind || "")
    .trim()
    .toLowerCase();
  const map = {
    must_partner: "must_partner",
    prefer_partner: "must_partner",
    avoid_partner: "must_not_partner",
    must_not_partner: "must_not_partner",
    avoid_repeat_partner: "avoid_repeat_partner",
    avoid_repeat_opponent: "avoid_repeat_opponent",
    skill_gap: "skill_gap",
    level_diff: "skill_gap",
    gender: "gender",
    age: "age",
    availability: "availability",
    check_in: "check_in",
    rest_time: "rest_time",
    court_availability: "court_availability",
    manual_lock: "manual_lock",
    organization: "organization",
    club: "club",
    avoid_same_club: "club",
    custom: "custom",
  };
  return map[key] || "custom";
}
