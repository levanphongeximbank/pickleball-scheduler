/**
 * Coaching domain public surface (COACHING-01).
 */

export {
  createCoachingScope,
  scopesEqual,
  assertSameScope,
  requireNonEmptyId,
  optionalId,
  requireVersion,
  assertExpectedVersion,
} from "./scope.js";

export {
  createCoachingProgram,
  transitionCoachingProgram,
  updateCoachingProgram,
} from "./coachingProgram.js";

export {
  createCoachReference,
  createCoachPlayerRelationship,
} from "./coachReference.js";

export {
  createCoachingEnrollment,
  transitionCoachingEnrollment,
} from "./coachingEnrollment.js";

export {
  createCurriculum,
  createLesson,
  updateLesson,
} from "./curriculum.js";

export {
  createSessionSchedule,
  createTrainingSession,
  scheduleTrainingSession,
  transitionTrainingSession,
} from "./trainingSession.js";

export {
  createAttendanceRecord,
  correctAttendanceRecord,
} from "./attendance.js";

export {
  createCoachingPackage,
  transitionCoachingPackage,
  createPackageEntitlement,
  consumePackageEntitlement,
} from "./coachingPackage.js";

export {
  createCoachingEvaluation,
  updateCoachingEvaluationDraft,
  submitCoachingEvaluation,
  createEvaluationRevision,
} from "./coachingEvaluation.js";
