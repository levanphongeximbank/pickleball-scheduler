/**
 * Coaching repository ports + clock/id contracts (COACHING-01).
 * Provider-neutral and persistence-neutral. No Supabase / browser stores.
 */

export const COACHING_REPOSITORY_PORTS = Object.freeze({
  ProgramRepository: "ProgramRepository",
  CoachReferenceRepository: "CoachReferenceRepository",
  RelationshipRepository: "RelationshipRepository",
  EnrollmentRepository: "EnrollmentRepository",
  CurriculumRepository: "CurriculumRepository",
  LessonRepository: "LessonRepository",
  SessionRepository: "SessionRepository",
  AttendanceRepository: "AttendanceRepository",
  AttendanceCorrectionRepository: "AttendanceCorrectionRepository",
  /**
   * Atomic attendance correction unit-of-work.
   * Persists AttendanceRecord update + append-only AttendanceCorrection together.
   * Durable adapters (COACHING-02+) MUST implement the same transactional boundary.
   */
  AttendanceCorrectionUnitOfWork: "AttendanceCorrectionUnitOfWork",
  PackageRepository: "PackageRepository",
  EntitlementRepository: "EntitlementRepository",
  EvaluationRepository: "EvaluationRepository",
});

/**
 * @typedef {object} AttendanceCorrectionUnitOfWork
 * @property {(input: {
 *   scope: CoachingScope,
 *   attendance: object,
 *   correction: object,
 *   expectedVersion: number
 * }) => { attendance: object, correction: object }|Promise<{ attendance: object, correction: object }>} applyCorrection
 */

/**
 * @typedef {{ tenantId: string, clubId: string, venueId?: string|null }} CoachingScope
 */

/**
 * @typedef {object} CoachingClock
 * @property {() => string} nowIso
 */

/**
 * @typedef {object} CoachingIdGenerator
 * @property {(prefix: string) => string} nextId
 */

/**
 * @typedef {object} CoachingAuthorizationPort
 * @property {(actor: object|null|undefined, action: string, scope: CoachingScope) => { ok: boolean, code?: string, error?: string, actor?: object, scope?: object }} authorize
 */

/**
 * @returns {CoachingClock}
 */
export function createSystemCoachingClock() {
  return {
    nowIso() {
      return new Date().toISOString();
    },
  };
}

/**
 * Deterministic sequential id generator for tests / memory runtime.
 * Does not use Math.random or crypto.randomUUID.
 *
 * @param {() => string} [entropy]
 * @returns {CoachingIdGenerator}
 */
export function createSequentialCoachingIdGenerator(
  entropy = () => "seq"
) {
  let seq = 0;
  return {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${entropy()}_${seq}`;
    },
  };
}

/**
 * Fixed clock for deterministic tests.
 *
 * @param {string} iso
 * @returns {CoachingClock}
 */
export function createFixedCoachingClock(iso) {
  return {
    nowIso() {
      return iso;
    },
  };
}
