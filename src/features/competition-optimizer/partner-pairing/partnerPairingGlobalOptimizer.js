import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  OPTIMIZATION_OPERATION,
  PARTNER_PAIRING_GLOBAL_ALGORITHM_VERSION,
} from "../core/optimizationTypes.js";
import { partnerPairingSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generatePartnerPairingInitialCandidates } from "./partnerPairingCandidateGenerator.js";
import { mutatePartnerPairingCandidate } from "./partnerPairingMutations.js";

export function runPartnerPairingGlobalOptimizer(input = {}) {
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const playersById = input.playersById || Object.fromEntries(
    (input.players || []).map((player) => [String(player.id), player])
  );
  const budget = resolveOptimizationBudget(OPTIMIZATION_OPERATION.PARTNER_PAIRING, input.budget);
  const context = {
    ...(input.context || {}),
    operation: OPTIMIZATION_OPERATION.PARTNER_PAIRING,
    playersById,
  };
  const evaluate = (raw) => {
    const teams = (raw.teams || []).map((team) => ({
      ...team,
      playerIds: (team.playerIds || []).map(String),
      members: team.members?.length
        ? team.members
        : (team.playerIds || []).map((id) => playersById[String(id)]).filter(Boolean),
    }));
    const structuralOk = teams.length > 0 && teams.every((team) => team.members.length === 2);
    const evaluated = structuralOk
      ? evaluatePrivatePairingCandidate({ id: raw.id || "partner", teams }, {
          resolved: input.formationResolved,
          rules: input.rules,
          legacyConstraints: input.legacyConstraints,
          context,
          history: input.history,
        })
      : { feasible: false, rejectionCodes: ["INVALID_DOUBLES_STRUCTURE"], scoreBreakdown: {} };
    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: evaluated.penaltyBySource,
      balanceScore: evaluated.balanceScore,
      fairnessScore: evaluated.fairnessScore,
    });
    const signature = partnerPairingSignature(teams);
    return {
      ...evaluated,
      id: `partner:${raw.strategy || "candidate"}:${signature}`,
      signature,
      strategy: raw.strategy,
      teams,
      hardViolationCount: evaluated.feasible ? 0 : Math.max(1, evaluated.rejectionCodes?.length || 0),
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
    };
  };
  const baselineRaw = generatePartnerPairingInitialCandidates({
    ...input, randomSeed, maxCandidates: 1,
  })[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;
  const search = runGlobalSearch({
    generateInitial: () => generatePartnerPairingInitialCandidates({
      ...input, randomSeed, maxCandidates: budget.maxInitialCandidates,
    }),
    evaluate,
    mutate: (current, mutateRng) => mutatePartnerPairingCandidate(current, mutateRng),
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
    algorithmVersion: PARTNER_PAIRING_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution: input.formationResolved?.ruleResolution || null,
    baseline,
  };
}
