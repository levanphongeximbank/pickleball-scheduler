import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  COURT_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
} from "../core/optimizationTypes.js";
import { courtAssignmentSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generateCourtInitialCandidates } from "./courtCandidateGenerator.js";
import { mutateCourtCandidate } from "./courtCandidateMutations.js";
import { cloneCourtAssignments, validateCourtStructure } from "./courtConstraints.js";
import { computeCourtDefaultPenalty } from "./courtScoring.js";

/**
 * Full Global Optimizer for V6 COURT_ASSIGNMENT.
 */
export function runCourtGlobalOptimizer(input = {}) {
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const budget = resolveOptimizationBudget(
    OPTIMIZATION_OPERATION.COURT_ASSIGNMENT,
    input.budget
  );
  const courts = input.courts || [];
  const context = {
    ...(input.context || {}),
    operation: OPTIMIZATION_OPERATION.COURT_ASSIGNMENT,
  };

  const evaluate = (raw) => {
    const assignments = cloneCourtAssignments(raw.assignments || []);
    const structural = validateCourtStructure({
      assignments,
      courts,
      baselineAssignments: input.assignments || input.baselineAssignments,
    });

    if (!structural.ok) {
      return {
        feasible: false,
        rejectionCodes: structural.rejectionCodes,
        hardViolationCount: Math.max(1, structural.rejectionCodes.length),
        scoreBreakdown: buildScoreBreakdown({}),
        id: `court:invalid:${courtAssignmentSignature(assignments)}`,
        signature: courtAssignmentSignature(assignments),
        assignments,
        strategy: raw.strategy,
      };
    }

    const evaluated = evaluatePrivatePairingCandidate(
      { id: raw.id || "court", assignments },
      {
        resolved: input.formationResolved || input.resolved,
        rules: input.rules || input.privatePairingRules,
        legacyConstraints: input.legacyConstraints,
        context: { ...context, operation: OPTIMIZATION_OPERATION.COURT_ASSIGNMENT },
        history: input.history || input.pairingHistory,
      }
    );

    const defaultPenalty = computeCourtDefaultPenalty(assignments, courts, {
      preferCentralForHighStakes: input.preferCentralForHighStakes === true,
    });

    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: evaluated.penaltyBySource,
      defaultPenalty,
      v6FormatPenalty: Number(input.v6FormatPenalty) || 0,
    });

    const signature = courtAssignmentSignature(assignments);
    const feasible = evaluated.feasible !== false;

    return {
      ...evaluated,
      feasible,
      rejectionCodes: feasible ? [] : evaluated.rejectionCodes || [],
      id: `court:${raw.strategy || "candidate"}:${signature}`,
      signature,
      strategy: raw.strategy,
      assignments,
      hardViolationCount: feasible
        ? 0
        : Math.max(1, evaluated.rejectionCodes?.length || 0),
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
    };
  };

  const generateInitial = () =>
    generateCourtInitialCandidates({
      assignments: input.assignments || [],
      matchups: input.matchups || [],
      scheduleAssignments: input.scheduleAssignments || [],
      courts,
      randomSeed,
      maxCandidates: budget.maxInitialCandidates,
    });

  const baselineRaw = generateInitial()[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;

  const search = runGlobalSearch({
    generateInitial,
    evaluate,
    mutate: (current, mutateRng) =>
      mutateCourtCandidate(current, mutateRng, { courts }),
    rng,
    budget,
    baselineEvaluated: baseline,
  });

  return {
    ok: Boolean(search.bestCandidate?.feasible),
    bestCandidate: search.bestCandidate,
    assignments: search.bestCandidate?.assignments || null,
    scoreBreakdown: search.bestCandidate?.scoreBreakdown || null,
    authorityScore: search.bestCandidate
      ? toAuthorityScore(search.bestCandidate)
      : null,
    randomSeed: String(randomSeed),
    algorithmVersion: COURT_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution:
      input.formationResolved?.ruleResolution ||
      input.resolved?.ruleResolution ||
      null,
    baseline,
    rejectionCodes: search.bestCandidate?.feasible
      ? []
      : search.bestCandidate?.rejectionCodes || ["NO_FEASIBLE_COURT_PLAN"],
  };
}
