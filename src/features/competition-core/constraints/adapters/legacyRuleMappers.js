import { COMPETITION_CONSTRAINT_TYPE } from "../../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../../constants/constraintSeverity.js";
import { createRuleSet, normalizeRuleDefinition } from "../normalizeRule.js";

/**
 * Map legacy pairing-constraints records to canonical RuleSet.
 *
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Partial<{ id: string, version: string }>} [meta]
 * @returns {import('../normalizeRule.js').RuleSet}
 */
export function mapPairingConstraintsToRuleSet(constraints = [], meta = {}) {
  const normalized = (constraints || [])
    .map((item, index) =>
      normalizeRuleDefinition(
        {
          id: item.id,
          type: item.type,
          mode: item.mode,
          severity: item.mode,
          enabled: item.enabled,
          anchorPlayerId: item.anchorPlayerId,
          targetPlayerIds: item.targetPlayerIds,
          params: {
            anchorPlayerId: item.anchorPlayerId,
            targetPlayerIds: item.targetPlayerIds,
          },
        },
        index
      )
    )
    .filter(Boolean);

  return createRuleSet({
    id: meta.id || "legacy-pairing-constraints",
    version: meta.version || "1",
    constraints: normalized,
  });
}

/**
 * Map AI policies + club rules to canonical constraints.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} [input.policies]
 * @param {Array<Record<string, unknown>>} [input.rules]
 * @param {Object} [input.competition]
 * @param {number} [input.levelDiffAllowed]
 * @returns {import('../normalizeRule.js').RuleSet}
 */
export function mapAiContextToRuleSet(input = {}) {
  /** @type {import('../../types/index.js').ConstraintDefinition[]} */
  const constraints = [];

  (input.policies || []).forEach((policy, index) => {
    if (policy?.enabled === false) {
      return;
    }

    const type =
      policy.type === "avoid_teammate"
        ? COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER
        : COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER;

    const severity =
      policy.type === "avoid_teammate" && policy.priority === "HIGH"
        ? CONSTRAINT_SEVERITY.HARD
        : CONSTRAINT_SEVERITY.SOFT;

    constraints.push({
      id: policy.id || `ai-policy-${index + 1}`,
      type,
      severity,
      enabled: true,
      params: {
        anchorPlayerId: String(policy.playerA),
        targetPlayerIds: [String(policy.playerB)],
      },
    });
  });

  (input.rules || []).forEach((rule, index) => {
    if (rule?.enabled === false) {
      return;
    }

    if (rule.type === "team_level_diff_limit") {
      constraints.push({
        id: rule.id || `ai-rule-skill-${index + 1}`,
        type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
        severity: CONSTRAINT_SEVERITY.SOFT,
        enabled: true,
        params: { maxDiff: Number(rule.maxDiff ?? 0.5) },
      });
    }

    if (rule.type === "max_partner_repeat") {
      constraints.push({
        id: rule.id || `ai-rule-partner-repeat-${index + 1}`,
        type: COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
        severity: CONSTRAINT_SEVERITY.SOFT,
        enabled: true,
        params: { maxRepeat: Number(rule.maxTimes ?? 1) },
      });
    }

    if (rule.type === "max_opponent_repeat") {
      constraints.push({
        id: rule.id || `ai-rule-opponent-repeat-${index + 1}`,
        type: COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
        severity: CONSTRAINT_SEVERITY.SOFT,
        enabled: true,
        params: { maxRepeat: Number(rule.maxTimes ?? 1) },
      });
    }
  });

  if (input.competition?.requiresMixedPairs) {
    constraints.push({
      id: "ai-competition-mixed",
      type: COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { composition: "mixed_double" },
    });
  }

  const levelDiff = Number(input.levelDiffAllowed);
  if (Number.isFinite(levelDiff) && levelDiff > 0) {
    constraints.push({
      id: "ai-level-diff-hard",
      type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { maxDiff: levelDiff },
    });
  }

  return createRuleSet({
    id: "legacy-ai-scoring",
    version: "1",
    constraints,
  });
}

/**
 * @param {Array<{ members?: unknown[], playerIds?: unknown[] }>} teams
 * @returns {string[][]}
 */
export function mapTeamsToCandidateTeams(teams = []) {
  return teams.map((team) => {
    const members = team.members || team.playerIds || [];
    return members.map((item) => (typeof item === "object" ? String(item.id) : String(item)));
  });
}

/**
 * @param {{ teamA?: Array<{ id: string }>, teamB?: Array<{ id: string }> }} option
 * @returns {import('../../types/index.js').CandidateAssignment}
 */
export function mapAiOptionToCandidate(option = {}) {
  return {
    matchOption: {
      teamA: (option.teamA || []).map((player) => String(player.id)),
      teamB: (option.teamB || []).map((player) => String(player.id)),
    },
  };
}

/**
 * @param {Array<{ id: string, gender?: string, level?: number, checkedIn?: boolean, busy?: boolean }>} players
 * @returns {Record<string, import('../evaluateHardRules.js').RulePlayerSnapshot>}
 */
export function mapPlayersToSnapshots(players = []) {
  /** @type {Record<string, import('../evaluateHardRules.js').RulePlayerSnapshot>} */
  const playersById = {};
  players.forEach((player) => {
    if (!player?.id) {
      return;
    }
    playersById[String(player.id)] = {
      gender: player.gender,
      skillLevel: Number(player.level ?? player.skillLevel ?? 0),
      checkedIn: player.checkedIn,
      busy: player.busy,
      available: player.available,
    };
  });
  return playersById;
}

/**
 * Build repeat counters from AI history object.
 *
 * @param {Record<string, { partners?: Record<string, number>, opponents?: Record<string, number> }>} history
 * @returns {{ partnerRepeatCounts: Record<string, Record<string, number>>, opponentRepeatCounts: Record<string, Record<string, number>> }}
 */
export function mapAiHistoryToRepeatCounts(history = {}) {
  /** @type {Record<string, Record<string, number>>} */
  const partnerRepeatCounts = {};
  /** @type {Record<string, Record<string, number>>} */
  const opponentRepeatCounts = {};

  Object.entries(history).forEach(([playerId, snapshot]) => {
    partnerRepeatCounts[playerId] = { ...(snapshot?.partners || {}) };
    opponentRepeatCounts[playerId] = { ...(snapshot?.opponents || {}) };
  });

  return { partnerRepeatCounts, opponentRepeatCounts };
}

/**
 * Court engine config → soft constraints (adapter-level only).
 *
 * @param {Object} [config]
 * @returns {import('../normalizeRule.js').RuleSet}
 */
export function mapCourtEngineConfigToRuleSet(config = {}) {
  /** @type {import('../../types/index.js').ConstraintDefinition[]} */
  const constraints = [];

  if (config.requireCheckIn !== false) {
    constraints.push({
      id: "court-checkin",
      type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
    });
  }

  if (config.maxTeamDiff != null) {
    constraints.push({
      id: "court-team-balance",
      type: COMPETITION_CONSTRAINT_TYPE.TEAM_SKILL_DIFFERENCE,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxDiff: Number(config.maxTeamDiff) },
    });
  }

  if (config.maxPartnerRepeat != null) {
    constraints.push({
      id: "court-partner-repeat",
      type: COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxRepeat: Number(config.maxPartnerRepeat) },
    });
  }

  if (config.maxOpponentRepeat != null) {
    constraints.push({
      id: "court-opponent-repeat",
      type: COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxRepeat: Number(config.maxOpponentRepeat) },
    });
  }

  return createRuleSet({
    id: "legacy-court-engine",
    version: "1",
    constraints,
  });
}

/**
 * Daily Play eligibility bridge constraints.
 *
 * @param {Object} [settings]
 * @returns {import('../normalizeRule.js').RuleSet}
 */
export function mapDailyPlaySettingsToRuleSet(settings = {}) {
  /** @type {import('../../types/index.js').ConstraintDefinition[]} */
  const constraints = [
    {
      id: "daily-checkin",
      type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
    },
    {
      id: "daily-not-busy",
      type: COMPETITION_CONSTRAINT_TYPE.PLAYER_NOT_BUSY,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
    },
  ];

  if (
    settings.competitionType === "mixed_double" ||
    settings.competitionType === "doubles_mixed"
  ) {
    constraints.push({
      id: "daily-mixed",
      type: COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { composition: "mixed_double" },
    });
  }

  return createRuleSet({
    id: "legacy-daily-play",
    version: "1",
    constraints,
  });
}
