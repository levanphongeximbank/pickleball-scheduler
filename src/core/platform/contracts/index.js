/**
 * Platform Technical Contract Kit — Phase 1B/1C/1D/1E local exports.
 *
 * Contract-local barrel only. Not re-exported from src/core/platform/index.js.
 */

export { ok, fail, isOk, isFail } from "./result.js";
export {
  normalizeOpaqueId,
  isOpaqueId,
  OPAQUE_ID_ERROR,
} from "./opaqueId.js";
export {
  nowIso,
  parseIsoStrict,
  ISO_INSTANT_ERROR,
} from "./isoClock.js";
export {
  createActorReference,
  isActorReference,
  ACTOR_REFERENCE_ERROR,
} from "./actorReference.js";
export {
  createSubjectReference,
  isSubjectReference,
  SUBJECT_REFERENCE_ERROR,
} from "./subjectReference.js";
export {
  createSecurityContext,
  isSecurityContext,
  SECURITY_CONTEXT_ERROR,
} from "./securityContext.js";
export {
  createTraceContext,
  isTraceContext,
  TRACE_CONTEXT_ERROR,
} from "./traceContext.js";
export {
  createCommonEventEnvelope,
  isCommonEventEnvelope,
  COMMON_EVENT_ERROR,
} from "./commonEventEnvelope.js";
export {
  createPlatformScope,
  isPlatformScope,
  PLATFORM_SCOPE_ERROR,
} from "./platformScope.js";
export {
  createAuthorizationDecision,
  isAuthorizationDecision,
  AUTHORIZATION_DECISION_ERROR,
} from "./authorizationDecision.js";
