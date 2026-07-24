/**
 * E2E-06 Governance & Reliability — public barrel.
 */

export {
  E2E06_GOVERNANCE_VERSION,
  E2E06_GOVERNANCE_PHASE,
  E2E06_RELIABILITY_POLICY_VERSION,
  E2E06_CAPABILITY,
  GOVERNANCE_QUERY,
  GOVERNANCE_QUERY_VALUES,
  GOVERNANCE_ACTION,
  GOVERNANCE_ACTION_VALUES,
  RUNTIME_HEALTH_STATE,
  RUNTIME_HEALTH_STATE_VALUES,
  ISSUE_SEVERITY,
  ISSUE_SEVERITY_VALUES,
  ISSUE_SOURCE_OWNER,
  RELIABILITY_ISSUE_CODE,
  RELIABILITY_ISSUE_CODE_VALUES,
  DEGRADED_CONTINUATION,
  DEGRADED_CONTINUATION_VALUES,
  DEPENDENCY_STATUS,
  LIFECYCLE_PROJECTION,
  GOVERNANCE_ERROR_CODE,
  GOVERNANCE_ERROR_CODE_VALUES,
  GOVERNANCE_FORBIDDEN_PUBLIC_KEYS,
} from "./constants.js";

export {
  GovernanceReliabilityError,
  isGovernanceReliabilityError,
  isGovernanceErrorCode,
  failGovernance,
  normalizeGovernanceError,
} from "./errors.js";

export {
  computeGovernanceFingerprint,
  deepFreeze,
  clonePlain,
  snapshotInput,
  stableStringify,
  isNonEmptyString,
  stripForbiddenKeys,
} from "./fingerprint.js";

export {
  GOVERNANCE_CAPABILITY,
  GOVERNANCE_ACTION_PERMISSION_MAP,
  resolveGovernanceActionPermissions,
  isKnownGovernanceAction,
} from "./permissions/governanceActionMap.js";

export {
  authorizeGovernanceCommand,
  rejectClientGrantedPermissions,
} from "./context/authorizeGovernanceCommand.js";

export {
  evaluateReliabilityPolicy,
  sortReliabilityIssues,
} from "./policy/reliabilityPolicy.js";

export { buildDegradedModeProjection } from "./policy/degradedModePolicy.js";

export { buildGovernanceStateProjection } from "./projections/buildGovernanceStateProjection.js";
export { buildIncidentProjection } from "./projections/buildIncidentProjection.js";
export { buildCertificationReadinessProjection } from "./projections/buildCertificationReadinessProjection.js";

export { buildReliabilityEvidenceManifest } from "./evidence/buildReliabilityEvidenceManifest.js";

export { evaluateOperationReadiness } from "./readiness/evaluateOperationReadiness.js";

export { evaluateReplayReadiness } from "./adapters/handoffCore21Replay.js";
export {
  evaluateImportReadiness,
  evaluateExportReadiness,
} from "./adapters/handoffCore22ImportExport.js";
export { evaluateRecoveryReadiness } from "./adapters/handoffCore23Recovery.js";
export {
  evaluatePublicationGovernanceReadiness,
  evaluateCompletionReadiness,
  evaluateArchiveGovernanceReadiness,
} from "./adapters/handoffCmLifecycleArchive.js";
export { buildAuditEvidenceHandoff } from "./adapters/handoffCore20Audit.js";

export {
  createCompetitionGovernanceReliabilityFacade,
  getCompetitionGovernanceState,
} from "./createCompetitionGovernanceReliabilityFacade.js";

export const COMPETITION_ENGINE_GOVERNANCE_RELIABILITY = Object.freeze({
  id: "competition-engine-governance-reliability",
  phase: "E2E-06",
  version: "e2e-06-governance-reliability-v1",
  wiredToProductionRuntime: false,
  ownsEngines: false,
  capabilities: Object.freeze([
    "GOV-01",
    "GOV-02",
    "GOV-03",
    "GOV-04",
    "GOV-05",
    "GOV-06",
    "GOV-07",
    "GOV-09",
    "GOV-10",
  ]),
});
