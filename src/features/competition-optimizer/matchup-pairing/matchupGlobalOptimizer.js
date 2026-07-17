import { buildMatchOptionFromSides } from "../../private-pairing-rules/runtime/applyPrivatePairingToMatchups.js";
import { buildScoreBreakdown } from "../../private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { evaluatePrivatePairingCandidate } from "../../private-pairing-rules/runtime/runPrivatePairingRuntime.js";
import { resolveOptimizationBudget } from "../core/optimizationBudget.js";
import { toAuthorityScore } from "../core/candidateAuthorityComparator.js";
import { createSeededRng } from "../core/seededRandom.js";
import {
  MATCHUP_GLOBAL_ALGORITHM_VERSION,
  OPTIMIZATION_OPERATION,
} from "../core/optimizationTypes.js";
import { matchupPairingSignature } from "../search/candidateDeduplication.js";
import { runGlobalSearch } from "../search/runGlobalSearch.js";
import { generateMatchupInitialCandidates } from "./matchupCandidateGenerator.js";
import { mutateMatchupCandidate } from "./matchupCandidateMutations.js";
import { cloneMatchups, validateMatchupStructure } from "./matchupConstraints.js";
import { computeMatchupDefaultPenalty } from "./matchupScoring.js";

function buildTeamsById(teams = []) {
  const map = {};
  for (const team of teams || []) {
    map[String(team.id)] = team;
  }
  return map;
}

function evaluateMatchupSetPrivateRules(matchups, input, context) {
  const teamsById = buildTeamsById(input.teams);
  const toMatchOption = input.toMatchOption;
  let totalPenaltyBySource = {};
  let rejectionCodes = [];
  let feasible = true;

  for (const matchup of matchups) {
    let matchOption = null;
    if (typeof toMatchOption === "function") {
      matchOption = toMatchOption(matchup);
    } else {
      const teamA = teamsById[String(matchup.teamAId)];
      const teamB = teamsById[String(matchup.teamBId)];
      if (teamA && teamB) {
        const sideA = (teamA.playerIds || []).map((id) => ({ id }));
        const sideB = (teamB.playerIds || []).map((id) => ({ id }));
        matchOption = buildMatchOptionFromSides(sideA, sideB);
      }
    }
    if (!matchOption) continue;

    const evaluated = evaluatePrivatePairingCandidate(
      { id: matchup.id, matchOption },
      {
        resolved: input.formationResolved || input.resolved,
        rules: input.rules || input.privatePairingRules,
        legacyConstraints: input.legacyConstraints,
        context: { ...context, operation: OPTIMIZATION_OPERATION.MATCHUP_PAIRING },
        history: input.history || input.pairingHistory,
      }
    );

    if (!evaluated.feasible) {
      feasible = false;
      rejectionCodes = rejectionCodes.concat(evaluated.rejectionCodes || []);
    }
    const src = evaluated.penaltyBySource || evaluated.scoreBreakdown || {};
    for (const [key, value] of Object.entries(src)) {
      totalPenaltyBySource[key] = (totalPenaltyBySource[key] || 0) + (Number(value) || 0);
    }
  }

  return {
    feasible,
    rejectionCodes: [...new Set(rejectionCodes)],
    penaltyBySource: totalPenaltyBySource,
  };
}

/**
 * Full Global Optimizer for V6 MATCHUP_PAIRING.
 */
export function runMatchupGlobalOptimizer(input = {}) {
  const randomSeed = input.randomSeed ?? input.seed ?? 1;
  const rng = createSeededRng(randomSeed);
  const budget = resolveOptimizationBudget(
    OPTIMIZATION_OPERATION.MATCHUP_PAIRING,
    input.budget
  );
  const allowRematch = input.allowRematch === true;
  const teamsById = buildTeamsById(input.teams);
  const context = {
    ...(input.context || {}),
    operation: OPTIMIZATION_OPERATION.MATCHUP_PAIRING,
    clubId: input.clubId || input.context?.clubId || null,
    tournamentId: input.tournamentId || input.context?.tournamentId || null,
  };

  const evaluate = (raw) => {
    const matchups = cloneMatchups(raw.matchups || []);
    const structural = validateMatchupStructure({
      matchups,
      allowRematch,
      baselineMatchups: input.matchups || input.baselineMatchups,
      lockedMatchupIds: input.lockedMatchupIds,
    });

    if (!structural.ok) {
      return {
        feasible: false,
        rejectionCodes: structural.rejectionCodes,
        hardViolationCount: Math.max(1, structural.rejectionCodes.length),
        scoreBreakdown: buildScoreBreakdown({}),
        id: `matchup:invalid:${matchupPairingSignature(matchups)}`,
        signature: matchupPairingSignature(matchups),
        matchups,
        strategy: raw.strategy,
      };
    }

    const privateEval = evaluateMatchupSetPrivateRules(matchups, input, context);
    const defaultPenalty = computeMatchupDefaultPenalty(matchups, teamsById, {
      homeTeamIds: input.homeTeamIds,
    });

    const scoreBreakdown = buildScoreBreakdown({
      penaltyBySource: privateEval.penaltyBySource,
      defaultPenalty,
      v6FormatPenalty: Number(input.v6FormatPenalty) || 0,
    });

    const signature = matchupPairingSignature(matchups);
    const feasible = privateEval.feasible;

    return {
      feasible,
      rejectionCodes: feasible ? [] : privateEval.rejectionCodes,
      id: `matchup:${raw.strategy || "candidate"}:${signature}`,
      signature,
      strategy: raw.strategy,
      matchups,
      hardViolationCount: feasible
        ? 0
        : Math.max(1, privateEval.rejectionCodes?.length || 0),
      scoreBreakdown,
      optimizationRuleScore: scoreBreakdown,
    };
  };

  const teamIds =
    input.teamIds ||
    [...new Set((input.matchups || []).flatMap((m) => [m.teamAId, m.teamBId]))];

  const generateInitial = () =>
    generateMatchupInitialCandidates({
      matchups: input.matchups || [],
      teamIds,
      groupId: input.groupId || "",
      allowRematch,
      lockedMatchupIds: input.lockedMatchupIds,
      randomSeed,
      maxCandidates: budget.maxInitialCandidates,
    });

  const baselineRaw = generateInitial()[0];
  const baseline = baselineRaw ? evaluate(baselineRaw) : null;

  const search = runGlobalSearch({
    generateInitial,
    evaluate,
    mutate: (current, mutateRng) =>
      mutateMatchupCandidate(current, mutateRng, {
        lockedMatchupIds: input.lockedMatchupIds,
      }),
    rng,
    budget,
    baselineEvaluated: baseline,
  });

  return {
    ok: Boolean(search.bestCandidate?.feasible),
    bestCandidate: search.bestCandidate,
    matchups: search.bestCandidate?.matchups || null,
    scoreBreakdown: search.bestCandidate?.scoreBreakdown || null,
    authorityScore: search.bestCandidate
      ? toAuthorityScore(search.bestCandidate)
      : null,
    randomSeed: String(randomSeed),
    algorithmVersion: MATCHUP_GLOBAL_ALGORITHM_VERSION,
    diagnostics: search.diagnostics,
    ruleResolution:
      input.formationResolved?.ruleResolution ||
      input.resolved?.ruleResolution ||
      null,
    baseline,
    rejectionCodes: search.bestCandidate?.feasible
      ? []
      : search.bestCandidate?.rejectionCodes || ["NO_FEASIBLE_MATCHUP_PLAN"],
  };
}
