import { isRulesV2Enabled } from "../../config/featureFlags.js";
import {
  appendDecisionTrace,
  createDecisionTrace,
  createDecisionTraceRecord,
} from "./decisionTrace.js";
import { evaluateCanonicalRulesRuntime } from "./rulesRuntimeOrchestrator.js";
import {
  buildFounderPolicyDeduplicationPlan,
} from "./founderPolicyDeduplication.js";
import {
  mapAiContextToRuleSet,
  mapAiHistoryToRepeatCounts,
  mapAiOptionToCandidate,
  mapCourtEngineConfigToRuleSet,
  mapCourtMatchHistoryToRepeatCounts,
  mapDailyPlaySettingsToRuleSet,
  mapPairingConstraintsToRuleSet,
  mapPlayersToSnapshots,
  mapTeamsToCandidateTeams,
  mapTournamentDrawInputToContext,
  mapTournamentDrawInputToRuleSet,
  mapTournamentEntriesToCandidate,
} from "./legacyRuleMappers.js";
import {
  isDailyPlayPlayerEligible,
  mergeValidationResults,
  toAiScoreBridgeResult,
  toCourtEngineScoreBridgeResult,
  toCourtQueueGateResult,
  toPairingConstraintEvaluation,
  toValidationResult,
} from "./adaptLegacyResult.js";
import { RULE_ERROR_CODE } from "../ruleConstants.js";

/**
 * @typedef {'pairing_constraints'|'ai_scoring'|'tournament_validation'|'daily_play'|'court_engine'} LegacyRulesConsumer
 */

/**
 * @typedef {Object} LegacyRulesBridgeResult
 * @property {boolean} usedCanonical
 * @property {unknown} result
 * @property {import('./decisionTrace.js').DecisionTrace} trace
 * @property {import('../../types/index.js').ConstraintEvaluationResult} [canonical]
 */

/**
 * Core CC-03B bridge:
 * Legacy payload → canonical RuleSet → evaluateCandidate → legacy adapter + decision trace.
 *
 * @param {Object} input
 * @param {LegacyRulesConsumer} input.consumer
 * @param {Record<string, unknown>} [input.envSource]
 * @param {import('../../types/index.js').CandidateAssignment} [input.candidate]
 * @param {Partial<import('../../types/index.js').ConstraintContext>} [input.context]
 * @param {import('../normalizeRule.js').RuleSet|Array<import('../../types/index.js').ConstraintDefinition>} [input.ruleSet]
 * @param {() => unknown} [input.legacyEvaluate]
 * @returns {LegacyRulesBridgeResult}
 */
export function evaluateLegacyRulesBridge(input) {
  const bridge = evaluateCanonicalRulesRuntime({
    consumer: input.consumer,
    legacyPayload: input.legacyPayload,
    candidate: input.candidate,
    context: input.context,
    ruleSet: input.ruleSet,
    envSource: input.envSource,
    legacyEvaluate: input.legacyEvaluate,
    adapt: input.adapt,
    trace: input.trace,
    contextId: input.contextId,
    candidateOrActionId: input.candidateOrActionId,
  });

  return {
    usedCanonical: bridge.usedCanonical,
    result: bridge.result,
    trace: bridge.trace,
    canonical: bridge.canonical,
    traceRecord: bridge.traceRecord,
    doubleCountDetected: bridge.doubleCountDetected,
    runtimeError: bridge.runtimeError,
    deduplicationPlan: bridge.deduplicationPlan,
    deduplicationSummary: bridge.deduplicationSummary,
  };
}

/**
 * Pairing constraints legacy evaluator bridge.
 *
 * @param {Array<{ members?: unknown[], playerIds?: unknown[] }>} teams
 * @param {Array<Record<string, unknown>>} constraints
 * @param {Object} [options]
 * @returns {LegacyRulesBridgeResult & { result: ReturnType<typeof toPairingConstraintEvaluation> }}
 */
export function evaluateLegacyPairingConstraints(teams, constraints, options = {}) {
  const candidate = { teams: mapTeamsToCandidateTeams(teams) };
  const ruleSet = mapPairingConstraintsToRuleSet(constraints, options.ruleSetMeta);

  return /** @type {any} */ (
    evaluateLegacyRulesBridge({
      consumer: "pairing_constraints",
      envSource: options.envSource,
      candidate,
      context: { scope: "pairing", ...(options.context || {}) },
      ruleSet,
      legacyEvaluate: options.legacyEvaluate,
      adapt: toPairingConstraintEvaluation,
    })
  );
}

/**
 * AI scoring bridge for a pair option.
 *
 * @param {{ teamA?: Array<{ id: string }>, teamB?: Array<{ id: string }> }} option
 * @param {Object} context
 * @param {Object} [options]
 * @returns {LegacyRulesBridgeResult & { result: ReturnType<typeof toAiScoreBridgeResult> }}
 */
export function evaluateLegacyAiPairScore(option, context = {}, options = {}) {
  const allPlayers = [...(option.teamA || []), ...(option.teamB || [])];
  const { partnerRepeatCounts, opponentRepeatCounts } = mapAiHistoryToRepeatCounts(
    context.history || {}
  );

  const deduplicationPlan = buildFounderPolicyDeduplicationPlan({
    policies: context.policies,
    pairingConstraints: options.pairingConstraints,
    envSource: options.envSource,
    consumer: "ai_scoring",
  });

  const ruleSet = mapAiContextToRuleSet({
    policies: context.policies,
    rules: context.rules,
    competition: context.competition,
    levelDiffAllowed: options.levelDiffAllowed,
  });

  return /** @type {any} */ (
    evaluateLegacyRulesBridge({
      consumer: "ai_scoring",
      envSource: options.envSource,
      candidate: mapAiOptionToCandidate(option),
      context: {
        scope: "match",
        playersById: mapPlayersToSnapshots(allPlayers),
        partnerRepeatCounts,
        opponentRepeatCounts,
      },
      ruleSet,
      legacyPayload: {
        policies: context.policies,
        deduplicationPlan,
        applyCanonicalSoft: true,
        legacySoftScore: options.legacyPolicyScore,
      },
      legacyEvaluate: options.legacyEvaluate,
      adapt: (canonical) =>
        toAiScoreBridgeResult(canonical, options.baseScore ?? 0, {
          deduplicationPlan,
        }),
    })
  );
}

/**
 * Tournament draw validation bridge — merges legacy + canonical without duplicate errors.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} [input.entries]
 * @param {Array<Record<string, unknown>>} [input.players]
 * @param {string} [input.eventType]
 * @param {{ ok?: boolean, errors?: string[], warnings?: string[] }} [input.legacyResult]
 * @param {Object} [options]
 */
export function evaluateLegacyTournamentDrawValidation(input = {}, options = {}) {
  const legacyResult = input.legacyResult || options.legacyResult || { ok: true, errors: [], warnings: [] };

  if (!isRulesV2Enabled(options.envSource)) {
    return {
      usedCanonical: false,
      result: legacyResult,
      trace: createDecisionTrace(),
    };
  }

  const ruleSet = mapTournamentDrawInputToRuleSet(input.eventType, options.ruleSetMeta);
  const context = mapTournamentDrawInputToContext(input);

  if (!context.playersById || Object.keys(context.playersById).length === 0) {
    const trace = createDecisionTrace();
    const record = createDecisionTraceRecord({
      consumer: "tournament_validation",
      action: "context_missing",
      usedCanonical: true,
      feasible: true,
      eligible: true,
      softScore: 0,
      metadata: { code: RULE_ERROR_CODE.RULES_V2_CONTEXT_MISSING, field: "playersById" },
    });

    return {
      usedCanonical: isRulesV2Enabled(options.envSource),
      result: legacyResult,
      trace: appendDecisionTrace(trace, record),
    };
  }

  const bridge = evaluateLegacyRulesBridge({
    consumer: "tournament_validation",
    envSource: options.envSource,
    candidate: mapTournamentEntriesToCandidate(input.entries || []),
    context,
    ruleSet,
    legacyEvaluate: () => legacyResult,
    adapt: (canonical) =>
      mergeValidationResults(legacyResult, toValidationResult(canonical), {
        decisionTrace: undefined,
      }),
  });

  if (bridge.usedCanonical && bridge.result) {
    bridge.result.decisionTrace = bridge.trace;
  }

  return bridge;
}

/**
 * Court Engine queue gate — check-in + busy hard rejects only.
 *
 * @param {Object} session
 * @param {string} playerId
 * @param {Object} [options]
 */
export function evaluateLegacyCourtEngineQueueGate(session, playerId, options = {}) {
  const key = String(playerId);
  const checkIn = (session?.checkIns || []).find((item) => String(item.playerId) === key);
  const status = checkIn?.status;
  const rosterPlayer =
    (options.players || []).find((item) => String(item.id) === key) || { id: key };

  const playersById = mapPlayersToSnapshots([
    {
      ...rosterPlayer,
      id: key,
      checkedIn: Boolean(checkIn && status !== "cancelled"),
      busy: status === "playing",
    },
  ]);

  const ruleSet = mapCourtEngineConfigToRuleSet({
    requireCheckIn: true,
    avoidPartnerRepeat: false,
    avoidOpponentRepeat: false,
  });

  return evaluateLegacyRulesBridge({
    consumer: "court_engine",
    envSource: options.envSource,
    candidate: { teams: [[String(playerId)]] },
    context: { scope: "entry", playersById },
    ruleSet,
    legacyEvaluate: () => ({ ok: true }),
    adapt: toCourtQueueGateResult,
  });
}

/**
 * Court Engine combination scoring bridge.
 *
 * @param {{ teamA: string[], teamB: string[] }} split
 * @param {Object} config
 * @param {Partial<import('../../types/index.js').ConstraintContext>} context
 * @param {Object} [options]
 */
export function evaluateLegacyCourtEngineCombinationScore(split, config, context, options = {}) {
  const ruleSet = mapCourtEngineConfigToRuleSet(config);

  return evaluateLegacyRulesBridge({
    consumer: "court_engine",
    envSource: options.envSource,
    candidate: { matchOption: { teamA: split.teamA, teamB: split.teamB } },
    context: { scope: "match", ...context },
    ruleSet,
    legacyEvaluate: () => ({ ok: true, softScoreDelta: 0, hardRejected: false }),
    adapt: toCourtEngineScoreBridgeResult,
  });
}

/**
 * Tournament validation bridge (candidate-level).
 *
 * @param {Object} input
 * @param {import('../../types/index.js').CandidateAssignment} input.candidate
 * @param {import('../normalizeRule.js').RuleSet} input.ruleSet
 * @param {Partial<import('../../types/index.js').ConstraintContext>} [input.context]
 * @param {Object} [options]
 */
export function evaluateLegacyTournamentValidation(input, options = {}) {
  return evaluateLegacyRulesBridge({
    consumer: "tournament_validation",
    envSource: options.envSource,
    candidate: input.candidate,
    context: input.context,
    ruleSet: input.ruleSet,
    legacyEvaluate: options.legacyEvaluate,
    adapt: toValidationResult,
  });
}

/**
 * Daily Play player eligibility bridge.
 *
 * @param {Object} player
 * @param {Object} settings
 * @param {Object} [options]
 */
export function evaluateLegacyDailyPlayPlayer(player, settings = {}, options = {}) {
  const ruleSet = mapDailyPlaySettingsToRuleSet(settings);
  const bridge = evaluateLegacyRulesBridge({
    consumer: "daily_play",
    envSource: options.envSource,
    candidate: { teams: [[String(player.id)]] },
    context: {
      scope: "entry",
      playersById: mapPlayersToSnapshots([player]),
      competitionType: settings.competitionType,
    },
    ruleSet,
    legacyEvaluate: options.legacyEvaluate,
    adapt: (canonical) => ({
      eligible: isDailyPlayPlayerEligible(canonical, player.id),
      canonical,
    }),
  });

  return bridge;
}

/**
 * Court Engine rule bridge (adapter-level scoring).
 *
 * @param {import('../../types/index.js').CandidateAssignment} candidate
 * @param {Object} config
 * @param {Partial<import('../../types/index.js').ConstraintContext>} context
 * @param {Object} [options]
 */
export function evaluateLegacyCourtEngineRules(candidate, config, context, options = {}) {
  const ruleSet = mapCourtEngineConfigToRuleSet(config);
  const repeatCounts =
    context.partnerRepeatCounts && context.opponentRepeatCounts
      ? {
          partnerRepeatCounts: context.partnerRepeatCounts,
          opponentRepeatCounts: context.opponentRepeatCounts,
        }
      : mapCourtMatchHistoryToRepeatCounts(context.matchHistory || []);

  return evaluateLegacyRulesBridge({
    consumer: "court_engine",
    envSource: options.envSource,
    candidate,
    context: {
      scope: "match",
      ...context,
      partnerRepeatCounts: repeatCounts.partnerRepeatCounts,
      opponentRepeatCounts: repeatCounts.opponentRepeatCounts,
    },
    ruleSet,
    legacyEvaluate: options.legacyEvaluate,
    adapt: toPairingConstraintEvaluation,
  });
}
