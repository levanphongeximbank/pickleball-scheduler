/**
 * Coaching Application Service (COACHING-01).
 * Authorization is enforced before every repository write and protected read.
 * Fail-closed when repositories or authorization dependency are unavailable.
 */

import { COACHING_ACTIONS } from "../constants/actions.js";
import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { throwCoachingError, CoachingError } from "../errors/CoachingError.js";
import { authorizeCoachingViaPort } from "../authorization/coachingAuthorize.js";
import {
  createCoachingProgram,
  transitionCoachingProgram,
  updateCoachingProgram,
  createCoachReference,
  createCoachPlayerRelationship,
  createCoachingEnrollment,
  transitionCoachingEnrollment,
  createCurriculum,
  createLesson,
  createTrainingSession,
  scheduleTrainingSession,
  transitionTrainingSession,
  createAttendanceRecord,
  correctAttendanceRecord,
  createCoachingPackage,
  createPackageEntitlement,
  consumePackageEntitlement,
  createCoachingEvaluation,
  submitCoachingEvaluation,
  createEvaluationRevision,
  updateCoachingEvaluationDraft,
} from "../domain/index.js";
import {
  createFixedCoachingClock,
  createInMemoryCoachingRepositories,
  createSequentialCoachingIdGenerator,
} from "../repositories/index.js";

/**
 * @param {{ ok: boolean, code?: string, error?: string, details?: object }} auth
 */
function assertAuthorized(auth) {
  if (auth?.ok === true) return auth;
  throw new CoachingError(
    auth?.code || COACHING_ERROR_CODES.UNAUTHORIZED,
    auth?.error || "Coaching authorization denied.",
    auth?.details
  );
}

/**
 * @param {object} [deps]
 */
export function createCoachingApplicationService(deps = {}) {
  const repositories = deps.repositories ?? null;
  const clock = deps.clock || createFixedCoachingClock("1970-01-01T00:00:00.000Z");
  const idGenerator =
    deps.idGenerator || createSequentialCoachingIdGenerator(() => "runtime");
  const authorizationPort =
    deps.authorizationPort === undefined ? null : deps.authorizationPort;

  function requireRepos() {
    if (!repositories) {
      throwCoachingError(
        COACHING_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Coaching repository adapters are not configured.",
        { adapter: "CoachingRepositories" }
      );
    }
    return repositories;
  }

  function domainDeps() {
    return {
      nowIso: () => clock.nowIso(),
      nextId: (prefix) => idGenerator.nextId(prefix),
    };
  }

  function authorize(actor, action, scopeInput) {
    return assertAuthorized(
      authorizeCoachingViaPort(authorizationPort, actor, action, scopeInput)
    );
  }

  async function requireEntity(store, scope, id, label) {
    const found = await store.getById(scope, id);
    if (!found) {
      throwCoachingError(COACHING_ERROR_CODES.NOT_FOUND, `${label} not found.`, {
        id,
        tenantId: scope.tenantId,
        clubId: scope.clubId,
      });
    }
    return found;
  }

  return Object.freeze({
    async createProgram(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PROGRAM_CREATE, input);
      const repos = requireRepos();
      const program = createCoachingProgram(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      const existing = await repos.programs.getById(auth.scope, program.programId);
      if (existing) {
        throwCoachingError(
          COACHING_ERROR_CODES.DUPLICATE,
          "CoachingProgram already exists.",
          { programId: program.programId }
        );
      }
      return repos.programs.save(program);
    },

    async updateProgram(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PROGRAM_UPDATE, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.programs,
        auth.scope,
        input.programId,
        "CoachingProgram"
      );
      const updated = updateCoachingProgram(current, input, domainDeps(), {
        expectedVersion: input.expectedVersion,
      });
      return repos.programs.save(updated, {
        expectedVersion: input.expectedVersion,
      });
    },

    async transitionProgram(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PROGRAM_UPDATE, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.programs,
        auth.scope,
        input.programId,
        "CoachingProgram"
      );
      const updated = transitionCoachingProgram(
        current,
        input.status,
        domainDeps(),
        { expectedVersion: input.expectedVersion }
      );
      return repos.programs.save(updated, {
        expectedVersion: input.expectedVersion,
      });
    },

    async assignCoach(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.COACH_ASSIGN, input);
      const repos = requireRepos();
      const coachRef = createCoachReference(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      await repos.coachReferences.save(coachRef);
      let relationship = null;
      if (input.playerId) {
        relationship = createCoachPlayerRelationship(
          {
            tenantId: auth.scope.tenantId,
            clubId: auth.scope.clubId,
            venueId: coachRef.venueId,
            coachReferenceId: coachRef.coachReferenceId,
            playerId: input.playerId,
            programId: input.programId,
          },
          domainDeps()
        );
        await repos.relationships.save(relationship);
      }
      return Object.freeze({ coachReference: coachRef, relationship });
    },

    async enrollPlayer(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PLAYER_ENROLL, input);
      const repos = requireRepos();
      await requireEntity(
        repos.programs,
        auth.scope,
        input.programId,
        "CoachingProgram"
      );
      const enrollment = createCoachingEnrollment(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      const duplicate = (
        await repos.enrollments.list(
          auth.scope,
          (row) =>
            row.programId === enrollment.programId &&
            row.playerId === enrollment.playerId &&
            row.status !== "cancelled"
        )
      )[0];
      if (duplicate) {
        throwCoachingError(
          COACHING_ERROR_CODES.DUPLICATE,
          "Player already enrolled in this program.",
          {
            enrollmentId: duplicate.enrollmentId,
            programId: enrollment.programId,
            playerId: enrollment.playerId,
          }
        );
      }
      return repos.enrollments.save(enrollment);
    },

    async transitionEnrollment(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PLAYER_ENROLL, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.enrollments,
        auth.scope,
        input.enrollmentId,
        "CoachingEnrollment"
      );
      const updated = transitionCoachingEnrollment(
        current,
        input.status,
        domainDeps(),
        { expectedVersion: input.expectedVersion }
      );
      return repos.enrollments.save(updated, {
        expectedVersion: input.expectedVersion,
      });
    },

    async createCurriculum(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.CURRICULUM_CREATE, input);
      const repos = requireRepos();
      const curriculum = createCurriculum(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      return repos.curricula.save(curriculum);
    },

    async createLesson(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.LESSON_CREATE, input);
      const repos = requireRepos();
      await requireEntity(
        repos.curricula,
        auth.scope,
        input.curriculumId,
        "Curriculum"
      );
      const lesson = createLesson(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      return repos.lessons.save(lesson);
    },

    async scheduleSession(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.SESSION_SCHEDULE, input);
      const repos = requireRepos();
      await requireEntity(
        repos.programs,
        auth.scope,
        input.programId,
        "CoachingProgram"
      );

      let session;
      if (input.sessionId) {
        const current = await requireEntity(
          repos.sessions,
          auth.scope,
          input.sessionId,
          "TrainingSession"
        );
        session = scheduleTrainingSession(
          current,
          input.schedule || input,
          domainDeps(),
          {
            expectedVersion: input.expectedVersion,
            confirm: input.confirm === true,
          }
        );
        return repos.sessions.save(session, {
          expectedVersion: input.expectedVersion,
        });
      }

      session = createTrainingSession(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
          status: input.status || "scheduled",
          schedule: input.schedule || input,
        },
        domainDeps()
      );
      return repos.sessions.save(session);
    },

    async transitionSession(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.SESSION_SCHEDULE, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.sessions,
        auth.scope,
        input.sessionId,
        "TrainingSession"
      );
      const updated = transitionTrainingSession(
        current,
        input.status,
        domainDeps(),
        { expectedVersion: input.expectedVersion }
      );
      return repos.sessions.save(updated, {
        expectedVersion: input.expectedVersion,
      });
    },

    async recordAttendance(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.ATTENDANCE_RECORD, input);
      const repos = requireRepos();
      await requireEntity(
        repos.sessions,
        auth.scope,
        input.sessionId,
        "TrainingSession"
      );
      const record = createAttendanceRecord(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
          recordedByActorId: auth.actor.userId,
        },
        domainDeps()
      );
      return repos.attendance.save(record);
    },

    async correctAttendance(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.ATTENDANCE_CORRECT, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.attendance,
        auth.scope,
        input.attendanceId,
        "AttendanceRecord"
      );
      const { attendance, correction } = correctAttendanceRecord(
        current,
        { ...input, actorId: auth.actor.userId },
        domainDeps(),
        { expectedVersion: input.expectedVersion }
      );
      const savedAttendance = await repos.attendance.save(attendance, {
        expectedVersion: input.expectedVersion,
      });
      const savedCorrection = await repos.attendanceCorrections.append(correction);
      return Object.freeze({
        attendance: savedAttendance,
        correction: savedCorrection,
      });
    },

    async createPackage(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PROGRAM_CREATE, input);
      const repos = requireRepos();
      const pkg = createCoachingPackage(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      return repos.packages.save(pkg);
    },

    async grantEntitlement(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.PLAYER_ENROLL, input);
      const repos = requireRepos();
      await requireEntity(
        repos.packages,
        auth.scope,
        input.packageId,
        "CoachingPackage"
      );
      const entitlement = createPackageEntitlement(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
        },
        domainDeps()
      );
      return repos.entitlements.save(entitlement);
    },

    async consumeEntitlement(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.ATTENDANCE_RECORD, input);
      const repos = requireRepos();
      const current = await requireEntity(
        repos.entitlements,
        auth.scope,
        input.entitlementId,
        "PackageEntitlement"
      );
      const updated = consumePackageEntitlement(current, domainDeps(), {
        expectedVersion: input.expectedVersion,
        at: input.at,
      });
      return repos.entitlements.save(updated, {
        expectedVersion: input.expectedVersion,
      });
    },

    async submitEvaluation(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.EVALUATION_SUBMIT, input);
      const repos = requireRepos();

      if (input.evaluationId && input.expectedVersion != null) {
        const current = await requireEntity(
          repos.evaluations,
          auth.scope,
          input.evaluationId,
          "CoachingEvaluation"
        );
        if (input.summary !== undefined || input.rating !== undefined) {
          const draft = updateCoachingEvaluationDraft(
            current,
            { summary: input.summary, rating: input.rating },
            domainDeps(),
            { expectedVersion: input.expectedVersion }
          );
          const savedDraft = await repos.evaluations.save(draft, {
            expectedVersion: input.expectedVersion,
          });
          const submitted = submitCoachingEvaluation(savedDraft, domainDeps(), {
            expectedVersion: savedDraft.version,
          });
          return repos.evaluations.save(submitted, {
            expectedVersion: savedDraft.version,
          });
        }
        const submitted = submitCoachingEvaluation(current, domainDeps(), {
          expectedVersion: input.expectedVersion,
        });
        return repos.evaluations.save(submitted, {
          expectedVersion: input.expectedVersion,
        });
      }

      if (input.revisesEvaluationId) {
        const submitted = await requireEntity(
          repos.evaluations,
          auth.scope,
          input.revisesEvaluationId,
          "CoachingEvaluation"
        );
        const revision = createEvaluationRevision(submitted, input, domainDeps());
        const savedDraft = await repos.evaluations.save(revision);
        const finalized = submitCoachingEvaluation(savedDraft, domainDeps(), {
          expectedVersion: savedDraft.version,
        });
        return repos.evaluations.save(finalized, {
          expectedVersion: savedDraft.version,
        });
      }

      const evaluation = createCoachingEvaluation(
        {
          ...input,
          tenantId: auth.scope.tenantId,
          clubId: auth.scope.clubId,
          venueId: input.venueId ?? auth.scope.venueId,
          status: "draft",
        },
        domainDeps()
      );
      const saved = await repos.evaluations.save(evaluation);
      const submitted = submitCoachingEvaluation(saved, domainDeps(), {
        expectedVersion: saved.version,
      });
      return repos.evaluations.save(submitted, {
        expectedVersion: saved.version,
      });
    },

    async readRecords(actor, input = {}) {
      const auth = authorize(actor, COACHING_ACTIONS.RECORDS_READ, input);
      const repos = requireRepos();
      return Object.freeze({
        programs: await repos.programs.list(auth.scope),
        enrollments: await repos.enrollments.list(auth.scope),
        sessions: await repos.sessions.list(auth.scope),
        attendance: await repos.attendance.list(auth.scope),
        evaluations: await repos.evaluations.list(auth.scope),
        packages: await repos.packages.list(auth.scope),
        entitlements: await repos.entitlements.list(auth.scope),
      });
    },
  });
}

/**
 * Fail-closed application when adapters are not configured.
 */
export function createFailClosedCoachingApplication() {
  return createCoachingApplicationService({ repositories: null });
}

/**
 * Convenience factory for tests / memory runtime.
 *
 * @param {object} [options]
 */
export function createMemoryCoachingApplication(options = {}) {
  const repositories =
    options.repositories || createInMemoryCoachingRepositories();
  const clock =
    options.clock || createFixedCoachingClock("2026-07-25T00:00:00.000Z");
  const idGenerator =
    options.idGenerator || createSequentialCoachingIdGenerator(() => "mem");
  const service = createCoachingApplicationService({
    repositories,
    clock,
    idGenerator,
    authorizationPort: options.authorizationPort,
  });
  return Object.freeze({ service, repositories, clock, idGenerator });
}
