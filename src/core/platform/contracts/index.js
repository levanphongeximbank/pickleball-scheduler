/**
 * Platform Technical Contract Kit — Phase 1B–1J local exports.
 *
 * Contract-local barrel (implementation source of truth).
 * Public integration surface re-exports these from src/core/platform/index.js (Phase 2A).
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
export {
  createRoleCode,
  isRoleCode,
  ROLE_CODE_ERROR,
} from "./roleCode.js";
export {
  createPermissionCode,
  isPermissionCode,
  PERMISSION_CODE_ERROR,
} from "./permissionCode.js";
export {
  createAuthorizationRequest,
  isAuthorizationRequest,
  AUTHORIZATION_REQUEST_ERROR,
} from "./authorizationRequest.js";
export {
  createIdempotencyKey,
  isIdempotencyKey,
  IDEMPOTENCY_KEY_ERROR,
} from "./idempotencyKey.js";
export {
  createOperationIdentity,
  isOperationIdentity,
  OPERATION_IDENTITY_ERROR,
} from "./operationIdentity.js";
export {
  createContractVersion,
  isContractVersion,
  CONTRACT_VERSION_ERROR,
} from "./contractVersion.js";
export {
  createCompatibilityDecision,
  isCompatibilityDecision,
  COMPATIBILITY_DECISION_ERROR,
} from "./compatibilityDecision.js";
export {
  createPlatformErrorDescriptor,
  isPlatformErrorDescriptor,
  PLATFORM_ERROR_DESCRIPTOR_ERROR,
} from "./platformErrorDescriptor.js";
export {
  createIntegrationPortDescriptor,
  isIntegrationPortDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ERROR,
} from "./integrationPortDescriptor.js";
export {
  createPlatformCapabilityDescriptor,
  isPlatformCapabilityDescriptor,
  PLATFORM_CAPABILITY_DESCRIPTOR_ERROR,
} from "./platformCapabilityDescriptor.js";
