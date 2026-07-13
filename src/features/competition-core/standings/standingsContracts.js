import {
  DEFAULT_SCORING_RULE,
  DEFAULT_TIEBREAK_ORDER,
  DEFAULT_TIEBREAK_RULE_SET_ID,
  DEFAULT_TIEBREAK_RULE_SET_VERSION,
  STANDINGS_ENGINE_VERSION,
  TIEBREAK_TYPE,
} from "./standingsConstants.js";

function cloneArray(items, mapFn) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => (mapFn ? mapFn(item) : item));
}

/**
 * @param {Partial<import('./standingsTypes.js').ScoringRule>} [partial]
 */
export function createScoringRule(partial = {}) {
  return {
    scoringRuleId: partial.scoringRuleId || DEFAULT_SCORING_RULE.scoringRuleId,
    scoringRuleVersion: partial.scoringRuleVersion || DEFAULT_SCORING_RULE.scoringRuleVersion,
    winPoints: Number(partial.winPoints ?? DEFAULT_SCORING_RULE.winPoints),
    lossPoints: Number(partial.lossPoints ?? DEFAULT_SCORING_RULE.lossPoints),
    drawPoints: Number(partial.drawPoints ?? DEFAULT_SCORING_RULE.drawPoints),
    forfeitPoints: Number(partial.forfeitPoints ?? DEFAULT_SCORING_RULE.forfeitPoints),
    walkoverPoints: Number(partial.walkoverPoints ?? DEFAULT_SCORING_RULE.walkoverPoints),
    byePoints: Number(partial.byePoints ?? DEFAULT_SCORING_RULE.byePoints),
    completedMatchRequired: partial.completedMatchRequired !== false,
    verifiedResultRequired: partial.verifiedResultRequired === true,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').TieBreakRule>} [partial]
 */
export function createTieBreakRule(partial = {}) {
  return {
    id: partial.id || `tiebreak-${partial.type || TIEBREAK_TYPE.TOTAL_POINTS}`,
    type: partial.type || TIEBREAK_TYPE.TOTAL_POINTS,
    priority: Number(partial.priority ?? 0),
    enabled: partial.enabled !== false,
    parameters: partial.parameters ? { ...partial.parameters } : undefined,
    scope: partial.scope,
    version: partial.version || DEFAULT_TIEBREAK_RULE_SET_VERSION,
    explanationTemplate: partial.explanationTemplate,
    legacyKey: partial.legacyKey,
  };
}

/**
 * @param {Array<Partial<import('./standingsTypes.js').TieBreakRule>>|import('./standingsTypes.js').TieBreakTypeValue[]} [rules]
 */
export function createDefaultTieBreakRuleSet(rules = DEFAULT_TIEBREAK_ORDER) {
  if (Array.isArray(rules) && rules.length && typeof rules[0] === "string") {
    return /** @type {import('./standingsTypes.js').TieBreakTypeValue[]} */ (rules).map((type, index) =>
      createTieBreakRule({ id: `default-${type}`, type, priority: index + 1 })
    );
  }
  return cloneArray(rules, (item) => createTieBreakRule(item));
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsEntry>} [partial]
 */
export function createStandingsEntry(partial = {}) {
  return {
    entryId: String(partial.entryId || partial.teamId || partial.playerId || ""),
    teamId: partial.teamId != null ? String(partial.teamId) : undefined,
    playerId: partial.playerId != null ? String(partial.playerId) : undefined,
    name: partial.name != null ? String(partial.name) : undefined,
    seed: Number.isFinite(Number(partial.seed)) ? Number(partial.seed) : undefined,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsMatchRecord>} [partial]
 */
export function createStandingsMatchRecord(partial = {}) {
  return {
    matchId: String(partial.matchId || ""),
    entryAId: String(partial.entryAId || ""),
    entryBId: String(partial.entryBId || ""),
    resultType: partial.resultType || "COMPLETED",
    winnerEntryId: partial.winnerEntryId != null ? String(partial.winnerEntryId) : undefined,
    scoreA: Number.isFinite(Number(partial.scoreA)) ? Number(partial.scoreA) : undefined,
    scoreB: Number.isFinite(Number(partial.scoreB)) ? Number(partial.scoreB) : undefined,
    gamesA: Number.isFinite(Number(partial.gamesA)) ? Number(partial.gamesA) : undefined,
    gamesB: Number.isFinite(Number(partial.gamesB)) ? Number(partial.gamesB) : undefined,
    setsA: Number.isFinite(Number(partial.setsA)) ? Number(partial.setsA) : undefined,
    setsB: Number.isFinite(Number(partial.setsB)) ? Number(partial.setsB) : undefined,
    verified: partial.verified !== false,
    legacyStatus: partial.legacyStatus,
    groupId: partial.groupId != null ? String(partial.groupId) : undefined,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsRow>} [partial]
 */
export function createStandingsRow(partial = {}) {
  const scoreFor = Number(partial.scoreFor ?? 0);
  const scoreAgainst = Number(partial.scoreAgainst ?? 0);
  const gamesFor = Number(partial.gamesFor ?? 0);
  const gamesAgainst = Number(partial.gamesAgainst ?? 0);
  const setsFor = Number(partial.setsFor ?? 0);
  const setsAgainst = Number(partial.setsAgainst ?? 0);

  return {
    entryId: String(partial.entryId || ""),
    teamId: partial.teamId != null ? String(partial.teamId) : undefined,
    playerId: partial.playerId != null ? String(partial.playerId) : undefined,
    name: partial.name,
    played: Number(partial.played ?? 0),
    wins: Number(partial.wins ?? 0),
    losses: Number(partial.losses ?? 0),
    draws: Number(partial.draws ?? 0),
    forfeits: Number(partial.forfeits ?? 0),
    walkovers: Number(partial.walkovers ?? 0),
    byes: Number(partial.byes ?? 0),
    points: Number(partial.points ?? 0),
    gamesFor,
    gamesAgainst,
    gameDifference: Number(partial.gameDifference ?? gamesFor - gamesAgainst),
    setsFor,
    setsAgainst,
    setDifference: Number(partial.setDifference ?? setsFor - setsAgainst),
    scoreFor,
    scoreAgainst,
    scoreDifference: Number(partial.scoreDifference ?? scoreFor - scoreAgainst),
    headToHeadData: partial.headToHeadData ? { ...partial.headToHeadData } : undefined,
    seed: Number.isFinite(Number(partial.seed)) ? Number(partial.seed) : undefined,
    rank: Number(partial.rank ?? 0),
    qualificationStatus: partial.qualificationStatus,
    warnings: cloneArray(partial.warnings, String),
    manualOverrideApplied: partial.manualOverrideApplied === true,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsConfiguration>} [partial]
 */
export function createStandingsConfiguration(partial = {}) {
  return {
    scoringRule: createScoringRule(partial.scoringRule || {}),
    tieBreakRules: createDefaultTieBreakRuleSet(partial.tieBreakRules || DEFAULT_TIEBREAK_ORDER),
    qualificationRule: partial.qualificationRule ? { ...partial.qualificationRule } : undefined,
    drawLotSeed: partial.drawLotSeed != null ? String(partial.drawLotSeed) : "cc08-default-seed",
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsRequest>} [partial]
 */
export function createStandingsRequest(partial = {}) {
  return {
    tournamentId: partial.tournamentId != null ? String(partial.tournamentId) : undefined,
    eventId: partial.eventId != null ? String(partial.eventId) : undefined,
    groupId: partial.groupId != null ? String(partial.groupId) : undefined,
    scope: partial.scope || "individual_group",
    entries: cloneArray(partial.entries, createStandingsEntry),
    matches: cloneArray(partial.matches, createStandingsMatchRecord),
    configuration: createStandingsConfiguration(partial.configuration || {}),
    manualOverrides: cloneArray(partial.manualOverrides),
    metadata: partial.metadata ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsExplanation>} [partial]
 */
export function createStandingsExplanation(partial = {}) {
  return {
    code: String(partial.code || "standings"),
    message: String(partial.message || ""),
    details: partial.details ? { ...partial.details } : undefined,
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsAudit>} [partial]
 */
export function createStandingsAudit(partial = {}) {
  return {
    engineVersion: partial.engineVersion || STANDINGS_ENGINE_VERSION,
    scoringRuleId: partial.scoringRuleId || DEFAULT_SCORING_RULE.scoringRuleId,
    scoringRuleVersion: partial.scoringRuleVersion || DEFAULT_SCORING_RULE.scoringRuleVersion,
    tieBreakRuleSetId: partial.tieBreakRuleSetId || DEFAULT_TIEBREAK_RULE_SET_ID,
    tieBreakRuleSetVersion: partial.tieBreakRuleSetVersion || DEFAULT_TIEBREAK_RULE_SET_VERSION,
    warnings: cloneArray(partial.warnings, String),
    recordedAt: partial.recordedAt || new Date().toISOString(),
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsSnapshot>} [partial]
 */
export function createStandingsSnapshot(partial = {}) {
  return {
    snapshotId: partial.snapshotId || `standings-snapshot-${Date.now()}`,
    tournamentId: partial.tournamentId,
    eventId: partial.eventId,
    groupId: partial.groupId,
    scoringRuleVersion: partial.scoringRuleVersion || DEFAULT_SCORING_RULE.scoringRuleVersion,
    tieBreakRuleVersion: partial.tieBreakRuleVersion || DEFAULT_TIEBREAK_RULE_SET_VERSION,
    matchSetHash: partial.matchSetHash || "",
    rows: cloneArray(partial.rows, createStandingsRow),
    generatedAt: partial.generatedAt || new Date().toISOString(),
    engineVersion: partial.engineVersion || STANDINGS_ENGINE_VERSION,
    warnings: cloneArray(partial.warnings, String),
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsDecisionTrace>} [partial]
 */
export function createStandingsDecisionTrace(partial = {}) {
  return {
    traceId: partial.traceId || `standings-trace-${Date.now()}`,
    engineVersion: partial.engineVersion || STANDINGS_ENGINE_VERSION,
    scoringRuleId: partial.scoringRuleId || DEFAULT_SCORING_RULE.scoringRuleId,
    scoringRuleVersion: partial.scoringRuleVersion || DEFAULT_SCORING_RULE.scoringRuleVersion,
    tieBreakRuleSetId: partial.tieBreakRuleSetId || DEFAULT_TIEBREAK_RULE_SET_ID,
    tieBreakRuleSetVersion: partial.tieBreakRuleSetVersion || DEFAULT_TIEBREAK_RULE_SET_VERSION,
    tournamentId: partial.tournamentId,
    eventId: partial.eventId,
    groupId: partial.groupId,
    inputMatchIds: cloneArray(partial.inputMatchIds, String),
    excludedMatches: cloneArray(partial.excludedMatches),
    initialRows: cloneArray(partial.initialRows, createStandingsRow),
    tieGroups: cloneArray(partial.tieGroups),
    tieBreakSteps: cloneArray(partial.tieBreakSteps),
    miniTableCalculations: cloneArray(partial.miniTableCalculations),
    headToHeadCalculations: cloneArray(partial.headToHeadCalculations),
    drawLotSeed: partial.drawLotSeed,
    drawLotTokens: partial.drawLotTokens ? { ...partial.drawLotTokens } : undefined,
    finalRanks: cloneArray(partial.finalRanks),
    qualificationDecisions: cloneArray(partial.qualificationDecisions),
    warnings: cloneArray(partial.warnings, String),
    timestamp: partial.timestamp || new Date().toISOString(),
  };
}

/**
 * @param {Partial<import('./standingsTypes.js').StandingsResult>} [partial]
 */
export function createStandingsResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    rows: cloneArray(partial.rows, createStandingsRow),
    snapshot: createStandingsSnapshot(partial.snapshot || {}),
    decisionTrace: createStandingsDecisionTrace(partial.decisionTrace || {}),
    audit: createStandingsAudit(partial.audit || {}),
    explanations: cloneArray(partial.explanations, createStandingsExplanation),
    warnings: cloneArray(partial.warnings, String),
    errors: cloneArray(partial.errors, String),
  };
}

/**
 * @param {import('./standingsTypes.js').StandingsRequest} request
 */
export function cloneStandingsRequest(request) {
  return createStandingsRequest(JSON.parse(JSON.stringify(request)));
}

/**
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 */
export function buildMatchSetHash(matches = []) {
  const payload = matches
    .map((match) =>
      [
        match.matchId,
        match.entryAId,
        match.entryBId,
        match.resultType,
        match.winnerEntryId,
        match.scoreA,
        match.scoreB,
      ].join(":")
    )
    .sort()
    .join("|");
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return `msh-${hash.toString(16)}`;
}
