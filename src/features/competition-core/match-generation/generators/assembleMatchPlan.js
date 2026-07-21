/**
 * CORE-09 Phase 1C — assemble MatchPlan stages/rounds from LogicalMatch list.
 */

import {
  createMatchPlan,
  createMatchPlanStage,
  createMatchPlanRound,
} from "../contracts/index.js";
import { MATCH_GENERATOR_IDENTITY } from "../constants.js";
import { fingerprintMatchPlan } from "../services/fingerprint.js";

/**
 * @param {object} args
 * @param {string} args.competitionId
 * @param {string} args.divisionId
 * @param {string|null} args.categoryId
 * @param {string} args.stageId
 * @param {ReadonlyArray<import('../contracts/logicalMatch.js').LogicalMatch>} args.logicalMatches
 * @param {string} args.drawFingerprint
 * @param {string} args.ruleEvaluationFingerprint
 * @param {string} args.participantFingerprint
 * @param {string} args.strategy
 * @param {ReadonlyArray<string>} [args.deterministicOrderingInputs]
 * @param {object} [args.diagnostics]
 * @param {object} [args.validationSummary]
 * @returns {import('../contracts/matchPlan.js').MatchPlan}
 */
export function assembleMatchPlan(args) {
  const matches = Array.isArray(args.logicalMatches)
    ? [...args.logicalMatches]
    : [];

  // Stable global order by deterministicOrder then logicalMatchKey (ASCII).
  matches.sort((a, b) => {
    if (a.deterministicOrder !== b.deterministicOrder) {
      return a.deterministicOrder - b.deterministicOrder;
    }
    const ka = String(a.logicalMatchKey || "");
    const kb = String(b.logicalMatchKey || "");
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });

  /** @type {Map<string, import('../contracts/logicalMatch.js').LogicalMatch[]>} */
  const roundBuckets = new Map();
  /** @type {string[]} */
  const roundIdOrder = [];

  for (const m of matches) {
    const groupPart = m.groupId ? `g:${m.groupId}` : "g:_";
    const roundId = `round:${args.stageId}:${groupPart}:r${m.roundNumber}`;
    if (!roundBuckets.has(roundId)) {
      roundBuckets.set(roundId, []);
      roundIdOrder.push(roundId);
    }
    roundBuckets.get(roundId).push(m);
  }

  const rounds = roundIdOrder.map((roundId, index) => {
    const bucket = roundBuckets.get(roundId) || [];
    const roundNumber = bucket[0]?.roundNumber ?? index + 1;
    const keys = bucket
      .slice()
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((m) => m.logicalMatchKey);
    return createMatchPlanRound({
      roundId,
      stageId: args.stageId,
      roundNumber,
      roundOrder: index + 1,
      logicalMatchKeys: keys,
    });
  });

  const stage = createMatchPlanStage({
    stageId: args.stageId,
    stageOrder: 1,
    roundIds: rounds.map((r) => r.roundId),
  });

  const draft = createMatchPlan({
    competitionId: args.competitionId,
    divisionId: args.divisionId,
    categoryId: args.categoryId,
    stages: [stage],
    rounds,
    logicalMatches: matches,
    drawFingerprint: args.drawFingerprint,
    ruleEvaluationFingerprint: args.ruleEvaluationFingerprint,
    participantFingerprint: args.participantFingerprint,
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    generationFingerprint: "",
    validationSummary: args.validationSummary || {
      ok: false,
      issueCount: 0,
      issueCodes: [],
    },
    diagnostics: args.diagnostics || {},
    metadata: {
      phase1c: Object.freeze({
        generatorId: MATCH_GENERATOR_IDENTITY.id,
        generatorVersion: MATCH_GENERATOR_IDENTITY.version,
        strategy: args.strategy,
      }),
    },
  });

  const generationFingerprint = fingerprintMatchPlan(draft, {
    strategy: args.strategy,
    deterministicOrderingInputs: args.deterministicOrderingInputs || [],
  });

  return createMatchPlan({
    ...draft,
    generationFingerprint,
    validationSummary: args.validationSummary || draft.validationSummary,
    diagnostics: args.diagnostics || draft.diagnostics,
    metadata: draft.metadata,
  });
}
