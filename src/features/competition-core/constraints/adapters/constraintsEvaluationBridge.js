import { isRulesV2Enabled } from "../../config/featureFlags.js";
import { evaluateCandidate } from "../evaluateCandidate.js";
import { resolveContext } from "../resolveContext.js";
import {
  appendDecisionTrace,
  createDecisionTrace,
  createDecisionTraceRecord,
} from "./decisionTrace.js";
import {
  mapAiContextToRuleSet,
  mapAiHistoryToRepeatCounts,
  mapAiOptionToCandidate,
  mapCourtEngineConfigToRuleSet,
  mapDailyPlaySettingsToRuleSet,
  mapPairingConstraintsToRuleSet,
  mapPlayersToSnapshots,
  mapTeamsToCandidateTeams,
} from "./legacyRuleMappers.js";
import {
  isDailyPlayPlayerEligible,
  toAiScoreBridgeResult,
  toPairingConstraintEvaluation,
  toValidationResult,
} from "./adaptLegacyResult.js";

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
  const trace = input.trace || createDecisionTrace();
  const envSource = input.envSource;

  if (!isRulesV2Enabled(envSource)) {
    const legacyResult = typeof input.legacyEvaluate === "function" ? input.legacyEvaluate() : null;
    const record = createDecisionTraceRecord({
      consumer: input.consumer,
      action: "legacy_fallback",
      usedCanonical: false,
      feasible: true,
      eligible: true,
      softScore: 0,
      metadata: { flag: "off" },
    });

    return {
      usedCanonical: false,
      result: legacyResult,
      trace: appendDecisionTrace(trace, record),
    };
  }

  const canonical = evaluateCandidate(
    input.candidate || {},
    input.ruleSet || { constraints: [] },
    resolveContext(input.context || {}),
    { envSource }
  );

  const record = createDecisionTraceRecord({
    consumer: input.consumer,
    action: canonical.feasible ? "score" : "reject",
    usedCanonical: true,
    feasible: canonical.feasible,
    eligible: canonical.eligible,
    softScore: canonical.softScore,
    engineVersion: canonical.engineVersion,
    ruleSetId: canonical.ruleSetId,
    ruleSetVersion: canonical.ruleSetVersion,
    explanations: canonical.explanations,
  });

  return {
    usedCanonical: true,
    result: input.adapt ? input.adapt(canonical) : canonical,
    trace: appendDecisionTrace(trace, record),
    canonical,
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
      legacyEvaluate: options.legacyEvaluate,
      adapt: (canonical) => toAiScoreBridgeResult(canonical, options.baseScore ?? 0),
    })
  );
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

  return evaluateLegacyRulesBridge({
    consumer: "court_engine",
    envSource: options.envSource,
    candidate,
    context: { scope: "pairing", ...context },
    ruleSet,
    legacyEvaluate: options.legacyEvaluate,
    adapt: toPairingConstraintEvaluation,
  });
}
