/**
 * CUSTOMER-07 staging public surface (certification helpers only).
 * Not a Production runtime entrypoint. No secrets exported.
 */

export {
  CUSTOMER_07_STAGING_PROJECT_REF,
  CUSTOMER_07_STAGING_PROJECT_REF_ALLOWLIST,
  CUSTOMER_07_PRODUCTION_PROJECT_REF_BLOCKLIST,
  CUSTOMER_07_PRODUCTION_DOMAIN_BLOCKLIST,
  CUSTOMER_07_ENVIRONMENT_LABEL,
  CUSTOMER_07_TEST_PREFIX,
  CUSTOMER_07_VERDICTS,
  CUSTOMER_07_ENV_NAMES,
  CUSTOMER_07_MANIFEST_RELATIVE_PATH,
  CUSTOMER_07_EVIDENCE_DIR,
  CUSTOMER_07_ROLLBACK_PATHS,
  CUSTOMER_07_SOFT_DISABLE_RELATIVE_PATH,
  CUSTOMER_07_CRM_SAFETY_STASH_MARKERS,
} from "./constants.js";

export {
  loadCustomer07StagingEnv,
  listCustomer07StagingEnvCandidates,
  getCustomer07RepoRoot,
} from "./loadCustomerStagingEnv.js";

export {
  sha256File,
  loadCustomer07MigrationManifest,
  verifyCustomer07MigrationManifest,
} from "./migrationManifest.js";

export {
  resolveCustomer07SupabaseUrl,
  inspectCustomer07EnvironmentIdentity,
  evaluateCustomer07BackupRollbackGate,
  evaluateCustomer07CredentialsGate,
  evaluateCustomer07SafetyBaseline,
  evaluateCustomer07PreWriteGates,
  loadCustomer07OwnerDecision,
} from "./customer07Gates.js";

export { createSupabaseCustomerDatabaseClient } from "./createSupabaseCustomerDatabaseClient.js";
