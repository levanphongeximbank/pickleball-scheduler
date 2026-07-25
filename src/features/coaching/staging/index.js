/**
 * COACHING-03 staging public surface (certification helpers only).
 * Not a Production runtime entrypoint. No secrets exported.
 * Not wired into UI/runtime cutover.
 */

export {
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_STAGING_PROJECT_REF_ALLOWLIST,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  COACHING_03_PRODUCTION_DOMAIN_BLOCKLIST,
  COACHING_03_ENVIRONMENT_LABEL,
  COACHING_03_TEST_PREFIX,
  COACHING_03_OWNER_GO_TOKEN,
  COACHING_03_COACHING_02_ANCESTOR_COMMITS,
  COACHING_03_VERDICTS,
  COACHING_03_ENV_NAMES,
  COACHING_03_MANIFEST_RELATIVE_PATH,
  COACHING_03_EVIDENCE_DIR,
  COACHING_03_APPROVAL_TEMPLATE_RELATIVE_PATH,
  COACHING_03_APPROVAL_EVIDENCE_RELATIVE_PATH,
  COACHING_03_ROLE_GRANT_FORWARD_RELATIVE_PATH,
  COACHING_03_ROLE_GRANT_ROLLBACK_RELATIVE_PATH,
  COACHING_03_PHASE_28_SQL_BLOCKLIST,
  COACHING_03_CANONICAL_TABLES,
  COACHING_03_FORWARD_SQL_ORDER,
  COACHING_03_ROLLBACK_SQL_PATH,
  COACHING_03_VERIFICATION_SQL_PATH,
  COACHING_03_GATES,
} from "./constants.js";

export {
  loadCoaching03StagingEnv,
  listCoaching03StagingEnvCandidates,
  getCoaching03RepoRoot,
} from "./loadCoachingStagingEnv.js";

export {
  COACHING_03_MANIFEST_HASH_ALGORITHM,
  canonicalizeCoaching03MigrationText,
  sha256CanonicalContent,
  sha256File,
  aggregateSha256ForEntries,
} from "./sqlChecksum.js";

export {
  loadCoaching03MigrationManifest,
  verifyCoaching03MigrationManifest,
} from "./migrationManifest.js";

export {
  extractSupabaseProjectRef,
  redactSecrets,
  inspectCoaching03EnvironmentIdentity,
  evaluateCoaching03WorktreeClean,
  getCoaching03HeadSha,
  isCoaching03GitAncestor,
  isCoaching03FullGitSha,
  loadCoaching03ApprovalTemplateDefaults,
  loadCoaching03OwnerApprovalEvidence,
  evaluateCoaching03ApplyGuards,
} from "./gates.js";

export {
  stripSqlComments,
  assertCatalogQueryReadOnly,
  buildCoaching03ReadOnlyCatalogProbeSql,
  isCoaching03ReadOnlyCatalogProbe,
  buildCoaching04ReadOnlyCatalogProbeSql,
  isCoaching04ReadOnlyCatalogProbe,
} from "./readOnlyCatalogQuery.js";

export {
  COACHING_03_ROLE_CATALOG_NOTES,
  COACHING_03_ACTIONS,
  COACHING_03_ADMIN_GRANT_ROLES,
  COACHING_03_PROPOSED_ROLE_GRANTS,
  COACHING_03_ACTION_DECISIONS,
  COACHING_04_COACH_GRANT_PREREQUISITES,
  COACHING_03_CERT_POSITIVE_ROLES,
  verifyCoaching03RoleMatrixCompleteness,
  isCoaching03RoleGrantProposed,
  roleHasAnyCoaching03Grant,
} from "./roleMatrix.js";
