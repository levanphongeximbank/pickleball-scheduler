import { COMPETITION_CLASS } from "../constants/enums.js";
import { assignGroupsWithConstraints } from "../../pairing-constraints/engines/constraintGroupEngine.js";
import { assignEntriesToGroupsSnake } from "../../../tournament/engines/seededGroupEngine.js";
import { createSeededRng, seededShuffle } from "./seededRng.js";
import { resolveActivePrivatePairingRules, splitHardAndSoftRules } from "./resolveActiveRules.js";
import { evaluateHardPrivatePairingRules } from "./evaluateHardOnCandidate.js";
import { scoreSoftPrivatePairingRules } from "./scoreSoftOnCandidate.js";
import { filterRulesForGroupStage } from "./stageRuleFilters.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { gateResolvedForStage } from "./stageRuntimeGate.js";

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

function scoreGroupPlan(groups, hardRules, softRules) {
  const candidate = { groups };
  const hardResult = evaluateHardPrivatePairingRules(candidate, hardRules);
  if (!hardResult.feasible) {
    return {
      feasible: false,
      groups,
      rejectionCodes: hardResult.violations.map((item) => item.code),
      constraintScore: Number.NEGATIVE_INFINITY,
    };
  }
  const softResult = scoreSoftPrivatePairingRules(candidate, softRules);
  return {
    feasible: true,
    groups,
    rejectionCodes: [],
    constraintScore: softResult.constraintScore,
    softConstraintsSatisfied: softResult.softConstraintsSatisfied,
    softConstraintsMissed: softResult.softConstraintsMissed,
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
  const { hard, soft } = splitHardAndSoftRules(stageRules);

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

  const scored = rawPlans
    .map((plan) => ({
      ...scoreGroupPlan(plan.groups, hard, soft),
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

  scored.sort((a, b) => {
    if (a.constraintScore !== b.constraintScore) {
      return b.constraintScore - a.constraintScore;
    }
    return groupsSignature(a.groups).localeCompare(groupsSignature(b.groups));
  });

  const best = scored[0];
  return {
    ok: true,
    groups: best.groups,
    warnings: [...new Set(best.warnings || [])],
    privatePairingError: null,
    usedCanonicalGroupRules: true,
    constraintScore: best.constraintScore,
    softConstraintsSatisfied: best.softConstraintsSatisfied,
    softConstraintsMissed: best.softConstraintsMissed,
  };
}

export { mapDifferentGroupRulesToLegacy, scoreGroupPlan };
