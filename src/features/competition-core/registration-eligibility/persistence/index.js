/**
 * Phase 1F — Core-03 persistence foundation public surface (capability-local).
 *
 * Does not expose database clients, credentials, mutable store maps,
 * raw query builders, or test connection handles.
 */

export { PERSISTENCE_FOUNDATION_VERSION } from "../contracts/shared.js";

export {
  createParameterizedSqlStatement,
  buildInsertRegistrationSql,
  buildSelectRegistrationByIdSql,
  buildInsertAuditEventSql,
  isSafeParameterizedStatement,
} from "./parameterizedSql.js";

export {
  createPersistencePartialSuccess,
  runPersistenceTransaction,
  mapPersistenceError,
} from "./transactionBoundary.js";

export { createCore03MemoryPersistenceStore } from "./memoryPersistenceStore.js";

export {
  createRegistrationRepositoryAdapter,
  createRegistrationAuditRepositoryAdapter,
  createEligibilityEvidenceRepositoryAdapter,
  createCapacityStateRepositoryAdapter,
  createCapacityReservationRepositoryAdapter,
  createWaitlistRepositoryAdapter,
  createCore03PersistenceRepositories,
} from "./createCore03PersistenceRepositories.js";

/** Migration artifact status — authored only; never applied by this module. */
export const CORE03_PHASE_1F_MIGRATION_STATUS = Object.freeze({
  status: "AUTHORED_NOT_APPLIED",
  authored: true,
  applied: false,
  sqlPath: "docs/competition-engine/core-03/supabase-core03-phase1f-persistence.sql",
  rollbackPath:
    "docs/competition-engine/core-03/supabase-core03-phase1f-persistence-rollback.sql",
  stagingFirstRequired: true,
  productionOwnerApprovalRequired: true,
  tenantClientRlsPolicy: "DEFERRED_FAIL_CLOSED",
  core02EntryCreation: "DEFERRED_FAIL_CLOSED",
  sqlApply: "DEFERRED_STAGING_FIRST_GATE",
});

/** Phase 1G closure metadata — intentional capability export (not a composition root). */
export const CORE03_PHASE_1G_CLOSURE_STATUS = Object.freeze({
  phase: "1G",
  status: "RUNTIME_QA_COMPLETE",
  migrationStatus: "AUTHORED_NOT_APPLIED",
  tenantClientRlsPolicy: "DEFERRED_FAIL_CLOSED",
  core02EntryCreation: "DEFERRED_FAIL_CLOSED",
  productionCompositionRoot: false,
  databaseConnected: false,
  sqlApplied: false,
  testOnlyRuntimeHarness: "fixtures/runtimeCompositionHarness.js",
  testOnlyRuntimeHarnessExportedOnCapabilityBarrel: false,
  stagingRolloutChecklist:
    "docs/competition-engine/core-03/10_STAGING_ROLLOUT_CHECKLIST.md",
  verificationQueries:
    "docs/competition-engine/core-03/09_MIGRATION_VERIFICATION_QUERIES.md",
  closureDocument: "docs/competition-engine/core-03/08_PHASE_1G_RUNTIME_QA_CLOSURE.md",
  reconciliationDocument: "docs/competition-engine/core-03/11_RECONCILIATION_QA.md",
  closureVerdict: "CORE03_READY_TO_CLOSE",
});
