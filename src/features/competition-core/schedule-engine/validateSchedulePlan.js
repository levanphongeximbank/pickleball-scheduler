/**
 * CORE-11 — pure SchedulePlan / result validation (fail-closed).
 *
 * Deferred (later phases — codes may appear in plans but are not computed here):
 * - participant/team overlap
 * - rest interval enforcement
 * - dependency timing / order
 * - capacity usage vs maxConcurrentMatches
 * - match-outside-window placement checks
 * - unschedulable / incomplete schedule outcomes from the executor
 */

import { SCHEDULE_DIAGNOSTIC_SEVERITY, SCHEDULE_ENGINE_IDENTITY } from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  assignmentBoundaryCodeForField,
  createScheduleDiagnostic,
  isScheduleDiagnosticCode,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  collectForbiddenAssignmentFieldPaths,
  createSchedulePlan,
  normalizeScheduledOrder,
  normalizeUnscheduledOrder,
} from "./scheduleContracts.js";
import {
  isNonNegativeInteger,
  isValidCivilDate,
  isValidIdentifier,
  isValidIanaTimezone,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
} from "./scheduleTypes.js";
import { isScheduleDiagnosticSeverity } from "./scheduleConstants.js";

/**
 * @typedef {Object} SchedulePlanValidationResult
 * @property {boolean} ok
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {import('./scheduleTypes.js').SchedulePlan|null} plan
 */

/**
 * @param {unknown} plan
 * @returns {SchedulePlanValidationResult}
 */
export function validateSchedulePlan(plan) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];

  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (plan == null || typeof plan !== "object" || Array.isArray(plan)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "",
      message: "SchedulePlan must be a plain object",
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      plan: null,
    };
  }

  const input = /** @type {Record<string, unknown>} */ (plan);

  if (!isValidIdentifier(input.competitionId)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "competitionId",
      message: "competitionId must be a non-empty trimmed string",
    });
  }

  if (!normalizeIdentifier(input.timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required (explicit IANA)",
    });
  } else if (!isValidIanaTimezone(input.timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: `timezone is not a supported IANA id: ${normalizeIdentifier(input.timezone)}`,
    });
  }

  if (!Array.isArray(input.scheduled)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "scheduled",
      message: "scheduled must be an array",
    });
  }
  if (!Array.isArray(input.unscheduled)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "unscheduled",
      message: "unscheduled must be an array",
    });
  }
  if (!Array.isArray(input.diagnostics)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "diagnostics",
      message: "diagnostics must be an array",
    });
  }

  /** @type {Set<string>} */
  const scheduledIds = new Set();
  /** @type {Set<string>} */
  const unscheduledIds = new Set();

  if (Array.isArray(input.scheduled)) {
    input.scheduled.forEach((raw, index) => {
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
      if (!isValidIdentifier(matchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
          path: `${path}.matchId`,
          message: "matchId must be a non-empty trimmed string",
        });
      } else if (scheduledIds.has(matchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
          path: `${path}.matchId`,
          message: `duplicate scheduled matchId: ${matchId}`,
          relatedMatchIds: [matchId],
        });
      } else {
        scheduledIds.add(matchId);
      }

      validateCivilInterval(item.start, item.end, path, matchId, push);

      if (item.sessionId !== undefined && item.sessionId !== null) {
        if (!isValidIdentifier(item.sessionId)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
            path: `${path}.sessionId`,
            message: "sessionId must be a non-empty trimmed string when supplied",
            relatedMatchIds: matchId ? [matchId] : [],
          });
        }
      }

      if (!isNonNegativeInteger(item.sequence)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path: `${path}.sequence`,
          message: "sequence must be a non-negative integer",
          relatedMatchIds: matchId ? [matchId] : [],
        });
      }

      if (item.abstractSlotIndex !== undefined && item.abstractSlotIndex !== null) {
        if (!isNonNegativeInteger(item.abstractSlotIndex)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
            path: `${path}.abstractSlotIndex`,
            message: "abstractSlotIndex must be a non-negative integer when supplied",
            relatedMatchIds: matchId ? [matchId] : [],
          });
        }
      }

      if (item.requiredCapacity !== undefined && item.requiredCapacity !== null) {
        if (!isNonNegativeInteger(item.requiredCapacity)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
            path: `${path}.requiredCapacity`,
            message: "requiredCapacity must be a non-negative integer when supplied",
            relatedMatchIds: matchId ? [matchId] : [],
          });
        }
      }
    });
  }

  if (Array.isArray(input.unscheduled)) {
    input.unscheduled.forEach((raw, index) => {
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
      if (!isValidIdentifier(matchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
          path: `${path}.matchId`,
          message: "matchId must be a non-empty trimmed string",
        });
      } else if (unscheduledIds.has(matchId)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
          path: `${path}.matchId`,
          message: `duplicate unscheduled matchId: ${matchId}`,
          relatedMatchIds: [matchId],
        });
      } else {
        unscheduledIds.add(matchId);
      }
    });
  }

  for (const matchId of scheduledIds) {
    if (unscheduledIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path: "scheduled",
        message: `match cannot be both scheduled and unscheduled: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    }
  }

  if (Array.isArray(input.diagnostics)) {
    input.diagnostics.forEach((raw, index) => {
      const path = `diagnostics[${index}]`;
      if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path,
          message: "diagnostic entry must be an object",
        });
        return;
      }
      const d = /** @type {Record<string, unknown>} */ (raw);
      if (!isScheduleDiagnosticCode(d.code)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path: `${path}.code`,
          message: "diagnostic code is unknown or missing",
          details: { code: d.code ?? null },
        });
      }
      if (d.severity != null && !isScheduleDiagnosticSeverity(d.severity)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path: `${path}.severity`,
          message: "diagnostic severity is unknown",
          details: { severity: d.severity },
        });
      }
      if (d.message != null && typeof d.message !== "string") {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path: `${path}.message`,
          message: "diagnostic message must be a string when provided",
        });
      }
      if (d.relatedMatchIds != null && !Array.isArray(d.relatedMatchIds)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
          path: `${path}.relatedMatchIds`,
          message: "relatedMatchIds must be an array when provided",
        });
      }
    });
  }

  if (input.replay !== undefined && input.replay !== null) {
    validateReplay(input.replay, push);
  }

  // producedAt is non-semantic; validate shape only when present.
  if (input.producedAt !== undefined && input.producedAt !== null) {
    if (typeof input.producedAt !== "string" || !String(input.producedAt).trim()) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
        path: "producedAt",
        message: "producedAt must be a non-empty string when provided (non-semantic metadata)",
      });
    }
  }

  for (const hit of collectForbiddenAssignmentFieldPaths({
    competitionId: input.competitionId,
    timezone: input.timezone,
    scheduled: input.scheduled,
    unscheduled: input.unscheduled,
    replay: input.replay,
  })) {
    push({
      code: assignmentBoundaryCodeForField(hit.field),
      path: hit.path,
      message: `Forbidden canonical assignment field: ${hit.field}`,
      details: { field: hit.field },
    });
  }

  const sorted = sortScheduleDiagnostics(diagnostics);
  const hasError = sorted.some((d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR);

  let normalizedPlan = null;
  if (!hasError) {
    normalizedPlan = createSchedulePlan({
      competitionId: normalizeIdentifier(input.competitionId),
      timezone: normalizeIdentifier(input.timezone),
      scheduled: normalizeScheduledOrder(
        /** @type {any[]} */ (input.scheduled || [])
      ),
      unscheduled: normalizeUnscheduledOrder(
        /** @type {any[]} */ (input.unscheduled || [])
      ),
      diagnostics: sortScheduleDiagnostics(
        (/** @type {any[]} */ (input.diagnostics || [])).map((d) =>
          createScheduleDiagnostic(d)
        )
      ),
      replay:
        input.replay && typeof input.replay === "object"
          ? /** @type {any} */ (input.replay)
          : undefined,
      producedAt:
        typeof input.producedAt === "string" ? input.producedAt : undefined,
      metadata:
        input.metadata && typeof input.metadata === "object"
          ? /** @type {any} */ (input.metadata)
          : undefined,
    });
  }

  return {
    ok: !hasError,
    diagnostics: sorted,
    plan: normalizedPlan,
  };
}

/**
 * ScheduleResultValidator port implementation (pure).
 * @type {import('./scheduleTypes.js').ScheduleResultValidator}
 */
export const scheduleResultValidator = Object.freeze({
  validateSchedulePlan,
});

/**
 * @param {unknown} start
 * @param {unknown} end
 * @param {string} path
 * @param {string} matchId
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 */
function validateCivilInterval(start, end, path, matchId, push) {
  const related = matchId ? [matchId] : [];
  if (start == null || typeof start !== "object" || Array.isArray(start)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
      path: `${path}.start`,
      message: "start must be a CivilScheduleTime object",
      relatedMatchIds: related,
    });
  } else {
    const s = /** @type {Record<string, unknown>} */ (start);
    if (!isValidCivilDate(s.date)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
        path: `${path}.start.date`,
        message: "start.date must be valid YYYY-MM-DD",
        relatedMatchIds: related,
      });
    }
    if (!isValidMinutesFromMidnight(s.minutesFromMidnight)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.start.minutesFromMidnight`,
        message: "start.minutesFromMidnight must be an integer 0..1439",
        relatedMatchIds: related,
      });
    }
  }

  if (end == null || typeof end !== "object" || Array.isArray(end)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
      path: `${path}.end`,
      message: "end must be a CivilScheduleTime object",
      relatedMatchIds: related,
    });
  } else {
    const e = /** @type {Record<string, unknown>} */ (end);
    if (!isValidCivilDate(e.date)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_DATE,
        path: `${path}.end.date`,
        message: "end.date must be valid YYYY-MM-DD",
        relatedMatchIds: related,
      });
    }
    if (!isValidMinutesFromMidnight(e.minutesFromMidnight)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
        path: `${path}.end.minutesFromMidnight`,
        message: "end.minutesFromMidnight must be an integer 0..1439",
        relatedMatchIds: related,
      });
    }
  }

  if (
    start &&
    end &&
    typeof start === "object" &&
    typeof end === "object" &&
    !Array.isArray(start) &&
    !Array.isArray(end)
  ) {
    const s = /** @type {Record<string, unknown>} */ (start);
    const e = /** @type {Record<string, unknown>} */ (end);
    if (
      isValidCivilDate(s.date) &&
      isValidCivilDate(e.date) &&
      isValidMinutesFromMidnight(s.minutesFromMidnight) &&
      isValidMinutesFromMidnight(e.minutesFromMidnight)
    ) {
      const startDate = normalizeIdentifier(s.date);
      const endDate = normalizeIdentifier(e.date);
      if (startDate !== endDate) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.OVERNIGHT_WINDOW_NOT_SUPPORTED,
          path,
          message: "scheduled match start/end must remain on one civil date (Phase 1 REJECT overnight)",
          relatedMatchIds: related,
          details: { startDate, endDate },
        });
      } else {
        const startM = /** @type {number} */ (s.minutesFromMidnight);
        const endM = /** @type {number} */ (e.minutesFromMidnight);
        if (endM <= startM) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIME_WINDOW,
            path,
            message: "scheduled end must be after start (end exclusive boundary on same civil date)",
            relatedMatchIds: related,
            details: { startMinutes: startM, endMinutes: endM },
          });
        }
      }
    }
  }
}

/**
 * @param {unknown} replay
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 */
function validateReplay(replay, push) {
  if (typeof replay !== "object" || Array.isArray(replay)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "replay",
      message: "replay metadata must be a plain object",
    });
    return;
  }
  const r = /** @type {Record<string, unknown>} */ (replay);
  if (!isValidIdentifier(r.engineId)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "replay.engineId",
      message: "replay.engineId must be a non-empty trimmed string",
    });
  } else if (normalizeIdentifier(r.engineId) !== SCHEDULE_ENGINE_IDENTITY.id) {
    // Structural validity allows other engine ids only if non-empty; warn via invalid plan
    // for Phase 1B we accept any valid identifier string for replay.engineId shape.
  }
  if (!isValidIdentifier(r.engineVersion)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "replay.engineVersion",
      message: "replay.engineVersion must be a non-empty trimmed string",
    });
  }
  if (r.inputFingerprint != null && typeof r.inputFingerprint !== "string") {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "replay.inputFingerprint",
      message: "inputFingerprint must be a string when provided",
    });
  }
  if (r.resultFingerprint != null && typeof r.resultFingerprint !== "string") {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "replay.resultFingerprint",
      message: "resultFingerprint must be a string when provided",
    });
  }
  if (r.details != null && (typeof r.details !== "object" || Array.isArray(r.details))) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_PLAN,
      path: "replay.details",
      message: "replay.details must be a plain object when provided",
    });
  }
}
