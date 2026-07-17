import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  MLP4_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
  OPTIMIZATION_STOP_REASON,
} from "../core/optimizationTypes.js";
import { teamFormationSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import {
  generateMlpFourInitialCandidates,
  splitPoolByGender,
} from "./mlpFourCandidateGenerator.js";
import { mutateMlpFourCandidate } from "./mlpFourCandidateMutations.js";
import {
  assertMlpFourPoolCapacity,
  bucketsToTeamPayload,
  validateMlpFourStructure,
} from "./mlpFourConstraints.js";
import {
  computeMlpFourBalanceMetrics,
  computeMlpFourDefaultPenalty,
  computeTeammateHistoryPenalty,
} from "./mlpFourScoring.js";

/**
 * Run MLP 4 Global Optimizer.
 *
 * @param {object} input
 * @param {object[]} input.players
 * @param {number} input.teamCount — exact required team count (no silent shrink)
 * @param {string[]} [input.teamNames]
 * @param {string|number} [input.randomSeed]
 * @param {Function} [input.fourStepBuilder] — buildMlpTeamsFourStep
 * @param {object} [input.formationResolved] — resolveActivePrivatePairingRules result
 * @param {object} [input.context]
 * @param {object} [input.pairingHistory]
 * @param {object} [input.budget]
 * @param {boolean} [input.privatePairingEnabled]
 */
export function runMlpFourGlobalOptimizer(input = {}) {
  const teamCount = Math.max(1, Number(input.teamCount) || 0);
  const teamNames = Array.isArray(input.teamNames) ? input.teamNames : [];
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const players = Array.isArray(input.players) ? input.players : [];
  const playersById =
    input.playersById ||
    Object.fromEntries(players.map((p) => [String(p.id), p]));

  const { males, females, unknown } = splitPoolByGender(players);
  const capacity = assertMlpFourPoolCapacity({
    males,
    females,
    unknown,
    teamCount,
  });
  if (!capacity.ok) {
    return {
      ok: false,
      errorCodes: capacity.codes,
      bestCandidate: null,
      scoreBreakdown: null,
      randomSeed: String(randomSeed),
      algorithmVersion: MLP4_GLOBAL_ALGORITHM_VERSION,
      diagnostics: {
        initialCandidateCount: 0,
        uniqueCandidateCount: 0,
        evaluatedCandidateCount: 0,
        acceptedMoveCount: 0,
        improvedMoveCount: 0,
        rejectedHardViolationCount: 0,
        durationMs: 0,
        stoppedBy: OPTIMIZATION_STOP_REASON.NO_FEASIBLE,
      },
      ruleResolution: input.formationResolved?.ruleResolution || null,
    };
  }

  const malePool = males.slice(0, teamCount * 2);
  const femalePool = females.slice(0, teamCount * 2);
  const budget = resolveOptimizationBudget(
    OPTIMIZATION_OPERATION.TEAM_FORMATION,
    input.budget
  );

  const evaluateRaw = (raw) => {
    const teams = (raw?.teams || []).map((team) => ({
      ...team,
      playerIds: [...(team.playerIds || [])].map(String),
      members: (team.members && team.members.length
        ? team.members
        : (team.playerIds || []).map((id) => playersById[String(id)]).filter(Boolean)
      ),
    }));

    const structural = validateMlpFourStructure(teams, {
      expectedTeamCount: teamCount,
      playersById,
    });

    let privateEval = {
      feasible: structural.ok,
      rejectionCodes: [...structural.codes],
      scoreBreakdown: buildScoreBreakdown({}),
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      constraintScore: 0,
      balanceScore: 0,
    };

    if (structural.ok && input.privatePairingEnabled !== false && input.formationResolved) {
      privateEval = evaluatePrivatePairingCandidate(
        {
          id: raw?.id || "mlp4-cand",
          teams,
        },
        {
          resolved: input.formationResolved,
          context: {
            ...(input.context || {}),
            operation: OPTIMIZATION_OPERATION.TEAM_FORMATION,
            playersById,
            teamSize: 4,
          },
          history: input.pairingHistory || {},
        }
      );
    } else if (!structural.ok) {
      privateEval = {
        ...privateEval,
        feasible: false,
        hardViolationCount: structural.hardViolationCount,
      };
    }

    const metrics = computeMlpFourBalanceMetrics(teams, playersById);
    const historyPenalty = computeTeammateHistoryPenalty(
      teams,
      input.pairingHistory
    );
    const defaultPenalty = computeMlpFourDefaultPenalty(metrics, historyPenalty);
    const authoritySoft = privateEval.scoreBreakdown || buildScoreBreakdown({});
    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: {
        SUPER_ADMIN: authoritySoft.superAdminPenalty,
        TOURNAMENT: authoritySoft.tournamentPenalty,
        CLUB: authoritySoft.clubPenalty,
        SESSION: authoritySoft.sessionPenalty,
      },
      defaultPenalty,
    });

    const hardViolationCount = Math.max(
      structural.hardViolationCount,
      privateEval.feasible === false
        ? (privateEval.rejectionCodes || []).length || 1
        : 0
    );
    const feasible = structural.ok && privateEval.feasible !== false;

    const idSeed = teamFormationSignature(teams);
    return {
      id: `mlp4:${raw?.strategy || "mut"}:${idSeed}`,
      signature: idSeed,
      strategy: raw?.strategy || "unknown",
      feasible,
      hardViolationCount,
      rejectionCodes: [
        ...structural.codes,
        ...(privateEval.rejectionCodes || []),
      ],
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
      diagnostics: {
        ...metrics,
        historyPenalty,
        strategy: raw?.strategy || null,
      },
      teams,
      softConstraintsSatisfied: privateEval.softConstraintsSatisfied,
      softConstraintsMissed: privateEval.softConstraintsMissed,
      constraintScore: privateEval.constraintScore,
      balanceScore: privateEval.balanceScore,
      formationQuality: Math.max(0, 100 - metrics.teamAverageRange * 100),
    };
  };

  // Baseline four-step for not-worse guarantee
  let baselineEvaluated = null;
  if (typeof input.fourStepBuilder === "function") {
    const baselineBuckets = input.fourStepBuilder({
      males: malePool,
      females: femalePool,
      teamCount,
      randomFn: createSeededRng(`${randomSeed}:baseline`),
    });
    baselineEvaluated = evaluateRaw({
      strategy: "four_step_baseline",
      teams: bucketsToTeamPayload(baselineBuckets, teamNames),
    });
  }

  if (budget.maxInitialCandidates === 0 && budget.maxEvaluations === 0) {
    return {
      ok: Boolean(baselineEvaluated?.feasible),
      bestCandidate: baselineEvaluated,
      scoreBreakdown: baselineEvaluated?.scoreBreakdown || null,
      randomSeed: String(randomSeed),
      algorithmVersion: MLP4_GLOBAL_ALGORITHM_VERSION,
      diagnostics: {
        initialCandidateCount: baselineEvaluated ? 1 : 0,
        uniqueCandidateCount: baselineEvaluated ? 1 : 0,
        evaluatedCandidateCount: baselineEvaluated ? 1 : 0,
        acceptedMoveCount: 0,
        improvedMoveCount: 0,
        rejectedHardViolationCount: baselineEvaluated?.feasible ? 0 : 1,
        durationMs: 0,
        stoppedBy: OPTIMIZATION_STOP_REASON.BUDGET_ZERO,
      },
      ruleResolution: input.formationResolved?.ruleResolution || null,
      baseline: baselineEvaluated,
    };
  }

  const { bestCandidate, diagnostics } = runGlobalSearch({
    generateInitial: () =>
      generateMlpFourInitialCandidates({
        males: malePool,
        females: femalePool,
        teamCount,
        teamNames,
        rng,
        fourStepBuilder: input.fourStepBuilder,
        maxCandidates: budget.maxInitialCandidates,
      }),
    evaluate: evaluateRaw,
    mutate: (current, mutateRng) =>
      mutateMlpFourCandidate(current, playersById, mutateRng),
    rng,
    budget,
    baselineEvaluated,
  });

  const authority = bestCandidate ? toAuthorityScore(bestCandidate) : null;

  return {
    ok: Boolean(bestCandidate?.feasible),
    bestCandidate,
    scoreBreakdown: bestCandidate?.scoreBreakdown || null,
    authorityScore: authority,
    randomSeed: String(randomSeed),
    algorithmVersion: MLP4_GLOBAL_ALGORITHM_VERSION,
    diagnostics,
    ruleResolution: input.formationResolved?.ruleResolution || null,
    baseline: baselineEvaluated,
  };
}
