import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  GROUP_DRAW_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
} from "../core/optimizationTypes.js";
import { groupDrawSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generateGroupDrawInitialCandidates } from "./groupDrawCandidateGenerator.js";
import { mutateGroupDrawCandidate } from "./groupDrawMutations.js";

function groupsToPrivateCandidate(groups, teamsById) {
  return groups.map((group) => ({
    id: group.id,
    label: group.name,
    playerIds: [...new Set((group.teamIds || []).flatMap((teamId) =>
      teamsById.get(String(teamId))?.playerIds || []
    ).map(String))],
  }));
}

function groupBalancePenalty(groups, teamsById) {
  const averages = groups.map((group) => {
    const levels = (group.teamIds || []).map((id) => Number(teamsById.get(String(id))?.avgLevel) || 0);
    return levels.length ? levels.reduce((sum, value) => sum + value, 0) / levels.length : 0;
  });
  return averages.length ? (Math.max(...averages) - Math.min(...averages)) * 100 : 0;
}

export function runGroupDrawGlobalOptimizer(input = {}) {
  const teams = Array.isArray(input.teams) ? input.teams : [];
  const teamsById = new Map(teams.map((team) => [String(team.id), team]));
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const budget = resolveOptimizationBudget(OPTIMIZATION_OPERATION.GROUP_DRAW, input.budget);
  const context = { ...(input.context || {}), operation: OPTIMIZATION_OPERATION.GROUP_DRAW };
  const evaluate = (raw) => {
    const groups = raw.groups || [];
    const allIds = groups.flatMap((group) => group.teamIds || []).map(String);
    const structural = groups.length > 0 && allIds.length === teams.length &&
      new Set(allIds).size === teams.length && allIds.every((id) => teamsById.has(id));
    const evaluated = structural
      ? evaluatePrivatePairingCandidate(
          { id: raw.id || "group", groups: groupsToPrivateCandidate(groups, teamsById) },
          { resolved: input.formationResolved, rules: input.rules, legacyConstraints: input.legacyConstraints, context, history: input.history }
        )
      : { feasible: false, rejectionCodes: ["INVALID_GROUP_STRUCTURE"], scoreBreakdown: {} };
    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: evaluated.penaltyBySource,
      defaultPenalty: groupBalancePenalty(groups, teamsById),
    });
    const signature = groupDrawSignature(groups);
    return {
      ...evaluated,
      id: `group:${raw.strategy || "candidate"}:${signature}`,
      signature,
      groups,
      strategy: raw.strategy,
      hardViolationCount: evaluated.feasible ? 0 : Math.max(1, evaluated.rejectionCodes?.length || 0),
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
    };
  };
  const initial = () => generateGroupDrawInitialCandidates({
    ...input, randomSeed, maxCandidates: budget.maxInitialCandidates,
  });
  const baselineRaw = initial()[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;
  const search = runGlobalSearch({
    generateInitial: initial,
    evaluate,
    mutate: (current, mutateRng) => mutateGroupDrawCandidate(current, mutateRng),
    rng,
    budget,
    baselineEvaluated: baseline,
  });
  return {
    ok: Boolean(search.bestCandidate?.feasible),
    bestCandidate: search.bestCandidate,
    scoreBreakdown: search.bestCandidate?.scoreBreakdown || null,
    authorityScore: search.bestCandidate ? toAuthorityScore(search.bestCandidate) : null,
    randomSeed: String(randomSeed),
    algorithmVersion: GROUP_DRAW_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution: input.formationResolved?.ruleResolution || null,
    baseline,
  };
}
