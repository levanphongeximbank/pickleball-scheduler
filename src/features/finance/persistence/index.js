/**
 * Finance durable persistence (Phase 1E contracts + Phase 1G Supabase adapter).
 *
 * Phase 1G adapter is dependency-injected and database-disconnected in tests.
 * SQL is authored (Phase 1F) but not applied. No Staging/Production connection.
 */

export {
  EXTERNAL_REFERENCE_KIND,
  EXTERNAL_REFERENCE_KIND_VALUES,
  createExternalReference,
  normalizeExternalReferences,
  externalReferencesFromDomainFields,
} from "./records/externalReference.js";

export {
  IDEMPOTENCY_EXECUTION_STATUS,
  IDEMPOTENCY_EXECUTION_STATUS_VALUES,
  EVIDENCE_VERIFICATION_STATUS,
  EVIDENCE_VERIFICATION_STATUS_VALUES,
  EVIDENCE_REDACTION_CLASSIFICATION,
  EVIDENCE_REDACTION_CLASSIFICATION_VALUES,
  EVIDENCE_RETENTION_CLASSIFICATION,
  EVIDENCE_RETENTION_CLASSIFICATION_VALUES,
  createObligationRecord,
  createInvoiceItemRecord,
  createInvoiceRecord,
  createPaymentAttemptRecord,
  createPaymentRecord,
  createReceiptRecord,
  createRefundRecord,
  createFinancialEventRecord,
  createIdempotencyRecord,
  createAuditEvidenceRecord,
  serializeRecordDeterministically,
} from "./records/index.js";

export {
  obligationToRecord,
  obligationFromRecord,
  invoiceToRecord,
  invoiceFromRecord,
  paymentAttemptToRecord,
  paymentAttemptFromRecord,
  paymentToRecord,
  paymentFromRecord,
  receiptToRecord,
  receiptFromRecord,
  refundToRecord,
  refundFromRecord,
  eventToRecord,
  eventFromRecord,
  idempotencyToRecord,
  idempotencyFromRecord,
  assertMutableAggregateStatus,
} from "./mappers/index.js";

export {
  FINANCE_DURABLE_REPOSITORY_PORTS,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  requireTenantScope,
  createBoundedListQuery,
  requireExpectedVersion,
  notFoundError,
  uniquenessConflictError,
  versionConflictError,
  tenantMismatchError,
  createDurableFinanceContractHarness,
} from "./repositories/index.js";

export {
  FINANCE_UNIT_OF_WORK_VERSION,
  FINANCE_ATOMIC_OPERATION_GROUPS,
  createFinanceUnitOfWork,
  assertFinanceUnitOfWork,
} from "./transaction/index.js";

export {
  assertExpectedVersion,
  applyOptimisticUpdate,
  rejectConcurrencySideEffectOnReplay,
} from "./transaction/optimisticConcurrency.js";

export {
  normalizePersistenceSafeMetadata,
  assertNoSecretBearingValue,
  requireRecordId,
  requireTenantId,
  requireOptimisticVersion,
  requireSafeMinorAmount,
  requireCanonicalCurrency,
  requireKnownStatus,
  serializeRecordDeterministically as serializePersistenceRecordDeterministically,
} from "./validation/index.js";

// Phase 1G — Supabase-compatible durable adapter (injected client only)
export {
  FINANCE_SCHEMA,
  FINANCE_TABLES,
  FINANCE_TABLE_NAME_VALUES,
  FORBIDDEN_BILLING_TABLES,
  FINANCE_COLUMN_MAPS,
  assertSupabaseFinanceClient,
  createFakeSupabaseFinanceClient,
  mapSupabaseFinanceError,
  createSupabaseFinanceRepositories,
  createSupabaseFinanceUnitOfWork,
} from "./supabase/index.js";
