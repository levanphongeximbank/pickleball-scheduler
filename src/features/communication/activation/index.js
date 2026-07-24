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
