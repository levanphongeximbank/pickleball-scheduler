import { RESTRICTED_COMPETITION_CLASSES } from "../constants/enums.js";
import {
  resolveActivePrivatePairingRules,
  splitHardAndSoftRules,
} from "./resolveActiveRules.js";
import { evaluateHardPrivatePairingRules } from "./evaluateHardOnCandidate.js";
import {
  computeBalanceScore,
  computeFairnessScore,
  computeHistoryScore,
  scoreSoftPrivatePairingRules,
} from "./scoreSoftOnCandidate.js";
import { generateTeamPairingCandidates } from "./generateTeamCandidates.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_RUNTIME_VERSION,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { PRIVATE_PAIRING_OPERATION } from "./privatePairingSource.js";
import {
  buildScoreBreakdown,
  sortCandidatesByOptimizationRank,
} from "./optimizationCandidateComparator.js";
import { runPartnerPairingGlobalOptimizer } from "../../competition-optimizer/partner-pairing/partnerPairingGlobalOptimizer.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

/**
 * @typedef {Object} PrivatePairingRuntimeResult
 * @property {boolean} ok
 * @property {string|null} errorCode
 * @property {Object|null} selectedCandidate
 * @property {number} rejectedCandidateCount
 * @property {Array} hardConstraintsApplied
 * @property {Array} softConstraintsSatisfied
 * @property {Array} softConstraintsMissed
 * @property {number} balanceScore
 * @property {number} fairnessScore
 * @property {number} historyScore
 * @property {number} constraintScore
 * @property {number} finalScore
 * @property {string} ruleSetVersion
 * @property {Array} warnings
 * @property {Array} rejectedSamples
 * @property {Object} meta
 */

/**
 * Score a single already-built candidate (teams and/or matchOption).
 * Ranking uses shared lexicographic comparator via `scoreBreakdown` — never totalPenalty.
 *
 * @param {Object} candidate
 * @param {Object} options
 * @returns {Object}
 */
export function evaluatePrivatePairingCandidate(candidate, options = {}) {
  const resolveContext = {
    ...(options.context || {}),
    operation: options.context?.operation || options.operation || PRIVATE_PAIRING_OPERATION.PARTNER_PAIRING,
  };
  const resolved = options.resolved || resolveActivePrivatePairingRules({
    rules: options.rules,
    legacyConstraints: options.legacyConstraints,
    context: resolveContext,
  });
  const hard = resolved.hardRules || splitHardAndSoftRules(resolved.rules).hard;
  const soft = resolved.softRules || splitHardAndSoftRules(resolved.rules).soft;
  const hardResult = evaluateHardPrivatePairingRules(candidate, hard);
  if (!hardResult.feasible) {
    const scoreBreakdown = buildScoreBreakdown({});
    return {
      id: candidate.id,
      feasible: false,
      rejectionCodes: hardResult.violations.map((item) => item.code),
      violations: hardResult.violations,
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: Number.NEGATIVE_INFINITY,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
      teams: candidate.teams,
      matchOption: candidate.matchOption,
      groups: candidate.groups,
    };
  }

  const softResult = scoreSoftPrivatePairingRules(candidate, soft, options.history || {});
  const playersById = options.context?.playersById || {};
  const balanceScore = computeBalanceScore(candidate.teams || [], playersById);
  const fairnessScore = computeFairnessScore(candidate.teams || []);
  const historyScore = computeHistoryScore(softResult);
  const constraintScore = softResult.constraintScore;
  const scoreBreakdown = buildScoreBreakdown({
    penaltyBySource: softResult.penaltyBySource,
    balanceScore,
    fairnessScore,
    formationQuality: options.formationQuality,
    openBalanceScore: options.openBalanceScore,
  });
  // finalScore kept for display/legacy explanation only — ranking uses scoreBreakdown.
  const finalScore =
    fairnessScore * 100000 +
    balanceScore * 1000 +
    historyScore * 10 +
    constraintScore;

  return {
    id: candidate.id,
    feasible: true,
    rejectionCodes: [],
    violations: [],
    balanceScore,
    fairnessScore,
    historyScore,
    constraintScore,
    finalScore,
    scoreBreakdown,
    optimizationRuleScore: scoreBreakdown,
    softConstraintsSatisfied: softResult.softConstraintsSatisfied,
    softConstraintsMissed: softResult.softConstraintsMissed,
    penaltyBySource: softResult.penaltyBySource,
    privatePairingSoftPenalty: softResult.privatePairingSoftPenalty,
    teams: candidate.teams,
    matchOption: candidate.matchOption,
    groups: candidate.groups,
  };
}

/**
 * Unified private pairing runtime for team formation.
 *
 * @param {Object} input
 * @param {Array} input.players
 * @param {Array} [input.rules]
 * @param {Array} [input.legacyConstraints]
 * @param {Object} [input.context]
 * @param {number|string} [input.seed]
 * @param {number} [input.maxCandidates]
 * @param {number} [input.maxIterations]
 * @param {Record<string, unknown>} [input.envSource]
 * @returns {PrivatePairingRuntimeResult}
 */
export function runPrivatePairingRuntime(input = {}) {
  const startedAt = Date.now();
  const envSource = input.envSource;
  const runtimeEnabled = isPrivatePairingRuntimeEnabled(envSource);

  if (!runtimeEnabled) {
    return {
      ok: true,
      errorCode: null,
      selectedCandidate: null,
      rejectedCandidateCount: 0,
      hardConstraintsApplied: [],
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: 0,
      ruleSetVersion: "legacy",
      warnings: [],
      rejectedSamples: [],
      meta: {
        runtimeEnabled: false,
        runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  const resolved = resolveActivePrivatePairingRules({
    rules: input.rules,
    legacyConstraints: input.legacyConstraints,
    context: {
      ...(input.context || {}),
      operation: input.context?.operation || PRIVATE_PAIRING_OPERATION.PARTNER_PAIRING,
    },
  });

  if (resolved.validationErrors.length) {
    return {
      ok: false,
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_VALIDATION_FAILED,
      selectedCandidate: null,
      rejectedCandidateCount: 0,
      hardConstraintsApplied: [],
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: 0,
      ruleSetVersion: resolved.ruleSetVersion,
      warnings: resolved.warnings,
      rejectedSamples: [],
      meta: {
        runtimeEnabled: true,
        runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        validationErrors: resolved.validationErrors,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  if (resolved.fatalConflicts.length) {
    return {
      ok: false,
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
      selectedCandidate: null,
      rejectedCandidateCount: 0,
      hardConstraintsApplied: resolved.rules
        .filter((r) => r.severity === "hard")
        .map((r) => ({ ruleId: r.id, constraintType: r.constraintType })),
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: 0,
      ruleSetVersion: resolved.ruleSetVersion,
      warnings: resolved.warnings,
      rejectedSamples: [],
      meta: {
        runtimeEnabled: true,
        runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        fatalConflicts: resolved.fatalConflicts,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  // Official / certified / VPR: do not drop blocked personal rules and continue baseline.
  if (
    isRestrictedCompetitionClass(input.context?.competitionClass) &&
    resolved.blockedByPolicy.length > 0
  ) {
    return {
      ok: false,
      errorCode: PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY,
      selectedCandidate: null,
      rejectedCandidateCount: 0,
      hardConstraintsApplied: [],
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: 0,
      ruleSetVersion: resolved.ruleSetVersion,
      warnings: resolved.warnings,
      rejectedSamples: [],
      meta: {
        runtimeEnabled: true,
        runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        blockedByPolicy: resolved.blockedByPolicy,
        blockedByPolicyCount: resolved.blockedByPolicy.length,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  const hard = resolved.hardRules || splitHardAndSoftRules(resolved.rules).hard;
  if (input.useGlobalOptimizer !== false) {
    const optimized = runPartnerPairingGlobalOptimizer({
      players: input.players || [],
      formationResolved: resolved,
      context: {
        ...(input.context || {}),
        operation: input.context?.operation || PRIVATE_PAIRING_OPERATION.PARTNER_PAIRING,
      },
      history: input.history,
      seed: input.seed ?? input.context?.seed ?? 1,
      maxCandidates: input.maxCandidates ?? 64,
      maxIterations: input.maxIterations ?? 128,
      mixedDoubles: input.mixedDoubles === true,
      budget: input.budget,
    });
    const selected = optimized.bestCandidate;
    const rejectedCandidateCount = optimized.diagnostics?.rejectedHardViolationCount || 0;
    if (!optimized.ok || !selected) {
      return {
        ok: false,
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING,
        selectedCandidate: null,
        rejectedCandidateCount,
        hardConstraintsApplied: hard.map((r) => ({ ruleId: r.id, constraintType: r.constraintType })),
        softConstraintsSatisfied: [],
        softConstraintsMissed: [],
        balanceScore: 0, fairnessScore: 0, historyScore: 0, constraintScore: 0, finalScore: 0,
        ruleSetVersion: resolved.ruleSetVersion,
        warnings: resolved.warnings,
        rejectedSamples: [],
        meta: {
          runtimeEnabled: true, runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
          elapsedMs: Date.now() - startedAt, optimizer: optimized,
          ruleResolution: resolved.ruleResolution,
        },
      };
    }
    return {
      ok: true, errorCode: null, selectedCandidate: selected, rejectedCandidateCount,
      hardConstraintsApplied: hard.map((r) => ({ ruleId: r.id, constraintType: r.constraintType })),
      softConstraintsSatisfied: selected.softConstraintsSatisfied || [],
      softConstraintsMissed: selected.softConstraintsMissed || [],
      balanceScore: selected.balanceScore || 0, fairnessScore: selected.fairnessScore || 0,
      historyScore: selected.historyScore || 0, constraintScore: selected.constraintScore || 0,
      finalScore: selected.finalScore || 0, scoreBreakdown: selected.scoreBreakdown,
      optimizationRuleScore: selected.scoreBreakdown, ruleSetVersion: resolved.ruleSetVersion,
      warnings: resolved.warnings, rejectedSamples: [],
      meta: {
        runtimeEnabled: true, runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        candidateCount: optimized.diagnostics?.initialCandidateCount || 0,
        iterations: optimized.diagnostics?.acceptedMoveCount || 0,
        truncated: false, elapsedMs: Date.now() - startedAt,
        blockedByPolicyCount: resolved.blockedByPolicy.length,
        ruleResolution: resolved.ruleResolution, optimizer: optimized,
        scoreBreakdown: selected.scoreBreakdown, optimizationRuleScore: selected.scoreBreakdown,
      },
    };
  }

  const generation = generateTeamPairingCandidates({
    players: input.players,
    teamSize: input.context?.teamSize ?? 2,
    seed: input.seed ?? input.context?.seed ?? 1,
    maxCandidates: input.maxCandidates ?? 64,
    maxIterations: input.maxIterations ?? 128,
    mixedDoubles: input.mixedDoubles === true,
  });

  const evaluated = [];
  const rejectedSamples = [];

  generation.candidates.forEach((candidate) => {
    const scored = evaluatePrivatePairingCandidate(candidate, {
      resolved,
      context: {
        ...(input.context || {}),
        operation: input.context?.operation || PRIVATE_PAIRING_OPERATION.PARTNER_PAIRING,
        playersById:
          input.context?.playersById ||
          Object.fromEntries((input.players || []).map((p) => [String(p.id), p])),
      },
      history: input.history,
    });
    evaluated.push(scored);
    if (!scored.feasible && rejectedSamples.length < 20) {
      rejectedSamples.push({
        id: scored.id,
        codes: scored.rejectionCodes,
      });
    }
  });

  const feasible = sortCandidatesByOptimizationRank(
    evaluated.filter((item) => item.feasible)
  );
  const rejectedCandidateCount = evaluated.length - feasible.length;
  const elapsedMs = Date.now() - startedAt;

  if (!feasible.length) {
    const limitReached = generation.truncated;
    return {
      ok: false,
      errorCode: limitReached
        ? PRIVATE_PAIRING_RUNTIME_CODE.PAIRING_SEARCH_LIMIT_REACHED
        : PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING,
      selectedCandidate: null,
      rejectedCandidateCount,
      hardConstraintsApplied: hard.map((r) => ({
        ruleId: r.id,
        constraintType: r.constraintType,
      })),
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      balanceScore: 0,
      fairnessScore: 0,
      historyScore: 0,
      constraintScore: 0,
      finalScore: 0,
      ruleSetVersion: resolved.ruleSetVersion,
      warnings: resolved.warnings,
      rejectedSamples,
      meta: {
        runtimeEnabled: true,
        runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
        candidateCount: generation.candidates.length,
        iterations: generation.iterations,
        truncated: generation.truncated,
        elapsedMs,
        blockedByPolicyCount: resolved.blockedByPolicy.length,
        ruleResolution: resolved.ruleResolution,
      },
    };
  }

  const selected = feasible[0];
  return {
    ok: true,
    errorCode: null,
    selectedCandidate: selected,
    rejectedCandidateCount,
    hardConstraintsApplied: hard.map((r) => ({
      ruleId: r.id,
      constraintType: r.constraintType,
    })),
    softConstraintsSatisfied: selected.softConstraintsSatisfied,
    softConstraintsMissed: selected.softConstraintsMissed,
    balanceScore: selected.balanceScore,
    fairnessScore: selected.fairnessScore,
    historyScore: selected.historyScore,
    constraintScore: selected.constraintScore,
    finalScore: selected.finalScore,
    scoreBreakdown: selected.scoreBreakdown,
    optimizationRuleScore: selected.scoreBreakdown,
    ruleSetVersion: resolved.ruleSetVersion,
    warnings: resolved.warnings,
    rejectedSamples,
    meta: {
      runtimeEnabled: true,
      runtimeVersion: PRIVATE_PAIRING_RUNTIME_VERSION,
      candidateCount: generation.candidates.length,
      iterations: generation.iterations,
      truncated: generation.truncated,
      elapsedMs,
      blockedByPolicyCount: resolved.blockedByPolicy.length,
      ruleResolution: resolved.ruleResolution,
      scoreBreakdown: selected.scoreBreakdown,
      optimizationRuleScore: selected.scoreBreakdown,
    },
  };
}

/**
 * Evaluate a match option (teamA vs teamB) for AI pairing hard/soft private rules.
 * When runtime flags OFF, returns { enabled:false, rejected:false }.
 */
export function evaluatePrivatePairingMatchOption(matchOption, options = {}) {
  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return {
      enabled: false,
      rejected: false,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [],
      ruleSetVersion: "legacy",
    };
  }

  const resolved = resolveActivePrivatePairingRules({
    rules: options.rules,
    legacyConstraints: options.legacyConstraints,
    context: options.context,
  });

  if (!resolved.ok && resolved.fatalConflicts.length) {
    return {
      enabled: true,
      rejected: true,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT],
      ruleSetVersion: resolved.ruleSetVersion,
      fatalConflicts: resolved.fatalConflicts,
    };
  }

  if (
    isRestrictedCompetitionClass(options.context?.competitionClass) &&
    (resolved.blockedByPolicy || []).length > 0
  ) {
    return {
      enabled: true,
      rejected: true,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY],
      ruleSetVersion: resolved.ruleSetVersion,
      blockedByPolicy: resolved.blockedByPolicy,
    };
  }

  const candidate = {
    id: options.candidateId || "match",
    matchOption,
    teams: [
      { members: matchOption.teamA || [] },
      { members: matchOption.teamB || [] },
    ],
  };

  const scored = evaluatePrivatePairingCandidate(candidate, {
    resolved,
    context: options.context,
    history: options.history,
  });

  return {
    enabled: true,
    rejected: !scored.feasible,
    constraintScore: scored.feasible ? scored.constraintScore : 0,
    softConstraintsSatisfied: scored.softConstraintsSatisfied,
    softConstraintsMissed: scored.softConstraintsMissed,
    rejectionCodes: scored.rejectionCodes,
    ruleSetVersion: resolved.ruleSetVersion,
    balanceScore: scored.balanceScore,
    fairnessScore: scored.fairnessScore,
    historyScore: scored.historyScore,
    finalScore: scored.finalScore,
  };
}
