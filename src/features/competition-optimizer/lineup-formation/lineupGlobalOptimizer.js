import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  LINEUP_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
} from "../core/optimizationTypes.js";
import { lineupFormationSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generateLineupInitialCandidates } from "./lineupCandidateGenerator.js";
import { mutateLineupCandidate } from "./lineupCandidateMutations.js";
import {
  cloneLineupSelections,
  validateLineupStructure,
} from "./lineupConstraints.js";
import { computeLineupDefaultPenalty } from "./lineupScoring.js";

function selectionsToPrivateTeams(selections, playersById) {
  return Object.entries(selections || {}).map(([disciplineId, playerIds]) => {
    const ids = (playerIds || []).map(String);
    const members = ids
      .map((id) =>
        playersById instanceof Map
          ? playersById.get(id)
          : playersById[id]
      )
      .filter(Boolean);
    return {
      id: disciplineId,
      playerIds: ids,
      members,
    };
  });
}

/**
 * Full Global Optimizer for V6 LINEUP_FORMATION.
 */
export function runLineupGlobalOptimizer(input = {}) {
  const team = input.team;
  const disciplines = input.disciplines || [];
  const playersById =
    input.playersById ||
    Object.fromEntries((input.players || []).map((player) => [String(player.id), player]));
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const budget = resolveOptimizationBudget(
    OPTIMIZATION_OPERATION.LINEUP_FORMATION,
    input.budget
  );
  const allowReuse = input.allowReuse === true;
  const context = {
    ...(input.context || {}),
    operation: OPTIMIZATION_OPERATION.LINEUP_FORMATION,
    playersById,
    teamId: team?.id || input.teamId || null,
    matchupId: input.matchupId || null,
  };

  const evaluate = (raw) => {
    const selections = cloneLineupSelections(raw.selections || {});
    const reuse = raw.allowReuse === true || allowReuse;
    const structural = validateLineupStructure({
      selections,
      disciplines,
      team,
      playersById,
      allowReuse: reuse,
    });

    if (!structural.ok) {
      return {
        feasible: false,
        rejectionCodes: structural.rejectionCodes,
        hardViolationCount: Math.max(1, structural.rejectionCodes.length),
        scoreBreakdown: buildScoreBreakdown({}),
        id: `lineup:invalid:${lineupFormationSignature(selections)}`,
        signature: lineupFormationSignature(selections),
        selections,
        strategy: raw.strategy,
        allowReuse: reuse,
      };
    }

    const teams = selectionsToPrivateTeams(selections, playersById);
    const evaluated = evaluatePrivatePairingCandidate(
      { id: raw.id || "lineup", teams },
      {
        resolved: input.formationResolved || input.resolved,
        rules: input.rules || input.privatePairingRules,
        legacyConstraints: input.legacyConstraints,
        context,
        history: input.history || input.pairingHistory,
      }
    );

    const defaultPenalty = computeLineupDefaultPenalty(selections, playersById, {
      previousSelections: input.previousSelections,
    });

    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: evaluated.penaltyBySource,
      defaultPenalty,
      v6FormatPenalty: Number(input.v6FormatPenalty) || 0,
    });

    const signature = lineupFormationSignature(selections);
    return {
      ...evaluated,
      id: `lineup:${raw.strategy || "candidate"}:${signature}`,
      signature,
      strategy: raw.strategy,
      selections,
      allowReuse: reuse,
      hardViolationCount: evaluated.feasible
        ? 0
        : Math.max(1, evaluated.rejectionCodes?.length || 0),
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
    };
  };

  const generateInitial = () =>
    generateLineupInitialCandidates({
      team,
      disciplines,
      playersById,
      previousSelections: input.previousSelections,
      allowReuse,
      allowReuseFallback: input.allowReuseFallback !== false,
      randomSeed,
      maxCandidates: budget.maxInitialCandidates,
    });

  const baselineRaw = generateInitial()[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;

  const search = runGlobalSearch({
    generateInitial,
    evaluate,
    mutate: (current, mutateRng) =>
      mutateLineupCandidate(current, mutateRng, {
        team,
        allowReuse: current.allowReuse === true || allowReuse,
        disciplines,
        playersById,
      }),
    rng,
    budget,
    baselineEvaluated: baseline,
  });

  return {
    ok: Boolean(search.bestCandidate?.feasible),
    bestCandidate: search.bestCandidate,
    selections: search.bestCandidate?.selections || null,
    scoreBreakdown: search.bestCandidate?.scoreBreakdown || null,
    authorityScore: search.bestCandidate
      ? toAuthorityScore(search.bestCandidate)
      : null,
    randomSeed: String(randomSeed),
    algorithmVersion: LINEUP_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution:
      input.formationResolved?.ruleResolution ||
      input.resolved?.ruleResolution ||
      null,
    baseline,
    rejectionCodes: search.bestCandidate?.feasible
      ? []
      : search.bestCandidate?.rejectionCodes || ["NO_FEASIBLE_LINEUP"],
  };
}
