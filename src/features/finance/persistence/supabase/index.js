/**
 * Finance Supabase durable adapter (Phase 1G).
 *
 * Dependency-injected client only. No credentials, env, or network here.
 */

export {
  FINANCE_SCHEMA,
  FINANCE_TABLES,
  FINANCE_TABLE_NAME_VALUES,
  FORBIDDEN_BILLING_TABLES,
  FINANCE_COLUMN_MAPS,
  FEE_DEFINITION_COLUMNS,
  OBLIGATION_COLUMNS,
  INVOICE_COLUMNS,
  INVOICE_ITEM_COLUMNS,
  PAYMENT_COLUMNS,
  PAYMENT_ATTEMPT_COLUMNS,
  RECEIPT_COLUMNS,
  REFUND_COLUMNS,
  EVENT_COLUMNS,
  IDEMPOTENCY_COLUMNS,
  AUDIT_EVIDENCE_COLUMNS,
} from "./schema.js";

export {
  assertSupabaseFinanceClient,
  assertFinanceTableName,
  createFakeSupabaseFinanceClient,
} from "./clientContract.js";

export {
  mapSupabaseFinanceError,
  sanitizePersistenceErrorContext,
  extractClientErrorParts,
  malformedRowError,
} from "./errorMapping.js";

export { createSupabaseFinanceRepositories } from "./createSupabaseFinanceRepositories.js";
export { createSupabaseFinanceUnitOfWork } from "./SupabaseFinanceUnitOfWork.js";
