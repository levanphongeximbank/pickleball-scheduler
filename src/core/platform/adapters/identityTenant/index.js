/**
 * Identity / Tenant adoption adapters (Platform Core).
 *
 * Pure projection helpers over already-resolved runtime values.
 * Do not authenticate, evaluate RBAC, restore sessions, or access I/O.
 */

export {
  projectIdentityActor,
  IDENTITY_ACTOR_ADAPTER_ERROR,
} from "./identityActorAdapter.js";

export {
  projectSecurityContext,
  SECURITY_CONTEXT_ADAPTER_ERROR,
} from "./securityContextAdapter.js";

export {
  projectTenantScope,
  TENANT_SCOPE_ADAPTER_ERROR,
} from "./tenantScopeAdapter.js";

export {
  projectPermissionCode,
  PERMISSION_CODE_ADAPTER_ERROR,
} from "./permissionCodeAdapter.js";

export {
  projectAuthorizationRequest,
  AUTHORIZATION_REQUEST_ADAPTER_ERROR,
} from "./authorizationRequestAdapter.js";

export {
  projectAuthorizationDecision,
  AUTHORIZATION_DECISION_ADAPTER_ERROR,
} from "./authorizationDecisionAdapter.js";
