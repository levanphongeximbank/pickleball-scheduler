/**
 * COMMS-ACT-01 Staging activation readiness (Communication-owned).
 */

export {
  COMMS_STAGING_PROJECT_REF,
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF_ALLOWLIST,
  COMMS_PRODUCTION_PROJECT_REF_BLOCKLIST,
  COMMS_ACT_01_ENV_NAMES,
  COMMS_ACT_01_FORWARD_SQL_RELATIVE,
  COMMS_ACT_01_ROLLBACK_SQL_RELATIVE,
  COMMS_ACT_01_EVIDENCE_DIR_RELATIVE,
  extractSupabaseProjectRef,
  isEnvTokenPresent,
  evaluateCommsStagingTargetIdentity,
} from "./stagingTarget.js";

export {
  COMMS_ACT_01_EXPECTED_TABLE_COUNT,
  COMMS_ACT_01_EXPECTED_RPC,
  COMMS_ACT_01_EXPECTED_TRIGGERS,
  COMMS_ACT_01_DEPENDENCY_HELPERS,
  getCommsAct01RepoRoot,
  stripSqlComments,
  sha256Hex,
  loadCommsAct01SqlPackageManifest,
  verifyCommsAct01SqlPackage,
} from "./sqlPackageManifest.js";

export {
  COMMS_ACT_01_VERDICTS,
  COMMS_ACT_01_RLS_CAPABILITY_VERDICTS,
  getCommsAct01RlsReadinessMatrix,
  tokensMatch,
  evaluateCommsAct01BackupGate,
  evaluateCommsAct01OwnerGoGate,
  evaluateCommsAct01Preflight,
} from "./commsAct01Gates.js";

export {
  COMMS_ACT_03_FORWARD_SQL_RELATIVE,
  COMMS_ACT_03_ROLLBACK_SQL_RELATIVE,
  COMMS_ACT_03_EXPECTED_HELPERS,
  COMMS_ACT_03_CLUB_SELECT_POLICIES,
  COMMS_ACT_03_SELECT_GRANT_TABLES,
  getCommsAct03RepoRoot,
  loadCommsAct03SqlPackageManifest,
  verifyCommsAct03SqlPackage,
} from "./commsAct03SqlManifest.js";

export {
  COMMS_ACT_03_VERDICTS,
  getCommsAct03AuthorizationSnapshot,
  evaluateCommsAct03Preflight,
} from "./commsAct03Gates.js";

export {
  COMMS_ACT_05_VERDICTS,
  COMMS_ACT_05_DOCS_RELATIVE,
  COMMS_ACT_05_REQUIRED_DOCS,
  getCommsAct05RepoRoot,
  getCommsAct05CapabilityState,
  evaluateCommsAct05TrustedBackendHost,
  evaluateCommsAct05OwnerGoGate,
  evaluateCommsAct05BackupGate,
  evaluateCommsAct05Preflight,
} from "./commsAct05Gates.js";
