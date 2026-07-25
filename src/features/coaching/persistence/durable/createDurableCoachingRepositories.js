/**
 * Durable Coaching repository bundle (COACHING-02).
 * Implements COACHING-01 repository ports via injectable CoachingDatabaseClientPort.
 * Not a runtime default. No browser store. No singleton Supabase client.
 */

import { COACHING_ERROR_CODES } from "../../constants/errorCodes.js";
import { CoachingError } from "../../errors/CoachingError.js";
import { createCoachingScope } from "../../domain/scope.js";
import { COACHING_REPOSITORY_PORTS } from "../../repositories/ports.js";
import {
  COACHING_02_RPC,
  COACHING_02_TABLES,
  requireCoachingDatabaseClientPort,
} from "../databaseClientPort.js";
import { withCoachingPersistenceErrors } from "../errorTranslation.js";
import {
  mapAttendanceDomainToRow,
  mapAttendanceRowToDomain,
  mapCoachReferenceDomainToRow,
  mapCoachReferenceRowToDomain,
  mapCorrectionDomainToRow,
  mapCorrectionRowToDomain,
  mapCurriculumDomainToRow,
  mapCurriculumRowToDomain,
  mapEnrollmentDomainToRow,
  mapEnrollmentRowToDomain,
  mapEntitlementDomainToRow,
  mapEntitlementRowToDomain,
  mapEvaluationDomainToRow,
  mapEvaluationRowToDomain,
  mapLessonDomainToRow,
  mapLessonRowToDomain,
  mapPackageDomainToRow,
  mapPackageRowToDomain,
  mapProgramDomainToRow,
  mapProgramRowToDomain,
  mapRelationshipDomainToRow,
  mapRelationshipRowToDomain,
  mapSessionDomainToRow,
  mapSessionRowToDomain,
  mapUsageEventRowToDomain,
} from "../mapping/coachingMapping.js";

/**
 * @param {object} scope
 */
function scopeFilters(scope) {
  return { tenant_id: scope.tenantId, club_id: scope.clubId };
}

/**
 * @param {string} idField
 * @param {object} a
 * @param {object} b
 */
function compareByIdThenCreated(idField, a, b) {
  const left = String(a[idField] ?? "");
  const right = String(b[idField] ?? "");
  if (left < right) return -1;
  if (left > right) return 1;
  const leftAt = String(a.createdAt ?? "");
  const rightAt = String(b.createdAt ?? "");
  if (leftAt < rightAt) return -1;
  if (leftAt > rightAt) return 1;
  return 0;
}

/**
 * @param {{
 *   db: import('../databaseClientPort.js').CoachingDatabaseClientPort,
 *   portName: string,
 *   table: string,
 *   idField: string,
 *   idColumn: string,
 *   mapRow: (row: object) => object,
 *   mapDomain: (entity: object) => object,
 * }} cfg
 */
function createDurableVersionedStore(cfg) {
  const { db, portName, table, idField, idColumn, mapRow, mapDomain } = cfg;

  async function getById(scopeInput, id) {
    if (!id || !String(id).trim()) return null;
    const scope = createCoachingScope(scopeInput);
    return withCoachingPersistenceErrors(async () => {
      const rows = await db.select({
        table,
        filters: { ...scopeFilters(scope), [idColumn]: String(id).trim() },
        limit: 1,
      });
      if (!rows || rows.length === 0) return null;
      const row = rows[0];
      if (row.tenant_id !== scope.tenantId || row.club_id !== scope.clubId) {
        return null;
      }
      return mapRow(row);
    });
  }

  async function list(scopeInput, predicate) {
    const scope = createCoachingScope(scopeInput);
    return withCoachingPersistenceErrors(async () => {
      const rows = await db.select({
        table,
        filters: scopeFilters(scope),
        order: [
          { column: idColumn, ascending: true },
          { column: "created_at", ascending: true },
        ],
      });
      const out = [];
      for (const row of rows || []) {
        if (row.tenant_id !== scope.tenantId || row.club_id !== scope.clubId) {
          continue;
        }
        const domain = mapRow(row);
        if (predicate && !predicate(domain)) continue;
        out.push(domain);
      }
      out.sort((a, b) => compareByIdThenCreated(idField, a, b));
      return out;
    });
  }

  async function save(entity, options = {}) {
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

    return withCoachingPersistenceErrors(async () => {
      const existingRows = await db.select({
        table,
        filters: { ...scopeFilters(scope), [idColumn]: String(id).trim() },
        limit: 1,
      });
      const existing = existingRows && existingRows[0] ? existingRows[0] : null;

      if (!existing) {
        if (options.expectedVersion != null) {
          throw new CoachingError(
            COACHING_ERROR_CODES.VERSION_CONFLICT,
            `${portName} create must not supply expectedVersion.`,
            { port: portName, id }
          );
        }
        const inserted = await db.insert({
          table,
          rows: mapDomain(entity),
          returning: true,
        });
        return mapRow(inserted[0]);
      }

      if (options.expectedVersion == null) {
        throw new CoachingError(
          COACHING_ERROR_CODES.INVALID_INPUT,
          `${portName}.save update requires expectedVersion.`,
          { port: portName, id }
        );
      }
      if (Number(existing.version) !== Number(options.expectedVersion)) {
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
      if (Number(entity.version) !== Number(existing.version) + 1) {
        throw new CoachingError(
          COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
          `${portName} update must increment version by exactly 1.`,
          {
            port: portName,
            id,
            receivedVersion: entity.version,
            expectedNext: Number(existing.version) + 1,
          }
        );
      }
      if (
        existing.tenant_id !== scope.tenantId ||
        existing.club_id !== scope.clubId
      ) {
        throw new CoachingError(
          COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
          `${portName} cannot move entity across tenant/club scope.`,
          { port: portName, id }
        );
      }

      const updated = await db.update({
        table,
        values: mapDomain(entity),
        filters: {
          ...scopeFilters(scope),
          [idColumn]: String(id).trim(),
          version: options.expectedVersion,
        },
        returning: true,
      });
      if (!updated || updated.length === 0) {
        throw new CoachingError(
          COACHING_ERROR_CODES.VERSION_CONFLICT,
          `${portName} optimistic concurrency conflict (zero rows updated).`,
          { port: portName, id, expectedVersion: options.expectedVersion }
        );
      }
      return mapRow(updated[0]);
    });
  }

  return { port: portName, getById, list, save };
}

/**
 * @param {{ db: import('../databaseClientPort.js').CoachingDatabaseClientPort }} deps
 */
export function createDurableCoachingRepositories(deps = {}) {
  const db = requireCoachingDatabaseClientPort(deps.db);

  const programs = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.ProgramRepository,
    table: COACHING_02_TABLES.PROGRAMS,
    idField: "programId",
    idColumn: "program_id",
    mapRow: mapProgramRowToDomain,
    mapDomain: mapProgramDomainToRow,
  });

  const coachReferences = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.CoachReferenceRepository,
    table: COACHING_02_TABLES.COACH_REFERENCES,
    idField: "coachReferenceId",
    idColumn: "coach_reference_id",
    mapRow: mapCoachReferenceRowToDomain,
    mapDomain: mapCoachReferenceDomainToRow,
  });

  const relationships = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.RelationshipRepository,
    table: COACHING_02_TABLES.RELATIONSHIPS,
    idField: "relationshipId",
    idColumn: "relationship_id",
    mapRow: mapRelationshipRowToDomain,
    mapDomain: mapRelationshipDomainToRow,
  });

  const enrollments = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.EnrollmentRepository,
    table: COACHING_02_TABLES.ENROLLMENTS,
    idField: "enrollmentId",
    idColumn: "enrollment_id",
    mapRow: mapEnrollmentRowToDomain,
    mapDomain: mapEnrollmentDomainToRow,
  });

  const curricula = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.CurriculumRepository,
    table: COACHING_02_TABLES.CURRICULA,
    idField: "curriculumId",
    idColumn: "curriculum_id",
    mapRow: mapCurriculumRowToDomain,
    mapDomain: mapCurriculumDomainToRow,
  });

  const lessons = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.LessonRepository,
    table: COACHING_02_TABLES.LESSONS,
    idField: "lessonId",
    idColumn: "lesson_id",
    mapRow: mapLessonRowToDomain,
    mapDomain: mapLessonDomainToRow,
  });

  const sessions = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.SessionRepository,
    table: COACHING_02_TABLES.SESSIONS,
    idField: "sessionId",
    idColumn: "session_id",
    mapRow: mapSessionRowToDomain,
    mapDomain: mapSessionDomainToRow,
  });

  const attendance = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.AttendanceRepository,
    table: COACHING_02_TABLES.ATTENDANCE,
    idField: "attendanceId",
    idColumn: "attendance_id",
    mapRow: mapAttendanceRowToDomain,
    mapDomain: mapAttendanceDomainToRow,
  });

  const packages = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.PackageRepository,
    table: COACHING_02_TABLES.PACKAGES,
    idField: "packageId",
    idColumn: "package_id",
    mapRow: mapPackageRowToDomain,
    mapDomain: mapPackageDomainToRow,
  });

  const baseEntitlements = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.EntitlementRepository,
    table: COACHING_02_TABLES.ENTITLEMENTS,
    idField: "entitlementId",
    idColumn: "entitlement_id",
    mapRow: mapEntitlementRowToDomain,
    mapDomain: mapEntitlementDomainToRow,
  });

  /**
   * Entitlement save: route consumption (+1 sessionsConsumed) through atomic RPC.
   */
  const entitlements = Object.freeze({
    port: baseEntitlements.port,
    getById: baseEntitlements.getById,
    list: baseEntitlements.list,
    async save(entity, options = {}) {
      if (!entity || typeof entity !== "object") {
        throw new CoachingError(
          COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
          "EntitlementRepository.save requires an entity object."
        );
      }
      const scope = createCoachingScope(entity);
      const existing = await baseEntitlements.getById(scope, entity.entitlementId);
      const consumeDelta =
        existing &&
        options.expectedVersion != null &&
        Number(entity.sessionsConsumed) === Number(existing.sessionsConsumed) + 1;
      // Explicit idempotency key always uses the atomic consume RPC (handles replay).
      const consumeViaRpc =
        existing &&
        options.expectedVersion != null &&
        (consumeDelta || options.idempotencyKey != null);

      if (consumeViaRpc) {
        return withCoachingPersistenceErrors(async () => {
          const idempotencyKey =
            options.idempotencyKey ||
            `consume:${entity.entitlementId}:v${options.expectedVersion}`;
          const usageEventId =
            options.usageEventId ||
            `usage_${entity.entitlementId}_${options.expectedVersion}`;
          const result = await db.rpc({
            fn: COACHING_02_RPC.CONSUME_ENTITLEMENT,
            args: {
              p_tenant_id: scope.tenantId,
              p_club_id: scope.clubId,
              p_entitlement_id: entity.entitlementId,
              p_expected_version: options.expectedVersion,
              p_player_id: entity.playerId,
              p_idempotency_key: idempotencyKey,
              p_usage_event_id: usageEventId,
              p_consumed_at: entity.updatedAt ?? null,
            },
          });
          const payload = result && typeof result === "object" ? result : {};
          if (!payload.entitlement) {
            throw new CoachingError(
              COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
              "coaching_consume_entitlement returned no entitlement."
            );
          }
          return mapEntitlementRowToDomain(payload.entitlement);
        });
      }
      return baseEntitlements.save(entity, options);
    },
  });

  const evaluations = createDurableVersionedStore({
    db,
    portName: COACHING_REPOSITORY_PORTS.EvaluationRepository,
    table: COACHING_02_TABLES.EVALUATIONS,
    idField: "evaluationId",
    idColumn: "evaluation_id",
    mapRow: mapEvaluationRowToDomain,
    mapDomain: mapEvaluationDomainToRow,
  });

  const attendanceCorrections = Object.freeze({
    port: COACHING_REPOSITORY_PORTS.AttendanceCorrectionRepository,

    async getById(scopeInput, id) {
      if (!id || !String(id).trim()) return null;
      const scope = createCoachingScope(scopeInput);
      return withCoachingPersistenceErrors(async () => {
        const rows = await db.select({
          table: COACHING_02_TABLES.ATTENDANCE_CORRECTIONS,
          filters: {
            ...scopeFilters(scope),
            correction_id: String(id).trim(),
          },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapCorrectionRowToDomain(rows[0]);
      });
    },

    async list(scopeInput, predicate) {
      const scope = createCoachingScope(scopeInput);
      return withCoachingPersistenceErrors(async () => {
        const rows = await db.select({
          table: COACHING_02_TABLES.ATTENDANCE_CORRECTIONS,
          filters: scopeFilters(scope),
          order: [
            { column: "correction_id", ascending: true },
            { column: "created_at", ascending: true },
          ],
        });
        const out = [];
        for (const row of rows || []) {
          const domain = mapCorrectionRowToDomain(row);
          if (predicate && !predicate(domain)) continue;
          out.push(domain);
        }
        out.sort((a, b) => compareByIdThenCreated("correctionId", a, b));
        return out;
      });
    },

    async listByAttendanceId(scopeInput, attendanceId) {
      return this.list(
        scopeInput,
        (row) => row.attendanceId === String(attendanceId)
      );
    },

    async append(entity) {
      if (!entity || typeof entity !== "object") {
        throw new CoachingError(
          COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
          "AttendanceCorrectionRepository.append requires an entity object."
        );
      }
      const scope = createCoachingScope(entity);
      return withCoachingPersistenceErrors(async () => {
        const existing = await db.select({
          table: COACHING_02_TABLES.ATTENDANCE_CORRECTIONS,
          filters: {
            ...scopeFilters(scope),
            correction_id: entity.correctionId,
          },
          limit: 1,
        });
        if (existing && existing.length > 0) {
          throw new CoachingError(
            COACHING_ERROR_CODES.DUPLICATE,
            "AttendanceCorrection records are append-only and already exist.",
            { id: entity.correctionId }
          );
        }
        const inserted = await db.insert({
          table: COACHING_02_TABLES.ATTENDANCE_CORRECTIONS,
          rows: mapCorrectionDomainToRow(entity),
          returning: true,
        });
        return mapCorrectionRowToDomain(inserted[0]);
      });
    },
  });

  const attendanceCorrectionUnitOfWork = Object.freeze({
    port: COACHING_REPOSITORY_PORTS.AttendanceCorrectionUnitOfWork,

    /**
     * Single atomic RPC boundary — does not split update + append across requests.
     */
    async applyCorrection(input = {}) {
      const scope = createCoachingScope(input.scope || input.attendance || {});
      const nextAttendance = input.attendance;
      const correction = input.correction;
      const expectedVersion = input.expectedVersion;

      if (!nextAttendance || !correction) {
        throw new CoachingError(
          COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
          "AttendanceCorrectionUnitOfWork.applyCorrection requires attendance and correction."
        );
      }
      if (expectedVersion == null) {
        throw new CoachingError(
          COACHING_ERROR_CODES.INVALID_INPUT,
          "AttendanceCorrectionUnitOfWork.applyCorrection requires expectedVersion.",
          { field: "expectedVersion" }
        );
      }

      return withCoachingPersistenceErrors(async () => {
        const result = await db.rpc({
          fn: COACHING_02_RPC.APPLY_ATTENDANCE_CORRECTION,
          args: {
            p_tenant_id: scope.tenantId,
            p_club_id: scope.clubId,
            p_attendance_id: nextAttendance.attendanceId,
            p_expected_version: expectedVersion,
            p_corrected_status: nextAttendance.status,
            p_reason: correction.reason,
            p_correction_id: correction.correctionId,
            p_corrected_at: correction.correctedAt ?? null,
            p_notes: nextAttendance.notes ?? null,
          },
        });
        const payload = result && typeof result === "object" ? result : {};
        if (!payload.attendance || !payload.correction) {
          throw new CoachingError(
            COACHING_ERROR_CODES.REPOSITORY_CONTRACT_VIOLATION,
            "coaching_apply_attendance_correction returned incomplete result."
          );
        }
        // Domain correction.actorId is advisory for in-memory; durable actor is auth.uid.
        return Object.freeze({
          attendance: mapAttendanceRowToDomain(payload.attendance),
          correction: mapCorrectionRowToDomain(payload.correction),
        });
      });
    },
  });

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
    attendanceCorrectionUnitOfWork,
    packages,
    entitlements,
    evaluations,
    /** @internal test helper — list usage events */
    async _listUsageEvents(scopeInput) {
      const scope = createCoachingScope(scopeInput);
      const rows = await db.select({
        table: COACHING_02_TABLES.USAGE_EVENTS,
        filters: scopeFilters(scope),
        order: [{ column: "usage_event_id", ascending: true }],
      });
      return (rows || []).map(mapUsageEventRowToDomain);
    },
  });
}
