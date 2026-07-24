/**
 * Platform Core adapters public barrel.
 */

export {
  projectIdentityActor,
  IDENTITY_ACTOR_ADAPTER_ERROR,
  projectSecurityContext,
  SECURITY_CONTEXT_ADAPTER_ERROR,
  projectTenantScope,
  TENANT_SCOPE_ADAPTER_ERROR,
  projectPermissionCode,
  PERMISSION_CODE_ADAPTER_ERROR,
  projectAuthorizationRequest,
  AUTHORIZATION_REQUEST_ADAPTER_ERROR,
  projectAuthorizationDecision,
  AUTHORIZATION_DECISION_ADAPTER_ERROR,
} from "./identityTenant/index.js";

export {
  projectEventTraceContext,
  EVENT_TRACE_CONTEXT_ADAPTER_ERROR,
  projectCommonEventEnvelope,
  COMMON_EVENT_ENVELOPE_ADAPTER_ERROR,
  projectAuditEventEnvelope,
  AUDIT_EVENT_ENVELOPE_ADAPTER_ERROR,
  projectEventErrorDescriptor,
  EVENT_ERROR_DESCRIPTOR_ADAPTER_ERROR,
} from "./eventAudit/index.js";

export {
  projectIdempotencyKey,
  IDEMPOTENCY_KEY_ADAPTER_ERROR,
  projectOperationIdentity,
  OPERATION_IDENTITY_ADAPTER_ERROR,
  projectContractVersion,
  CONTRACT_VERSION_ADAPTER_ERROR,
  projectCompatibilityDecision,
  COMPATIBILITY_DECISION_ADAPTER_ERROR,
} from "./operationCompatibility/index.js";

export {
  projectIntegrationPortDescriptor,
  INTEGRATION_PORT_DESCRIPTOR_ADAPTER_ERROR,
  projectPlatformCapabilityDescriptor,
  PLATFORM_CAPABILITY_DESCRIPTOR_ADAPTER_ERROR,
} from "./integrationCapability/index.js";
