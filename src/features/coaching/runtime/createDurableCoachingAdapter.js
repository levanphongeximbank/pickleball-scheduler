/**
 * Durable coaching adapter (COACHING-04).
 *
 * Fail-closed on missing tenant/club/actor.
 * MUST NOT import coachingService. MUST NOT fall back to localStorage.
 * On failure, surface error — never call legacy.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { isCoachingError } from "../errors/CoachingError.js";
import { createCoachingRuntimeError, COACHING_RUNTIME_ERROR_CODES } from "./errors.js";

/** Legacy UI collection → readRecords key (list reads only). */
const LIST_READ_MAP = Object.freeze({
  classes: "programs",
  students: "enrollments",
  schedule: "sessions",
  packages: "packages",
  attendance: "attendance",
  evaluations: "evaluations",
  // coaches: no 1:1 surface in readRecords
});

/**
 * Map domain / persistence errors onto runtime result codes.
 * @param {unknown} err
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
function mapDurableFailure(err) {
  if (isCoachingError(err)) {
    if (
      err.code === COACHING_ERROR_CODES.VERSION_CONFLICT ||
      err.code === COACHING_ERROR_CODES.CONFLICT
    ) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT,
        err.message || "Coaching concurrency conflict.",
        err.context
      );
    }
    if (
      err.code === COACHING_ERROR_CODES.UNAUTHORIZED ||
      err.code === COACHING_ERROR_CODES.FORBIDDEN_ACTION ||
      err.code === COACHING_ERROR_CODES.FORBIDDEN_SCOPE
    ) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED,
        err.message || "Coaching authorization denied.",
        err.context
      );
    }
    if (err.code === COACHING_ERROR_CODES.MISSING_ACTOR) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.MISSING_ACTOR,
        err.message || "Coaching actor is required."
      );
    }
    if (err.code === COACHING_ERROR_CODES.MISSING_SCOPE) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
        err.message || "Coaching tenantId and clubId are required."
      );
    }
    if (err.code === COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        err.message || "Durable coaching application is not configured."
      );
    }
  }

  const code = String(err?.code || "");
  if (
    code === COACHING_ERROR_CODES.VERSION_CONFLICT ||
    /VERSION_CONFLICT|expectedVersion/i.test(String(err?.message || ""))
  ) {
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.CONCURRENCY_CONFLICT,
      err?.message || "Coaching concurrency conflict."
    );
  }

  return createCoachingRuntimeError(
    COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
    err?.message || "Durable coaching operation failed."
  );
}

/**
 * Normalize durable aggregates into UI-ish row shapes where reasonable.
 * @param {string} collection
 * @param {object[]} records
 */
function projectRows(collection, records) {
  const rows = Array.isArray(records) ? records : [];
  if (collection === "classes") {
    return rows.map((p) => ({
      id: p.programId || p.id,
      name: p.name || p.title || p.programId,
      level: p.level || p.skillLevel || "",
      coachName: p.coachDisplayLabel || p.coachName || "",
      capacity: p.capacity ?? p.maxCapacity ?? "",
      ...p,
    }));
  }
  if (collection === "students") {
    return rows.map((e) => ({
      id: e.enrollmentId || e.id,
      name: e.playerDisplayLabel || e.playerName || e.playerId || "",
      level: e.level || "",
      phone: e.phone || "",
      packageName: e.packageName || e.packageId || "",
      ...e,
    }));
  }
  if (collection === "schedule") {
    return rows.map((s) => ({
      id: s.sessionId || s.id,
      date: s.scheduledDate || s.date || "",
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      className: s.programName || s.className || s.programId || "",
      coachName: s.coachDisplayLabel || s.coachName || "",
      courtName: s.courtName || s.venueId || "",
      ...s,
    }));
  }
  if (collection === "packages") {
    return rows.map((p) => ({
      id: p.packageId || p.id,
      name: p.name || p.packageId,
      sessions: p.sessionCount ?? p.sessions ?? "",
      durationDays: p.durationDays ?? "",
      price: p.price ?? "",
      ...p,
    }));
  }
  if (collection === "attendance") {
    return rows.map((a) => ({
      id: a.attendanceId || a.id,
      date: a.recordedAt || a.date || "",
      className: a.programId || a.className || "",
      studentName: a.playerId || a.studentName || "",
      status: a.status || "",
      ...a,
    }));
  }
  if (collection === "evaluations") {
    return rows.map((e) => ({
      id: e.evaluationId || e.id,
      date: e.submittedAt || e.createdAt || e.date || "",
      studentName: e.playerId || e.studentName || "",
      coachName: e.coachReferenceId || e.coachName || "",
      rating: e.rating ?? e.score ?? "",
      summary: e.summary || e.notes || "",
      ...e,
    }));
  }
  return rows;
}

/**
 * @param {{
 *   databaseClient?: object|null,
 *   tenantId?: string,
 *   clubId?: string,
 *   actorId?: string,
 *   applicationService?: object|null,
 * }} deps
 */
export function createDurableCoachingAdapter(deps = {}) {
  const tenantId = String(deps.tenantId || "").trim();
  const clubId = String(deps.clubId || "").trim();
  const actorId = String(deps.actorId || "").trim();
  const applicationService = deps.applicationService || null;
  // databaseClient reserved for future direct repo wiring; adapter uses applicationService.
  void deps.databaseClient;

  if (!tenantId || !clubId) {
    const fail = createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
      "Durable coaching requires tenantId and clubId; no default scope."
    );
    return Object.freeze({
      list: async () => fail,
      save: async () => fail,
      delete: async () => fail,
    });
  }

  if (!actorId) {
    const fail = createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.MISSING_ACTOR,
      "Durable coaching requires an authenticated actorId."
    );
    return Object.freeze({
      list: async () => fail,
      save: async () => fail,
      delete: async () => fail,
    });
  }

  if (!applicationService) {
    const fail = createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
      "Durable CoachingApplicationService is not injected."
    );
    return Object.freeze({
      list: async () => fail,
      save: async () => fail,
      delete: async () => fail,
    });
  }

  const actor = Object.freeze({
    actorId,
    principalId: actorId,
  });
  const scopeInput = Object.freeze({ tenantId, clubId });

  async function list(name) {
    if (name === "coaches") {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        "Legacy coaches collection has no 1:1 durable readRecords surface."
      );
    }
    const recordKey = LIST_READ_MAP[name];
    if (!recordKey) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        `Unknown coaching collection: ${name}`
      );
    }
    try {
      const records = await applicationService.readRecords(actor, scopeInput);
      const data = projectRows(name, records?.[recordKey]);
      return { ok: true, data };
    } catch (err) {
      return mapDurableFailure(err);
    }
  }

  async function save(name) {
    // UI collection shapes (class/student/schedule rows) are not 1:1 with domain commands.
    // Fail closed — do not invent writes or fall back to localStorage.
    // Extra clubId/row args are accepted by callers but unused until domain mapping lands.
    if (name === "coaches" || name === "students" || name === "classes" || name === "schedule") {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        `Durable save for legacy collection "${name}" is not mapped 1:1 (use domain commands).`
      );
    }
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
      `Durable UI save for "${name}" is not activated in COACHING-04 cutover.`
    );
  }

  async function remove(name) {
    return createCoachingRuntimeError(
      COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
      `Durable UI delete for "${name}" is not mapped; use domain commands.`
    );
  }

  return Object.freeze({
    list,
    save,
    delete: remove,
  });
}
