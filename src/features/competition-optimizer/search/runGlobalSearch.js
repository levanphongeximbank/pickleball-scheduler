import { OPTIMIZATION_STOP_REASON } from "../core/optimizationTypes.js";
import {
  compareAuthorityCandidates,
  isStrictlyBetterCandidate,
} from "../core/candidateAuthorityComparator.js";
import {
  createOptimizationDiagnostics,
  finalizeDiagnostics,
} from "../core/optimizationDiagnostics.js";
import { createCandidateDeduper } from "./candidateDeduplication.js";

/**
 * Multi-start global search with local mutations + optional simulated annealing.
 *
 * Boundaries:
 * - `generateInitial` produces raw candidates (must not mutate input)
 * - `evaluate` returns scored candidate with feasible / scoreBreakdown / id / signature
 * - `mutate` yields neighbor candidates from current
 * - Ranking uses authority comparator only
 *
 * @param {object} args
 * @param {() => Iterable|Array} args.generateInitial
 * @param {(candidate: object) => object} args.evaluate
 * @param {(candidate: object, rng: Function, iteration: number) => object|null} args.mutate
 * @param {() => number} args.rng
 * @param {import('../core/optimizationTypes.js').OptimizationBudget} args.budget
 * @param {object} [args.baselineEvaluated] — if provided, final best must not be worse
 * @param {number} [args.annealingStartTemp=1]
 */
export function runGlobalSearch({
  generateInitial,
  evaluate,
  mutate,
  rng,
  budget,
  baselineEvaluated = null,
  annealingStartTemp = 1,
} = {}) {
  const startedAt = Date.now();
  const diagnostics = createOptimizationDiagnostics();
  const deduper = createCandidateDeduper();

  let best = null;
  let current = null;
  let stagnant = 0;
  let stoppedBy = OPTIMIZATION_STOP_REASON.NO_FEASIBLE;
  let iteration = 0;

  const exhausted = () => {
    if (
      budget.maxDurationMs > 0 &&
      Date.now() - startedAt >= budget.maxDurationMs
    ) {
      return OPTIMIZATION_STOP_REASON.MAX_DURATION;
    }
    if (
      budget.maxEvaluations > 0 &&
      diagnostics.evaluatedCandidateCount >= budget.maxEvaluations
    ) {
      return OPTIMIZATION_STOP_REASON.MAX_EVALUATIONS;
    }
    if (
      budget.maxIterations > 0 &&
      iteration >= budget.maxIterations
    ) {
      return OPTIMIZATION_STOP_REASON.MAX_ITERATIONS;
    }
    if (
      budget.stagnationLimit > 0 &&
      stagnant >= budget.stagnationLimit
    ) {
      return OPTIMIZATION_STOP_REASON.STAGNATION;
    }
    return null;
  };

  const consider = (raw, { countAsAccepted = false } = {}) => {
    if (!raw) return null;
    const stop = exhausted();
    if (stop) {
      stoppedBy = stop;
      return null;
    }

    const evaluated = evaluate(raw);
    diagnostics.evaluatedCandidateCount += 1;

    const signature =
      evaluated?.signature ||
      evaluated?.id ||
      JSON.stringify(evaluated?.playerIds || evaluated?.teams || evaluated);

    if (!deduper.add(signature)) {
      return null;
    }
    diagnostics.uniqueCandidateCount = deduper.size();

    if (!evaluated?.feasible) {
      diagnostics.rejectedHardViolationCount += 1;
      return evaluated;
    }

    if (!best || isStrictlyBetterCandidate(evaluated, best)) {
      best = evaluated;
      stagnant = 0;
      diagnostics.improvedMoveCount += 1;
      if (countAsAccepted) diagnostics.acceptedMoveCount += 1;
    } else {
      stagnant += 1;
    }

    if (
      !current ||
      isStrictlyBetterCandidate(evaluated, current) ||
      shouldAcceptAnnealing(evaluated, current, rng, iteration, annealingStartTemp)
    ) {
      current = evaluated;
      if (countAsAccepted) diagnostics.acceptedMoveCount += 1;
    }

    return evaluated;
  };

  // --- Initial population ---
  const initialList = [];
  const generated = generateInitial?.() || [];
  for (const item of generated) {
    if (
      budget.maxInitialCandidates > 0 &&
      initialList.length >= budget.maxInitialCandidates
    ) {
      break;
    }
    const stop = exhausted();
    if (stop) {
      stoppedBy = stop;
      break;
    }
    initialList.push(item);
  }
  diagnostics.initialCandidateCount = initialList.length;

  if (budget.maxInitialCandidates === 0 && budget.maxEvaluations === 0) {
    // Controlled fallback: only evaluate baseline if provided as first generate item
    stoppedBy = OPTIMIZATION_STOP_REASON.BUDGET_ZERO;
  }

  for (const raw of initialList) {
    consider(raw);
    const stop = exhausted();
    if (stop) {
      stoppedBy = stop;
      break;
    }
  }

  if (!current && best) current = best;

  // --- Local search / annealing ---
  while (current && typeof mutate === "function") {
    const stop = exhausted();
    if (stop) {
      stoppedBy = stop;
      break;
    }
    iteration += 1;
    const neighbor = mutate(current, rng, iteration);
    if (!neighbor) {
      stagnant += 1;
      continue;
    }
    consider(neighbor, { countAsAccepted: true });
  }

  if (!stoppedBy || stoppedBy === OPTIMIZATION_STOP_REASON.NO_FEASIBLE) {
    if (best?.feasible) {
      // Perfect zero soft/hard may still stop by stagnation/budget; default to target if pristine
      const score = best.scoreBreakdown || {};
      const pristine =
        (best.hardViolationCount || 0) === 0 &&
        (score.superAdminPenalty || 0) === 0 &&
        (score.tournamentPenalty || 0) === 0 &&
        (score.clubPenalty || 0) === 0 &&
        (score.sessionPenalty || 0) === 0 &&
        (score.defaultPenalty || 0) === 0;
      stoppedBy = pristine
        ? OPTIMIZATION_STOP_REASON.TARGET_REACHED
        : exhausted() || OPTIMIZATION_STOP_REASON.STAGNATION;
    }
  }

  // Never return worse than baseline when baseline is feasible
  if (
    baselineEvaluated?.feasible &&
    best &&
    compareAuthorityCandidates(best, baselineEvaluated) > 0
  ) {
    best = baselineEvaluated;
  } else if (!best && baselineEvaluated?.feasible) {
    best = baselineEvaluated;
  }

  return {
    bestCandidate: best,
    diagnostics: finalizeDiagnostics(diagnostics, startedAt, stoppedBy),
  };
}

function shouldAcceptAnnealing(challenger, incumbent, rng, iteration, startTemp) {
  if (!incumbent || !challenger?.feasible) return false;
  if (isStrictlyBetterCandidate(challenger, incumbent)) return true;
  const temp = Math.max(0.01, startTemp / (1 + iteration * 0.02));
  // Accept small regressions with decaying probability (seeded).
  // Use defaultPenalty delta as energy proxy only for SA acceptance — not for ranking.
  const energy =
    Number(challenger.scoreBreakdown?.defaultPenalty || 0) -
    Number(incumbent.scoreBreakdown?.defaultPenalty || 0);
  if (energy <= 0) return true;
  const prob = Math.exp(-energy / (temp * 50));
  return rng() < prob;
}
