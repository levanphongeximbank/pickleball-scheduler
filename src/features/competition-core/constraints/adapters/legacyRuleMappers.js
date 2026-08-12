import { COMPETITION_CONSTRAINT_TYPE } from "../../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../../constants/constraintSeverity.js";
import { EVENT_TYPE } from "../../../../models/tournament/constants.js";
import { createRuleSet, normalizeRuleDefinition } from "../normalizeRule.js";
import {
  buildFounderPolicySourceId,
  buildIdentityFromAiPolicy,
  buildRuleSourceIdentity,
  RULE_SOURCE_TYPE,
} from "./founderPolicyIdentity.js";
import { deduplicatePoliciesByIdentity } from "./founderPolicyDeduplication.js";

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
  const ruleSetId = input.ruleSetId || "legacy-ai-scoring";
  const ruleSetVersion = input.ruleSetVersion || "1";
  const dedupedPolicies = deduplicatePoliciesByIdentity(input.policies || []);

  dedupedPolicies.forEach((policy, index) => {
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

    const sourceId = buildFounderPolicySourceId(policy);
    const identity = buildIdentityFromAiPolicy(policy, { ruleSetId, ruleSetVersion });

    constraints.push({
      id: policy.id || sourceId || `ai-policy-${index + 1}`,
      type,
      severity,
      enabled: true,
      params: {
        anchorPlayerId: String(policy.playerA),
        targetPlayerIds: [String(policy.playerB)],
        sourceType: policy.source === "founder" ? RULE_SOURCE_TYPE.FOUNDER_POLICY : RULE_SOURCE_TYPE.AI_POLICY,
        sourceId,
        deduplicationKey: identity.deduplicationKey,
      },
      metadata: buildRuleSourceIdentity(identity),
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
    id: ruleSetId,
    version: ruleSetVersion,
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

  constraints.push({
    id: "court-not-busy",
    type: COMPETITION_CONSTRAINT_TYPE.PLAYER_NOT_BUSY,
    severity: CONSTRAINT_SEVERITY.HARD,
    enabled: true,
  });

  const maxLevelDiff = Number(config.maxLevelDiff ?? config.maxTeamDiff);
  if (Number.isFinite(maxLevelDiff) && maxLevelDiff > 0) {
    constraints.push({
      id: "court-skill-cap",
      type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { maxDiff: maxLevelDiff },
    });
  }

  if (config.avoidPartnerRepeat !== false) {
    constraints.push({
      id: "court-partner-repeat",
      type: COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxRepeat: Number(config.maxPartnerRepeat ?? 1) },
    });
  }

  if (config.avoidOpponentRepeat !== false) {
    constraints.push({
      id: "court-opponent-repeat",
      type: COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxRepeat: Number(config.maxOpponentRepeat ?? 1) },
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

const EVENT_PLAYER_COUNTS = {
  [EVENT_TYPE.MEN_SINGLE]: 1,
  [EVENT_TYPE.WOMEN_SINGLE]: 1,
  [EVENT_TYPE.MEN_DOUBLE]: 2,
  [EVENT_TYPE.WOMEN_DOUBLE]: 2,
  [EVENT_TYPE.MIXED_DOUBLE]: 2,
  [EVENT_TYPE.OPEN_DOUBLE]: 2,
};

/**
 * Tournament draw validation → canonical RuleSet.
 *
 * @param {string} eventType
 * @param {Object} [options]
 * @returns {import('../normalizeRule.js').RuleSet}
 */
export function mapTournamentDrawInputToRuleSet(eventType, options = {}) {
  /** @type {import('../../types/index.js').ConstraintDefinition[]} */
  const constraints = [
    {
      id: "tournament-gender",
      type: COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { eventType: String(eventType || EVENT_TYPE.MIXED_DOUBLE).toLowerCase() },
    },
    {
      id: "tournament-lineup",
      type: COMPETITION_CONSTRAINT_TYPE.LINEUP_VALIDITY,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: {
        expectedCount: EVENT_PLAYER_COUNTS[eventType] || 2,
      },
    },
    {
      id: "tournament-entry-eligibility",
      type: COMPETITION_CONSTRAINT_TYPE.ENTRY_ELIGIBILITY,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
    },
  ];

  if (eventType === EVENT_TYPE.MIXED_DOUBLE) {
    constraints.push({
      id: "tournament-mixed-composition",
      type: COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION,
      severity: CONSTRAINT_SEVERITY.HARD,
      enabled: true,
      params: { composition: "mixed_double" },
    });
  }

  if (options.skillCap != null) {
    constraints.push({
      id: "tournament-skill-cap",
      type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
      severity: CONSTRAINT_SEVERITY.SOFT,
      enabled: true,
      params: { maxDiff: Number(options.skillCap) },
    });
  }

  return createRuleSet({
    id: "legacy-tournament-validation",
    version: "1",
    constraints,
  });
}

/**
 * @param {Array<{ id?: string, name?: string, playerIds?: string[] }>} entries
 * @returns {import('../../types/index.js').CandidateAssignment}
 */
export function mapTournamentEntriesToCandidate(entries = []) {
  return {
    teams: (entries || []).map((entry) => (entry.playerIds || []).map(String)),
  };
}

/**
 * Build tournament draw validation context including duplicate-player eligibility map.
 *
 * @param {Object} input
 * @param {Array<{ id?: string, name?: string, playerIds?: string[] }>} [input.entries]
 * @param {Array<{ id: string, gender?: string, level?: number, rating?: number }>} [input.players]
 * @param {string} [input.eventType]
 * @returns {Partial<import('../../types/index.js').ConstraintContext>}
 */
export function mapTournamentDrawInputToContext(input = {}) {
  const entries = input.entries || [];
  const players = input.players || [];
  const expectedCount = EVENT_PLAYER_COUNTS[input.eventType] || 2;

  /** @type {Record<string, { eligible?: boolean, reason?: string }>} */
  const entriesByPlayerId = {};
  /** @type {Array<{ position: string, playerId?: string, required?: boolean }>} */
  const lineupSlots = [];

  entries.forEach((entry) => {
    const playerIds = (entry.playerIds || []).map(String);
    playerIds.forEach((playerId, index) => {
      if (entriesByPlayerId[playerId]?.eligible === false) {
        return;
      }
      if (entriesByPlayerId[playerId]) {
        const firstEntry = entriesByPlayerId[playerId].entryName || "?";
        entriesByPlayerId[playerId] = {
          eligible: false,
          reason: `VDV ${playerId} nam trong nhieu doi (${firstEntry} va ${entry.name}).`,
        };
      } else {
        entriesByPlayerId[playerId] = { eligible: true, entryName: entry.name };
      }

      lineupSlots.push({
        position: `${entry.name || entry.id}-slot-${index + 1}`,
        playerId,
        required: index < expectedCount,
      });
    });

    for (let slot = playerIds.length; slot < expectedCount; slot += 1) {
      lineupSlots.push({
        position: `${entry.name || entry.id}-missing-${slot + 1}`,
        required: true,
      });
    }
  });

  return {
    scope: "entry",
    playersById: mapPlayersToSnapshots(players),
    entriesByPlayerId,
    lineupSlots,
    competitionType: input.eventType,
  };
}

/**
 * Court session player snapshots for queue / assignment gates.
 *
 * @param {Object} session
 * @param {Array<{ id: string, gender?: string, level?: number, rating?: number }>} [players]
 * @returns {Record<string, import('../evaluateHardRules.js').RulePlayerSnapshot>}
 */
export function mapCourtSessionPlayersToSnapshots(session, players = []) {
  const checkIns = session?.checkIns || [];
  const checkInById = new Map(checkIns.map((item) => [String(item.playerId), item]));

  return mapPlayersToSnapshots(
    (players || []).map((player) => {
      const checkIn = checkInById.get(String(player.id));
      const status = checkIn?.status;
      return {
        ...player,
        checkedIn: Boolean(checkIn && status !== "cancelled"),
        busy: status === "playing",
      };
    })
  );
}

/**
 * @param {Array<{ teamA?: string[], teamB?: string[], teams?: string[][] }>} matchHistory
 * @returns {{ partnerRepeatCounts: Record<string, Record<string, number>>, opponentRepeatCounts: Record<string, Record<string, number>> }}
 */
export function mapCourtMatchHistoryToRepeatCounts(matchHistory = []) {
  /** @type {Record<string, Record<string, number>>} */
  const partnerRepeatCounts = {};
  /** @type {Record<string, Record<string, number>>} */
  const opponentRepeatCounts = {};

  const bump = (map, a, b) => {
    const keyA = String(a);
    const keyB = String(b);
    if (!map[keyA]) {
      map[keyA] = {};
    }
    map[keyA][keyB] = (map[keyA][keyB] || 0) + 1;
  };

  (matchHistory || []).forEach((match) => {
    const teamA = (match.teamA || match.teams?.[0] || []).map(String);
    const teamB = (match.teamB || match.teams?.[1] || []).map(String);

    teamA.forEach((playerId, index) => {
      teamA.forEach((mateId, mateIndex) => {
        if (index !== mateIndex) {
          bump(partnerRepeatCounts, playerId, mateId);
        }
      });
      teamB.forEach((opponentId) => {
        bump(opponentRepeatCounts, playerId, opponentId);
      });
    });

    teamB.forEach((playerId, index) => {
      teamB.forEach((mateId, mateIndex) => {
        if (index !== mateIndex) {
          bump(partnerRepeatCounts, playerId, mateId);
        }
      });
      teamA.forEach((opponentId) => {
        bump(opponentRepeatCounts, playerId, opponentId);
      });
    });
  });

  return { partnerRepeatCounts, opponentRepeatCounts };
}

/**
 * Map legacy group draw constraints to canonical RuleSet.
 *
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Partial<{ id: string, version: string }>} [meta]
 */
export function mapGroupConstraintsToRuleSet(constraints = [], meta = {}) {
  const normalized = (constraints || [])
    .map((item, index) =>
      normalizeRuleDefinition(
        {
          id: item.id,
          type:
            item.type === "avoid_same_group"
              ? COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER
              : item.type,
          mode: item.mode,
          severity: item.mode,
          enabled: item.enabled,
          anchorPlayerId: item.anchorPlayerId,
          targetPlayerIds: item.targetPlayerIds,
          params: {
            anchorPlayerId: item.anchorPlayerId,
            targetPlayerIds: item.targetPlayerIds,
            groupConstraintType: item.groupConstraintType || item.type,
          },
        },
        index
      )
    )
    .filter(Boolean);

  return createRuleSet({
    id: meta.id || "legacy-group-constraints",
    version: meta.version || "1",
    constraints: normalized,
  });
}

/**
 * @param {Array<{ id?: string, label?: string, name?: string, entries?: Array<{ playerIds?: string[] }> }>} groups
 * @param {Array<{ id: string, clubId?: string, organizationId?: string }>} [players]
 */
export function mapGroupConstraintsToContext(groups = [], players = []) {
  const playersById = mapPlayersToSnapshots(players);
  const canonicalGroups = groups.map((group) => {
    const playerIds = new Set();
    (group.entries || []).forEach((entry) => {
      (entry.playerIds || []).forEach((id) => playerIds.add(String(id)));
    });
    return {
      id: group.id,
      label: group.label || group.name,
      playerIds: [...playerIds],
    };
  });

  return {
    scope: "group",
    groups: canonicalGroups,
    playersById,
  };
}

/**
 * Map team tournament lineup validation payload to canonical context.
 *
 * @param {Object} payload
 */
export function mapTeamLineupValidationToContext(payload = {}) {
  const team = payload.team || {};
  const players = payload.players || [];
  const selections = payload.selections || {};

  const lineupSlots = [];
  Object.entries(selections).forEach(([disciplineId, playerIds]) => {
    (playerIds || []).forEach((playerId, index) => {
      lineupSlots.push({
        position: `${disciplineId}-slot-${index + 1}`,
        playerId: String(playerId),
        required: true,
      });
    });
  });

  return {
    scope: "lineup",
    playersById: mapPlayersToSnapshots(players),
    lineupSlots,
    teamSize: team.playerIds?.length,
    competitionType: payload.competitionType,
  };
}

/**
 * Build canonical lineup validation RuleSet from TT validation codes.
 *
 * @param {Object} [meta]
 */
export function mapTeamLineupValidationToRuleSet(meta = {}) {
  return createRuleSet({
    id: meta.id || "legacy-team-lineup-validation",
    version: meta.version || "1",
    constraints: [
      {
        id: "lineup-validity",
        type: COMPETITION_CONSTRAINT_TYPE.LINEUP_VALIDITY,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: { requireComplete: meta.requireComplete !== false },
      },
      {
        id: "mixed-composition",
        type: COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: meta.validateMixed !== false,
        params: { composition: "mixed_double" },
      },
      {
        id: "gender-eligibility",
        type: COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: {},
      },
      {
        id: "entry-eligibility",
        type: COMPETITION_CONSTRAINT_TYPE.ENTRY_ELIGIBILITY,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: {},
      },
    ],
  });
}

/**
 * Referee match action eligibility context.
 *
 * @param {Object} payload
 */
export function mapRefereeMatchEligibilityToContext(payload = {}) {
  return {
    scope: "lineup",
    playersById: mapPlayersToSnapshots(payload.players || []),
    lineupSlots: payload.lineupSlots || [],
    competitionType: payload.matchStatus,
  };
}
