import {
  DEFAULT_TIEBREAK_RULE_SET_ID,
  DEFAULT_TIEBREAK_RULE_SET_VERSION,
  STANDINGS_ENGINE_VERSION,
} from "./standingsConstants.js";
import {
  buildMatchSetHash,
  cloneStandingsRequest,
  createStandingsAudit,
  createStandingsDecisionTrace,
  createStandingsExplanation,
  createStandingsResult,
  createStandingsSnapshot,
} from "./standingsContracts.js";
import { buildDrawLotTokensForEntries } from "./drawLot.js";
import { accumulateStandingsRows } from "./scoringRules.js";
import { applyManualOverrides, applyQualificationDecisions, rankStandingsRows } from "./tieBreakSteps.js";

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `standings-trace-${Date.now()}-${traceCounter}`;
}

/**
 * Pure canonical standings calculator — no DB writes, no input mutation.
 *
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {Object} [options]
 * @param {boolean} [options.groupComplete]
 */
export function calculateCanonicalStandings(request, options = {}) {
  const input = cloneStandingsRequest(request);
  const warnings = [];
  const errors = [];
  const explanations = [];

  if (!input.entries?.length) {
    errors.push("Standings request requires at least one entry.");
    return createStandingsResult({
      ok: false,
      errors,
      warnings,
      decisionTrace: createStandingsDecisionTrace({ traceId: nextTraceId() }),
      audit: createStandingsAudit({ warnings }),
      snapshot: createStandingsSnapshot({ warnings }),
    });
  }

  const traceSink = {
    warnings,
    excludedMatches: [],
    tieGroups: [],
    tieBreakSteps: [],
    miniTableCalculations: [],
    headToHeadCalculations: [],
  };

  const { rows: initialRows, excludedMatches, seenMatchIds } = accumulateStandingsRows(input, traceSink);
  let rankedRows = rankStandingsRows(initialRows, input, input.matches, traceSink);

  const qualification = applyQualificationDecisions(
    rankedRows,
    input,
    options.groupComplete !== false
  );
  rankedRows = qualification.rows;

  rankedRows = applyManualOverrides(rankedRows, input.manualOverrides);

  const drawLotTokens = buildDrawLotTokensForEntries(
    rankedRows.map((row) => row.entryId),
    input.configuration.drawLotSeed || "cc08-default-seed"
  );

  const decisionTrace = createStandingsDecisionTrace({
    traceId: nextTraceId(),
    engineVersion: STANDINGS_ENGINE_VERSION,
    scoringRuleId: input.configuration.scoringRule.scoringRuleId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleSetId: DEFAULT_TIEBREAK_RULE_SET_ID,
    tieBreakRuleSetVersion: DEFAULT_TIEBREAK_RULE_SET_VERSION,
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    groupId: input.groupId,
    inputMatchIds: seenMatchIds,
    excludedMatches,
    initialRows,
    tieGroups: traceSink.tieGroups,
    tieBreakSteps: traceSink.tieBreakSteps,
    miniTableCalculations: traceSink.miniTableCalculations,
    headToHeadCalculations: traceSink.headToHeadCalculations,
    drawLotSeed: input.configuration.drawLotSeed,
    drawLotTokens,
    finalRanks: rankedRows.map((row) => ({ entryId: row.entryId, rank: row.rank })),
    qualificationDecisions: qualification.decisions,
    warnings,
  });

  rankedRows.forEach((row) => {
    explanations.push(
      createStandingsExplanation({
        code: "rank_assigned",
        message: `${row.name || row.entryId} ranked #${row.rank} with ${row.points} points.`,
        details: {
          entryId: row.entryId,
          rank: row.rank,
          points: row.points,
          manualOverrideApplied: row.manualOverrideApplied === true,
        },
      })
    );
  });

  const snapshot = createStandingsSnapshot({
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    groupId: input.groupId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleVersion: DEFAULT_TIEBREAK_RULE_SET_VERSION,
    matchSetHash: buildMatchSetHash(input.matches),
    rows: rankedRows,
    engineVersion: STANDINGS_ENGINE_VERSION,
    warnings,
  });

  const audit = createStandingsAudit({
    engineVersion: STANDINGS_ENGINE_VERSION,
    scoringRuleId: input.configuration.scoringRule.scoringRuleId,
    scoringRuleVersion: input.configuration.scoringRule.scoringRuleVersion,
    tieBreakRuleSetId: DEFAULT_TIEBREAK_RULE_SET_ID,
    tieBreakRuleSetVersion: DEFAULT_TIEBREAK_RULE_SET_VERSION,
    warnings,
  });

  return createStandingsResult({
    ok: errors.length === 0,
    rows: rankedRows,
    snapshot,
    decisionTrace,
    audit,
    explanations,
    warnings,
    errors,
  });
}

/**
 * @param {import('./standingsTypes.js').StandingsRequest} request
 */
export function validateStandingsRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    errors.push("request object required");
  }
  if (!Array.isArray(request?.entries) || request.entries.length === 0) {
    errors.push("entries required");
  }
  if (!request?.configuration?.scoringRule) {
    errors.push("scoringRule required");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./standingsTypes.js').StandingsResult} result
 */
export function isStandingsResultJsonSerializable(result) {
  try {
    JSON.stringify(result);
    return true;
  } catch {
    return false;
  }
}
