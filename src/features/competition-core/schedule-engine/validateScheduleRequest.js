/**
 * CORE-11 — pure ScheduleRequest validation (fail-closed).
 *
 * Deferred to Phase 1D / later:
 * - dependency graph cycle detection (CYCLIC_MATCH_DEPENDENCY)
 * - dependency order / timing (DEPENDENCY_ORDER_VIOLATION)
 * - participant/team overlap, rest intervals, capacity usage
 * - match-outside-window at placement time
 * - scheduler incompleteness
 */

import { SCHEDULE_DIAGNOSTIC_SEVERITY } from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  assignmentBoundaryCodeForField,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  collectForbiddenAssignmentFieldPaths,
  createScheduleRequest,
} from "./scheduleContracts.js";
import { normalizeOperatingWindows } from "./normalizeOperatingWindows.js";
import { normalizeSessionWindows } from "./normalizeSessionWindows.js";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isValidIdentifier,
  isValidIanaTimezone,
  normalizeIdentifier,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} ScheduleRequestValidationResult
 * @property {boolean} ok
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @property {import('./scheduleTypes.js').ScheduleRequest|null} request
 */

/**
 * @param {unknown} request
 * @returns {ScheduleRequestValidationResult}
 */
export function validateScheduleRequest(request) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];

  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      path: "",
      message: "ScheduleRequest must be a plain object",
    });
    return {
      ok: false,
      diagnostics: sortScheduleDiagnostics(diagnostics),
      request: null,
    };
  }

  const input = /** @type {Record<string, unknown>} */ (request);

  // Fail-closed: never silently correct material domain errors in factory path
  // used only for normalized output after structural checks.
  const normalized = createScheduleRequest(
    /** @type {Partial<import('./scheduleTypes.js').ScheduleRequest>} */ (input)
  );

  if (!isValidIdentifier(normalized.competitionId)) {
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
  } else if (!isValidIanaTimezone(normalized.timezone)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: `timezone is not a supported IANA id: ${normalized.timezone}`,
      details: { timezone: normalized.timezone },
    });
  }

  if (!Array.isArray(input.matches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      path: "matches",
      message: "matches must be an array",
    });
  }

  /** @type {Set<string>} */
  const matchIds = new Set();
  const matches = Array.isArray(input.matches) ? input.matches : [];

  matches.forEach((rawMatch, index) => {
    const path = `matches[${index}]`;
    if (rawMatch == null || typeof rawMatch !== "object" || Array.isArray(rawMatch)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        path,
        message: "match entry must be an object",
      });
      return;
    }

    const match = /** @type {Record<string, unknown>} */ (rawMatch);
    const matchId = normalizeIdentifier(match.matchId);

    if (!isValidIdentifier(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: `${path}.matchId`,
        message: "matchId must be a non-empty trimmed string",
      });
    } else if (matchIds.has(matchId)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DUPLICATE_MATCH_ID,
        path: `${path}.matchId`,
        message: `duplicate matchId: ${matchId}`,
        relatedMatchIds: [matchId],
      });
    } else {
      matchIds.add(matchId);
    }

    if (match.participants !== undefined && !Array.isArray(match.participants)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        path: `${path}.participants`,
        message: "participants must be an array when provided",
        relatedMatchIds: matchId ? [matchId] : [],
      });
    } else if (Array.isArray(match.participants)) {
      match.participants.forEach((p, pIndex) => {
        const pPath = `${path}.participants[${pIndex}]`;
        if (p == null || typeof p !== "object" || Array.isArray(p)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
            path: pPath,
            message: "participant reference must be an object",
            relatedMatchIds: matchId ? [matchId] : [],
          });
          return;
        }
        if (!isValidIdentifier(/** @type {Record<string, unknown>} */ (p).participantId)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
            path: `${pPath}.participantId`,
            message: "participantId must be a non-empty trimmed string",
            relatedMatchIds: matchId ? [matchId] : [],
          });
        }
      });
    }

    if (match.dependencies !== undefined && !Array.isArray(match.dependencies)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        path: `${path}.dependencies`,
        message: "dependencies must be an array when provided",
        relatedMatchIds: matchId ? [matchId] : [],
      });
    } else if (Array.isArray(match.dependencies)) {
      /** @type {Set<string>} */
      const depKeys = new Set();
      match.dependencies.forEach((d, dIndex) => {
        const dPath = `${path}.dependencies[${dIndex}]`;
        if (d == null || typeof d !== "object" || Array.isArray(d)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
            path: dPath,
            message: "dependency must be an object",
            relatedMatchIds: matchId ? [matchId] : [],
          });
          return;
        }
        const dep = /** @type {Record<string, unknown>} */ (d);
        const sourceMatchId = normalizeIdentifier(dep.sourceMatchId);
        if (!isValidIdentifier(sourceMatchId)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
            path: `${dPath}.sourceMatchId`,
            message: "sourceMatchId must be a non-empty trimmed string",
            relatedMatchIds: matchId ? [matchId] : [],
          });
          return;
        }
        const typeKey = normalizeIdentifier(dep.type) || "";
        const tupleKey = `${sourceMatchId}\0${typeKey}`;
        if (depKeys.has(tupleKey)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
            path: dPath,
            message: `duplicate dependency tuple (${sourceMatchId}, ${typeKey || "(none)"})`,
            relatedMatchIds: matchId ? [matchId, sourceMatchId] : [sourceMatchId],
            details: { sourceMatchId, type: typeKey || null },
          });
        } else {
          depKeys.add(tupleKey);
        }
      });
    }

    if (
      match.estimatedDurationMinutes !== undefined &&
      match.estimatedDurationMinutes !== null &&
      !isPositiveInteger(match.estimatedDurationMinutes)
    ) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
        path: `${path}.estimatedDurationMinutes`,
        message: "estimatedDurationMinutes must be a positive integer when supplied",
        relatedMatchIds: matchId ? [matchId] : [],
      });
    }

    if (match.isBye === true && matchId) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.BYE_NO_SCHEDULE_REQUIRED,
        severity: SCHEDULE_DIAGNOSTIC_SEVERITY.INFO,
        path: `${path}.isBye`,
        message:
          "Bye match does not consume a time slot or concurrency capacity and is neither scheduled nor unscheduled",
        relatedMatchIds: [matchId],
      });
    }
  });

  // Unknown dependency existence when complete match set is available (no graph walk).
  if (Array.isArray(input.matches)) {
    matches.forEach((rawMatch, index) => {
      if (rawMatch == null || typeof rawMatch !== "object") return;
      const match = /** @type {Record<string, unknown>} */ (rawMatch);
      const matchId = normalizeIdentifier(match.matchId);
      if (!Array.isArray(match.dependencies)) return;
      match.dependencies.forEach((d, dIndex) => {
        if (d == null || typeof d !== "object") return;
        const sourceMatchId = normalizeIdentifier(
          /** @type {Record<string, unknown>} */ (d).sourceMatchId
        );
        if (!sourceMatchId) return;
        if (!matchIds.has(sourceMatchId)) {
          push({
            code: SCHEDULE_DIAGNOSTIC_CODE.UNKNOWN_MATCH_DEPENDENCY,
            path: `matches[${index}].dependencies[${dIndex}].sourceMatchId`,
            message: `dependency sourceMatchId not present in matches: ${sourceMatchId}`,
            relatedMatchIds: matchId ? [matchId, sourceMatchId] : [sourceMatchId],
          });
        }
      });
    });
  }

  validateDurationPolicy(input.policy, push);
  validateRestPolicy(input.policy, push);
  validateCapacityPolicy(input.policy, push);

  const windowNormalization = normalizeRequestWindows(input, push);

  for (const hit of collectForbiddenAssignmentFieldPaths({
    competitionId: input.competitionId,
    timezone: input.timezone,
    matches: input.matches,
    policy: input.policy,
    operatingWindows: input.operatingWindows,
    sessionWindows: input.sessionWindows,
  })) {
    push({
      code: assignmentBoundaryCodeForField(hit.field),
      path: hit.path,
      message: `Forbidden canonical assignment field: ${hit.field}`,
      details: { field: hit.field },
    });
  }

  // metadata must not control canonical invariants — presence alone is fine;
  // forbidden keys inside metadata are ignored as non-decision surface.
  if (input.metadata != null && (typeof input.metadata !== "object" || Array.isArray(input.metadata))) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      path: "metadata",
      message: "metadata must be a plain object when provided",
    });
  }

  const sorted = sortScheduleDiagnostics(diagnostics);
  const hasError = sorted.some((d) => d.severity === SCHEDULE_DIAGNOSTIC_SEVERITY.ERROR);

  let requestOut = null;
  if (!hasError) {
    requestOut = createScheduleRequest({
      ...normalized,
      operatingWindows: windowNormalization.operatingWindows,
      sessionWindows: windowNormalization.sessionWindows,
    });
    // Preserve normalized timezone / identity fields that factories may omit when empty.
    requestOut.operatingWindows = windowNormalization.operatingWindows;
    requestOut.sessionWindows = windowNormalization.sessionWindows;
  }

  return {
    ok: !hasError,
    diagnostics: sorted,
    request: requestOut,
  };
}

/**
 * @param {unknown} policy
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 */
function validateDurationPolicy(policy, push) {
  if (policy == null || typeof policy !== "object" || Array.isArray(policy)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: "policy.duration",
      message: "policy.duration is required",
    });
    return;
  }
  const duration = /** @type {Record<string, unknown>} */ (policy).duration;
  if (duration == null || typeof duration !== "object" || Array.isArray(duration)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: "policy.duration",
      message: "policy.duration must be an object",
    });
    return;
  }
  const d = /** @type {Record<string, unknown>} */ (duration);
  if (!isPositiveInteger(d.defaultDurationMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
      path: "policy.duration.defaultDurationMinutes",
      message: "defaultDurationMinutes must be a positive integer",
    });
  }
  if (d.bufferMinutes !== undefined && d.bufferMinutes !== null) {
    if (!isNonNegativeInteger(d.bufferMinutes)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
        path: "policy.duration.bufferMinutes",
        message: "bufferMinutes must be a non-negative integer",
      });
    }
  }
  for (const mapKey of ["durationByRound", "durationByStage"]) {
    if (d[mapKey] === undefined || d[mapKey] === null) continue;
    if (typeof d[mapKey] !== "object" || Array.isArray(d[mapKey])) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
        path: `policy.duration.${mapKey}`,
        message: `${mapKey} must be a plain object of positive integers`,
      });
      continue;
    }
    for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (d[mapKey]))) {
      if (!isPositiveInteger(v)) {
        push({
          code: SCHEDULE_DIAGNOSTIC_CODE.MATCH_DURATION_INVALID,
          path: `policy.duration.${mapKey}.${k}`,
          message: `${mapKey} values must be positive integers`,
        });
      }
    }
  }
}

/**
 * @param {unknown} policy
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 */
function validateRestPolicy(policy, push) {
  if (policy == null || typeof policy !== "object" || Array.isArray(policy)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
      path: "policy.rest",
      message: "policy.rest is required",
    });
    return;
  }
  const rest = /** @type {Record<string, unknown>} */ (policy).rest;
  if (rest == null || typeof rest !== "object" || Array.isArray(rest)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
      path: "policy.rest",
      message: "policy.rest must be an object",
    });
    return;
  }
  const r = /** @type {Record<string, unknown>} */ (rest);
  if ("strict" in r) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
      path: "policy.rest.strict",
      message: "generic strict switch is not part of canonical RestPolicy",
    });
  }
  if (!isNonNegativeInteger(r.minParticipantRestMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
      path: "policy.rest.minParticipantRestMinutes",
      message: "minParticipantRestMinutes must be a non-negative integer",
    });
  }
  if (r.minTeamRestMinutes !== undefined && r.minTeamRestMinutes !== null) {
    if (!isNonNegativeInteger(r.minTeamRestMinutes)) {
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.REST_POLICY_INVALID,
        path: "policy.rest.minTeamRestMinutes",
        message: "minTeamRestMinutes must be a non-negative integer when supplied",
      });
    }
  }
}

/**
 * @param {unknown} policy
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 */
function validateCapacityPolicy(policy, push) {
  if (policy == null || typeof policy !== "object" || Array.isArray(policy)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity",
      message: "policy.capacity is required",
    });
    return;
  }
  const capacity = /** @type {Record<string, unknown>} */ (policy).capacity;
  if (capacity == null || typeof capacity !== "object" || Array.isArray(capacity)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity",
      message: "policy.capacity must be an object",
    });
    return;
  }
  const c = /** @type {Record<string, unknown>} */ (capacity);
  if (!("maxConcurrentMatches" in c) || c.maxConcurrentMatches === undefined || c.maxConcurrentMatches === null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity.maxConcurrentMatches",
      message: "maxConcurrentMatches is required (no silent default)",
    });
    return;
  }
  if (!isPositiveInteger(c.maxConcurrentMatches)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.CAPACITY_POLICY_INVALID,
      path: "policy.capacity.maxConcurrentMatches",
      message: "maxConcurrentMatches must be a positive integer",
      details: { value: c.maxConcurrentMatches },
    });
  }
}

/**
 * Raw window validation + Phase 1C canonical normalization.
 * Absolute-time derivation is intentionally not performed here.
 *
 * @param {Record<string, unknown>} input
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 * @returns {{ operatingWindows: import('./normalizeOperatingWindows.js').NormalizedOperatingWindow[], sessionWindows: import('./normalizeSessionWindows.js').NormalizedSessionWindow[] }}
 */
function normalizeRequestWindows(input, push) {
  const timezone = normalizeIdentifier(input.timezone);

  const operatingResult = normalizeOperatingWindows(input.operatingWindows, {
    timezone,
    pathPrefix: "operatingWindows",
  });
  for (const d of operatingResult.diagnostics) {
    // Avoid duplicating request-level INVALID_TIMEZONE already emitted above
    // when timezone was blank/invalid — still surface window-local codes.
    if (
      d.code === SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE &&
      d.path === "timezone" &&
      (!timezone || !isValidIanaTimezone(timezone))
    ) {
      continue;
    }
    push(d);
  }

  const sessionResult = normalizeSessionWindows(
    input.sessionWindows,
    operatingResult.ok ? operatingResult.windows : [],
    {
      timezone,
      pathPrefix: "sessionWindows",
    }
  );
  for (const d of sessionResult.diagnostics) {
    if (
      d.code === SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE &&
      d.path === "timezone" &&
      (!timezone || !isValidIanaTimezone(timezone))
    ) {
      continue;
    }
    push(d);
  }

  return {
    operatingWindows: operatingResult.ok ? operatingResult.windows : [],
    sessionWindows: sessionResult.ok ? sessionResult.windows : [],
  };
}
