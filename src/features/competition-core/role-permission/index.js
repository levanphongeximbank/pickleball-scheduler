/**
 * CORE-02 — Competition Role & Permission Adapter
 * Capability-local public surface (dormant). Integrator owns root barrel.
 */

export {
  CORE02_ROLE_PERMISSION_VERSION,
  CORE02_POLICY_ID,
  CORE02_ACTION_PERMISSION_MAP_VERSION,
} from "./constants/versions.js";

export {
  COMPETITION_ROLE,
  COMPETITION_ROLE_VALUES,
  isCompetitionRole,
  normalizeCompetitionRole,
  COMPETITION_PERMISSION,
  COMPETITION_PERMISSION_VALUES,
  isCompetitionPermission,
  COMPETITION_ACTION,
  COMPETITION_ACTION_VALUES,
  isCompetitionAction,
  AUTHORIZATION_DENY_REASON,
  AUTHORIZATION_DENY_REASON_VALUES,
  AUTHORIZATION_DECISION_CODE,
  isAuthorizationDenyReason,
} from "./enums/index.js";

export {
  createAuthorizationSubject,
  isAuthorizationSubject,
  createAuthorizationScope,
  isAuthorizationScope,
  createAuthorizationRequest,
  createAuthorizationEvidence,
  isAuthorizationEvidence,
  createAuthorizationExplanation,
  createAuthorizationDecision,
} from "./contracts/index.js";

export {
  AUTHORIZATION_ERROR_CODE,
  AUTHORIZATION_ERROR_CODE_VALUES,
  isAuthorizationErrorCode,
  AuthorizationError,
  isAuthorizationError,
  createAuthorizationError,
} from "./errors/index.js";

export {
  matchesIdentityEvidencePort,
  createUnavailableIdentityEvidencePort,
  createStaticIdentityEvidencePort,
} from "./ports/index.js";

export {
  ACTION_PERMISSION_MAP,
  mapActionToPermissions,
  evaluateAuthorization,
} from "./services/index.js";

export {
  createIdentityProjectionEvidencePort,
  isIdentityProjectionEvidencePort,
  createTeamAuthorizationPortAdapter,
  createLineupAuthorizationPortAdapter,
  projectToMatchAuthorizationDecision,
  projectToTransitionAuthorizationDecision,
} from "./adapters/index.js";
