/**
 * CORE-11 Phase 1F — independent hard-constraint certification of a
 * Phase 1E baseline schedule candidate (pure).
 *
 * Does not reschedule, reorder, optimize, publish, or mutate the candidate.
 * Does not assign courts/referees or infer match results.
 */

import {
  BASELINE_CANDIDATE_STATUS,
  CONSTRAINT_CERTIFICATION,
  CONSTRAINT_CERTIFICATION_RESULT_STATUS,
  SCHEDULE_DIAGNOSTIC_SEVERITY,
  SCHEDULE_ENGINE_IDENTITY,
} from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  assignmentBoundaryCodeForField,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  collectForbiddenAssignmentFieldPaths,
  createScheduleReplayMetadata,
  fingerprintBaselineScheduleCandidate,
  fingerprintScheduleRequest,
} from "./scheduleContracts.js";
import { normalizeOperatingWindows } from "./normalizeOperatingWindows.js";
import { normalizeSessionWindows } from "./normalizeSessionWindows.js";
import { convertCivilScheduleTimeToAbsolute } from "./scheduleCivilTime.js";
import {
  buildScheduleDependencyGraph,
  topologicallyOrderScheduleMatches,
} from "./scheduleDependencyGraph.js";
import { deriveDependencyEarliestStartAbsolute } from "./scheduleDependencyReadiness.js";
import {
  collectScheduledConstraintIndex,
  certifyResourceTimeline,
} from "./scheduleParticipantConstraints.js";
import {
  asciiCompare,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidCivilDate,
  isValidIanaTimezone,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

const CHECKED_CONSTRAINT_CODES = Object.freeze([
  "PARTICIPANT_OVERLAP",
  "TEAM_OVERLAP",
  "INSUFFICIENT_REST",
  "MATCH_OUTSIDE_ALLOWED_WINDOW",
  "CAPACITY_EXCEEDED",
  "DEPENDENCY_ORDER_VIOLATION",
  "SCHEDULE_INCOMPLETE",
  "COURT_ASSIGNMENT_BOUNDARY_VIOLATION",
  "REFEREE_ASSIGNMENT_BOUNDARY_VIOLATION",
]);

const DEFERRED_CONSTRAINT_CODES = Object.freeze([
  "PHYSICAL_COURT_FEASIBILITY",
  "REFEREE_ASSIGNMENT",
  "OPTIMIZER_OBJECTIVE",
  "CORE09_MATCHPLAN_ADAPTER",
  "CORE12_HANDOFF",
]);

/**
 * Independently certify a Phase 1E baseline schedule candidate.
 *
 * @param {unknown} request
 * @param {unknown} candidate
 * @returns {{
 *   ok: boolean,
 *   status: string,
 *   certification: string,
 *   candidateStatus: string,
 *   violations: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 *   checkedConstraintCodes: string[],
 *   deferredConstraintCodes: string[],
 *   replay: import('./scheduleTypes.js').ScheduleReplayMetadata,
 * }}
 */
export function certifyBaselineScheduleCandidateConstraints(
  request,
  candidate
) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const fail = (extra = {}) =>
    buildResult({
      ok: false,
      diagnostics,
      request,
      candidate,
      ...extra,
    });

  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      message: "ScheduleRequest must be a plain object",
    });
    return fail();
  }
  if (
    candidate == null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      message: "baseline candidate must be a plain object",
    });
    return fail();
  }

  const req = /** @type {Record<string, unknown>} */ (request);
  const cand = /** @type {Record<string, unknown>} */ (candidate);
  const plan = normalizeCandidatePlan(cand);
  const candidateStatus = normalizeIdentifier(
    cand.status ?? plan?.metadata?.status ?? BASELINE_CANDIDATE_STATUS
  );
  const candidateCertification = normalizeIdentifier(
    cand.constraintCertification ??
      plan?.metadata?.constraintCertification ??
      plan?.replay?.details?.constraintCertification
  );

  if (candidateStatus && candidateStatus !== BASELINE_CANDIDATE_STATUS) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.HARD_CONSTRAINT_CERTIFICATION_FAILED,
      path: "candidate.status",
      message: `forged or unexpected candidate status: ${candidateStatus}`,
      details: {
        expected: BASELINE_CANDIDATE_STATUS,
        actual: candidateStatus,
      },
    });
  }
  if (
    candidateCertification &&
    candidateCertification !== CONSTRAINT_CERTIFICATION.BASELINE_ONLY
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.HARD_CONSTRAINT_CERTIFICATION_FAILED,
      path: "candidate.constraintCertification",
      message: `forged or unexpected candidate certification: ${candidateCertification}`,
      details: {
        expected: CONSTRAINT_CERTIFICATION.BASELINE_ONLY,
        actual: candidateCertification,
      },
    });
  }

  if (!plan) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      message: "candidate must include a SchedulePlan (plan or plan fields)",
    });
    return fail();
  }

  const competitionId = normalizeIdentifier(req.competitionId);
  const timezone = normalizeIdentifier(req.timezone);
  if (!competitionId) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "competitionId",
      message: "competitionId is required",
    });
  }
  if (!timezone || !isValidIanaTimezone(timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone must be a valid explicit IANA id",
    });
  }
  if (
    normalizeIdentifier(plan.competitionId) &&
    competitionId &&
    normalizeIdentifier(plan.competitionId) !== competitionId
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "plan.competitionId",
      message: "plan competitionId does not match request",
    });
  }
  if (
    normalizeIdentifier(plan.timezone) &&
    timezone &&
    normalizeIdentifier(plan.timezone) !== timezone
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.TIMEZONE_MISMATCH,
      path: "plan.timezone",
      message: "plan timezone does not match request",
    });
  }

  const policy =
    req.policy != null && typeof req.policy === "object"
      ? /** @type {Record<string, unknown>} */ (req.policy)
      : {};
  const bufferMinutes = resolveBuffer(policy);
  const maxConcurrent = resolveMaxConcurrent(policy);
  const restPolicy = resolveRest(policy);
  if (bufferMinutes == null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "policy.duration.bufferMinutes",
      message: "bufferMinutes must be a non-negative integer when provided",
    });
  }
  if (maxConcurrent == null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity.maxConcurrentMatches",
      message: "maxConcurrentMatches is required",
    });
  }
  if (restPolicy == null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
      path: "policy.rest",
      message: "rest policy is invalid",
    });
  }

  const matches = Array.isArray(req.matches) ? req.matches : [];
  /** @type {Map<string, Record<string, unknown>>} */
  const matchById = new Map();
  /** @type {Set<string>} */
  const byeIds = new Set();
  /** @type {Set<string>} */
  const schedulableIds = new Set();
  for (const raw of matches) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const m = /** @type {Record<string, unknown>} */ (raw);
    const id = normalizeIdentifier(m.matchId);
    if (!id) continue;
    if (matchById.has(id)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `matches[matchId=${id}]`,
        message: `duplicate request matchId: ${id}`,
        relatedMatchIds: [id],
      });
      continue;
    }
    matchById.set(id, m);
    if (m.isBye === true) byeIds.add(id);
    else schedulableIds.add(id);
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
  const sessionsConfigured = sessionNorm.windows.length > 0;
  /** @type {Map<string, (typeof sessionNorm.windows)[number]>} */
  const sessionById = new Map(
    sessionNorm.windows.map((s) => [s.sessionId, s])
  );

  const scheduled = Array.isArray(plan.scheduled) ? plan.scheduled : [];
  const unscheduled = Array.isArray(plan.unscheduled) ? plan.unscheduled : [];

  // Forbidden assignment fields on decision surfaces.
  for (const hit of collectForbiddenAssignmentFieldPaths({
    scheduled,
    unscheduled,
  })) {
    push({
      code: assignmentBoundaryCodeForField(hit.field),
      path: hit.path,
      message: `forbidden assignment field: ${hit.field}`,
      details: { field: hit.field },
    });
  }

  /** @type {Set<string>} */
  const scheduledIds = new Set();
  /** @type {Set<string>} */
  const unscheduledIds = new Set();
  /** @type {Array<{ matchId: string, startUtcMs: number, endUtcMs: number, capacityReleaseUtcMs: number, concurrencyIndex: number, durationMinutes: number, bufferMinutes: number, sessionId?: string, record: Record<string, unknown> }>} */
  const scheduledRows = [];

  scheduled.forEach((raw, index) => {
    const path = `scheduled[${index}]`;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path,
        message: "scheduled entry must be an object",
      });
      return;
    }
    const item = /** @type {Record<string, unknown>} */ (raw);
    const matchId = normalizeIdentifier(item.matchId);
    if (!matchId) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.matchId`,
        message: "scheduled matchId required",
      });
      return;
    }
    if (!matchById.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_CANDIDATE_MATCH,
        path: `${path}.matchId`,
        message: `unknown scheduled matchId: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    if (byeIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path,
        message: `bye match must not be scheduled: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    if (scheduledIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `${path}.matchId`,
        message: `duplicate scheduled matchId: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    scheduledIds.add(matchId);

    const timing = validateScheduledTiming(item, path, timezone, bufferMinutes);
    diagnostics.push(...timing.diagnostics);
    if (!timing.ok || timing.startUtcMs == null || timing.endUtcMs == null) {
      return;
    }

    // Window / session containment.
    diagnostics.push(
      ...certifyWindowContainment({
        item,
        path,
        matchId,
        startUtcMs: timing.startUtcMs,
        endUtcMs: timing.endUtcMs,
        timezone,
        operatingWindows: operatingNorm.windows,
        sessionsConfigured,
        sessionById,
      })
    );

    const concurrencyIndex =
      item.concurrencyIndex !== undefined && item.concurrencyIndex !== null
        ? Number(item.concurrencyIndex)
        : item.abstractSlotIndex !== undefined && item.abstractSlotIndex !== null
          ? Number(item.abstractSlotIndex)
          : NaN;
    if (
      maxConcurrent != null &&
      (!isNonNegativeInteger(concurrencyIndex) ||
        concurrencyIndex >= maxConcurrent)
    ) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.CONCURRENCY_INDEX_INVALID,
        path: `${path}.concurrencyIndex`,
        message: "concurrencyIndex must be a non-negative integer below maxConcurrentMatches",
        relatedMatchIds: [matchId],
        details: { concurrencyIndex, maxConcurrentMatches: maxConcurrent },
      });
    }

    scheduledRows.push({
      matchId,
      startUtcMs: timing.startUtcMs,
      endUtcMs: timing.endUtcMs,
      capacityReleaseUtcMs: /** @type {number} */ (timing.capacityReleaseUtcMs),
      concurrencyIndex: isNonNegativeInteger(concurrencyIndex)
        ? concurrencyIndex
        : -1,
      durationMinutes: /** @type {number} */ (timing.durationMinutes),
      bufferMinutes: /** @type {number} */ (timing.bufferMinutes),
      sessionId: normalizeIdentifier(item.sessionId) || undefined,
      record: item,
    });
  });

  unscheduled.forEach((raw, index) => {
    const path = `unscheduled[${index}]`;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path,
        message: "unscheduled entry must be an object",
      });
      return;
    }
    const item = /** @type {Record<string, unknown>} */ (raw);
    const matchId = normalizeIdentifier(item.matchId);
    if (!matchId) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.matchId`,
        message: "unscheduled matchId required",
      });
      return;
    }
    if (!matchById.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_CANDIDATE_MATCH,
        path: `${path}.matchId`,
        message: `unknown unscheduled matchId: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    if (byeIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path,
        message: `bye match must not appear in unscheduled: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    if (unscheduledIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `${path}.matchId`,
        message: `duplicate unscheduled matchId: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
    unscheduledIds.add(matchId);
    if (scheduledIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path,
        message: `match cannot be both scheduled and unscheduled: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
  });

  // Completeness: every schedulable match exactly once.
  for (const id of schedulableIds) {
    const inSched = scheduledIds.has(id);
    const inUnsched = unscheduledIds.has(id);
    if (!inSched && !inUnsched) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_INCOMPLETE,
        path: `matches[matchId=${id}]`,
        message: `schedulable match omitted from candidate: ${id}`,
        relatedMatchIds: [id],
      });
    }
  }
  if (unscheduledIds.size > 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BASELINE_CANDIDATE_INCOMPLETE,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR,
      message: "baseline candidate has unscheduled non-bye matches",
      relatedMatchIds: [...unscheduledIds].sort(asciiCompare),
      details: { unscheduledCount: unscheduledIds.size },
    });
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.SCHEDULE_INCOMPLETE,
      message: "hard-constraint certification requires a complete schedule",
      relatedMatchIds: [...unscheduledIds].sort(asciiCompare),
    });
  }

  // Abstract capacity revalidation.
  if (maxConcurrent != null && bufferMinutes != null) {
    diagnostics.push(
      ...certifyAbstractCapacity(scheduledRows, maxConcurrent)
    );
  }

  // Dependency revalidation.
  const graph = buildScheduleDependencyGraph(matches);
  diagnostics.push(
    ...graph.diagnostics.filter(
      (d) => d.code !== SCHEDULE_DIAGNOSTIC_CODE.BYE_NO_SCHEDULE_REQUIRED
    )
  );
  if (graph.ok) {
    const topo = topologicallyOrderScheduleMatches(graph);
    diagnostics.push(...topo.diagnostics);
    diagnostics.push(
      ...certifyDependencyPlacement({
        graph,
        topoOrder: topo.order || [],
        scheduledRows,
        unscheduledIds,
        bufferMinutes: bufferMinutes ?? 0,
        timezone,
      })
    );
  }

  // Participant / team / rest.
  if (restPolicy) {
    const index = collectScheduledConstraintIndex(
      scheduledRows.map((r) => ({
        matchId: r.matchId,
        startUtcMs: r.startUtcMs,
        endUtcMs: r.endUtcMs,
      })),
      matchById
    );
    diagnostics.push(...index.diagnostics);
    for (const entry of index.unresolvedEntries) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED,
        path: `matches[matchId=${entry.matchId}].participants`,
        message:
          "scheduled match has unresolved participant identity — hard overlap/rest safety cannot be proven",
        relatedMatchIds: [entry.matchId],
        details: {
          matchId: entry.matchId,
          participantId: entry.participantId,
          participantKind: normalizeIdentifier(
            entry.participant && typeof entry.participant === "object"
              ? /** @type {any} */ (entry.participant).kind
              : ""
          ),
        },
      });
    }
    // Keep match-level unresolved ids for completeness when no participant entries.
    for (const matchId of index.unresolvedMatchIds) {
      if (index.unresolvedEntries.some((e) => e.matchId === matchId)) continue;
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED,
        path: `matches[matchId=${matchId}]`,
        message:
          "scheduled match has unresolved participant identity — hard overlap/rest safety cannot be proven",
        relatedMatchIds: [matchId],
      });
    }
    const resourceKeys = [...index.byResource.keys()].sort(asciiCompare);
    for (const key of resourceKeys) {
      diagnostics.push(
        ...certifyResourceTimeline(
          key,
          /** @type {any} */ (index.byResource.get(key) || []),
          restPolicy
        )
      );
    }
  }

  const hasError = diagnostics.some(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );
  if (hasError) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.HARD_CONSTRAINT_CERTIFICATION_FAILED,
      severity: SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR,
      message: "hard-constraint certification rejected the baseline candidate",
    });
  }

  return buildResult({
    ok: !hasError,
    diagnostics,
    request,
    candidate,
    plan,
  });
}

/**
 * @param {unknown} candidate
 * @returns {Record<string, unknown>|null}
 */
function normalizeCandidatePlan(candidate) {
  const cand = /** @type {Record<string, unknown>} */ (candidate);
  if (cand.plan && typeof cand.plan === "object" && !Array.isArray(cand.plan)) {
    return /** @type {Record<string, unknown>} */ (cand.plan);
  }
  if (Array.isArray(cand.scheduled) || Array.isArray(cand.unscheduled)) {
    return cand;
  }
  return null;
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} path
 * @param {string} timezone
 * @param {number|null} policyBuffer
 */
function validateScheduledTiming(item, path, timezone, policyBuffer) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => diagnostics.push(createScheduleDiagnostic(partial));
  const matchId = normalizeIdentifier(item.matchId);

  const start = item.start;
  const end = item.end;
  if (!start || typeof start !== "object" || !end || typeof end !== "object") {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path,
      message: "scheduled match requires civil start and end",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }
  const startRec = /** @type {Record<string, unknown>} */ (start);
  const endRec = /** @type {Record<string, unknown>} */ (end);
  if (
    !isValidCivilDate(startRec.date) ||
    !isValidMinutesFromMidnight(startRec.minutesFromMidnight) ||
    !isValidCivilDate(endRec.date) ||
    !isValidMinutesFromMidnight(endRec.minutesFromMidnight)
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path,
      message: "civil start/end must be valid date and minutes",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }
  if (normalizeIdentifier(startRec.date) !== normalizeIdentifier(endRec.date)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED,
      path,
      message: "Phase 1 overnight policy REJECT — match must stay on one civil date",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }
  if (
    /** @type {number} */ (endRec.minutesFromMidnight) <=
    /** @type {number} */ (startRec.minutesFromMidnight)
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path,
      message: "civil end must be after civil start (end exclusive of buffer)",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }

  const startAbs = convertCivilScheduleTimeToAbsolute(
    {
      date: startRec.date,
      minutesFromMidnight: startRec.minutesFromMidnight,
      timezone,
    },
    timezone,
    `${path}.start`
  );
  const endAbs = convertCivilScheduleTimeToAbsolute(
    {
      date: endRec.date,
      minutesFromMidnight: endRec.minutesFromMidnight,
      timezone,
    },
    timezone,
    `${path}.end`
  );
  diagnostics.push(...startAbs.diagnostics, ...endAbs.diagnostics);
  if (!startAbs.ok || !endAbs.ok) return failTiming(diagnostics);

  const startUtcMs = /** @type {number} */ (startAbs.utcMs);
  const endUtcMs = /** @type {number} */ (endAbs.utcMs);

  if (
    typeof item.startUtcMs === "number" &&
    Number.isFinite(item.startUtcMs) &&
    item.startUtcMs !== startUtcMs
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path: `${path}.startUtcMs`,
      message: "startUtcMs does not match civil start via Time SSOT",
      relatedMatchIds: matchId ? [matchId] : [],
      details: { recorded: item.startUtcMs, derived: startUtcMs },
    });
  }
  if (
    typeof item.endUtcMs === "number" &&
    Number.isFinite(item.endUtcMs) &&
    item.endUtcMs !== endUtcMs
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path: `${path}.endUtcMs`,
      message: "endUtcMs does not match civil end via Time SSOT",
      relatedMatchIds: matchId ? [matchId] : [],
      details: { recorded: item.endUtcMs, derived: endUtcMs },
    });
  }

  const durationMinutes =
    item.durationMinutes !== undefined && item.durationMinutes !== null
      ? Number(item.durationMinutes)
      : /** @type {number} */ (endRec.minutesFromMidnight) -
        /** @type {number} */ (startRec.minutesFromMidnight);
  if (!isPositiveInteger(durationMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: `${path}.durationMinutes`,
      message: "durationMinutes must be a positive integer",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }
  const civilSpan =
    /** @type {number} */ (endRec.minutesFromMidnight) -
    /** @type {number} */ (startRec.minutesFromMidnight);
  if (civilSpan !== durationMinutes) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_TIME_INCONSISTENT,
      path: `${path}.durationMinutes`,
      message: "durationMinutes inconsistent with civil start/end span",
      relatedMatchIds: matchId ? [matchId] : [],
      details: { durationMinutes, civilSpan },
    });
  }

  const bufferMinutes =
    item.bufferMinutes !== undefined && item.bufferMinutes !== null
      ? Number(item.bufferMinutes)
      : policyBuffer ?? 0;
  if (!isNonNegativeInteger(bufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: `${path}.bufferMinutes`,
      message: "bufferMinutes must be a non-negative integer",
      relatedMatchIds: matchId ? [matchId] : [],
    });
    return failTiming(diagnostics);
  }
  if (
    policyBuffer != null &&
    item.bufferMinutes !== undefined &&
    item.bufferMinutes !== null &&
    Number(item.bufferMinutes) !== policyBuffer
  ) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: `${path}.bufferMinutes`,
      message: "scheduled bufferMinutes does not match request policy",
      relatedMatchIds: matchId ? [matchId] : [],
    });
  }

  const expectedRelease = endUtcMs + bufferMinutes * 60_000;
  const recordedRelease =
    typeof item.capacityReleaseUtcMs === "number" &&
    Number.isFinite(item.capacityReleaseUtcMs)
      ? item.capacityReleaseUtcMs
      : expectedRelease;
  if (recordedRelease !== expectedRelease) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_RELEASE_INCONSISTENT,
      path: `${path}.capacityReleaseUtcMs`,
      message: "capacityReleaseUtcMs must equal endUtcMs + bufferMinutes",
      relatedMatchIds: matchId ? [matchId] : [],
      details: {
        recorded: recordedRelease,
        expected: expectedRelease,
        endUtcMs,
        bufferMinutes,
      },
    });
  }

  return {
    ok: !diagnostics.some(
      (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
    ),
    startUtcMs,
    endUtcMs,
    capacityReleaseUtcMs: expectedRelease,
    durationMinutes,
    bufferMinutes,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

function failTiming(diagnostics) {
  return {
    ok: false,
    startUtcMs: null,
    endUtcMs: null,
    capacityReleaseUtcMs: null,
    durationMinutes: null,
    bufferMinutes: null,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * @param {{
 *   item: Record<string, unknown>,
 *   path: string,
 *   matchId: string,
 *   startUtcMs: number,
 *   endUtcMs: number,
 *   timezone: string,
 *   operatingWindows: Array<Record<string, unknown>>,
 *   sessionsConfigured: boolean,
 *   sessionById: Map<string, any>,
 * }} args
 */
function certifyWindowContainment(args) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => diagnostics.push(createScheduleDiagnostic(partial));
  const start = /** @type {Record<string, unknown>} */ (args.item.start);
  const end = /** @type {Record<string, unknown>} */ (args.item.end);
  const date = normalizeIdentifier(start.date);
  const startMin = /** @type {number} */ (start.minutesFromMidnight);
  const endMin = /** @type {number} */ (end.minutesFromMidnight);

  if (args.sessionsConfigured) {
    const sessionId = normalizeIdentifier(args.item.sessionId);
    if (!sessionId) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW,
        path: `${args.path}.sessionId`,
        message: "sessionId is required when sessions are configured",
        relatedMatchIds: [args.matchId],
      });
      return diagnostics;
    }
    const session = args.sessionById.get(sessionId);
    if (!session) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_SESSION_ID,
        path: `${args.path}.sessionId`,
        message: `unknown sessionId: ${sessionId}`,
        relatedMatchIds: [args.matchId],
        details: { sessionId },
      });
      return diagnostics;
    }
    if (session.date !== date) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW,
        path: args.path,
        message: "match civil date does not match session date",
        relatedMatchIds: [args.matchId],
      });
    }
    if (startMin < session.startMinutes || endMin > session.endMinutes) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW,
        path: args.path,
        message: "match is not contained in its session window",
        relatedMatchIds: [args.matchId],
        details: {
          sessionId,
          startMinutes: startMin,
          endMinutes: endMin,
          sessionStart: session.startMinutes,
          sessionEnd: session.endMinutes,
        },
      });
    }
    return diagnostics;
  }

  const windows = args.operatingWindows.filter((w) => w.date === date);
  const contained = windows.some(
    (w) =>
      startMin >= /** @type {number} */ (w.startMinutes) &&
      endMin <= /** @type {number} */ (w.endMinutes)
  );
  if (!contained) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_OUTSIDE_ALLOWED_WINDOW,
      path: args.path,
      message: "match is outside all operating windows for its civil date",
      relatedMatchIds: [args.matchId],
      details: { date, startMinutes: startMin, endMinutes: endMin },
    });
  }
  return diagnostics;
}

/**
 * @param {Array<{ matchId: string, startUtcMs: number, endUtcMs: number, capacityReleaseUtcMs: number, concurrencyIndex: number }>} rows
 * @param {number} maxConcurrent
 */
function certifyAbstractCapacity(rows, maxConcurrent) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => diagnostics.push(createScheduleDiagnostic(partial));

  // Same concurrency index must not overlap on occupancy [start, release).
  /** @type {Map<number, typeof rows>} */
  const byIndex = new Map();
  for (const row of rows) {
    if (row.concurrencyIndex < 0) continue;
    let list = byIndex.get(row.concurrencyIndex);
    if (!list) {
      list = [];
      byIndex.set(row.concurrencyIndex, list);
    }
    list.push(row);
  }
  for (const [ci, list] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = stableSortByKeys(list, (r) => [
      r.startUtcMs,
      r.capacityReleaseUtcMs,
      r.matchId,
    ]);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const a = ordered[i];
        const b = ordered[j];
        if (
          a.startUtcMs < b.capacityReleaseUtcMs &&
          b.startUtcMs < a.capacityReleaseUtcMs
        ) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_EXCEEDED,
            path: `capacity[concurrencyIndex=${ci}]`,
            message: "overlapping occupancy on the same concurrency index",
            relatedMatchIds: [a.matchId, b.matchId],
            details: { concurrencyIndex: ci },
          });
        }
      }
    }
  }

  // Sweep-line max concurrent occupancy.
  /** @type {Array<{ t: number, d: number, matchId: string }>} */
  const events = [];
  for (const row of rows) {
    events.push({ t: row.startUtcMs, d: 1, matchId: row.matchId });
    events.push({ t: row.capacityReleaseUtcMs, d: -1, matchId: row.matchId });
  }
  const orderedEvents = stableSortByKeys(events, (e) => [
    e.t,
    e.d, // releases (-1) before starts (+1) at same instant
    e.matchId,
  ]);
  let active = 0;
  let peak = 0;
  for (const ev of orderedEvents) {
    active += ev.d;
    if (active > peak) peak = active;
  }
  if (peak > maxConcurrent) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_EXCEEDED,
      path: "policy.capacity.maxConcurrentMatches",
      message: "abstract concurrent occupancy exceeds maxConcurrentMatches",
      details: { peak, maxConcurrentMatches: maxConcurrent },
    });
  }

  return sortScheduleDiagnostics(diagnostics);
}

/**
 * @param {{
 *   graph: import('./scheduleDependencyGraph.js').ScheduleDependencyGraph,
 *   topoOrder: string[],
 *   scheduledRows: Array<{ matchId: string, startUtcMs: number, endUtcMs: number }>,
 *   unscheduledIds: Set<string>,
 *   bufferMinutes: number,
 *   timezone: string,
 * }} args
 */
function certifyDependencyPlacement(args) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => diagnostics.push(createScheduleDiagnostic(partial));
  /** @type {Map<string, { matchId: string, startUtcMs: number, endUtcMs: number }>} */
  const byId = new Map(args.scheduledRows.map((r) => [r.matchId, r]));
  const orderIndex = new Map(args.topoOrder.map((id, i) => [id, i]));

  for (const row of args.scheduledRows) {
    const node = args.graph.nodes.find((n) => n.matchId === row.matchId);
    if (!node) continue;

    for (const edge of node.predecessors) {
      const predId = edge.sourceMatchId;
      const predNode = args.graph.nodes.find((n) => n.matchId === predId);
      if (predNode?.isBye === true) continue;

      if (args.unscheduledIds.has(predId) || !byId.has(predId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.PREDECESSOR_UNSCHEDULED,
          path: `matches[matchId=${row.matchId}]`,
          message: `required predecessor is unscheduled: ${predId}`,
          relatedMatchIds: [row.matchId, predId],
        });
        continue;
      }

      const predIdx = orderIndex.has(predId) ? orderIndex.get(predId) : -1;
      const depIdx = orderIndex.has(row.matchId)
        ? orderIndex.get(row.matchId)
        : -1;
      if (
        typeof predIdx === "number" &&
        typeof depIdx === "number" &&
        predIdx >= 0 &&
        depIdx >= 0 &&
        predIdx > depIdx
      ) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION,
          path: `matches[matchId=${row.matchId}]`,
          message: "dependent appears before predecessor in topological order",
          relatedMatchIds: [predId, row.matchId],
        });
      }

      const pred = byId.get(predId);
      if (pred && row.startUtcMs < pred.endUtcMs) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION,
          path: `matches[matchId=${row.matchId}]`,
          message: "dependent starts before predecessor end",
          relatedMatchIds: [predId, row.matchId],
        });
      }
    }

    // Earliest-start lower bound (non-bye predecessors only).
    const nonByePreds = node.predecessors.filter((e) => {
      const n = args.graph.nodes.find((x) => x.matchId === e.sourceMatchId);
      return n && n.isBye !== true;
    });
    if (nonByePreds.length === 0) continue;

    /** @type {Record<string, unknown>} */
    const predecessorSchedule = {};
    let missing = false;
    for (const edge of nonByePreds) {
      const pred = byId.get(edge.sourceMatchId);
      if (!pred) {
        missing = true;
        break;
      }
      predecessorSchedule[edge.sourceMatchId] = {
        utcMs: pred.endUtcMs,
        end: {
          // civil not required when utcMs present
        },
      };
    }
    if (missing) continue;

    const earliest = deriveDependencyEarliestStartAbsolute({
      matchId: row.matchId,
      graph: args.graph,
      predecessorSchedule,
      bufferMinutes: args.bufferMinutes,
      timezone: args.timezone,
    });
    diagnostics.push(
      ...earliest.diagnostics.filter(
        (d) =>
          d.code !== SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE ||
          earliest.ok
      )
    );
    if (earliest.ok && earliest.utcMs != null && row.startUtcMs < earliest.utcMs) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_ORDER_VIOLATION,
        path: `matches[matchId=${row.matchId}]`,
        message: "dependent start violates dependency earliest-start lower bound",
        relatedMatchIds: [row.matchId, ...earliest.contributingPredecessorIds],
        details: {
          startUtcMs: row.startUtcMs,
          earliestStartUtcMs: earliest.utcMs,
          bufferMinutes: args.bufferMinutes,
        },
      });
    }
  }

  return sortScheduleDiagnostics(diagnostics);
}

/**
 * @param {unknown} policy
 * @returns {number|null}
 */
function resolveBuffer(policy) {
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
 * @returns {{ minParticipantRestMinutes: number, minTeamRestMinutes: number }|null}
 */
function resolveRest(policy) {
  const rest =
    policy != null && typeof policy === "object"
      ? /** @type {Record<string, unknown>} */ (policy).rest
      : null;
  if (rest == null || typeof rest !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (rest);
  if (!isNonNegativeInteger(r.minParticipantRestMinutes)) return null;
  const team =
    r.minTeamRestMinutes === undefined || r.minTeamRestMinutes === null
      ? 0
      : r.minTeamRestMinutes;
  if (!isNonNegativeInteger(team)) return null;
  return {
    minParticipantRestMinutes: /** @type {number} */ (
      r.minParticipantRestMinutes
    ),
    minTeamRestMinutes: /** @type {number} */ (team),
  };
}

/**
 * @param {{
 *   ok: boolean,
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 *   request: unknown,
 *   candidate: unknown,
 *   plan?: Record<string, unknown>|null,
 * }} args
 */
function buildResult(args) {
  const sorted = sortScheduleDiagnostics(args.diagnostics);
  const violations = sorted.filter(
    (d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR
  );
  const certification = args.ok
    ? CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_CERTIFIED
    : CONSTRAINT_CERTIFICATION.HARD_CONSTRAINTS_REJECTED;

  let requestFingerprint;
  let candidateFingerprint;
  try {
    requestFingerprint = fingerprintScheduleRequest(args.request);
  } catch {
    requestFingerprint = "";
  }
  try {
    candidateFingerprint = fingerprintBaselineScheduleCandidate(
      args.candidate ?? { plan: args.plan }
    );
  } catch {
    candidateFingerprint = "";
  }

  return {
    ok: args.ok,
    status: CONSTRAINT_CERTIFICATION_RESULT_STATUS,
    certification,
    candidateStatus: BASELINE_CANDIDATE_STATUS,
    violations,
    diagnostics: sorted,
    checkedConstraintCodes: [...CHECKED_CONSTRAINT_CODES],
    deferredConstraintCodes: [...DEFERRED_CONSTRAINT_CODES],
    replay: createScheduleReplayMetadata({
      engineId: SCHEDULE_ENGINE_IDENTITY.id,
      engineVersion: SCHEDULE_ENGINE_IDENTITY.version,
      inputFingerprint: requestFingerprint,
      resultFingerprint: candidateFingerprint,
      details: {
        status: CONSTRAINT_CERTIFICATION_RESULT_STATUS,
        certification,
        candidateStatus: BASELINE_CANDIDATE_STATUS,
        checkedConstraintCodes: [...CHECKED_CONSTRAINT_CODES],
        deferredConstraintCodes: [...DEFERRED_CONSTRAINT_CODES],
      },
    }),
  };
}
