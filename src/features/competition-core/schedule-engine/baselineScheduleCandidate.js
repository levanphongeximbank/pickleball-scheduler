/**
 * CORE-11 Phase 1E — deterministic baseline schedule candidate (pure).
 *
 * Produces BASELINE_SCHEDULE_CANDIDATE with constraintCertification BASELINE_ONLY.
 * Does not certify participant/team overlap or minimum rest (Phase 1F).
 * Does not assign physical courts or referees.
 * First-feasible placement — not CORE-10 optimization.
 */

import {
  CONSTRAINT_CERTIFICATION,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  SCHEDULE_ENGINE_IDENTITY,
  SCHEDULE_PREDECESSOR_STATE,
} from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  createSchedulePlan,
  createScheduledMatch,
  createUnscheduledMatch,
  createScheduleReplayMetadata,
  fingerprintSchedulePlan,
} from "./scheduleContracts.js";
import { normalizeOperatingWindows } from "./normalizeOperatingWindows.js";
import { normalizeSessionWindows } from "./normalizeSessionWindows.js";
import {
  convertCivilScheduleTimeToAbsolute,
} from "./scheduleCivilTime.js";
import {
  buildScheduleDependencyGraph,
  topologicallyOrderScheduleMatches,
} from "./scheduleDependencyGraph.js";
import { deriveDependencyEarliestStartAbsolute } from "./scheduleDependencyReadiness.js";
import { generateAbstractScheduleSlots } from "./scheduleSlotGenerator.js";
import {
  asciiCompare,
  isNonNegativeInteger,
  isPositiveInteger,
  normalizeIdentifier,
  serializeCanonical,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} DurationResolutionResult
 * @property {boolean} ok
 * @property {number|null} durationMinutes
 * @property {string|null} source
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * Resolve match duration (deterministic priority):
 * 1. match.estimatedDurationMinutes when present (invalid → fail closed);
 * 2. policy.duration.durationByStage[stageId] when present and valid;
 * 3. policy.duration.durationByRound[roundNumber] when present and valid;
 * 4. policy.duration.defaultDurationMinutes.
 *
 * @param {unknown} match
 * @param {unknown} policy
 * @returns {DurationResolutionResult}
 */
export function resolveMatchDurationMinutes(match, policy) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const record =
    match != null && typeof match === "object" && !Array.isArray(match)
      ? /** @type {Record<string, unknown>} */ (match)
      : null;
  const matchId = normalizeIdentifier(record?.matchId);
  const durationPolicy =
    policy != null && typeof policy === "object" && !Array.isArray(policy)
      ? /** @type {Record<string, unknown>} */ (policy).duration
      : null;
  const duration =
    durationPolicy != null &&
    typeof durationPolicy === "object" &&
    !Array.isArray(durationPolicy)
      ? /** @type {Record<string, unknown>} */ (durationPolicy)
      : null;

  if (
    record &&
    record.estimatedDurationMinutes !== undefined &&
    record.estimatedDurationMinutes !== null
  ) {
    if (!isPositiveInteger(record.estimatedDurationMinutes)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
        path: `matches[matchId=${matchId || "?"}].estimatedDurationMinutes`,
        message: "estimatedDurationMinutes must be a positive integer",
        relatedMatchIds: matchId ? [matchId] : [],
        details: { estimatedDurationMinutes: record.estimatedDurationMinutes },
      });
      return {
        ok: false,
        durationMinutes: null,
        source: null,
        diagnostics: sortScheduleDiagnostics(diagnostics),
      };
    }
    return {
      ok: true,
      durationMinutes: /** @type {number} */ (record.estimatedDurationMinutes),
      source: "MATCH_ESTIMATED",
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  if (duration) {
    const stageId = normalizeIdentifier(record?.stageId);
    if (
      stageId &&
      duration.durationByStage &&
      typeof duration.durationByStage === "object"
    ) {
      const byStage = /** @type {Record<string, unknown>} */ (
        duration.durationByStage
      );
      if (Object.prototype.hasOwnProperty.call(byStage, stageId)) {
        const value = byStage[stageId];
        if (!isPositiveInteger(value)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
            path: `policy.duration.durationByStage.${stageId}`,
            message: "durationByStage value must be a positive integer",
            relatedMatchIds: matchId ? [matchId] : [],
            details: { stageId, value },
          });
          return {
            ok: false,
            durationMinutes: null,
            source: null,
            diagnostics: sortScheduleDiagnostics(diagnostics),
          };
        }
        return {
          ok: true,
          durationMinutes: /** @type {number} */ (value),
          source: "DURATION_BY_STAGE",
          diagnostics: sortScheduleDiagnostics(diagnostics),
        };
      }
    }

    if (
      record?.roundNumber !== undefined &&
      record?.roundNumber !== null &&
      duration.durationByRound &&
      typeof duration.durationByRound === "object"
    ) {
      const byRound = /** @type {Record<string, unknown>} */ (
        duration.durationByRound
      );
      const roundKey = String(record.roundNumber);
      if (Object.prototype.hasOwnProperty.call(byRound, roundKey)) {
        const value = byRound[roundKey];
        if (!isPositiveInteger(value)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
            path: `policy.duration.durationByRound.${roundKey}`,
            message: "durationByRound value must be a positive integer",
            relatedMatchIds: matchId ? [matchId] : [],
            details: { roundNumber: record.roundNumber, value },
          });
          return {
            ok: false,
            durationMinutes: null,
            source: null,
            diagnostics: sortScheduleDiagnostics(diagnostics),
          };
        }
        return {
          ok: true,
          durationMinutes: /** @type {number} */ (value),
          source: "DURATION_BY_ROUND",
          diagnostics: sortScheduleDiagnostics(diagnostics),
        };
      }
    }

    if (!isPositiveInteger(duration.defaultDurationMinutes)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
        path: "policy.duration.defaultDurationMinutes",
        message: "defaultDurationMinutes must be a positive integer",
        relatedMatchIds: matchId ? [matchId] : [],
      });
      return {
        ok: false,
        durationMinutes: null,
        source: null,
        diagnostics: sortScheduleDiagnostics(diagnostics),
      };
    }
    return {
      ok: true,
      durationMinutes: /** @type {number} */ (duration.defaultDurationMinutes),
      source: "DEFAULT",
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  push({
    code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
    path: "policy.duration",
    message: "duration policy is required to resolve match duration",
    relatedMatchIds: matchId ? [matchId] : [],
  });
  return {
    ok: false,
    durationMinutes: null,
    source: null,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * Place one match into the first feasible abstract slot/concurrency lane.
 *
 * @param {{
 *   match?: unknown,
 *   durationMinutes?: unknown,
 *   bufferMinutes?: unknown,
 *   maxConcurrentMatches?: unknown,
 *   placementWindows?: unknown,
 *   earliestStartUtcMs?: number|null,
 *   earliestStartCivil?: { date: string, minutesFromMidnight: number }|null,
 *   occupied?: Array<{
 *     concurrencyIndex: number,
 *     startUtcMs: number,
 *     capacityReleaseUtcMs: number,
 *     date?: string,
 *     capacityReleaseMinutes?: number,
 *   }>,
 *   timezone?: unknown,
 *   sequence?: unknown,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   scheduled: import('./scheduleTypes.js').ScheduledMatch|null,
 *   occupancy: {
 *     concurrencyIndex: number,
 *     startUtcMs: number,
 *     capacityReleaseUtcMs: number,
 *     date: string,
 *     capacityReleaseMinutes: number,
 *   }|null,
 *   reasonCode: string|null,
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function placeMatchIntoCandidateSlot(input = {}) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const match =
    input.match != null && typeof input.match === "object"
      ? /** @type {Record<string, unknown>} */ (input.match)
      : {};
  const matchId = normalizeIdentifier(match.matchId);
  const durationMinutes = input.durationMinutes;
  const bufferMinutes =
    input.bufferMinutes === undefined || input.bufferMinutes === null
      ? 0
      : input.bufferMinutes;
  const maxConcurrentMatches = input.maxConcurrentMatches;
  const timezone = normalizeIdentifier(input.timezone);
  const earliestStartUtcMs =
    input.earliestStartUtcMs === undefined ? null : input.earliestStartUtcMs;
  const earliestStartCivil =
    input.earliestStartCivil &&
    typeof input.earliestStartCivil === "object" &&
    typeof input.earliestStartCivil.date === "string" &&
    Number.isInteger(input.earliestStartCivil.minutesFromMidnight)
      ? {
          date: normalizeIdentifier(input.earliestStartCivil.date),
          minutesFromMidnight: /** @type {number} */ (
            input.earliestStartCivil.minutesFromMidnight
          ),
        }
      : null;
  const occupied = Array.isArray(input.occupied) ? [...input.occupied] : [];
  const sequence =
    input.sequence === undefined || input.sequence === null
      ? 0
      : Number(input.sequence);

  if (!matchId) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "match.matchId",
      message: "matchId is required for placement",
    });
    return failPlacement(diagnostics);
  }
  if (!isPositiveInteger(durationMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: `matches[matchId=${matchId}]`,
      message: "durationMinutes must be a positive integer",
      relatedMatchIds: [matchId],
    });
    return failPlacement(
      diagnostics,
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID
    );
  }
  if (!isNonNegativeInteger(bufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "bufferMinutes",
      message: "bufferMinutes must be a non-negative integer",
      relatedMatchIds: [matchId],
    });
    return failPlacement(diagnostics);
  }
  if (!isPositiveInteger(maxConcurrentMatches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "maxConcurrentMatches",
      message: "maxConcurrentMatches must be a positive integer",
      relatedMatchIds: [matchId],
    });
    return failPlacement(diagnostics);
  }
  if (!timezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required",
      relatedMatchIds: [matchId],
    });
    return failPlacement(diagnostics);
  }

  const windows = Array.isArray(input.placementWindows)
    ? /** @type {Array<Record<string, unknown>>} */ (input.placementWindows)
    : [];

  if (windows.length === 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT,
      path: `matches[matchId=${matchId}]`,
      message: "no placement windows available",
      relatedMatchIds: [matchId],
    });
    return failPlacement(
      diagnostics,
      SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT
    );
  }

  const maxWindowSpan = Math.max(
    0,
    ...windows.map((w) => {
      const start = Number(w.startMinutes);
      const end = Number(w.endMinutes);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
      return end - start;
    })
  );
  if (/** @type {number} */ (durationMinutes) > maxWindowSpan) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_EXCEEDS_WINDOW,
      path: `matches[matchId=${matchId}]`,
      message: "match duration exceeds every available window/session span",
      relatedMatchIds: [matchId],
      details: { durationMinutes, maxWindowSpan },
    });
    return failPlacement(
      diagnostics,
      SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_EXCEEDS_WINDOW
    );
  }

  const hasSessions = windows.some((w) => normalizeIdentifier(w.sessionId));
  const slotGen = generateAbstractScheduleSlots({
    operatingWindows: hasSessions ? [] : windows,
    sessionWindows: hasSessions ? windows : [],
    durationMinutes,
    bufferMinutes,
    maxConcurrentMatches,
    timezone,
  });
  diagnostics.push(...slotGen.diagnostics);

  const candidates = buildPlacementCandidates({
    windows,
    durationMinutes: /** @type {number} */ (durationMinutes),
    bufferMinutes: /** @type {number} */ (bufferMinutes),
    maxConcurrentMatches: /** @type {number} */ (maxConcurrentMatches),
    timezone,
    earliestStartUtcMs:
      typeof earliestStartUtcMs === "number" && Number.isFinite(earliestStartUtcMs)
        ? earliestStartUtcMs
        : null,
    earliestStartCivil,
    generatedSlots: slotGen.slots,
    occupied,
  });
  diagnostics.push(...candidates.diagnostics);

  let sawTimeFitIgnoringCapacity = false;

  for (const candidate of candidates.candidates) {
    const startUtcMs = candidate.startUtcMs;
    const endUtcMs = candidate.endUtcMs;
    const capacityReleaseUtcMs = candidate.capacityReleaseUtcMs;

    if (
      typeof earliestStartUtcMs === "number" &&
      Number.isFinite(earliestStartUtcMs) &&
      startUtcMs < earliestStartUtcMs
    ) {
      continue;
    }

    sawTimeFitIgnoringCapacity = true;

    for (
      let concurrencyIndex = 0;
      concurrencyIndex < /** @type {number} */ (maxConcurrentMatches);
      concurrencyIndex += 1
    ) {
      if (
        !isConcurrencyFree(
          occupied,
          concurrencyIndex,
          startUtcMs,
          capacityReleaseUtcMs
        )
      ) {
        continue;
      }

      const scheduled = createScheduledMatch({
        matchId,
        start: {
          date: candidate.date,
          minutesFromMidnight: candidate.startMinutes,
        },
        end: {
          date: candidate.date,
          minutesFromMidnight: candidate.endMinutes,
        },
        sessionId: candidate.sessionId,
        sequence,
        abstractSlotIndex: concurrencyIndex,
        requiredCapacity: 1,
        metadata: {
          durationMinutes,
          bufferMinutes,
          concurrencyIndex,
          startUtcMs,
          endUtcMs,
          startUtcIso: candidate.startUtcIso,
          endUtcIso: candidate.endUtcIso,
          capacityReleaseUtcMs,
          capacityReleaseUtcIso: new Date(capacityReleaseUtcMs).toISOString(),
          sourceWindowId: candidate.sourceWindowId,
          durationSource: match.__durationSource || null,
          constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
        },
      });

      /** @type {any} */
      const enriched = scheduled;
      enriched.durationMinutes = durationMinutes;
      enriched.bufferMinutes = bufferMinutes;
      enriched.concurrencyIndex = concurrencyIndex;
      enriched.startUtcMs = startUtcMs;
      enriched.endUtcMs = endUtcMs;
      enriched.startUtcIso = candidate.startUtcIso;
      enriched.endUtcIso = candidate.endUtcIso;
      enriched.capacityReleaseUtcMs = capacityReleaseUtcMs;
      enriched.capacityReleaseUtcIso = new Date(
        capacityReleaseUtcMs
      ).toISOString();
      if (candidate.sourceWindowId) {
        enriched.sourceWindowId = candidate.sourceWindowId;
      }

      return {
        ok: true,
        scheduled: enriched,
        occupancy: {
          concurrencyIndex,
          startUtcMs,
          capacityReleaseUtcMs,
          date: candidate.date,
          capacityReleaseMinutes:
            candidate.endMinutes + /** @type {number} */ (bufferMinutes),
        },
        reasonCode: null,
        diagnostics: sortScheduleDiagnostics(diagnostics),
      };
    }
  }

  const reasonCode = sawTimeFitIgnoringCapacity
    ? SCHEDULE_DIAGNOSTIC_CODE.ABSTRACT_CAPACITY_EXHAUSTED
    : SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT;

  push({
    code: reasonCode,
    path: `matches[matchId=${matchId}]`,
    message:
      reasonCode === SCHEDULE_DIAGNOSTIC_CODE.ABSTRACT_CAPACITY_EXHAUSTED
        ? "abstract concurrency capacity exhausted for all feasible times"
        : "no feasible abstract time slot under dependency and window constraints",
    relatedMatchIds: [matchId],
  });

  return failPlacement(diagnostics, reasonCode);
}

/**
 * Build a deterministic baseline schedule candidate from a ScheduleRequest.
 *
 * @param {unknown} request
 * @returns {{
 *   ok: boolean,
 *   status: string,
 *   constraintCertification: string,
 *   plan: import('./scheduleTypes.js').SchedulePlan,
 *   slots: import('./scheduleSlotGenerator.js').AbstractScheduleSlot[],
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function buildBaselineScheduleCandidate(request) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      message: "ScheduleRequest must be a plain object",
    });
    const plan = createSchedulePlan({
      competitionId: "",
      timezone: "",
      scheduled: [],
      unscheduled: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
      replay: baselineReplay(),
      metadata: baselineMetadata(),
    });
    return finalizeCandidate(false, plan, [], diagnostics);
  }

  const req = /** @type {Record<string, unknown>} */ (request);
  const competitionId = normalizeIdentifier(req.competitionId);
  const timezone = normalizeIdentifier(req.timezone);
  const matches = Array.isArray(req.matches) ? req.matches : [];
  const policy =
    req.policy != null && typeof req.policy === "object"
      ? /** @type {Record<string, unknown>} */ (req.policy)
      : {};

  const bufferMinutes = resolveBufferMinutes(policy);
  const maxConcurrentMatches = resolveMaxConcurrent(policy);

  if (bufferMinutes == null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "policy.duration.bufferMinutes",
      message: "bufferMinutes must be a non-negative integer when provided",
    });
  }
  if (maxConcurrentMatches == null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity.maxConcurrentMatches",
      message: "maxConcurrentMatches is required (positive integer)",
    });
  }

  const operatingNorm = normalizeOperatingWindows(req.operatingWindows, {
    timezone,
  });
  diagnostics.push(...operatingNorm.diagnostics);

  const sessionNorm = normalizeSessionWindows(
    req.sessionWindows,
    operatingNorm.windows,
    { timezone }
  );
  diagnostics.push(...sessionNorm.diagnostics);

  const graph = buildScheduleDependencyGraph(matches);
  diagnostics.push(...graph.diagnostics);

  if (
    !operatingNorm.ok ||
    !sessionNorm.ok ||
    maxConcurrentMatches == null ||
    bufferMinutes == null
  ) {
    const unscheduled = schedulableUnscheduledAll(
      matches,
      SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      "request windows/policy invalid — baseline placement blocked"
    );
    const plan = createSchedulePlan({
      competitionId,
      timezone,
      scheduled: [],
      unscheduled,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      replay: baselineReplay(),
      metadata: baselineMetadata(),
    });
    return finalizeCandidate(false, plan, [], diagnostics);
  }

  if (!graph.ok) {
    const reason = pickGraphFailureReason(graph.diagnostics);
    const unscheduled = schedulableUnscheduledAll(matches, reason, reason);
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BASELINE_CANDIDATE_INCOMPLETE,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.WARNING,
      message: "baseline candidate incomplete — dependency graph invalid",
    });
    const plan = createSchedulePlan({
      competitionId,
      timezone,
      scheduled: [],
      unscheduled,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      replay: baselineReplay(),
      metadata: baselineMetadata(),
    });
    return finalizeCandidate(false, plan, [], diagnostics);
  }

  const topo = topologicallyOrderScheduleMatches(graph);
  diagnostics.push(...topo.diagnostics);
  if (!topo.ok) {
    const unscheduled = schedulableUnscheduledAll(
      matches,
      SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY,
      "topological order unavailable"
    );
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BASELINE_CANDIDATE_INCOMPLETE,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.WARNING,
      message: "baseline candidate incomplete — topological order failed",
    });
    const plan = createSchedulePlan({
      competitionId,
      timezone,
      scheduled: [],
      unscheduled,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      replay: baselineReplay(),
      metadata: baselineMetadata(),
    });
    return finalizeCandidate(false, plan, [], diagnostics);
  }

  /** @type {Array<Record<string, unknown>>} */
  const placementWindows =
    sessionNorm.windows.length > 0
      ? sessionNorm.windows.map((w) => ({
          ...w,
          id: w.sessionId,
          sessionId: w.sessionId,
        }))
      : operatingNorm.windows.map((w) => ({
          ...w,
          id: w.windowId,
        }));

  const defaultDuration = resolveDefaultDuration(policy);
  const lattice = generateAbstractScheduleSlots({
    operatingWindows:
      sessionNorm.windows.length > 0 ? [] : operatingNorm.windows,
    sessionWindows: sessionNorm.windows,
    durationMinutes: defaultDuration ?? 30,
    bufferMinutes,
    maxConcurrentMatches,
    timezone,
  });
  diagnostics.push(...lattice.diagnostics);

  /** @type {Map<string, Record<string, unknown>>} */
  const matchById = new Map();
  for (const raw of matches) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const id = normalizeIdentifier(
      /** @type {Record<string, unknown>} */ (raw).matchId
    );
    if (id) matchById.set(id, /** @type {Record<string, unknown>} */ (raw));
  }

  /** @type {any[]} */
  const scheduled = [];
  /** @type {import('./scheduleTypes.js').UnscheduledMatch[]} */
  const unscheduled = [];
  /** @type {Set<string>} */
  const unscheduledIds = new Set();
  /** @type {Map<string, unknown>} */
  const predecessorSchedule = new Map();
  /** @type {Array<{ concurrencyIndex: number, startUtcMs: number, capacityReleaseUtcMs: number, date: string, capacityReleaseMinutes: number }>} */
  const occupied = [];
  let sequence = 0;

  for (const matchId of topo.order) {
    const match = matchById.get(matchId);
    if (!match) continue;

    const durationResult = resolveMatchDurationMinutes(match, policy);
    diagnostics.push(...durationResult.diagnostics);
    if (!durationResult.ok || durationResult.durationMinutes == null) {
      unscheduled.push(
        createUnscheduledMatch({
          matchId,
          reasonCode: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
          message: "match duration could not be resolved",
        })
      );
      unscheduledIds.add(matchId);
      continue;
    }

    const node = graph.nodes.find((n) => n.matchId === matchId);
    const predCheck = evaluatePredecessorPlacement(
      node,
      graph,
      unscheduledIds,
      predecessorSchedule
    );
    diagnostics.push(...predCheck.diagnostics);
    if (!predCheck.ok) {
      const missingCopy = [...(predCheck.missingPredecessorIds || [])];
      unscheduled.push(
        createUnscheduledMatch({
          matchId,
          reasonCode: predCheck.reasonCode,
          message: predCheck.message,
          metadata: { missingPredecessorIds: missingCopy },
        })
      );
      unscheduledIds.add(matchId);
      continue;
    }

    const earliest = resolveEarliestStartForPlacement({
      matchId,
      graph,
      predecessorSchedule,
      bufferMinutes: /** @type {number} */ (bufferMinutes),
      timezone,
      hasNonByePredecessors: predCheck.hasNonByePredecessors,
      byeOnly: predCheck.byeOnly,
    });
    diagnostics.push(...earliest.diagnostics);
    if (!earliest.ok) {
      unscheduled.push(
        createUnscheduledMatch({
          matchId,
          reasonCode: earliest.reasonCode,
          message: earliest.message,
        })
      );
      unscheduledIds.add(matchId);
      continue;
    }

    const placement = placeMatchIntoCandidateSlot({
      match: {
        ...match,
        __durationSource: durationResult.source,
      },
      durationMinutes: durationResult.durationMinutes,
      bufferMinutes,
      maxConcurrentMatches,
      placementWindows,
      earliestStartUtcMs: earliest.utcMs,
      earliestStartCivil: earliest.civil,
      occupied,
      timezone,
      sequence,
    });
    diagnostics.push(...placement.diagnostics);

    if (!placement.ok || !placement.scheduled || !placement.occupancy) {
      unscheduled.push(
        createUnscheduledMatch({
          matchId,
          reasonCode:
            placement.reasonCode ||
            SCHEDULE_DIAGNOSTIC_CODE.NO_FEASIBLE_TIME_SLOT,
          message: "match could not be placed into a baseline candidate slot",
        })
      );
      unscheduledIds.add(matchId);
      continue;
    }

    scheduled.push(placement.scheduled);
    occupied.push(placement.occupancy);
    predecessorSchedule.set(matchId, {
      end: {
        date: placement.scheduled.end.date,
        minutesFromMidnight: placement.scheduled.end.minutesFromMidnight,
      },
      utcMs: /** @type {number} */ (placement.scheduled.endUtcMs),
      utcIso: /** @type {string} */ (placement.scheduled.endUtcIso),
      timezone,
    });
    sequence += 1;
  }

  if (unscheduled.length > 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BASELINE_CANDIDATE_INCOMPLETE,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.WARNING,
      message: `baseline candidate incomplete — ${unscheduled.length} match(es) unscheduled`,
      relatedMatchIds: unscheduled.map((u) => u.matchId),
      details: {
        unscheduledCount: unscheduled.length,
        scheduledCount: scheduled.length,
      },
    });
  }

  const plan = createSchedulePlan({
    competitionId,
    timezone,
    scheduled,
    unscheduled,
    diagnostics: sortScheduleDiagnostics(diagnostics),
    replay: createScheduleReplayMetadata({
      engineId: SCHEDULE_ENGINE_IDENTITY.id,
      engineVersion: SCHEDULE_ENGINE_IDENTITY.version,
      details: {
        constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
        status: "BASELINE_SCHEDULE_CANDIDATE",
        certifiedConstraints: [
          "DEPENDENCY_ORDER",
          "DEPENDENCY_EARLIEST_START",
          "ABSTRACT_CONCURRENCY",
          "WINDOW_CONTAINMENT",
          "SESSION_CONTAINMENT",
        ],
        deferredConstraints: [
          "PARTICIPANT_OVERLAP",
          "TEAM_OVERLAP",
          "INSUFFICIENT_REST",
          "MIN_TEAM_REST",
          "PHYSICAL_COURT_ASSIGNMENT",
          "REFEREE_ASSIGNMENT",
        ],
        placementStrategy: "FIRST_FEASIBLE_DETERMINISTIC",
      },
    }),
    metadata: {
      constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      status: "BASELINE_SCHEDULE_CANDIDATE",
    },
  });

  const inputFingerprint = serializeCanonical({
    competitionId,
    timezone,
    matches: stableSortByKeys(
      matches
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          matchId: normalizeIdentifier(
            /** @type {Record<string, unknown>} */ (m).matchId
          ),
        })),
      (m) => [m.matchId]
    ),
    policy: {
      duration: {
        defaultDurationMinutes: /** @type {any} */ (policy).duration
          ?.defaultDurationMinutes,
        bufferMinutes: /** @type {any} */ (policy).duration?.bufferMinutes,
        durationByRound: /** @type {any} */ (policy).duration?.durationByRound
          ? { .../** @type {any} */ (policy).duration.durationByRound }
          : undefined,
        durationByStage: /** @type {any} */ (policy).duration?.durationByStage
          ? { .../** @type {any} */ (policy).duration.durationByStage }
          : undefined,
      },
      rest: { .../** @type {any} */ (policy).rest },
      capacity: { .../** @type {any} */ (policy).capacity },
    },
    operatingWindows: operatingNorm.windows.map((w) => ({ ...w })),
    sessionWindows: sessionNorm.windows.map((w) => ({ ...w })),
  });

  // Fingerprint before attaching fingerprints to avoid self-reference in replay.
  const resultFingerprint = fingerprintSchedulePlan(plan);
  plan.replay = createScheduleReplayMetadata({
    engineId: plan.replay?.engineId,
    engineVersion: plan.replay?.engineVersion,
    inputFingerprint,
    resultFingerprint,
    details: plan.replay?.details
      ? { ...plan.replay.details }
      : {
          constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
          status: "BASELINE_SCHEDULE_CANDIDATE",
        },
  });

  const ok = unscheduled.length === 0 && !hasErrorSeverity(diagnostics);
  return finalizeCandidate(ok, plan, lattice.slots, diagnostics);
}

/**
 * @param {boolean} ok
 * @param {import('./scheduleTypes.js').SchedulePlan} plan
 * @param {import('./scheduleSlotGenerator.js').AbstractScheduleSlot[]} slots
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */
function finalizeCandidate(ok, plan, slots, diagnostics) {
  return {
    ok,
    status: "BASELINE_SCHEDULE_CANDIDATE",
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    plan,
    slots,
    diagnostics: sortScheduleDiagnostics([
      ...diagnostics,
      ...(plan.diagnostics || []),
    ]),
  };
}

function baselineReplay() {
  return createScheduleReplayMetadata({
    details: {
      constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
      status: "BASELINE_SCHEDULE_CANDIDATE",
      certifiedConstraints: [],
      deferredConstraints: [
        "PARTICIPANT_OVERLAP",
        "TEAM_OVERLAP",
        "INSUFFICIENT_REST",
        "MIN_TEAM_REST",
        "PHYSICAL_COURT_ASSIGNMENT",
        "REFEREE_ASSIGNMENT",
      ],
    },
  });
}

function baselineMetadata() {
  return {
    constraintCertification: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
    status: "BASELINE_SCHEDULE_CANDIDATE",
  };
}

/**
 * @param {unknown[]} matches
 * @param {string} reasonCode
 * @param {string} message
 */
function schedulableUnscheduledAll(matches, reasonCode, message) {
  /** @type {import('./scheduleTypes.js').UnscheduledMatch[]} */
  const out = [];
  for (const raw of matches) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const m = /** @type {Record<string, unknown>} */ (raw);
    if (m.isBye === true) continue;
    const matchId = normalizeIdentifier(m.matchId);
    if (!matchId) continue;
    out.push(createUnscheduledMatch({ matchId, reasonCode, message }));
  }
  return stableSortByKeys(out, (u) => [u.matchId, u.reasonCode || ""]);
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */
function pickGraphFailureReason(diagnostics) {
  const codes = new Set((diagnostics || []).map((d) => d.code));
  if (codes.has(SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY)) {
    return SCHEDULE_DIAGNOSTIC_CODE.CYCLIC_MATCH_DEPENDENCY;
  }
  if (codes.has(SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID)) {
    return SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID;
  }
  if (codes.has(SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY)) {
    return SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY;
  }
  return SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST;
}

/**
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyNode|undefined} node
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph} graph
 * @param {Set<string>} unscheduledIds
 * @param {Map<string, unknown>} predecessorSchedule
 */
function evaluatePredecessorPlacement(
  node,
  graph,
  unscheduledIds,
  predecessorSchedule
) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  if (!node) {
    return {
      ok: false,
      reasonCode: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      message: "match missing from dependency graph",
      missingPredecessorIds: [],
      hasNonByePredecessors: false,
      byeOnly: false,
      diagnostics,
    };
  }

  /** @type {string[]} */
  const missing = [];
  let nonByeCount = 0;
  let byeCount = 0;

  for (const edge of node.predecessors) {
    const pred = graph.nodes.find((n) => n.matchId === edge.sourceMatchId);
    if (pred?.isBye === true) {
      byeCount += 1;
      continue;
    }
    nonByeCount += 1;
    if (unscheduledIds.has(edge.sourceMatchId)) {
      missing.push(edge.sourceMatchId);
      continue;
    }
    if (!predecessorSchedule.has(edge.sourceMatchId)) {
      missing.push(edge.sourceMatchId);
    }
  }

  if (missing.length > 0) {
    const sortedMissing = [...new Set(missing)].sort(asciiCompare);
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.PREDECESSOR_UNSCHEDULED,
        path: `matches[matchId=${node.matchId}]`,
        message: "required non-bye predecessor is unscheduled",
        relatedMatchIds: [node.matchId, ...sortedMissing],
        details: { missingPredecessorIds: [...sortedMissing] },
      })
    );
    return {
      ok: false,
      reasonCode: SCHEDULE_DIAGNOSTIC_CODE.PREDECESSOR_UNSCHEDULED,
      message: "required non-bye predecessor is unscheduled",
      missingPredecessorIds: sortedMissing,
      hasNonByePredecessors: nonByeCount > 0,
      byeOnly: nonByeCount === 0 && byeCount > 0,
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  return {
    ok: true,
    reasonCode: null,
    message: null,
    missingPredecessorIds: [],
    hasNonByePredecessors: nonByeCount > 0,
    byeOnly: nonByeCount === 0 && byeCount > 0,
    diagnostics,
  };
}

/**
 * Bye-only / no-predecessor: no fabricated end; earliestStart unconstrained.
 * Non-bye predecessors: Phase 1D deriveDependencyEarliestStartAbsolute for UTC,
 * plus civil lower-bound from planned predecessor civil ends + buffer
 * (no absolute→civil conversion).
 *
 * @param {{
 *   matchId: string,
 *   graph: import('./scheduleDependencyGraph.js').ScheduleDependencyGraph,
 *   predecessorSchedule: Map<string, unknown>,
 *   bufferMinutes: number,
 *   timezone: string,
 *   hasNonByePredecessors: boolean,
 *   byeOnly: boolean,
 * }} args
 */
function resolveEarliestStartForPlacement(args) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];

  if (!args.hasNonByePredecessors) {
    return {
      ok: true,
      utcMs: null,
      civil: null,
      reasonCode: null,
      message: null,
      diagnostics,
    };
  }

  /** @type {Record<string, unknown>} */
  const scheduleObj = {};
  for (const [id, entry] of args.predecessorSchedule.entries()) {
    scheduleObj[id] = entry;
  }

  const derived = deriveDependencyEarliestStartAbsolute({
    matchId: args.matchId,
    graph: args.graph,
    predecessorSchedule: scheduleObj,
    bufferMinutes: args.bufferMinutes,
    timezone: args.timezone,
  });
  diagnostics.push(...derived.diagnostics);

  if (!derived.ok || derived.utcMs == null) {
    return {
      ok: false,
      utcMs: null,
      civil: null,
      reasonCode: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE,
      message: "dependency earliest-start timing unavailable",
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  const civil = deriveCivilEarliestFromPredecessorEnds(
    args.predecessorSchedule,
    args.graph,
    args.matchId,
    args.bufferMinutes
  );

  return {
    ok: true,
    utcMs: derived.utcMs,
    civil,
    reasonCode: null,
    message: null,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * Civil earliest-start from planned predecessor civil ends + buffer.
 * Pure civil arithmetic — does not convert UTC back to civil.
 *
 * @param {Map<string, unknown>} predecessorSchedule
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph} graph
 * @param {string} matchId
 * @param {number} bufferMinutes
 * @returns {{ date: string, minutesFromMidnight: number }|null}
 */
function deriveCivilEarliestFromPredecessorEnds(
  predecessorSchedule,
  graph,
  matchId,
  bufferMinutes
) {
  const node = graph.nodes.find((n) => n.matchId === matchId);
  if (!node) return null;

  /** @type {{ date: string, minutesFromMidnight: number }[]} */
  const candidates = [];
  for (const edge of node.predecessors) {
    const pred = graph.nodes.find((n) => n.matchId === edge.sourceMatchId);
    if (pred?.isBye === true) continue;
    const entry = predecessorSchedule.get(edge.sourceMatchId);
    if (!entry || typeof entry !== "object") continue;
    const rec = /** @type {Record<string, unknown>} */ (entry);
    const end =
      rec.end && typeof rec.end === "object" && !Array.isArray(rec.end)
        ? /** @type {Record<string, unknown>} */ (rec.end)
        : null;
    if (!end) continue;
    const date = normalizeIdentifier(end.date);
    const minutes = end.minutesFromMidnight;
    if (!date || !Number.isInteger(minutes)) continue;
    const release = /** @type {number} */ (minutes) + bufferMinutes;
    // Phase 1 same-day civil seed only; day-spill uses UTC lower-bound filter.
    if (release > 1439) continue;
    candidates.push({ date, minutesFromMidnight: release });
  }
  if (candidates.length === 0) return null;
  const sorted = stableSortByKeys(candidates, (c) => [
    c.date,
    -c.minutesFromMidnight,
  ]);
  // Latest end: max date, then max minutes — sort date ASC then minutes DESC → first of max date group.
  let best = sorted[0];
  for (const c of sorted) {
    if (asciiCompare(c.date, best.date) > 0) best = c;
    else if (
      c.date === best.date &&
      c.minutesFromMidnight > best.minutesFromMidnight
    ) {
      best = c;
    }
  }
  return best;
}

/**
 * @param {{
 *   windows: Array<Record<string, unknown>>,
 *   durationMinutes: number,
 *   bufferMinutes: number,
 *   maxConcurrentMatches: number,
 *   timezone: string,
 *   earliestStartUtcMs: number|null,
 *   earliestStartCivil?: { date: string, minutesFromMidnight: number }|null,
 *   generatedSlots: import('./scheduleSlotGenerator.js').AbstractScheduleSlot[],
 *   occupied?: Array<{
 *     concurrencyIndex: number,
 *     startUtcMs: number,
 *     capacityReleaseUtcMs: number,
 *     date?: string,
 *     capacityReleaseMinutes?: number,
 *   }>,
 * }} args
 */
function buildPlacementCandidates(args) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  /** @type {Map<string, any>} */
  const byKey = new Map();

  const addCandidate = (candidate) => {
    const key = [
      candidate.date,
      String(candidate.startMinutes),
      candidate.sourceWindowId,
    ].join("\0");
    if (!byKey.has(key)) byKey.set(key, candidate);
  };

  for (const slot of args.generatedSlots || []) {
    if (
      args.earliestStartUtcMs != null &&
      slot.startUtcMs < args.earliestStartUtcMs
    ) {
      continue;
    }
    addCandidate({
      date: slot.date,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      startUtcMs: slot.startUtcMs,
      endUtcMs: slot.endUtcMs,
      startUtcIso: slot.startUtcIso,
      endUtcIso: slot.endUtcIso,
      capacityReleaseUtcMs: slot.capacityReleaseUtcMs,
      sourceWindowId: slot.sourceWindowId,
      sessionId: slot.sessionId,
    });
  }

  const sortedWindows = stableSortByKeys(args.windows, (w) => [
    normalizeIdentifier(w.date),
    Number(w.startMinutes) || 0,
    Number(w.endMinutes) || 0,
    normalizeIdentifier(w.sessionId || w.windowId || w.id),
  ]);

  for (const window of sortedWindows) {
    const date = normalizeIdentifier(window.date);
    const windowStart = Number(window.startMinutes);
    const windowEnd = Number(window.endMinutes);
    const sourceWindowId = normalizeIdentifier(
      window.sessionId || window.windowId || window.id
    );
    const sessionId = normalizeIdentifier(window.sessionId) || undefined;

    /** @type {number[]} */
    const startCandidates = [windowStart];

    // Civil earliest-start seed (from predecessor civil ends — no UTC→civil).
    if (
      args.earliestStartCivil &&
      args.earliestStartCivil.date === date &&
      Number.isInteger(args.earliestStartCivil.minutesFromMidnight)
    ) {
      if (asciiCompare(args.earliestStartCivil.date, date) > 0) {
        // window entirely before earliest civil date — skip seeding here
      } else {
        startCandidates.push(
          Math.max(windowStart, args.earliestStartCivil.minutesFromMidnight)
        );
      }
    } else if (
      args.earliestStartCivil &&
      asciiCompare(args.earliestStartCivil.date, date) > 0
    ) {
      continue;
    }

    // Capacity-release civil seeds from prior placements (retained at place time).
    for (const row of args.occupied || []) {
      if (
        row.date === date &&
        Number.isInteger(row.capacityReleaseMinutes) &&
        /** @type {number} */ (row.capacityReleaseMinutes) <= 1439
      ) {
        startCandidates.push(
          Math.max(
            windowStart,
            /** @type {number} */ (row.capacityReleaseMinutes)
          )
        );
      }
    }

    // Occupancy-aligned lattice starts inside the window.
    const occupancy = args.durationMinutes + args.bufferMinutes;
    for (
      let m = windowStart;
      m + args.durationMinutes <= windowEnd;
      m += occupancy > 0 ? occupancy : args.durationMinutes
    ) {
      startCandidates.push(m);
    }

    const uniqueStarts = [...new Set(startCandidates)]
      .filter(
        (m) =>
          Number.isInteger(m) &&
          m >= windowStart &&
          m + args.durationMinutes <= windowEnd
      )
      .sort((a, b) => a - b);

    for (const m of uniqueStarts) {
      const startAbs = convertCivilScheduleTimeToAbsolute(
        { date, minutesFromMidnight: m, timezone: args.timezone },
        args.timezone
      );
      const endMinutes = m + args.durationMinutes;
      const endAbs = convertCivilScheduleTimeToAbsolute(
        { date, minutesFromMidnight: endMinutes, timezone: args.timezone },
        args.timezone
      );
      diagnostics.push(...startAbs.diagnostics, ...endAbs.diagnostics);
      if (!startAbs.ok || !endAbs.ok) continue;
      if (
        args.earliestStartUtcMs != null &&
        /** @type {number} */ (startAbs.utcMs) < args.earliestStartUtcMs
      ) {
        continue;
      }
      addCandidate({
        date,
        startMinutes: m,
        endMinutes,
        startUtcMs: /** @type {number} */ (startAbs.utcMs),
        endUtcMs: /** @type {number} */ (endAbs.utcMs),
        startUtcIso: /** @type {string} */ (startAbs.utcIso),
        endUtcIso: /** @type {string} */ (endAbs.utcIso),
        capacityReleaseUtcMs:
          /** @type {number} */ (endAbs.utcMs) + args.bufferMinutes * 60_000,
        sourceWindowId,
        sessionId,
      });
    }
  }

  const candidates = stableSortByKeys([...byKey.values()], (c) => [
    c.date,
    c.startMinutes,
    c.sourceWindowId,
  ]);

  return {
    candidates,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * Half-open occupancy [start, release).
 * @param {Array<{ concurrencyIndex: number, startUtcMs: number, capacityReleaseUtcMs: number }>} occupied
 * @param {number} concurrencyIndex
 * @param {number} startUtcMs
 * @param {number} capacityReleaseUtcMs
 */
function isConcurrencyFree(
  occupied,
  concurrencyIndex,
  startUtcMs,
  capacityReleaseUtcMs
) {
  for (const row of occupied) {
    if (row.concurrencyIndex !== concurrencyIndex) continue;
    if (
      startUtcMs < row.capacityReleaseUtcMs &&
      row.startUtcMs < capacityReleaseUtcMs
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @param {unknown} policy
 * @returns {number|null}
 */
function resolveBufferMinutes(policy) {
  const duration =
    policy != null && typeof policy === "object"
      ? /** @type {Record<string, unknown>} */ (policy).duration
      : null;
  if (duration == null || typeof duration !== "object") return 0;
  const buffer = /** @type {Record<string, unknown>} */ (duration).bufferMinutes;
  if (buffer === undefined || buffer === null) return 0;
  if (!isNonNegativeInteger(buffer)) return null;
  return /** @type {number} */ (buffer);
}

/**
 * @param {unknown} policy
 * @returns {number|null}
 */
function resolveMaxConcurrent(policy) {
  const capacity =
    policy != null && typeof policy === "object"
      ? /** @type {Record<string, unknown>} */ (policy).capacity
      : null;
  if (capacity == null || typeof capacity !== "object") return null;
  const max =
    /** @type {Record<string, unknown>} */ (capacity).maxConcurrentMatches;
  if (!isPositiveInteger(max)) return null;
  return /** @type {number} */ (max);
}

/**
 * @param {unknown} policy
 * @returns {number|null}
 */
function resolveDefaultDuration(policy) {
  const duration =
    policy != null && typeof policy === "object"
      ? /** @type {Record<string, unknown>} */ (policy).duration
      : null;
  if (duration == null || typeof duration !== "object") return null;
  const d =
    /** @type {Record<string, unknown>} */ (duration).defaultDurationMinutes;
  return isPositiveInteger(d) ? /** @type {number} */ (d) : null;
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @param {string|null} [reasonCode]
 */
function failPlacement(diagnostics, reasonCode = null) {
  return {
    ok: false,
    scheduled: null,
    occupancy: null,
    reasonCode,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */
function hasErrorSeverity(diagnostics) {
  return (diagnostics || []).some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );
}

export const BASELINE_PREDECESSOR_STATE = SCHEDULE_PREDECESSOR_STATE;
