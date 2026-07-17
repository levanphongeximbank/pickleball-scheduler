/**
 * V6 Team Tournament adapter for the shared Private Pairing Rules pipeline.
 *
 * Does NOT create a parallel resolver / comparator / RNG.
 * All resolve calls go through resolveActivePrivatePairingRules.
 *
 * Coverage note:
 * - TEAM_FORMATION / PARTNER_PAIRING / GROUP_DRAW / LINEUP_FORMATION /
 *   MATCHUP_PAIRING / SCHEDULE_ASSIGNMENT / COURT_ASSIGNMENT use the full
 *   Global Optimizer (multi-start search) via run*GlobalOptimizer entry points.
 * - SEED remains adapter-only (resolver, hard-rule filtering/ranking, seeded RNG,
 *   and audit metadata) until a dedicated Global Optimizer module is wired.
 */

import {
  PRIVATE_PAIRING_OPERATION,
  createSeededRng,
  resolveActivePrivatePairingRules,
  evaluatePrivatePairingCandidate,
  buildScoreBreakdown,
  isPrivatePairingRuntimeEnabled,
} from "../../private-pairing-rules/index.js";
import { createAiDrawRandomSeed as mintSeed } from "../engines/aiDrawSeedAudit.js";

export const V6_PRIVATE_PAIRING_ALGORITHM_VERSION = "v6-private-pairing-adapter-v1";

export const V6_OPTIMIZATION_ACTION = Object.freeze({
  INITIAL_GENERATE: "INITIAL_GENERATE",
  USER_REARRANGE: "USER_REARRANGE",
  AUTO_DEADLINE_GENERATE: "AUTO_DEADLINE_GENERATE",
  MANUAL_OVERRIDE: "MANUAL_OVERRIDE",
  RESTORE: "RESTORE",
});

/**
 * Build ResolveContext from real V6 business data (no fake IDs).
 *
 * @param {object} input
 * @returns {object}
 */
export function buildV6PrivatePairingResolveContext(input = {}) {
  const operation =
    input.operation ||
    PRIVATE_PAIRING_OPERATION.TEAM_FORMATION;

  return {
    tenantId: input.tenantId ?? null,
    tournamentId: input.tournamentId ?? null,
    clubId: input.clubId ?? null,
    venueId: input.venueId ?? null,
    teamTournamentId: input.teamTournamentId ?? input.tournamentId ?? null,
    teamId: input.teamId ?? null,
    roundId: input.roundId ?? null,
    matchDayId: input.matchDayId ?? null,
    sessionId: input.sessionId ?? null,
    eventId: input.eventId ?? null,
    matchId: input.matchId ?? input.matchupId ?? null,
    competitionClass: input.competitionClass ?? null,
    format: input.format ?? null,
    contentType: input.contentType ?? null,
    operation,
    contextTime: input.contextTime ?? null,
    allowedByPublishedRules: input.allowedByPublishedRules === true,
    playersById: input.playersById || undefined,
    teamSize: input.teamSize,
  };
}

/**
 * Resolve active private pairing rules for a V6 operation using the shared resolver.
 *
 * @param {object} input
 */
export function resolveV6PrivatePairing(input = {}) {
  const context = buildV6PrivatePairingResolveContext(input);
  const runtimeEnabled = isPrivatePairingRuntimeEnabled(input.envSource);

  if (!runtimeEnabled) {
    return {
      ok: true,
      skipped: true,
      runtimeEnabled: false,
      context,
      resolved: {
        rules: [],
        hardRules: [],
        softRules: [],
        ignoredRules: [],
        overriddenRules: [],
        fatalConflicts: [],
        blockedByPolicy: [],
        validationErrors: [],
        warnings: [],
        ruleResolution: null,
      },
    };
  }

  const resolved = resolveActivePrivatePairingRules({
    rules: input.privatePairingRules || input.rules || [],
    legacyConstraints: input.legacyConstraints || [],
    context,
  });

  if ((resolved.validationErrors || []).length) {
    return {
      ok: false,
      runtimeEnabled: true,
      context,
      resolved,
      code: "RULE_VALIDATION_FAILED",
      message: "Bộ quy tắc riêng không hợp lệ.",
    };
  }

  if ((resolved.fatalConflicts || []).length) {
    return {
      ok: false,
      runtimeEnabled: true,
      context,
      resolved,
      code: "RULE_SET_CONFLICT",
      message: "Quy tắc riêng xung đột — không thể tiếp tục.",
    };
  }

  return {
    ok: true,
    skipped: false,
    runtimeEnabled: true,
    context,
    resolved,
  };
}

/**
 * Mint a new seed for explicit AI / auto-generate actions only.
 * Prefer createAiDrawRandomSeed from aiDrawSeedAudit when available.
 */
export function mintV6OptimizationSeed(previousSeed = null) {
  return mintSeed(previousSeed);
}

/**
 * Create seeded RNG for V6 AI paths — never Math.random on decision paths.
 */
export function createV6SeededRng(seed) {
  return createSeededRng(seed ?? 1);
}

/**
 * Evaluate a candidate through shared hard/soft private-pairing evaluator.
 */
export function evaluateV6PrivatePairingCandidate(candidate, input = {}) {
  const gate = resolveV6PrivatePairing(input);
  if (!gate.ok) {
    return {
      feasible: false,
      rejectionCodes: [gate.code],
      scoreBreakdown: buildScoreBreakdown({}),
      ruleResolution: gate.resolved?.ruleResolution || null,
      resolveGate: gate,
    };
  }

  if (gate.skipped || !gate.resolved?.rules?.length) {
    const v6FormatPenalty = Number(input.v6FormatPenalty) || 0;
    const defaultPenalty = Number(input.defaultPenalty) || 0;
    return {
      feasible: true,
      rejectionCodes: [],
      scoreBreakdown: buildScoreBreakdown({
        v6FormatPenalty,
        defaultPenalty,
      }),
      ruleResolution: null,
      resolveGate: gate,
    };
  }

  const evaluated = evaluatePrivatePairingCandidate(candidate, {
    resolved: gate.resolved,
    context: gate.context,
    history: input.history || {},
  });

  const scoreBreakdown = buildScoreBreakdown({
    penaltyBySource: {
      SUPER_ADMIN: evaluated.scoreBreakdown?.superAdminPenalty,
      TOURNAMENT: evaluated.scoreBreakdown?.tournamentPenalty,
      CLUB: evaluated.scoreBreakdown?.clubPenalty,
      SESSION: evaluated.scoreBreakdown?.sessionPenalty,
    },
    v6FormatPenalty: Number(input.v6FormatPenalty) || 0,
    defaultPenalty:
      Number(input.defaultPenalty) ||
      evaluated.scoreBreakdown?.defaultPenalty ||
      0,
  });

  return {
    ...evaluated,
    scoreBreakdown,
    resolveGate: gate,
  };
}

/**
 * Build competitionOptimizationAudit payload (stored in teamData.settings when possible).
 */
export function buildV6CompetitionOptimizationAudit(input = {}) {
  return {
    operation: input.operation || null,
    context: input.context || null,
    ruleResolution: input.ruleResolution || null,
    algorithmVersion: input.algorithmVersion || V6_PRIVATE_PAIRING_ALGORITHM_VERSION,
    randomSeed: input.randomSeed != null ? String(input.randomSeed) : null,
    diagnostics: input.diagnostics || null,
    scoreBreakdown: input.scoreBreakdown || null,
    previousSnapshot: input.previousSnapshot ?? null,
    resultSnapshot: input.resultSnapshot ?? null,
    actorId: input.actorId ?? null,
    action: input.action || V6_OPTIMIZATION_ACTION.INITIAL_GENERATE,
    generatedAt: input.generatedAt || new Date().toISOString(),
    lockStatus: input.lockStatus ?? null,
    revealStatus: input.revealStatus ?? null,
  };
}

/**
 * Attach audit onto teamData.settings.competitionOptimizationAudit (immutable).
 * No DB migration — uses existing JSON settings blob.
 */
export function attachV6CompetitionOptimizationAudit(teamData, auditInput = {}) {
  const entry = buildV6CompetitionOptimizationAudit(auditInput);
  const existing =
    teamData?.settings?.competitionOptimizationAudit &&
    typeof teamData.settings.competitionOptimizationAudit === "object"
      ? teamData.settings.competitionOptimizationAudit
      : {};
  const log = Array.isArray(existing.log) ? existing.log : [];
  const nextLog = [...log, entry].slice(-40);

  const byOperation = {
    ...(existing.byOperation || {}),
  };
  if (entry.operation) {
    byOperation[entry.operation] = {
      randomSeed: entry.randomSeed,
      algorithmVersion: entry.algorithmVersion,
      scoreBreakdown: entry.scoreBreakdown,
      diagnostics: entry.diagnostics,
      resultSnapshot: entry.resultSnapshot,
      publishedAt: entry.generatedAt,
      action: entry.action,
    };
  }

  return {
    ...teamData,
    settings: {
      ...(teamData?.settings || {}),
      competitionOptimizationAudit: {
        ...existing,
        byOperation,
        log: nextLog,
        last: entry,
      },
    },
  };
}

/**
 * Snapshot lineup selections for audit (compact).
 */
export function snapshotLineupSelections(lineup) {
  if (!lineup) return null;
  const selections = {};
  Object.entries(lineup.selections || {}).forEach(([disciplineId, playerIds]) => {
    selections[String(disciplineId)] = [...(playerIds || [])].map(String).sort();
  });
  return {
    matchupId: lineup.matchupId ? String(lineup.matchupId) : null,
    teamId: lineup.teamId ? String(lineup.teamId) : null,
    status: lineup.status || null,
    source: lineup.source || null,
    selections,
  };
}

export { PRIVATE_PAIRING_OPERATION };
