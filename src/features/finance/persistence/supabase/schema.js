/**
 * Phase 1F Finance schema mapping constants (Phase 1G).
 * Targets public.finance_* only — never SaaS Billing tables.
 */

export const FINANCE_SCHEMA = "public";

export const FINANCE_TABLES = Object.freeze({
  feeDefinitions: "finance_fee_definitions",
  auditEvidence: "finance_audit_evidence",
  obligations: "finance_obligations",
  invoices: "finance_invoices",
  invoiceItems: "finance_invoice_items",
  payments: "finance_payments",
  paymentAttempts: "finance_payment_attempts",
  receipts: "finance_receipts",
  refunds: "finance_refunds",
  events: "finance_events",
  idempotency: "finance_idempotency",
});

export const FINANCE_TABLE_NAME_VALUES = Object.freeze(Object.values(FINANCE_TABLES));

/** Billing tables that Finance adapters must never target. */
export const FORBIDDEN_BILLING_TABLES = Object.freeze([
  "invoices",
  "invoice_items",
  "payments",
  "plans",
  "plan_limits",
  "tenant_subscriptions",
  "billing_events",
  "billing_audit_logs",
]);

/**
 * Canonical camelCase record field → snake_case DB column for shared subjects.
 */
export const SUBJECT_COLUMN_MAP = Object.freeze({
  subjectVenueId: "subject_venue_id",
  subjectClubId: "subject_club_id",
  subjectCompetitionId: "subject_competition_id",
  subjectRegistrationId: "subject_registration_id",
  subjectEntryId: "subject_entry_id",
  subjectBookingId: "subject_booking_id",
  subjectPlayerId: "subject_player_id",
  subjectCustomerId: "subject_customer_id",
});

export const COMMON_COLUMNS = Object.freeze({
  id: "id",
  tenantId: "tenant_id",
  version: "version",
  status: "status",
  amountMinor: "amount_minor",
  currency: "currency",
  correlationId: "correlation_id",
  causationId: "causation_id",
  idempotencyKey: "idempotency_key",
  metadata: "metadata",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const FEE_DEFINITION_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  feeType: "fee_type",
  name: "name",
  description: "description",
  policyVersion: "policy_version",
  effectiveFrom: "effective_from",
  effectiveTo: "effective_to",
  ...SUBJECT_COLUMN_MAP,
});

export const OBLIGATION_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  settledAmountMinor: "settled_amount_minor",
  feeId: "fee_id",
  invoiceId: "invoice_id",
  businessReference: "business_reference",
  dueAt: "due_at",
  settlementStarted: "settlement_started",
  evidenceRefs: "evidence_refs",
  ...SUBJECT_COLUMN_MAP,
});

export const INVOICE_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  invoiceNumber: "invoice_number",
  paidAmountMinor: "paid_amount_minor",
  businessReference: "business_reference",
  evidenceRefs: "evidence_refs",
  issuedAt: "issued_at",
  ...SUBJECT_COLUMN_MAP,
});

export const INVOICE_ITEM_COLUMNS = Object.freeze({
  id: "id",
  tenantId: "tenant_id",
  invoiceId: "invoice_id",
  description: "description",
  quantity: "quantity",
  unitAmountMinor: "unit_amount_minor",
  lineTotalMinor: "line_total_minor",
  currency: "currency",
  feeId: "fee_id",
  obligationId: "obligation_id",
  createdAt: "created_at",
});

export const PAYMENT_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  paymentReference: "payment_reference",
  refundedAmountMinor: "refunded_amount_minor",
  invoiceId: "invoice_id",
  obligationId: "obligation_id",
  providerCode: "provider_code",
  providerTransactionReference: "provider_transaction_reference",
  confirmedAttemptId: "confirmed_attempt_id",
  evidenceRef: "evidence_ref",
  auditEvidenceRef: "audit_evidence_ref",
  confirmedAt: "confirmed_at",
  ...SUBJECT_COLUMN_MAP,
});

export const PAYMENT_ATTEMPT_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  paymentId: "payment_id",
  attemptNumber: "attempt_number",
  providerCode: "provider_code",
  providerTransactionReference: "provider_transaction_reference",
  evidenceRef: "evidence_ref",
  auditEvidenceRef: "audit_evidence_ref",
});

export const RECEIPT_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  paymentId: "payment_id",
  paymentReference: "payment_reference",
  evidenceRef: "evidence_ref",
  auditEvidenceRef: "audit_evidence_ref",
  issuedAt: "issued_at",
  ...SUBJECT_COLUMN_MAP,
});

export const REFUND_COLUMNS = Object.freeze({
  ...COMMON_COLUMNS,
  paymentId: "payment_id",
  reason: "reason",
  evidenceRef: "evidence_ref",
  auditEvidenceRef: "audit_evidence_ref",
  providerCode: "provider_code",
  providerRefundReference: "provider_refund_reference",
  requestedAt: "requested_at",
  approvedAt: "approved_at",
  rejectedAt: "rejected_at",
  completedAt: "completed_at",
  ...SUBJECT_COLUMN_MAP,
});

export const EVENT_COLUMNS = Object.freeze({
  id: "id",
  tenantId: "tenant_id",
  eventType: "event_type",
  eventVersion: "event_version",
  occurredAt: "occurred_at",
  recordedAt: "recorded_at",
  correlationId: "correlation_id",
  causationId: "causation_id",
  idempotencyKey: "idempotency_key",
  privacyClassification: "privacy_classification",
  amountMinor: "amount_minor",
  currency: "currency",
  obligationId: "obligation_id",
  invoiceId: "invoice_id",
  paymentId: "payment_id",
  attemptId: "attempt_id",
  receiptId: "receipt_id",
  refundId: "refund_id",
  evidenceRefs: "evidence_refs",
  payloadSchemaVersion: "payload_schema_version",
  payload: "payload",
  createdAt: "created_at",
});

export const IDEMPOTENCY_COLUMNS = Object.freeze({
  id: "id",
  tenantId: "tenant_id",
  version: "version",
  operationType: "operation_type",
  idempotencyKey: "idempotency_key",
  requestFingerprint: "request_fingerprint",
  executionStatus: "execution_status",
  resultEntityType: "result_entity_type",
  resultEntityId: "result_entity_id",
  retentionPolicyRef: "retention_policy_ref",
  createdAt: "created_at",
  completedAt: "completed_at",
  updatedAt: "updated_at",
  expiresAt: "expires_at",
});

export const AUDIT_EVIDENCE_COLUMNS = Object.freeze({
  id: "id",
  tenantId: "tenant_id",
  version: "version",
  evidenceType: "evidence_type",
  providerCode: "provider_code",
  externalReference: "external_reference",
  capturedAt: "captured_at",
  verificationStatus: "verification_status",
  integrityDigest: "integrity_digest",
  redactionClassification: "redaction_classification",
  retentionClassification: "retention_classification",
  metadata: "metadata",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const FINANCE_COLUMN_MAPS = Object.freeze({
  [FINANCE_TABLES.feeDefinitions]: FEE_DEFINITION_COLUMNS,
  [FINANCE_TABLES.obligations]: OBLIGATION_COLUMNS,
  [FINANCE_TABLES.invoices]: INVOICE_COLUMNS,
  [FINANCE_TABLES.invoiceItems]: INVOICE_ITEM_COLUMNS,
  [FINANCE_TABLES.payments]: PAYMENT_COLUMNS,
  [FINANCE_TABLES.paymentAttempts]: PAYMENT_ATTEMPT_COLUMNS,
  [FINANCE_TABLES.receipts]: RECEIPT_COLUMNS,
  [FINANCE_TABLES.refunds]: REFUND_COLUMNS,
  [FINANCE_TABLES.events]: EVENT_COLUMNS,
  [FINANCE_TABLES.idempotency]: IDEMPOTENCY_COLUMNS,
  [FINANCE_TABLES.auditEvidence]: AUDIT_EVIDENCE_COLUMNS,
});
