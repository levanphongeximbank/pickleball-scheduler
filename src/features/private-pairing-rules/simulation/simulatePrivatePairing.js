/**
 * PR-4.5 — AI Pairing Simulation Engine (SUPER_ADMIN read-only).
 *
 * Does NOT write tournaments, matches, lineups, draws, blobs, or active rule sets.
 * Reuses PR-3 hard/soft evaluators. Optional audit: SIMULATE_PRIVATE_PAIRING.
 */

import {
  FEATURE_FLAG_KEYS,
  isPrivatePairingSimulationEnabled,
} from "../constants/codes.js";
import {
  isPrivatePairingRuntimeEnabled,
} from "../runtime/runtimeCodes.js";
import {
  resolveActivePrivatePairingRules,
  splitHardAndSoftRules,
} from "../runtime/resolveActiveRules.js";
import { hashSeed } from "../runtime/seededRng.js";
import {
  filterEligibleSimulationPlayers,
} from "./candidateCanonicalizer.js";
import { generateSimulationCandidates } from "./candidateGenerator.js";
import {
  collectMissingRatingWarnings,
  compareScoredCandidates,
  scoreSimulationCandidate,
} from "./candidateScorer.js";
import { explainSimulationCandidate } from "./candidateExplainer.js";
import {
  SIMULATION_CODE,
  SIMULATION_DEFAULTS,
  SIMULATION_VERSION,
} from "./simulationCodes.js";
import {
  buildSimulatePrivatePairingAudit,
  maybeWriteSimulationAudit,
} from "./privatePairingSimulationAudit.js";

function clampTopN(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SIMULATION_DEFAULTS.topN;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function emptyResult(partial = {}) {
  return {
    ok: false,
    errorCode: partial.errorCode || SIMULATION_CODE.INVALID_INPUT,
    simulationId: partial.simulationId || null,
    seed: partial.seed ?? null,
    ruleSetId: partial.ruleSetId || null,
    ruleSetVersion: partial.ruleSetVersion || null,
    context: partial.context || {},
    mappingSummary: partial.mappingSummary || {},
    summary: partial.summary || {
      playersReceived: 0,
      playersEligible: 0,
      playersExcluded: 0,
      candidatesGenerated: 0,
      candidatesEvaluated: 0,
      candidatesRejected: 0,
      candidatesRanked: 0,
      hardRulesApplied: 0,
      softRulesApplied: 0,
      executionTimeMs: 0,
      searchLimitReached: false,
      feasible: false,
    },
    selectedCandidates: [],
    rejectedSummary: partial.rejectedSummary || {},
    warnings: partial.warnings || [],
    execution: {
      mode: "simulate",
      version: SIMULATION_VERSION,
      readOnly: true,
      wroteTournament: false,
      wroteMatches: false,
      wroteLineups: false,
      ...(partial.execution || {}),
    },
    audit: partial.audit || null,
  };
}

/**
 * Pure simulation entry point.
 * @param {object} input
 */
export async function simulatePrivatePairing(input = {}) {
  const startedAt = Date.now();
  const envSource = input.envSource;
  const simulationId =
    input.simulationId || `sim-${hashSeed(String(input.seed ?? Date.now()))}`;

  if (!isPrivatePairingSimulationEnabled(envSource)) {
    return emptyResult({
      errorCode: SIMULATION_CODE.FEATURE_DISABLED,
      simulationId,
      seed: input.seed ?? null,
      summary: {
        playersReceived: (input.players || []).length,
        playersEligible: 0,
        playersExcluded: 0,
        candidatesGenerated: 0,
        candidatesEvaluated: 0,
        candidatesRejected: 0,
        candidatesRanked: 0,
        hardRulesApplied: 0,
        softRulesApplied: 0,
        executionTimeMs: Date.now() - startedAt,
        searchLimitReached: false,
        feasible: false,
      },
      execution: { simulationEnabled: false },
    });
  }

  if (!isPrivatePairingRuntimeEnabled(envSource)) {
    return emptyResult({
      errorCode: SIMULATION_CODE.RUNTIME_DISABLED,
      simulationId,
      seed: input.seed ?? null,
      warnings: [
        {
          code: SIMULATION_CODE.RUNTIME_DISABLED,
          meta: {
            require: [
              FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES,
              FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE,
            ],
          },
        },
      ],
      summary: {
        playersReceived: (input.players || []).length,
        playersEligible: 0,
        playersExcluded: 0,
        candidatesGenerated: 0,
        candidatesEvaluated: 0,
        candidatesRejected: 0,
        candidatesRanked: 0,
        hardRulesApplied: 0,
        softRulesApplied: 0,
        executionTimeMs: Date.now() - startedAt,
        searchLimitReached: false,
        feasible: false,
      },
      execution: { simulationEnabled: true, runtimeEnabled: false },
    });
  }

  const seed = input.seed ?? 1;
  const topN = clampTopN(input.topN ?? input.options?.topN);
  const maxCandidates = Math.max(
    1,
    Number(input.maxCandidates ?? SIMULATION_DEFAULTS.maxCandidates) ||
      SIMULATION_DEFAULTS.maxCandidates
  );
  const maxIterations = Math.max(
    maxCandidates,
    Number(input.maxIterations ?? SIMULATION_DEFAULTS.maxIterations) ||
      SIMULATION_DEFAULTS.maxIterations
  );
  const timeoutMs = Math.max(
    50,
    Number(input.timeoutMs ?? SIMULATION_DEFAULTS.timeoutMs) ||
      SIMULATION_DEFAULTS.timeoutMs
  );

  const context = {
    scopeType: input.scopeType || input.context?.scopeType || null,
    scopeId: input.scopeId || input.context?.scopeId || null,
    sourceClubId: input.sourceClubId || input.context?.sourceClubId || null,
    clubId:
      input.sourceClubId ||
      input.context?.clubId ||
      input.context?.sourceClubId ||
      input.scopeId ||
      null,
    contextTime: input.contextTime || input.context?.contextTime || new Date().toISOString(),
    competitionType: input.competitionType || input.context?.competitionType || null,
    competitionClass: input.competitionClass || input.context?.competitionClass || null,
    eventType: input.eventType || input.context?.eventType || null,
    teamSize: Number(input.teamSize ?? input.context?.teamSize ?? 2) || 2,
    courtCount: input.courtCount ?? input.context?.courtCount,
    allowedByPublishedRules:
      input.allowedByPublishedRules ?? input.context?.allowedByPublishedRules,
    ...(input.context || {}),
  };

  // Never trust client tenantId for server enforcement — stamp from options if provided by trusted caller
  if (input.trustedTenantId) {
    context.tenantId = input.trustedTenantId;
  }

  const filtered = filterEligibleSimulationPlayers(input.players || []);
  const warnings = [...filtered.warnings];
  const missingRatingWarnings = collectMissingRatingWarnings(filtered.eligible);
  warnings.push(...missingRatingWarnings);

  if (!filtered.eligible.length) {
    return emptyResult({
      errorCode: SIMULATION_CODE.NO_ELIGIBLE_PLAYERS,
      simulationId,
      seed,
      context,
      mappingSummary: filtered.mappingSummary,
      warnings,
      summary: {
        playersReceived: (input.players || []).length,
        playersEligible: 0,
        playersExcluded: filtered.excluded.length,
        candidatesGenerated: 0,
        candidatesEvaluated: 0,
        candidatesRejected: 0,
        candidatesRanked: 0,
        hardRulesApplied: 0,
        softRulesApplied: 0,
        executionTimeMs: Date.now() - startedAt,
        searchLimitReached: false,
        feasible: false,
      },
    });
  }

  const resolved = resolveActivePrivatePairingRules({
    rules: input.rules,
    legacyConstraints: input.legacyConstraints,
    context,
  });

  if (resolved.blockedByPolicy?.length) {
    resolved.blockedByPolicy.forEach((rule) => {
      warnings.push({
        code: SIMULATION_CODE.RULE_BLOCKED_BY_CERTIFIED_POLICY,
        meta: { ruleId: rule.id, visibility: rule.visibility },
      });
    });
  }

  if (resolved.fatalConflicts?.length) {
    return emptyResult({
      errorCode: SIMULATION_CODE.CONSTRAINT_CONFLICT,
      simulationId,
      seed,
      context,
      mappingSummary: filtered.mappingSummary,
      ruleSetVersion: resolved.ruleSetVersion,
      warnings,
      summary: {
        playersReceived: (input.players || []).length,
        playersEligible: filtered.eligible.length,
        playersExcluded: filtered.excluded.length,
        candidatesGenerated: 0,
        candidatesEvaluated: 0,
        candidatesRejected: 0,
        candidatesRanked: 0,
        hardRulesApplied: 0,
        softRulesApplied: 0,
        executionTimeMs: Date.now() - startedAt,
        searchLimitReached: false,
        feasible: false,
      },
      rejectedSummary: { fatalConflicts: resolved.fatalConflicts.length },
    });
  }

  const { hard, soft } = splitHardAndSoftRules(resolved.rules);
  const generation = generateSimulationCandidates({
    players: filtered.eligible,
    seed,
    maxCandidates,
    maxIterations,
    teamSize: context.teamSize,
    courtCount: context.courtCount,
    competitionType: context.competitionType,
    eventType: context.eventType,
    context,
    options: input.options,
    mixedDoubles: input.mixedDoubles,
  });

  const playersById = Object.fromEntries(
    filtered.eligible.map((p) => [String(p.playerId), p])
  );

  const evaluated = [];
  const rejectCounts = {};
  let searchLimitReached = Boolean(generation.truncated);
  let timedOut = false;

  for (let i = 0; i < generation.candidates.length; i += 1) {
    if (Date.now() - startedAt > timeoutMs) {
      timedOut = true;
      searchLimitReached = true;
      break;
    }
    if (evaluated.length >= maxCandidates) {
      searchLimitReached = true;
      break;
    }

    const candidate = generation.candidates[i];
    const scored = scoreSimulationCandidate(candidate, {
      resolved,
      context,
      history: input.history || {},
      playersById,
      players: filtered.eligible,
    });

    evaluated.push({
      ...scored,
      deterministicKey: candidate.deterministicKey,
      matches: candidate.matches,
      benchPlayers: candidate.benchPlayers,
      teams: candidate.teams,
      matchOption: candidate.matchOption,
    });

    if (!scored.feasible) {
      (scored.rejectionCodes || []).forEach((code) => {
        rejectCounts[code] = (rejectCounts[code] || 0) + 1;
      });
    }
  }

  const feasible = evaluated.filter((item) => item.feasible).sort(compareScoredCandidates);
  // Dedupe by deterministic key while ranking
  const rankedUnique = [];
  const seenKeys = new Set();
  feasible.forEach((item) => {
    const key = item.deterministicKey || item.id;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    rankedUnique.push(item);
  });

  const topScore = rankedUnique[0]?.finalScore ?? 0;
  const selectedCandidates = rankedUnique.slice(0, topN).map((item, index) => {
    const explanation = explainSimulationCandidate(item, {
      rank: index + 1,
      topScore,
      missingRatingCount: missingRatingWarnings.length,
    });
    return {
      rank: index + 1,
      candidateId: item.id,
      matches: item.matches || [],
      teams: item.teams || [],
      benchPlayers: (item.benchPlayers || []).map((p) => p.playerId || p.id),
      scores: item.scores,
      hardConstraintResult: item.hardConstraintResult,
      softConstraintResult: item.softConstraintResult,
      explanation,
      deterministicKey: item.deterministicKey,
      differenceFromTop: explanation.differenceFromTop,
      finalScore: item.finalScore,
    };
  });

  const executionTimeMs = Date.now() - startedAt;
  const feasibleFlag = selectedCandidates.length > 0;

  const summary = {
    playersReceived: (input.players || []).length,
    playersEligible: filtered.eligible.length,
    playersExcluded: filtered.excluded.length,
    candidatesGenerated: generation.candidates.length,
    candidatesEvaluated: evaluated.length,
    candidatesRejected: evaluated.length - feasible.length,
    candidatesRanked: selectedCandidates.length,
    hardRulesApplied: hard.length,
    softRulesApplied: soft.length,
    executionTimeMs,
    searchLimitReached,
    timedOut,
    feasible: feasibleFlag,
  };

  const auditPayload = buildSimulatePrivatePairingAudit({
    actorId: input.actorId || input.userContext?.userId || null,
    tenantId: input.trustedTenantId || context.tenantId || null,
    scopeType: context.scopeType,
    scopeId: context.scopeId,
    ruleSetId: input.ruleSetId || null,
    ruleSetVersion: resolved.ruleSetVersion,
    seed,
    playersCount: filtered.eligible.length,
    topN,
    executionTimeMs,
  });

  const audit = await maybeWriteSimulationAudit(input.auditWriter, auditPayload);

  if (!feasibleFlag) {
    return {
      ok: false,
      errorCode: searchLimitReached
        ? SIMULATION_CODE.SEARCH_LIMIT_REACHED
        : SIMULATION_CODE.NO_FEASIBLE_PAIRING,
      simulationId,
      seed,
      ruleSetId: input.ruleSetId || null,
      ruleSetVersion: resolved.ruleSetVersion,
      context,
      mappingSummary: filtered.mappingSummary,
      summary,
      selectedCandidates: [],
      rejectedSummary: {
        byCode: rejectCounts,
        total: evaluated.length - feasible.length,
      },
      warnings,
      execution: {
        mode: "simulate",
        version: SIMULATION_VERSION,
        readOnly: true,
        wroteTournament: false,
        wroteMatches: false,
        wroteLineups: false,
        generationMode: generation.mode,
        simulationEnabled: true,
        runtimeEnabled: true,
      },
      audit: audit || auditPayload,
    };
  }

  return {
    ok: true,
    errorCode: null,
    simulationId,
    seed,
    ruleSetId: input.ruleSetId || null,
    ruleSetVersion: resolved.ruleSetVersion,
    context,
    mappingSummary: filtered.mappingSummary,
    summary,
    selectedCandidates,
    rejectedSummary: {
      byCode: rejectCounts,
      total: evaluated.length - feasible.length,
    },
    warnings,
    execution: {
      mode: "simulate",
      version: SIMULATION_VERSION,
      readOnly: true,
      wroteTournament: false,
      wroteMatches: false,
      wroteLineups: false,
      generationMode: generation.mode,
      simulationEnabled: true,
      runtimeEnabled: true,
    },
    audit: audit || auditPayload,
  };
}
