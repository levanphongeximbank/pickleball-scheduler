/**
 * Deterministic in-memory Coaching repositories (COACHING-01).
 * Isolated per factory call. Not production persistence.
 * No browser store / Supabase.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { CoachingError } from "../errors/CoachingError.js";
import { createCoachingScope } from "../domain/scope.js";
import { COACHING_REPOSITORY_PORTS } from "./ports.js";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneFrozen(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneFrozen(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = cloneFrozen(value[key]);
  }
  return Object.freeze(out);
}

/**
 * @param {string} tenantId
 * @param {string} clubId
 * @param {string} entityId
 */
function scopeKey(tenantId, clubId, entityId) {
  return `${tenantId}\u0000${clubId}\u0000${entityId}`;
}

/**
 * @param {object} scope
 * @param {object} row
 */
function matchesScope(scope, row) {
  if (row.tenantId !== scope.tenantId || row.clubId !== scope.clubId) {
    return false;
  }
  if (scope.venueId && row.venueId && scope.venueId !== row.venueId) {
    return false;
  }
  return true;
}

/**
 * @param {string} idField
 * @returns {(a: object, b: object) => number}
 */
function compareByIdThenCreated(idField) {
  return (a, b) => {
    const left = String(a[idField] ?? "");
    const right = String(b[idField] ?? "");
    if (left < right) return -1;
    if (left > right) return 1;
    const leftAt = String(a.createdAt ?? "");
    const rightAt = String(b.createdAt ?? "");
    if (leftAt < rightAt) return -1;
    if (leftAt > rightAt) return 1;
    return 0;
  };
}

/**
 * @param {string} portName
 * @param {string} idField
 */
function createVersionedStore(portName, idField) {
  /** @type {Map<string, object>} */
  const byId = new Map();

  function requireScope(scopeInput) {
    return createCoachingScope(scopeInput);
  }

  function getById(scopeInput, id) {
    if (!id || !String(id).trim()) return null;
    const scope = requireScope(scopeInput);
    const row = byId.get(scopeKey(scope.tenantId, scope.clubId, String(id).trim()));
    if (!row) return null;
    if (!matchesScope(scope, row)) return null;
    return cloneFrozen(row);
  }

  function list(scopeInput, predicate) {
    const scope = requireScope(scopeInput);
    const out = [];
    for (const row of byId.values()) {
      if (!matchesScope(scope, row)) continue;
      if (predicate && !predicate(row)) continue;
      out.push(cloneFrozen(row));
    }
    out.sort(compareByIdThenCreated(idField));
    return out;
  }

  function save(entity, options = {}) {
    if (!entity || typeof entity !== "object") {
      throw new CoachingError(
        COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
        `${portName}.save requires an entity object.`
      );
    }
    const scope = createCoachingScope(entity);
    const id = entity[idField];
    if (!id || !String(id).trim()) {
      throw new CoachingError(
        COACHING_ERROR_CODES.INVALID_REFERENCE,
        `${idField} is required to save.`,
        { field: idField, port: portName }
      );
    }
    const key = scopeKey(scope.tenantId, scope.clubId, String(id).trim());
    const existing = byId.get(key);

    if (!existing) {
      // create
      if (options.expectedVersion != null) {
        throw new CoachingError(
          COACHING_ERROR_CODES.VERSION_CONFLICT,
          `${portName} create must not supply expectedVersion.`,
          { port: portName, id }
        );
      }
      const frozen = cloneFrozen(entity);
      byId.set(key, frozen);
      return cloneFrozen(frozen);
    }

    // update — require expectedVersion
    if (options.expectedVersion == null) {
      throw new CoachingError(
        COACHING_ERROR_CODES.INVALID_INPUT,
        `${portName}.save update requires expectedVersion.`,
        { port: portName, id }
      );
    }
    if (existing.version !== options.expectedVersion) {
      throw new CoachingError(
        COACHING_ERROR_CODES.VERSION_CONFLICT,
        `${portName} optimistic concurrency conflict.`,
        {
          port: portName,
          id,
          expectedVersion: options.expectedVersion,
          actualVersion: existing.version,
        }
      );
    }
    if (entity.version !== existing.version + 1) {
      throw new CoachingError(
        COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
        `${portName} update must increment version by exactly 1.`,
        {
          port: portName,
          id,
          receivedVersion: entity.version,
          expectedNext: existing.version + 1,
        }
      );
    }
    if (!matchesScope(scope, existing)) {
      throw new CoachingError(
        COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
        `${portName} cannot move entity across tenant/club scope.`,
        { port: portName, id }
      );
    }
    const frozen = cloneFrozen(entity);
    byId.set(key, frozen);
    return cloneFrozen(frozen);
  }

  return {
    port: portName,
    getById,
    list,
    save,
    /** @internal */
    _clear() {
      byId.clear();
    },
    /** @internal */
    _size() {
      return byId.size;
    },
  };
}

/**
 * Append-only correction store — no update path.
 *
 * @param {string} portName
 * @param {string} idField
 */
function createAppendOnlyStore(portName, idField) {
  /** @type {Map<string, object>} */
  const byId = new Map();

  function requireScope(scopeInput) {
    return createCoachingScope(scopeInput);
  }

  function getById(scopeInput, id) {
    if (!id || !String(id).trim()) return null;
    const scope = requireScope(scopeInput);
    const row = byId.get(scopeKey(scope.tenantId, scope.clubId, String(id).trim()));
    if (!row) return null;
    if (!matchesScope(scope, row)) return null;
    return cloneFrozen(row);
  }

  function list(scopeInput, predicate) {
    const scope = requireScope(scopeInput);
    const out = [];
    for (const row of byId.values()) {
      if (!matchesScope(scope, row)) continue;
      if (predicate && !predicate(row)) continue;
      out.push(cloneFrozen(row));
    }
    out.sort(compareByIdThenCreated(idField));
    return out;
  }

  function listByAttendanceId(scopeInput, attendanceId) {
    return list(
      scopeInput,
      (row) => row.attendanceId === String(attendanceId)
    );
  }

  function append(entity) {
    if (!entity || typeof entity !== "object") {
      throw new CoachingError(
        COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
        `${portName}.append requires an entity object.`
      );
    }
    const scope = createCoachingScope(entity);
    const id = entity[idField];
    if (!id || !String(id).trim()) {
      throw new CoachingError(
        COACHING_ERROR_CODES.INVALID_REFERENCE,
        `${idField} is required to append.`,
        { field: idField, port: portName }
      );
    }
    const key = scopeKey(scope.tenantId, scope.clubId, String(id).trim());
    if (byId.has(key)) {
      throw new CoachingError(
        COACHING_ERROR_CODES.DUPLICATE,
        `${portName} records are append-only and already exist.`,
        { port: portName, id }
      );
    }
    const frozen = cloneFrozen(entity);
    byId.set(key, frozen);
    return cloneFrozen(frozen);
  }

  return {
    port: portName,
    getById,
    list,
    listByAttendanceId,
    append,
    _clear() {
      byId.clear();
    },
  };
}

/**
 * Create a full in-memory Coaching repository bundle.
 */
export function createInMemoryCoachingRepositories() {
  const programs = createVersionedStore(
    COACHING_REPOSITORY_PORTS.ProgramRepository,
    "programId"
  );
  const coachReferences = createVersionedStore(
    COACHING_REPOSITORY_PORTS.CoachReferenceRepository,
    "coachReferenceId"
  );
  const relationships = createVersionedStore(
    COACHING_REPOSITORY_PORTS.RelationshipRepository,
    "relationshipId"
  );
  const enrollments = createVersionedStore(
    COACHING_REPOSITORY_PORTS.EnrollmentRepository,
    "enrollmentId"
  );
  const curricula = createVersionedStore(
    COACHING_REPOSITORY_PORTS.CurriculumRepository,
    "curriculumId"
  );
  const lessons = createVersionedStore(
    COACHING_REPOSITORY_PORTS.LessonRepository,
    "lessonId"
  );
  const sessions = createVersionedStore(
    COACHING_REPOSITORY_PORTS.SessionRepository,
    "sessionId"
  );
  const attendance = createVersionedStore(
    COACHING_REPOSITORY_PORTS.AttendanceRepository,
    "attendanceId"
  );
  const attendanceCorrections = createAppendOnlyStore(
    COACHING_REPOSITORY_PORTS.AttendanceCorrectionRepository,
    "correctionId"
  );
  const packages = createVersionedStore(
    COACHING_REPOSITORY_PORTS.PackageRepository,
    "packageId"
  );
  const entitlements = createVersionedStore(
    COACHING_REPOSITORY_PORTS.EntitlementRepository,
    "entitlementId"
  );
  const evaluations = createVersionedStore(
    COACHING_REPOSITORY_PORTS.EvaluationRepository,
    "evaluationId"
  );

  return Object.freeze({
    programs,
    coachReferences,
    relationships,
    enrollments,
    curricula,
    lessons,
    sessions,
    attendance,
    attendanceCorrections,
    packages,
    entitlements,
    evaluations,
    resetAllForTests() {
      for (const store of [
        programs,
        coachReferences,
        relationships,
        enrollments,
        curricula,
        lessons,
        sessions,
        attendance,
        attendanceCorrections,
        packages,
        entitlements,
        evaluations,
      ]) {
        store._clear();
      }
    },
  });
}
