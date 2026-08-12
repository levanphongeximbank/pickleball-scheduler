import { LINEUP_VALIDATION_CODE } from "../../../team-tournament/engines/lineupValidationContract.js";
import { evaluateCanonicalRulesRuntime } from "./rulesRuntimeOrchestrator.js";
import {
  mapRefereeMatchEligibilityToContext,
  mapTeamLineupValidationToContext,
  mapTeamLineupValidationToRuleSet,
} from "./legacyRuleMappers.js";
import { mergeValidationResults, toValidationResult } from "./adaptLegacyResult.js";
import { createDecisionTrace } from "./decisionTrace.js";
import { isRulesV2Enabled } from "../../config/featureFlags.js";

/**
 * @param {import('../../../team-tournament/engines/lineupValidationContract.js').LineupValidationResult} legacyResult
 */
function lineupResultToValidationShape(legacyResult) {
  return {
    ok: legacyResult.ok === true,
    errors: legacyResult.ok ? [] : [legacyResult.message].filter(Boolean),
    warnings: legacyResult.warnings || [],
    errorDetails: legacyResult.ok
      ? []
      : [{ message: legacyResult.message, reasonCode: legacyResult.code }],
    code: legacyResult.code,
    validation: legacyResult,
  };
}

/**
 * Team Tournament lineup validation bridge.
 *
 * @param {Object} payload
 * @param {() => import('../../../team-tournament/engines/lineupValidationContract.js').LineupValidationResult} payload.legacyEvaluate
 * @param {Object} [options]
 */
export function evaluateLegacyTeamLineupValidation(payload = {}, options = {}) {
  const legacyResult =
    typeof payload.legacyEvaluate === "function" ? payload.legacyEvaluate() : payload.legacyResult;

  if (!isRulesV2Enabled(options.envSource || payload.envSource)) {
    return {
      usedCanonical: false,
      result: legacyResult,
      legacyResult,
      trace: createDecisionTrace(),
    };
  }

  const team = payload.team || payload.teamData?.teams?.find((item) => String(item.id) === String(payload.teamId));
  const context = mapTeamLineupValidationToContext({
    team,
    players: payload.players,
    selections: payload.selections,
  });
  const ruleSet = mapTeamLineupValidationToRuleSet({
    requireComplete: payload.partial !== true,
    validateMixed: true,
  });

  const bridge = evaluateCanonicalRulesRuntime({
    consumer: "team_lineup_validation",
    candidate: { teams: Object.values(payload.selections || {}).map((ids) => (ids || []).map(String)) },
    context,
    ruleSet,
    envSource: options.envSource || payload.envSource,
    legacyPayload: payload,
    legacyEvaluate: () => legacyResult,
    adapt: (canonical) => {
      const canonicalValidation = toValidationResult(canonical);
      const legacyShape = lineupResultToValidationShape(legacyResult);
      const merged = mergeValidationResults(legacyShape, canonicalValidation);
      if (!merged.ok && legacyResult?.ok === false) {
        return legacyResult;
      }
      if (!merged.ok) {
        return {
          ok: false,
          code: canonicalValidation.errorDetails?.[0]?.reasonCode || LINEUP_VALIDATION_CODE.VALIDATION,
          message: merged.errors[0] || "Lineup validation failed.",
          fieldErrors: legacyResult?.fieldErrors || {},
          ruleViolations: merged.errors,
          invalidPlayerIds: legacyResult?.invalidPlayerIds || [],
          invalidDisciplineIds: legacyResult?.invalidDisciplineIds || [],
          warnings: merged.warnings,
        };
      }
      return legacyResult?.ok === true ? legacyResult : legacyResult;
    },
    trace: options.trace || createDecisionTrace(),
  });

  return {
    ...bridge,
    result: bridge.result || legacyResult,
  };
}

/**
 * Captain submission validation bridge — deadline/lock enforced by legacy; canonical adds audit trace.
 *
 * @param {Object} payload
 * @param {Object} [options]
 */
export function evaluateLegacyCaptainSubmissionValidation(payload = {}, options = {}) {
  const legacyResult =
    typeof payload.legacyEvaluate === "function" ? payload.legacyEvaluate() : payload.legacyResult;

  if (!isRulesV2Enabled(options.envSource || payload.envSource)) {
    return { usedCanonical: false, result: legacyResult, legacyResult, trace: createDecisionTrace() };
  }

  if (legacyResult?.code === LINEUP_VALIDATION_CODE.LINEUP_LOCKED) {
    return evaluateLegacyTeamLineupValidation(
      { ...payload, legacyResult },
      { ...options, ruleSetMeta: { id: "captain-submission-locked" } }
    );
  }

  if (legacyResult?.code === LINEUP_VALIDATION_CODE.DEADLINE_PASSED) {
    return evaluateLegacyTeamLineupValidation(
      { ...payload, legacyResult },
      { ...options, ruleSetMeta: { id: "captain-submission-deadline" } }
    );
  }

  return evaluateLegacyTeamLineupValidation(payload, options);
}

/**
 * Referee match eligibility bridge.
 *
 * @param {Object} payload
 * @param {Object} [options]
 */
export function evaluateLegacyRefereeMatchEligibility(payload = {}, options = {}) {
  const legacyResult =
    typeof payload.legacyEvaluate === "function" ? payload.legacyEvaluate() : payload.legacyResult;

  if (!isRulesV2Enabled(options.envSource || payload.envSource)) {
    return { usedCanonical: false, result: legacyResult, legacyResult, trace: createDecisionTrace() };
  }

  const context = mapRefereeMatchEligibilityToContext(payload);
  const ruleSet = mapTeamLineupValidationToRuleSet({ requireComplete: true });

  return evaluateCanonicalRulesRuntime({
    consumer: "referee_match_eligibility",
    candidate: { teams: payload.teams || [] },
    context,
    ruleSet,
    envSource: options.envSource || payload.envSource,
    legacyEvaluate: () => legacyResult,
    adapt: (canonical) => {
      if (canonical.feasible === false) {
        return {
          ok: false,
          code: LINEUP_VALIDATION_CODE.PLAYER_NOT_ELIGIBLE,
          message: canonical.hardViolations?.[0]?.message || "Referee action not eligible.",
        };
      }
      return legacyResult;
    },
    trace: options.trace || createDecisionTrace(),
  });
}

/**
 * Tournament entry validation bridge (candidate-level).
 *
 * @param {Object} input
 * @param {Object} [options]
 */
export function evaluateLegacyTournamentEntryValidation(input = {}, options = {}) {
  return evaluateCanonicalRulesRuntime({
    consumer: "tournament_entry_validation",
    candidate: input.candidate,
    context: input.context,
    ruleSet: input.ruleSet,
    envSource: options.envSource,
    legacyEvaluate: options.legacyEvaluate,
    adapt: toValidationResult,
    trace: options.trace || createDecisionTrace(),
  });
}
