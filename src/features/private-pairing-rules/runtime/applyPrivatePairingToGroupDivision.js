import { COMPETITION_CLASS } from "../constants/enums.js";
import { assignGroupsWithConstraints } from "../../pairing-constraints/engines/constraintGroupEngine.js";
import { assignEntriesToGroupsSnake } from "../../../tournament/engines/seededGroupEngine.js";
import { createSeededRng, seededShuffle } from "./seededRng.js";
import { resolveActivePrivatePairingRules, splitHardAndSoftRules } from "./resolveActiveRules.js";
import { evaluatePrivatePairingCandidate } from "./runPrivatePairingRuntime.js";
import { filterRulesForGroupStage } from "./stageRuleFilters.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { PRIVATE_PAIRING_OPERATION } from "./privatePairingSource.js";
import { gateResolvedForStage } from "./stageRuntimeGate.js";
import { sortCandidatesByOptimizationRank } from "./optimizationCandidateComparator.js";
import { runGroupDrawGlobalOptimizer } from "../../competition-optimizer/group-draw/groupDrawGlobalOptimizer.js";

function groupsSignature(groups = []) {
  return groups
    .map((group) => {
      const entryIds = (group.entryIds || group.entries?.map((e) => e.id) || [])
        .map(String)
        .sort()
        .join(",");
      return `${group.label || group.name || group.id}:${entryIds}`;
    })
    .sort()
    .join("|");
}

function mapDifferentGroupRulesToLegacy(rules = []) {
  return (rules || [])
    .filter((rule) => rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP)
    .map((rule) => ({
      id: rule.id,
      type: "avoid_same_group",
      mode: rule.severity === "hard" ? "hard" : "soft",
      anchorPlayerId: rule.primaryPlayerId,
      targetPlayerIds: [...(rule.targetPlayerIds || [])],
      enabled: true,
    }));
}

function scoreGroupPlan(groups, hardRules, softRules, resolved = null, context = {}, extra = {}) {
  const candidate = { id: groupsSignature(groups), groups };
  const evaluated = evaluatePrivatePairingCandidate(candidate, {
    resolved: resolved
      ? {
          ...resolved,
          hardRules: hardRules,
          softRules: softRules,
          rules: [...hardRules, ...softRules],
        }
      : undefined,
    rules: [...hardRules, ...softRules],
    context: {
      ...context,
      operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
    },
    openBalanceScore: extra.openBalanceScore,
  });
  if (!evaluated.feasible) {
    return {
      feasible: false,
      groups,
      rejectionCodes: evaluated.rejectionCodes,
      constraintScore: Number.NEGATIVE_INFINITY,
      scoreBreakdown: evaluated.scoreBreakdown,
    };
  }
  return {
    feasible: true,
    groups,
    rejectionCodes: [],
    constraintScore: evaluated.constraintScore,
    scoreBreakdown: evaluated.scoreBreakdown,
    optimizationRuleScore: evaluated.scoreBreakdown,
    softConstraintsSatisfied: evaluated.softConstraintsSatisfied,
    softConstraintsMissed: evaluated.softConstraintsMissed,
  };
}

/**
 * Assign entries to groups with canonical private group rules when runtime flags are ON.
 * Flags OFF → legacy assignGroupsWithConstraints only.
 *
 * @param {Array} entries
 * @param {number} groupCount
 * @param {Array} players
 * @param {Object} [options]
 */
export function assignGroupsWithPrivatePairingRules(
  entries = [],
  groupCount = 4,
  players = [],
  options = {}
) {
  const pairingConstraints = options.pairingConstraints || options.constraints || [];

  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    const legacy = assignGroupsWithConstraints(
      entries,
      groupCount,
      players,
      pairingConstraints
    );
    return {
      ...legacy,
      ok: legacy.ok !== false,
      privatePairingError: null,
      usedCanonicalGroupRules: false,
    };
  }

  const competitionClass = options.competitionClass || COMPETITION_CLASS.INTERNAL;
  const context = {
    clubId: options.clubId || null,
    tournamentId: options.tournamentId || null,
    eventId: options.eventId || null,
    competitionClass,
    allowedByPublishedRules: options.allowedByPublishedRules === true,
    contextTime: options.contextTime,
    operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
  };

  const resolved = resolveActivePrivatePairingRules({
    rules: options.privatePairingRules || [],
    legacyConstraints: pairingConstraints,
    context,
  });

  const gate = gateResolvedForStage(resolved, competitionClass);
  if (!gate.ok) {
    return {
      ok: false,
      groups: [],
      warnings: [],
      privatePairingError: gate.error,
      usedCanonicalGroupRules: true,
    };
  }

  const stageRules = filterRulesForGroupStage(resolved.rules || []);
  const hard = filterRulesForGroupStage(
    resolved.hardRules || splitHardAndSoftRules(resolved.rules).hard
  );
  const soft = filterRulesForGroupStage(
    resolved.softRules || splitHardAndSoftRules(resolved.rules).soft
  );

  const legacyGroupConstraints = [
    ...pairingConstraints.filter((item) => item?.type === "avoid_same_group"),
    ...mapDifferentGroupRulesToLegacy(stageRules),
  ];

  if (hard.length === 0 && soft.length === 0 && legacyGroupConstraints.length === 0) {
    const legacy = assignGroupsWithConstraints(
      entries,
      groupCount,
      players,
      pairingConstraints
    );
    return {
      ...legacy,
      ok: legacy.ok !== false,
      privatePairingError: null,
      usedCanonicalGroupRules: true,
    };
  }

  const rng = createSeededRng(options.seed ?? 1);
  const seen = new Set();
  /** @type {Array<{groups: Array, warnings?: string[]}>} */
  const rawPlans = [];

  const pushPlan = (plan) => {
    if (!plan?.groups?.length) return;
    const key = groupsSignature(plan.groups);
    if (seen.has(key)) return;
    seen.add(key);
    rawPlans.push(plan);
  };

  pushPlan(assignGroupsWithConstraints(entries, groupCount, players, legacyGroupConstraints));
  pushPlan({
    groups: assignEntriesToGroupsSnake(entries, groupCount, players),
    warnings: [],
  });

  const maxCandidates = Math.max(4, Number(options.maxCandidates) || 16);
  for (let i = 0; i < maxCandidates - 2; i += 1) {
    const shuffled = seededShuffle([...entries], rng);
    const base = assignEntriesToGroupsSnake(shuffled, groupCount, players);
    pushPlan(assignGroupsWithConstraints(shuffled, groupCount, players, legacyGroupConstraints));
    pushPlan({ groups: base, warnings: [] });
  }

  if (options.useGlobalOptimizer !== false) {
    const entryById = new Map((entries || []).map((entry) => [String(entry.id), entry]));
    const pseudoTeams = (entries || []).map((entry) => ({
      id: String(entry.id),
      playerIds: (entry.playerIds || entry.members || [entry.playerId || entry.id])
        .map((value) => String(typeof value === "object" ? value.id : value))
        .filter(Boolean),
      avgLevel: Number(entry.avgLevel ?? entry.rating ?? entry.level) || 0,
    }));
    const baselinePlans = rawPlans.map((plan) => ({
      groups: plan.groups.map((group) => ({
        id: group.id,
        name: group.name || group.label,
        teamIds: (group.entryIds || group.entries?.map((entry) => entry.id) || []).map(String),
      })),
    }));
    const optimized = runGroupDrawGlobalOptimizer({
      teams: pseudoTeams,
      groupCount,
      baselinePlans,
      formationResolved: { ...resolved, rules: stageRules, hardRules: hard, softRules: soft },
      context,
      seed: options.seed ?? 1,
      budget: options.optimizationBudget,
    });
    if (optimized.ok && optimized.bestCandidate) {
      const groups = optimized.bestCandidate.groups.map((group) => ({
        ...group,
        entryIds: [...group.teamIds],
        entries: group.teamIds.map((id) => entryById.get(String(id))).filter(Boolean),
      }));
      return {
        ok: true, groups, warnings: [], privatePairingError: null,
        usedCanonicalGroupRules: true,
        constraintScore: optimized.bestCandidate.constraintScore,
        scoreBreakdown: optimized.bestCandidate.scoreBreakdown,
        optimizationRuleScore: optimized.bestCandidate.scoreBreakdown,
        softConstraintsSatisfied: optimized.bestCandidate.softConstraintsSatisfied,
        softConstraintsMissed: optimized.bestCandidate.softConstraintsMissed,
        ruleResolution: resolved.ruleResolution,
        optimizer: optimized,
      };
    }
  }

  const scored = rawPlans
    .map((plan) => ({
      ...scoreGroupPlan(plan.groups, hard, soft, resolved, context),
      warnings: plan.warnings || [],
    }))
    .filter((item) => item.feasible);

  if (!scored.length) {
    return {
      ok: false,
      groups: [],
      warnings: [],
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN,
      }),
      usedCanonicalGroupRules: true,
    };
  }

  const ranked = sortCandidatesByOptimizationRank(scored);
  const best = ranked[0];
  return {
    ok: true,
    groups: best.groups,
    warnings: [...new Set(best.warnings || [])],
    privatePairingError: null,
    usedCanonicalGroupRules: true,
    constraintScore: best.constraintScore,
    scoreBreakdown: best.scoreBreakdown,
    optimizationRuleScore: best.scoreBreakdown,
    softConstraintsSatisfied: best.softConstraintsSatisfied,
    softConstraintsMissed: best.softConstraintsMissed,
    ruleResolution: resolved.ruleResolution,
  };
}

export { mapDifferentGroupRulesToLegacy, scoreGroupPlan };
