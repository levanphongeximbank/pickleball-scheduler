import { COMPETITION_CLASS, RESTRICTED_COMPETITION_CLASSES } from "../constants/enums.js";
import { resolveActivePrivatePairingRules, splitHardAndSoftRules } from "./resolveActiveRules.js";
import { evaluateHardPrivatePairingRules } from "./evaluateHardOnCandidate.js";
import { scoreSoftPrivatePairingRules } from "./scoreSoftOnCandidate.js";
import { filterRulesForOpponentStage } from "./stageRuleFilters.js";
import { buildPrivatePairingRuntimeError } from "./prepareLivePrivatePairingOptions.js";
import {
  PRIVATE_PAIRING_RUNTIME_CODE,
  isPrivatePairingRuntimeEnabled,
} from "./runtimeCodes.js";
import { gateResolvedForStage } from "./stageRuntimeGate.js";

function isRestrictedCompetitionClass(competitionClass) {
  return RESTRICTED_COMPETITION_CLASSES.has(String(competitionClass || "").toUpperCase());
}

/**
 * Build a matchOption from two sides (entry/team member lists).
 * @param {unknown[]} sideA
 * @param {unknown[]} sideB
 */
export function buildMatchOptionFromSides(sideA = [], sideB = []) {
  return {
    teamA: [...(sideA || [])],
    teamB: [...(sideB || [])],
  };
}

/**
 * Evaluate one matchup candidate with opponent-stage rules only.
 *
 * @param {{ teamA?: unknown[], teamB?: unknown[] }} matchOption
 * @param {Object} options
 */
export function evaluateOpponentMatchupCandidate(matchOption, options = {}) {
  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return {
      enabled: false,
      rejected: false,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [],
      usedCanonicalOpponentRules: false,
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
    ...(options.playersById ? { playersById: options.playersById } : {}),
    operation:
      options.operation ||
      options.context?.operation ||
      "MATCHUP_PAIRING",
  };

  const resolved = options.resolved ||
    resolveActivePrivatePairingRules({
      rules: options.privatePairingRules || options.rules || [],
      legacyConstraints: options.legacyConstraints || [],
      context,
    });

  if (!options.resolved) {
    const gate = gateResolvedForStage(resolved, competitionClass);
    if (!gate.ok) {
      return {
        enabled: true,
        rejected: true,
        constraintScore: 0,
        softConstraintsSatisfied: [],
        softConstraintsMissed: [],
        rejectionCodes: [gate.error.code],
        privatePairingError: gate.error,
        usedCanonicalOpponentRules: true,
        fatalConflicts: gate.error.fatalConflicts,
        blockedByPolicy: gate.error.blockedByPolicy,
      };
    }
  } else if (
    (resolved.fatalConflicts || []).length ||
    (isRestrictedCompetitionClass(competitionClass) &&
      (resolved.blockedByPolicy || []).length)
  ) {
    const gate = gateResolvedForStage(resolved, competitionClass);
    return {
      enabled: true,
      rejected: true,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [gate.error?.code || PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT],
      privatePairingError: gate.error,
      usedCanonicalOpponentRules: true,
    };
  }

  const stageRules = filterRulesForOpponentStage(resolved.rules || []);
  const { hard, soft } = splitHardAndSoftRules(stageRules);

  if (!hard.length && !soft.length) {
    return {
      enabled: true,
      rejected: false,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: [],
      usedCanonicalOpponentRules: true,
    };
  }

  const hardResult = evaluateHardPrivatePairingRules({ matchOption }, hard);
  if (!hardResult.feasible) {
    return {
      enabled: true,
      rejected: true,
      constraintScore: 0,
      softConstraintsSatisfied: [],
      softConstraintsMissed: [],
      rejectionCodes: hardResult.violations.map((item) => item.code),
      violations: hardResult.violations,
      usedCanonicalOpponentRules: true,
    };
  }

  const softResult = scoreSoftPrivatePairingRules(
    { matchOption },
    soft,
    options.history || {}
  );

  return {
    enabled: true,
    rejected: false,
    constraintScore: softResult.constraintScore,
    softConstraintsSatisfied: softResult.softConstraintsSatisfied,
    softConstraintsMissed: softResult.softConstraintsMissed,
    rejectionCodes: [],
    usedCanonicalOpponentRules: true,
  };
}

/**
 * Hard-filter + soft-rank matchup candidates. Does not invent random fallbacks.
 *
 * @param {Array} matchups
 * @param {(matchup: Object) => { teamA: unknown[], teamB: unknown[] }|null} toMatchOption
 * @param {Object} [options]
 */
export function filterAndRankMatchupsByOpponentRules(
  matchups = [],
  toMatchOption,
  options = {}
) {
  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return {
      ok: true,
      skipped: true,
      matchups: [...matchups],
      removed: [],
      privatePairingError: null,
      usedCanonicalOpponentRules: false,
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
    operation:
      options.operation ||
      options.context?.operation ||
      "MATCHUP_PAIRING",
  };

  const resolved = resolveActivePrivatePairingRules({
    rules: options.privatePairingRules || options.rules || [],
    legacyConstraints: options.legacyConstraints || [],
    context,
  });

  const gate = gateResolvedForStage(resolved, competitionClass);
  if (!gate.ok) {
    return {
      ok: false,
      matchups: [],
      removed: [],
      privatePairingError: gate.error,
      usedCanonicalOpponentRules: true,
    };
  }

  const stageRules = filterRulesForOpponentStage(resolved.rules || []);
  const { hard, soft } = splitHardAndSoftRules(stageRules);

  if (!hard.length && !soft.length) {
    return {
      ok: true,
      matchups: [...matchups],
      removed: [],
      privatePairingError: null,
      usedCanonicalOpponentRules: true,
    };
  }

  const kept = [];
  const removed = [];

  matchups.forEach((matchup, index) => {
    const matchOption =
      typeof toMatchOption === "function" ? toMatchOption(matchup) : matchup?.matchOption;
    if (!matchOption) {
      kept.push({ matchup, index, constraintScore: 0 });
      return;
    }

    const hardResult = evaluateHardPrivatePairingRules({ matchOption }, hard);
    if (!hardResult.feasible) {
      removed.push({
        matchup,
        index,
        rejectionCodes: hardResult.violations.map((item) => item.code),
      });
      return;
    }

    const softResult = scoreSoftPrivatePairingRules(
      { matchOption },
      soft,
      options.history || {}
    );
    kept.push({
      matchup,
      index,
      constraintScore: softResult.constraintScore,
    });
  });

  if (kept.length === 0 && matchups.length > 0) {
    return {
      ok: false,
      matchups: [],
      removed,
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP,
      }),
      usedCanonicalOpponentRules: true,
    };
  }

  if (options.requireCompleteSet === true && removed.length > 0) {
    return {
      ok: false,
      matchups: [],
      removed,
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP,
      }),
      usedCanonicalOpponentRules: true,
    };
  }

  kept.sort((a, b) => {
    if (a.constraintScore !== b.constraintScore) {
      return b.constraintScore - a.constraintScore;
    }
    return a.index - b.index;
  });

  return {
    ok: true,
    matchups: kept.map((item) => item.matchup),
    ranked: kept,
    removed,
    privatePairingError: null,
    usedCanonicalOpponentRules: true,
  };
}

/**
 * Apply opponent-stage private rules to a fully built group-stage schedule.
 * Soft rules re-order matches; hard violations make the schedule infeasible
 * when requireCompleteSet is true (default for tournament RR).
 *
 * @param {{ groups: Array, matches: Array }} schedule
 * @param {Object} options
 */
export function applyOpponentRulesToGroupStageSchedule(schedule, options = {}) {
  const groups = schedule?.groups || [];
  const matches = schedule?.matches || [];

  if (!isPrivatePairingRuntimeEnabled(options.envSource)) {
    return {
      ok: true,
      skipped: true,
      groups,
      matches,
      privatePairingError: null,
    };
  }

  const playersById = new Map(
    (options.players || []).map((player) => [String(player.id), player])
  );
  const entryMembers = new Map();
  groups.forEach((group) => {
    (group.entries || []).forEach((entry) => {
      const members = (entry.playerIds || [])
        .map((id) => playersById.get(String(id)) || { id })
        .filter(Boolean);
      entryMembers.set(String(entry.id), members);
    });
  });

  const ranked = filterAndRankMatchupsByOpponentRules(
    matches,
    (match) => {
      const sideA = entryMembers.get(String(match.entryAId)) || [];
      const sideB = entryMembers.get(String(match.entryBId)) || [];
      if (!sideA.length && !sideB.length) {
        return null;
      }
      return buildMatchOptionFromSides(sideA, sideB);
    },
    {
      ...options,
      requireCompleteSet: options.requireCompleteSet !== false,
    }
  );

  if (!ranked.ok) {
    return {
      ok: false,
      groups: [],
      matches: [],
      privatePairingError: ranked.privatePairingError,
      removed: ranked.removed,
    };
  }

  // Soft ranking changes priority order; rebuild per-group match lists.
  const matchById = new Map(ranked.matchups.map((match) => [String(match.id), match]));
  const orderedMatches = ranked.matchups;
  const nextGroups = groups.map((group) => ({
    ...group,
    matches: (group.matches || [])
      .map((match) => matchById.get(String(match.id)))
      .filter(Boolean)
      .sort((a, b) => {
        const ai = orderedMatches.findIndex((m) => String(m.id) === String(a.id));
        const bi = orderedMatches.findIndex((m) => String(m.id) === String(b.id));
        return ai - bi;
      }),
  }));

  return {
    ok: true,
    groups: nextGroups,
    matches: orderedMatches,
    privatePairingError: null,
    usedCanonicalOpponentRules: ranked.usedCanonicalOpponentRules,
  };
}
