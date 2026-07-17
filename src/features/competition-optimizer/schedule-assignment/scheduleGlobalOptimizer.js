import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  OPTIMIZATION_OPERATION,
  SCHEDULE_GLOBAL_ALGORITHM_VERSION,
} from "../core/optimizationTypes.js";
import { scheduleAssignmentSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generateScheduleInitialCandidates } from "./scheduleCandidateGenerator.js";
import { mutateScheduleCandidate } from "./scheduleCandidateMutations.js";
import {
  cloneScheduleAssignments,
  slotToScheduledAt,
  validateScheduleStructure,
} from "./scheduleConstraints.js";
import { computeScheduleDefaultPenalty } from "./scheduleScoring.js";

function applyScheduledAt(assignments, baseScheduledAt, roundIntervalMinutes) {
  return assignments.map((row) => ({
    ...row,
    scheduledAt:
      row.scheduledAt ||
      slotToScheduledAt(row.slotIndex, baseScheduledAt, roundIntervalMinutes),
  }));
}

/**
 * Full Global Optimizer for V6 SCHEDULE_ASSIGNMENT.
 */
export function runScheduleGlobalOptimizer(input = {}) {
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const budget = resolveOptimizationBudget(
    OPTIMIZATION_OPERATION.SCHEDULE_ASSIGNMENT,
    input.budget
  );
  const slotCount = Math.max(1, Number(input.slotCount) || 1);
  const baseScheduledAt = input.baseScheduledAt || input.scheduledAt || null;
  const roundIntervalMinutes = Number(input.roundIntervalMinutes) || 90;
  const lockedStatuses = input.lockedStatuses;
  const context = {
    ...(input.context || {}),
    operation: OPTIMIZATION_OPERATION.SCHEDULE_ASSIGNMENT,
  };

  const evaluate = (raw) => {
    let assignments = cloneScheduleAssignments(raw.assignments || []);
    assignments = applyScheduledAt(assignments, baseScheduledAt, roundIntervalMinutes);

    const structural = validateScheduleStructure({
      assignments,
      slotCount,
      lockedStatuses,
      baselineAssignments: input.assignments || input.baselineAssignments,
    });

    if (!structural.ok) {
      return {
        feasible: false,
        rejectionCodes: structural.rejectionCodes,
        hardViolationCount: Math.max(1, structural.rejectionCodes.length),
        scoreBreakdown: buildScoreBreakdown({}),
        id: `schedule:invalid:${scheduleAssignmentSignature(assignments)}`,
        signature: scheduleAssignmentSignature(assignments),
        assignments,
        strategy: raw.strategy,
      };
    }

    const evaluated = evaluatePrivatePairingCandidate(
      { id: raw.id || "schedule", assignments },
      {
        resolved: input.formationResolved || input.resolved,
        rules: input.rules || input.privatePairingRules,
        legacyConstraints: input.legacyConstraints,
        context: { ...context, operation: OPTIMIZATION_OPERATION.SCHEDULE_ASSIGNMENT },
        history: input.history || input.pairingHistory,
      }
    );

    const defaultPenalty = computeScheduleDefaultPenalty(assignments, {
      preferredFirstSlot: input.preferredFirstSlot,
    });

    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: evaluated.penaltyBySource,
      defaultPenalty,
      v6FormatPenalty: Number(input.v6FormatPenalty) || 0,
    });

    const signature = scheduleAssignmentSignature(assignments);
    const feasible = evaluated.feasible !== false;

    return {
      ...evaluated,
      feasible,
      rejectionCodes: feasible ? [] : evaluated.rejectionCodes || [],
      id: `schedule:${raw.strategy || "candidate"}:${signature}`,
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
    generateScheduleInitialCandidates({
      matchups: input.matchups || [],
      assignments: input.assignments || [],
      slotCount,
      baseScheduledAt,
      roundIntervalMinutes,
      lockedStatuses,
      randomSeed,
      maxCandidates: budget.maxInitialCandidates,
    });

  const baselineRaw = generateInitial()[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;

  const search = runGlobalSearch({
    generateInitial,
    evaluate,
    mutate: (current, mutateRng) =>
      mutateScheduleCandidate(current, mutateRng, { slotCount }),
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
    algorithmVersion: SCHEDULE_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution:
      input.formationResolved?.ruleResolution ||
      input.resolved?.ruleResolution ||
      null,
    baseline,
    rejectionCodes: search.bestCandidate?.feasible
      ? []
      : search.bestCandidate?.rejectionCodes || ["NO_FEASIBLE_SCHEDULE"],
  };
}
