import { COMPETITION_CLASS } from "../constants/enums.js";
import { resolveActivePrivatePairingRules, splitHardAndSoftRules } from "./resolveActiveRules.js";
import { filterRulesForGroupStage } from "./stageRuleFilters.js";
import { gateResolvedForStage } from "./stageRuntimeGate.js";
import { scoreGroupPlan } from "./applyPrivatePairingToGroupDivision.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { createSeededRng } from "./seededRng.js";
import { PRIVATE_PAIRING_OPERATION } from "./privatePairingSource.js";
import { sortCandidatesByOptimizationRank } from "./optimizationCandidateComparator.js";

function openGroupsSignature(groups = []) {
  return (groups || [])
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

/**
 * Rank Official Open draw candidates against private SAME_GROUP / DIFFERENT_GROUP rules.
 * Does not change Open placement algorithm — only filters/ranks openConditional plans.
 *
 * @param {Object} input
 * @param {Function} input.openAssigner - (entries, groupCount, options) => legacy open result
 * @param {Array} input.entries
 * @param {number} input.groupCount
 * @param {Object} [input.openOptions] - forwarded into openAssigner
 * @param {Array} [input.privatePairingRules]
 * @param {Array} [input.pairingConstraints]
 * @param {string} [input.competitionClass]
 * @param {Record<string, unknown>|null} [input.envSource]
 * @param {number|string} [input.seed]
 * @param {number} [input.maxCandidates]
 * @returns {{ ok: boolean, groups?: Array, warnings?: string[], balance?: unknown, score?: number, privatePairingError?: object|null, usedCanonicalGroupRules?: boolean, constraintScore?: number }}
 */
export function assignOpenGroupsWithPrivatePairingRules({
  openAssigner,
  entries = [],
  groupCount = 4,
  openOptions = {},
  privatePairingRules = [],
  pairingConstraints = [],
  competitionClass = COMPETITION_CLASS.OFFICIAL,
  envSource,
  seed,
  clubId = null,
  tournamentId = null,
  eventId = null,
  allowedByPublishedRules = false,
  contextTime,
  maxCandidates = 12,
} = {}) {
  if (typeof openAssigner !== "function") {
    return {
      ok: false,
      errors: ["Missing openAssigner for Official Open group placement."],
      warnings: [],
      privatePairingError: null,
      usedCanonicalGroupRules: false,
    };
  }

  if (!isPrivatePairingRuntimeEnabled(envSource)) {
    const legacy = openAssigner(entries, groupCount, openOptions);
    return {
      ...legacy,
      ok: legacy?.ok !== false,
      privatePairingError: null,
      usedCanonicalGroupRules: false,
    };
  }

  const resolved = resolveActivePrivatePairingRules({
    rules: privatePairingRules || [],
    legacyConstraints: pairingConstraints || [],
    context: {
      clubId,
      tournamentId,
      eventId,
      competitionClass,
      allowedByPublishedRules: allowedByPublishedRules === true,
      contextTime,
      operation: PRIVATE_PAIRING_OPERATION.GROUP_DRAW,
    },
  });

  const gate = gateResolvedForStage(resolved, competitionClass);
  if (!gate.ok) {
    return {
      ok: false,
      groups: [],
      warnings: [],
      errors: [gate.error?.message || "Private pairing gate failed."],
      privatePairingError: gate.error,
      usedCanonicalGroupRules: true,
    };
  }

  const hard = filterRulesForGroupStage(
    resolved.hardRules || splitHardAndSoftRules(resolved.rules).hard
  );
  const soft = filterRulesForGroupStage(
    resolved.softRules || splitHardAndSoftRules(resolved.rules).soft
  );

  if (!hard.length && !soft.length) {
    const legacy = openAssigner(entries, groupCount, openOptions);
    return {
      ...legacy,
      ok: legacy?.ok !== false,
      privatePairingError: null,
      usedCanonicalGroupRules: true,
    };
  }

  const rng = createSeededRng(seed ?? `${tournamentId || "open"}:${eventId || "draw"}`);
  const seen = new Set();
  const scored = [];
  const attempts = Math.max(4, Number(maxCandidates) || 12);

  for (let i = 0; i < attempts; i += 1) {
    const candidate = openAssigner(entries, groupCount, {
      ...openOptions,
      attempts: Math.max(4, Number(openOptions.attempts) || 8),
      randomFn: rng,
    });
    if (!candidate?.ok || !candidate.groups?.length) {
      continue;
    }
    const key = openGroupsSignature(candidate.groups);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const ranked = scoreGroupPlan(candidate.groups, hard, soft, resolved, {
      clubId,
      tournamentId,
      eventId,
      competitionClass,
    }, {
      openBalanceScore: candidate.score,
    });
    if (!ranked.feasible) {
      continue;
    }
    scored.push({
      ...candidate,
      constraintScore: ranked.constraintScore,
      scoreBreakdown: ranked.scoreBreakdown,
      optimizationRuleScore: ranked.scoreBreakdown,
      softConstraintsSatisfied: ranked.softConstraintsSatisfied,
      softConstraintsMissed: ranked.softConstraintsMissed,
      feasible: ranked.feasible,
      id: openGroupsSignature(candidate.groups),
    });
  }

  if (!scored.length) {
    return {
      ok: false,
      groups: [],
      warnings: [],
      errors: ["Không tìm được phương án chia bảng Open thỏa hard group rules."],
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN,
      }),
      usedCanonicalGroupRules: true,
    };
  }

  const rankedPlans = sortCandidatesByOptimizationRank(scored);
  const best = rankedPlans[0];
  return {
    ok: true,
    groups: best.groups,
    warnings: best.warnings || [],
    balance: best.balance,
    score: best.score,
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
