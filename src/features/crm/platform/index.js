/**
 * CRM Platform Core adoption surface.
 * Import only from src/core/platform/index.js via the adapter module.
 */

export {
  CRM_PLATFORM_ADAPTER_ERROR,
  projectCrmActor,
  projectCrmScope,
  projectCrmLeadSubject,
  projectCrmCustomerSubject,
  projectCrmPermission,
  projectCrmSecurityContext,
  projectCrmAuthorizationRequest,
  projectCrmAuthorizationDecision,
  projectCrmOperationIdentity,
  projectCrmEventEnvelope,
  projectCrmErrorDescriptor,
  projectCrmCapabilityDescriptor,
} from "./crmPlatformAdapter.js";
