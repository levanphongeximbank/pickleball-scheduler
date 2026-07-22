/**
 * CORE-11 — factory-backed canonical records.
 * No Date.now(), Math.random(), or machine-local timezone injection.
 */

import {
  FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS,
  SCHEDULE_ENGINE_IDENTITY,
  SCHEDULE_SCHEMA_VERSION,
} from "./scheduleConstants.js";
import {
  asciiCompare,
  copyPlainObject,
  isValidCivilDate,
  isValidIdentifier,
  isValidIanaTimezone,
  isValidMinutesFromMidnight,
  normalizeIdentifier,
  serializeCanonical,
  stableSortByKeys,
} from "./scheduleTypes.js";
import { createScheduleDiagnostic, sortScheduleDiagnostics } from "./scheduleDiagnostics.js";

/**
 * @param {Partial<import('./scheduleTypes.js').CivilScheduleTime>} [partial]
 * @returns {import('./scheduleTypes.js').CivilScheduleTime}
 */
export function createCivilScheduleTime(partial = {}) {
  return {
    date: normalizeIdentifier(partial.date),
    minutesFromMidnight:
      partial.minutesFromMidnight === undefined || partial.minutesFromMidnight === null
        ? NaN
        : Number(partial.minutesFromMidnight),
  };
}

/**
 * @param {Partial<import('./scheduleTypes.js').SchedulingWindow>} [partial]
 * @returns {import('./scheduleTypes.js').SchedulingWindow}
 */
export function createSchedulingWindow(partial = {}) {
  /** @type {import('./scheduleTypes.js').SchedulingWindow} */
  const out = {
    date: normalizeIdentifier(partial.date),
    startMinutes:
      partial.startMinutes === undefined || partial.startMinutes === null
        ? NaN
        : Number(partial.startMinutes),
    endMinutes:
      partial.endMinutes === undefined || partial.endMinutes === null
        ? NaN
        : Number(partial.endMinutes),
  };
  if (partial.timezone != null && String(partial.timezone).trim()) {
    out.timezone = normalizeIdentifier(partial.timezone);
  }
  if (partial.windowId != null && String(partial.windowId).trim()) {
    out.windowId = normalizeIdentifier(partial.windowId);
  }
  if (partial.label != null && String(partial.label).trim()) {
    out.label = String(partial.label).trim();
  }
  if (partial.sequence !== undefined && partial.sequence !== null) {
    out.sequence = Number(partial.sequence);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').SessionWindow>} [partial]
 * @returns {import('./scheduleTypes.js').SessionWindow}
 */
export function createSessionWindow(partial = {}) {
  /** @type {import('./scheduleTypes.js').SessionWindow} */
  const out = {
    sessionId: normalizeIdentifier(partial.sessionId),
    date: normalizeIdentifier(partial.date),
    startMinutes:
      partial.startMinutes === undefined || partial.startMinutes === null
        ? NaN
        : Number(partial.startMinutes),
    endMinutes:
      partial.endMinutes === undefined || partial.endMinutes === null
        ? NaN
        : Number(partial.endMinutes),
  };
  if (partial.timezone != null && String(partial.timezone).trim()) {
    out.timezone = normalizeIdentifier(partial.timezone);
  }
  if (partial.label != null && String(partial.label).trim()) {
    out.label = String(partial.label).trim();
  }
  if (partial.sequence !== undefined && partial.sequence !== null) {
    out.sequence = Number(partial.sequence);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduleParticipantReference>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduleParticipantReference}
 */
export function createScheduleParticipantReference(partial = {}) {
  /** @type {import('./scheduleTypes.js').ScheduleParticipantReference} */
  const out = {
    participantId: normalizeIdentifier(partial.participantId),
  };
  if (partial.teamId != null && String(partial.teamId).trim()) {
    out.teamId = normalizeIdentifier(partial.teamId);
  }
  if (partial.side != null && String(partial.side).trim()) {
    out.side = normalizeIdentifier(partial.side);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduleDependency>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduleDependency}
 */
export function createScheduleDependency(partial = {}) {
  /** @type {import('./scheduleTypes.js').ScheduleDependency} */
  const out = {
    sourceMatchId: normalizeIdentifier(
      partial.sourceMatchId ??
        /** @type {{ sourceMatchId?: unknown }} */ (partial).sourceMatchId
    ),
  };
  if (partial.type != null && String(partial.type).trim()) {
    out.type = normalizeIdentifier(partial.type);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduleMatchInput>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduleMatchInput}
 */
export function createScheduleMatchInput(partial = {}) {
  const participants = Array.isArray(partial.participants)
    ? partial.participants.map((p) => createScheduleParticipantReference(p || {}))
    : [];
  const dependencies = Array.isArray(partial.dependencies)
    ? partial.dependencies.map((d) => createScheduleDependency(d || {}))
    : [];

  /** @type {import('./scheduleTypes.js').ScheduleMatchInput} */
  const out = {
    matchId: normalizeIdentifier(partial.matchId),
    participants,
    dependencies,
    isBye: partial.isBye === true,
  };

  if (partial.divisionId != null && String(partial.divisionId).trim()) {
    out.divisionId = normalizeIdentifier(partial.divisionId);
  }
  if (partial.stageId != null && String(partial.stageId).trim()) {
    out.stageId = normalizeIdentifier(partial.stageId);
  }
  if (partial.roundNumber !== undefined && partial.roundNumber !== null) {
    out.roundNumber = Number(partial.roundNumber);
  }
  if (partial.sequence !== undefined && partial.sequence !== null) {
    out.sequence = Number(partial.sequence);
  }
  if (
    partial.estimatedDurationMinutes !== undefined &&
    partial.estimatedDurationMinutes !== null
  ) {
    out.estimatedDurationMinutes = Number(partial.estimatedDurationMinutes);
  }
  if (partial.priority !== undefined && partial.priority !== null) {
    out.priority = Number(partial.priority);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').MatchDurationPolicy>} [partial]
 * @returns {import('./scheduleTypes.js').MatchDurationPolicy}
 */
export function createMatchDurationPolicy(partial = {}) {
  /** @type {import('./scheduleTypes.js').MatchDurationPolicy} */
  const out = {
    defaultDurationMinutes:
      partial.defaultDurationMinutes === undefined ||
      partial.defaultDurationMinutes === null
        ? NaN
        : Number(partial.defaultDurationMinutes),
  };
  if (partial.bufferMinutes !== undefined && partial.bufferMinutes !== null) {
    out.bufferMinutes = Number(partial.bufferMinutes);
  }
  if (partial.durationByRound && typeof partial.durationByRound === "object") {
    out.durationByRound = Object.freeze(copyPlainObject(partial.durationByRound));
  }
  if (partial.durationByStage && typeof partial.durationByStage === "object") {
    out.durationByStage = Object.freeze(copyPlainObject(partial.durationByStage));
  }
  return out;
}

/**
 * Hard minimum rest. Zero disables that specific requirement.
 * No generic `strict: false` switch.
 *
 * @param {Partial<import('./scheduleTypes.js').RestPolicy>} [partial]
 * @returns {import('./scheduleTypes.js').RestPolicy}
 */
export function createRestPolicy(partial = {}) {
  /** @type {import('./scheduleTypes.js').RestPolicy} */
  const out = {
    minParticipantRestMinutes:
      partial.minParticipantRestMinutes === undefined ||
      partial.minParticipantRestMinutes === null
        ? NaN
        : Number(partial.minParticipantRestMinutes),
  };
  if (
    partial.minTeamRestMinutes !== undefined &&
    partial.minTeamRestMinutes !== null
  ) {
    out.minTeamRestMinutes = Number(partial.minTeamRestMinutes);
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').CapacityPolicy>} [partial]
 * @returns {import('./scheduleTypes.js').CapacityPolicy}
 */
export function createCapacityPolicy(partial = {}) {
  return {
    maxConcurrentMatches:
      partial.maxConcurrentMatches === undefined ||
      partial.maxConcurrentMatches === null
        ? NaN
        : Number(partial.maxConcurrentMatches),
  };
}

/**
 * @param {Partial<import('./scheduleTypes.js').SchedulePolicy>} [partial]
 * @returns {import('./scheduleTypes.js').SchedulePolicy}
 */
export function createSchedulePolicy(partial = {}) {
  return {
    duration: createMatchDurationPolicy(partial.duration || {}),
    rest: createRestPolicy(partial.rest || {}),
    capacity: createCapacityPolicy(partial.capacity || {}),
  };
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduleRequest>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduleRequest}
 */
export function createScheduleRequest(partial = {}) {
  const matches = Array.isArray(partial.matches)
    ? partial.matches.map((m) => createScheduleMatchInput(m || {}))
    : [];
  const operatingWindows = Array.isArray(partial.operatingWindows)
    ? partial.operatingWindows.map((w) => createSchedulingWindow(w || {}))
    : [];
  const sessionWindows = Array.isArray(partial.sessionWindows)
    ? partial.sessionWindows.map((w) => createSessionWindow(w || {}))
    : [];

  /** @type {import('./scheduleTypes.js').ScheduleRequest} */
  const out = {
    competitionId: normalizeIdentifier(partial.competitionId),
    timezone: normalizeIdentifier(partial.timezone),
    matches,
    policy: createSchedulePolicy(partial.policy || {}),
    operatingWindows,
    sessionWindows,
  };
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduledMatch> & Record<string, unknown>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduledMatch}
 */
export function createScheduledMatch(partial = {}) {
  /** @type {import('./scheduleTypes.js').ScheduledMatch & Record<string, unknown>} */
  const out = {
    matchId: normalizeIdentifier(partial.matchId),
    start: createCivilScheduleTime(partial.start || {}),
    end: createCivilScheduleTime(partial.end || {}),
    sequence:
      partial.sequence === undefined || partial.sequence === null
        ? NaN
        : Number(partial.sequence),
  };
  if (partial.sessionId != null && String(partial.sessionId).trim()) {
    out.sessionId = normalizeIdentifier(partial.sessionId);
  }
  if (
    partial.abstractSlotIndex !== undefined &&
    partial.abstractSlotIndex !== null
  ) {
    out.abstractSlotIndex = Number(partial.abstractSlotIndex);
  }
  if (
    partial.requiredCapacity !== undefined &&
    partial.requiredCapacity !== null
  ) {
    out.requiredCapacity = Number(partial.requiredCapacity);
  }
  // Phase 1E baseline extensions (backward-compatible optional fields).
  if (
    partial.durationMinutes !== undefined &&
    partial.durationMinutes !== null
  ) {
    out.durationMinutes = Number(partial.durationMinutes);
  }
  if (partial.bufferMinutes !== undefined && partial.bufferMinutes !== null) {
    out.bufferMinutes = Number(partial.bufferMinutes);
  }
  if (
    partial.concurrencyIndex !== undefined &&
    partial.concurrencyIndex !== null
  ) {
    out.concurrencyIndex = Number(partial.concurrencyIndex);
  }
  if (partial.startUtcMs !== undefined && partial.startUtcMs !== null) {
    out.startUtcMs = Number(partial.startUtcMs);
  }
  if (partial.endUtcMs !== undefined && partial.endUtcMs !== null) {
    out.endUtcMs = Number(partial.endUtcMs);
  }
  if (partial.startUtcIso != null && String(partial.startUtcIso).trim()) {
    out.startUtcIso = String(partial.startUtcIso).trim();
  }
  if (partial.endUtcIso != null && String(partial.endUtcIso).trim()) {
    out.endUtcIso = String(partial.endUtcIso).trim();
  }
  if (
    partial.capacityReleaseUtcMs !== undefined &&
    partial.capacityReleaseUtcMs !== null
  ) {
    out.capacityReleaseUtcMs = Number(partial.capacityReleaseUtcMs);
  }
  if (
    partial.capacityReleaseUtcIso != null &&
    String(partial.capacityReleaseUtcIso).trim()
  ) {
    out.capacityReleaseUtcIso = String(partial.capacityReleaseUtcIso).trim();
  }
  if (partial.sourceWindowId != null && String(partial.sourceWindowId).trim()) {
    out.sourceWindowId = normalizeIdentifier(partial.sourceWindowId);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').UnscheduledMatch>} [partial]
 * @returns {import('./scheduleTypes.js').UnscheduledMatch}
 */
export function createUnscheduledMatch(partial = {}) {
  /** @type {import('./scheduleTypes.js').UnscheduledMatch} */
  const out = {
    matchId: normalizeIdentifier(partial.matchId),
  };
  if (partial.reasonCode != null && String(partial.reasonCode).trim()) {
    out.reasonCode = normalizeIdentifier(partial.reasonCode);
  }
  if (partial.message != null) {
    out.message = String(partial.message);
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').ScheduleReplayMetadata>} [partial]
 * @returns {import('./scheduleTypes.js').ScheduleReplayMetadata}
 */
export function createScheduleReplayMetadata(partial = {}) {
  /** @type {import('./scheduleTypes.js').ScheduleReplayMetadata} */
  const out = {
    engineId:
      partial.engineId === undefined || partial.engineId === null
        ? SCHEDULE_ENGINE_IDENTITY.id
        : normalizeIdentifier(partial.engineId),
    engineVersion:
      partial.engineVersion === undefined || partial.engineVersion === null
        ? SCHEDULE_ENGINE_IDENTITY.version
        : normalizeIdentifier(partial.engineVersion),
  };
  if (partial.inputFingerprint != null && String(partial.inputFingerprint).trim()) {
    out.inputFingerprint = String(partial.inputFingerprint).trim();
  }
  if (partial.resultFingerprint != null && String(partial.resultFingerprint).trim()) {
    out.resultFingerprint = String(partial.resultFingerprint).trim();
  }
  if (partial.details && typeof partial.details === "object") {
    out.details = Object.freeze(copyPlainObject(partial.details));
  }
  return out;
}

/**
 * @param {Partial<import('./scheduleTypes.js').SchedulePlan>} [partial]
 * @returns {import('./scheduleTypes.js').SchedulePlan}
 */
export function createSchedulePlan(partial = {}) {
  const scheduled = Array.isArray(partial.scheduled)
    ? partial.scheduled.map((m) => createScheduledMatch(m || {}))
    : [];
  const unscheduled = Array.isArray(partial.unscheduled)
    ? partial.unscheduled.map((m) => createUnscheduledMatch(m || {}))
    : [];
  const diagnostics = Array.isArray(partial.diagnostics)
    ? sortScheduleDiagnostics(
        partial.diagnostics.map((d) => {
          if (d == null || typeof d !== "object") {
            return createScheduleDiagnostic({
              code: "INVALID_SCHEDULE_PLAN",
              message: "diagnostic entry must be an object",
            });
          }
          // Do not silently remap unknown codes — preserve for validator fail-closed.
          return createScheduleDiagnostic(
            /** @type {Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }} */ (
              d
            )
          );
        })
      )
    : [];

  /** @type {import('./scheduleTypes.js').SchedulePlan} */
  const out = {
    competitionId: normalizeIdentifier(partial.competitionId),
    timezone: normalizeIdentifier(partial.timezone),
    scheduled: normalizeScheduledOrder(scheduled),
    unscheduled: normalizeUnscheduledOrder(unscheduled),
    diagnostics,
  };

  if (partial.replay && typeof partial.replay === "object") {
    out.replay = createScheduleReplayMetadata(partial.replay);
  }
  // producedAt is optional non-semantic metadata — never auto-injected.
  if (partial.producedAt != null && String(partial.producedAt).trim()) {
    out.producedAt = String(partial.producedAt).trim();
  }
  if (partial.metadata && typeof partial.metadata === "object") {
    out.metadata = Object.freeze(copyPlainObject(partial.metadata));
  }
  return out;
}

/**
 * @param {import('./scheduleTypes.js').ScheduledMatch[]} scheduled
 * @returns {import('./scheduleTypes.js').ScheduledMatch[]}
 */
export function normalizeScheduledOrder(scheduled) {
  return stableSortByKeys(scheduled || [], (m) => [
    m?.start?.date ?? "",
    m?.start?.minutesFromMidnight ?? -1,
    m?.sequence ?? -1,
    m?.abstractSlotIndex ?? -1,
    m?.matchId ?? "",
  ]);
}

/**
 * @param {import('./scheduleTypes.js').UnscheduledMatch[]} unscheduled
 * @returns {import('./scheduleTypes.js').UnscheduledMatch[]}
 */
export function normalizeUnscheduledOrder(unscheduled) {
  return stableSortByKeys(unscheduled || [], (m) => [
    m?.matchId ?? "",
    m?.reasonCode ?? "",
    m?.message ?? "",
  ]);
}

/**
 * Semantic fingerprint material excludes producedAt (non-semantic wall clock).
 *
 * @param {import('./scheduleTypes.js').SchedulePlan|object|null|undefined} plan
 * @returns {object|null}
 */
export function projectSchedulePlanForFingerprint(plan) {
  if (!plan || typeof plan !== "object") return null;
  const {
    producedAt: _producedAt,
    ...rest
  } = /** @type {Record<string, unknown>} */ (plan);
  return {
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
    engineId: SCHEDULE_ENGINE_IDENTITY.id,
    engineVersion: SCHEDULE_ENGINE_IDENTITY.version,
    competitionId: rest.competitionId ?? "",
    timezone: rest.timezone ?? "",
    scheduled: normalizeScheduledOrder(
      Array.isArray(rest.scheduled) ? /** @type {any[]} */ (rest.scheduled) : []
    ),
    unscheduled: normalizeUnscheduledOrder(
      Array.isArray(rest.unscheduled) ? /** @type {any[]} */ (rest.unscheduled) : []
    ),
    diagnostics: sortScheduleDiagnostics(
      Array.isArray(rest.diagnostics) ? /** @type {any[]} */ (rest.diagnostics) : []
    ),
    replay: rest.replay ?? null,
    metadata: rest.metadata ?? {},
  };
}

/**
 * @param {import('./scheduleTypes.js').SchedulePlan|object|null|undefined} plan
 * @returns {string}
 */
export function fingerprintSchedulePlan(plan) {
  return serializeCanonical(projectSchedulePlanForFingerprint(plan));
}

/**
 * Semantic equality ignoring producedAt.
 *
 * @param {import('./scheduleTypes.js').SchedulePlan|object|null|undefined} a
 * @param {import('./scheduleTypes.js').SchedulePlan|object|null|undefined} b
 * @returns {boolean}
 */
export function schedulePlansSemanticallyEqual(a, b) {
  return fingerprintSchedulePlan(a) === fingerprintSchedulePlan(b);
}

/**
 * Collect forbidden assignment field paths on decision surfaces (not inside metadata).
 *
 * @param {unknown} value
 * @param {string} [basePath]
 * @returns {{ path: string, field: string }[]}
 */
export function collectForbiddenAssignmentFieldPaths(value, basePath = "") {
  /** @type {{ path: string, field: string }[]} */
  const found = [];
  if (!value || typeof value !== "object") return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(
        ...collectForbiddenAssignmentFieldPaths(
          item,
          basePath ? `${basePath}[${index}]` : `[${index}]`
        )
      );
    });
    return found;
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  for (const key of Object.keys(record)) {
    const path = basePath ? `${basePath}.${key}` : key;
    if (FORBIDDEN_CANONICAL_ASSIGNMENT_FIELDS.has(key)) {
      found.push({ path, field: key });
      continue;
    }
    // Opaque metadata must not control invariants — do not recurse into it.
    if (key === "metadata" || key === "details") {
      continue;
    }
    found.push(...collectForbiddenAssignmentFieldPaths(record[key], path));
  }
  return found;
}

/**
 * Optional CORE-10 port shape check (never invoked by Phase 1B runtime).
 *
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesScheduleOptimizerPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {{ optimizeSchedule?: unknown }} */ (port).optimizeSchedule ===
      "function"
  );
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesScheduleCapacityPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {{ resolveMaxConcurrentMatches?: unknown }} */ (port)
      .resolveMaxConcurrentMatches === "function"
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStructuralCivilScheduleTime(value) {
  if (!value || typeof value !== "object") return false;
  const t = /** @type {import('./scheduleTypes.js').CivilScheduleTime} */ (value);
  return isValidCivilDate(t.date) && isValidMinutesFromMidnight(t.minutesFromMidnight);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStructuralIdentifierField(value) {
  return isValidIdentifier(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isStructuralTimezone(value) {
  return isValidIanaTimezone(value);
}

export { asciiCompare };
