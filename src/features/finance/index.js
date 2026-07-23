/**
 * Finance Foundation — public facade (Phase 1B–1I).
 *
 * Export only canonical public contracts. Consumers must import from this
 * index — not from internal file paths — once wiring begins in later phases.
 *
 * Does NOT export:
 * - mutable in-memory internal storage maps
 * - test-only reset helpers (use createInMemoryFinanceRepositories().resetAllForTests
 *   or createDurableFinanceContractHarness().resetAllForTests
 *   or createFakeSupabaseFinanceClient for adapter tests
 *   or createFinanceRuntimeTestHarness().resetAllForTests)
 * - private fingerprint/normalization internals beyond documented helpers
 * - SQL apply / live payment provider / UI / Billing surfaces
 * - initialized Supabase credentials or application singletons
 * - Production-activated Finance runtime (Phase 1I/1J default is disabled; Staging flag OFF)
 */

// Errors
// Errors
export {
  FINANCE_ERROR_CODES,
  FINANCE_ERROR_CODE_VALUES,
  isFinanceErrorCode,
  FinanceError,
  isFinanceError,
  isRetryableFinanceError,
} from "./errors/index.js";

// Currency
export {
  FINANCE_CURRENCY_VND,
  FINANCE_SUPPORTED_CURRENCIES,
  FINANCE_ALLOWED_CURRENCY_CODES,
  normalizeCurrencyCode,
  requireSupportedCurrency,
  isSupportedCurrency,
  getCurrencyMeta,
} from "./domain/currency.js";

// Money
export {
  assertMinorAmount,
  createMoney,
  isMoney,
  requireMoney,
  zeroMoney,
  addMoney,
  subtractMoney,
  moneyEquals,
  compareMoney,
  divideWithHalfAwayFromZero,
  applyPercentBps,
  serializeMoney,
  deserializeMoney,
} from "./domain/money.js";

// Fee definition + policy
export {
  FEE_TYPE,
  FEE_TYPE_VALUES,
  FEE_STATUS,
  FEE_STATUS_VALUES,
  createFeeDefinition,
  evaluateFeeDefinition,
} from "./domain/feeDefinition.js";
export { createFeePolicy, evaluateFeePolicy } from "./contracts/feePolicy.js";

// Obligation
export {
  OBLIGATION_STATUS,
  OBLIGATION_STATUS_VALUES,
  OBLIGATION_TERMINAL_STATUSES,
  OBLIGATION_ALLOWED_TRANSITIONS,
  createObligation,
  openObligation,
  applyObligationSettlement,
  cancelObligation,
  expireObligation,
  assertObligationAmountImmutable,
} from "./domain/obligation.js";

// Invoice
export {
  INVOICE_STATUS,
  INVOICE_STATUS_VALUES,
  INVOICE_TERMINAL_STATUSES,
  INVOICE_ALLOWED_TRANSITIONS,
  createInvoiceItem,
  sumInvoiceItems,
  createInvoice,
  issueInvoice,
  assertIssuedInvoiceImmutable,
  applyInvoicePaymentHint,
  voidInvoice,
} from "./domain/invoice.js";

// Payment attempt
export {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_ATTEMPT_STATUS_VALUES,
  PAYMENT_ATTEMPT_TERMINAL_STATUSES,
  PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS,
  createPaymentAttempt,
  confirmPaymentAttempt,
  failPaymentAttempt,
  cancelPaymentAttempt,
  expirePaymentAttempt,
  assertProviderTransactionReferenceImmutable,
} from "./domain/paymentAttempt.js";

// Payment
export {
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TERMINAL_STATUSES,
  PAYMENT_ALLOWED_TRANSITIONS,
  createPayment,
  addPaymentAttempt,
  confirmPayment,
  failPayment,
  cancelPayment,
  expirePayment,
  getRefundableAmount,
  recordPaymentRefund,
} from "./domain/payment.js";

// Receipt
export {
  createReceipt,
  serializeReceipt,
  issueReceiptFromPayment,
} from "./domain/receipt.js";

// Refund
export {
  REFUND_STATUS,
  REFUND_STATUS_VALUES,
  REFUND_TERMINAL_STATUSES,
  REFUND_ALLOWED_TRANSITIONS,
  createRefund,
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefund,
  assertCompletedRefundImmutable,
} from "./domain/refund.js";

// Idempotency (domain helpers)
export {
  FINANCE_IDEMPOTENCY_VERSION,
  normalizeIdempotencyInput,
  buildFinanceIdempotencyKey,
  assertIdempotencyKeyMatch,
} from "./domain/idempotency.js";

// Events
export {
  FINANCE_OWNING_MODULE,
  FINANCE_EVENT_VERSION,
  FINANCE_EVENT_TYPE,
  FINANCE_EVENT_TYPE_VALUES,
  FINANCE_PRIVACY_CLASSIFICATION,
  FINANCE_PRIVACY_CLASSIFICATION_VALUES,
  FINANCE_EVENTS_REQUIRING_AMOUNT,
  FINANCE_EVENTS_REQUIRING_EVIDENCE,
  isFinanceEventType,
} from "./events/catalogue.js";
export { createFinanceEvent, serializeFinanceEvent } from "./events/envelope.js";

// ---------------------------------------------------------------------------
// Phase 1C — Application services + repository ports
// ---------------------------------------------------------------------------

export { FINANCE_REPOSITORY_PORTS } from "./repositories/ports.js";

/**
 * In-memory repositories — development / testing capability proof only.
 * Not production persistence.
 */
export { createInMemoryFinanceRepositories } from "./repositories/inMemory.js";

export {
  createFinanceApplication,
  createSequentialIdGenerator,
  createFinanceEventRecorder,
  createFeeApplicationService,
  createObligationApplicationService,
  createInvoiceApplicationService,
  createPaymentApplicationService,
  createReceiptApplicationService,
  createRefundApplicationService,
  buildCanonicalRequestFingerprint,
  FEE_OPERATIONS,
  OBLIGATION_OPERATIONS,
  INVOICE_OPERATIONS,
  PAYMENT_OPERATIONS,
  RECEIPT_OPERATIONS,
  REFUND_OPERATIONS,
} from "./application/index.js";

// ---------------------------------------------------------------------------
// Phase 1D — Provider-neutral payment port
// ---------------------------------------------------------------------------

export {
  FINANCE_PROVIDER_PORT_VERSION,
  FINANCE_PROVIDER_CODE,
  PROVIDER_PAYMENT_STATUS,
  PROVIDER_PAYMENT_STATUS_VALUES,
  PROVIDER_REFUND_STATUS,
  PROVIDER_REFUND_STATUS_VALUES,
  PROVIDER_WEBHOOK_EVENT_TYPE,
  PROVIDER_WEBHOOK_EVENT_TYPE_VALUES,
  PROVIDER_OPERATION,
  PROVIDER_OPERATION_VALUES,
  createProviderCapabilities,
  assertProviderOperationSupported,
  assertProviderCurrencySupported,
  createProviderError,
  throwProviderError,
  PROVIDER_ERROR_RETRYABLE,
  createProviderOperationContext,
  createPaymentInitiationRequest,
  createPaymentInitiationResult,
  createPaymentVerificationResult,
  createNormalizedProviderEvidence,
  createRefundInitiationRequest,
  createRefundProviderResult,
  createProviderWebhookInput,
  createNormalizedWebhookEvent,
  normalizeSafeMetadata,
  MAX_WEBHOOK_BODY_CHARS,
  PAYMENT_PROVIDER_PORT_METHODS,
  assertPaymentProviderPort,
  createMockPaymentProvider,
} from "./providers/index.js";

// ---------------------------------------------------------------------------
// Phase 1E — Durable persistence contracts
// Phase 1G — Supabase-compatible durable adapter (injected client; not applied SQL)
// ---------------------------------------------------------------------------

export {
  EXTERNAL_REFERENCE_KIND,
  EXTERNAL_REFERENCE_KIND_VALUES,
  createExternalReference,
  IDEMPOTENCY_EXECUTION_STATUS,
  IDEMPOTENCY_EXECUTION_STATUS_VALUES,
  EVIDENCE_VERIFICATION_STATUS,
  EVIDENCE_REDACTION_CLASSIFICATION,
  EVIDENCE_RETENTION_CLASSIFICATION,
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
  FINANCE_DURABLE_REPOSITORY_PORTS,
  createBoundedListQuery,
  requireTenantScope,
  requireExpectedVersion,
  createDurableFinanceContractHarness,
  FINANCE_UNIT_OF_WORK_VERSION,
  FINANCE_ATOMIC_OPERATION_GROUPS,
  createFinanceUnitOfWork,
  assertExpectedVersion,
  applyOptimisticUpdate,
  FINANCE_TABLES,
  FINANCE_TABLE_NAME_VALUES,
  FORBIDDEN_BILLING_TABLES,
  FINANCE_COLUMN_MAPS,
  assertSupabaseFinanceClient,
  createFakeSupabaseFinanceClient,
  mapSupabaseFinanceError,
  createSupabaseFinanceRepositories,
  createSupabaseFinanceUnitOfWork,
} from "./persistence/index.js";

// ---------------------------------------------------------------------------
// Phase 1I — Runtime composition foundation (opt-in; default disabled)
// ---------------------------------------------------------------------------

export {
  FINANCE_RUNTIME_MODE,
  FINANCE_RUNTIME_MODE_VALUES,
  FINANCE_RUNTIME_ENVIRONMENT,
  FINANCE_RUNTIME_ENVIRONMENT_VALUES,
  FINANCE_TENANT_STRATEGY,
  FINANCE_TENANT_STRATEGY_VALUES,
  FINANCE_PROVIDER_STRATEGY,
  FINANCE_PROVIDER_STRATEGY_VALUES,
  FINANCE_PERSISTENCE_EXPECTATION,
  FINANCE_TRANSACTION_EXPECTATION,
  createDefaultFinanceRuntimeConfig,
  validateFinanceRuntimeConfig,
  isForbiddenRuntimeSecretKey,
  FINANCE_RUNTIME_ERROR_CODES,
  createFinanceRuntimeError,
  throwFinanceRuntimeError,
  throwRuntimeDisabled,
  throwApplicationCommandsUnavailable,
  FINANCE_READINESS_STATE,
  FINANCE_READINESS_STATE_VALUES,
  FINANCE_DEFAULT_PROBE_TIMEOUT_MS,
  buildFinanceReadinessReport,
  serializeFinanceReadiness,
  deriveFinanceReadiness,
  inspectFinanceRuntimeHealth,
  FINANCE_STAGING_CERTIFICATION_REFERENCE,
  buildFinanceCapabilityReport,
  createFinanceRuntime,
  createFinanceRuntimeTestHarness,
  FINANCE_STAGING_RUNTIME_FLAG,
  FINANCE_APP_ENV_KEY,
  FINANCE_APP_ENVIRONMENT,
  FINANCE_STAGING_ACTIVATION_REASON,
  classifyFinanceAppEnvironment,
  isFinanceStagingRuntimeFlagEnabled,
  readFinanceStagingEnvFromImportMeta,
  resolveFinanceStagingActivation,
  createAuthenticatedFinanceTenantResolver,
  createFinanceAppComposition,
} from "./runtime/index.js";
